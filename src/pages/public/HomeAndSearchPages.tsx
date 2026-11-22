import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BadgeCheck,
  Bike,
  ChevronLeft,
  Clock,
  Code2,
  Compass,
  ExternalLink,
  Hammer,
  HeartHandshake,
  History,
  MapPin,
  Navigation,
  Percent,
  Phone,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CivicImage, PublicRootLayout, StackLayout } from '../../components/SharedUI';
import { AbuHomsAreaMap } from '../../components/AbuHomsAreaMap';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import { DynamicCategoryIcon, hexToRgba } from '../../lib/icons';
import {
  clearRecentSearches,
  getRecentSearches,
  matchesArabicQuery,
  normalizeArabic,
  saveRecentSearch,
} from '../../lib/arabicSearch';
import { evaluateOpenStatus } from '../../lib/workingHours';
import {
  findZoneForText,
  formatDistanceKm,
  getPlaceDistanceKm,
  type GeoCoords,
} from '../../lib/abuhomsGeo';
import {
  isPlaceSubscribedToFilter,
  PlacePromoBadges,
  PromoFilterChipsBar,
  sortPlacesByPromoPriority,
} from '../../lib/promoFilters';
import type { Category } from '../../types';
import abuhomsCommunityHero from '../../assets/images/abuhoms_community_hero_1795274712106.jpg';

export function getCategoryRoute(cat: Category): string {
  switch (cat.templateType) {
    case 'medical':
      return '/medical';
    case 'restaurants':
      return '/restaurants';
    case 'real-estate':
      return '/real-estate';
    case 'heroes':
      return '/heroes';
    default:
      return `/services/${cat.slug}`;
  }
}

