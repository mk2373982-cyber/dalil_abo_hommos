import type { AnalyticsEvent, Place } from '../types';
import { normalizeArabic } from './arabicSearch';

export interface PlacePerformanceStats {
  callClicks: number;
  whatsappClicks: number;
  searchMentions: number;
  totalInteractions: number;
}

/**
 * Computes per-place engagement metrics entirely in-memory from already loaded analyticsEvents.
 * Zero extra Firestore queries.
 */
export function computePlacePerformance(place: Place, events: AnalyticsEvent[]): PlacePerformanceStats {
  let callClicks = 0;
  let whatsappClicks = 0;
  let searchMentions = 0;

  const normPlaceName = normalizeArabic(place.name);
  const normSpecialty = normalizeArabic(place.specialty);

  for (const ev of events) {
    const matchesTarget =
      ev.targetId === place.id ||
      (ev.targetName && normalizeArabic(ev.targetName) === normPlaceName);

    if (ev.eventType === 'call_click' && matchesTarget) {
      callClicks += 1;
    } else if (ev.eventType === 'whatsapp_click' && matchesTarget) {
      whatsappClicks += 1;
    } else if (ev.eventType === 'search' && ev.query) {
      const normQ = normalizeArabic(ev.query);
      if (
        normQ.length >= 2 &&
        (normPlaceName.includes(normQ) || (normSpecialty && normSpecialty.includes(normQ)))
      ) {
        searchMentions += 1;
      }
    }
  }

  return {
    callClicks,
    whatsappClicks,
    searchMentions,
    totalInteractions: callClicks + whatsappClicks + searchMentions,
  };
}

export function buildMerchantWhatsAppReport(
  place: Place,
  stats: PlacePerformanceStats,
  periodLabel = 'الفترة الحالية'
): string {
  const lines = [
    `السلام عليكم إدارة *${place.name}* 🌿`,
    `إليكم ملخص أداء نشاطكم على *دليل أبوحمص* خلال (${periodLabel}):`,
    '',
    `📞 نقرات الاتصال المباشر: *${stats.callClicks}*`,
    `💬 نقرات التواصل عبر واتساب: *${stats.whatsappClicks}*`,
    `🔍 عمليات البحث المطابقة لنشاطكم: *${stats.searchMentions}*`,
    `✨ إجمالي التفاعل المسجل: *${stats.totalInteractions}*`,
    '',
    place.featured || (place.filterTags && place.filterTags.length > 0)
      ? '⭐ نشاطكم مميز حالياً ضمن باقة الشركاء (VIP) بأولوية ظهور في الدليل.'
      : '💡 يمكنكم ترقية ظهوركم ضمن باقة الأنشطة المميزة (VIP) لمضاعفة التفاعل والزيارات.',
    '',
    'شكراً لثقتكم في *دليل أبوحمص* — معكم لخدمة أهالي المركز.',
  ];
  return lines.join('\n');
}
