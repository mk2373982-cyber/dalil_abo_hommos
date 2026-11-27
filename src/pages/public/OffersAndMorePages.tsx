import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Bike,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Heart,
  History,
  Info,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Percent,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Upload,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { db } from '../../firebase';
import { CivicImage, PublicRootLayout, StackLayout } from '../../components/SharedUI';
import { ListingSeo } from '../../components/ListingSeo';
import { PWAInstallButton } from '../../components/PWAInstallButton';
import {
  AnimatedEmptyState,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import { ABU_HOMS_AREAS } from '../../data/seedData';
import { normalizeArabic } from '../../lib/arabicSearch';
import { readActivityHistory, readCitizenProfile } from '../../lib/citizenProfile';
import {
  buildWhatsAppUrl,
  getPlaceDetailRoute,
  isOfferExpired,
  validateEgyptPhone,
  validateImageUrl,
} from '../../lib/formatters';
import {
  applyOfferFilterSelection,
  getEffectiveOfferFilters,
  matchesOfferFixedFeatured,
  matchesOfferFixedVip,
  OffersFilterChipsBar,
} from '../../lib/categoryFilters';
import { usePageSeo } from '../../lib/shareCard';
import { evaluateOpenStatus } from '../../lib/workingHours';
import { uploadImageToCloudinary } from '../../utils/cloudinaryUpload';
import type { Submission } from '../../types';

const SUBMISSION_TYPE_LABELS: Record<Submission['type'], string> = {
  suggest_place: 'إضافة نشاط جديد',
  report_edit: 'تصحيح بيانات مكان',
  advertise: 'طلب إعلان تجاري',
  add_property: 'إضافة عقار',
  property_inspection: 'طلب معاينة عقار',
  join_hero: 'انضمام حرفي / مكافح',
  hero_inquiry: 'طلب تواصل مع حرفي',
};

const SUBMISSION_STATUS_META: Record<
  Submission['status'],
  { label: string; desc: string; badgeClass: string; icon: React.ComponentType<{ size?: number }> }
> = {
  received: {
    label: 'تم الاستلام',
    desc: 'وصل طلبك لإدارة دليل أبوحمص وجارٍ إدراجه في جدول المراجعة.',
    badgeClass: 'bg-[#fef3c7] text-[#92400e]',
    icon: Clock,
  },
  reviewing: {
    label: 'قيد المراجعة والتدقيق',
    desc: 'يقوم فريق الدليل حالياً بالتحقق من البيانات والصور قبل النشر.',
    badgeClass: 'bg-[#e0f2fe] text-[#0369a1]',
    icon: Search,
  },
  approved: {
    label: 'تم الاعتماد',
    desc: 'تمت الموافقة على طلبك واعتماده في دليل أبوحمص.',
    badgeClass: 'bg-[#e6f4ec] text-[#0f5132]',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'مرفوض / يحتاج استكمال',
    desc: 'يرجى مراجعة ملاحظة الإدارة بالأسفل لتوضيح السبب.',
    badgeClass: 'bg-[#ffdad6] text-[#93000a]',
    icon: XCircle,
  },
  expired: {
    label: 'منتهي الصلاحية',
    desc: 'انتهت صلاحية هذا الطلب.',
    badgeClass: 'bg-[#f1f4f2] text-[#404942]',
    icon: Clock,
  },
};

const PAYLOAD_FIELD_LABELS: Record<string, string> = {
  name: 'اسم النشاط',
  categorySlug: 'القسم',
  area: 'المنطقة / القرية',
  address: 'العنوان',
  phone: 'رقم الهاتف',
  whatsapp: 'رقم الواتساب',
  hours: 'مواعيد العمل',
  description: 'الوصف',
  specialty: 'التخصص / المهنة',
  consultationFee: 'سعر الكشف',
  deliveryFee: 'سعر التوصيل',
  menuText: 'الأصناف والأسعار',
  imageUrl: 'صورة المكان أو اللوجو',
  menuImageUrl: 'صورة المينيو',
  mapsUrl: 'رابط موقع النشاط (جوجل ماب)',
  lat: 'خط العرض (Latitude)',
  lng: 'خط الطول (Longitude)',
  reason: 'سبب التعديل / ملاحظات',
  packageName: 'الباقة المطلوبة',
  businessName: 'اسم النشاط التجاري',
  notes: 'تفاصيل إضافية',
};

/**
 * استخراج رابط خرائط جوجل الصحيح من النص الملصق (حتى لو تضمّن نص مشاركة) ومحاولة قراءة الإحداثيات إن وجدت
 */
function parseGoogleMapsInput(raw: string): {
  valid: boolean;
  url: string;
  lat?: number;
  lng?: number;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, url: '' };

  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  const candidate = urlMatch ? urlMatch[0] : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      url: '',
      error: 'رابط خرائط جوجل غير صالح. يرجى نسخ الرابط مباشرة من تطبيق خرائط جوجل (يبدأ بـ https://)',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      valid: false,
      url: '',
      error: 'يجب أن يبدأ رابط خرائط جوجل بـ https://',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isGoogleMapsHost =
    host.includes('google.') ||
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'g.page' ||
    host === 'maps.google.com';

  if (!isGoogleMapsHost) {
    return {
      valid: false,
      url: '',
      error: 'يرجى لصق رابط من خرائط جوجل (Google Maps) مثل maps.app.goo.gl أو google.com/maps',
    };
  }

  let lat: number | undefined;
  let lng: number | undefined;

  const coordMatch =
    candidate.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    candidate.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    candidate.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);

  if (coordMatch) {
    const parsedLat = Number(coordMatch[1]);
    const parsedLng = Number(coordMatch[2]);
    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180
    ) {
      lat = Number(parsedLat.toFixed(6));
      lng = Number(parsedLng.toFixed(6));
    }
  }

  return { valid: true, url: candidate.slice(0, 500), lat, lng };
}

// ============================================================================
// 1. OffersListPage (/offers)
// ============================================================================
export const OffersListPage: React.FC = () => {
  const { offers, places, categories, activePromoFilters, settings, showToast } = useApp();

  const [search, setSearch] = useState('');
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeOffers = useMemo(
    () => offers.filter((o) => !isOfferExpired(o)),
    [offers]
  );

  const { filters: effectiveOfferFilters } = useMemo(
    () => getEffectiveOfferFilters(settings.offersFilters, activeOffers, categories),
    [settings.offersFilters, activeOffers, categories]
  );

  const filteredOffers = useMemo(() => {
    const afterFilter = applyOfferFilterSelection(
      activeOffers,
      selectedFilterId,
      effectiveOfferFilters,
      places,
      categories,
      activePromoFilters
    );
    const qNorm = normalizeArabic(search);
    const matched = qNorm
      ? afterFilter.filter((offer) => {
          const haystack = normalizeArabic(
            `${offer.title} ${offer.subtitle || ''} ${offer.placeName} ${offer.couponCode} ${(offer.tags || []).join(' ')}`
          );
          return haystack.includes(qNorm);
        })
      : afterFilter;

    return [...matched].sort((a, b) => {
      const aVip = matchesOfferFixedVip(a, places, activePromoFilters) ? 2 : 0;
      const bVip = matchesOfferFixedVip(b, places, activePromoFilters) ? 2 : 0;
      const aFeat = matchesOfferFixedFeatured(a, places, activePromoFilters) ? 1 : 0;
      const bFeat = matchesOfferFixedFeatured(b, places, activePromoFilters) ? 1 : 0;
      const scoreDiff = bVip + bFeat - (aVip + aFeat);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.discountPercent || 0) - (a.discountPercent || 0);
    });
  }, [activeOffers, selectedFilterId, effectiveOfferFilters, places, categories, activePromoFilters, search]);

  const handleCopyCoupon = async (e: React.MouseEvent, id: string, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard?.writeText(code);
      setCopiedId(id);
      showToast(`تم نسخ كود الخصم (${code}) بنجاح`, 'success');
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2200);
    } catch {
      showToast(`كود الخصم: ${code}`, 'info');
    }
  };

  return (
    <PublicRootLayout>
      <ListingSeo
        type="WebPage"
        path="/offers"
        title="التخفيضات والكوبونات اليومية"
        description="أحدث خصومات وعروض محلات ومطاعم وعيادات مركز ومدينة أبوحمص بكوبونات فورية."
      />
      <div className="space-y-5">
        {/* Hero Banner */}
        <FadeInUp delay={0.02}>
          <section className="bg-gradient-to-l from-[#003820] via-[#0f5132] to-[#146c43] text-white rounded-3xl p-5 sm:p-6 shadow-civic-2 relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 text-[#ffe088] text-xs font-bold">
                  <Percent size={14} />
                  <span>عروض وتخفيضات أهالي أبوحمص</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold">التخفيضات والكوبونات الحصرية</h1>
                <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-xl">
                  استفد بخصومات فورية في مطاعم وعيادات ومحلات أبوحمص — انسخ كود الخصم واعرضه عند
                  الزيارة أو الطلب.
                </p>
              </div>
              <Link
                to="/advertise"
                className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#ffe088] text-[#003820] text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 active:scale-95"
              >
                <Megaphone size={15} />
                أضف عرضك هنا
              </Link>
            </div>
          </section>
        </FadeInUp>

        {/* Search & Category Chips */}
        <FadeInUp delay={0.05} className="space-y-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#707971] pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم العرض أو المحل أو كود الخصم..."
              className="w-full min-h-[48px] pr-11 pl-4 rounded-2xl bg-white border border-[#e4ece7] focus:border-[#0f5132] outline-none text-sm shadow-civic-1"
            />
          </div>

          <OffersFilterChipsBar
            savedOffersFilters={settings.offersFilters}
            offersPool={activeOffers}
            places={places}
            categories={categories}
            promoFilters={activePromoFilters}
            selectedFilterId={selectedFilterId}
            onSelect={setSelectedFilterId}
            allLabel="الكل"
          />
        </FadeInUp>

        {/* Offers Grid */}
        {filteredOffers.length === 0 ? (
          <AnimatedEmptyState>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3 shadow-civic-1">
              <Tag size={36} className="mx-auto text-[#707971]" />
              <h2 className="text-base font-bold text-[#181c1c]">لا توجد تخفيضات مطابقة حالياً</h2>
              <p className="text-xs text-[#404942] max-w-sm mx-auto leading-relaxed">
                تابع هذه الصفحة باستمرار لأحدث عروض مطاعم ومحلات أبوحمص، أو أعلن عن عرض نشاطك الآن.
              </p>
              <div className="pt-1 flex flex-wrap justify-center gap-2">
                {search || selectedFilterId !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setSelectedFilterId(null);
                    }}
                    className="min-h-[42px] px-4 rounded-2xl bg-[#e6f4ec] text-[#003820] text-xs font-bold"
                  >
                    عرض كل التخفيضات
                  </button>
                ) : (
                  <Link
                    to="/advertise"
                    className="min-h-[42px] px-4 rounded-2xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Megaphone size={14} />
                    أضف عرض نشاطك
                  </Link>
                )}
              </div>
            </div>
          </AnimatedEmptyState>
        ) : (
          <AnimatedListContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOffers.map((offer, idx) => {
              const isVipOffer = matchesOfferFixedVip(offer, places, activePromoFilters);
              const isFeaturedOffer = matchesOfferFixedFeatured(offer, places, activePromoFilters);
              return (
              <AnimatedListItem key={offer.id} index={idx}>
                <Link
                  to={`/offers/${offer.id}`}
                  className="block h-full bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1 hover:border-[#0f5132]/40 transition-all"
                >
                  <div className="relative h-44">
                    <CivicImage src={offer.imageUrl} alt={offer.title} className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5">
                      <span className="bg-[#ba1a1a] text-white text-xs font-bold px-3 py-1 rounded-xl tabular-nums shadow">
                        خصم {offer.discountPercent}%
                      </span>
                      {isVipOffer && (
                        <span className="bg-[#003820] text-[#ffe088] text-[10px] font-bold px-2.5 py-1 rounded-xl shadow">
                          VIP
                        </span>
                      )}
                      {isFeaturedOffer && !isVipOffer && (
                        <span className="bg-[#fef3c7] text-[#92400e] text-[10px] font-bold px-2.5 py-1 rounded-xl shadow">
                          الأكثر تميزاً
                        </span>
                      )}
                    </div>
                    {offer.expiresAt && (
                      <span className="absolute top-3 left-3 bg-black/55 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-xl inline-flex items-center gap-1">
                        <Calendar size={12} />
                        حتى {offer.expiresAt}
                      </span>
                    )}
                    <div className="absolute bottom-3 right-3 left-3 text-white">
                      <p className="text-xs text-white/85 truncate">{offer.placeName}</p>
                      <h2 className="text-base font-bold line-clamp-1">{offer.title}</h2>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {offer.subtitle && (
                      <p className="text-xs text-[#404942] line-clamp-2 leading-relaxed">
                        {offer.subtitle}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-lg font-bold text-[#003820]">{offer.salePrice} ج.م</span>
                        {offer.originalPrice && offer.originalPrice > offer.salePrice && (
                          <span className="text-xs text-[#707971] line-through">
                            {offer.originalPrice} ج.م
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => void handleCopyCoupon(e, offer.id, offer.couponCode)}
                        className="min-h-[36px] px-3 rounded-xl bg-[#e6f4ec] hover:bg-[#d2ecdc] text-[#003820] text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        {copiedId === offer.id ? <Check size={14} /> : <Copy size={14} />}
                        <span className="font-mono">{offer.couponCode}</span>
                      </button>
                    </div>
                  </div>
                </Link>
              </AnimatedListItem>
              );
            })}
          </AnimatedListContainer>
        )}
      </div>
    </PublicRootLayout>
  );
};

