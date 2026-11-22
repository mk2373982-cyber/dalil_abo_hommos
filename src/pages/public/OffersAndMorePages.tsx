import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  Flag,
  HeartHandshake,
  History,
  Info,
  Megaphone,
  MessageCircle,
  Percent,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { CivicImage, PublicRootLayout, StackLayout } from '../../components/SharedUI';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import { PWAInstallButton } from '../../components/PWAInstallButton';
import { ABU_HOMS_AREAS } from '../../data/seedData';
import { buildWhatsAppUrl, getPlaceDetailRoute, isOfferExpired } from '../../lib/formatters';
import { evaluateOpenStatus } from '../../lib/workingHours';
import { readCitizenProfile } from '../../lib/citizenProfile';
import { usePageSeo } from '../../lib/shareCard';
import type { Submission } from '../../types';

export const OffersListPage: React.FC = () => {
  const { offers } = useApp();
  const [catFilter, setCatFilter] = useState<'all' | 'restaurants' | 'medical'>('all');

  const activeOffers = useMemo(() => {
    return offers.filter((o) => {
      if (isOfferExpired(o)) return false;
      if (catFilter !== 'all' && o.categorySlug !== catFilter) return false;
      return true;
    });
  }, [offers, catFilter]);

  return (
    <PublicRootLayout>
      <div className="space-y-5">
        <FadeInUp delay={0.02}>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#003820]">التخفيضات وكوبونات أبوحمص</h1>
            <p className="text-xs sm:text-sm text-[#404942]">
              خصومات حقيقية وموثقة من مطاعم وعيادات ومحلات مركز ومدينة أبوحمص
            </p>
          </div>
        </FadeInUp>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'كل التخفيضات' },
            { id: 'restaurants', label: 'مطاعم وحلويات' },
            { id: 'medical', label: 'عيادات ومراكز طبية' },
          ].map((tab) => (
            <AnimatedFilterChip
              key={tab.id}
              onClick={() => setCatFilter(tab.id as typeof catFilter)}
              className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                catFilter === tab.id
                  ? 'bg-[#003820] text-white'
                  : 'bg-white border border-[#e4ece7] text-[#404942]'
              }`}
            >
              {tab.label}
            </AnimatedFilterChip>
          ))}
        </div>

        {activeOffers.length === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
            <Percent size={30} className="mx-auto text-[#707971]" />
            <h3 className="text-sm font-bold text-[#181c1c]">لا توجد عروض سارية في هذا التصنيف حالياً</h3>
            <p className="text-xs text-[#404942]">تابعنا باستمرار أو جرّب استعراض «كل التخفيضات».</p>
          </AnimatedEmptyState>
        ) : (
        <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeOffers.map((offer, idx) => {
            const savings = offer.originalPrice ? offer.originalPrice - offer.salePrice : 0;
            return (
              <AnimatedListItem key={offer.id} index={idx}>
                <Link
                  to={`/offers/${offer.id}`}
                  className="bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1 hover:border-[#0f5132]/40 transition-all flex flex-col h-full"
                >
                  <div className="relative h-44 overflow-hidden">
                    <CivicImage src={offer.imageUrl} alt={offer.title} className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                    <span className="absolute top-3 right-3 bg-[#ba1a1a] text-white text-xs font-bold px-3 py-1 rounded-xl tabular-nums">
                      خصم حصري {offer.discountPercent}%
                    </span>
                    <div className="absolute bottom-3 right-3 left-3 text-white">
                      <p className="text-xs text-[#ffe088] font-semibold">{offer.placeName}</p>
                      <h2 className="text-base font-bold line-clamp-1">{offer.title}</h2>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <p className="text-xs text-[#404942] line-clamp-2">{offer.subtitle}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-[#e4ece7] tabular-nums">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-[#003820]">{offer.salePrice} ج.م</span>
                        {offer.originalPrice && (
                          <span className="text-xs text-[#707971] line-through">{offer.originalPrice} ج.م</span>
                        )}
                      </div>
                      {savings > 0 && (
                        <span className="text-xs font-bold text-[#146c43] bg-[#e6f4ec] px-2.5 py-1 rounded-xl">
                          وفّر {savings} ج.م
                        </span>
                      )}
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

export const OfferDetailPage: React.FC = () => {
  const { couponId } = useParams();
  const { offers, places, showToast } = useApp();

  const offer = offers.find((o) => o.id === couponId);
  const merchant = places.find((p) => p.id === offer?.placeId);
  usePageSeo(
    offer?.title,
    offer ? `خصم ${offer.discountPercent}% لدى ${offer.placeName} — كود ${offer.couponCode}` : undefined
  );

  if (!offer) {
    return (
      <StackLayout title="تفاصيل القسيمة والخصم" backTo="/offers">
        <div className="bg-white rounded-3xl p-8 text-center">لم يتم العثور على هذا التخفيض.</div>
      </StackLayout>
    );
  }

  const expired = isOfferExpired(offer);
  const savings = offer.originalPrice ? offer.originalPrice - offer.salePrice : 0;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(offer.couponCode);
      showToast(`تم نسخ الكود «${offer.couponCode}» بنجاح`, 'success');
    } catch {
      showToast(`كود الخصم الخاص بك: ${offer.couponCode}`, 'info');
    }
  };

  return (
    <StackLayout title="تفاصيل القسيمة والخصم" subtitle="تخفيض موثق حصري بأبوحمص" backTo="/offers">
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="relative h-56 rounded-3xl overflow-hidden shadow-civic-1">
            <CivicImage src={offer.imageUrl} alt={offer.title} className="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <span className="absolute top-4 right-4 bg-[#003820] text-[#ffe088] text-xs font-bold px-3.5 py-1.5 rounded-xl">
              خصم حصري {offer.discountPercent}%
            </span>
            <div className="absolute bottom-4 right-4 left-4 text-white">
              <h2 className="text-xl font-bold">{offer.title}</h2>
              <p className="text-xs text-white/85 mt-1">{offer.subtitle}</p>
            </div>
          </div>
        </FadeInUp>

        {/* Price Summary */}
        <FadeInUp delay={0.06}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 flex items-center justify-between gap-4 tabular-nums">
            <div>
              <p className="text-xs text-[#707971]">سعر العرض بعد الخصم</p>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-2xl font-bold text-[#003820]">{offer.salePrice} ج.م</span>
                {offer.originalPrice && (
                  <span className="text-sm text-[#707971] line-through">{offer.originalPrice} ج.م</span>
                )}
              </div>
            </div>
            {savings > 0 && (
              <div className="bg-[#e6f4ec] text-[#003820] rounded-2xl px-4 py-2.5 text-center">
                <p className="text-[11px] font-medium">وفّر للمنزل</p>
                <p className="text-base font-bold">{savings} ج.م</p>
              </div>
            )}
          </div>
        </FadeInUp>

        {/* Coupon Box */}
        <FadeInUp delay={0.1}>
          {expired ? (
            <div className="bg-[#ffdad6] text-[#93000a] rounded-3xl p-5 text-center space-y-2">
              <p className="font-bold">انتهت صلاحية هذا العرض الترويجي</p>
              <p className="text-xs">تصفح بقية تخفيضات اليوم المتاحة في أبوحمص.</p>
            </div>
          ) : (
            <div className="bg-[#003820] text-white rounded-3xl p-5 shadow-civic-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#9ff1bd]">كوبون الخصم الإضافي عند الطلب</p>
                <p className="text-2xl font-bold font-mono tracking-wider mt-1 text-[#ffe088]">
                  {offer.couponCode}
                </p>
                <p className="text-[11px] text-white/75 mt-1">أظهر الكود للكاشير أو أرسله عبر واتساب</p>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="min-h-[46px] px-4 rounded-2xl bg-white text-[#003820] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
              >
                <Copy size={15} />
                نسخ الكود
              </button>
            </div>
          )}
        </FadeInUp>

        {/* Terms */}
        {offer.terms && offer.terms.length > 0 && (
          <FadeInUp delay={0.14}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
              <h3 className="text-sm font-bold text-[#181c1c]">الشروط والأحكام الخاصة بالعرض</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-[#404942]">
                {offer.terms.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-[#146c43] shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeInUp>
        )}

        {/* Merchant Card */}
        {merchant && (() => {
          const merchantStatus = evaluateOpenStatus(
            merchant.hours,
            merchant.openNow,
            undefined,
            merchant.workingSchedule,
            merchant.is24Hours
          );
          return (
          <FadeInUp delay={0.18}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#181c1c]">{merchant.name}</h3>
                  <p className="text-xs text-[#404942]">{merchant.address}</p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-xl shrink-0 ${
                    merchantStatus.state === 'open'
                      ? 'text-[#146c43] bg-[#e6f4ec]'
                      : merchantStatus.state === 'unknown'
                        ? 'text-[#735c00] bg-[#fef3c7]'
                        : 'text-[#707971] bg-[#f1f4f2]'
                  }`}
                >
                  {merchantStatus.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={buildWhatsAppUrl(
                    merchant.whatsapp || merchant.phone,
                    `أرغب في الاستفادة من عرض «${offer.title}» بكود الخصم ${offer.couponCode} عبر دليل أبوحمص`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <MessageCircle size={15} />
                  طلب عبر واتساب
                </a>
                <a
                  href={`tel:${merchant.phone}`}
                  className="min-h-[46px] bg-[#f1f4f2] text-[#003820] text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <Phone size={15} />
                  اتصال هاتفي
                </a>
              </div>
            </div>
          </FadeInUp>
          );
        })()}
      </div>
    </StackLayout>
  );
};

