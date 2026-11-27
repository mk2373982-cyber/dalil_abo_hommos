import type { TimeSlot, WeekdayKey, WeeklySchedule } from '../types';
import { normalizeArabic, normalizeArabicDigits } from './arabicSearch';

export type OpenState = 'open' | 'closed' | 'unknown';

export interface OpenStatusResult {
  isOpen: boolean;
  state: OpenState;
  label: string;
  isAuto: boolean;
}

export const ORDERED_WEEKDAYS: WeekdayKey[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

export const WEEKDAY_ARABIC_LABELS: Record<WeekdayKey, string> = {
  sat: 'السبت',
  sun: 'الأحد',
  mon: 'الاثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
};

export function createEmptySchedule(): WeeklySchedule {
  return {
    sat: [],
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
  };
}

const JS_DAY_TO_KEY: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SHORT_EN_TO_KEY: Record<string, WeekdayKey> = {
  sun: 'sun',
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat',
};

const ARABIC_DAY_PATTERNS: Array<{ key: WeekdayKey; aliases: string[] }> = [
  { key: 'sat', aliases: ['السبت', 'سبت'] },
  { key: 'sun', aliases: ['الاحد', 'احد'] },
  { key: 'mon', aliases: ['الاثنين', 'اثنين', 'الاتنين', 'اتنين'] },
  { key: 'tue', aliases: ['الثلاثاء', 'ثلاثاء', 'التلات', 'تلات'] },
  { key: 'wed', aliases: ['الاربعاء', 'اربعاء', 'الاربع', 'اربع'] },
  { key: 'thu', aliases: ['الخميس', 'خميس'] },
  { key: 'fri', aliases: ['الجمعه', 'جمعه'] },
];

interface CairoClock {
  dayKey: WeekdayKey;
  prevDayKey: WeekdayKey;
  minutesOfDay: number;
  dateString: string;
}

export function getCairoDateString(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback below
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPrevDayKey(key: WeekdayKey): WeekdayKey {
  const idx = ORDERED_WEEKDAYS.indexOf(key);
  return ORDERED_WEEKDAYS[(idx - 1 + 7) % 7];
}

function getCairoClock(now: Date): CairoClock {
  const dateString = getCairoDateString(now);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const weekdayPart = (parts.find((p) => p.type === 'weekday')?.value || 'sat').slice(0, 3).toLowerCase();
    const hourRaw = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours());
    const minuteRaw = Number(parts.find((p) => p.type === 'minute')?.value ?? now.getMinutes());
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const dayKey = SHORT_EN_TO_KEY[weekdayPart] ?? JS_DAY_TO_KEY[now.getDay()];

    return {
      dayKey,
      prevDayKey: getPrevDayKey(dayKey),
      minutesOfDay: hour * 60 + minuteRaw,
      dateString,
    };
  } catch {
    const dayKey = JS_DAY_TO_KEY[now.getDay()];
    return {
      dayKey,
      prevDayKey: getPrevDayKey(dayKey),
      minutesOfDay: now.getHours() * 60 + now.getMinutes(),
      dateString,
    };
  }
}

function parse24hTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) return null;
  if (h === 24 && min === 0) return 24 * 60;
  if (h < 0 || h > 23) return null;
  return h * 60 + min;
}

function format24hToArabic(hhmm: string): string {
  const mins = parse24hTime(hhmm);
  if (mins === null) return hhmm;
  if (mins === 24 * 60 || mins === 0) return '12:00 منتصف الليل';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const minPart = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
  if (h24 === 12) return `12${minPart} ظ`;
  if (h24 > 12) return `${h24 - 12}${minPart} م`;
  return `${h24}${minPart} ص`;
}