// ============================================================================
// 2. OfferDetailPage (/offers/:couponId)
// ============================================================================
export const OfferDetailPage: React.FC = () => {
  const { couponId } = useParams<{ couponId: string }>();
  const { offers, places, showToast, logAnalyticsEvent } = useApp();
  const [copied, setCopied] = useState(false);

  const offer = useMemo(() => offers.find((o) => o.id === couponId), [offers, couponId]);
  const linkedPlace = useMemo(
    () => (offer?.placeId ? places.find((p) => p.id === offer.placeId) : undefined),
    [offer, places]
  );

  if (!offer) {
    return (
      <StackLayout title="تفاصيل التخفيض" backTo="/offers">
        <ListingSeo
          type="WebPage"
          path="/offers"
          title="تفاصيل التخفيض"
          description="تفاصيل الكوبون والخصم في دليل أبوحمص."
        />
        <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3 shadow-civic-1">
          <Tag size={36} className="mx-auto text-[#707971]" />
          <h2 className="text-base font-bold text-[#181c1c]">العرض غير متاح أو انتهت صلاحيته</h2>
          <p className="text-xs text-[#404942]">
            يمكنك تصفح باقي العروض والتخفيضات النشطة في مركز ومدينة أبوحمص.
          </p>
          <Link
            to="/offers"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-2xl bg-[#003820] text-white text-xs font-bold"
          >
            العودة لقائمة التخفيضات
          </Link>
        </div>
      </StackLayout>
    );
  }

  const expired = isOfferExpired(offer);
  const savings =
    offer.originalPrice && offer.originalPrice > offer.salePrice
      ? offer.originalPrice - offer.salePrice
      : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(offer.couponCode);
      setCopied(true);
      showToast(`تم نسخ الكوبون (${offer.couponCode})`, 'success');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast(`الكود: ${offer.couponCode}`, 'info');
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const waShareHref = `https://wa.me/?text=${encodeURIComponent(
    `عرض رائع في دليل أبوحمص!\n${offer.title} — ${offer.placeName}\nالسعر: ${offer.salePrice} ج.م (خصم ${offer.discountPercent}%)\nكود الخصم: ${offer.couponCode}\n${shareUrl}`
  )}`;

  return (
    <StackLayout title="تفاصيل العرض والكوبون" subtitle={offer.placeName} backTo="/offers">
      <ListingSeo
        type="Product"
        path={`/offers/${offer.id}`}
        title={`${offer.title} — ${offer.placeName}`}
        description={offer.subtitle || 'تفاصيل الكوبون والخصم في دليل أبوحمص.'}
        area={linkedPlace?.area}
        address={linkedPlace?.address}
        phone={linkedPlace?.phone}
        imageUrl={offer.imageUrl}
        price={String(offer.salePrice)}
        currency="EGP"
        discountPercent={offer.discountPercent}
      />
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1">
            <div className="relative h-56 sm:h-64">
              <CivicImage src={offer.imageUrl} alt={offer.title} className="w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="bg-[#ba1a1a] text-white text-xs font-bold px-3 py-1.5 rounded-xl tabular-nums shadow">
                  خصم {offer.discountPercent}%
                </span>
                {expired && (
                  <span className="bg-[#181c1c]/85 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                    عرض منتهي
                  </span>
                )}
              </div>
              <div className="absolute bottom-4 right-4 left-4 text-white space-y-1">
                <p className="text-xs font-medium text-[#ffe088]">{offer.placeName}</p>
                <h2 className="text-lg sm:text-xl font-bold leading-snug">{offer.title}</h2>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {offer.subtitle && (
                <p className="text-sm text-[#404942] leading-relaxed">{offer.subtitle}</p>
              )}

              {/* Pricing Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7]">
                <div className="space-y-0.5 tabular-nums">
                  <span className="text-[11px] font-semibold text-[#707971]">السعر بعد الخصم</span>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-bold text-[#003820]">{offer.salePrice} ج.م</span>
                    {offer.originalPrice && offer.originalPrice > offer.salePrice && (
                      <span className="text-sm text-[#707971] line-through">
                        {offer.originalPrice} ج.م
                      </span>
                    )}
                  </div>
                </div>
                {savings > 0 && (
                  <span className="px-3 py-1.5 rounded-xl bg-[#e6f4ec] text-[#0f5132] text-xs font-bold tabular-nums">
                    توفر {savings} ج.م
                  </span>
                )}
              </div>

              {/* Coupon Box */}
              <div className="p-4 rounded-2xl bg-[#003820] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-[#9ff1bd] font-semibold">كود الكوبون الحصري</p>
                  <p className="text-xl font-mono font-bold tracking-wider mt-0.5">
                    {offer.couponCode}
                  </p>
                  {offer.expiresAt && (
                    <p className="text-[11px] text-white/75 mt-1">
                      ساري حتى: {offer.expiresAt}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="min-h-[46px] px-5 rounded-2xl bg-[#9ff1bd] text-[#003820] text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-95"
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  {copied ? 'تم النسخ' : 'نسخ كود الخصم'}
                </button>
              </div>

              {/* Terms */}
              {offer.terms && offer.terms.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[#003820]">شروط وتفاصيل الاستفادة</h3>
                  <ul className="space-y-1.5 text-xs text-[#404942]">
                    {offer.terms.map((term, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-[#146c43] shrink-0 mt-0.5" />
                        <span>{term}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {linkedPlace && (
                  <Link
                    to={getPlaceDetailRoute(linkedPlace)}
                    className="min-h-[48px] px-4 rounded-2xl bg-[#0f5132] text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Store size={16} />
                    صفحة {linkedPlace.name}
                  </Link>
                )}
                {linkedPlace?.phone && (
                  <a
                    href={`tel:${linkedPlace.phone}`}
                    onClick={() =>
                      void logAnalyticsEvent({
                        eventType: 'call_click',
                        targetId: linkedPlace.id,
                        targetName: linkedPlace.name,
                        categorySlug: linkedPlace.categorySlug,
                      })
                    }
                    className="min-h-[48px] px-4 rounded-2xl bg-[#e6f4ec] text-[#003820] text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Phone size={16} />
                    اتصال مباشر ({linkedPlace.phone})
                  </a>
                )}
                {linkedPlace?.whatsapp && (
                  <a
                    href={buildWhatsAppUrl(
                      linkedPlace.whatsapp,
                      `السلام عليكم، أرغب بالاستفادة من عرض «${offer.title}» بكود (${offer.couponCode}) من دليل أبوحمص.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      void logAnalyticsEvent({
                        eventType: 'whatsapp_click',
                        targetId: linkedPlace.id,
                        targetName: linkedPlace.name,
                        categorySlug: linkedPlace.categorySlug,
                      })
                    }
                    className="min-h-[48px] px-4 rounded-2xl bg-[#146c43] text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={16} />
                    تواصل واتساب بالعرض
                  </a>
                )}
                <a
                  href={waShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] px-4 rounded-2xl bg-[#f1f4f2] text-[#181c1c] text-xs font-bold inline-flex items-center justify-center gap-2"
                >
                  <Share2 size={16} />
                  مشاركة العرض مع أصدقائك
                </a>
              </div>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

// ============================================================================
// 3. MorePage (/more)
// ============================================================================
export const MorePage: React.FC = () => {
  const { favorites, activeTracker, settings } = useApp();
  usePageSeo('المزيد والخدمات الإضافية', 'أضف نشاطك مجاناً، طلباتي، المفضلة، متابعة الطلبات، الطوارئ، وتثبيت التطبيق.');

  const activityCount = useMemo(() => readActivityHistory().length, []);

  const citizenLinks = [
    {
      to: '/my-activity',
      title: 'طلباتي وحجوزاتي وبياناتي السريعة',
      subtitle: 'سجل حجوزات العيادات والمطاعم وتعبئة تلقائية سريعة',
      icon: History,
      iconBg: 'bg-[#e6f4ec] text-[#0f5132]',
      badge: activityCount > 0 ? String(activityCount) : undefined,
    },
    {
      to: '/favorites',
      title: 'المفضلة المحفوظة',
      subtitle: 'الأطباء والمطاعم والخدمات التي حفظتها للرجوع السريع',
      icon: Heart,
      iconBg: 'bg-[#ffdad6] text-[#ba1a1a]',
      badge: favorites.length > 0 ? String(favorites.length) : undefined,
    },
    {
      to: '/track',
      title: 'متابعة حالة طلب أو بلاغ',
      subtitle: 'استعلم بكود المتابعة عن طلبات الإضافة والتعديل والإعلانات',
      icon: Search,
      iconBg: 'bg-[#e0f2fe] text-[#0369a1]',
    },
    {
      to: '/emergency',
      title: 'الطوارئ والصيدليات الليلية (24 ساعة)',
      subtitle: 'أرقام الإسعاف والمطافئ والشرطة وصيدليات النوبتجية في أبوحمص',
      icon: ShieldAlert,
      iconBg: 'bg-[#fee2e2] text-[#b91c1c]',
    },
    {
      to: '/delivery',
      title: 'اطلب دليفري / مشوار فوري',
      subtitle: 'توصيل طلبات وأدوية وأوراق داخل البندر والقرى',
      icon: Bike,
      iconBg: 'bg-[#fef3c7] text-[#92400e]',
    },
  ];

  const businessLinks = [
    {
      to: '/places/suggest?category=heroes',
      title: 'سجّل كحرفي / مكافح في الدليل',
      subtitle: 'انضم لدليل الصنايعية والحرفيين الموثوقين في أبوحمص مجاناً',
      icon: Wrench,
      iconBg: 'bg-[#ffedd5] text-[#c2410c]',
    },
    {
      to: '/advertise',
      title: 'أعلن معنا وروّج لنشاطك',
      subtitle: 'بنرات الواجهة الرئيسية وباقات التوثيق والعروض المميزة',
      icon: Megaphone,
      iconBg: 'bg-[#fef3c7] text-[#92400e]',
    },
  ];

  const infoLinks = [
    { to: '/about', title: 'عن مبادرة دليل أبوحمص', icon: Info },
    { to: '/privacy', title: 'سياسة الخصوصية وإخلاء المسؤولية', icon: Lock },
    { to: '/contact', title: 'تواصل معنا وتثبيت التطبيق', icon: Phone },
  ];

  return (
    <PublicRootLayout>
      <div className="space-y-5">
        {/* زر إضافة نشاط جديد المميز في صدارة صفحة المزيد */}
        <FadeInUp delay={0.01}>
          <Link
            to="/places/suggest"
            className="group relative block overflow-hidden rounded-3xl bg-gradient-to-l from-[#003820] via-[#0f5132] to-[#146c43] text-white p-5 sm:p-6 shadow-civic-2 border border-[#ffe088]/45"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -left-10 w-40 h-40 rounded-full bg-[#ffe088]/20 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-14 right-8 w-44 h-44 rounded-full bg-[#9ff1bd]/15 blur-2xl"
            />
            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffe088]/20 border border-[#ffe088]/45 text-[#ffe088] text-[11px] font-bold">
                  <Sparkles size={13} />
                  <span>مجاني 100% لأهالي وأنشطة أبوحمص</span>
                </span>
                <div className="w-10 h-10 rounded-2xl bg-[#ffe088] text-[#003820] flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <PlusCircle size={22} />
                </div>
              </div>

              <div className="space-y-1">
                <h1 className="text-lg sm:text-xl font-extrabold leading-snug">
                  أضف نشاطك أو عيادتك أو مطعمك للدليل
                </h1>
                <p className="text-xs sm:text-sm text-[#e6f4ec]/90 leading-relaxed">
                  أنشئ ملفاً متكاملاً بصورة المكان وموقعك على خرائط جوجل ومواعيد عملك ليصل إليك
                  آلاف الباحثين يومياً في أبوحمص وقراها.
                </p>
              </div>

              <div className="w-full min-h-[48px] px-4 rounded-2xl bg-[#ffe088] text-[#003820] font-extrabold text-sm flex items-center justify-center gap-2 shadow-md group-hover:brightness-105 transition-all">
                <PlusCircle size={18} />
                <span>إضافة نشاط جديد الآن</span>
                <ChevronLeft size={18} />
              </div>
            </div>
          </Link>
        </FadeInUp>

        <FadeInUp delay={0.04}>
          <PWAInstallButton variant="card" />
        </FadeInUp>

        {activeTracker && (
          <FadeInUp delay={0.05}>
            <Link
              to={activeTracker.route}
              className="block bg-[#e6f4ec] border border-[#9ff1bd] rounded-3xl p-4 shadow-civic-1"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#0f5132]">متابعة مباشرة نشطة</p>
                  <p className="text-sm font-bold text-[#003820] truncate">{activeTracker.title}</p>
                  <p className="text-xs font-mono text-[#146c43]">{activeTracker.code}</p>
                </div>
                <span className="px-3 py-2 rounded-2xl bg-[#003820] text-white text-xs font-bold shrink-0">
                  افتح المتابعة
                </span>
              </div>
            </Link>
          </FadeInUp>
        )}

        {/* Citizen Quick Services */}
        <FadeInUp delay={0.07}>
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold text-[#003820] px-1">خدماتي وأدواتي</h2>
            <div className="bg-white border border-[#e4ece7] rounded-3xl divide-y divide-[#e4ece7] shadow-civic-1 overflow-hidden">
              {citizenLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-[#f7faf8] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#181c1c] truncate">{item.title}</p>
                        <p className="text-xs text-[#404942] truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span className="min-w-[24px] h-6 px-2 rounded-full bg-[#003820] text-white text-xs font-bold inline-flex items-center justify-center tabular-nums">
                          {item.badge}
                        </span>
                      )}
                      <ChevronLeft size={18} className="text-[#707971]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </FadeInUp>

        {/* Business Owners & Contributors */}
        <FadeInUp delay={0.1}>
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold text-[#003820] px-1">لأصحاب الأنشطة والحرفيين</h2>
            <div className="bg-white border border-[#e4ece7] rounded-3xl divide-y divide-[#e4ece7] shadow-civic-1 overflow-hidden">
              {businessLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-[#f7faf8] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#181c1c] truncate">{item.title}</p>
                        <p className="text-xs text-[#404942] truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <ChevronLeft size={18} className="text-[#707971] shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        </FadeInUp>

        {/* Info & Legal */}
        <FadeInUp delay={0.13}>
          <section className="space-y-2.5">
            <h2 className="text-sm font-bold text-[#003820] px-1">عن التطبيق والدعم</h2>
            <div className="bg-white border border-[#e4ece7] rounded-3xl divide-y divide-[#e4ece7] shadow-civic-1 overflow-hidden">
              {infoLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-[#f7faf8] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={18} className="text-[#0f5132] shrink-0" />
                      <span className="text-sm font-semibold text-[#181c1c] truncate">
                        {item.title}
                      </span>
                    </div>
                    <ChevronLeft size={17} className="text-[#707971] shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        </FadeInUp>

        <p className="text-center text-[11px] text-[#707971] leading-relaxed px-2">
          {settings.disclaimer}
        </p>
      </div>
    </PublicRootLayout>
  );
};

// ============================================================================
// 4. FavoritesPage (/favorites)
// ============================================================================
export const FavoritesPage: React.FC = () => {
  const { favorites, places, toggleFavorite, logAnalyticsEvent } = useApp();
  usePageSeo('المفضلة المحفوظة', 'قائمة الأماكن والأطباء والمطاعم المحفوظة على جهازك للوصول السريع.');

  const favoritePlaces = useMemo(
    () => places.filter((p) => favorites.includes(p.id)),
    [places, favorites]
  );

  return (
    <StackLayout
      title="المفضلة المحفوظة"
      subtitle={`${favoritePlaces.length} مكان محفوظ على جهازك`}
      backTo="/more"
    >
      {favoritePlaces.length === 0 ? (
        <AnimatedEmptyState>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3 shadow-civic-1">
            <Heart size={36} className="mx-auto text-[#707971]" />
            <h2 className="text-base font-bold text-[#181c1c]">قائمة المفضلة فارغة حالياً</h2>
            <p className="text-xs text-[#404942] max-w-sm mx-auto leading-relaxed">
              اضغط على أيقونة القلب داخل صفحة أي طبيب أو مطعم أو خدمة لحفظها هنا والوصول إليها
              بضغطة واحدة.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <Link
                to="/home"
                className="min-h-[42px] px-4 rounded-2xl bg-[#003820] text-white text-xs font-bold inline-flex items-center"
              >
                تصفح الدليل
              </Link>
              <Link
                to="/search"
                className="min-h-[42px] px-4 rounded-2xl bg-[#e6f4ec] text-[#003820] text-xs font-bold inline-flex items-center"
              >
                البحث الشامل
              </Link>
            </div>
          </div>
        </AnimatedEmptyState>
      ) : (
        <AnimatedListContainer className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {favoritePlaces.map((place, idx) => {
            const status = evaluateOpenStatus(
              place.hours,
              place.openNow,
              undefined,
              place.workingSchedule,
              place.is24Hours
            );
            return (
              <AnimatedListItem key={place.id} index={idx}>
                <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-3">
                  <div className="flex items-start gap-3">
                    <Link
                      to={getPlaceDetailRoute(place)}
                      className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#e4ece7]"
                    >
                      <CivicImage src={place.imageUrl} alt={place.name} className="w-full h-full" />
                    </Link>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={getPlaceDetailRoute(place)}
                          className="text-sm font-bold text-[#181c1c] hover:text-[#0f5132] line-clamp-1"
                        >
                          {place.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(place.id)}
                          aria-label="إزالة من المفضلة"
                          className="w-8 h-8 rounded-full bg-[#ffdad6]/70 text-[#ba1a1a] flex items-center justify-center shrink-0"
                        >
                          <Heart size={15} className="fill-current" />
                        </button>
                      </div>
                      {place.specialty && (
                        <p className="text-xs text-[#0f5132] font-medium truncate">
                          {place.specialty}
                        </p>
                      )}
                      <p className="text-xs text-[#404942] flex items-center gap-1 truncate">
                        <MapPin size={12} className="shrink-0" />
                        {place.area}
                      </p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          status.state === 'open'
                            ? 'bg-[#e6f4ec] text-[#0f5132]'
                            : status.state === 'closed'
                              ? 'bg-[#ffdad6] text-[#93000a]'
                              : 'bg-[#f1f4f2] text-[#404942]'
                        }`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      to={getPlaceDetailRoute(place)}
                      className="min-h-[40px] rounded-xl bg-[#003820] text-white text-xs font-bold flex items-center justify-center"
                    >
                      عرض التفاصيل
                    </Link>
                    <a
                      href={`tel:${place.phone}`}
                      onClick={() =>
                        void logAnalyticsEvent({
                          eventType: 'call_click',
                          targetId: place.id,
                          targetName: place.name,
                          categorySlug: place.categorySlug,
                        })
                      }
                      className="min-h-[40px] rounded-xl bg-[#e6f4ec] text-[#003820] text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Phone size={14} />
                      اتصال
                    </a>
                  </div>
                </div>
              </AnimatedListItem>
            );
          })}
        </AnimatedListContainer>
      )}
    </StackLayout>
  );
};

// ============================================================================
// 5. TrackRequestPage (/track & /track/:secureToken)
// ============================================================================
export const TrackRequestPage: React.FC = () => {
  const { secureToken } = useParams<{ secureToken?: string }>();
  const navigate = useNavigate();
  const { submissions, settings, showToast } = useApp();
  usePageSeo('متابعة حالة الطلب', 'استعلم لحظياً عن حالة طلب إضافة مكان أو تصحيح بيانات أو إعلان في دليل أبوحمص.');

  const [inputToken, setInputToken] = useState(secureToken || '');
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<Submission | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const recentSubmissions = useMemo(
    () => readActivityHistory().filter((item) => item.type === 'submission').slice(0, 6),
    []
  );

  useEffect(() => {
    setInputToken(secureToken || '');
    if (!secureToken) {
      setRecord(null);
      setNotFound(false);
      return;
    }

    const clean = secureToken.trim();
    if (!clean) return;

    let cancelled = false;
    const loadSubmission = async () => {
      setLoading(true);
      setNotFound(false);

      const localMatch = submissions.find(
        (s) => s.trackingToken === clean || s.id === clean
      );
      if (localMatch) {
        if (!cancelled) {
          setRecord(localMatch);
          setLoading(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'submissions', clean));
        if (!cancelled) {
          if (snap.exists()) {
            setRecord({ id: snap.id, ...(snap.data() as Omit<Submission, 'id'>) });
            setNotFound(false);
          } else {
            setRecord(null);
            setNotFound(true);
          }
        }
      } catch {
        if (!cancelled) {
          setRecord(null);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSubmission();
    return () => {
      cancelled = true;
    };
  }, [secureToken, submissions]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputToken.trim();
    if (clean.length < 6) {
      showToast('يرجى إدخال كود المتابعة بشكل صحيح (يبدأ بـ TRK-)', 'error');
      return;
    }
    navigate(`/track/${encodeURIComponent(clean)}`);
  };

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard?.writeText(token);
      setCopiedToken(true);
      showToast('تم نسخ كود المتابعة بنجاح', 'success');
      window.setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      showToast(token, 'info');
    }
  };

  const statusMeta = record ? SUBMISSION_STATUS_META[record.status] : null;
  const StatusIcon = statusMeta?.icon || Clock;

  return (
    <StackLayout
      title="متابعة حالة الطلب"
      subtitle="استعلم بكود المتابعة السري بدون تسجيل دخول"
      backTo="/more"
    >
      <div className="space-y-5">
        <FadeInUp delay={0.02}>
          <form
            onSubmit={handleLookup}
            className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3"
          >
            <label className="block text-xs font-bold text-[#003820]">
              أدخل كود المتابعة (مثال: TRK-XXXX...)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                dir="ltr"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="TRK-..."
                className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm font-mono text-left"
              />
              <button
                type="submit"
                className="min-h-[48px] px-6 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0"
              >
                <Search size={17} />
                استعلام
              </button>
            </div>

            {recentSubmissions.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#707971]">طلباتك الأخيرة على هذا الجهاز:</p>
                <div className="flex flex-wrap gap-2">
                  {recentSubmissions.map((item) => (
                    <Link
                      key={item.id}
                      to={item.route}
                      className="px-3 py-1.5 rounded-xl bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] text-[11px] font-bold inline-flex items-center gap-1.5"
                    >
                      <FileText size={12} />
                      <span className="truncate max-w-[180px]">{item.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </form>
        </FadeInUp>

        {loading && (
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2 shadow-civic-1">
            <Loader2 size={28} className="mx-auto text-[#0f5132] animate-spin" />
            <p className="text-sm font-semibold text-[#003820]">جارٍ جلب حالة الطلب...</p>
          </div>
        )}

        {!loading && notFound && (
          <AnimatedEmptyState>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3 shadow-civic-1">
              <AlertTriangle size={34} className="mx-auto text-[#ba1a1a]" />
              <h2 className="text-base font-bold text-[#181c1c]">لم نجد طلباً بهذا الكود</h2>
              <p className="text-xs text-[#404942] max-w-sm mx-auto leading-relaxed">
                تأكد من نسخ كود المتابعة كاملاً كما ظهر لك بعد إرسال الطلب، أو تواصل مع فريق الدعم
                عبر واتساب.
              </p>
            </div>
          </AnimatedEmptyState>
        )}

        {!loading && record && statusMeta && (
          <FadeInUp delay={0.05}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#e4ece7]">
                <div className="space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#f1f4f2] text-[#003820] text-[11px] font-bold">
                    {SUBMISSION_TYPE_LABELS[record.type] || 'طلب'}
                  </span>
                  <h2 className="text-lg font-bold text-[#181c1c]">{record.title}</h2>
                  <p className="text-xs text-[#404942]">
                    مقدم الطلب: <strong>{record.submitterName}</strong>
                  </p>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${statusMeta.badgeClass}`}
                >
                  <StatusIcon size={15} />
                  {statusMeta.label}
                </span>
              </div>

              {/* Tracking Token Box */}
              <div className="p-3.5 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#707971]">كود المتابعة (احفظه للرجوع لاحقاً)</p>
                  <p className="text-sm font-mono font-bold text-[#003820] truncate" dir="ltr">
                    {record.trackingToken}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyToken(record.trackingToken)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#e6f4ec] text-[#003820] text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                >
                  {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                  {copiedToken ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>

              {/* Status & Admin Note */}
              <div className="p-4 rounded-2xl bg-[#e6f4ec]/65 border border-[#b7e2c8] space-y-1.5">
                <p className="text-xs font-bold text-[#003820]">تحديث فريق دليل أبوحمص:</p>
                <p className="text-xs text-[#181c1c] leading-relaxed">
                  {record.adminNote || statusMeta.desc}
                </p>
                {record.updatedAt && (
                  <p className="text-[11px] text-[#0f5132]">
                    آخر تحديث:{' '}
                    {new Date(record.updatedAt).toLocaleString('ar-EG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>

              {/* Uploaded Images Preview if present */}
              {(typeof record.payload?.imageUrl === 'string' && record.payload.imageUrl) ||
              (typeof record.payload?.menuImageUrl === 'string' && record.payload.menuImageUrl) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {typeof record.payload?.imageUrl === 'string' && record.payload.imageUrl && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[#003820]">صورة المكان المرفقة</p>
                      <img
                        src={record.payload.imageUrl}
                        alt="صورة المكان"
                        className="w-full h-40 object-cover rounded-2xl border border-[#e4ece7]"
                      />
                    </div>
                  )}
                  {typeof record.payload?.menuImageUrl === 'string' && record.payload.menuImageUrl && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[#003820]">صورة المينيو المرفقة</p>
                      <img
                        src={record.payload.menuImageUrl}
                        alt="صورة المينيو"
                        className="w-full h-40 object-cover rounded-2xl border border-[#e4ece7]"
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {/* Payload Summary */}
              {record.payload && Object.keys(record.payload).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#003820]">ملخص البيانات المرسلة</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(record.payload)
                      .filter(
                        ([k, v]) =>
                          k !== 'imageUrl' &&
                          k !== 'menuImageUrl' &&
                          k !== 'lat' &&
                          k !== 'lng' &&
                          String(v).trim() !== ''
                      )
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] text-xs"
                        >
                          <span className="block text-[10px] text-[#707971]">
                            {PAYLOAD_FIELD_LABELS[k] || k}
                          </span>
                          {k === 'mapsUrl' && typeof v === 'string' && /^https?:\/\//i.test(v) ? (
                            <a
                              href={v}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-1 font-bold text-[#0f5132] hover:underline"
                            >
                              <MapPin size={13} />
                              <span>فتح الموقع على خرائط جوجل</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="font-bold text-[#181c1c] whitespace-pre-line">
                              {String(v)}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                {record.publishedTargetId && record.type !== 'add_property' && (
                  <Link
                    to={`/places/${record.publishedTargetId}`}
                    className="min-h-[44px] px-4 rounded-2xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-2"
                  >
                    <ExternalLink size={15} />
                    عرض الصفحة المنشورة
                  </Link>
                )}
                {record.publishedTargetId && record.type === 'add_property' && (
                  <Link
                    to={`/real-estate/${record.publishedTargetId}`}
                    className="min-h-[44px] px-4 rounded-2xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-2"
                  >
                    <Building2 size={15} />
                    عرض العقار المنشور
                  </Link>
                )}
                {(settings.supportWhatsapp || settings.supportPhone) && (
                  <a
                    href={buildWhatsAppUrl(
                      settings.supportWhatsapp || settings.supportPhone,
                      `السلام عليكم إدارة دليل أبوحمص، أستفسر عن الطلب رقم: ${record.trackingToken} (${record.title})`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 rounded-2xl bg-[#e6f4ec] text-[#003820] text-xs font-bold inline-flex items-center gap-2"
                  >
                    <MessageCircle size={15} />
                    استفسار عبر واتساب الإدارة
                  </a>
                )}
              </div>
            </div>
          </FadeInUp>
        )}
      </div>
    </StackLayout>
  );
};

// ============================================================================
// 6. SuggestPlacePage (/places/suggest)
// ============================================================================
export const SuggestPlacePage: React.FC = () => {
  const { activeCategories, settings, createSubmission, showToast } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageSeo(
    'إضافة نشاط جديد للدليل',
    'أضف عيادتك أو مطعمك أو محلك أو حرفتك مجاناً في دليل أبوحمص مع صورة واضحة ومواعيد العمل.'
  );

  const areasList = useMemo(
    () => (settings.areas && settings.areas.length > 0 ? settings.areas : ABU_HOMS_AREAS),
    [settings.areas]
  );

  const savedProfile = useMemo(() => readCitizenProfile(), []);

  const resolvedParamCategory = useMemo(() => {
    const paramCat = searchParams.get('category')?.trim().toLowerCase();
    if (paramCat) {
      const matched = activeCategories.find(
        (c) =>
          c.slug.toLowerCase() === paramCat ||
          c.id.toLowerCase() === paramCat ||
          c.templateType.toLowerCase() === paramCat
      );
      if (matched) return matched.slug;
      return paramCat;
    }
    if (searchParams.get('type') === 'hero') return 'heroes';
    return activeCategories[0]?.slug || 'pharmacies';
  }, [searchParams, activeCategories]);

  const [name, setName] = useState('');
  const [categorySlug, setCategorySlug] = useState(resolvedParamCategory);
  const userTouchedCategoryRef = useRef(false);

  // مزامنة القسم تلقائياً عند وجود معامل ?category=... أو تحديث القائمة من Firestore
  useEffect(() => {
    const hasExplicitParam = Boolean(searchParams.get('category') || searchParams.get('type'));
    if (hasExplicitParam || !userTouchedCategoryRef.current) {
      setCategorySlug(resolvedParamCategory);
    }
  }, [resolvedParamCategory, searchParams]);

  const [area, setArea] = useState(savedProfile.area || '');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  // خانات ذكية مخصصة حسب القسم
  const [specialty, setSpecialty] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [menuText, setMenuText] = useState('');

  // رفع الصور (ضغط تلقائي WebP + رفع مباشر على Cloudinary)
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [menuImageUrl, setMenuImageUrl] = useState('');
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);

  const [submitterName, setSubmitterName] = useState(savedProfile.name || '');
  const [submitterPhone, setSubmitterPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const selectedCategoryObj = useMemo(
    () => activeCategories.find((c) => c.slug === categorySlug),
    [activeCategories, categorySlug]
  );

  const normalizedSlug = categorySlug.toLowerCase();
  const isRestaurant =
    selectedCategoryObj?.templateType === 'restaurants' ||
    normalizedSlug === 'restaurants' ||
    normalizedSlug.includes('restaurant') ||
    normalizedSlug.includes('cafe') ||
    normalizedSlug.includes('food');
  const isMedical =
    selectedCategoryObj?.templateType === 'medical' ||
    normalizedSlug === 'medical' ||
    normalizedSlug.includes('clinic') ||
    normalizedSlug.includes('doctor');
  const isHero =
    selectedCategoryObj?.templateType === 'heroes' ||
    normalizedSlug === 'heroes' ||
    normalizedSlug.includes('craft') ||
    normalizedSlug.includes('hero');

  const isUploadingAnyImage = uploadingMainImage || uploadingMenuImage;

  const handleMainImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMainImage(true);
    try {
      const secureUrl = await uploadImageToCloudinary(file);
      setImageUrl(secureUrl);
      showToast('تم ضغط الصورة بصيغة WebP ورفعها بنجاح', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'فشل رفع الصورة، حاول مرة أخرى', 'error');
    } finally {
      setUploadingMainImage(false);
      e.target.value = '';
    }
  };

  const handleMenuImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMenuImage(true);
    try {
      const secureUrl = await uploadImageToCloudinary(file);
      setMenuImageUrl(secureUrl);
      showToast('تم ضغط صورة المينيو ورفعها بنجاح', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'فشل رفع صورة المينيو، حاول مرة أخرى', 'error');
    } finally {
      setUploadingMenuImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUploadingAnyImage) {
      showToast('يرجى الانتظار حتى انتهاء رفع الصورة أولاً', 'info');
      return;
    }

    if (
      name.trim().length < 2 ||
      area.trim().length < 2 ||
      address.trim().length < 2 ||
      submitterName.trim().length < 2
    ) {
      showToast('يرجى استكمال اسم النشاط والمنطقة/القرية والعنوان التفصيلي واسمك بشكل صحيح', 'error');
      return;
    }

    const mapsCheck = parseGoogleMapsInput(mapsUrl);
    if (!mapsCheck.valid) {
      showToast(mapsCheck.error || 'رابط خرائط جوجل غير صالح', 'error');
      return;
    }

    if (!imageUrl) {
      showToast('رفع صورة واضحة للمكان أو اللوجو إلزامي لقبول الطلب', 'error');
      return;
    }

    const mainImageCheck = validateImageUrl(imageUrl);
    if (!mainImageCheck.valid) {
      showToast(mainImageCheck.error || 'رابط الصورة غير صالح', 'error');
      return;
    }
    const menuImageCheck = validateImageUrl(menuImageUrl);
    if (!menuImageCheck.valid) {
      showToast(menuImageCheck.error || 'رابط صورة المينيو غير صالح', 'error');
      return;
    }

    if (description.trim().length < 10) {
      showToast('يرجى كتابة وصف واضح للنشاط (10 أحرف على الأقل)', 'error');
      return;
    }

    if (hours.trim().length < 3) {
      showToast('يرجى كتابة مواعيد العمل بشكل واضح', 'error');
      return;
    }

    if (isMedical && specialty.trim().length < 2) {
      showToast('للعيادات والمراكز الطبية: يرجى كتابة التخصص الطبي الدقيق', 'error');
      return;
    }

    if (isHero && specialty.trim().length < 2) {
      showToast('لقسم الحرف والمكافحين: يرجى كتابة المهنة أو الحرفة بشكل واضح', 'error');
      return;
    }

    if (isRestaurant && !menuImageUrl && menuText.trim().length < 5) {
      showToast(
        'للمطاعم والكافيهات: يرجى رفع صورة المينيو أو كتابة الأصناف والأسعار لقبول الطلب',
        'error'
      );
      return;
    }

    const placePhoneCheck = validateEgyptPhone(phone, { allowLandline: true });
    if (!placePhoneCheck.valid) {
      showToast(placePhoneCheck.error || 'رقم هاتف النشاط غير صالح', 'error');
      return;
    }

    let normalizedWhatsapp = '';
    if (whatsapp.trim()) {
      const waCheck = validateEgyptPhone(whatsapp, { allowLandline: false });
      if (!waCheck.valid) {
        showToast(waCheck.error || 'رقم الواتساب غير صالح', 'error');
        return;
      }
      normalizedWhatsapp = waCheck.displayLocal;
    }

    const effectiveSubmitterPhone = (submitterPhone || phone).trim();
    const submitterPhoneCheck = validateEgyptPhone(effectiveSubmitterPhone, { allowLandline: true });
    if (!submitterPhoneCheck.valid) {
      showToast(submitterPhoneCheck.error || 'رقم هاتفك للتأكيد غير صالح', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const parsedFee = consultationFee.trim() ? Number(consultationFee.trim()) : NaN;
      const payload: Record<string, string | number | boolean> = {
        name: name.trim(),
        categorySlug,
        area: area.trim(),
        address: address.trim(),
        phone: placePhoneCheck.displayLocal,
        hours: hours.trim(),
        description: description.trim(),
        imageUrl,
      };

      if (mapsCheck.url) {
        payload.mapsUrl = mapsCheck.url;
      }
      if (typeof mapsCheck.lat === 'number' && typeof mapsCheck.lng === 'number') {
        payload.lat = mapsCheck.lat;
        payload.lng = mapsCheck.lng;
      }
      if (normalizedWhatsapp) {
        payload.whatsapp = normalizedWhatsapp;
      }
      if ((isMedical || isHero) && specialty.trim()) {
        payload.specialty = specialty.trim();
      }
      if (isMedical && consultationFee.trim()) {
        payload.consultationFee = !Number.isNaN(parsedFee) && parsedFee >= 0 ? parsedFee : consultationFee.trim();
      }
      if (isRestaurant && deliveryFee.trim()) {
        payload.deliveryFee = deliveryFee.trim();
      }
      if (isRestaurant && menuText.trim()) {
        payload.menuText = menuText.trim();
      }
      if (isRestaurant && menuImageUrl) {
        payload.menuImageUrl = menuImageUrl;
      }

      const sub = await createSubmission({
        type: 'suggest_place',
        title: `اقتراح إضافة: ${name.trim()}`,
        submitterName: submitterName.trim(),
        submitterPhone: submitterPhoneCheck.displayLocal,
        payload,
      });

      showToast('تم إرسال طلب إضافة النشاط بنجاح، يمكنك متابعة حالته الآن', 'success');
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'تعذر إرسال الطلب حالياً، يرجى التحقق من البيانات والمحاولة مرة أخرى',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="إضافة نشاط جديد للدليل"
      subtitle="ملف متكامل ومجاني 100% لأهالي وأنشطة أبوحمص"
      backTo="/more"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-[#fef3c7] border border-[#f59e0b]/45 rounded-3xl p-4 text-xs text-[#78350f] leading-relaxed flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[#b45309]" />
            <div>
              <strong>تنبيه هام لقبول الطلب:</strong> دليل أبوحمص يعرض ملفاً متكاملاً لكل نشاط
              وليس مجرد اسم ورقم. يرجى استكمال الوصف ومواعيد العمل ورفع صورة واضحة للمكان أو
              اللوجو (مع المينيو للمطاعم والتخصص للعيادات والحرف)؛ <strong>الطلبات الناقصة قد لا تُقبل</strong>.
            </div>
          </div>
        </FadeInUp>

        {/* 1. بيانات النشاط الأساسية */}
        <FadeInUp delay={0.06}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <h2 className="text-sm font-bold text-[#003820]">1. بيانات النشاط الأساسية</h2>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#404942]">
                اسم المحل أو العيادة أو الخدمة *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: عيادة د. محمد السعيد / مطعم البرنس"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#404942]">القسم *</label>
                <select
                  value={categorySlug}
                  onChange={(e) => {
                    userTouchedCategoryRef.current = true;
                    setCategorySlug(e.target.value);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                  {!activeCategories.some((c) => c.slug === categorySlug) && categorySlug && (
                    <option value={categorySlug}>{categorySlug}</option>
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#404942]">المنطقة أو القرية *</label>
                <input
                  type="text"
                  required
                  list="abuhoms-areas-suggestions"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="اكتب اسم المنطقة أو القرية أو العزبة بنفسك *"
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                />
                <datalist id="abuhoms-areas-suggestions">
                  {areasList.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#404942]">
                  وصف النشاط وأهم الخدمات أو المنتجات *
                </label>
                <span className="text-[11px] font-semibold text-[#146c43]">إلزامي</span>
              </div>
              <textarea
                required
                rows={3}
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اكتب نبذة واضحة عن خدماتك ومنتجاتك ومميزات المكان (10 أحرف على الأقل) *"
                className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
              />
            </div>
          </div>
        </FadeInUp>

        {/* 2. الصورة الرئيسية للمكان أو اللوجو (إلزامي) */}
        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#003820]">2. صورة المكان أو اللوجو *</h2>
                <p className="text-[11px] text-[#707971]">
                  تُضغط وتُحول تلقائياً إلى WebP لسرعة التحميل
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#0f5132] bg-[#e6f4ec] px-2.5 py-1 rounded-xl shrink-0">
                إلزامي
              </span>
            </div>

            {imageUrl ? (
              <div className="space-y-2.5">
                <div className="relative rounded-2xl overflow-hidden border border-[#e4ece7] bg-[#f7faf8]">
                  <img
                    src={imageUrl}
                    alt="معاينة صورة النشاط"
                    className="w-full h-52 object-cover"
                  />
                  {uploadingMainImage && (
                    <div className="absolute inset-0 bg-[#003820]/65 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                      <Loader2 size={28} className="animate-spin" />
                      <span className="text-xs font-bold">جارٍ ضغط الصورة الجديدة ورفعها...</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="min-h-[42px] px-3 rounded-xl bg-[#e6f4ec] hover:bg-[#d2ecdc] text-[#003820] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                    <RefreshCw size={14} />
                    تغيير الصورة
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingMainImage}
                      onChange={handleMainImageChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={uploadingMainImage}
                    onClick={() => setImageUrl('')}
                    className="min-h-[42px] px-3 rounded-xl bg-[#ffdad6] hover:bg-[#ffc6bf] text-[#93000a] text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    حذف الصورة
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 min-h-[132px] rounded-2xl border-2 border-dashed border-[#9ff1bd] bg-[#f7faf8] hover:bg-[#e6f4ec]/50 cursor-pointer transition-colors p-4 text-center">
                {uploadingMainImage ? (
                  <>
                    <Loader2 size={28} className="text-[#003820] animate-spin" />
                    <span className="text-xs font-bold text-[#003820]">
                      جارٍ ضغط الصورة (WebP) ورفعها...
                    </span>
                  </>
                ) : (
                  <>
                    <Camera size={28} className="text-[#0f5132]" />
                    <span className="text-xs font-bold text-[#003820]">
                      اضغط لاختيار صورة واضحة للواجهة أو اللوجو
                    </span>
                    <span className="text-[11px] text-[#707971]">
                      يتم تقليل الحجم تلقائياً بحد أقصى 1200px بصيغة WebP
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingMainImage}
                  onChange={handleMainImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </FadeInUp>

        {/* 3. تفاصيل إضافية مخصصة حسب القسم */}
        {(isRestaurant || isMedical || isHero) && (
          <FadeInUp delay={0.1}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#003820]">
                  {isRestaurant
                    ? '3. المينيو والتوصيل (للمطاعم والكافيهات)'
                    : isMedical
                      ? '3. التخصص الطبي وسعر الكشف'
                      : '3. تفاصيل المهنة أو الحرفة'}
                </h2>
                <span className="text-[11px] font-bold text-[#0f5132] bg-[#e6f4ec] px-2.5 py-1 rounded-xl shrink-0">
                  مطلوب للقسم
                </span>
              </div>

              {isMedical && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#404942]">
                      التخصص الطبي الدقيق *
                    </label>
                    <input
                      type="text"
                      required
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="مثال: أطفال، باطنة، أسنان، نساء وتوليد *"
                      className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#404942]">
                      سعر الكشف بالجنيه (اختياري)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(e.target.value)}
                      placeholder="مثال: 200"
                      className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                    />
                  </div>
                </div>
              )}

              {isHero && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#404942]">
                    المهنة أو الحرفة *
                  </label>
                  <input
                    type="text"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="مثال: كهربائي منازل، سباك، نجار، فني تكييف *"
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                  />
                </div>
              )}

              {isRestaurant && (
                <div className="space-y-3.5">
                  <p className="text-xs text-[#404942] leading-relaxed">
                    للمطاعم والكافيهات يجب <strong>رفع صورة المينيو</strong> أو{' '}
                    <strong>كتابة أهم الأصناف والأسعار</strong> بالأسفل (أو كليهما).
                  </p>

                  {menuImageUrl ? (
                    <div className="space-y-2">
                      <div className="relative rounded-2xl overflow-hidden border border-[#e4ece7] bg-[#f7faf8]">
                        <img
                          src={menuImageUrl}
                          alt="معاينة صورة المينيو"
                          className="w-full h-48 object-cover"
                        />
                        {uploadingMenuImage && (
                          <div className="absolute inset-0 bg-[#003820]/65 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                            <Loader2 size={24} className="animate-spin" />
                            <span className="text-xs font-bold">جارٍ رفع صورة المينيو الجديدة...</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <label className="min-h-[40px] px-3 rounded-xl bg-[#e6f4ec] hover:bg-[#d2ecdc] text-[#003820] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                          <RefreshCw size={14} />
                          تغيير صورة المينيو
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingMenuImage}
                            onChange={handleMenuImageChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={uploadingMenuImage}
                          onClick={() => setMenuImageUrl('')}
                          className="min-h-[40px] px-3 rounded-xl bg-[#ffdad6] hover:bg-[#ffc6bf] text-[#93000a] text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          حذف صورة المينيو
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 min-h-[56px] rounded-2xl border-2 border-dashed border-[#0f5132]/35 bg-[#f7faf8] hover:bg-[#e6f4ec]/50 cursor-pointer px-4 text-xs font-bold text-[#003820]">
                      {uploadingMenuImage ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جارٍ ضغط ورفع صورة المينيو...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span>رفع صورة المينيو (أو اكتب الأصناف والأسعار بالأسفل)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingMenuImage}
                        onChange={handleMenuImageChange}
                        className="hidden"
                      />
                    </label>
                  )}

                  <textarea
                    rows={4}
                    value={menuText}
                    onChange={(e) => setMenuText(e.target.value)}
                    placeholder={
                      'اكتب أهم الأصناف والأسعار (صنف في كل سطر)، مثال:\nكشري كبير - 45 ج\nطاجن لحمة - 70 ج\nشاورما فراخ سوري - 65 ج'
                    }
                    className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                  />

                  <input
                    type="text"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="سعر التوصيل (اختياري — مثال: 15 ج داخل البندر، 30 ج للقرى)"
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
                  />
                </div>
              )}
            </div>
          </FadeInUp>
        )}

        {/* العنوان وأرقام التواصل والمواعيد */}
        <FadeInUp delay={0.12}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">العنوان وأرقام التواصل والمواعيد</h2>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#404942]">
                العنوان التفصيلي للنشاط *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="اكتب عنوانك التفصيلي بنفسك (الشارع، رقم العمارة، بجوار...) *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[#404942] inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#0f5132]" />
                  <span>رابط موقع النشاط على خرائط جوجل (اختياري)</span>
                </label>
                {(() => {
                  const preview = parseGoogleMapsInput(mapsUrl);
                  if (!mapsUrl.trim() || !preview.valid || !preview.url) return null;
                  return (
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-[#0f5132] hover:underline inline-flex items-center gap-1"
                    >
                      <span>معاينة</span>
                      <ExternalLink size={12} />
                    </a>
                  );
                })()}
              </div>
              <input
                type="text"
                dir="ltr"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm text-left font-mono"
              />
              <p className="text-[11px] text-[#707971]">
                افتح موقعك في خرائط جوجل (Google Maps) واضغط «مشاركة» ثم «نسخ الرابط» والصقه هنا.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف للاتصال *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm text-right"
              />
              <input
                type="tel"
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="رقم الواتساب (اختياري)"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm text-right"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#404942]">مواعيد العمل *</label>
                <span className="text-[11px] font-semibold text-[#146c43]">إلزامي</span>
              </div>
              <input
                type="text"
                required
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="مثال: يومياً من 9 صباحاً حتى 11 مساءً (أو مفتوح 24 ساعة) *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
              />
            </div>
          </div>
        </FadeInUp>

        {/* بيانات المتابعة */}
        <FadeInUp delay={0.14}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">بياناتك للمتابعة (بدون إنشاء حساب)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="اسمك الكريم *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={submitterPhone}
                onChange={(e) => setSubmitterPhone(e.target.value)}
                placeholder="رقم هاتفك للتأكيد *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] outline-none text-sm text-right"
              />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.18}>
          <button
            type="submit"
            disabled={submitting || isUploadingAnyImage}
            className="w-full min-h-[52px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl shadow-civic-2 active:scale-95 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {isUploadingAnyImage ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جارٍ رفع الصورة... يرجى الانتظار</span>
              </>
            ) : submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جارٍ إرسال الطلب...</span>
              </>
            ) : (
              <span>إرسال الطلب المكتمل للاعتماد مجاناً</span>
            )}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

// ============================================================================
// 7. ReportPlacePage (/places/report/:placeId)
// ============================================================================
export const ReportPlacePage: React.FC = () => {
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();
  const { places, settings, createSubmission, showToast } = useApp();

  const targetPlace = useMemo(() => places.find((p) => p.id === placeId), [places, placeId]);
  usePageSeo(
    targetPlace ? `تحديث بيانات ${targetPlace.name}` : 'الإبلاغ عن خطأ أو تعديل بيانات',
    'ساهم في تحديث أرقام الهواتف أو مواعيد العمل أو العنوان في دليل أبوحمص.'
  );

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const areasList = useMemo(
    () => (settings.areas && settings.areas.length > 0 ? settings.areas : ABU_HOMS_AREAS),
    [settings.areas]
  );

  const [phone, setPhone] = useState(targetPlace?.phone || '');
  const [whatsapp, setWhatsapp] = useState(targetPlace?.whatsapp || '');
  const [hours, setHours] = useState(targetPlace?.hours || '');
  const [address, setAddress] = useState(targetPlace?.address || '');
  const [area, setArea] = useState(targetPlace?.area || '');
  const [reason, setReason] = useState('');
  const [submitterName, setSubmitterName] = useState(savedProfile.name || '');
  const [submitterPhone, setSubmitterPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!targetPlace) return;
    setPhone(targetPlace.phone || '');
    setWhatsapp(targetPlace.whatsapp || '');
    setHours(targetPlace.hours || '');
    setAddress(targetPlace.address || '');
    setArea(targetPlace.area || '');
  }, [targetPlace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitterName.trim().length < 2) {
      showToast('يرجى كتابة اسمك للتأكيد', 'error');
      return;
    }

    const submitterPhoneCheck = validateEgyptPhone(submitterPhone, { allowLandline: true });
    if (!submitterPhoneCheck.valid) {
      showToast(submitterPhoneCheck.error || 'رقم هاتفك للتواصل غير صالح', 'error');
      return;
    }

    const payload: Record<string, string | number | boolean> = {};
    const previousData: Record<string, string | number | boolean> = {};

    if (phone.trim() && phone.trim() !== (targetPlace?.phone || '').trim()) {
      const check = validateEgyptPhone(phone, { allowLandline: true });
      if (!check.valid) {
        showToast(check.error || 'رقم الهاتف الجديد غير صالح', 'error');
        return;
      }
      payload.phone = check.displayLocal;
      if (targetPlace?.phone) previousData.phone = targetPlace.phone;
    }

    if (whatsapp.trim() && whatsapp.trim() !== (targetPlace?.whatsapp || '').trim()) {
      const check = validateEgyptPhone(whatsapp, { allowLandline: false });
      if (!check.valid) {
        showToast(check.error || 'رقم الواتساب الجديد غير صالح', 'error');
        return;
      }
      payload.whatsapp = check.displayLocal;
      if (targetPlace?.whatsapp) previousData.whatsapp = targetPlace.whatsapp;
    }

    if (hours.trim() && hours.trim() !== (targetPlace?.hours || '').trim()) {
      payload.hours = hours.trim();
      if (targetPlace?.hours) previousData.hours = targetPlace.hours;
    }

    if (address.trim() && address.trim() !== (targetPlace?.address || '').trim()) {
      payload.address = address.trim();
      if (targetPlace?.address) previousData.address = targetPlace.address;
    }

    if (area.trim() && area.trim() !== (targetPlace?.area || '').trim()) {
      payload.area = area.trim();
      if (targetPlace?.area) previousData.area = targetPlace.area;
    }

    if (reason.trim()) {
      payload.reason = reason.trim();
    }

    if (Object.keys(payload).length === 0) {
      showToast('يرجى تعديل حقل واحد على الأقل أو كتابة ملاحظة بالتغيير المطلوب', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'report_edit',
        targetPlaceId: targetPlace?.id,
        title: targetPlace ? `تحديث بيانات: ${targetPlace.name}` : 'بلاغ تحديث بيانات مكان',
        submitterName: submitterName.trim(),
        submitterPhone: submitterPhoneCheck.displayLocal,
        payload,
        previousData: Object.keys(previousData).length > 0 ? previousData : undefined,
      });
      showToast('شكراً لمساهمتك! تم إرسال طلب التحديث للمراجعة', 'success');
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال البلاغ حالياً، حاول مرة أخرى',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="تحديث بيانات أو الإبلاغ عن خطأ"
      subtitle={targetPlace ? targetPlace.name : 'ساهم في دقة بيانات دليل أبوحمص'}
      backTo={targetPlace ? getPlaceDetailRoute(targetPlace) : '/more'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-[#e6f4ec] border border-[#b7e2c8] rounded-3xl p-4 text-xs text-[#003820] leading-relaxed">
            عدّل فقط الحقول التي تغيّرت أو تحتوي على خطأ، وسيقوم فريق الدليل بالتحقق وتطبيقها
            فوراً لضمان دقة البيانات لأهالي أبوحمص.
          </div>
        </FadeInUp>

        <FadeInUp delay={0.05}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">البيانات المقترح تعديلها</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#404942]">رقم الهاتف الصحيح</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#404942]">رقم الواتساب الصحيح</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#404942]">مواعيد العمل الصحيحة</label>
              <input
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#404942]">المنطقة / القرية</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                >
                  <option value="">اختر المنطقة...</option>
                  {areasList.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#404942]">العنوان الدقيق</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#404942]">
                تفاصيل أو سبب التعديل (مثال: تم نقل العيادة / الرقم تغير / المكان أغلق)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب أي تفاصيل تساعد فريق المراجعة..."
                className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.09}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">بياناتك للتواصل والمتابعة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="اسمك الكريم *"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={submitterPhone}
                onChange={(e) => setSubmitterPhone(e.target.value)}
                placeholder="رقم هاتفك *"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
          </div>
        </FadeInUp>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[52px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl shadow-civic-2 disabled:opacity-60"
        >
          {submitting ? 'جارٍ إرسال البلاغ...' : 'إرسال طلب التحديث للمراجعة'}
        </button>
      </form>
    </StackLayout>
  );
};

// ============================================================================
// 8. AdvertisePage (/advertise)
// ============================================================================
export const AdvertisePage: React.FC = () => {
  const { settings, createSubmission, showToast } = useApp();
  const navigate = useNavigate();
  usePageSeo('أعلن معنا في دليل أبوحمص', 'باقات الترويج والبنرات المميزة وتوثيق الأنشطة التجارية في مركز ومدينة أبوحمص.');

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const packages = [
    {
      id: 'homepage-banner',
      title: 'بنر الواجهة الرئيسية',
      desc: 'ظهور مميز في صدارة التطبيق مع زر انتقال مباشر لصفحة نشاطك أو عرضك.',
    },
    {
      id: 'verified-featured',
      title: 'توثيق وتثبيت النشاط',
      desc: 'شارة توثيق زرقاء وظهور في مقدمة نتائج القسم والبحث الشامل.',
    },
    {
      id: 'offers-campaign',
      title: 'حملة تخفيضات وكوبون',
      desc: 'نشر عرضك في قسم التخفيضات والصفحة الرئيسية لجذب عملاء جدد فوراً.',
    },
  ];

  const [selectedPkg, setSelectedPkg] = useState(packages[0].title);
  const [businessName, setBusinessName] = useState('');
  const [submitterName, setSubmitterName] = useState(savedProfile.name || '');
  const [submitterPhone, setSubmitterPhone] = useState(savedProfile.phone || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (businessName.trim().length < 2 || submitterName.trim().length < 2) {
      showToast('يرجى إدخال اسم النشاط واسمك بشكل صحيح', 'error');
      return;
    }
    const phoneCheck = validateEgyptPhone(submitterPhone, { allowLandline: true });
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'رقم الهاتف غير صالح', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'advertise',
        title: `طلب إعلان: ${businessName.trim()} (${selectedPkg})`,
        submitterName: submitterName.trim(),
        submitterPhone: phoneCheck.displayLocal,
        payload: {
          businessName: businessName.trim(),
          packageName: selectedPkg,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      showToast('تم استلام طلب الإعلان بنجاح وسنتواصل معك قريباً', 'success');
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال طلب الإعلان حالياً',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="أعلن معنا في دليل أبوحمص"
      subtitle="وصل نشاطك لآلاف الأهالي في بندر وقرى أبوحمص يومياً"
      backTo="/more"
    >
      <div className="space-y-5">
        <FadeInUp delay={0.02}>
          <div className="bg-gradient-to-l from-[#003820] to-[#0f5132] text-white rounded-3xl p-5 shadow-civic-2 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffe088]">
              <Sparkles size={15} />
              <span>التسجيل الأساسي في الدليل مجاني 100%</span>
            </div>
            <h2 className="text-lg font-bold">ضاعف مبيعاتك وعملاءك في أبوحمص</h2>
            <p className="text-xs text-white/85 leading-relaxed">
              اختر الباقة الترويجية المناسبة لنشاطك، وسيقوم فريقنا بالتواصل معك لتجهيز التصميم
              والإطلاق خلال 24 ساعة.
            </p>
          </div>
        </FadeInUp>

        {/* Packages Selection */}
        <FadeInUp delay={0.05}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const active = selectedPkg === pkg.title;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPkg(pkg.title)}
                  className={`text-right p-4 rounded-3xl border transition-all ${
                    active
                      ? 'bg-[#e6f4ec] border-[#0f5132] shadow-civic-1'
                      : 'bg-white border-[#e4ece7] hover:border-[#0f5132]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Award size={18} className={active ? 'text-[#003820]' : 'text-[#707971]'} />
                    {active && <CheckCircle2 size={16} className="text-[#0f5132]" />}
                  </div>
                  <p className="text-sm font-bold text-[#181c1c]">{pkg.title}</p>
                  <p className="text-xs text-[#404942] mt-1 leading-relaxed">{pkg.desc}</p>
                </button>
              );
            })}
          </div>
        </FadeInUp>

        {/* Inquiry Form */}
        <FadeInUp delay={0.08}>
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5"
          >
            <h3 className="text-sm font-bold text-[#003820]">بيانات طلب الإعلان</h3>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="اسم المحل أو العيادة أو الشركة *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="اسم المسؤول *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={submitterPhone}
                onChange={(e) => setSubmitterPhone(e.target.value)}
                placeholder="رقم الهاتف / واتساب *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تفاصيل العرض أو المدة المقترحة للإعلان (اختياري)"
              className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[50px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl shadow-civic-2 disabled:opacity-60"
            >
              {submitting ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الإعلان'}
            </button>
          </form>
        </FadeInUp>

        {(settings.supportWhatsapp || settings.supportPhone) && (
          <a
            href={buildWhatsAppUrl(
              settings.supportWhatsapp || settings.supportPhone,
              `السلام عليكم، أرغب في الاستفسار عن باقات الإعلان في دليل أبوحمص (${selectedPkg}).`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] rounded-2xl bg-[#146c43] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-civic-1"
          >
            <MessageCircle size={18} />
            تواصل مباشر مع فريق الإعلانات عبر واتساب
          </a>
        )}
      </div>
    </StackLayout>
  );
};

// ============================================================================
// 9. AboutPage (/about)
// ============================================================================
export const AboutPage: React.FC = () => {
  const { places, activeCategories, settings } = useApp();
  usePageSeo('عن دليل أبوحمص', 'تعرف على مبادرة دليل أبوحمص المجتمعية المستقلة لخدمة أهالي مركز ومدينة أبوحمص وقراها.');

  return (
    <StackLayout title="عن مبادرة دليل أبوحمص" backTo="/more">
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 shadow-civic-1 space-y-4 text-center">
            <img
              src="/logo.png"
              alt="دليل أبوحمص"
              className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-[#e4ece7] shadow-civic-1"
            />
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#003820]">{settings.appName || 'دليل أبوحمص'}</h2>
              <p className="text-xs font-semibold text-[#146c43]">
                الدليل المجتمعي والخدمي الموحد لأهالي مركز ومدينة أبوحمص وقراها
              </p>
            </div>
            <p className="text-sm text-[#404942] leading-relaxed max-w-xl mx-auto">
              {settings.disclaimer}
            </p>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.05}>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#e4ece7] rounded-2xl p-4 text-center shadow-civic-1">
              <p className="text-xl font-bold text-[#003820] tabular-nums">{places.length}</p>
              <p className="text-[11px] text-[#404942] mt-0.5">نشاط وخدمة</p>
            </div>
            <div className="bg-white border border-[#e4ece7] rounded-2xl p-4 text-center shadow-civic-1">
              <p className="text-xl font-bold text-[#003820] tabular-nums">
                {activeCategories.length}
              </p>
              <p className="text-[11px] text-[#404942] mt-0.5">قسم خدمي</p>
            </div>
            <div className="bg-white border border-[#e4ece7] rounded-2xl p-4 text-center shadow-civic-1">
              <p className="text-xl font-bold text-[#003820] tabular-nums">
                {settings.visitsCount.toLocaleString('ar-EG')}
              </p>
              <p className="text-[11px] text-[#404942] mt-0.5">زيارة للدليل</p>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
            <h3 className="text-sm font-bold text-[#003820]">ماذا نقدم لأهالي أبوحمص؟</h3>
            <ul className="space-y-2 text-xs text-[#404942] leading-relaxed">
              <li className="flex items-start gap-2">
                <BadgeCheck size={16} className="text-[#146c43] shrink-0 mt-0.5" />
                <span>حجز أدوار العيادات والأطباء ومتابعة الطابور الحي لحظة بلحظة.</span>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck size={16} className="text-[#146c43] shrink-0 mt-0.5" />
                <span>تصفح منيو مطاعم أبوحمص والطلب المباشر مع توصيل فوري للبندر والقرى.</span>
              </li>
              <li className="flex items-start gap-2">
                <BadgeCheck size={16} className="text-[#146c43] shrink-0 mt-0.5" />
                <span>دليل موثق للحرفيين والمكافحين والعقارات والصيدليات الليلية والطوارئ 24 ساعة.</span>
              </li>
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <Link
                to="/places/suggest"
                className="min-h-[44px] rounded-2xl bg-[#003820] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <PlusCircle size={15} />
                أضف نشاطك مجاناً
              </Link>
              <Link
                to="/contact"
                className="min-h-[44px] rounded-2xl bg-[#e6f4ec] text-[#003820] text-xs font-bold flex items-center justify-center gap-2"
              >
                <Phone size={15} />
                تواصل مع الإدارة
              </Link>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

// ============================================================================
// 10. PrivacyPage (/privacy)
// ============================================================================
export const PrivacyPage: React.FC = () => {
  const { settings } = useApp();
  usePageSeo('سياسة الخصوصية وإخلاء المسؤولية', 'كيف نحمي خصوصية بياناتك في تطبيق دليل أبوحمص.');

  return (
    <StackLayout title="سياسة الخصوصية وإخلاء المسؤولية" backTo="/more">
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4 text-xs sm:text-sm text-[#404942] leading-relaxed">
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-[#003820] flex items-center gap-2">
                <ShieldCheck size={17} className="text-[#146c43]" />
                استخدام بدون إنشاء حساب
              </h2>
              <p>
                لا يتطلب تصفح «دليل أبوحمص» إنشاء حساب أو تسجيل دخول للمواطنين. تُحفظ قائمة المفضلة
                وبيانات التعبئة السريعة وسجل نشاطك محلياً على جهازك فقط (LocalStorage) ويمكنك مسحها
                في أي وقت من صفحة «طلباتي وحجوزاتي».
              </p>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-[#003820]">استخدام أرقام الهواتف والطلبات</h2>
              <p>
                تُستخدم أرقام الهواتف والبيانات التي تدخلها عند حجز عيادة أو طلب مطعم أو مشوار
                دليفري أو اقتراح إضافة نشاط حصرياً لتنفيذ الخدمة المطلوبة والتواصل معك بشأنها، ولا
                يتم بيعها أو مشاركتها مع أي أطراف إعلانية خارجية.
              </p>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-[#003820]">الصور المرفوعة ومراجعة البيانات</h2>
              <p>
                عند رفع صورة لنشاط أو مينيو عبر نموذج الإضافة، يتم ضغطها تلقائياً على جهازك بصيغة
                WebP وحفظ رابطها الآمن لمراجعتها وعرضها ضمن ملف النشاط في الدليل بعد الاعتماد.
              </p>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-[#003820]">إخلاء المسؤولية</h2>
              <p>{settings.disclaimer}</p>
              <p>
                في حال وجود أي خطأ في رقم هاتف أو عنوان أو رغبة صاحب نشاط في تعديل أو إزالة بياناته،
                يمكن تقديم طلب فوري عبر زر «الإبلاغ عن خطأ» داخل صفحة المكان أو التواصل معنا مباشرة.
              </p>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

// ============================================================================
// 11. ContactPWAPage (/contact)
// ============================================================================
export const ContactPWAPage: React.FC = () => {
  const { settings } = useApp();
  usePageSeo('تواصل معنا وتثبيت التطبيق', 'طرق التواصل مع إدارة دليل أبوحمص وتثبيت التطبيق على هاتفك.');

  return (
    <StackLayout title="تواصل معنا وتثبيت التطبيق" backTo="/more">
      <div className="space-y-5">
        <FadeInUp delay={0.02}>
          <PWAInstallButton variant="card" />
        </FadeInUp>

        <FadeInUp delay={0.05}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <h2 className="text-sm font-bold text-[#003820]">تواصل مع فريق دليل أبوحمص</h2>
            <p className="text-xs text-[#404942] leading-relaxed">
              نرحب بمقترحات أهالي أبوحمص وملاحظات أصحاب العيادات والمطاعم والمحلات لتحسين الدليل
              بشكل مستمر.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settings.supportPhone && (
                <a
                  href={`tel:${settings.supportPhone}`}
                  className="min-h-[48px] px-4 rounded-2xl bg-[#e6f4ec] text-[#003820] text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Phone size={17} />
                  <span dir="ltr">{settings.supportPhone}</span>
                </a>
              )}
              {(settings.supportWhatsapp || settings.supportPhone) && (
                <a
                  href={buildWhatsAppUrl(
                    settings.supportWhatsapp || settings.supportPhone,
                    'السلام عليكم إدارة دليل أبوحمص، أود التواصل معكم بخصوص:'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] px-4 rounded-2xl bg-[#146c43] text-white text-sm font-bold flex items-center justify-center gap-2"
                >
                  <MessageCircle size={17} />
                  تواصل عبر واتساب
                </a>
              )}
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-2.5">
            <h3 className="text-sm font-bold text-[#003820]">روابط سريعة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                to="/places/suggest"
                className="min-h-[44px] px-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] text-xs font-bold text-[#003820] flex items-center justify-between"
              >
                <span>إضافة نشاط جديد مجاناً</span>
                <ChevronLeft size={16} />
              </Link>
              <Link
                to="/advertise"
                className="min-h-[44px] px-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] text-xs font-bold text-[#003820] flex items-center justify-between"
              >
                <span>طلب إعلان تجاري</span>
                <ChevronLeft size={16} />
              </Link>
              <Link
                to="/track"
                className="min-h-[44px] px-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] text-xs font-bold text-[#003820] flex items-center justify-between"
              >
                <span>متابعة حالة طلب سابق</span>
                <ChevronLeft size={16} />
              </Link>
              <Link
                to="/about"
                className="min-h-[44px] px-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] text-xs font-bold text-[#003820] flex items-center justify-between"
              >
                <span>عن مبادرة دليل أبوحمص</span>
                <ChevronLeft size={16} />
              </Link>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};