export const HomePage: React.FC = () => {
  const {
    activeCategories,
    activePromoFilters,
    campaigns,
    places,
    offers,
    activeTracker,
    setActiveTracker,
    settings,
  } = useApp();
  const navigate = useNavigate();
  const [heroQuery, setHeroQuery] = useState('');
  const [heroSearchFocused, setHeroSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [bannerIndex, setBannerIndex] = useState(0);
  const [selectedHomePromo, setSelectedHomePromo] = useState<string | null>(null);

  const heroSuggestions = useMemo(() => {
    const q = heroQuery.trim();
    if (q.length < 1) return [];
    return places
      .filter((p) =>
        matchesArabicQuery(
          `${p.name} ${p.specialty || ''} ${p.area} ${p.address} ${(p.tags || []).join(' ')}`,
          q
        )
      )
      .slice(0, 5);
  }, [places, heroQuery]);

  const activeCampaigns = useMemo(() => campaigns.filter((c) => c.active), [campaigns]);
  const featuredPlaces = useMemo(() => {
    const filtered = selectedHomePromo
      ? places.filter((p) => isPlaceSubscribedToFilter(p, selectedHomePromo))
      : places.filter(
          (p) => p.featured || (p.filterTags && p.filterTags.length > 0)
        );
    return sortPlacesByPromoPriority(filtered, activePromoFilters).slice(0, 6);
  }, [places, activePromoFilters, selectedHomePromo]);
  const topOffers = useMemo(() => offers.filter((o) => o.active).slice(0, 3), [offers]);
  const heroesCount = useMemo(
    () => places.filter((p) => p.categorySlug === 'heroes').length,
    [places]
  );

  useEffect(() => {
    if (activeCampaigns.length <= 1) return;
    const timer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % activeCampaigns.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [activeCampaigns.length]);

  const currentBanner = activeCampaigns[bannerIndex % Math.max(activeCampaigns.length, 1)];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroQuery.trim();
    if (q) {
      setRecentSearches(saveRecentSearch(q));
    }
    setHeroSearchFocused(false);
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <PublicRootLayout>
      <div className="space-y-6">
        {/* Active Live Order / Clinic Queue / Delivery Floating Widget (SCREEN_140) */}
        {activeTracker && (
          <FadeInUp index={0} y={14}>
            <div className="bg-[#003820] text-white rounded-3xl p-4 shadow-civic-2 flex items-center justify-between gap-3">
              <Link to={activeTracker.route} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-[#9ff1bd] text-[#003820] flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#9ff1bd]">
                    متابعة حية نشطة · {activeTracker.code}
                  </p>
                  <p className="text-sm font-bold truncate">{activeTracker.title}</p>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={activeTracker.route}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white text-[#003820] text-xs font-bold flex items-center gap-1 active:scale-95"
                >
                  متابعة
                  <ArrowLeft size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTracker(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  aria-label="إخفاء المتابعة"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </FadeInUp>
        )}

        {/* Hardcoded App Designer Promotional Banner (Static, Non-Editable) */}
        <FadeInUp index={0} y={14}>
          <a
            href="https://wajha-mk2373982.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="مصمم التطبيق - خدمات رقمية متكاملة - تصفح الآن"
            className="group relative block w-full overflow-hidden rounded-2xl border border-[#cca730]/65 bg-[linear-gradient(108deg,#cca730_0%,#8f6f18_14%,#0a4a2b_42%,#003820_100%)] p-3.5 sm:px-5 sm:py-4 shadow-civic-2 transition-all duration-200 hover:border-[#ffe088] hover:shadow-lg active:scale-[0.98]"
          >
            {/* Subtle metallic sheen & soft highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(255,224,136,0.28),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_55%)]"
            />

            <div className="relative flex items-center justify-between gap-2.5 sm:gap-4">
              {/* Right Tech Icon */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#cca730]/20 border border-[#ffe088]/45 text-[#ffe088] flex items-center justify-center shrink-0 shadow-inner">
                <Code2 size={22} strokeWidth={2.2} />
              </div>

              {/* Center Content */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#cca730]/25 border border-[#ffe088]/40 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-[#ffe088]">
                  <Sparkles size={10} />
                  <span>مصمم التطبيق</span>
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white leading-snug truncate">
                  خدمات رقمية متكاملة
                </h2>
                <p className="text-[11px] sm:text-xs text-[#e6f4ec]/90 leading-snug line-clamp-2 sm:line-clamp-1">
                  تصميم، برمجة، وحلول ذكية لأعمالك
                </p>
              </div>

              {/* Left CTA Button */}
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#ffe088] group-hover:bg-[#fff0ba] px-2.5 py-2 sm:px-4 sm:py-2.5 text-[11px] sm:text-xs font-extrabold text-[#003820] shadow-xs whitespace-nowrap transition-colors">
                <span>تصفح الآن</span>
                <ExternalLink size={13} strokeWidth={2.4} />
              </span>
            </div>
          </a>
        </FadeInUp>

        {/* Hero Section: Search + Promo Banner (Responsive 2-column on Desktop) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Compact Community Hero Search Card */}
          <FadeInUp index={0} y={16} className="lg:col-span-7 flex relative z-20">
          <div className="w-full relative rounded-3xl bg-[#042f1d] border border-[#0f5132]/30 px-4 py-5 sm:px-6 sm:py-6 min-h-[172px] sm:min-h-[192px] shadow-civic-2 flex flex-col justify-between gap-4 text-white">
            {/* Warm Abu Homs Community Gathering Backdrop (clipped cleanly inside rounded corners) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <img
                src={abuhomsCommunityHero}
                alt="لمة أهل أبوحمص في مكان واحد"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center scale-[1.01]"
              />
              {/* Measured Contrast Scrim preserving warm golden highlights */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#002817]/90 via-[#043620]/50 to-[#002817]/35" />
            </div>

            {/* Concise Headline Over Backdrop */}
            <div className="relative z-10 text-center pt-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] text-balance">
                أبوحمص في <span className="text-[#ffe088]">مكان واحد</span>
              </h1>
            </div>

            {/* Sleek Professional Search Capsule with Instant Smart Autocomplete */}
            <div className="relative z-20">
              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center bg-white/95 backdrop-blur-md rounded-full p-1.5 shadow-[0_12px_30px_-8px_rgba(0,24,14,0.6)] ring-1 ring-white/90 focus-within:ring-2 focus-within:ring-[#ffe088] transition-shadow"
              >
                <Search
                  size={18}
                  className="mr-3 text-[#0f5132] shrink-0 pointer-events-none"
                />
                <input
                  type="search"
                  value={heroQuery}
                  onFocus={() => setHeroSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setHeroSearchFocused(false), 180)}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="ابحث عن طبيب، مطعم، صيدلية، شقة، أو حرفة..."
                  className="w-full min-h-[40px] px-2.5 bg-transparent focus:outline-none text-xs sm:text-sm font-medium text-[#181c1c] placeholder:text-[#66736b]"
                />
                {heroQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setHeroQuery('')}
                    aria-label="مسح البحث"
                    className="w-8 h-8 rounded-full text-[#66736b] hover:bg-[#f1f4f2] hover:text-[#181c1c] flex items-center justify-center shrink-0 ml-1 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
                <button
                  type="submit"
                  className="min-h-[40px] px-4 sm:px-5 rounded-full bg-[#003820] hover:bg-[#0f5132] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs active:scale-95 transition-all"
                >
                  <span>ابحث</span>
                  <ArrowLeft size={14} />
                </button>
              </form>

              {/* Smart Autocomplete & Recent Searches Popover */}
              {heroSearchFocused && (heroSuggestions.length > 0 || (heroQuery.trim().length === 0 && recentSearches.length > 0)) && (
                <div className="absolute top-full mt-2 inset-x-0 bg-white text-[#181c1c] rounded-2xl border border-[#e4ece7] shadow-2xl overflow-hidden z-30">
                  {heroQuery.trim().length > 0 ? (
                    <div className="divide-y divide-[#eef3f0]">
                      {heroSuggestions.map((pl) => {
                        const target =
                          pl.categorySlug === 'medical'
                            ? `/medical/doctors/${pl.id}`
                            : pl.categorySlug === 'restaurants'
                              ? `/restaurants/${pl.id}`
                              : pl.categorySlug === 'heroes'
                                ? `/heroes/${pl.id}`
                                : `/places/${pl.id}`;
                        const status = evaluateOpenStatus(pl.hours, pl.openNow ?? true);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setRecentSearches(saveRecentSearch(pl.name));
                              setHeroSearchFocused(false);
                              navigate(target);
                            }}
                            className="w-full px-3.5 py-2.5 text-right hover:bg-[#f7faf8] flex items-center justify-between gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#181c1c] truncate">{pl.name}</p>
                              <p className="text-[11px] text-[#404942] truncate">
                                {pl.specialty || pl.area} · {pl.area}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                status.isOpen ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#f1f4f2] text-[#707971]'
                              }`}
                            >
                              {status.isOpen ? 'مفتوح' : 'مغلق'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#707971]">
                        <span className="font-bold flex items-center gap-1">
                          <History size={12} /> آخر عمليات البحث
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            clearRecentSearches();
                            setRecentSearches([]);
                          }}
                          className="text-[#ba1a1a] font-semibold hover:underline"
                        >
                          مسح
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setHeroQuery(term);
                              setHeroSearchFocused(false);
                              navigate(`/search?q=${encodeURIComponent(term)}`);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] text-xs font-semibold"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </FadeInUp>

          {/* Fair-Rotation Promo Banner Card with smooth cross-fade */}
          <FadeInUp index={1} y={16} className="lg:col-span-5 flex">
          <div className="w-full relative overflow-hidden bg-gradient-to-bl from-[#003820] via-[#0f5132] to-[#146c43] text-white rounded-3xl p-5 sm:p-6 shadow-civic-2 flex flex-col justify-between gap-4">
            {currentBanner ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#ffe088]">
                    {currentBanner.badgeText || 'إعلان محلي معتمد'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeCampaigns.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setBannerIndex(idx)}
                        aria-label={`بنر ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === bannerIndex % activeCampaigns.length
                            ? 'w-6 bg-[#9ff1bd]'
                            : 'w-2 bg-white/30 hover:bg-white/55'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentBanner.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col justify-between gap-4 flex-1"
                  >
                    <div className="space-y-1.5">
                      <h2 className="text-xl font-bold leading-snug">{currentBanner.title}</h2>
                      {currentBanner.subtitle && (
                        <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                          {currentBanner.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <Link
                        to={currentBanner.targetRoute}
                        className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9ff1bd] hover:bg-[#b8f7cf] text-[#003820] font-bold text-xs sm:text-sm inline-flex items-center gap-2 active:scale-95 transition-all"
                      >
                        {currentBanner.ctaText || 'التفاصيل الآن'}
                        <ArrowLeft size={16} />
                      </Link>
                      <Link
                        to="/advertise"
                        className="text-xs text-white/75 hover:text-white underline underline-offset-4"
                      >
                        أعلن نشاطك هنا
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              <div className="flex flex-col justify-center h-full space-y-2">
                <h2 className="text-lg font-bold">دليل أبوحمص التفاعلي</h2>
                <p className="text-xs text-white/80">تغطية حقيقية للبندر والوحدات القروية الأربع.</p>
              </div>
            )}
          </div>
          </FadeInUp>
        </section>

        {/* Compact Clean Utility Tier: Al-Mukafiheen (Top) + Delivery & Emergency (Two compact rounded tiles below) */}
        <section className="space-y-2.5" aria-label="الخدمات المجتمعية والعاجلة">
          {/* 1. Al-Mukafiheen (Top full-width, compact with luminous category-style icon) */}
          <FadeInUp index={0} y={10}>
            <Link
              to="/heroes"
              style={{
                background: `radial-gradient(circle at 92% 50%, ${hexToRgba('#fef3c7', 0.85)} 0%, #ffffff 68%)`,
              }}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-[#efe0b5] bg-white px-3.5 py-3 shadow-civic-1 transition-all duration-200 hover:border-[#d99b1e]/65 hover:shadow-civic-2 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <DynamicCategoryIcon
                  iconKey="heart-handshake"
                  bgColor="#fef3c7"
                  iconColor="#b45309"
                  size="sm"
                  className="w-11 h-11 rounded-[14px]"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-[#1f1800] group-hover:text-[#92400e] truncate transition-colors">
                      المكافحون والمكافحات
                    </h2>
                    {heroesCount > 0 && (
                      <span className="text-[11px] font-semibold text-[#b45309] tabular-nums shrink-0">
                        · {heroesCount} حرفي
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#615226] truncate">
                    حرفيون ومشاريع منزلية بأبوحمص · تواصل مباشر بدون عمولة
                  </p>
                </div>
              </div>
              <ChevronLeft
                size={18}
                className="text-[#b45309]/75 shrink-0 transition-transform duration-200 group-hover:-translate-x-1"
              />
            </Link>
          </FadeInUp>

          {/* 2. Two Compact Side-by-Side Rounded Tiles: Delivery & Emergency */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Delivery Tile */}
            <FadeInUp index={1} y={10} className="h-full">
              <Link
                to="/delivery"
                style={{
                  background: `radial-gradient(circle at 88% 50%, ${hexToRgba('#e6f4ec', 0.88)} 0%, #ffffff 72%)`,
                }}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-[#d6eadf] bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-civic-1 h-full transition-all duration-200 hover:border-[#0f5132]/45 hover:shadow-civic-2 active:scale-[0.985]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <DynamicCategoryIcon
                    iconKey="bike"
                    bgColor="#e6f4ec"
                    iconColor="#0f5132"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[#0c291b] group-hover:text-[#0f5132] truncate transition-colors">
                      الدليفري الموحد
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#40594b] truncate">
                      مشاوير وتوصيل سريع
                    </p>
                  </div>
                </div>
                <ChevronLeft
                  size={16}
                  className="text-[#0f5132]/65 shrink-0 hidden sm:block transition-transform duration-200 group-hover:-translate-x-1"
                />
              </Link>
            </FadeInUp>

            {/* Emergency 24h Tile */}
            <FadeInUp index={2} y={10} className="h-full">
              <Link
                to="/emergency"
                style={{
                  background: `radial-gradient(circle at 88% 50%, ${hexToRgba('#fee2e2', 0.85)} 0%, #ffffff 72%)`,
                }}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-[#f5d5d5] bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-civic-1 h-full transition-all duration-200 hover:border-[#dc2626]/45 hover:shadow-civic-2 active:scale-[0.985]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <DynamicCategoryIcon
                    iconKey="shield-alert"
                    bgColor="#fee2e2"
                    iconColor="#dc2626"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[#4a1212] group-hover:text-[#b91c1c] truncate transition-colors">
                      طوارئ وسند
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-[#7a3a3a] truncate tabular-nums">
                      إسعاف 123 · 24 ساعة
                    </p>
                  </div>
                </div>
                <ChevronLeft
                  size={16}
                  className="text-[#dc2626]/65 shrink-0 hidden sm:block transition-transform duration-200 group-hover:-translate-x-1"
                />
              </Link>
            </FadeInUp>
          </div>
        </section>

        {/* 100% Dynamic Categories Grid (Live from Firestore categories ordered by order) */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#181c1c]">أقسام دليل أبوحمص</h2>
              <p className="text-xs text-[#404942]">
                تُحدّث تلقائياً ولحظياً من إدارة الدليل ({activeCategories.length} قسماً متاحاً)
              </p>
            </div>
            <Link
              to="/search"
              className="text-xs font-bold text-[#0f5132] hover:underline flex items-center gap-1"
            >
              تصفح الكل
              <ChevronLeft size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {activeCategories.map((cat, idx) => (
              <FadeInUp key={cat.id} index={idx} y={16} className="h-full">
                <Link
                  to={getCategoryRoute(cat)}
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${hexToRgba(cat.bgColor || '#e6f4ec', 0.65)} 0%, #ffffff 70%)`,
                  }}
                  className="group relative overflow-hidden bg-white border border-[#e4ece7] rounded-3xl px-3 py-4 shadow-civic-1 flex flex-col items-center justify-center text-center gap-3 hover:border-[#0f5132]/35 hover:shadow-civic-2 active:scale-95 transition-all h-full"
                >
                  <DynamicCategoryIcon
                    iconKey={cat.iconKey}
                    imageUrl={cat.imageUrl}
                    bgColor={cat.bgColor}
                    iconColor={cat.iconColor}
                    size="md"
                  />
                  <span className="text-xs sm:text-[13px] font-bold text-[#181c1c] group-hover:text-[#003820] leading-snug line-clamp-2 transition-colors">
                    {cat.name}
                  </span>
                </Link>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Featured Verified Highlights + Dynamic Promo Filter Chips */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-[#181c1c]">الأكثر تميزاً وموثوقية بأبوحمص</h2>
            <Link to="/search" className="text-xs font-bold text-[#0f5132] flex items-center gap-1">
              استكشف الكل
              <ChevronLeft size={15} />
            </Link>
          </div>

          <PromoFilterChipsBar
            promoFilters={activePromoFilters}
            selectedFilterId={selectedHomePromo}
            onSelect={setSelectedHomePromo}
            placesPool={places}
            allLabel="كل المميزين"
          />

          {featuredPlaces.length === 0 ? (
            <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-6 text-center text-xs text-[#404942]">
              لا توجد أماكن مسجلة داخل هذا الفلتر حالياً.
            </AnimatedEmptyState>
          ) : (
            <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {featuredPlaces.map((place, idx) => {
                const target =
                  place.categorySlug === 'medical'
                    ? `/medical/doctors/${place.id}`
                    : place.categorySlug === 'restaurants'
                      ? `/restaurants/${place.id}`
                      : place.categorySlug === 'heroes'
                        ? `/heroes/${place.id}`
                        : `/places/${place.id}`;

                return (
                  <AnimatedListItem key={place.id} index={idx}>
                    <Link
                      to={target}
                      className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center gap-4 hover:border-[#0f5132]/40 transition-all h-full"
                    >
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
                        <CivicImage
                          src={place.imageUrl}
                          alt={place.name}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <PlacePromoBadges place={place} promoFilters={activePromoFilters} maxBadges={2} />
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm sm:text-base font-bold text-[#181c1c] truncate">
                            {place.name}
                          </h3>
                          {place.verified && (
                            <BadgeCheck size={16} className="text-[#cca730] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#404942] line-clamp-1">
                          {place.specialty || place.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#707971]">
                          <span className="inline-flex items-center gap-1 text-[#735c00] font-semibold tabular-nums">
                            <Star size={12} className="fill-[#cca730] text-[#cca730]" />
                            {place.rating ?? 4.8}
                          </span>
                          <span>·</span>
                          <span className="truncate">{place.area}</span>
                          {(() => {
                            const status = evaluateOpenStatus(place.hours, place.openNow ?? true);
                            return (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  status.isOpen
                                    ? 'bg-[#e6f4ec] text-[#0f5132]'
                                    : 'bg-[#f1f4f2] text-[#707971]'
                                }`}
                              >
                                {status.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </Link>
                  </AnimatedListItem>
                );
              })}
            </AnimatedListContainer>
          )}
        </section>

        {/* Latest Discounts Teaser */}
        {topOffers.length > 0 && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#181c1c]">تخفيضات وكوبونات اليوم</h2>
              <Link to="/offers" className="text-xs font-bold text-[#0f5132] flex items-center gap-1">
                كل التخفيضات
                <ChevronLeft size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {topOffers.map((offer, idx) => (
                <FadeInUp key={offer.id} index={idx} className="h-full">
                  <Link
                    to={`/offers/${offer.id}`}
                    className="block h-full bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1 hover:border-[#0f5132]/40 transition-all"
                  >
                    <div className="relative h-36">
                      <CivicImage src={offer.imageUrl} alt={offer.title} className="w-full h-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                      <span className="absolute top-3 right-3 bg-[#ba1a1a] text-white text-[11px] font-bold px-2.5 py-1 rounded-xl tabular-nums">
                        خصم {offer.discountPercent}%
                      </span>
                      <div className="absolute bottom-3 right-3 left-3 text-white">
                        <p className="text-xs text-white/80 truncate">{offer.placeName}</p>
                        <h3 className="text-sm font-bold truncate">{offer.title}</h3>
                      </div>
                    </div>
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-base font-bold text-[#003820]">{offer.salePrice} ج.م</span>
                        {offer.originalPrice && (
                          <span className="text-xs text-[#707971] line-through">
                            {offer.originalPrice} ج.م
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[#146c43] inline-flex items-center gap-1">
                        <Percent size={13} />
                        {offer.couponCode}
                      </span>
                    </div>
                  </Link>
                </FadeInUp>
              ))}
            </div>
          </section>
        )}

        {/* Independent Civic Initiative Notice */}
        <FadeInUp y={16}>
          <footer className="bg-[#f1f4f2] border border-[#e4ece7] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#003820]">
                <Sparkles size={14} className="text-[#cca730]" />
                <span>مبادرة مجتمعية مستقلة غير حكومية</span>
              </div>
              <p className="text-xs text-[#404942] leading-relaxed max-w-2xl">{settings.disclaimer}</p>
            </div>
            <Link
              to="/places/suggest"
              className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#0f5132] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 active:scale-95"
            >
              <Store size={15} />
              أضف مكانك مجاناً
            </Link>
          </footer>
        </FadeInUp>
      </div>
    </PublicRootLayout>
  );
};

export const SearchPage: React.FC = () => {
  const { places, properties, offers, activeCategories, activePromoFilters, logAnalyticsEvent, showToast } =
    useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(searchParams.get('badge') || null);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [openNowOnly, setOpenNowOnly] = useState<boolean>(false);
  const [showAreaMap, setShowAreaMap] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<GeoCoords | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [loggedZero, setLoggedZero] = useState<string>('');

  const qNorm = normalizeArabic(query);

  const handleToggleNearest = () => {
    if (userCoords) {
      setUserCoords(null);
      showToast('تم إيقاف الترتيب حسب المسافة', 'info');
      return;
    }
    if (!navigator.geolocation) {
      showToast('جهازك لا يدعم تحديد الموقع الجغرافي (GPS)', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        showToast('تم تحديد موقعك — يتم الآن ترتيب الأماكن من الأقرب إليك', 'success');
      },
      () => {
        setLocating(false);
        showToast('تعذر الوصول لموقعك، يمكنك اختيار منطقتك من خريطة أبوحمص يدوياً', 'info');
        setShowAreaMap(true);
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 180000 }
    );
  };

  const categoryPool = useMemo(() => {
    const selectedZone = selectedArea !== 'all' ? findZoneForText(selectedArea) : null;
    return places.filter((p) => {
      if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) return false;
      if (selectedArea !== 'all') {
        const placeZone = findZoneForText(p.area) || findZoneForText(p.address);
        const directMatch = normalizeArabic(p.area).includes(normalizeArabic(selectedArea));
        const zoneMatch = selectedZone && placeZone && selectedZone.id === placeZone.id;
        if (!directMatch && !zoneMatch) return false;
      }
      if (openNowOnly && !evaluateOpenStatus(p.hours, p.openNow ?? true).isOpen) return false;
      if (!qNorm) return true;
      return matchesArabicQuery(
        `${p.name} ${p.specialty || ''} ${p.area} ${p.address} ${(p.tags || []).join(' ')}`,
        query
      );
    });
  }, [places, selectedCategory, selectedArea, openNowOnly, qNorm, query]);

  const matchedPlaces = useMemo(() => {
    const list = selectedPromoId
      ? categoryPool.filter((p) => isPlaceSubscribedToFilter(p, selectedPromoId))
      : categoryPool;
    if (userCoords) {
      return [...list].sort((a, b) => {
        const da = getPlaceDistanceKm(a, userCoords) ?? 9999;
        const db = getPlaceDistanceKm(b, userCoords) ?? 9999;
        return da - db;
      });
    }
    return sortPlacesByPromoPriority(list, activePromoFilters);
  }, [categoryPool, selectedPromoId, activePromoFilters, userCoords]);

  const matchedProperties = useMemo(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'real-estate') return [];
    if (!qNorm) return properties.slice(0, 3);
    return properties.filter((pr) =>
      matchesArabicQuery(`${pr.title} ${pr.area} ${pr.address || ''} ${pr.description || ''}`, query)
    );
  }, [properties, selectedCategory, qNorm, query]);

  const matchedOffers = useMemo(() => {
    if (selectedCategory !== 'all') return [];
    if (!qNorm) return [];
    return offers.filter(
      (o) => o.active && matchesArabicQuery(`${o.title} ${o.placeName} ${o.subtitle || ''}`, query)
    );
  }, [offers, selectedCategory, qNorm, query]);

  const totalResults = matchedPlaces.length + matchedProperties.length + matchedOffers.length;

  useEffect(() => {
    if (qNorm.length >= 2) {
      const saveTimer = window.setTimeout(() => {
        setRecentSearches(saveRecentSearch(query.trim()));
      }, 1100);
      return () => window.clearTimeout(saveTimer);
    }
  }, [qNorm, query]);

  useEffect(() => {
    if (qNorm.length >= 2 && totalResults === 0 && loggedZero !== qNorm) {
      const timer = window.setTimeout(() => {
        setLoggedZero(qNorm);
        void logAnalyticsEvent({
          eventType: 'zero_search',
          query: query.trim(),
          resultCount: 0,
        });
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [qNorm, totalResults, loggedZero, query, logAnalyticsEvent]);

  return (
    <StackLayout title="البحث الموحد في أبوحمص" subtitle="بحث ذكي، الأقرب إليك، ومفتوح الآن" backTo="/home">
      <div className="space-y-4">
        {/* Search Input */}
        <FadeInUp index={0} y={14}>
          <div className="relative">
            <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0f5132]" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
              }}
              placeholder="اكتب اسم طبيب، مطعم، صيدلية، قرية، أو خدمة (يدعم الهمزات تلقائياً)..."
              className="w-full min-h-[52px] pr-12 pl-12 rounded-2xl bg-white border border-[#d7dbd9] focus:border-[#0f5132] focus:outline-none text-sm shadow-civic-1"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSearchParams({}, { replace: true });
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#f1f4f2] flex items-center justify-center text-[#404942] active:scale-90 transition-transform"
                aria-label="مسح"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </FadeInUp>

        {/* Recent Searches Strip */}
        {!query.trim() && recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-[#707971] inline-flex items-center gap-1">
              <History size={12} /> بحثت مؤخراً:
            </span>
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  setSearchParams({ q: term }, { replace: true });
                }}
                className="px-3 py-1 rounded-full bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 text-xs font-semibold text-[#003820]"
              >
                {term}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                clearRecentSearches();
                setRecentSearches([]);
              }}
              aria-label="مسح سجل البحث"
              className="text-[11px] font-bold text-[#ba1a1a] hover:underline inline-flex items-center gap-0.5 mr-auto"
            >
              <Trash2 size={11} /> مسح
            </button>
          </div>
        )}

        {/* Smart Quick Tools Row: Nearest GPS + Open Now + Interactive Area Map */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleNearest}
            disabled={locating}
            className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              userCoords
                ? 'bg-[#003820] text-[#ffe088] shadow-civic-1'
                : 'bg-white border border-[#e4ece7] text-[#003820] hover:border-[#0f5132]/40'
            }`}
          >
            <Navigation size={14} />
            {locating ? 'جارٍ تحديد موقعك...' : userCoords ? 'الأقرب إليك (مفعّل)' : 'الأقرب إليك (GPS)'}
          </button>

          <button
            type="button"
            onClick={() => setOpenNowOnly((v) => !v)}
            className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              openNowOnly
                ? 'bg-[#146c43] text-white shadow-civic-1'
                : 'bg-white border border-[#e4ece7] text-[#003820] hover:border-[#0f5132]/40'
            }`}
          >
            <Clock size={14} />
            مفتوح الآن فقط
          </button>

          <button
            type="button"
            onClick={() => setShowAreaMap((v) => !v)}
            className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              showAreaMap || selectedArea !== 'all'
                ? 'bg-[#fef3c7] border border-[#f5d061] text-[#735c00]'
                : 'bg-white border border-[#e4ece7] text-[#404942] hover:border-[#0f5132]/40'
            }`}
          >
            <Compass size={14} />
            {selectedArea !== 'all' ? `المنطقة: ${selectedArea}` : 'خريطة مناطق أبوحمص'}
          </button>

          {selectedArea !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedArea('all')}
              className="min-h-[36px] px-2.5 rounded-xl bg-[#ffdad6]/60 text-[#93000a] text-[11px] font-bold inline-flex items-center gap-1"
            >
              <X size={12} /> إلغاء المنطقة
            </button>
          )}
        </div>

        {/* Collapsible 100% Free Interactive Abu Homs Civic Map */}
        {showAreaMap && (
          <FadeInUp y={10}>
            <AbuHomsAreaMap
              places={places}
              selectedArea={selectedArea}
              onSelectArea={(area) => setSelectedArea(area)}
              userCoords={userCoords}
            />
          </FadeInUp>
        )}

        {/* Dynamic Promo Badges Filter Bar (Admin-Managed) */}
        <PromoFilterChipsBar
          promoFilters={activePromoFilters}
          selectedFilterId={selectedPromoId}
          onSelect={(id) => setSelectedPromoId(id)}
          placesPool={categoryPool}
          allLabel="كل النتائج"
        />

        {/* Dynamic Category Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <AnimatedFilterChip
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#003820] text-white'
                : 'bg-white border border-[#e4ece7] text-[#404942]'
            }`}
          >
            كل الأقسام
          </AnimatedFilterChip>
          {activeCategories.map((cat) => (
            <AnimatedFilterChip
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-[#003820] text-white'
                  : 'bg-white border border-[#e4ece7] text-[#404942]'
              }`}
            >
              {cat.name}
            </AnimatedFilterChip>
          ))}
        </div>

        {/* Results */}
        {totalResults === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3 shadow-civic-1">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#f1f4f2] text-[#707971] flex items-center justify-center">
              <Search size={24} />
            </div>
            <h3 className="text-base font-bold text-[#181c1c]">
              {query.trim()
                ? `لم نجد نتائج مطابقة لـ «${query}» حالياً`
                : 'لا توجد أماكن مطابقة للفلاتر المختارة حالياً'}
            </h3>
            <p className="text-xs text-[#404942] leading-relaxed max-w-md mx-auto">
              جرّب تعديل الفلاتر أو اقتراح إضافة هذا النشاط مجاناً ليظهر لأهالي مركز أبوحمص.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(openNowOnly || selectedArea !== 'all' || selectedCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenNowOnly(false);
                    setSelectedArea('all');
                    setSelectedCategory('all');
                    setSelectedPromoId(null);
                  }}
                  className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-2xl bg-[#f1f4f2] text-[#003820] text-xs font-bold"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
              <Link
                to="/places/suggest"
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-2xl bg-[#0f5132] text-white text-xs font-bold active:scale-95 transition-transform"
              >
                اقترح إضافة هذا المكان
              </Link>
            </div>
          </AnimatedEmptyState>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#404942] tabular-nums">
              عُثر على {totalResults} نتيجة متاحة {userCoords ? '· مرتبة من الأقرب لموقعك' : ''}
            </p>

            {matchedPlaces.length > 0 && (
              <AnimatedListContainer className="space-y-3">
                {matchedPlaces.map((place, idx) => {
                  const target =
                    place.categorySlug === 'medical'
                      ? `/medical/doctors/${place.id}`
                      : place.categorySlug === 'restaurants'
                        ? `/restaurants/${place.id}`
                        : place.categorySlug === 'heroes'
                          ? `/heroes/${place.id}`
                          : `/places/${place.id}`;
                  const openStatus = evaluateOpenStatus(place.hours, place.openNow ?? true);
                  const distKm = getPlaceDistanceKm(place, userCoords);

                  return (
                    <AnimatedListItem key={place.id} index={idx}>
                      <div className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 transition-colors rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3">
                        <Link to={target} className="flex items-center gap-3.5 min-w-0 flex-1">
                          <CivicImage
                            src={place.imageUrl}
                            alt={place.name}
                            className="w-16 h-16 rounded-2xl shrink-0"
                          />
                          <div className="min-w-0 space-y-1">
                            <PlacePromoBadges place={place} promoFilters={activePromoFilters} maxBadges={2} />
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold text-[#181c1c] truncate">{place.name}</h3>
                              {place.verified && <BadgeCheck size={15} className="text-[#cca730] shrink-0" />}
                            </div>
                            <p className="text-xs text-[#404942] truncate">{place.specialty || place.address}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#707971]">
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} />
                                {place.area}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  openStatus.isOpen
                                    ? 'bg-[#e6f4ec] text-[#0f5132]'
                                    : 'bg-[#f1f4f2] text-[#707971]'
                                }`}
                              >
                                {openStatus.label}
                              </span>
                              {distKm !== null && (
                                <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#735c00] text-[10px] font-bold tabular-nums">
                                  يبعد {formatDistanceKm(distKm)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                        <a
                          href={`tel:${place.phone}`}
                          onClick={() =>
                            void logAnalyticsEvent({
                              eventType: 'call_click',
                              targetId: place.id,
                              targetName: place.name,
                            })
                          }
                          className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                          aria-label={`اتصال بـ ${place.name}`}
                        >
                          <Phone size={18} />
                        </a>
                      </div>
                    </AnimatedListItem>
                  );
                })}
              </AnimatedListContainer>
            )}

            {matchedProperties.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <h3 className="text-sm font-bold text-[#003820]">نتائج العقارات</h3>
                <AnimatedListContainer className="space-y-2.5">
                  {matchedProperties.map((prop, idx) => (
                    <AnimatedListItem key={prop.id} index={idx}>
                      <Link
                        to={`/real-estate/${prop.id}`}
                        className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 transition-colors rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#181c1c] truncate">{prop.title}</h4>
                          <p className="text-xs text-[#404942]">{prop.area}</p>
                        </div>
                        <span className="text-sm font-bold text-[#0f5132] whitespace-nowrap tabular-nums">
                          {prop.price.toLocaleString('ar-EG')} ج.م
                        </span>
                      </Link>
                    </AnimatedListItem>
                  ))}
                </AnimatedListContainer>
              </div>
            )}

            {matchedOffers.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <h3 className="text-sm font-bold text-[#003820]">التخفيضات المطابقة</h3>
                <AnimatedListContainer className="space-y-2.5">
                  {matchedOffers.map((offer, idx) => (
                    <AnimatedListItem key={offer.id} index={idx}>
                      <Link
                        to={`/offers/${offer.id}`}
                        className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 transition-colors rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#181c1c] truncate">{offer.title}</h4>
                          <p className="text-xs text-[#404942]">{offer.placeName}</p>
                        </div>
                        <span className="text-xs font-bold text-[#ba1a1a] whitespace-nowrap">
                          خصم {offer.discountPercent}%
                        </span>
                      </Link>
                    </AnimatedListItem>
                  ))}
                </AnimatedListContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </StackLayout>
  );
};
