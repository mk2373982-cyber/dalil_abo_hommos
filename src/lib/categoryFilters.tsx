import React, { useMemo } from 'react';
import { Clock, Crown, Sparkles, Star, Truck } from 'lucide-react';
import { AnimatedFilterChip } from '../components/MotionEffects';
import { matchesArabicQuery, normalizeArabic } from './arabicSearch';
import { getTodayISO, isPlaceSubscribedToFilter } from './promoFilters';
import type {
  Category,
  CategoryFilter,
  CategoryFilterMatchField,
  Offer,
  Place,
  PromoFilter,
  Property,
} from '../types';

export const FIXED_VIP_FILTER_ID = '__fixed_vip__';
export const FIXED_FEATURED_FILTER_ID = '__fixed_featured__';
export const OFFERS_FILTER_SCOPE_ID = '__offers_tab__';

export interface MatchFieldMeta {
  value: CategoryFilterMatchField;
  label: string;
  shortLabel: string;
  placeholder: string;
  description: string;
  isBoolean?: boolean;
}

export const MATCH_FIELD_OPTIONS: MatchFieldMeta[] = [
  {
    value: 'specialty',
    label: 'التخصص أو المهنة (specialty)',
    shortLabel: 'التخصص',
    placeholder: 'مثال: أطفال، مشويات، أسنان، نجار...',
    description: 'يطابق التخصص المكتوب في بطاقة المكان أو التصنيف الفرعي',
  },
  {
    value: 'subCategory',
    label: 'التصنيف الفرعي (subCategory)',
    shortLabel: 'تصنيف فرعي',
    placeholder: 'مثال: كافيهات، حلويات، حضانات...',
    description: 'يطابق التصنيف الفرعي للبطاقة (ويقرأ التخصص تلقائياً إن لم يُحدد)',
  },
  {
    value: 'area',
    label: 'المنطقة أو القرية (area)',
    shortLabel: 'المنطقة',
    placeholder: 'مثال: شارع بورسعيد، بركة غطاس، المحطة...',
    description: 'يطابق اسم الحي أو القرية أو العنوان في البطاقة',
  },
  {
    value: 'tags',
    label: 'الوسوم والكلمات المفتاحية (tags)',
    shortLabel: 'وسوم',
    placeholder: 'مثال: عائلات، حجز مسبق، طوارئ، توصيل...',
    description: 'يطابق أي وسم مضاف للبطاقة أو ضمن التخصص والوصف المختصر',
  },
  {
    value: 'hasDelivery',
    label: 'توصيل متاح (hasDelivery)',
    shortLabel: 'توصيل متاح',
    placeholder: 'true',
    description: 'يعرض الأنشطة التي توفر خدمة توصيل للمنازل أو رسوم توصيل محددة',
    isBoolean: true,
  },
  {
    value: 'is24Hours',
    label: 'يعمل 24 ساعة (is24Hours)',
    shortLabel: '24 ساعة',
    placeholder: 'true',
    description: 'يعرض الأنشطة والصيدليات والخدمات التي تعمل طوال الـ 24 ساعة',
    isBoolean: true,
  },
];

export function isBooleanMatchField(field: CategoryFilterMatchField): boolean {
  return field === 'hasDelivery' || field === 'is24Hours';
}

export function getMatchFieldShortLabel(field: CategoryFilterMatchField): string {
  return MATCH_FIELD_OPTIONS.find((opt) => opt.value === field)?.shortLabel || field;
}

function isFalseValue(val?: string): boolean {
  const norm = normalizeArabic(val);
  return norm === 'false' || norm === '0' || norm === 'لا' || norm === 'no';
}

/**
 * Checks whether a Place matches the fixed "VIP" filter.
 */
export function matchesFixedVip(
  place: Place,
  promoFilters: PromoFilter[],
  referenceDateISO?: string
): boolean {
  const refDate = referenceDateISO || getTodayISO();
  const vipPromoIds = promoFilters
    .filter((pf) => {
      const combined = `${pf.id} ${pf.slug} ${pf.name}`.toLowerCase();
      return combined.includes('vip');
    })
    .map((pf) => pf.id);

  for (const id of vipPromoIds) {
    if (isPlaceSubscribedToFilter(place, id, refDate)) return true;
  }

  // Fallback check directly on filterTags (even if promo_filters list was customized)
  if (Array.isArray(place.filterTags)) {
    for (const tagId of place.filterTags) {
      if (tagId.toLowerCase().includes('vip') && isPlaceSubscribedToFilter(place, tagId, refDate)) {
        return true;
      }
    }
  }

  if (Array.isArray(place.tags)) {
    if (place.tags.some((t) => normalizeArabic(t).includes('vip'))) return true;
  }

  return false;
}

