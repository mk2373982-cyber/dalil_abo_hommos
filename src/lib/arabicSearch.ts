/**
 * Smart Arabic search utilities — 100% client-side, zero server cost.
 * Normalizes hamzas, taa marbuta, alif maqsura, tashkeel, tatweel, and Arabic-Indic digits.
 */

const RECENT_SEARCHES_KEY = 'abh_recent_searches_v1';
const MAX_RECENT_SEARCHES = 5;

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export function normalizeArabicDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_DIGIT_MAP[ch] ?? ch);
}

export function normalizeArabic(input?: string | null): string {
  if (!input) return '';
  return normalizeArabicDigits(input)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // strip harakat/tashkeel & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches multi-word Arabic/English queries against a combined haystack string.
 * Every token in the query must appear in the normalized haystack.
 */
export function matchesArabicQuery(haystack: string, query: string): boolean {
  const normQuery = normalizeArabic(query);
  if (!normQuery) return true;
  const normHaystack = normalizeArabic(haystack);
  if (!normHaystack) return false;
  const tokens = normQuery.split(' ').filter(Boolean);
  return tokens.every((token) => normHaystack.includes(token));
}

export function getRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string): string[] {
  const clean = query.trim();
  if (clean.length < 2) return getRecentSearches();
  const normClean = normalizeArabic(clean);
  const existing = getRecentSearches().filter((item) => normalizeArabic(item) !== normClean);
  const next = [clean, ...existing].slice(0, MAX_RECENT_SEARCHES);
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota / private mode
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}
