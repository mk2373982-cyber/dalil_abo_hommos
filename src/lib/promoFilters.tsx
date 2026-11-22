import React from 'react';
import { motion } from 'motion/react';
import { getIconComponent } from './icons';
import type { Place, PromoFilter } from '../types';

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Check if a place currently holds an active (non-expired) subscription for a promo filter */
export function isPlaceSubscribedToFilter(
  place: Place,
  filterId: string,
  todayISO: string = getTodayISO()
): boolean {
  const tags = place.filterTags;
  if (!tags || !tags.includes(filterId)) return false;
  const expiry = place.filterExpirations?.[filterId];
  if (expiry && expiry.trim() !== '' && expiry < todayISO) {
    return false;
  }
  return true;
}

/** Return all active, non-expired promo filters attached to a place, ordered by priority/order */
export function getActiveBadgesForPlace(
  place: Place,
  activePromoFilters: PromoFilter[],
  todayISO: string = getTodayISO()
): PromoFilter[] {
  return activePromoFilters
    .filter((f) => f.active && isPlaceSubscribedToFilter(place, f.id, todayISO))
    .sort((a, b) => (b.priorityWeight - a.priorityWeight) || (a.order - b.order));
}

/** Compute highest promotional priority score for sorting places */
export function getPlacePromoScore(
  place: Place,
  activePromoFilters: PromoFilter[],
  todayISO: string = getTodayISO()
): number {
  const badges = getActiveBadgesForPlace(place, activePromoFilters, todayISO);
  if (badges.length === 0) return place.featured ? 10 : 0;
  const maxWeight = Math.max(...badges.map((b) => b.priorityWeight ?? 50));
  return maxWeight * 10 + badges.length;
}

/** Sort places so subscribed/promoted places always rise to the top */
export function sortPlacesByPromoPriority(
  places: Place[],
  activePromoFilters: PromoFilter[]
): Place[] {
  const today = getTodayISO();
  return [...places].sort((a, b) => {
    const scoreDiff =
      getPlacePromoScore(b, activePromoFilters, today) -
      getPlacePromoScore(a, activePromoFilters, today);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

/** Preset color palettes tailored for Promotional Badges */
export const BADGE_COLOR_PRESETS = [
  { name: 'ذهبي مميز', bg: '#fef3c7', text: '#92400e' },
  { name: 'ملكي VIP', bg: '#003820', text: '#ffe088' },
  { name: 'زمردي موثق', bg: '#e6f4ec', text: '#0f5132' },
  { name: 'أحمر عروض', bg: '#fee2e2', text: '#b91c1c' },
  { name: 'أزرق احترافي', bg: '#e0f2fe', text: '#0369a1' },
  { name: 'بنفسجي نخبة', bg: '#f3e8ff', text: '#6b21a8' },
  { name: 'برتقالي ساخن', bg: '#ffedd5', text: '#c2410c' },
  { name: 'كحلي رسمي', bg: '#1e293b', text: '#f8fafc' },
];

/** Renders a place's active colored promotional badges */
export const PlacePromoBadges: React.FC<{
  place: Place;
  promoFilters: PromoFilter[];
  maxBadges?: number;
  size?: 'xs' | 'sm';
  className?: string;
}> = ({ place, promoFilters, maxBadges = 3, size = 'xs', className = '' }) => {
  const badges = getActiveBadgesForPlace(place, promoFilters).slice(0, maxBadges);
  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((badge) => {
        const Icon = getIconComponent(badge.iconKey);
        return (
          <span
            key={badge.id}
            style={{
              backgroundColor: badge.badgeBgColor || '#fef3c7',
              color: badge.badgeTextColor || '#92400e',
            }}
            className={`inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap shadow-xs ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
            }`}
          >
            <Icon size={size === 'sm' ? 12 : 11} strokeWidth={2.3} />
            <span>{badge.name}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Interactive horizontal Filter Chips bar for dynamic Admin-managed Promo Filters */
export const PromoFilterChipsBar: React.FC<{
  promoFilters: PromoFilter[];
  selectedFilterId: string | null;
  onSelect: (filterId: string | null) => void;
  placesPool?: Place[];
  allLabel?: string;
}> = ({ promoFilters, selectedFilterId, onSelect, placesPool, allLabel = 'الكل' }) => {
  const active = promoFilters
    .filter((f) => f.active)
    .sort((a, b) => a.order - b.order);

  if (active.length === 0) return null;

  const today = getTodayISO();

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 520, damping: 28 }}
        onClick={() => onSelect(null)}
        className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
          selectedFilterId === null
            ? 'bg-[#003820] text-white shadow-xs'
            : 'bg-white border border-[#e4ece7] text-[#404942] hover:border-[#0f5132]/40'
        }`}
      >
        {allLabel}
      </motion.button>
      {active.map((f) => {
        const Icon = getIconComponent(f.iconKey);
        const isSelected = selectedFilterId === f.id;
        const count = placesPool
          ? placesPool.filter((p) => isPlaceSubscribedToFilter(p, f.id, today)).length
          : null;

        return (
          <motion.button
            key={f.id}
            type="button"
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            onClick={() => onSelect(isSelected ? null : f.id)}
            style={
              isSelected
                ? { backgroundColor: f.badgeBgColor, color: f.badgeTextColor, borderColor: f.badgeTextColor }
                : undefined
            }
            className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
              isSelected
                ? 'shadow-sm ring-1 ring-current'
                : 'bg-white border-[#e4ece7] text-[#181c1c] hover:border-[#0f5132]/40'
            }`}
          >
            <Icon
              size={13}
              strokeWidth={2.2}
              style={!isSelected ? { color: f.badgeTextColor === '#ffe088' ? '#0f5132' : f.badgeTextColor } : undefined}
            />
            <span>{f.name}</span>
            {count !== null && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                  isSelected ? 'bg-black/15' : 'bg-[#f1f4f2] text-[#404942]'
                }`}
              >
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