export function formatWeeklyScheduleSummary(schedule?: WeeklySchedule, is24Hours?: boolean): string {
  if (is24Hours) return 'مفتوح 24 ساعة طوال أيام الأسبوع';
  if (!schedule) return '';

  const dayStrings = ORDERED_WEEKDAYS.map((day) => {
    const slots = schedule[day] || [];
    if (slots.length === 0) return { day, sig: 'CLOSED' };
    const sig = slots.map((s) => `${format24hToArabic(s.open)} - ${format24hToArabic(s.close)}`).join(' و ');
    return { day, sig };
  });

  const activeGroups: Array<{ days: WeekdayKey[]; sig: string }> = [];
  for (const entry of dayStrings) {
    if (entry.sig === 'CLOSED') continue;
    const prev = activeGroups[activeGroups.length - 1];
    if (prev && prev.sig === entry.sig) {
      prev.days.push(entry.day);
    } else {
      activeGroups.push({ days: [entry.day], sig: entry.sig });
    }
  }

  if (activeGroups.length === 0) return 'مغلق طوال الأسبوع';

  return activeGroups
    .map((g) => {
      if (g.days.length === 7) return `يومياً: ${g.sig}`;
      if (g.days.length === 1) return `${WEEKDAY_ARABIC_LABELS[g.days[0]]}: ${g.sig}`;
      return `${WEEKDAY_ARABIC_LABELS[g.days[0]]} إلى ${WEEKDAY_ARABIC_LABELS[g.days[g.days.length - 1]]}: ${g.sig}`;
    })
    .join(' | ');
}

function evaluateSlotsOnClock(
  todaySlots: TimeSlot[] | undefined,
  prevDaySlots: TimeSlot[] | undefined,
  minutesOfDay: number
): boolean {
  if (todaySlots && todaySlots.length > 0) {
    for (const slot of todaySlots) {
      const start = parse24hTime(slot.open);
      const end = parse24hTime(slot.close);
      if (start === null || end === null) continue;
      if (end === 24 * 60) {
        if (minutesOfDay >= start) return true;
      } else if (end > start) {
        if (minutesOfDay >= start && minutesOfDay < end) return true;
      } else if (end < start) {
        if (minutesOfDay >= start) return true;
      }
    }
  }

  if (prevDaySlots && prevDaySlots.length > 0) {
    for (const slot of prevDaySlots) {
      const start = parse24hTime(slot.open);
      const end = parse24hTime(slot.close);
      if (start === null || end === null) continue;
      if (end < start && end > 0) {
        if (minutesOfDay < end) return true;
      }
    }
  }

  return false;
}

function parseTimeToken(hourStr: string, minStr: string | undefined, periodRaw: string | undefined): number | null {
  let h = Number(hourStr);
  const m = minStr ? Number(minStr) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59 || h < 0 || h > 24) {
    return null;
  }

  const period = periodRaw ? normalizeArabic(periodRaw) : '';
  if (period) {
    const isMidnight = period.includes('منتصف الليل');
    const isNoon = period.includes('ظهر');
    const isPM =
      period === 'م' ||
      period === 'pm' ||
      period.includes('مساء') ||
      period.includes('عصر') ||
      period.includes('ليل');
    const isAM = period === 'ص' || period === 'am' || period.includes('صباح') || period.includes('فجر');

    if (isMidnight && h === 12) {
      h = 24;
    } else if (isNoon && h === 12) {
      h = 12;
    } else if (isPM) {
      if (h >= 1 && h <= 11) h += 12;
    } else if (isAM) {
      if (h === 12) h = 0;
    }
  }

  return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
  if (mins >= 24 * 60) return '24:00';
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function extractSlotsFromText(segmentNorm: string): TimeSlot[] {
  const periodGroup = '(?:منتصف الليل|صباحا|مساءا|مساء|ظهرا|عصرا|ليلا|فجرا|ص|م|am|pm)';
  const timePattern = `(\\d{1,2})(?::(\\d{2}))?\\s*(${periodGroup})?`;
  const rangeRegex = new RegExp(`${timePattern}\\s*(?:-|–|—|الي|حتي|ل)\\s*${timePattern}`, 'gi');

  const slots: TimeSlot[] = [];
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(segmentNorm)) !== null) {
    const [, h1, m1, p1, h2, m2, p2] = match;
    if (!m1 && !p1 && !m2 && !p2 && (Number(h1) > 24 || Number(h2) > 24)) continue;

    const start = parseTimeToken(h1, m1, p1);
    let end = parseTimeToken(h2, m2, p2);
    if (start === null || end === null) continue;

    if (!p2 && !m2 && end <= start && end <= 12 * 60 && start < 12 * 60) {
      end += 12 * 60;
    }

    slots.push({
      open: minutesToHHMM(start),
      close: minutesToHHMM(end),
    });
  }
  return slots;
}

