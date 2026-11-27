/**
 * Vitest unit tests for src/lib/workingHours.ts
 *
 * Focuses on evaluateOpenStatus — especially the openNow fallback behavior —
 * plus schedule parsing and summary formatting used by the listing cards.
 */
import { describe, expect, it } from 'vitest';
import type { TimeSlot, WeeklySchedule } from '../../types';
import {
  evaluateOpenStatus,
  formatWeeklyScheduleSummary,
  parseHoursTextToSchedule,
} from '../workingHours';

// Fixed instant: Thursday 2026-06-11 15:30 Cairo = 13:30 UTC (EEST = UTC+3, no DST in Egypt).
// Thursday is 'thu' in the Saturday-first weekday order.
const THU_1530 = new Date('2026-06-11T13:30:00Z');

const thuOpen: WeeklySchedule = {
  sat: [],
  sun: [],
  mon: [],
  tue: [],
  wed: [],
  thu: [{ open: '09:00', close: '21:00' }],
  fri: [],
};

const thuClosedMorning: WeeklySchedule = {
  sat: [],
  sun: [],
  mon: [],
  tue: [],
  wed: [],
  thu: [{ open: '17:00', close: '22:00' }],
  fri: [],
};

describe('evaluateOpenStatus with structured schedules', () => {
  it('reports open inside a same-day slot', () => {
    const result = evaluateOpenStatus(undefined, false, THU_1530, thuOpen, false);
    expect(result).toEqual({ isOpen: true, state: 'open', label: 'مفتوح الآن', isAuto: true });
  });

  it('reports closed when the current time is outside today slots', () => {
    const result = evaluateOpenStatus(undefined, false, THU_1530, thuClosedMorning, false);
    expect(result).toEqual({ isOpen: false, state: 'closed', label: 'مغلق حالياً', isAuto: true });
  });

  it('reports a fully-closed day label when today has no slots', () => {
    const allClosed: WeeklySchedule = { sat: [], sun: [], mon: [], tue: [], wed: [], thu: [], fri: [] };
    const result = evaluateOpenStatus(undefined, false, THU_1530, allClosed, false);
    expect(result.isOpen).toBe(false);
    expect(result.state).toBe('closed');
    expect(result.label).toBe('مغلق اليوم');
    expect(result.isAuto).toBe(true);
  });

  it('honors the Friday closed label', () => {
    // Friday 2026-06-12 12:00 Cairo = 09:00 UTC
    const friNoon = new Date('2026-06-12T09:00:00Z');
    const result = evaluateOpenStatus(undefined, false, friNoon, thuOpen, false);
    expect(result.label).toBe('مغلق (إجازة الجمعة)');
  });
});

describe('evaluateOpenStatus with hours text', () => {
  it('parses a daily hours string and evaluates openness', () => {
    const result = evaluateOpenStatus('يومياً 9 ص - 9 م', false, THU_1530);
    expect(result.isOpen).toBe(true);
    expect(result.state).toBe('open');
    expect(result.isAuto).toBe(true);
  });

  it('detects 24-hour places', () => {
    const result = evaluateOpenStatus('24 ساعة', false, THU_1530);
    expect(result).toEqual({ isOpen: true, state: 'open', label: 'مفتوح 24 ساعة', isAuto: true });
  });
});

describe('evaluateOpenStatus — openNow fallback', () => {
  it('falls back to openNow=true when no schedule is available', () => {
    const result = evaluateOpenStatus(undefined, true, THU_1530);
    expect(result).toEqual({ isOpen: true, state: 'open', label: 'مفتوح الآن', isAuto: false });
  });

  it('reports unknown when there is no schedule and openNow=false', () => {
    const result = evaluateOpenStatus(undefined, false, THU_1530);
    expect(result).toEqual({
      isOpen: false,
      state: 'unknown',
      label: 'مواعيد غير مؤكدة',
      isAuto: false,
    });
  });

  it('prefers the real schedule over the fallback', () => {
    // Schedule says closed (slots start at 17:00) even though openNow=true.
    const result = evaluateOpenStatus(undefined, true, THU_1530, thuClosedMorning, false);
    expect(result.isOpen).toBe(false);
    expect(result.isAuto).toBe(true);
  });

  it('keeps the fallback fully open even when hours text is unparseable', () => {
    const result = evaluateOpenStatus('مواعيد غير محددة', true, THU_1530);
    expect(result.isOpen).toBe(true);
    expect(result.isAuto).toBe(false);
  });
});

