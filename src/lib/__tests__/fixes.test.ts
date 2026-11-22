import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppUrl,
  formatEgyptWhatsApp,
  generateSecureToken,
  getPlaceDetailRoute,
  isOfferExpired,
  parseCsvLine,
} from '../formatters';
import {
  getPlacePromoScore,
  isPlaceSubscribedToFilter,
  sortPlacesByPromoPriority,
} from '../promoFilters';
import { readOfflineCatalog, writeOfflineCatalog } from '../offlineCache';
import { matchesArabicQuery, normalizeArabic, normalizeArabicDigits } from '../arabicSearch';
import { evaluateOpenStatus } from '../workingHours';
import { findZoneForText, formatDistanceKm, haversineKm } from '../abuhomsGeo';
import { buildMerchantWhatsAppReport, computePlacePerformance } from '../merchantReport';
import type { AnalyticsEvent, Place, PromoFilter } from '../../types';
import { SEED_PLACES } from '../../data/seedData';

describe('seed catalog initialization', () => {
  it('loads the public catalog without a module initialization error', () => {
    assert.ok(SEED_PLACES.length > 0);
    assert.ok(SEED_PLACES.some((place) => place.categorySlug === 'restaurants'));
  });
});

describe('generateSecureToken', () => {
  it('produces URL-safe unguessable tokens fitting Firestore ID constraints', () => {
    const token = generateSecureToken('TRK', 20);
    assert.equal(token.length, 'TRK-'.length + 20);
    assert.match(token, /^TRK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{20}$/);
    assert.ok(token.length <= 32, 'must satisfy Firestore <= 32 char ID rules');
  });

  it('produces 1000 unique tokens with no collisions', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateSecureToken('ORD', 20));
    }
    assert.equal(seen.size, 1000);
  });
});

describe('formatEgyptWhatsApp & buildWhatsAppUrl', () => {
  it('normalizes local 01x Egyptian mobile numbers', () => {
    assert.equal(formatEgyptWhatsApp('01012345678'), '201012345678');
    assert.equal(formatEgyptWhatsApp('011-2345-6789'), '201123456789');
  });

  it('normalizes +20 and 0020 international formats without double prefixing', () => {
    assert.equal(formatEgyptWhatsApp('+20 101 234 5678'), '201012345678');
    assert.equal(formatEgyptWhatsApp('00201012345678'), '201012345678');
    assert.equal(formatEgyptWhatsApp('201012345678'), '201012345678');
  });

  it('normalizes 10-digit mobile without leading zero and Egyptian landlines', () => {
    assert.equal(formatEgyptWhatsApp('1012345678'), '201012345678');
    assert.equal(formatEgyptWhatsApp('045-2561234'), '20452561234');
  });

  it('encodes Arabic message query safely in buildWhatsAppUrl', () => {
    const url = buildWhatsAppUrl('01012345678', 'مرحباً من دليل أبوحمص');
    assert.ok(url.startsWith('https://wa.me/201012345678?text='));
    assert.equal(
      decodeURIComponent(url.split('?text=')[1]),
      'مرحباً من دليل أبوحمص'
    );
  });
});

describe('isOfferExpired', () => {
  it('treats inactive offers as expired regardless of date', () => {
    assert.equal(isOfferExpired({ active: false, expiresAt: '2099-12-31' }), true);
  });

  it('treats past YYYY-MM-DD as expired and future YYYY-MM-DD as valid', () => {
    const refNow = Date.parse('2026-06-15T12:00:00');
    assert.equal(isOfferExpired({ active: true, expiresAt: '2026-06-14' }, refNow), true);
    assert.equal(isOfferExpired({ active: true, expiresAt: '2026-06-15' }, refNow), false);
    assert.equal(isOfferExpired({ active: true, expiresAt: '2026-06-16' }, refNow), false);
  });

  it('treats empty or unparseable expiresAt on active offer as not expired', () => {
    assert.equal(isOfferExpired({ active: true, expiresAt: '' }), false);
    assert.equal(isOfferExpired({ active: true, expiresAt: 'غير محدد' }), false);
  });
});