export const MorePage: React.FC = () => {
  const { favorites } = useApp();

  // Strictly NO Admin Portal link on public More screen per v3.1!
  const links = [
    { to: '/my-activity', label: 'طلباتي وحجوزاتي وبياناتي السريعة', sub: 'سجل العيادات والمطاعم والدليفري وتعبئة النماذج تلقائياً', icon: History },
    { to: '/favorites', label: 'الأماكن المفضلة والمحفوظات', sub: `${favorites.length} عنصر محفوظ على جهازك`, icon: Bookmark },
    { to: '/places/suggest', label: 'اقتراح وإضافة مكان جديد', sub: 'إدراج مجاني 100% لأهالي وأنشطة أبوحمص', icon: PlusCircle },
    { to: '/places/report/general', label: 'تعديل بيانات مكان أو الإبلاغ', sub: 'تصحيح هاتف، مواعيد، أو بلاغ إغلاق', icon: Flag },
    { to: '/track', label: 'متابعة حالة الطلبات والبلاغات', sub: 'استعلم برمز المتابعة الخاص بك', icon: Search },
    { to: '/advertise', label: 'أعلن معنا والترويج التجاري', sub: 'باقات محلية شفافة ورد خلال 48 ساعة', icon: Megaphone },
    { to: '/about', label: 'عن المبادرة والرسالة المجتمعية', sub: 'مبادرة أهلية مستقلة غير حكومية', icon: HeartHandshake },
    { to: '/privacy', label: 'سياسة الخصوصية والاستخدام', sub: 'ميثاق الحيادية وحماية بيانات المواطنين', icon: ShieldCheck },
    { to: '/contact', label: 'تواصل معنا وتثبيت التطبيق (PWA)', sub: 'الدعم الفني وخطوات التثبيت السريع', icon: Smartphone },
  ];

  return (
    <PublicRootLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        <FadeInUp delay={0.02}>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#003820]">المزيد والمشاركة المجتمعية</h1>
            <p className="text-xs sm:text-sm text-[#404942]">
              ساهم في تحديث دليل بلدنا، احفظ أماكنك المفضلة، وثبّت التطبيق على موبايلك
            </p>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.06}>
          <PWAInstallButton variant="card" />
        </FadeInUp>

        <div className="bg-white border border-[#e4ece7] rounded-3xl divide-y divide-[#e4ece7] shadow-civic-1 overflow-hidden">
          {links.map((item, idx) => {
            const Icon = item.icon;
            return (
              <FadeInUp key={item.to} index={idx} y={12}>
                <Link
                  to={item.to}
                  className="min-h-[68px] px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[#f7faf8] active:bg-[#f1f4f2] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center shrink-0">
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#181c1c] truncate">{item.label}</p>
                      <p className="text-xs text-[#404942] truncate">{item.sub}</p>
                    </div>
                  </div>
                  <ChevronLeft size={18} className="text-[#707971] shrink-0" />
                </Link>
              </FadeInUp>
            );
          })}
        </div>
      </div>
    </PublicRootLayout>
  );
};