/**
 * Checks whether a Place matches the fixed "الأكثر تميزاً" filter.
 */
export function matchesFixedFeatured(
  place: Place,
  promoFilters: PromoFilter[],
  referenceDateISO?: string
): boolean {
  if (place.featured === true) return true;

  const refDate = referenceDateISO || getTodayISO();
  const featuredPromoIds = promoFilters
    .filter((pf) => {
      const norm = normalizeArabic(`${pf.id} ${pf.slug} ${pf.name}`);
      return norm.includes('featured') || norm.includes('الاكثر تميز') || norm.includes('مميز');
    })
    .map((pf) => pf.id);

  for (const id of featuredPromoIds) {
    if (isPlaceSubscribedToFilter(place, id, refDate)) return true;
  }

  if (Array.isArray(place.filterTags)) {
    for (const tagId of place.filterTags) {
      const norm = normalizeArabic(tagId);
      if (
        (norm.includes('featured') || norm.includes('مميز')) &&
        isPlaceSubscribedToFilter(place, tagId, refDate)
      ) {
        return true;
      }
    }
  }

  if (Array.isArray(place.tags)) {
    if (
      place.tags.some((t) => {
        const norm = normalizeArabic(t);
        return norm.includes('مميز') || norm.includes('الاكثر تميز') || norm.includes('featured');
      })
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a Place satisfies a custom CategoryFilter.
 */
export function matchesCategoryFilter(place: Place, filter: CategoryFilter): boolean {
  const rawValue = (filter.matchValue || filter.label || '').trim();
  const normValue = normalizeArabic(rawValue);

  switch (filter.matchField) {
    case 'hasDelivery': {
      const hasDelivery =
        place.hasDelivery === true ||
        (typeof place.deliveryFeeInTown === 'number' && place.deliveryFeeInTown >= 0) ||
        (typeof place.deliveryFeeVillage === 'number' && place.deliveryFeeVillage >= 0) ||
        (place.tags || []).some((t) => /توصيل|دليفري|delivery/i.test(normalizeArabic(t))) ||
        /توصيل|دليفري|delivery/i.test(normalizeArabic(`${place.specialty || ''} ${place.description || ''}`));
      return isFalseValue(rawValue) ? !hasDelivery : hasDelivery;
    }

    case 'is24Hours': {
      const is24 =
        place.is24Hours === true ||
        /24|طوال اليوم|مدار الساعه|نوبتجيه/.test(normalizeArabic(place.hours || '')) ||
        (place.tags || []).some((t) => /24|نوبتجيه|طوال اليوم/.test(normalizeArabic(t)));
      return isFalseValue(rawValue) ? !is24 : is24;
    }

    case 'area': {
      if (!normValue) return true;
      return matchesArabicQuery(`${place.area || ''} ${place.address || ''}`, rawValue);
    }

    case 'subCategory': {
      if (!normValue) return true;
      const haystack = `${place.subCategory || ''} ${place.specialty || ''} ${(place.tags || []).join(' ')}`;
      return matchesArabicQuery(haystack, rawValue);
    }

    case 'tags': {
      if (!normValue) return true;
      const tagList = place.tags || [];
      if (tagList.some((t) => matchesArabicQuery(t, rawValue))) return true;
      return matchesArabicQuery(
        `${place.subCategory || ''} ${place.specialty || ''} ${place.description || ''}`,
        rawValue
      );
    }

    case 'specialty':
    default: {
      if (!normValue) return true;
      const haystack = `${place.specialty || ''} ${place.subCategory || ''} ${(place.tags || []).join(' ')}`;
      return matchesArabicQuery(haystack, rawValue);
    }
  }
}

/**
 * Auto-extracts clean default filters from places in a category when no manual filters exist yet.
 */
export function deriveDefaultCategoryFilters(placesInCategory: Place[]): CategoryFilter[] {
  const derived: CategoryFilter[] = [];
  const seenNormalized = new Set<string>();

  const tryAddTextFilter = (rawText: string | undefined, matchField: 'subCategory' | 'specialty') => {
    if (!rawText) return;
    const primarySegment = rawText.split(/[—|]/)[0]?.trim() || rawText.trim();
    if (primarySegment.length < 2) return;
    const norm = normalizeArabic(primarySegment);
    if (!norm || seenNormalized.has(norm)) return;
    seenNormalized.add(norm);

    const shortLabel =
      primarySegment.length > 26 ? `${primarySegment.slice(0, 24).trim()}…` : primarySegment;

    derived.push({
      id: `auto-${matchField}-${derived.length + 1}`,
      label: shortLabel,
      matchField,
      matchValue: primarySegment,
      order: derived.length + 1,
      enabled: true,
    });
  };

  for (const place of placesInCategory) {
    if (place.subCategory?.trim()) {
      tryAddTextFilter(place.subCategory, 'subCategory');
    } else if (place.specialty?.trim()) {
      tryAddTextFilter(place.specialty, 'specialty');
    }
    if (derived.length >= 8) break;
  }

  // Add helpful boolean filters if at least one place in this category supports them
  const anyDelivery = placesInCategory.some((p) =>
    matchesCategoryFilter(p, {
      id: '_probe_del',
      label: 'توصيل متاح',
      matchField: 'hasDelivery',
      matchValue: 'true',
      order: 99,
      enabled: true,
    })
  );
  if (anyDelivery && derived.length < 10) {
    derived.push({
      id: 'auto-has-delivery',
      label: 'توصيل متاح',
      matchField: 'hasDelivery',
      matchValue: 'true',
      order: derived.length + 1,
      enabled: true,
    });
  }

  const any24h = placesInCategory.some((p) =>
    matchesCategoryFilter(p, {
      id: '_probe_24h',
      label: '24 ساعة',
      matchField: 'is24Hours',
      matchValue: 'true',
      order: 100,
      enabled: true,
    })
  );
  if (any24h && derived.length < 10) {
    derived.push({
      id: 'auto-is-24h',
      label: '24 ساعة',
      matchField: 'is24Hours',
      matchValue: 'true',
      order: derived.length + 1,
      enabled: true,
    });
  }

  return derived;
}

/**
 * Resolves the effective filter list for a category:
 * uses manually saved `category.categoryFilters` if present, otherwise auto-derives from places.
 */
export function getEffectiveCategoryFilters(
  category: Category | undefined,
  placesInCategory: Place[]
): { filters: CategoryFilter[]; isAutoDerived: boolean } {
  const manual = category?.categoryFilters;
  if (Array.isArray(manual) && manual.length > 0) {
    return {
      filters: [...manual].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
      isAutoDerived: false,
    };
  }
  return {
    filters: deriveDefaultCategoryFilters(placesInCategory),
    isAutoDerived: true,
  };
}

/**
 * Applies the selected filter (All / VIP / الأكثر تميزاً / Custom) to a list of places.
 */
export function applyCategoryFilterSelection(
  places: Place[],
  selectedFilterId: string | null,
  effectiveFilters: CategoryFilter[],
  promoFilters: PromoFilter[]
): Place[] {
  if (!selectedFilterId) return places;
  if (selectedFilterId === FIXED_VIP_FILTER_ID) {
    return places.filter((p) => matchesFixedVip(p, promoFilters));
  }
  if (selectedFilterId === FIXED_FEATURED_FILTER_ID) {
    return places.filter((p) => matchesFixedFeatured(p, promoFilters));
  }
  const activeCustom = effectiveFilters.find((f) => f.id === selectedFilterId);
  if (!activeCustom) return places;
  return places.filter((p) => matchesCategoryFilter(p, activeCustom));
}

// ============================================================
// PROPERTY SUPPORT (for Real Estate Category)
// ============================================================

const PROPERTY_TYPE_LABELS: Record<Property['propertyType'], string> = {
  apartment: 'شقق شقة سكنية',
  shop: 'محلات محل تجاري',
  land: 'أراضي ارض للبناء',
  warehouse: 'مخازن مخزن ورشة',
};

const LISTING_TYPE_LABELS: Record<Property['listingType'], string> = {
  sale: 'للبيع تمليك بيع',
  rent: 'للإيجار ايجار شهري',
};

export function matchesPropertyFixedVip(prop: Property): boolean {
  return Boolean(
    (prop.verified && prop.featured) ||
      normalizeArabic(`${prop.title} ${prop.description || ''}`).includes('vip')
  );
}

export function matchesPropertyFixedFeatured(prop: Property): boolean {
  return Boolean(prop.featured);
}

export function matchesPropertyCategoryFilter(prop: Property, filter: CategoryFilter): boolean {
  const rawValue = (filter.matchValue || filter.label || '').trim();
  const haystack = `${prop.title} ${prop.area} ${prop.address || ''} ${prop.description || ''} ${prop.finishing || ''} ${PROPERTY_TYPE_LABELS[prop.propertyType] || ''} ${LISTING_TYPE_LABELS[prop.listingType] || ''}`;

  switch (filter.matchField) {
    case 'area':
      return matchesArabicQuery(`${prop.area} ${prop.address || ''}`, rawValue);
    case 'hasDelivery':
    case 'is24Hours':
      return false;
    default:
      return matchesArabicQuery(haystack, rawValue);
  }
}

export function applyPropertyCategoryFilterSelection(
  properties: Property[],
  selectedFilterId: string | null,
  customFilters: CategoryFilter[]
): Property[] {
  if (!selectedFilterId) return properties;
  if (selectedFilterId === FIXED_VIP_FILTER_ID) {
    return properties.filter((p) => matchesPropertyFixedVip(p));
  }
  if (selectedFilterId === FIXED_FEATURED_FILTER_ID) {
    return properties.filter((p) => matchesPropertyFixedFeatured(p));
  }
  const activeCustom = customFilters.find((f) => f.id === selectedFilterId);
  if (!activeCustom) return properties;
  return properties.filter((p) => matchesPropertyCategoryFilter(p, activeCustom));
}

// ============================================================
// REUSABLE CATEGORY FILTER CHIPS BAR (Places)
// Always renders: [الكل] → [VIP] → [الأكثر تميزاً] → [Custom/Auto Filters]
// ============================================================

export const CategoryFilterChipsBar: React.FC<{
  category?: Category;
  placesPool: Place[];
  promoFilters: PromoFilter[];
  selectedFilterId: string | null;
  onSelect: (filterId: string | null) => void;
  allLabel?: string;
  className?: string;
}> = ({
  category,
  placesPool,
  promoFilters,
  selectedFilterId,
  onSelect,
  allLabel = 'الكل',
  className = '',
}) => {
  const { filters: effectiveFilters } = useMemo(
    () => getEffectiveCategoryFilters(category, placesPool),
    [category, placesPool]
  );

  const visibleCustomFilters = useMemo(
    () => effectiveFilters.filter((f) => f.enabled),
    [effectiveFilters]
  );

  const vipCount = useMemo(
    () => placesPool.filter((p) => matchesFixedVip(p, promoFilters)).length,
    [placesPool, promoFilters]
  );

  const featuredCount = useMemo(
    () => placesPool.filter((p) => matchesFixedFeatured(p, promoFilters)).length,
    [placesPool, promoFilters]
  );

  return (
    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 ${className}`}>
      {/* All */}
      <AnimatedFilterChip
        active={selectedFilterId === null}
        onClick={() => onSelect(null)}
        className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === null
            ? 'bg-[#003820] text-white shadow-civic-1'
            : 'bg-white border border-[#e4ece7] text-[#404942] hover:border-[#0f5132]/40'
        }`}
      >
        <span>{allLabel}</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
            selectedFilterId === null ? 'bg-white/15 text-white' : 'bg-[#f1f4f2] text-[#707971]'
          }`}
        >
          {placesPool.length}
        </span>
      </AnimatedFilterChip>

      {/* Fixed Filter 1: VIP */}
      <AnimatedFilterChip
        active={selectedFilterId === FIXED_VIP_FILTER_ID}
        onClick={() =>
          onSelect(selectedFilterId === FIXED_VIP_FILTER_ID ? null : FIXED_VIP_FILTER_ID)
        }
        className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === FIXED_VIP_FILTER_ID
            ? 'bg-[#003820] text-[#ffe088] shadow-civic-1 ring-2 ring-[#ffe088]/70'
            : 'bg-[#003820]/95 text-[#ffe088] hover:bg-[#003820]'
        }`}
      >
        <Crown size={13} strokeWidth={2.4} />
        <span>VIP</span>
        {vipCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] tabular-nums bg-white/15 text-[#ffe088]">
            {vipCount}
          </span>
        )}
      </AnimatedFilterChip>

      {/* Fixed Filter 2: الأكثر تميزاً */}
      <AnimatedFilterChip
        active={selectedFilterId === FIXED_FEATURED_FILTER_ID}
        onClick={() =>
          onSelect(selectedFilterId === FIXED_FEATURED_FILTER_ID ? null : FIXED_FEATURED_FILTER_ID)
        }
        className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === FIXED_FEATURED_FILTER_ID
            ? 'bg-[#92400e] text-[#fef3c7] shadow-civic-1 ring-2 ring-[#f5d061]'
            : 'bg-[#fef3c7] border border-[#f5d061] text-[#92400e] hover:bg-[#fde68a]'
        }`}
      >
        <Star size={13} strokeWidth={2.4} className="fill-current" />
        <span>الأكثر تميزاً</span>
        {featuredCount > 0 && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
              selectedFilterId === FIXED_FEATURED_FILTER_ID
                ? 'bg-white/20 text-white'
                : 'bg-white/80 text-[#92400e]'
            }`}
          >
            {featuredCount}
          </span>
        )}
      </AnimatedFilterChip>

      {/* Separator when custom filters exist */}
      {visibleCustomFilters.length > 0 && (
        <span className="h-5 w-px bg-[#d7e2db] shrink-0 mx-0.5" aria-hidden="true" />
      )}

      {/* Custom / Auto-derived Category Filters */}
      {visibleCustomFilters.map((filter) => {
        const isSelected = selectedFilterId === filter.id;
        const matchCount = placesPool.filter((p) => matchesCategoryFilter(p, filter)).length;
        return (
          <AnimatedFilterChip
            key={filter.id}
            active={isSelected}
            onClick={() => onSelect(isSelected ? null : filter.id)}
            className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#0f5132] text-white shadow-civic-1'
                : 'bg-white border border-[#e4ece7] text-[#181c1c] hover:border-[#0f5132]/40'
            }`}
          >
            {filter.matchField === 'hasDelivery' && <Truck size={13} className="shrink-0" />}
            {filter.matchField === 'is24Hours' && <Clock size={13} className="shrink-0" />}
            {filter.matchField === 'tags' && <Sparkles size={12} className="shrink-0" />}
            <span>{filter.label}</span>
            {matchCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#f1f4f2] text-[#707971]'
                }`}
              >
                {matchCount}
              </span>
            )}
          </AnimatedFilterChip>
        );
      })}
    </div>
  );
};