describe('parseCsvLine (RFC-4180)', () => {
  it('parses plain comma-separated values', () => {
    assert.deepEqual(
      parseCsvLine('صيدلية الشفاء,صيدلية,شارع المحطة,أمام المحطة,01012345678'),
      ['صيدلية الشفاء', 'صيدلية', 'شارع المحطة', 'أمام المحطة', '01012345678']
    );
  });

  it('preserves commas inside quoted fields and unescapes doubled quotes', () => {
    const row = parseCsvLine(
      '"مطعم ""البرنس""",مشويات,"شارع بورسعيد, بجوار البنك",أبوحمص,01099887766'
    );
    assert.deepEqual(row, [
      'مطعم "البرنس"',
      'مشويات',
      'شارع بورسعيد, بجوار البنك',
      'أبوحمص',
      '01099887766',
    ]);
  });
});

describe('getPlaceDetailRoute', () => {
  it('routes specialized categories to their canonical detail paths', () => {
    assert.equal(getPlaceDetailRoute({ id: 'd1', categorySlug: 'medical' }), '/medical/doctors/d1');
    assert.equal(getPlaceDetailRoute({ id: 'r1', categorySlug: 'restaurants' }), '/restaurants/r1');
    assert.equal(getPlaceDetailRoute({ id: 'h1', categorySlug: 'heroes' }), '/heroes/h1');
    assert.equal(getPlaceDetailRoute({ id: 'p1', categorySlug: 'pharmacies' }), '/places/p1');
  });
});

describe('promoFilters priorityWeight 0 & expiration handling', () => {
  const zeroWeightFilter: PromoFilter = {
    id: 'pf-zero',
    name: 'شارة عادية',
    slug: 'normal-badge',
    iconKey: 'star',
    badgeBgColor: '#fef3c7',
    badgeTextColor: '#92400e',
    priorityWeight: 0,
    order: 1,
    active: true,
  };

  const highWeightFilter: PromoFilter = {
    id: 'pf-vip',
    name: 'VIP',
    slug: 'vip',
    iconKey: 'crown',
    badgeBgColor: '#003820',
    badgeTextColor: '#ffe088',
    priorityWeight: 100,
    order: 2,
    active: true,
  };

  const makePlace = (overrides: Partial<Place>): Place => ({
    id: 'p-1',
    name: 'نشاط تجريبي',
    categoryId: 'cat-1',
    categorySlug: 'general',
    area: 'أبوحمص',
    address: 'شارع بورسعيد',
    phone: '01012345678',
    rating: 4.5,
    ...overrides,
  });

  it('preserves priorityWeight 0 instead of coercing to 50', () => {
    const placeZero = makePlace({ id: 'p-zero', filterTags: ['pf-zero'] });
    const placeVip = makePlace({ id: 'p-vip', filterTags: ['pf-vip'] });
    const scoreZero = getPlacePromoScore(placeZero, [zeroWeightFilter, highWeightFilter], '2026-06-15');
    const scoreVip = getPlacePromoScore(placeVip, [zeroWeightFilter, highWeightFilter], '2026-06-15');
    assert.equal(scoreZero, 1); // 0 * 10 + 1 badge
    assert.equal(scoreVip, 1001); // 100 * 10 + 1 badge
    const sorted = sortPlacesByPromoPriority([placeZero, placeVip], [zeroWeightFilter, highWeightFilter]);
    assert.equal(sorted[0].id, 'p-vip');
  });

  it('excludes expired filter subscriptions cleanly', () => {
    const expiredPlace = makePlace({
      id: 'p-exp',
      filterTags: ['pf-vip'],
      filterExpirations: { 'pf-vip': '2026-01-01' },
    });
    assert.equal(isPlaceSubscribedToFilter(expiredPlace, 'pf-vip', '2026-06-15'), false);
    assert.equal(isPlaceSubscribedToFilter(expiredPlace, 'pf-vip', '2025-12-31'), true);
  });
});