function findMentionedDaysInOrder(textNorm: string): Array<{ key: WeekdayKey; index: number; length: number }> {
  const found: Array<{ key: WeekdayKey; index: number; length: number }> = [];
  for (const entry of ARABIC_DAY_PATTERNS) {
    for (const alias of entry.aliases) {
      const re = new RegExp(`(?:^|[\\s:|،,-])${alias}(?=$|[\\s:|،,-])`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(textNorm)) !== null) {
        const startIdx = m.index + (m[0].length - alias.length);
        if (!found.some((f) => Math.abs(f.index - startIdx) < 2)) {
          found.push({ key: entry.key, index: startIdx, length: alias.length });
        }
      }
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function expandDayRange(startKey: WeekdayKey, endKey: WeekdayKey): WeekdayKey[] {
  const startIdx = ORDERED_WEEKDAYS.indexOf(startKey);
  const endIdx = ORDERED_WEEKDAYS.indexOf(endKey);
  if (startIdx === -1 || endIdx === -1) return [startKey];
  const result: WeekdayKey[] = [];
  let idx = startIdx;
  for (let steps = 0; steps < 7; steps++) {
    result.push(ORDERED_WEEKDAYS[idx]);
    if (idx === endIdx) break;
    idx = (idx + 1) % 7;
  }
  return result;
}

export function parseHoursTextToSchedule(hours?: string): { schedule: WeeklySchedule; is24Hours?: boolean } | null {
  if (!hours || !hours.trim()) return null;
  const normalized = normalizeArabic(normalizeArabicDigits(hours));

  if (
    normalized.includes('24 ساعه') ||
    normalized.includes('24/7') ||
    normalized.includes('طوال اليوم') ||
    normalized.includes('علي مدار الساعه')
  ) {
    return { schedule: {}, is24Hours: true };
  }

  const rawSegments = normalized.split(/[|؛;\n]+/).map((s) => s.trim()).filter(Boolean);

  const schedule: WeeklySchedule = {};
  let parsedAnySlot = false;
  let hasExplicitDayScopedSegment = false;
  const explicitlyClosedDays = new Set<WeekdayKey>();

  const globalExcludeRegex = /(?:ما\s*)?عدا\s+([^\s،|]+)/g;
  let exMatch: RegExpExecArray | null;
  while ((exMatch = globalExcludeRegex.exec(normalized)) !== null) {
    const dayMentions = findMentionedDaysInOrder(exMatch[1]);
    dayMentions.forEach((d) => explicitlyClosedDays.add(d.key));
  }

  for (const segment of rawSegments) {
    if (/(?:اجازه|مغلق|عطله)/.test(segment) && extractSlotsFromText(segment).length === 0) {
      const closedMentions = findMentionedDaysInOrder(segment);
      closedMentions.forEach((d) => {
        explicitlyClosedDays.add(d.key);
        schedule[d.key] = [];
      });
      hasExplicitDayScopedSegment = hasExplicitDayScopedSegment || closedMentions.length > 0;
      continue;
    }

    const slots = extractSlotsFromText(segment);
    if (slots.length === 0) continue;
    parsedAnySlot = true;

    const segmentWithoutExcept = segment.replace(/(?:ما\s*)?عدا\s+[^\s،|:]+/g, ' ');
    const isDaily =
      segmentWithoutExcept.includes('يوميا') ||
      segmentWithoutExcept.includes('كل يوم') ||
      segmentWithoutExcept.includes('طوال الاسبوع');

    const dayMentions = findMentionedDaysInOrder(segmentWithoutExcept);

    if (dayMentions.length > 0) {
      hasExplicitDayScopedSegment = true;
      const daysForSegment = new Set<WeekdayKey>();

      let i = 0;
      while (i < dayMentions.length) {
        const curr = dayMentions[i];
        const next = dayMentions[i + 1];
        if (next) {
          const between = segmentWithoutExcept.slice(curr.index + curr.length, next.index).trim();
          if (/^(?:الي|حتي|-|–|—|ل)$/.test(between) || between.includes('الي') || between.includes('حتي')) {
            expandDayRange(curr.key, next.key).forEach((d) => daysForSegment.add(d));
            i += 2;
            continue;
          }
        }
        daysForSegment.add(curr.key);
        i += 1;
      }

      daysForSegment.forEach((d) => {
        if (!explicitlyClosedDays.has(d)) {
          schedule[d] = [...(schedule[d] || []), ...slots];
        }
      });
    } else if (isDaily || rawSegments.length === 1) {
      ORDERED_WEEKDAYS.forEach((d) => {
        if (!explicitlyClosedDays.has(d)) {
          schedule[d] = [...(schedule[d] || []), ...slots];
        }
      });
    }
  }

  if (!parsedAnySlot) return null;

  if (hasExplicitDayScopedSegment) {
    ORDERED_WEEKDAYS.forEach((d) => {
      if (!schedule[d]) {
        schedule[d] = [];
      }
    });
  }

  explicitlyClosedDays.forEach((d) => {
    schedule[d] = [];
  });

  return { schedule };
}

export function evaluateOpenStatus(
  hours?: string,
  fallbackOpenNow?: boolean,
  now: Date = new Date(),
  workingSchedule?: WeeklySchedule,
  is24Hours?: boolean
): OpenStatusResult {
  if (is24Hours) {
    return { isOpen: true, state: 'open', label: 'مفتوح 24 ساعة', isAuto: true };
  }

  const clock = getCairoClock(now);

  const hasStructuredSchedule =
    workingSchedule &&
    ORDERED_WEEKDAYS.some((d) => Array.isArray(workingSchedule[d]));

  if (hasStructuredSchedule && workingSchedule) {
    const todaySlots = workingSchedule[clock.dayKey] ?? [];
    const prevSlots = workingSchedule[clock.prevDayKey] ?? [];
    const isOpen = evaluateSlotsOnClock(todaySlots, prevSlots, clock.minutesOfDay);

    if (isOpen) {
      return { isOpen: true, state: 'open', label: 'مفتوح الآن', isAuto: true };
    }
    if (todaySlots.length === 0) {
      return {
        isOpen: false,
        state: 'closed',
        label: clock.dayKey === 'fri' ? 'مغلق (إجازة الجمعة)' : 'مغلق اليوم',
        isAuto: true,
      };
    }
    return { isOpen: false, state: 'closed', label: 'مغلق حالياً', isAuto: true };
  }

  const parsed = parseHoursTextToSchedule(hours);
  if (parsed?.is24Hours) {
    return { isOpen: true, state: 'open', label: 'مفتوح 24 ساعة', isAuto: true };
  }
  if (parsed) {
    const todaySlots = parsed.schedule[clock.dayKey] ?? [];
    const prevSlots = parsed.schedule[clock.prevDayKey] ?? [];
    const isOpen = evaluateSlotsOnClock(todaySlots, prevSlots, clock.minutesOfDay);

    if (isOpen) {
      return { isOpen: true, state: 'open', label: 'مفتوح الآن', isAuto: true };
    }
    if (todaySlots.length === 0) {
      return {
        isOpen: false,
        state: 'closed',
        label: clock.dayKey === 'fri' ? 'مغلق (إجازة الجمعة)' : 'مغلق اليوم',
        isAuto: true,
      };
    }
    return { isOpen: false, state: 'closed', label: 'مغلق حالياً', isAuto: true };
  }

  // No parseable hours and no structured schedule: fall back to the stored
  // `openNow` boolean so valid open places are not hidden behind "مواعيد غير مؤكدة".
  if (fallbackOpenNow) {
    return { isOpen: true, state: 'open', label: 'مفتوح الآن', isAuto: false };
  }

  return {
    isOpen: false,
    state: 'unknown',
    label: 'مواعيد غير مؤكدة',
    isAuto: false,
  };
}
