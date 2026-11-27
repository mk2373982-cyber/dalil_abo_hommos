/**
 * Vitest unit tests for src/lib/arabicSearch.ts
 *
 * Covers Arabic normalization (hamza/taa marbuta/alif maqsura/tashkeel/tatweel/
 * Arabic-Indic digits) and the strict-AND → multi-token-OR fallback filter.
 */
import { describe, expect, it } from 'vitest';
import {
  filterByArabicQueryOrFallback,
  matchesArabicQuery,
  normalizeArabic,
  normalizeArabicDigits,
} from '../arabicSearch';

describe('normalizeArabicDigits', () => {
  it('converts Eastern Arabic-Indic digits to ASCII digits', () => {
    expect(normalizeArabicDigits('٠١٢٣')).toBe('0123');
  });

  it('converts Extended Arabic-Indic digits to ASCII digits', () => {
    expect(normalizeArabicDigits('۰۱۲۳')).toBe('0123');
  });

  it('leaves ASCII digits untouched', () => {
    expect(normalizeArabicDigits('12345')).toBe('12345');
  });
});

describe('normalizeArabic', () => {
  it('strips tashkeel (harakat) and tatweel', () => {
    expect(normalizeArabic('مُطَعَّم')).toBe('مطعم');
  });

  it('unifies hamza-bearing alifs', () => {
    expect(normalizeArabic('أحمر إآ')).toBe('احمر اا');
  });

  it('maps taa marbuta to haa', () => {
    expect(normalizeArabic('مدرسة')).toBe('مدرسه');
  });

  it('maps alif maqsura and waw/ya hamza to ya', () => {
    expect(normalizeArabic('مصطفى علي ؤئ')).toBe('مصطفي علي وي');
  });

  it('lowercases English and collapses whitespace', () => {
    expect(normalizeArabic('  Abu  Homs\t\n')).toBe('abu homs');
  });

  it('normalizes Arabic-Indic digits as part of the full pipeline', () => {
    expect(normalizeArabic('شارع ٥')).toBe('شارع 5');
  });

  it('returns an empty string for falsy input', () => {
    expect(normalizeArabic(undefined)).toBe('');
    expect(normalizeArabic(null)).toBe('');
    expect(normalizeArabic('')).toBe('');
  });
});

describe('matchesArabicQuery', () => {
  it('matches a single normalized token inside the haystack', () => {
    expect(matchesArabicQuery('مطعم شاورما في أبوحمص', 'مطعم')).toBe(true);
  });

  it('matches across hamza/taa marbuta variants', () => {
    expect(matchesArabicQuery('مدرسة ابوحمص', 'مدرسه')).toBe(true);
  });

  it('requires every token (AND semantics)', () => {
    expect(matchesArabicQuery('مطعم شاورما', 'مطعم شاورما')).toBe(true);
    expect(matchesArabicQuery('مطعم شاورما', 'مطعم بيتزا')).toBe(false);
  });

  it('matches English tokens case-insensitively', () => {
    expect(matchesArabicQuery('pharmacy صيدلية', 'PHARMACY')).toBe(true);
  });

  it('treats an empty query as a match (pass-through)', () => {
    expect(matchesArabicQuery('anything', '   ')).toBe(true);
  });

  it('returns false for a non-empty query against an empty haystack', () => {
    expect(matchesArabicQuery('', 'مطعم')).toBe(false);
  });
});

describe('filterByArabicQueryOrFallback', () => {
  interface Place {
    id: string;
    name: string;
  }

  const places: Place[] = [
    { id: 'a', name: 'مطعم شاورما أبوحمص' },
    { id: 'b', name: 'مطعم بيتزا' },
    { id: 'c', name: 'صيدلية أبوحمص' },
    { id: 'd', name: 'عيادة أسنان' },
  ];

  const byName = (p: Place) => p.name;

  it('returns all items unchanged for an empty query', () => {
    expect(filterByArabicQueryOrFallback(places, byName, '')).toEqual(places);
  });

  it('applies strict AND matching for single-token queries', () => {
    const result = filterByArabicQueryOrFallback(places, byName, 'مطعم');
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('applies strict AND matching for multi-token queries with hits', () => {
    const result = filterByArabicQueryOrFallback(places, byName, 'مطعم شاورما');
    expect(result.map((p) => p.id)).toEqual(['a']);
  });

  it('falls back to OR matching when AND returns nothing', () => {
    const result = filterByArabicQueryOrFallback(places, byName, 'مطعم شاورما بيتزا');
    expect(result.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('sorts OR fallback results by matched-token count then original order', () => {
    // 'a' matches 2 tokens (شاورما+أبوحمص), 'b' matches 1 (بيتزا), 'c' matches 1 (أبوحمص)
    const result = filterByArabicQueryOrFallback(places, byName, 'شاورما بيتزا ابوحمص');
    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when no token matches any item', () => {
    const result = filterByArabicQueryOrFallback(places, byName, 'مستشفى');
    expect(result).toEqual([]);
  });

  it('normalizes the query before matching (hamza / taa marbuta)', () => {
    const result = filterByArabicQueryOrFallback(places, byName, 'مدرسه');
    expect(result).toEqual([]);
    expect(filterByArabicQueryOrFallback([{ id: 'x', name: 'مدرسة' }], byName, 'مدرسة')).toEqual([
      { id: 'x', name: 'مدرسة' },
    ]);
  });
});