describe('parseHoursTextToSchedule', () => {
  it('parses a daily range into all seven days', () => {
    const parsed = parseHoursTextToSchedule('يومياً 9 ص - 9 م');
    expect(parsed).not.toBeNull();
    expect(parsed?.is24Hours).toBeUndefined();
    const schedule = parsed!.schedule;
    expect(schedule.sat).toEqual([{ open: '09:00', close: '21:00' }]);
    expect(schedule.fri).toEqual([{ open: '09:00', close: '21:00' }]);
  });

  it('parses 24-hour markers', () => {
    expect(parseHoursTextToSchedule('24 ساعه')?.is24Hours).toBe(true);
    expect(parseHoursTextToSchedule('24/7')?.is24Hours).toBe(true);
    expect(parseHoursTextToSchedule('طوال اليوم')?.is24Hours).toBe(true);
  });

  it('returns null for empty or garbage input', () => {
    expect(parseHoursTextToSchedule(undefined)).toBeNull();
    expect(parseHoursTextToSchedule('')).toBeNull();
    expect(parseHoursTextToSchedule('  ')).toBeNull();
    expect(parseHoursTextToSchedule('لا شيء')).toBeNull();
  });

  it('parses day-scoped segments', () => {
    const parsed = parseHoursTextToSchedule('السبت 10 ص - 2 م | الأحد 10 ص - 2 م');
    expect(parsed).not.toBeNull();
    const schedule = parsed!.schedule;
    expect(schedule.sat).toEqual([{ open: '10:00', close: '14:00' }]);
    expect(schedule.sun).toEqual([{ open: '10:00', close: '14:00' }]);
    expect(schedule.mon).toEqual([]);
  });

  it('excludes explicitly closed days', () => {
    const parsed = parseHoursTextToSchedule('يومياً 9 ص - 9 م ما عدا الجمعة');
    expect(parsed).not.toBeNull();
    expect(parsed!.schedule.fri).toEqual([]);
    expect(parsed!.schedule.sat?.length).toBeGreaterThan(0);
  });

  it('handles overnight slots (close < open)', () => {
    const parsed = parseHoursTextToSchedule('يومياً 10 م - 2 ص');
    expect(parsed).not.toBeNull();
    const slot = parsed!.schedule.sat?.[0];
    expect(slot).toBeDefined();
    expect((slot as TimeSlot).open).toBe('22:00');
    expect((slot as TimeSlot).close).toBe('02:00');
  });
});

describe('formatWeeklyScheduleSummary', () => {
  it('returns the 24-hour label when is24Hours is set', () => {
    expect(formatWeeklyScheduleSummary(undefined, true)).toBe('مفتوح 24 ساعة طوال أيام الأسبوع');
  });

  it('returns an empty string when there is no schedule', () => {
    expect(formatWeeklyScheduleSummary(undefined, false)).toBe('');
  });

  it('returns a closed summary for an all-empty schedule', () => {
    expect(formatWeeklyScheduleSummary(thuOpen)).not.toBe('مغلق طوال الأسبوع');
    expect(
      formatWeeklyScheduleSummary({ sat: [], sun: [], mon: [], tue: [], wed: [], thu: [], fri: [] })
    ).toBe('مغلق طوال الأسبوع');
  });

  it('groups identical consecutive days into a range label', () => {
    const satSun: WeeklySchedule = {
      sat: [{ open: '09:00', close: '17:00' }],
      sun: [{ open: '09:00', close: '17:00' }],
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
    };
    const summary = formatWeeklyScheduleSummary(satSun);
    expect(summary).toContain('السبت إلى الأحد');
  });
});
