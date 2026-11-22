import React, { useMemo } from 'react';
import { Compass, MapPin, Navigation } from 'lucide-react';
import { ABU_HOMS_ZONES, findZoneForText, formatDistanceKm, haversineKm, type GeoCoords } from '../lib/abuhomsGeo';
import type { Place } from '../types';

interface AbuHomsAreaMapProps {
  places: Place[];
  selectedArea: string;
  onSelectArea: (areaName: string) => void;
  userCoords: GeoCoords | null;
}

/**
 * 100% Free Interactive Civic Map of Abu Homs Districts & Villages (SVG).
 * Zero external tile servers, zero paid Google Maps API calls.
 */
export const AbuHomsAreaMap: React.FC<AbuHomsAreaMapProps> = ({
  places,
  selectedArea,
  onSelectArea,
  userCoords,
}) => {
  const zoneStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const z of ABU_HOMS_ZONES) counts.set(z.id, 0);

    for (const p of places) {
      const matched = findZoneForText(p.area) || findZoneForText(p.address) || ABU_HOMS_ZONES[0];
      counts.set(matched.id, (counts.get(matched.id) || 0) + 1);
    }

    let closestZoneId: string | null = null;
    let minKm = Infinity;

    const enriched = ABU_HOMS_ZONES.map((z) => {
      const km = userCoords ? haversineKm(userCoords, { lat: z.lat, lng: z.lng }) : null;
      if (km !== null && km < minKm) {
        minKm = km;
        closestZoneId = z.id;
      }
      return {
        ...z,
        count: counts.get(z.id) || 0,
        distanceKm: km,
      };
    });

    return { enriched, closestZoneId };
  }, [places, userCoords]);

  const activeZone = useMemo(() => {
    if (!selectedArea || selectedArea === 'all') return null;
    return findZoneForText(selectedArea);
  }, [selectedArea]);

  return (
    <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
            <Compass size={17} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#003820]">خريطة مناطق وقرى مركز أبوحمص</h3>
            <p className="text-[11px] text-[#404942]">اضغط على أي منطقة لتصفية الأماكن والخدمات بها فوراً</p>
          </div>
        </div>
        {selectedArea !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectArea('all')}
            className="px-3 py-1.5 rounded-xl bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] text-[11px] font-bold"
          >
            عرض كل المناطق
          </button>
        )}
      </div>

      {/* Lightweight Interactive Civic SVG Radar Map */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#eef7f2] via-[#f7faf8] to-[#e4f2ea] border border-[#d7ebe0]">
        <svg
          viewBox="0 0 360 250"
          className="w-full h-[220px] sm:h-[250px] select-none"
          role="img"
          aria-label="خريطة تفاعلية لمناطق وقرى مركز أبوحمص"
        >
          {/* Decorative concentric radar rings around Abu Homs center */}
          <circle cx="180" cy="122" r="46" fill="none" stroke="#0f5132" strokeOpacity="0.12" strokeDasharray="4 4" />
          <circle cx="180" cy="122" r="88" fill="none" stroke="#0f5132" strokeOpacity="0.1" strokeDasharray="4 4" />
          <circle cx="180" cy="122" r="132" fill="none" stroke="#0f5132" strokeOpacity="0.07" />

          {/* Stylized Agricultural Highway (Cairo-Alexandria Road) & Mahmoudiya Canal */}
          <path
            d="M 18 196 Q 115 152, 180 122 T 346 46"
            fill="none"
            stroke="#0f5132"
            strokeOpacity="0.18"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M 28 32 Q 124 88, 180 122 T 326 226"
            fill="none"
            stroke="#0284c7"
            strokeOpacity="0.16"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />

          {/* Connector lines from center to villages */}
          {zoneStats.enriched
            .filter((z) => z.kind === 'village')
            .map((z) => (
              <line
                key={`line-${z.id}`}
                x1={180}
                y1={122}
                x2={z.mapX}
                y2={z.mapY}
                stroke="#0f5132"
                strokeOpacity="0.14"
                strokeWidth="1.2"
              />
            ))}

          {/* Interactive Zone Nodes */}
          {zoneStats.enriched.map((z) => {
            const isSelected = activeZone?.id === z.id;
            const isClosest = zoneStats.closestZoneId === z.id;
            const radius = z.kind === 'center' ? 16 : z.kind === 'district' ? 13 : 12;

            return (
              <g
                key={z.id}
                onClick={() => onSelectArea(isSelected ? 'all' : z.name)}
                className="cursor-pointer group"
              >
                {isClosest && (
                  <circle
                    cx={z.mapX}
                    cy={z.mapY}
                    r={radius + 6}
                    fill="#d4a017"
                    fillOpacity="0.22"
                    stroke="#d4a017"
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  cx={z.mapX}
                  cy={z.mapY}
                  r={radius}
                  fill={isSelected ? '#003820' : z.count > 0 ? '#0f5132' : '#ffffff'}
                  stroke={isSelected ? '#d4a017' : '#0f5132'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text
                  x={z.mapX}
                  y={z.mapY + 3.5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={isSelected || z.count > 0 ? '#ffffff' : '#0f5132'}
                >
                  {z.count}
                </text>
                <text
                  x={z.mapX}
                  y={z.mapY + radius + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight={isSelected ? '800' : '600'}
                  fill={isSelected ? '#003820' : '#334155'}
                >
                  {z.shortName}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="px-3 py-2 bg-white/85 backdrop-blur-xs border-t border-[#d7ebe0] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#404942]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0f5132] inline-block" />
              عدد الأماكن المسجلة
            </span>
            {userCoords && (
              <span className="inline-flex items-center gap-1 text-[#735c00] font-bold">
                <Navigation size={11} />
                الهالة الذهبية = أقرب منطقة لموقعك
              </span>
            )}
          </div>
          <span className="font-semibold text-[#0f5132]">خريطة محلية سريعة بدون استهلاك بيانات</span>
        </div>
      </div>

      {/* Quick Zone Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {zoneStats.enriched
          .filter((z) => z.count > 0 || z.kind !== 'village')
          .map((z) => {
            const isSelected = activeZone?.id === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => onSelectArea(isSelected ? 'all' : z.name)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-colors ${
                  isSelected
                    ? 'bg-[#003820] text-white'
                    : 'bg-[#f1f4f2] text-[#404942] hover:bg-[#e6f4ec]'
                }`}
              >
                <MapPin size={11} />
                <span>{z.shortName}</span>
                <span className={`tabular-nums ${isSelected ? 'text-[#9ff1bd]' : 'text-[#707971]'}`}>
                  ({z.count})
                </span>
                {z.distanceKm !== null && (
                  <span className={`text-[10px] tabular-nums ${isSelected ? 'text-[#ffe088]' : 'text-[#0f5132]'}`}>
                    · {formatDistanceKm(z.distanceKm)}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
};
