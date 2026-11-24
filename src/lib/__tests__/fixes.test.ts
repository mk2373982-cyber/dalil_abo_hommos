import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppUrl,
  formatEgyptWhatsApp,
  generateSecureToken,
  getPlaceDetailRoute,
  isOfferExpired,
  parseCsvLine,
  validateEgyptPhone,
} from '../formatters';
import {
  getPlacePromoScore,
  isPlaceSubscribedToFilter,
  sortPlacesByPromoPriority,
} from '../promoFilters';
import { readOfflineCatalog, writeOfflineCatalog } from '../offlineCache';
import { matchesArabicQuery, normalizeArabic, normalizeArabicDigits } from '../arabicSearch';
import {
  evaluateOpenStatus,
  formatWeeklyScheduleSummary,
  getCairoDateString,
  parseHoursTextToSchedule,
} from '../workingHours';
import {
  buildPlaceMenuPriceMap,
  calculateDeliveryFee,
  computeAuthoritativeOrder,
} from '../orderPricing';
import { findZoneForText, formatDistanceKm, haversineKm } from '../abuhomsGeo';
import { buildMerchantWhatsAppReport, computePlacePerformance } from '../merchantReport';
import type { AnalyticsEvent, Place, PromoFilter, WeeklySchedule } from '../../types';

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

  it('normalizes Arabic-Indic and Persian digits before stripping non-digits', () => {
    assert.equal(formatEgyptWhatsApp('٠١٠١٢٣٤٥٦٧٨'), '201012345678');
    assert.equal(formatEgyptWhatsApp('+٢٠ ١٠٠-٢٣٤-٥٦٧٨'), '201002345678');
    assert.equal(formatEgyptWhatsApp('٠٠٢٠١١٢٣٤٥٦٧٨٩'), '201123456789');
    assert.equal(formatEgyptWhatsApp('۰۱۲۳۴۵۶۷۸۹۰'), '201234567890');
    assert.equal(formatEgyptWhatsApp('٠٤٥-٢٥٦٠١١٠'), '20452560110');
    assert.equal(formatEgyptWhatsApp('+20 01012345678'), '201012345678');
  });

  it('rejects malformed or too-short numbers via formatEgyptWhatsApp and validateEgyptPhone', () => {
    assert.equal(formatEgyptWhatsApp('12345'), '');
    assert.equal(formatEgyptWhatsApp('abc'), '');
    assert.equal(validateEgyptPhone('٠١٠١٢٣٤٥٦٧٨').valid, true);
    assert.equal(validateEgyptPhone('٠١٠١٢٣٤٥٦٧٨').displayLocal, '01012345678');
    assert.equal(validateEgyptPhone('٠٤٥٢٥٦٠١١٠', { allowLandline: false }).valid, false);
    assert.equal(validateEgyptPhone('٠٤٥٢٥٦٠١١٠', { allowLandline: true }).valid, true);
    assert.equal(validateEgyptPhone('١٢٣', { allowHotline: true }).valid, true);
    assert.equal(validateEgyptPhone('01912345678').valid, false);
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

  it('returns explicit unknown state for unparseable text and never guesses open', () => {
    const resFalse = evaluateOpenStatus('بالحجز المسبق فقط', false, makeCairoDate('2026-06-15', 12, 0));
    assert.equal(resFalse.isOpen, false);
    assert.equal(resFalse.state, 'unknown');
    assert.equal(resFalse.isAuto, false);

    const resTrueFallback = evaluateOpenStatus('بالحجز المسبق فقط', true, makeCairoDate('2026-06-15', 12, 0));
    assert.equal(resTrueFallback.isOpen, false);
    assert.equal(resTrueFallback.state, 'unknown');
    assert.equal(resTrueFallback.isAuto, false);
  });

  it('fixes Friday false-open bug on multi-segment schedules (Sat-Wed & Thu)', () => {
    const scheduleText = 'السبت إلى الأربعاء: 4 م - 9 م | الخميس: 3 م - 8 م';
    // 2026-06-19 is Friday
    const fridayEvening = makeCairoDate('2026-06-19', 17, 0);
    const friRes = evaluateOpenStatus(scheduleText, true, fridayEvening);
    assert.equal(friRes.isOpen, false);
    assert.equal(friRes.state, 'closed');
    assert.match(friRes.label, /الجمعة/);

    // 2026-06-18 is Thursday
    assert.equal(evaluateOpenStatus(scheduleText, false, makeCairoDate('2026-06-18', 16, 0)).isOpen, true);
    assert.equal(evaluateOpenStatus(scheduleText, false, makeCairoDate('2026-06-18', 20, 1)).isOpen, false);

    // 2026-06-20 is Saturday
    assert.equal(evaluateOpenStatus(scheduleText, false, makeCairoDate('2026-06-20', 17, 0)).isOpen, true);
    assert.equal(evaluateOpenStatus(scheduleText, false, makeCairoDate('2026-06-20', 15, 30)).isOpen, false);

    const parsed = parseHoursTextToSchedule(scheduleText);
    assert.ok(parsed);
    assert.deepEqual(parsed.schedule.fri, []);
    assert.deepEqual(parsed.schedule.thu, [{ open: '15:00', close: '20:00' }]);
  });

  it('evaluates structured WeeklySchedule with multi-shifts and overnight carryover', () => {
    const weekly: WeeklySchedule = {
      sat: [{ open: '09:00', close: '13:00' }, { open: '18:00', close: '02:00' }],
      sun: [], // closed Sunday, except Saturday overnight carryover until 02:00
      mon: [{ open: '10:00', close: '22:00' }],
      tue: [{ open: '10:00', close: '22:00' }],
      wed: [{ open: '10:00', close: '22:00' }],
      thu: [{ open: '10:00', close: '22:00' }],
      fri: [],
    };
    // 2026-06-20 is Saturday, 2026-06-21 is Sunday
    assert.equal(evaluateOpenStatus('', false, makeCairoDate('2026-06-20', 11, 0), weekly).isOpen, true);
    assert.equal(evaluateOpenStatus('', false, makeCairoDate('2026-06-20', 15, 0), weekly).isOpen, false);
    assert.equal(evaluateOpenStatus('', false, makeCairoDate('2026-06-20', 23, 0), weekly).isOpen, true);
    // Sunday 01:30 AM -> still open due to Saturday 18:00 -> 02:00 overnight shift
    assert.equal(evaluateOpenStatus('', false, makeCairoDate('2026-06-21', 1, 30), weekly).isOpen, true);
    // Sunday 02:30 AM -> closed
    assert.equal(evaluateOpenStatus('', false, makeCairoDate('2026-06-21', 2, 30), weekly).isOpen, false);

    const summary = formatWeeklyScheduleSummary(weekly, false);
    assert.ok(summary.includes('السبت'));
    assert.ok(summary.includes('الاثنين إلى الخميس'));
  });

  it('partitions Cairo date string accurately across UTC midnight boundary', () => {
    // 2026-06-15 21:30 UTC is 2026-06-16 00:30 in Africa/Cairo (UTC+3 summer)
    const cairoNextDay = new Date('2026-06-15T21:30:00Z');
    assert.equal(getCairoDateString(cairoNextDay), '2026-06-16');
    const cairoSameDay = new Date('2026-06-15T18:00:00Z');
    assert.equal(getCairoDateString(cairoSameDay), '2026-06-15');
  });
});