describe('offlineCache (readOfflineCatalog / writeOfflineCatalog)', () => {
  it('merges catalog slices and hydrates them cleanly for offline browsing', () => {
    const map = new Map<string, string>();
    const memoryStore = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };

    const ok1 = writeOfflineCatalog(
      {
        places: [
          {
            id: 'p-1',
            name: 'صيدلية أبوحمص',
            categoryId: 'cat-pharm',
            categorySlug: 'pharmacies',
            area: 'شارع المحطة',
            address: 'أمام محطة القطار',
            phone: '01012345678',
          },
        ],
      },
      memoryStore
    );
    const ok2 = writeOfflineCatalog(
      {
        categories: [
          {
            id: 'cat-pharm',
            name: 'صيدليات',
            slug: 'pharmacies',
            iconKey: 'pill',
            bgColor: '#e6f4ec',
            iconColor: '#0f5132',
            templateType: 'general',
            order: 1,
            active: true,
          },
        ],
      },
      memoryStore
    );

    assert.equal(ok1, true);
    assert.equal(ok2, true);
    const snapshot = readOfflineCatalog(memoryStore);
    assert.ok(snapshot);
    assert.equal(snapshot.places?.length, 1);
    assert.equal(snapshot.places?.[0].name, 'صيدلية أبوحمص');
    assert.equal(snapshot.categories?.length, 1);
    assert.ok(snapshot.cachedAt);
  });

  it('recovers gracefully from corrupt storage or QuotaExceededError', () => {
    const corruptStore = {
      getItem: () => '{broken-json',
    };
    assert.equal(readOfflineCatalog(corruptStore), null);

    const fullStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    assert.equal(writeOfflineCatalog({ places: [] }, fullStore), false);
  });
});

describe('arabicSearch (normalizeArabic & matchesArabicQuery)', () => {
  it('normalizes hamzas, taa marbuta, alif maqsura, tashkeel, and Arabic-Indic digits', () => {
    assert.equal(normalizeArabic('أَحمَد إِبراهيم'), 'احمد ابراهيم');
    assert.equal(normalizeArabic('صيدلية الشفاء'), normalizeArabic('صيدليه الشفاء'));
    assert.equal(normalizeArabic('مستشفى أبوحمص'), normalizeArabic('مستشفي ابوحمص'));
    assert.equal(normalizeArabicDigits('٠١٠١٢٣٤٥٦٧٨'), '01012345678');
  });

  it('matches multi-word queries regardless of word order or Arabic spelling variants', () => {
    const haystack = 'د. أحمد شوقي — استشاري أطفال — شارع بورسعيد أبوحمص 01012345678';
    assert.equal(matchesArabicQuery(haystack, 'احمد اطفال'), true);
    assert.equal(matchesArabicQuery(haystack, 'بورسعيد د. احمد'), true);
    assert.equal(matchesArabicQuery(haystack, '٠١٠١٢٣٤٥٦٧٨'), true);
    assert.equal(matchesArabicQuery(haystack, 'احمد عظام'), false);
  });
});