export const FavoritesPage: React.FC = () => {
  const { places, favorites, toggleFavorite } = useApp();
  const savedPlaces = places.filter((p) => favorites.includes(p.id));

  return (
    <StackLayout title="الأماكن المفضلة والمحفوظات" subtitle="محفوظة محلياً على جهازك" backTo="/more">
      {savedPlaces.length === 0 ? (
        <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3">
          <Bookmark size={32} className="mx-auto text-[#707971]" />
          <h3 className="text-base font-bold">لا توجد أماكن محفوظة بعد</h3>
          <p className="text-xs text-[#404942]">اضغط على أيقونة الحفظ داخل أي طبيب أو مكان للوصول إليه بسرعة لاحقاً.</p>
          <Link to="/home" className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#003820] text-white text-xs font-bold">
            تصفح الدليل
          </Link>
        </AnimatedEmptyState>
      ) : (
        <AnimatedListContainer className="space-y-3">
          {savedPlaces.map((p, idx) => (
            <AnimatedListItem key={p.id} index={idx}>
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3">
                <Link to={getPlaceDetailRoute(p)} className="flex items-center gap-3 min-w-0 flex-1">
                  <CivicImage src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-2xl shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">{p.name}</h3>
                    <p className="text-xs text-[#404942] truncate">{p.area}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleFavorite(p.id)}
                  className="min-h-[40px] px-3 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs font-bold active:scale-95 transition-transform"
                >
                  إزالة
                </button>
              </div>
            </AnimatedListItem>
          ))}
        </AnimatedListContainer>
      )}
    </StackLayout>
  );
};

