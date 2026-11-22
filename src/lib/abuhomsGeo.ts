import { normalizeArabic } from './arabicSearch';
import type { Place } from '../types';

export interface GeoCoords {
  lat: number;
  lng: number;
}

export interface AbuHomsZone {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  lat: number;
  lng: number;
  /** SVG map coordinates (viewBox 0 0 360 250) */
  mapX: number;
  mapY: number;
  kind: 'center' | 'district' | 'village';
}

/**
 * Approximate geographic coordinates for Abu Homs city districts & surrounding villages (Beheira, Egypt).
 * 100% static client-side dataset — zero external Maps API calls or fees.
 */
export const ABU_HOMS_ZONES: AbuHomsZone[] = [
  {
    id: 'center',
    name: 'وسط البلد - أبوحمص',
    shortName: 'وسط البلد',
    aliases: ['وسط البلد', 'بندر ابوحمص', 'مركز ابوحمص', 'ابوحمص', 'ميدان الساعه'],
    lat: 31.1004,
    lng: 30.3125,
    mapX: 180,
    mapY: 122,
    kind: 'center',
  },
  {
    id: 'portsaid',
    name: 'شارع بورسعيد',
    shortName: 'ش. بورسعيد',
    aliases: ['شارع بورسعيد', 'بورسعيد'],
    lat: 31.1021,
    lng: 30.3156,
    mapX: 218,
    mapY: 108,
    kind: 'district',
  },
  {
    id: 'station',
    name: 'شارع المحطة',
    shortName: 'ش. المحطة',
    aliases: ['شارع المحطه', 'المحطه', 'امام المحطه'],
    lat: 31.0979,
    lng: 30.3095,
    mapX: 148,
    mapY: 142,
    kind: 'district',
  },
  {
    id: 'miri',
    name: 'أرض الميري',
    shortName: 'أرض الميري',
    aliases: ['ارض الميري', 'الميري'],
    lat: 31.1052,
    lng: 30.3084,
    mapX: 142,
    mapY: 94,
    kind: 'district',
  },
  {
    id: 'zohour',
    name: 'حي الزهور',
    shortName: 'حي الزهور',
    aliases: ['حي الزهور', 'الزهور', 'المنشيه'],
    lat: 31.0956,
    lng: 30.3182,
    mapX: 232,
    mapY: 148,
    kind: 'district',
  },
  {
    id: 'hospital',
    name: 'منطقة المستشفى المركزي',
    shortName: 'المستشفى',
    aliases: ['المستشفي المركزي', 'المستشفي', 'طريق المستشفي'],
    lat: 31.0992,
    lng: 30.3038,
    mapX: 112,
    mapY: 120,
    kind: 'district',
  },
  {
    id: 'berket_ghatas',
    name: 'قرية بركة غطاس',
    shortName: 'بركة غطاس',
    aliases: ['بركه غطاس', 'غطاس'],
    lat: 31.1322,
    lng: 30.3510,
    mapX: 294,
    mapY: 54,
    kind: 'village',
  },
  {
    id: 'basantway',
    name: 'قرية بسنتواي',
    shortName: 'بسنتواي',
    aliases: ['بسنتواي', 'بسنطواي'],
    lat: 31.0635,
    lng: 30.2895,
    mapX: 88,
    mapY: 204,
    kind: 'village',
  },
  {
    id: 'gawad_hosny',
    name: 'قرية جواد حسني',
    shortName: 'جواد حسني',
    aliases: ['جواد حسني', 'جواد'],
    lat: 31.0748,
    lng: 30.3585,
    mapX: 292,
    mapY: 192,
    kind: 'village',
  },
  {
    id: 'batores',
    name: 'قرية بطورس',
    shortName: 'بطورس',
    aliases: ['بطورس'],
    lat: 31.1425,
    lng: 30.2785,
    mapX: 74,
    mapY: 56,
    kind: 'village',
  },
  {
    id: 'saraya',
    name: 'عزبة السرايا',
    shortName: 'السرايا',
    aliases: ['عزبه السرايا', 'السرايا', 'الكوم الاخضر', 'دير امس'],
    lat: 31.1168,
    lng: 30.3120,
    mapX: 186,
    mapY: 60,
    kind: 'village',
  },
];

export const ABU_HOMS_CENTER_COORDS: GeoCoords = {
  lat: ABU_HOMS_ZONES[0].lat,
  lng: ABU_HOMS_ZONES[0].lng,
};

export function findZoneForText(areaOrAddress?: string): AbuHomsZone | null {
  const norm = normalizeArabic(areaOrAddress);
  if (!norm) return null;
  // Check specific districts and villages first so strings like "شارع المحطة أبوحمص" don't prematurely match "أبوحمص"
  for (const zone of ABU_HOMS_ZONES) {
    if (zone.kind === 'center') continue;
    if (zone.aliases.some((alias) => norm.includes(normalizeArabic(alias)))) {
      return zone;
    }
  }
  for (const zone of ABU_HOMS_ZONES) {
    if (zone.kind !== 'center') continue;
    if (zone.aliases.some((alias) => norm.includes(normalizeArabic(alias)))) {
      return zone;
    }
  }
  return null;
}

export function getAreaCoords(area?: string, address?: string): GeoCoords | null {
  const byArea = findZoneForText(area);
  if (byArea) return { lat: byArea.lat, lng: byArea.lng };
  const byAddress = findZoneForText(address);
  if (byAddress) return { lat: byAddress.lat, lng: byAddress.lng };
  return null;
}

export function haversineKm(a: GeoCoords, b: GeoCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function getPlaceExactOrZoneCoords(
  place: Pick<Place, 'area' | 'address' | 'lat' | 'lng'>
): GeoCoords {
  if (
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng)
  ) {
    return { lat: place.lat, lng: place.lng };
  }
  return getAreaCoords(place.area, place.address) ?? ABU_HOMS_CENTER_COORDS;
}

/**
 * Resolves a place's geographic coordinates for map pins.
 * If exact lat/lng are provided on the place record, uses them directly.
 * Otherwise positions the pin within its Abu Homs district/village using a subtle
 * deterministic golden-angle offset so pins in the same area remain individually clickable.
 */
export function getPlaceMapCoords(
  place: Pick<Place, 'id' | 'area' | 'address' | 'lat' | 'lng'>,
  indexInZone = 0
): GeoCoords {
  if (
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng)
  ) {
    return { lat: place.lat, lng: place.lng };
  }
  const base = getAreaCoords(place.area, place.address) ?? ABU_HOMS_CENTER_COORDS;
  if (indexInZone <= 0) {
    return base;
  }
  const goldenAngle = 2.399963229728653; // ~137.5 degrees in radians
  const angle = indexInZone * goldenAngle;
  // Spread radius between ~55m and ~190m within the district
  const radiusDeg = Math.min(0.00055 * Math.sqrt(indexInZone), 0.0018);
  return {
    lat: Number((base.lat + Math.sin(angle) * radiusDeg).toFixed(6)),
    lng: Number((base.lng + Math.cos(angle) * radiusDeg * 1.15).toFixed(6)),
  };
}

export function getPlaceDistanceKm(
  place: Pick<Place, 'area' | 'address' | 'lat' | 'lng'>,
  userCoords: GeoCoords | null
): number | null {
  if (!userCoords) return null;
  const coords = getPlaceExactOrZoneCoords(place);
  return haversineKm(userCoords, coords);
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${meters} م`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} كم`;
  }
  return `${Math.round(km)} كم`;
}
