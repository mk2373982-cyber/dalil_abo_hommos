import { normalizeArabic, normalizeArabicDigits } from './arabicSearch';

export interface OpenStatusResult {
  isOpen: boolean;
  label: string;
  isAuto: boolean;
}

interface CairoClock {
  dayIndex: number; // 0 = Sun ... 5 = Fri, 6 = Sat
  minutesOfDay: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function getCairoClock(now: Date): CairoClock {
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

    return {
      dayIndex: WEEKDAY_MAP[weekdayPart] ?? now.getDay(),
      minutesOfDay: hour * 60 + minuteRaw,
    };
  } catch {
    return {
      dayIndex: now.getDay(),
      minutesOfDay: now.getHours() * 60 + now.getMinutes(),
    };
  }
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
    const isPM = period === 'م' || period === 'pm' || period.includes('مساء') || period.includes('عصر') || period.includes('ليل');
    const isAM = period === 'ص' || period === 'am' || period.includes('صباح') || period.includes('فجر');

    if (isMidnight && h === 12) {
      h = 24; // end of day (00:00 next day)
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

/**
 * Evaluates live Open/Closed status from Arabic/English working hours strings in Africa/Cairo timezone.
 * 100% client-side, zero extra server calls. Falls back gracefully to fallbackOpenNow if unparseable.
 */
export function evaluateOpenStatus(
  hours?: string,
  fallbackOpenNow = true,
  now: Date = new Date()
): OpenStatusResult {
  const fallback: OpenStatusResult = {
    isOpen: fallbackOpenNow,
    label: fallbackOpenNow ? 'مفتوح الآن' : 'مغلق حالياً',
    isAuto: false,
  };

  if (!hours || !hours.trim()) return fallback;

  const normalized = normalizeArabic(normalizeArabicDigits(hours));

  // 1. 24-hour patterns
  if (
    normalized.includes('24 ساعه') ||
    normalized.includes('24/7') ||
    normalized.includes('طوال اليوم') ||
    normalized.includes('علي مدار الساعه')
  ) {
    return { isOpen: true, label: 'مفتوح 24 ساعة', isAuto: true };
  }

  const clock = getCairoClock(now);

  // 2. Explicit Friday holiday checks
  const fridayClosed =
    normalized.includes('عدا الجمعه') ||
    normalized.includes('ما عدا الجمعه') ||
    normalized.includes('الجمعه اجازه') ||
    normalized.includes('السبت الي الخميس') ||
    normalized.includes('السبت - الخميس') ||
    normalized.includes('السبت للخميس');

  if (fridayClosed && clock.dayIndex === 5) {
    return { isOpen: false, label: 'مغلق (إجازة الجمعة)', isAuto: true };
  }

  // 3. Parse one or more time ranges like:
  // "9 صباحا - 10 مساء", "4:00 م - 9:00 م", "10 ص - 12 منتصف الليل", "09:00 - 22:00", "من 9 ص الي 5 م"
  const periodGroup = '(?:منتصف الليل|صباحا|مساءا|مساء|ظهرا|عصرا|ليلا|فجرا|ص|م|am|pm)';
  const timePattern = `(\\d{1,2})(?::(\\d{2}))?\\s*(${periodGroup})?`;
  const rangeRegex = new RegExp(`${timePattern}\\s*(?:-|–|—|الي|حتي|ل)\\s*${timePattern}`, 'gi');

  const ranges: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(normalized)) !== null) {
    const [, h1, m1, p1, h2, m2, p2] = match;
    // Skip obvious date/day-only numbers without any colon or period if both lack indicators and values are weird
    if (!m1 && !p1 && !m2 && !p2 && (Number(h1) > 24 || Number(h2) > 24)) continue;

    const start = parseTimeToken(h1, m1, p1);
    let end = parseTimeToken(h2, m2, p2);
    if (start === null || end === null) continue;

    // Heuristic: if second has no period and end <= start and start < 12*60 and end <= 12*60, assume PM for end
    if (!p2 && !m2 && end <= start && end <= 12 * 60 && start < 12 * 60) {
      end += 12 * 60;
    }

    ranges.push({ start, end });
  }

  if (ranges.length === 0) return fallback;

  const isOpenNow = ranges.some(({ start, end }) => {
    if (end === 24 * 60) {
      return clock.minutesOfDay >= start;
    }
    if (end > start) {
      return clock.minutesOfDay >= start && clock.minutesOfDay < end;
    }
    // Overnight range (e.g. 18:00 - 02:00)
    return clock.minutesOfDay >= start || clock.minutesOfDay < end;
  });

  return {
    isOpen: isOpenNow,
    label: isOpenNow ? 'مفتوح الآن' : 'مغلق حالياً',
    isAuto: true,
  };
}