export const SuggestPlacePage: React.FC = () => {
  const { activeCategories, createSubmission, showToast } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const [name, setName] = useState('');
  const [categorySlug, setCategorySlug] = useState(
    searchParams.get('type') === 'hero' ? 'heroes' : activeCategories[0]?.slug || 'pharmacies'
  );
  const [area, setArea] = useState(
    savedProfile.area && ABU_HOMS_AREAS.includes(savedProfile.area) ? savedProfile.area : ABU_HOMS_AREAS[0]
  );
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [hours, setHours] = useState('');
  const [submitterName, setSubmitterName] = useState(savedProfile.name || '');
  const [submitterPhone, setSubmitterPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveSubmitterPhone = (submitterPhone || phone).trim();
    if (
      name.trim().length < 2 ||
      address.trim().length < 2 ||
      phone.trim().length < 8 ||
      submitterName.trim().length < 2 ||
      effectiveSubmitterPhone.length < 8
    ) {
      showToast('يرجى استكمال الاسم والعنوان ورقم الهاتف (8 أرقام على الأقل) بشكل صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'suggest_place',
        title: `اقتراح إضافة: ${name.trim()}`,
        submitterName,
        submitterPhone: effectiveSubmitterPhone,
        payload: { name: name.trim(), categorySlug, area, address: address.trim(), phone: phone.trim(), whatsapp: whatsapp.trim(), hours: hours.trim() },
      });
      navigate(`/track/${sub.trackingToken}`);
    } catch {
      showToast('تعذر إرسال الطلب حالياً، يرجى التحقق من البيانات والمحاولة مرة أخرى', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="اقتراح وإضافة مكان جديد"
      subtitle="إدراج الأنشطة مجاني 100% لخدمة أهالي أبوحمص"
      backTo="/more"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-[#e6f4ec] border border-[#b0f1c7] rounded-3xl p-4 text-xs text-[#003820] leading-relaxed">
            <strong>خدمة أهالي أبوحمص (مجاناً 100%):</strong> ساعد جيرانك في الوصول للخدمات بسهولة. يتم مراجعة الطلب خلال أقل من 24 ساعة قبل النشر المباشر.
          </div>
        </FadeInUp>

        <FadeInUp delay={0.06}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <h2 className="text-sm font-bold text-[#003820]">1. بيانات النشاط الأساسية</h2>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المحل أو العيادة أو الخدمة *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              >
                {ABU_HOMS_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.1}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">2. العنوان وأرقام التواصل</h2>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="العنوان الدقيق أو أقرب علامة مميزة *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف للاتصال *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
              <input
                type="tel"
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="رقم الواتساب (اختياري)"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="مواعيد العمل (مثال: يومياً من 9 صباحاً حتى 11 مساءً)"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
          </div>
        </FadeInUp>

        <FadeInUp delay={0.14}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5">
            <h2 className="text-sm font-bold text-[#003820]">3. بياناتك للمتابعة (بدون إنشاء حساب)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="اسمك الكريم *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={submitterPhone}
                onChange={(e) => setSubmitterPhone(e.target.value)}
                placeholder="رقم هاتفك للتأكيد *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.18}>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] bg-[#003820] text-white font-bold text-sm rounded-2xl shadow-civic-2 active:scale-95 transition-transform"
          >
            {submitting ? 'جارٍ إرسال الطلب...' : 'إرسال الطلب للاعتماد مجاناً'}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

export const ReportPlacePage: React.FC = () => {
  const { placeId } = useParams();
  const { places, createSubmission, showToast } = useApp();
  const navigate = useNavigate();

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const place = places.find((p) => p.id === placeId);
  const [newPhone, setNewPhone] = useState(place?.phone || '');
  const [newHours, setNewHours] = useState(place?.hours || '');
  const [reason, setReason] = useState('');
  const [submitterName, setSubmitterName] = useState(savedProfile.name || '');
  const [submitterPhone, setSubmitterPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 2 || submitterName.trim().length < 2 || submitterPhone.trim().length < 8) {
      showToast('يرجى كتابة تفاصيل التعديل واسمك ورقم هاتفك بشكل صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'report_edit',
        targetPlaceId: place?.id,
        title: place ? `تعديل بيانات: ${place.name}` : 'بلاغ تعديل بيانات مكان',
        submitterName,
        submitterPhone,
        previousData: place ? { phone: place.phone, hours: place.hours || '' } : undefined,
        payload: { phone: newPhone, hours: newHours, reason },
      });
      navigate(`/track/${sub.trackingToken}`);
    } catch {
      showToast('تعذر إرسال البلاغ حالياً، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="تعديل بيانات مكان أو الإبلاغ"
      subtitle={place ? place.name : 'ساهم في دقة معلومات دليل أبوحمص'}
      backTo={place ? `/places/${place.id}` : '/more'}
    >
      <FadeInUp delay={0.03}>
        <form onSubmit={handleSubmit} className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
          <input
            type="tel"
            dir="ltr"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="رقم الهاتف الصحيح (إن كان متغيراً)"
            className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
          />
          <input
            type="text"
            value={newHours}
            onChange={(e) => setNewHours(e.target.value)}
            placeholder="مواعيد العمل المحدثة"
            className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
          />
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اذكر التعديل المطلوب أو سبب البلاغ (مثال: المكان أغلق أو تغير عنوانه) *"
            className="w-full p-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder="اسمك الكريم *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <input
              type="tel"
              required
              dir="ltr"
              value={submitterPhone}
              onChange={(e) => setSubmitterPhone(e.target.value)}
              placeholder="رقم هاتفك *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[50px] bg-[#003820] text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform"
          >
            {submitting ? 'جارٍ الإرسال...' : 'إرسال التعديل واستلام رابط المتابعة'}
          </button>
        </form>
      </FadeInUp>
    </StackLayout>
  );
};

export const TrackRequestPage: React.FC = () => {
  const { secureToken } = useParams();
  const navigate = useNavigate();
  const [inputToken, setInputToken] = useState(secureToken || '');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(Boolean(secureToken));
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setInputToken(secureToken || '');
    if (!secureToken) {
      setSubmission(null);
      setLoading(false);
      setNotFound(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    const unsub = onSnapshot(
      doc(db, 'submissions', secureToken),
      (snap) => {
        if (snap.exists()) {
          setSubmission({ ...(snap.data() as Submission), id: snap.id });
          setNotFound(false);
        } else {
          setSubmission(null);
          setNotFound(true);
        }
        setLoading(false);
      },
      () => {
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [secureToken]);

  const getStatusDisplay = (sub: Submission): { label: string; color: string; bg: string } => {
    if (sub.status === 'approved') {
      if (sub.applied || sub.publishedTargetId) {
        return { label: 'تم الاعتماد والتطبيق في الدليل', color: '#0f5132', bg: '#e6f4ec' };
      }
      return { label: 'تمت المراجعة والاعتماد', color: '#0f5132', bg: '#e6f4ec' };
    }
    const map: Record<Exclude<Submission['status'], 'approved'>, { label: string; color: string; bg: string }> = {
      received: { label: 'تم الاستلام بنجاح', color: '#0369a1', bg: '#e0f2fe' },
      reviewing: { label: 'قيد المراجعة والتدقيق', color: '#92400e', bg: '#fef3c7' },
      rejected: { label: 'مرفوض (يرجى مراجعة الملاحظة)', color: '#93000a', bg: '#ffdad6' },
      expired: { label: 'انتهت صلاحية رابط المتابعة', color: '#404942', bg: '#ebefed' },
    };
    return map[sub.status];
  };

  return (
    <StackLayout title="متابعة حالة الطلبات والبلاغات" subtitle="رابط متابعة خاص بدون اشتراط رقم قومي" backTo="/home">
      <div className="space-y-4 max-w-lg mx-auto">
        <FadeInUp delay={0.02}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputToken.trim()) navigate(`/track/${inputToken.trim()}`);
            }}
            className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex gap-2"
          >
            <input
              type="text"
              dir="ltr"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="أدخل رمز المتابعة (مثال: TRK-XXXX-XXXX)"
              className="flex-1 min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right font-mono"
            />
            <button
              type="submit"
              className="min-h-[46px] px-5 rounded-2xl bg-[#003820] text-white text-xs font-bold shrink-0 active:scale-95 transition-transform"
            >
              استعلام
            </button>
          </form>
        </FadeInUp>

        {loading && (
          <AnimatedEmptyState className="bg-white rounded-3xl p-8 text-center text-sm text-[#404942]">
            جارٍ فحص رمز المتابعة...
          </AnimatedEmptyState>
        )}

        {notFound && secureToken && (
          <AnimatedEmptyState className="bg-white border border-[#ffdad6] rounded-3xl p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-[#ba1a1a]" />
            <h3 className="text-base font-bold text-[#93000a]">رابط أو رمز المتابعة غير صحيح</h3>
            <p className="text-xs text-[#404942]">
              تأكد من كتابة الرمز كما وصلك بعد تقديم الطلب، أو تواصل مع فريق الدعم لطلب رابط جديد.
            </p>
            <Link to="/contact" className="inline-flex min-h-[42px] px-5 items-center rounded-xl bg-[#0f5132] text-white text-xs font-bold">
              طلب رابط جديد / الدعم
            </Link>
          </AnimatedEmptyState>
        )}

        {submission && (() => {
          const badge = getStatusDisplay(submission);
          return (
          <FadeInUp delay={0.04}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-[#707971]">رمز المتابعة: {submission.trackingToken}</p>
                  <h2 className="text-base font-bold text-[#181c1c] mt-1">{submission.title}</h2>
                </div>
                <span
                  className="text-xs font-bold px-3 py-1.5 rounded-xl shrink-0"
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              </div>

              {submission.adminNote && (
                <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-2xl p-3.5 text-xs text-[#404942] leading-relaxed">
                  <strong className="text-[#003820]">ملاحظة فريق المراجعة:</strong> {submission.adminNote}
                </div>
              )}

              <div className="text-xs text-[#707971] flex items-center justify-between pt-2 border-t border-[#e4ece7]">
                <span>مقدم الطلب: {submission.submitterName}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  تحديث حي مباشر
                </span>
              </div>
            </div>
          </FadeInUp>
          );
        })()}
      </div>
    </StackLayout>
  );
};

export const AdvertisePage: React.FC = () => {
  const { createSubmission, showToast } = useApp();
  const navigate = useNavigate();
  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(savedProfile.name || '');
  const [phone, setPhone] = useState(savedProfile.phone || '');
  const [goal, setGoal] = useState('الظهور في كراسي الواجهة الرئيسية (تدوير عادل)');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (businessName.trim().length < 2 || ownerName.trim().length < 2 || phone.trim().length < 8) {
      showToast('يرجى استكمال بيانات النشاط والمسؤول ورقم الهاتف بشكل صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'advertise',
        title: `طلب إعلان تجاري: ${businessName.trim()}`,
        submitterName: ownerName,
        submitterPhone: phone,
        payload: { businessName: businessName.trim(), goal },
      });
      navigate(`/track/${sub.trackingToken}`);
    } catch {
      showToast('تعذر إرسال طلب الإعلان حالياً، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout title="أعلن معنا في دليل أبوحمص" subtitle="ترويج محلي شفاف بدون وعود وهمية" backTo="/more">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-[#003820] text-white rounded-3xl p-5 space-y-2">
            <h2 className="text-lg font-bold">وصل لآلاف الأهالي في أبوحمص وقراها بشفافية كاملة</h2>
            <p className="text-xs text-white/80 leading-relaxed">
              نلتزم بنظام التدوير العادل بين 5 كراسي واجهة رئيسية وتقارير حقيقية لعدد المشاهدات ونقرات الاتصال. يتم الرد على طلبك خلال 48 ساعة عمل.
            </p>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="اسم النشاط التجاري أو العيادة *"
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            >
              <option>الظهور في كراسي الواجهة الرئيسية (تدوير عادل)</option>
              <option>نشر تخفيض وكوبون خصم في قسم التخفيضات</option>
              <option>توثيق وتمييز النشاط داخل القسم</option>
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="اسم المسؤول *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الواتساب للتواصل *"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[50px] bg-[#003820] text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform"
            >
              {submitting ? 'جارٍ الإرسال...' : 'إرسال طلب الإعلان (الرد خلال 48 ساعة)'}
            </button>
          </div>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

export const AboutPage: React.FC = () => {
  const { settings } = useApp();
  return (
    <StackLayout title="عن المبادرة والرسالة المجتمعية" backTo="/more">
      <FadeInUp delay={0.03}>
        <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 shadow-civic-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
              <Info size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#003820]">دليل أبوحمص المجتمعي</h2>
              <p className="text-xs text-[#146c43] font-semibold">مبادرة أهلية مستقلة غير حكومية</p>
            </div>
          </div>
          <p className="text-sm text-[#404942] leading-relaxed">{settings.disclaimer}</p>
          <p className="text-sm text-[#404942] leading-relaxed">
            يغطي الدليل بندر أبوحمص وكافة الوحدات القروية (بركة غطاس، بسنتواي، جواد حسني، بطورس والعزب التابعة) مع التزام كامل بتصفح حر بدون تسجيل دخول ودعم مجاني 100% لأصحاب الحرف والمشاريع المنزلية في قسم المكافحين.
          </p>
        </div>
      </FadeInUp>
    </StackLayout>
  );
};

export const PrivacyPage: React.FC = () => (
  <StackLayout title="سياسة الخصوصية وميثاق الاستخدام" backTo="/more">
    <FadeInUp delay={0.03}>
      <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 shadow-civic-1 space-y-4 text-sm text-[#404942] leading-relaxed">
        <h2 className="text-base font-bold text-[#003820]">ميثاق الحيادية وحماية بيانات المواطنين</h2>
        <p>1. التصفح والبحث وحفظ المفضلة والاتصال بأي نشاط في «دليل أبوحمص» لا يتطلب إنشاء حساب أو تسجيل دخول.</p>
        <p>2. لا نطلب مطلقاً أرقام بطاقات قومية أو بيانات بنكية؛ أرقام الهواتف في نماذج الحجز والطلبات تُستخدم فقط لتنسيق الخدمة مع العيادة أو المطعم أو الكابتن المعني.</p>
        <p>3. يتم عزل بيانات طلبات المواطنين برموز متابعة فريدة غير قابلة للاستعراض العام، وتُراجع كافة الإعلانات العقارية والتجارية قبل النشر لحماية الأهالي.</p>
        <p>4. دليل أبوحمص مبادرة مجتمعية مستقلة ولا يمثل أي جهة حكومية أو رسمية.</p>
      </div>
    </FadeInUp>
  </StackLayout>
);

export const ContactPWAPage: React.FC = () => {
  const { settings } = useApp();
  return (
    <StackLayout title="تواصل معنا وتثبيت التطبيق" subtitle="قنوات الدعم وتثبيت دليل أبوحمص (PWA)" backTo="/more">
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <PWAInstallButton variant="card" />
        </FadeInUp>

        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
            <h3 className="text-sm font-bold text-[#003820]">قنوات الدعم المباشر</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={buildWhatsAppUrl(settings.supportWhatsapp || '201001234567')}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                دعم واتساب دليل أبوحمص
              </a>
              <a
                href={`tel:${settings.supportPhone || '01001234567'}`}
                className="min-h-[48px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
              >
                <Phone size={16} />
                اتصال بفريق المبادرة
              </a>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};