describe('evaluateOpenStatus (Africa/Cairo working hours)', () => {
  // 2026-06-15 is a Monday; in June Egypt is UTC+3 (EEST) or UTC+2 — use UTC timestamps and verify Cairo time explicitly
  // Let's create dates with explicit Intl verification helper so tests are DST-safe
  const makeCairoDate = (isoDate: string, targetCairoHour: number, targetCairoMin = 0): Date => {
    // Try UTC offsets +2 and +3 to land exactly on targetCairoHour in Africa/Cairo
    for (const offset of [3, 2]) {
      const utcHour = targetCairoHour - offset;
      const d = new Date(`${isoDate}T00:00:00Z`);
      d.setUTCHours(utcHour, targetCairoMin, 0, 0);
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const h = Number(parts.find((p) => p.type === 'hour')?.value);
      const m = Number(parts.find((p) => p.type === 'minute')?.value);
      if ((h === 24 ? 0 : h) === targetCairoHour && m === targetCairoMin) return d;
    }
    throw new Error('Could not construct Cairo date');
  };

  it('detects 24-hour places as always open', () => {
    const night = makeCairoDate('2026-06-15', 3, 30);
    const res = evaluateOpenStatus('مفتوح 24 ساعة يومياً', false, night);
    assert.equal(res.isOpen, true);
    assert.equal(res.isAuto, true);
  });

  it('evaluates daytime Arabic ranges accurately', () => {
    const noon = makeCairoDate('2026-06-15', 13, 0);
    const lateNight = makeCairoDate('2026-06-15', 23, 30);
    assert.equal(evaluateOpenStatus('يومياً 9 صباحاً - 10 مساءً', false, noon).isOpen, true);
    assert.equal(evaluateOpenStatus('يومياً 9 صباحاً - 10 مساءً', true, lateNight).isOpen, false);
  });

  it('handles overnight ranges spanning past midnight', () => {
    const afterMidnight = makeCairoDate('2026-06-15', 1, 15);
    const morning = makeCairoDate('2026-06-15', 9, 0);
    assert.equal(evaluateOpenStatus('6 مساءً - 2 صباحاً', false, afterMidnight).isOpen, true);
    assert.equal(evaluateOpenStatus('6 مساءً - 2 صباحاً', true, morning).isOpen, false);
  });

  it('respects Friday holidays when specified', () => {
    // 2026-06-19 is a Friday
    const fridayNoon = makeCairoDate('2026-06-19', 13, 0);
    const res = evaluateOpenStatus('السبت إلى الخميس 9 صباحاً - 9 مساءً عدا الجمعة', true, fridayNoon);
    assert.equal(res.isOpen, false);
    assert.match(res.label, /الجمعة/);
  });

  it('falls back to fallbackOpenNow for unparseable text', () => {
    const res = evaluateOpenStatus('بالحجز المسبق فقط', false, makeCairoDate('2026-06-15', 12, 0));
    assert.equal(res.isOpen, false);
    assert.equal(res.isAuto, false);
  });
});

describe('abuhomsGeo (Haversine & zones)', () => {
  it('matches Abu Homs areas and villages with Arabic normalization', () => {
    const z1 = findZoneForText('قرية بركة غطاس');
    assert.equal(z1?.id, 'berket_ghatas');
    const z2 = findZoneForText('شارع المحطه ابوحمص');
    assert.equal(z2?.id, 'station');
  });

  it('computes accurate Haversine distances and Arabic formatting', () => {
    const dSame = haversineKm({ lat: 31.1004, lng: 30.3125 }, { lat: 31.1004, lng: 30.3125 });
    assert.equal(dSame, 0);
    const dVillage = haversineKm({ lat: 31.1004, lng: 30.3125 }, { lat: 31.1322, lng: 30.3510 });
    assert.ok(dVillage > 4 && dVillage < 6, `expected ~5km, got ${dVillage}`);
    assert.equal(formatDistanceKm(0.35), '350 م');
    assert.equal(formatDistanceKm(4.82), '4.8 كم');
  });
});

describe('merchantReport (zero-extra-read WhatsApp reports)', () => {
  it('aggregates call clicks, WhatsApp clicks, and matching search queries in-memory', () => {
    const place: Place = {
      id: 'pl-1',
      name: 'مطعم الشيف أبوحمص',
      specialty: 'مشويات وكريب',
      categoryId: 'cat-rest',
      categorySlug: 'restaurants',
      area: 'شارع بورسعيد',
      address: 'أبوحمص',
      phone: '01012345678',
      featured: true,
    };

    const events: AnalyticsEvent[] = [
      { id: 'e1', eventType: 'call_click', targetId: 'pl-1', targetName: 'مطعم الشيف أبوحمص', createdAt: '' },
      { id: 'e2', eventType: 'call_click', targetId: 'pl-1', createdAt: '' },
      { id: 'e3', eventType: 'whatsapp_click', targetId: 'pl-1', createdAt: '' },
      { id: 'e4', eventType: 'search', query: 'مشويات', createdAt: '' },
      { id: 'e5', eventType: 'search', query: 'صيدلية', createdAt: '' },
    ];

    const stats = computePlacePerformance(place, events);
    assert.equal(stats.callClicks, 2);
    assert.equal(stats.whatsappClicks, 1);
    assert.equal(stats.searchMentions, 1);
    assert.equal(stats.totalInteractions, 4);

    const report = buildMerchantWhatsAppReport(place, stats, 'شهر يونيو');
    assert.ok(report.includes('مطعم الشيف أبوحمص'));
    assert.ok(report.includes('*4*'));
    assert.ok(report.includes('VIP'));
  });
});