describe('orderPricing (trusted server/catalog restaurant order pricing)', () => {
  const restaurant: Place = {
    id: 'rest-abuhoms-1',
    name: 'مطعم الشيف',
    categoryId: 'cat-rest',
    categorySlug: 'restaurants',
    area: 'أبوحمص',
    address: 'شارع بورسعيد',
    phone: '01012345678',
    deliveryFeeInTown: 15,
    deliveryFeeVillage: 30,
    menuItems: [
      { id: 'm-1', name: 'كريب شاورما', price: 85, category: 'كريب', description: 'شاورما فراخ مع موتزاريلا' },
      { id: 'm-2', name: 'بطاطس مقرمشة', price: 25, category: 'مقبلات', description: 'بطاطس محمرة مقرمشة' },
    ],
  };
  restaurant.menuPriceMap = buildPlaceMenuPriceMap(restaurant.menuItems);

  it('builds authoritative menuPriceMap and computes exact totals + pricingSnapshot', () => {
    assert.deepEqual(restaurant.menuPriceMap, { 'm-1': 85, 'm-2': 25 });
    assert.equal(calculateDeliveryFee('شارع المحطة', restaurant), 15);
    assert.equal(calculateDeliveryFee('قرية بركة غطاس', restaurant), 30);

    const res = computeAuthoritativeOrder({
      restaurant,
      draftItems: [
        { menuItemId: 'm-1', quantity: 2, clientPrice: 85 },
        { menuItemId: 'm-2', quantity: 1, clientPrice: 25 },
      ],
      deliveryArea: 'قرية بسنتواي',
      nowIso: '2026-06-15T12:00:00.000Z',
    });

    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.subtotal, 195);
      assert.equal(res.deliveryFee, 30);
      assert.equal(res.total, 225);
      assert.equal(res.pricingSnapshot.total, 225);
      assert.equal(res.pricingSnapshot.currency, 'EGP');
    }
  });

  it('rejects tampered client prices explicitly', () => {
    const res = computeAuthoritativeOrder({
      restaurant,
      draftItems: [{ menuItemId: 'm-1', quantity: 2, clientPrice: 1 }],
      deliveryArea: 'أبوحمص',
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, 'PRICE_MISMATCH');
    }
  });

  it('rejects unknown/foreign items, invalid quantities, oversized carts, and non-restaurants', () => {
    const foreignItem = computeAuthoritativeOrder({
      restaurant,
      draftItems: [{ menuItemId: 'foreign-item-999', quantity: 1 }],
    });
    assert.equal(foreignItem.ok, false);
    if (!foreignItem.ok) assert.equal(foreignItem.code, 'ITEM_NOT_FOUND');

    for (const badQty of [0, -1, 1.5, 21]) {
      const qRes = computeAuthoritativeOrder({
        restaurant,
        draftItems: [{ menuItemId: 'm-1', quantity: badQty }],
      });
      assert.equal(qRes.ok, false);
      if (!qRes.ok) assert.equal(qRes.code, 'INVALID_QUANTITY');
    }

    const emptyRes = computeAuthoritativeOrder({ restaurant, draftItems: [] });
    assert.equal(emptyRes.ok, false);
    if (!emptyRes.ok) assert.equal(emptyRes.code, 'EMPTY_ITEMS');

    const tooMany = Array.from({ length: 16 }, () => ({ menuItemId: 'm-1', quantity: 1 }));
    const maxRes = computeAuthoritativeOrder({ restaurant, draftItems: tooMany });
    assert.equal(maxRes.ok, false);
    if (!maxRes.ok) assert.equal(maxRes.code, 'TOO_MANY_ITEMS');

    const clinicPlace: Place = { ...restaurant, categorySlug: 'medical' };
    const wrongPlace = computeAuthoritativeOrder({
      restaurant: clinicPlace,
      draftItems: [{ menuItemId: 'm-1', quantity: 1 }],
    });
    assert.equal(wrongPlace.ok, false);
    if (!wrongPlace.ok) assert.equal(wrongPlace.code, 'INVALID_RESTAURANT');
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

describe('Cloudflare Pages Function: /api/orders/validate', () => {
  it('verifies authoritative menu prices, rejects tampered prices (422), and rejects invalid items/quantities (400)', async () => {
    const { onRequestPost } = await import('../../../functions/api/orders/validate');

    const mockFirestoreDoc = {
      fields: {
        name: { stringValue: 'مشويات البركة' },
        categorySlug: { stringValue: 'restaurants' },
        deliveryFeeInTown: { integerValue: '15' },
        deliveryFeeVillage: { integerValue: '25' },
        menuItems: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    id: { stringValue: 'm-1' },
                    name: { stringValue: 'كباب مشوي' },
                    price: { integerValue: '120' },
                  },
                },
              },
            ],
          },
        },
        menuPriceMap: {
          mapValue: {
            fields: {
              'm-1': { integerValue: '120' },
            },
          },
        },
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(mockFirestoreDoc), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    try {
      // 1. Valid order returns 200 + aligned OrderPricingSnapshot
      const okReq = new Request('https://example.pages.dev/api/orders/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest-baraka',
          deliveryArea: 'قرية بركة غطاس',
          items: [{ menuItemId: 'm-1', quantity: 2, clientPrice: 120 }],
          clientSubtotal: 240,
          clientDeliveryFee: 25,
          clientTotal: 265,
        }),
      });
      const okRes = await onRequestPost({ request: okReq, env: {} });
      assert.equal(okRes.status, 200);
      const okJson = (await okRes.json()) as {
        ok: boolean;
        subtotal: number;
        deliveryFee: number;
        total: number;
        pricingSnapshot: {
          currency: string;
          subtotal: number;
          deliveryFee: number;
          total: number;
          pricingSource: string;
          validatedAt: string;
        };
      };
      assert.equal(okJson.ok, true);
      assert.equal(okJson.subtotal, 240);
      assert.equal(okJson.deliveryFee, 25);
      assert.equal(okJson.total, 265);
      assert.equal(okJson.pricingSnapshot.currency, 'EGP');
      assert.equal(okJson.pricingSnapshot.pricingSource, 'api_validator');
      assert.equal(okJson.pricingSnapshot.total, 265);

      // 2. Tampered client unit price returns 422 with tampered: true
      const tamperReq = new Request('https://example.pages.dev/api/orders/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest-baraka',
          deliveryArea: 'شارع المحطة',
          items: [{ menuItemId: 'm-1', quantity: 2, clientPrice: 5 }],
          clientSubtotal: 10,
          clientDeliveryFee: 15,
          clientTotal: 25,
        }),
      });
      const tamperRes = await onRequestPost({ request: tamperReq, env: {} });
      assert.equal(tamperRes.status, 422);
      const tamperJson = (await tamperRes.json()) as {
        ok: boolean;
        tampered: boolean;
        code: string;
        expected: { total: number };
      };
      assert.equal(tamperJson.ok, false);
      assert.equal(tamperJson.tampered, true);
      assert.equal(tamperJson.code, 'PRICE_MISMATCH');
      assert.equal(tamperJson.expected.total, 255);

      // 3. Unknown menu item rejected with 400
      const unknownReq = new Request('https://example.pages.dev/api/orders/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 'rest-baraka',
          items: [{ menuItemId: 'fake-item', quantity: 1 }],
        }),
      });
      const unknownRes = await onRequestPost({ request: unknownReq, env: {} });
      assert.equal(unknownRes.status, 400);

      // 4. Invalid restaurantId path traversal rejected with 400
      const badIdReq = new Request('https://example.pages.dev/api/orders/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: '../admins/secret',
          items: [{ menuItemId: 'm-1', quantity: 1 }],
        }),
      });
      const badIdRes = await onRequestPost({ request: badIdReq, env: {} });
      assert.equal(badIdRes.status, 400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('workingHours exact boundary & holiday checks', () => {
  it('handles exact open boundary (open) and exact close boundary (closed) in Africa/Cairo', () => {
    const schedule = {
      sat: [{ open: '16:00', close: '21:00' }],
    };
    // Saturday 16:00 Cairo (14:00 UTC in winter) -> OPEN
    assert.equal(
      evaluateOpenStatus(undefined, undefined, new Date('2025-01-11T14:00:00Z'), schedule).state,
      'open'
    );
    // Saturday 21:00 Cairo (19:00 UTC in winter) -> CLOSED
    assert.equal(
      evaluateOpenStatus(undefined, undefined, new Date('2025-01-11T19:00:00Z'), schedule).state,
      'closed'
    );
    // Unparseable text with no schedule -> UNKNOWN (never guesses open)
    assert.equal(
      evaluateOpenStatus('حسب الحجز المسبق', true, new Date('2025-01-11T15:00:00Z')).state,
      'unknown'
    );
  });
});