// ============================================================
// PROPERTY CATEGORY FILTER CHIPS BAR (Real Estate Page)
// ============================================================

export const PropertyCategoryFilterChipsBar: React.FC<{
  category?: Category;
  propertiesPool: Property[];
  selectedFilterId: string | null;
  onSelect: (filterId: string | null) => void;
}> = ({ category, propertiesPool, selectedFilterId, onSelect }) => {
  const customFilters = useMemo(() => {
    const manual = category?.categoryFilters;
    if (!Array.isArray(manual) || manual.length === 0) return [];
    return [...manual].filter((f) => f.enabled).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [category]);

  const vipCount = useMemo(
    () => propertiesPool.filter((p) => matchesPropertyFixedVip(p)).length,
    [propertiesPool]
  );
  const featuredCount = useMemo(
    () => propertiesPool.filter((p) => matchesPropertyFixedFeatured(p)).length,
    [propertiesPool]
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <AnimatedFilterChip
        active={selectedFilterId === null}
        onClick={() => onSelect(null)}
        className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === null
            ? 'bg-[#003820] text-white shadow-civic-1'
            : 'bg-white border border-[#e4ece7] text-[#404942]'
        }`}
      >
        <span>الكل</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
            selectedFilterId === null ? 'bg-white/15 text-white' : 'bg-[#f1f4f2] text-[#707971]'
          }`}
        >
          {propertiesPool.length}
        </span>
      </AnimatedFilterChip>

      <AnimatedFilterChip
        active={selectedFilterId === FIXED_VIP_FILTER_ID}
        onClick={() =>
          onSelect(selectedFilterId === FIXED_VIP_FILTER_ID ? null : FIXED_VIP_FILTER_ID)
        }
        className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === FIXED_VIP_FILTER_ID
            ? 'bg-[#003820] text-[#ffe088] shadow-civic-1 ring-2 ring-[#ffe088]/70'
            : 'bg-[#003820]/95 text-[#ffe088]'
        }`}
      >
        <Crown size={13} strokeWidth={2.4} />
        <span>VIP</span>
        {vipCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] tabular-nums bg-white/15 text-[#ffe088]">
            {vipCount}
          </span>
        )}
      </AnimatedFilterChip>

      <AnimatedFilterChip
        active={selectedFilterId === FIXED_FEATURED_FILTER_ID}
        onClick={() =>
          onSelect(selectedFilterId === FIXED_FEATURED_FILTER_ID ? null : FIXED_FEATURED_FILTER_ID)
        }
        className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === FIXED_FEATURED_FILTER_ID
            ? 'bg-[#92400e] text-[#fef3c7] shadow-civic-1 ring-2 ring-[#f5d061]'
            : 'bg-[#fef3c7] border border-[#f5d061] text-[#92400e]'
        }`}
      >
        <Star size={13} strokeWidth={2.4} className="fill-current" />
        <span>الأكثر تميزاً</span>
        {featuredCount > 0 && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
              selectedFilterId === FIXED_FEATURED_FILTER_ID
                ? 'bg-white/20 text-white'
                : 'bg-white/80 text-[#92400e]'
            }`}
          >
            {featuredCount}
          </span>
        )}
      </AnimatedFilterChip>

      {customFilters.length > 0 && (
        <span className="h-5 w-px bg-[#d7e2db] shrink-0 mx-0.5" aria-hidden="true" />
      )}

      {customFilters.map((filter) => {
        const isSelected = selectedFilterId === filter.id;
        const matchCount = propertiesPool.filter((p) =>
          matchesPropertyCategoryFilter(p, filter)
        ).length;
        return (
          <AnimatedFilterChip
            key={filter.id}
            active={isSelected}
            onClick={() => onSelect(isSelected ? null : filter.id)}
            className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#0f5132] text-white shadow-civic-1'
                : 'bg-white border border-[#e4ece7] text-[#181c1c]'
            }`}
          >
            <span>{filter.label}</span>
            {matchCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#f1f4f2] text-[#707971]'
                }`}
              >
                {matchCount}
              </span>
            )}
          </AnimatedFilterChip>
        );
      })}
    </div>
  );
};

// ============================================================
// OFFERS TAB SUPPORT («التخفيضات» — same unified filter system)
// ============================================================

export function matchesOfferFixedVip(
  offer: Offer,
  places: Place[],
  promoFilters: PromoFilter[],
  referenceDateISO?: string
): boolean {
  if (offer.vip === true) return true;

  if (Array.isArray(offer.tags) && offer.tags.some((t) => normalizeArabic(t).includes('vip'))) {
    return true;
  }

  if (normalizeArabic(`${offer.title} ${offer.subtitle || ''}`).includes('vip')) {
    return true;
  }

  if (offer.placeId) {
    const linked = places.find((p) => p.id === offer.placeId);
    if (linked && matchesFixedVip(linked, promoFilters, referenceDateISO)) return true;
  }

  return false;
}

export function matchesOfferFixedFeatured(
  offer: Offer,
  places: Place[],
  promoFilters: PromoFilter[],
  referenceDateISO?: string
): boolean {
  if (offer.featured === true) return true;

  if (
    Array.isArray(offer.tags) &&
    offer.tags.some((t) => {
      const norm = normalizeArabic(t);
      return norm.includes('مميز') || norm.includes('الاكثر تميز') || norm.includes('featured');
    })
  ) {
    return true;
  }

  if (offer.placeId) {
    const linked = places.find((p) => p.id === offer.placeId);
    if (linked && matchesFixedFeatured(linked, promoFilters, referenceDateISO)) return true;
  }

  return false;
}

export function matchesOfferFilter(
  offer: Offer,
  filter: CategoryFilter,
  places: Place[],
  categories: Category[]
): boolean {
  const rawValue = (filter.matchValue || filter.label || '').trim();
  const normValue = normalizeArabic(rawValue);
  const linkedPlace = offer.placeId ? places.find((p) => p.id === offer.placeId) : undefined;
  const linkedCategory = offer.categorySlug
    ? categories.find((c) => c.slug === offer.categorySlug)
    : undefined;

  switch (filter.matchField) {
    case 'hasDelivery': {
      const offerHasDelivery =
        Boolean(
          linkedPlace &&
            matchesCategoryFilter(linkedPlace, {
              ...filter,
              matchValue: 'true',
            })
        ) ||
        (offer.tags || []).some((t) => /توصيل|دليفري|delivery/i.test(normalizeArabic(t))) ||
        /توصيل|دليفري|delivery/i.test(normalizeArabic(`${offer.title} ${offer.subtitle || ''}`));
      return isFalseValue(rawValue) ? !offerHasDelivery : offerHasDelivery;
    }

    case 'is24Hours': {
      const offerIs24h =
        Boolean(
          linkedPlace &&
            matchesCategoryFilter(linkedPlace, {
              ...filter,
              matchValue: 'true',
            })
        ) ||
        (offer.tags || []).some((t) => /24|نوبتجيه|طوال اليوم/.test(normalizeArabic(t))) ||
        /24|طوال اليوم|مدار الساعه/.test(normalizeArabic(`${offer.title} ${offer.subtitle || ''}`));
      return isFalseValue(rawValue) ? !offerIs24h : offerIs24h;
    }

    case 'area': {
      if (!normValue) return true;
      const haystack = `${linkedPlace?.area || ''} ${linkedPlace?.address || ''} ${offer.placeName} ${offer.subtitle || ''}`;
      return matchesArabicQuery(haystack, rawValue);
    }

    case 'tags': {
      if (!normValue) return true;
      const allTags = [...(offer.tags || []), ...(linkedPlace?.tags || [])];
      if (allTags.some((t) => matchesArabicQuery(t, rawValue))) return true;
      return matchesArabicQuery(
        `${offer.title} ${offer.subtitle || ''} ${offer.couponCode} ${linkedCategory?.name || ''} ${offer.categorySlug || ''}`,
        rawValue
      );
    }

    case 'subCategory':
    case 'specialty':
    default: {
      if (!normValue) return true;
      const haystack = `${linkedCategory?.name || ''} ${offer.categorySlug || ''} ${offer.title} ${offer.subtitle || ''} ${offer.placeName} ${linkedPlace?.specialty || ''} ${linkedPlace?.subCategory || ''} ${(offer.tags || []).join(' ')}`;
      return matchesArabicQuery(haystack, rawValue);
    }
  }
}

export function deriveDefaultOfferFilters(
  activeOffers: Offer[],
  categories: Category[]
): CategoryFilter[] {
  const derived: CategoryFilter[] = [];
  const seen = new Set<string>();

  for (const cat of categories) {
    const hasMatch = activeOffers.some((o) => o.categorySlug === cat.slug);
    if (!hasMatch) continue;
    const norm = normalizeArabic(cat.name);
    if (seen.has(norm)) continue;
    seen.add(norm);
    derived.push({
      id: `auto-offer-cat-${cat.slug}`,
      label: cat.name,
      matchField: 'subCategory',
      matchValue: cat.name,
      order: derived.length + 1,
      enabled: true,
    });
    if (derived.length >= 10) break;
  }

  return derived;
}

export function getEffectiveOfferFilters(
  savedOffersFilters: CategoryFilter[] | undefined,
  activeOffers: Offer[],
  categories: Category[]
): { filters: CategoryFilter[]; isAutoDerived: boolean } {
  if (Array.isArray(savedOffersFilters) && savedOffersFilters.length > 0) {
    return {
      filters: [...savedOffersFilters].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
      isAutoDerived: false,
    };
  }
  return {
    filters: deriveDefaultOfferFilters(activeOffers, categories),
    isAutoDerived: true,
  };
}

export function applyOfferFilterSelection(
  offersPool: Offer[],
  selectedFilterId: string | null,
  effectiveFilters: CategoryFilter[],
  places: Place[],
  categories: Category[],
  promoFilters: PromoFilter[]
): Offer[] {
  if (!selectedFilterId) return offersPool;
  if (selectedFilterId === FIXED_VIP_FILTER_ID) {
    return offersPool.filter((o) => matchesOfferFixedVip(o, places, promoFilters));
  }
  if (selectedFilterId === FIXED_FEATURED_FILTER_ID) {
    return offersPool.filter((o) => matchesOfferFixedFeatured(o, places, promoFilters));
  }
  const activeCustom = effectiveFilters.find((f) => f.id === selectedFilterId);
  if (!activeCustom) return offersPool;
  return offersPool.filter((o) => matchesOfferFilter(o, activeCustom, places, categories));
}

export const OffersFilterChipsBar: React.FC<{
  savedOffersFilters?: CategoryFilter[];
  offersPool: Offer[];
  places: Place[];
  categories: Category[];
  promoFilters: PromoFilter[];
  selectedFilterId: string | null;
  onSelect: (filterId: string | null) => void;
  allLabel?: string;
}> = ({
  savedOffersFilters,
  offersPool,
  places,
  categories,
  promoFilters,
  selectedFilterId,
  onSelect,
  allLabel = 'الكل',
}) => {
  const { filters: effectiveFilters } = useMemo(
    () => getEffectiveOfferFilters(savedOffersFilters, offersPool, categories),
    [savedOffersFilters, offersPool, categories]
  );

  const visibleCustomFilters = useMemo(
    () => effectiveFilters.filter((f) => f.enabled),
    [effectiveFilters]
  );

  const vipCount = useMemo(
    () => offersPool.filter((o) => matchesOfferFixedVip(o, places, promoFilters)).length,
    [offersPool, places, promoFilters]
  );

  const featuredCount = useMemo(
    () => offersPool.filter((o) => matchesOfferFixedFeatured(o, places, promoFilters)).length,
    [offersPool, places, promoFilters]
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      {/* All */}
      <AnimatedFilterChip
        active={selectedFilterId === null}
        onClick={() => onSelect(null)}
        className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === null
            ? 'bg-[#003820] text-white shadow-civic-1'
            : 'bg-white border border-[#e4ece7] text-[#404942] hover:border-[#0f5132]/40'
        }`}
      >
        <span>{allLabel}</span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
            selectedFilterId === null ? 'bg-white/15 text-white' : 'bg-[#f1f4f2] text-[#707971]'
          }`}
        >
          {offersPool.length}
        </span>
      </AnimatedFilterChip>

      {/* Fixed Filter 1: VIP */}
      <AnimatedFilterChip
        active={selectedFilterId === FIXED_VIP_FILTER_ID}
        onClick={() =>
          onSelect(selectedFilterId === FIXED_VIP_FILTER_ID ? null : FIXED_VIP_FILTER_ID)
        }
        className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === FIXED_VIP_FILTER_ID
            ? 'bg-[#003820] text-[#ffe088] shadow-civic-1 ring-2 ring-[#ffe088]/70'
            : 'bg-[#003820]/95 text-[#ffe088] hover:bg-[#003820]'
        }`}
      >
        <Crown size={13} strokeWidth={2.4} />
        <span>VIP</span>
        {vipCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] tabular-nums bg-white/15 text-[#ffe088]">
            {vipCount}
          </span>
        )}
      </AnimatedFilterChip>

      {/* Fixed Filter 2: الأكثر تميزاً */}
      <AnimatedFilterChip
        active={selectedFilterId === FIXED_FEATURED_FILTER_ID}
        onClick={() =>
          onSelect(selectedFilterId === FIXED_FEATURED_FILTER_ID ? null : FIXED_FEATURED_FILTER_ID)
        }
        className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
          selectedFilterId === FIXED_FEATURED_FILTER_ID
            ? 'bg-[#92400e] text-[#fef3c7] shadow-civic-1 ring-2 ring-[#f5d061]'
            : 'bg-[#fef3c7] border border-[#f5d061] text-[#92400e] hover:bg-[#fde68a]'
        }`}
      >
        <Star size={13} strokeWidth={2.4} className="fill-current" />
        <span>الأكثر تميزاً</span>
        {featuredCount > 0 && (
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
              selectedFilterId === FIXED_FEATURED_FILTER_ID
                ? 'bg-white/20 text-white'
                : 'bg-white/80 text-[#92400e]'
            }`}
          >
            {featuredCount}
          </span>
        )}
      </AnimatedFilterChip>

      {visibleCustomFilters.length > 0 && (
        <span className="h-5 w-px bg-[#d7e2db] shrink-0 mx-0.5" aria-hidden="true" />
      )}

      {visibleCustomFilters.map((filter) => {
        const isSelected = selectedFilterId === filter.id;
        const matchCount = offersPool.filter((o) =>
          matchesOfferFilter(o, filter, places, categories)
        ).length;
        return (
          <AnimatedFilterChip
            key={filter.id}
            active={isSelected}
            onClick={() => onSelect(isSelected ? null : filter.id)}
            className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#0f5132] text-white shadow-civic-1'
                : 'bg-white border border-[#e4ece7] text-[#181c1c] hover:border-[#0f5132]/40'
            }`}
          >
            {filter.matchField === 'hasDelivery' && <Truck size={13} className="shrink-0" />}
            {filter.matchField === 'is24Hours' && <Clock size={13} className="shrink-0" />}
            {filter.matchField === 'tags' && <Sparkles size={12} className="shrink-0" />}
            <span>{filter.label}</span>
            {matchCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#f1f4f2] text-[#707971]'
                }`}
              >
                {matchCount}
              </span>
            )}
          </AnimatedFilterChip>
        );
      })}
    </div>
  );
};

