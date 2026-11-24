import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  BadgeCheck,
  Bike,
  CheckCircle2,
  Clock,
  Droplets,
  Hammer,
  HeartHandshake,
  Hospital,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Pill,
  ShieldAlert,
  Star,
  Wrench,
} from 'lucide-react';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { CivicImage, QRCodeCard, StackLayout } from '../../components/SharedUI';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import {
  isPlaceSubscribedToFilter,
  PlacePromoBadges,
  PromoFilterChipsBar,
  sortPlacesByPromoPriority,
} from '../../lib/promoFilters';
import { ABU_HOMS_AREAS } from '../../data/seedData';
import { buildWhatsAppUrl, validateEgyptPhone } from '../../lib/formatters';
import { readCitizenProfile } from '../../lib/citizenProfile';
import { usePageSeo } from '../../lib/shareCard';
import type { DeliveryRide } from '../../types';

export const HeroesListPage: React.FC = () => {
  const { places, activePromoFilters } = useApp();
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'carpentry' | 'beauty'>('all');

  const baseHeroes = useMemo(() => places.filter((p) => p.categorySlug === 'heroes'), [places]);

  const heroes = useMemo(() => {
    let list = selectedPromoId
      ? baseHeroes.filter((h) => isPlaceSubscribedToFilter(h, selectedPromoId))
      : [...baseHeroes];
    if (filter === 'carpentry') list = list.filter((h) => (h.specialty || '').includes('نجار'));
    if (filter === 'beauty')
      list = list.filter((h) => (h.specialty || '').includes('تجميل') || (h.specialty || '').includes('ميكب'));
    return sortPlacesByPromoPriority(list, activePromoFilters);
  }, [baseHeroes, selectedPromoId, filter, activePromoFilters]);

  return (
    <StackLayout
      title="قسم المكافحين والمكافحات"
      subtitle="أبطال المهن الحرة والمشاريع المنزلية بأبوحمص"
      backTo="/home"
    >
      <div className="space-y-5">
        {/* Initiative Hero Banner */}
        <FadeInUp delay={0.02}>
          <div className="bg-gradient-to-bl from-[#003820] to-[#0f5132] text-white rounded-3xl p-5 sm:p-6 shadow-civic-2 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#9ff1bd] flex items-center gap-1.5">
                <HeartHandshake size={15} />
                مبادرة التكافل والرزق الحلال · دعم 100% بدون عمولات
              </p>
              <h2 className="text-xl sm:text-2xl font-bold">أيد شقيانة تبني وتنتج..</h2>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                دعمك ليهم بيفرق في بيوت كتير بأبوحمص وعزبها — نوصّلك بأهل الأمانة والصنعة مباشرة بدون أي وسيط.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 text-center tabular-nums">
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-bold text-[#ffe088]">{baseHeroes.length}</p>
                <p className="text-[11px] text-white/80">حرفي ومشروع</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-bold text-[#9ff1bd]">0%</p>
                <p className="text-[11px] text-white/80">عمولة وسيط</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-3">
                <p className="text-lg font-bold text-white">100%</p>
                <p className="text-[11px] text-white/80">تقييم محلي</p>
              </div>
            </div>
            <Link
              to="/places/suggest?type=hero"
              className="w-full min-h-[48px] bg-[#9ff1bd] text-[#003820] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              سجّل كحرفي أو مشروع منزلي (مجاناً تماماً)
            </Link>
          </div>
        </FadeInUp>

        {/* Dynamic Admin Promo Filters */}
        <PromoFilterChipsBar
          promoFilters={activePromoFilters}
          selectedFilterId={selectedPromoId}
          onSelect={setSelectedPromoId}
          placesPool={baseHeroes}
          allLabel="كل الحرفيين"
        />

        {/* Specialty Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'carpentry', label: 'نجارة وأثاث' },
            { id: 'beauty', label: 'تجميل ومشاريع منزلية' },
          ].map((t) => (
            <AnimatedFilterChip
              key={t.id}
              onClick={() => setFilter(t.id as typeof filter)}
              className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === t.id ? 'bg-[#003820] text-white' : 'bg-white border border-[#e4ece7] text-[#404942]'
              }`}
            >
              {t.label}
            </AnimatedFilterChip>
          ))}
        </div>

        {/* Hero Cards */}
        {heroes.length === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
            <Hammer size={30} className="mx-auto text-[#707971]" />
            <h3 className="text-sm font-bold text-[#181c1c]">لا يوجد حرفيون مطابقون للتصفية الحالية</h3>
            <p className="text-xs text-[#404942]">اختر «الكل» لعرض جميع الحرفيين والمشاريع المنزلية المسجلة.</p>
          </AnimatedEmptyState>
        ) : (
        <AnimatedListContainer className="space-y-3.5">
          {heroes.map((hero, idx) => (
            <AnimatedListItem key={hero.id} index={idx}>
              <Link
                to={`/heroes/${hero.id}`}
                className="block bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 hover:border-[#0f5132]/40 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                    <CivicImage src={hero.imageUrl} alt={hero.name} className="w-full h-full" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <PlacePromoBadges place={hero} promoFilters={activePromoFilters} maxBadges={2} />
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-[#181c1c] truncate">{hero.name}</h3>
                      {hero.verified && <BadgeCheck size={16} className="text-[#cca730] shrink-0" />}
                    </div>
                    <p className="text-xs font-medium text-[#146c43]">{hero.specialty}</p>
                    <p className="text-xs text-[#404942] flex items-center gap-1">
                      <MapPin size={13} className="shrink-0" />
                      <span className="truncate">{hero.area}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs pt-1 tabular-nums">
                      {typeof hero.rating === 'number' && hero.rating > 0 && (
                        <span className="font-bold text-[#735c00] inline-flex items-center gap-1">
                          <Star size={13} className="fill-[#cca730] text-[#cca730]" />
                          {hero.rating}
                          {typeof hero.reviewCount === 'number' && hero.reviewCount > 0
                            ? ` (${hero.reviewCount} تقييم)`
                            : ''}
                        </span>
                      )}
                      {typeof hero.experienceYears === 'number' && hero.experienceYears > 0 && (
                        <span className="text-[#404942]">خبرة {hero.experienceYears} سنة</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </AnimatedListItem>
          ))}
        </AnimatedListContainer>
        )}
      </div>
    </StackLayout>
  );
};

export const HeroProfilePage: React.FC = () => {
  const { heroId } = useParams();
  const { places, createSubmission, logAnalyticsEvent, showToast } = useApp();
  const navigate = useNavigate();

  const prefersReduced = useReducedMotion();
  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const hero = places.find((p) => p.id === heroId);
  usePageSeo(
    hero?.name,
    hero ? `${hero.specialty || 'حرفي ومشروع منزلي'} في ${hero.area} — ${hero.address}` : undefined
  );
  const [showRequest, setShowRequest] = useState(false);
  const [name, setName] = useState(savedProfile.name || '');
  const [phone, setPhone] = useState(savedProfile.phone || '');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  if (!hero) {
    return (
      <StackLayout title="ملف المكافح" backTo="/heroes">
        <div className="bg-white rounded-3xl p-8 text-center">لم يتم العثور على الملف المطلوب.</div>
      </StackLayout>
    );
  }

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      showToast('يرجى إدخال اسمك بشكل صحيح (حرفين على الأقل)', 'error');
      return;
    }
    const phoneCheck = validateEgyptPhone(phone, { allowLandline: true });
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'يرجى إدخال رقم هاتف مصري صحيح', 'error');
      return;
    }
    setSending(true);
    try {
      const sub = await createSubmission({
        type: 'hero_inquiry',
        targetPlaceId: hero.id,
        title: `طلب معاينة/تواصل مع ${hero.name}`,
        submitterName: name,
        submitterPhone: phoneCheck.displayLocal,
        payload: { heroName: hero.name, details },
      });
      setShowRequest(false);
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال الطلب حالياً، يرجى المحاولة مرة أخرى',
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <StackLayout title={hero.name} subtitle="قسم المكافحين والمكافحات" backTo="/heroes">
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex items-start gap-4">
              <CivicImage src={hero.imageUrl} alt={hero.name} className="w-24 h-24 rounded-2xl shrink-0" />
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-[#181c1c] truncate">{hero.name}</h2>
                  {hero.verified && <BadgeCheck size={17} className="text-[#cca730] shrink-0" />}
                </div>
                <p className="text-xs font-medium text-[#146c43]">{hero.specialty}</p>
                <p className="text-xs text-[#404942]">{hero.address}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs pt-1 tabular-nums">
                  {typeof hero.rating === 'number' && hero.rating > 0 && (
                    <span className="font-bold text-[#735c00] inline-flex items-center gap-1">
                      <Star size={13} className="fill-[#cca730] text-[#cca730]" />
                      {hero.rating}
                      {typeof hero.reviewCount === 'number' && hero.reviewCount > 0
                        ? ` (${hero.reviewCount} تقييم)`
                        : ''}
                    </span>
                  )}
                  {typeof hero.experienceYears === 'number' && hero.experienceYears > 0 && (
                    <span>خبرة {hero.experienceYears} سنة</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[#e6f4ec] rounded-2xl px-4 py-2.5 text-xs font-bold text-[#003820]">
              مبادرة مكافحي أبوحمص · تواصل مباشر بدون عمولة 100%
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`tel:${hero.phone}`}
                onClick={() =>
                  void logAnalyticsEvent({ eventType: 'call_click', targetId: hero.id, targetName: hero.name })
                }
                className="min-h-[48px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95"
              >
                <Phone size={16} />
                اتصال مباشر
              </a>
              <a
                href={buildWhatsAppUrl(hero.whatsapp || hero.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] bg-[#146c43] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95"
              >
                <MessageCircle size={16} />
                محادثة واتساب
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowRequest((s) => !s)}
              className="w-full min-h-[46px] bg-[#f1f4f2] text-[#003820] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Wrench size={15} />
              طلب معاينة ورفع مقاسات / حجز موعد مجاناً
            </button>

            <AnimatePresence initial={false}>
              {showRequest && (
                <motion.form
                  onSubmit={handleInspectionSubmit}
                  initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: prefersReduced ? 0.1 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-3"
                >
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك الكريم"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#d7dbd9] text-sm"
                  />
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="رقم هاتفك للتواصل"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-[#d7dbd9] text-sm text-right"
                  />
                  <textarea
                    rows={2}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="صف المطلوب باختصار ومنطقتك بأبوحمص..."
                    className="w-full p-3 rounded-xl bg-white border border-[#d7dbd9] text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-xl"
                  >
                    {sending ? 'جارٍ الإرسال...' : 'إرسال الطلب واستلام كود المتابعة'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </FadeInUp>

        {/* About & Services */}
        <FadeInUp delay={0.07}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
            <h3 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
              <Hammer size={16} className="text-[#0f5132]" />
              نبذة عن الصنعة والأمانة
            </h3>
            <p className="text-sm text-[#404942] leading-relaxed">{hero.description}</p>
          </div>
        </FadeInUp>

        {hero.services && hero.services.length > 0 && (
          <FadeInUp delay={0.11}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
              <h3 className="text-sm font-bold text-[#181c1c]">الخدمات التخصصية والتقدير</h3>
              <div className="divide-y divide-[#e4ece7]">
                {hero.services.map((s, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{s.name}</p>
                      <p className="text-xs text-[#404942]">{s.description}</p>
                    </div>
                    <span className="text-xs font-bold text-[#0f5132] whitespace-nowrap">{s.priceLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeInUp>
        )}

        {/* Work Gallery */}
        {hero.gallery && hero.gallery.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#181c1c]">معرض أعمال حية</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {hero.gallery.map((g, idx) => (
                <FadeInUp key={idx} index={idx}>
                  <div className="bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1 h-full">
                    <CivicImage src={g.imageUrl} alt={g.title} className="w-full h-44" />
                    <div className="p-4 space-y-1">
                      <p className="text-[11px] font-bold text-[#146c43]">{g.tag}</p>
                      <h4 className="text-sm font-bold text-[#181c1c]">{g.title}</h4>
                      <p className="text-xs text-[#404942] leading-relaxed">{g.subtitle}</p>
                    </div>
                  </div>
                </FadeInUp>
              ))}
            </div>
          </div>
        )}

        <FadeInUp delay={0.14}>
          <QRCodeCard
            title={hero.name}
            code={hero.qrCode || `ABH-HERO-${hero.id.toUpperCase()}`}
            shareUrl={`${window.location.origin}/heroes/${hero.id}`}
            phone={hero.phone}
            area={hero.area}
            specialty={hero.specialty}
          />
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

export const DeliveryRequestPage: React.FC = () => {
  const { createDeliveryRide, showToast } = useApp();
  const navigate = useNavigate();

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const [pickupArea, setPickupArea] = useState(
    savedProfile.area && ABU_HOMS_AREAS.includes(savedProfile.area) ? savedProfile.area : ABU_HOMS_AREAS[0]
  );
  const [pickupDetails, setPickupDetails] = useState('');
  const [dropoffArea, setDropoffArea] = useState(ABU_HOMS_AREAS[2]);
  const [dropoffDetails, setDropoffDetails] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [customerName, setCustomerName] = useState(savedProfile.name || '');
  const [customerPhone, setCustomerPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const estimatedFee =
    pickupArea.includes('قرية') || dropoffArea.includes('قرية') ? 30 : 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemDescription.trim().length < 2 || customerName.trim().length < 2) {
      showToast('يرجى استكمال تفاصيل المشوار والاسم بشكل صحيح', 'error');
      return;
    }
    const phoneCheck = validateEgyptPhone(customerPhone, { allowLandline: false });
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'يرجى إدخال رقم موبايل مصري صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const ride = await createDeliveryRide({
        pickupArea,
        pickupDetails,
        dropoffArea,
        dropoffDetails,
        itemDescription,
        customerName,
        customerPhone: phoneCheck.displayLocal,
        estimatedFee,
      });
      navigate(`/delivery/tracking/${ride.id}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال طلب التوصيل حالياً، يرجى المحاولة مرة أخرى',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="الدليفري الموحد والمشاوير"
      subtitle="توصيل طلبات وأغراض داخل بندر أبوحمص وكافة القرى"
      backTo="/home"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-[#003820] text-white rounded-3xl p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-[#9ff1bd] font-semibold">كباتن معتمدون من أبناء المركز</p>
              <h2 className="text-lg font-bold">توصيل آمن وسريع في دقائق</h2>
            </div>
            <div className="bg-white/12 rounded-2xl px-4 py-2.5 text-center tabular-nums shrink-0">
              <p className="text-[11px] text-white/75">التكلفة التقديرية</p>
              <p className="text-lg font-bold text-[#ffe088]">{estimatedFee} ج.م</p>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.07}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">نقطة الاستلام (من)</label>
                <select
                  value={pickupArea}
                  onChange={(e) => setPickupArea(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                >
                  {ABU_HOMS_AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={pickupDetails}
                  onChange={(e) => setPickupDetails(e.target.value)}
                  placeholder="اسم المحل أو أقرب علامة للاستلام"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold">نقطة التسليم (إلى)</label>
                <select
                  value={dropoffArea}
                  onChange={(e) => setDropoffArea(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                >
                  {ABU_HOMS_AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={dropoffDetails}
                  onChange={(e) => setDropoffDetails(e.target.value)}
                  placeholder="العنوان الدقيق أو رقم العمارة"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">ماذا نوصّل لك؟ *</label>
              <textarea
                required
                rows={2}
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="مثال: أدوية من صيدلية الأمل، أو طرد أوراق، أو مشتريات سوبر ماركت..."
                className="w-full p-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">اسمك الكريم *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="الاسم"
                  className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full min-h-[46px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right tabular-nums"
                />
              </div>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.12}>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl shadow-civic-2 active:scale-95 transition-transform"
          >
            {submitting ? 'جارٍ إرسال الطلب لكباتن أبوحمص...' : `تأكيد طلب الدليفري (${estimatedFee} ج.م)`}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

export const DeliveryTrackingPage: React.FC = () => {
  const { rideId } = useParams();
  const [ride, setRide] = useState<DeliveryRide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rideId) return;
    const unsub = onSnapshot(
      doc(db, 'delivery_rides', rideId),
      (snap) => {
        if (snap.exists()) setRide({ ...(snap.data() as DeliveryRide), id: snap.id });
        else setRide(null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [rideId]);

  const stages: Array<{ key: DeliveryRide['status']; label: string }> = [
    { key: 'pending', label: 'جاري إسناد المشوار لأقرب كابتن' },
    { key: 'accepted', label: 'قبل الكابتن المشوار ويتوجه للاستلام' },
    { key: 'picked_up', label: 'تم استلام الغرض بنجاح' },
    { key: 'on_the_way', label: 'الكابتن في الطريق إلى نقطة التسليم' },
    { key: 'delivered', label: 'تم التسليم بنجاح' },
  ];

  const orderMap: Record<DeliveryRide['status'], number> = {
    pending: 0,
    accepted: 1,
    picked_up: 2,
    on_the_way: 3,
    delivered: 4,
    cancelled: -1,
  };

  if (loading) {
    return (
      <StackLayout title="تتبع مسار كابتن الدليفري" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center text-sm text-[#404942]">
          جارٍ تحميل حالة المشوار الحية...
        </div>
      </StackLayout>
    );
  }

  if (!ride) {
    return (
      <StackLayout title="تتبع مسار كابتن الدليفري" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center space-y-3">
          <h3 className="font-bold">لم يتم العثور على هذا المشوار</h3>
          <Link to="/delivery" className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#0f5132] text-white text-xs font-bold">
            طلب مشوار جديد
          </Link>
        </div>
      </StackLayout>
    );
  }

  const activeIdx = orderMap[ride.status];

  return (
    <StackLayout title="تتبع مسار كابتن الدليفري" subtitle={`كود المشوار: ${ride.rideCode}`} backTo="/home">
      <div className="space-y-4 max-w-lg mx-auto">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
                  <Bike size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#146c43]">متابعة حية للمشوار</p>
                  <h2 className="text-base font-bold text-[#003820]">
                    {ride.status === 'cancelled'
                      ? 'تم إلغاء المشوار'
                      : stages[Math.max(0, activeIdx)]?.label}
                  </h2>
                </div>
              </div>
              <span className="font-bold text-sm text-[#003820] tabular-nums">{ride.estimatedFee ?? 20} ج.م</span>
            </div>

            <div className="space-y-2.5 pt-2">
              {stages.map((st, idx) => {
                const reached = activeIdx >= idx;
                return (
                  <div key={st.key} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        reached ? 'bg-[#0f5132] text-white' : 'bg-[#f1f4f2] text-[#707971]'
                      }`}
                    >
                      {reached ? <CheckCircle2 size={15} /> : idx + 1}
                    </div>
                    <span className={`text-xs sm:text-sm ${reached ? 'font-bold text-[#003820]' : 'text-[#707971]'}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeInUp>

        {ride.captainName && (
          <FadeInUp delay={0.07}>
            <div className="bg-[#003820] text-white rounded-3xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9ff1bd]">الكابتن المسؤول عن مشوارك</p>
                <p className="text-base font-bold">{ride.captainName}</p>
              </div>
              {ride.captainPhone && (
                <a
                  href={`tel:${ride.captainPhone}`}
                  className="min-h-[44px] px-4 rounded-2xl bg-[#9ff1bd] text-[#003820] text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Phone size={15} />
                  اتصال بالكابتن
                </a>
              )}
            </div>
          </FadeInUp>
        )}

        <FadeInUp delay={0.11}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 space-y-2.5 text-xs text-[#404942]">
            <p className="flex items-center gap-2">
              <MapPin size={15} className="text-[#0f5132]" />
              <span><strong>من:</strong> {ride.pickupArea} {ride.pickupDetails ? `— ${ride.pickupDetails}` : ''}</span>
            </p>
            <p className="flex items-center gap-2">
              <MapPin size={15} className="text-[#ba1a1a]" />
              <span><strong>إلى:</strong> {ride.dropoffArea} {ride.dropoffDetails ? `— ${ride.dropoffDetails}` : ''}</span>
            </p>
            <p className="flex items-center gap-2">
              <Package size={15} className="text-[#735c00]" />
              <span><strong>التفاصيل:</strong> {ride.itemDescription}</span>
            </p>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

export const EmergencyPage: React.FC = () => {
  const { emergencyContacts } = useApp();

  const hotlines = emergencyContacts.filter((e) => e.type === 'hotline');
  const medicalAndPharmacies = emergencyContacts.filter((e) => e.type !== 'hotline');

  return (
    <StackLayout
      title="طوارئ وسند 24 ساعة"
      subtitle="أرقام النجدة والإسعاف وصيدليات النوبتجية بأبوحمص"
      backTo="/home"
    >
      <div className="space-y-6">
        <FadeInUp delay={0.02}>
          <div className="bg-[#ba1a1a] text-white rounded-3xl p-5 shadow-civic-2 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <h2 className="text-base font-bold">اتصال طارئ فوري بلمسة واحدة</h2>
              <p className="text-xs text-white/85 mt-0.5">
                هذه الأرقام متاحة على مدار 24 ساعة لخدمة أهالي مركز ومدينة أبوحمص وكافة القرى.
              </p>
            </div>
          </div>
        </FadeInUp>

        {/* Short Hotlines Grid */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#181c1c]">أرقام الطوارئ والمرافق السريعة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hotlines.map((item, idx) => (
              <FadeInUp key={item.id} index={idx}>
                <a
                  href={`tel:${item.phone}`}
                  className="bg-white border border-[#ffdad6] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3 hover:border-[#ba1a1a] active:scale-[0.98] transition-all"
                >
                  <div>
                    <h4 className="text-sm font-bold text-[#181c1c]">{item.name}</h4>
                    <p className="text-xs text-[#404942]">{item.statusText || item.area}</p>
                  </div>
                  <span className="min-h-[44px] px-4 rounded-2xl bg-[#ba1a1a] text-white font-bold text-base inline-flex items-center gap-2 tabular-nums">
                    <Phone size={16} />
                    {item.phone}
                  </span>
                </a>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Hospitals, Night Pharmacies & Blood Bank */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#181c1c]">المستشفيات، صيدليات النوبتجية، وبنك الدم</h3>
          <div className="space-y-3">
            {medicalAndPharmacies.map((item, idx) => {
              const Icon =
                item.type === 'pharmacy' ? Pill : item.type === 'blood' ? Droplets : Hospital;
              return (
                <FadeInUp key={item.id} index={idx}>
                  <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center shrink-0">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#181c1c] truncate">{item.name}</h4>
                        <p className="text-xs text-[#146c43] font-medium flex items-center gap-1">
                          <Clock size={12} />
                          {item.statusText}
                        </p>
                        {item.address && <p className="text-xs text-[#707971] truncate">{item.address}</p>}
                      </div>
                    </div>
                    <a
                      href={`tel:${item.phone}`}
                      className="min-h-[44px] px-4 rounded-2xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Phone size={15} />
                      اتصال
                    </a>
                  </div>
                </FadeInUp>
              );
            })}
          </div>
        </section>
      </div>
    </StackLayout>
  );
};
