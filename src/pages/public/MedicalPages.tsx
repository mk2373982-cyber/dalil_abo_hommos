import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Search,
  ShieldAlert,
  Star,
  Stethoscope,
  Ticket,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { CivicImage, QRCodeCard, StackLayout } from '../../components/SharedUI';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  AnimatedStickyBar,
  FadeInUp,
} from '../../components/MotionEffects';
import {
  isPlaceSubscribedToFilter,
  PlacePromoBadges,
  PromoFilterChipsBar,
  sortPlacesByPromoPriority,
} from '../../lib/promoFilters';
import { matchesArabicQuery } from '../../lib/arabicSearch';
import { evaluateOpenStatus } from '../../lib/workingHours';
import { readCitizenProfile } from '../../lib/citizenProfile';
import { usePageSeo } from '../../lib/shareCard';
import {
  playNotificationChime,
  requestBrowserNotificationPermission,
  triggerBrowserNotification,
  triggerVibration,
} from '../../lib/alertSounds';
import { buildWhatsAppUrl } from '../../lib/formatters';
import type { ClinicQueue, ClinicTicket } from '../../types';

export const MedicalListPage: React.FC = () => {
  const { places, activePromoFilters, clinicQueues, logAnalyticsEvent } = useApp();
  const [search, setSearch] = useState('');
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pediatrics' | 'obgyn' | 'dental'>('all');

  const baseDoctors = useMemo(() => places.filter((p) => p.categorySlug === 'medical'), [places]);

  const doctors = useMemo(() => {
    let list = [...baseDoctors];
    if (selectedPromoId) {
      list = list.filter((d) => isPlaceSubscribedToFilter(d, selectedPromoId));
    }
    if (filter === 'pediatrics') {
      list = list.filter((d) => (d.specialty || '').includes('الأطفال'));
    } else if (filter === 'obgyn') {
      list = list.filter((d) => (d.specialty || '').includes('النساء'));
    } else if (filter === 'dental') {
      list = list.filter((d) => (d.specialty || '').includes('الأسنان'));
    }
    if (search.trim()) {
      list = list.filter((d) =>
        matchesArabicQuery(`${d.name} ${d.specialty || ''} ${d.area} ${d.address}`, search)
      );
    }
    return sortPlacesByPromoPriority(list, activePromoFilters);
  }, [baseDoctors, selectedPromoId, filter, search, activePromoFilters]);

  return (
    <StackLayout
      title="العيادات والأطباء"
      subtitle="المنظومة الصحية الموحدة لمركز ومدينة أبوحمص"
      backTo="/home"
    >
      <div className="space-y-4">
        {/* Emergency 123 & Night Pharmacies Banner */}
        <FadeInUp index={0} y={14}>
          <Link
            to="/emergency"
            className="bg-[#fff5f5] border border-[#ffdad6] rounded-3xl p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#ba1a1a] text-white flex items-center justify-center shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#93000a]">طوارئ وصيدليات النوبتجية 24 ساعة</h2>
                <p className="text-xs text-[#7a2e2e] truncate">إسعاف أبوحمص وصيدليات الحراسة الحالية</p>
              </div>
            </div>
            <span className="min-h-[38px] px-3.5 rounded-xl bg-[#ba1a1a] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 tabular-nums">
              <Phone size={13} />
              123
            </span>
          </Link>
        </FadeInUp>

        {/* Search */}
        <FadeInUp index={1} y={14}>
          <div className="relative">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0f5132]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم الطبيب، التخصص، أو اسم الشارع..."
              className="w-full min-h-[48px] pr-11 pl-4 rounded-2xl bg-white border border-[#e4ece7] focus:border-[#0f5132] focus:outline-none text-sm"
            />
          </div>
        </FadeInUp>

        {/* Dynamic Admin Promo Filters Bar */}
        <PromoFilterChipsBar
          promoFilters={activePromoFilters}
          selectedFilterId={selectedPromoId}
          onSelect={setSelectedPromoId}
          placesPool={baseDoctors}
          allLabel="كل الأطباء"
        />

        {/* Specialty Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'كل التخصصات' },
            { id: 'pediatrics', label: 'أطفال وحديثي ولادة' },
            { id: 'obgyn', label: 'نساء وتوليد' },
            { id: 'dental', label: 'أسنان' },
          ].map((tab) => (
            <AnimatedFilterChip
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`min-h-[38px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#003820] text-white'
                  : 'bg-white border border-[#e4ece7] text-[#404942]'
              }`}
            >
              {tab.label}
            </AnimatedFilterChip>
          ))}
        </div>

        {/* Doctor Cards */}
        {doctors.length === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
            <Stethoscope size={30} className="mx-auto text-[#707971]" />
            <h3 className="text-sm font-bold text-[#181c1c]">لا توجد عيادات مطابقة للبحث أو الفلتر الحالي</h3>
            <p className="text-xs text-[#404942]">جرّب تغيير كلمة البحث أو اختيار «كل التخصصات».</p>
          </AnimatedEmptyState>
        ) : (
        <AnimatedListContainer className="space-y-3.5">
          {doctors.map((doctor, idx) => {
            const queue = clinicQueues.find((q) => q.doctorId === doctor.id);
            return (
              <AnimatedListItem key={doctor.id} index={idx}>
                <div className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 transition-colors rounded-3xl p-4 sm:p-5 shadow-civic-1 space-y-4">
                <div className="flex items-start gap-3.5">
                  <CivicImage
                    src={doctor.imageUrl}
                    alt={doctor.name}
                    className="w-20 h-20 rounded-2xl shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <PlacePromoBadges place={doctor} promoFilters={activePromoFilters} maxBadges={2} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-base font-bold text-[#181c1c] truncate">{doctor.name}</h3>
                        {doctor.verified && <BadgeCheck size={16} className="text-[#cca730] shrink-0" />}
                      </div>
                      <span className="text-xs font-bold text-[#735c00] inline-flex items-center gap-1 shrink-0 tabular-nums">
                        <Star size={13} className="fill-[#cca730] text-[#cca730]" />
                        {doctor.rating ?? 4.8}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#146c43]">{doctor.specialty}</p>
                    <p className="text-xs text-[#404942] flex items-center gap-1 truncate">
                      <MapPin size={13} className="shrink-0 text-[#707971]" />
                      <span className="truncate">{doctor.address}</span>
                    </p>
                  </div>
                </div>

                {/* Live Queue & Fee Bar */}
                <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    {(() => {
                      const openStatus = evaluateOpenStatus(doctor.hours, doctor.openNow ?? true);
                      return (
                        <p className={`text-xs font-bold ${openStatus.isOpen ? 'text-[#0f5132]' : 'text-[#707971]'}`}>
                          {queue?.status === 'paused'
                            ? 'العيادة في استراحة مؤقتة'
                            : queue?.status === 'emergency'
                              ? 'حالة طارئة بالعيادة حالياً'
                              : openStatus.label}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-[#404942] tabular-nums">
                      الدور الحالي عند الكشف: <strong>#{queue?.currentNumber ?? 5}</strong>
                    </p>
                  </div>
                  <div className="text-left tabular-nums">
                    <p className="text-[11px] text-[#707971]">قيمة الكشف</p>
                    <p className="text-base font-bold text-[#003820]">{doctor.consultationFee ?? 150} ج.م</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-12 gap-2">
                  <Link
                    to={`/medical/booking/${doctor.id}`}
                    className="col-span-6 min-h-[46px] bg-[#003820] hover:bg-[#0f5132] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Ticket size={16} />
                    احجز دورك الآن
                  </Link>
                  <a
                    href={`tel:${doctor.phone}`}
                    onClick={() =>
                      void logAnalyticsEvent({
                        eventType: 'call_click',
                        targetId: doctor.id,
                        targetName: doctor.name,
                      })
                    }
                    className="col-span-3 min-h-[46px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Phone size={15} />
                    اتصال
                  </a>
                  <Link
                    to={`/medical/doctors/${doctor.id}`}
                    className="col-span-3 min-h-[46px] bg-[#f1f4f2] text-[#181c1c] text-xs font-bold rounded-2xl flex items-center justify-center active:scale-95"
                  >
                    الملف
                  </Link>
                </div>
                </div>
              </AnimatedListItem>
            );
          })}
        </AnimatedListContainer>
        )}

        {/* Doctor Join Promo */}
        <FadeInUp>
          <div className="bg-[#003820] text-white rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold">هل أنت طبيب في أبوحمص؟</h3>
              <p className="text-xs text-white/80 leading-relaxed">
                سجّل عيادتك مجاناً ضمن السجل الطبي المعتمد لمركز أبوحمص ويسّر على الأهالي حجز الأدوار ومتابعتها.
              </p>
            </div>
            <Link
              to="/places/suggest"
              className="min-h-[46px] px-5 rounded-2xl bg-white text-[#003820] text-xs font-bold inline-flex items-center justify-center shrink-0 active:scale-95"
            >
              طلب انضمام العيادة
            </Link>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

export const DoctorProfilePage: React.FC = () => {
  const { doctorId } = useParams();
  const { places, clinicQueues, favorites, toggleFavorite, logAnalyticsEvent } = useApp();

  const doctor = places.find((p) => p.id === doctorId);
  usePageSeo(
    doctor?.name,
    doctor ? `${doctor.specialty || 'عيادة طبية'} — ${doctor.address} — احجز دورك أونلاين عبر دليل أبوحمص.` : undefined
  );

  if (!doctor) {
    return (
      <StackLayout title="ملف الطبيب" backTo="/medical">
        <div className="bg-white rounded-3xl p-8 text-center text-sm">لم يتم العثور على الطبيب المطلوب.</div>
      </StackLayout>
    );
  }

  const queue = clinicQueues.find((q) => q.doctorId === doctor.id);
  const isFav = favorites.includes(doctor.id);
  const openStatus = evaluateOpenStatus(doctor.hours, doctor.openNow ?? true);
  const shareUrl = `${window.location.origin}/medical/doctors/${doctor.id}`;

  return (
    <StackLayout
      title="ملف الطبيب والعيادة"
      subtitle={doctor.name}
      backTo="/medical"
      rightAction={
        <button
          type="button"
          onClick={() => toggleFavorite(doctor.id)}
          className={`w-11 h-11 rounded-full border flex items-center justify-center active:scale-95 ${
            isFav
              ? 'bg-[#003820] border-[#003820] text-white'
              : 'bg-white border-[#e4ece7] text-[#404942]'
          }`}
          aria-label="حفظ في المفضلة"
        >
          <Bookmark size={18} className={isFav ? 'fill-current' : ''} />
        </button>
      }
    >
      <div className="space-y-4 pb-20">
        {/* Main Hero Card */}
        <FadeInUp index={0}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex items-start gap-4">
              <CivicImage
                src={doctor.imageUrl}
                alt={doctor.name}
                className="w-24 h-24 rounded-2xl shrink-0"
              />
              <div className="space-y-1.5 min-w-0">
                <p className="text-xs font-bold text-[#735c00] inline-flex items-center gap-1">
                  <BadgeCheck size={15} className="text-[#cca730]" />
                  طبيب معتمد وموثق بدليل أبوحمص
                </p>
                <h2 className="text-xl font-bold text-[#181c1c]">{doctor.name}</h2>
                <p className="text-xs sm:text-sm font-medium text-[#146c43]">{doctor.specialty}</p>
                <div className="flex items-center gap-2 text-xs text-[#404942] tabular-nums">
                  <span className="inline-flex items-center gap-1 font-bold text-[#735c00]">
                    <Star size={13} className="fill-[#cca730] text-[#cca730]" />
                    {doctor.rating ?? 4.9} ({doctor.reviewCount ?? 200}+ تقييم)
                  </span>
                  <span>·</span>
                  <span>{doctor.experienceYears ?? 12} عام خبرة</span>
                </div>
              </div>
            </div>

            {doctor.description && (
              <p className="text-sm text-[#404942] leading-relaxed">{doctor.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`tel:${doctor.phone}`}
                onClick={() =>
                  void logAnalyticsEvent({
                    eventType: 'call_click',
                    targetId: doctor.id,
                    targetName: doctor.name,
                  })
                }
                className="min-h-[46px] bg-[#f1f4f2] text-[#003820] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Phone size={16} />
                اتصال مباشر
              </a>
              <a
                href={buildWhatsAppUrl(
                  doctor.whatsapp || doctor.phone,
                  `السلام عليكم، أستفسر عن مواعيد ${doctor.name} عبر دليل أبوحمص`
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  void logAnalyticsEvent({
                    eventType: 'whatsapp_click',
                    targetId: doctor.id,
                    targetName: doctor.name,
                  })
                }
                className="min-h-[46px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <MessageCircle size={16} />
                واتساب العيادة
              </a>
            </div>
          </div>
        </FadeInUp>

        {/* Live Queue Status */}
        {queue && (
          <FadeInUp index={1}>
            <div className="bg-[#e6f4ec] border border-[#b0f1c7] rounded-3xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#003820] text-white flex flex-col items-center justify-center tabular-nums">
                  <span className="text-[10px] text-[#9ff1bd]">الدور</span>
                  <span className="text-lg font-bold leading-none">#{queue.currentNumber}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#003820]">متابعة الطابور الحي الآن</h3>
                  <p className="text-xs text-[#146c43] tabular-nums">
                    آخر حجز مسجل: #{queue.lastTicketNumber} · متوسط الانتظار {queue.avgMinutesPerPatient ?? 10} د/مريض
                  </p>
                </div>
              </div>
              <Link
                to={`/medical/booking/${doctor.id}`}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#0f5132] text-white text-xs font-bold flex items-center shrink-0 active:scale-95 transition-transform"
              >
                احجز الآن
              </Link>
            </div>
          </FadeInUp>
        )}

        {/* Schedule & Address */}
        <FadeInUp index={2}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                  <Calendar size={17} className="text-[#0f5132]" />
                  مواعيد العمل بالعيادة
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    openStatus.isOpen ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#f1f4f2] text-[#707971]'
                  }`}
                >
                  {openStatus.label}
                </span>
              </div>
              <p className="text-sm text-[#404942]">{doctor.hours || 'السبت إلى الخميس: 4:00 م - 9:00 م'}</p>
              <p className="text-xs font-medium text-[#ba1a1a]">الجمعة: عطلة أسبوعية رسمية</p>
            </div>

            <hr className="border-[#e4ece7]" />

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                <MapPin size={17} className="text-[#0f5132]" />
                العنوان والوصول السريع
              </h3>
              <p className="text-sm text-[#404942]">{doctor.address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `أبوحمص البحيرة ${doctor.address}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-[#f1f4f2] text-[#003820] text-xs font-bold active:scale-95 transition-transform"
              >
                <Navigation size={15} />
                فتح الاتجاهات على الخريطة
              </a>
            </div>
          </div>
        </FadeInUp>

        {/* Transparent Fees List */}
        {doctor.services && doctor.services.length > 0 && (
          <FadeInUp index={3}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                  <Stethoscope size={17} className="text-[#0f5132]" />
                  قائمة الخدمات ورسوم الكشف
                </h3>
                <span className="text-xs text-[#146c43] font-semibold">تسعيرة معلنة</span>
              </div>
              <div className="divide-y divide-[#e4ece7]">
                {doctor.services.map((srv, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#181c1c]">{srv.name}</p>
                      <p className="text-xs text-[#404942]">{srv.description}</p>
                    </div>
                    <span className="text-sm font-bold text-[#003820] whitespace-nowrap tabular-nums">
                      {srv.priceLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeInUp>
        )}

        {/* Scannable Clinic QR Card */}
        <FadeInUp index={4}>
          <QRCodeCard
            title={doctor.name}
            code={doctor.qrCode || `DR-${doctor.id.toUpperCase()}`}
            shareUrl={shareUrl}
            subtitle="شارك البطاقة مع عائلتك لحفظ مواعيد الكشف والاتصال السريع"
            phone={doctor.phone}
            area={doctor.area}
            specialty={doctor.specialty}
          />
        </FadeInUp>
      </div>

      {/* Sticky Bottom Booking Bar */}
      <AnimatedStickyBar className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#e4ece7] p-3.5 pb-safe">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="tabular-nums">
            <p className="text-[11px] text-[#707971]">رسوم الكشف المبدئي</p>
            <p className="text-lg font-bold text-[#003820]">{doctor.consultationFee ?? 150} ج.م</p>
          </div>
          <Link
            to={`/medical/booking/${doctor.id}`}
            className="flex-1 max-w-xs min-h-[48px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Ticket size={18} />
            احجز دورك الآن
          </Link>
        </div>
      </AnimatedStickyBar>
    </StackLayout>
  );
};

export const DoctorBookingPage: React.FC = () => {
  const { doctorId } = useParams();
  const { places, clinicQueues, bookClinicTicket, showToast } = useApp();
  const navigate = useNavigate();

  const doctor = places.find((p) => p.id === doctorId);
  const queue = clinicQueues.find((q) => q.doctorId === doctor?.id);

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const [patientName, setPatientName] = useState(savedProfile.name);
  const [patientPhone, setPatientPhone] = useState(savedProfile.phone);
  const [visitType, setVisitType] = useState('كشف جديد');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!doctor) {
    return (
      <StackLayout title="حجز دور الكشف" backTo="/medical">
        <div className="bg-white rounded-3xl p-6 text-center">لم يتم العثور على العيادة.</div>
      </StackLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (patientName.trim().length < 2 || patientPhone.trim().length < 8) {
      showToast('يرجى كتابة اسم المريض ورقم الهاتف بشكل صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await bookClinicTicket({
        doctorId: doctor.id,
        doctorName: doctor.name,
        patientName,
        patientPhone,
        visitType,
        fee: doctor.consultationFee ?? 150,
        notes,
      });
      navigate('/medical/booking/confirmed', { state: { ticket, doctor } });
    } catch {
      showToast('تعذر تثبيت الحجز حالياً، يرجى مراجعة البيانات والمحاولة مرة أخرى', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="حجز دور الكشف الطبي"
      subtitle={doctor.name}
      backTo={`/medical/doctors/${doctor.id}`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FadeInUp index={0}>
          <div className="bg-[#e6f4ec] border border-[#b0f1c7] rounded-3xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#146c43]">رقم الدور المتوقع لحجزك</p>
              <p className="text-2xl font-bold text-[#003820] tabular-nums">
                #{(queue?.lastTicketNumber ?? 8) + 1}
              </p>
            </div>
            <div className="text-left text-xs text-[#003820] tabular-nums">
              <p>الدور الحالي: #{queue?.currentNumber ?? 5}</p>
              <p className="text-[#146c43] font-semibold">الدفع عند الحضور بالعيادة</p>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp index={1}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#181c1c]">اسم المريض بالكامل *</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="مثال: كريم محمد عبد الله"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] focus:bg-white focus:outline-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#181c1c]">رقم الهاتف / الواتساب *</label>
              <input
                type="tel"
                required
                dir="ltr"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] focus:bg-white focus:outline-none text-sm text-right tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#181c1c]">نوع الزيارة</label>
              <div className="grid grid-cols-3 gap-2">
                {['كشف جديد', 'إعادة استشارة', 'متابعة سريعة'].map((type) => (
                  <AnimatedFilterChip
                    key={type}
                    onClick={() => setVisitType(type)}
                    className={`min-h-[44px] rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
                      visitType === type
                        ? 'bg-[#003820] text-white'
                        : 'bg-[#f1f4f2] text-[#404942]'
                    }`}
                  >
                    {type}
                  </AnimatedFilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#181c1c]">ملاحظات للسكرتارية (اختياري)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: طفل عمره 3 سنوات، ارتفاع حرارة"
                className="w-full p-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] focus:border-[#0f5132] focus:bg-white focus:outline-none text-sm"
              />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp index={2}>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] bg-[#003820] hover:bg-[#0f5132] disabled:opacity-60 text-white font-bold text-sm rounded-2xl shadow-civic-2 active:scale-95 transition-transform"
          >
            {submitting ? 'جارٍ تثبيت رقم الدور في العيادة...' : 'تأكيد الحجز واستلام رقم الدور'}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

export const BookingConfirmedPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { ticket?: ClinicTicket; doctor?: { phone?: string; whatsapp?: string } } | null;
  const ticket = state?.ticket;

  if (!ticket) {
    return (
      <StackLayout title="تأكيد الحجز" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center space-y-4">
          <p className="text-sm text-[#404942]">لا توجد تذكرة حجز نشطة في هذه الجلسة.</p>
          <Link to="/medical" className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#0f5132] text-white text-xs font-bold">
            تصفح الأطباء
          </Link>
        </div>
      </StackLayout>
    );
  }

  const waMessage = `مرحباً، تم تأكيد حجزي في عيادة ${ticket.doctorName} عبر دليل أبوحمص.\nرقم الدور: #${ticket.ticketNumber}\nكود الحجز: ${ticket.ticketCode}\nالاسم: ${ticket.patientName}`;

  return (
    <StackLayout title="تم تأكيد حجزك بنجاح" backTo="/home">
      <div className="space-y-5 max-w-lg mx-auto">
        <FadeInUp index={0}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 text-center shadow-civic-1 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
              <CheckCircle2 size={34} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#146c43]">تذكرة الدور الإلكتروني الموثقة</p>
              <h2 className="text-4xl font-bold text-[#003820] my-2 tabular-nums">#{ticket.ticketNumber}</h2>
              <p className="text-sm font-bold text-[#181c1c]">{ticket.doctorName}</p>
              <p className="text-xs text-[#404942] mt-1">
                المريض: {ticket.patientName} · كود التذكرة: <span className="font-mono">{ticket.ticketCode}</span>
              </p>
            </div>

            <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-2xl p-3.5 text-xs text-[#404942] leading-relaxed">
              سيظهر دورك تلقائياً لدى سكرتارية العيادة، ويمكنك متابعة تقدم الأدوار لحظة بلحظة من بيتك قبل التوجه للعيادة.
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                to={`/medical/live-queue/${ticket.id}`}
                className="w-full min-h-[48px] bg-[#003820] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Clock size={18} />
                متابعة الدور المباشر بالعيادة الآن
              </Link>
              <a
                href={buildWhatsAppUrl(state?.doctor?.whatsapp || state?.doctor?.phone, waMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[46px] bg-[#e6f4ec] text-[#0f5132] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <MessageCircle size={16} />
                إرسال نسخة التأكيد لواتساب العيادة
              </a>
              <Link
                to="/home"
                className="w-full min-h-[44px] bg-[#f1f4f2] text-[#404942] font-semibold text-xs rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
              >
                العودة للرئيسية (مع استمرار المتابعة الحية)
              </Link>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

export const LiveQueuePage: React.FC = () => {
  const { ticketId } = useParams();
  const { clinicQueues, showToast } = useApp();
  const [ticket, setTicket] = useState<ClinicTicket | null>(null);
  const [liveQueue, setLiveQueue] = useState<ClinicQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundAlert, setSoundAlert] = useState<boolean>(true);
  const notifiedStageRef = useRef<'none' | 'soon' | 'turn'>('none');

  useEffect(() => {
    if (!ticketId) return;
    const unsubTicket = onSnapshot(
      doc(db, 'clinic_tickets', ticketId),
      (snap) => {
        if (snap.exists()) {
          setTicket({ ...(snap.data() as ClinicTicket), id: snap.id });
        } else {
          setTicket(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubTicket();
  }, [ticketId]);

  useEffect(() => {
    if (!ticket?.doctorId) return;
    const unsubQueue = onSnapshot(
      doc(db, 'clinic_queues', ticket.doctorId),
      (snap) => {
        if (snap.exists()) {
          setLiveQueue({ ...(snap.data() as ClinicQueue), doctorId: snap.id });
        }
      },
      () => {
        // Fallback to context queue
      }
    );
    return () => unsubQueue();
  }, [ticket?.doctorId]);

  const queue = liveQueue || clinicQueues.find((q) => q.doctorId === ticket?.doctorId);
  const currentNum = queue?.currentNumber ?? 1;
  const remaining = ticket ? Math.max(0, ticket.ticketNumber - currentNum) : 99;
  const isCancelled = ticket?.status === 'cancelled';
  const isCompleted = ticket?.status === 'completed';
  const isTerminal = Boolean(isCancelled || isCompleted);
  const isMyTurn = Boolean(
    ticket && !isTerminal && (ticket.status === 'called' || ticket.status === 'in_room' || remaining === 0)
  );

  // Zero-cost client-side turn alert (sound + vibration + optional browser notification)
  useEffect(() => {
    if (!ticket || isTerminal) return;
    if (isMyTurn && notifiedStageRef.current !== 'turn') {
      notifiedStageRef.current = 'turn';
      if (soundAlert) {
        playNotificationChime('turn');
        triggerVibration([250, 120, 250, 120, 300]);
      }
      triggerBrowserNotification(
        `حان دورك الآن عند ${ticket.doctorName}`,
        `تذكرة رقم #${ticket.ticketNumber} — يرجى التوجه لشباك استقبال العيادة.`
      );
      showToast('حان دورك الآن! يرجى التوجه للعيادة', 'success');
    } else if (!isMyTurn && remaining <= 2 && remaining > 0 && notifiedStageRef.current === 'none') {
      notifiedStageRef.current = 'soon';
      if (soundAlert) {
        playNotificationChime('order');
        triggerVibration([180, 90, 180]);
      }
      triggerBrowserNotification(
        `اقترب دورك عند ${ticket.doctorName}`,
        `أمامك ${remaining} فقط — استعد للتوجه للعيادة.`
      );
      showToast(`تنبيه: اقترب دورك! أمامك ${remaining} فقط`, 'info');
    }
  }, [ticket, isTerminal, isMyTurn, remaining, soundAlert, showToast]);

  if (loading) {
    return (
      <StackLayout title="متابعة الدور المباشر" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center text-sm text-[#404942]">
          جارٍ الاتصال بطابور العيادة الحي...
        </div>
      </StackLayout>
    );
  }

  if (!ticket) {
    return (
      <StackLayout title="متابعة الدور المباشر" backTo="/home">
        <div className="bg-white rounded-3xl border border-[#e4ece7] p-8 text-center space-y-3">
          <h3 className="text-base font-bold text-[#181c1c]">تذكرة الدور غير موجودة أو منتهية</h3>
          <Link to="/medical" className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#0f5132] text-white text-xs font-bold">
            حجز موعد جديد
          </Link>
        </div>
      </StackLayout>
    );
  }

  const estMinutes = remaining * (queue?.avgMinutesPerPatient ?? 10);

  return (
    <StackLayout
      title="متابعة الدور المباشر"
      subtitle={ticket.doctorName}
      backTo="/home"
      rightAction={
        <button
          type="button"
          onClick={async () => {
            const next = !soundAlert;
            setSoundAlert(next);
            if (next) {
              playNotificationChime('gentle');
              const perm = await requestBrowserNotificationPermission();
              showToast(
                perm === 'granted'
                  ? 'تم تفعيل التنبيه الصوتي وإشعارات اقتراب الدور'
                  : 'تم تفعيل التنبيه الصوتي والاهتزاز عند اقتراب دورك',
                'success'
              );
            } else {
              showToast('تم كتم التنبيه الصوتي لهذه الجلسة', 'info');
            }
          }}
          className={`min-h-[38px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            soundAlert ? 'bg-[#e6f4ec] text-[#003820]' : 'bg-[#f1f4f2] text-[#707971]'
          }`}
        >
          {soundAlert ? <Volume2 size={15} /> : <VolumeX size={15} />}
          <span className="hidden sm:inline">{soundAlert ? 'تنبيه الدور يعمل' : 'مكتوم'}</span>
        </button>
      }
    >
      <div className="space-y-4 max-w-lg mx-auto">
        {!isTerminal && !isMyTurn && (
          <FadeInUp index={0} y={10}>
            <div className="bg-[#f7faf8] border border-[#d7ebe0] rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-[11px] text-[#003820]">
              <BellRing size={14} className="text-[#0f5132] shrink-0" />
              <span>سيصدر تنبيه صوتي تلقائياً فور اقتراب دورك (عندما يتبقى مريضان أو أقل).</span>
            </div>
          </FadeInUp>
        )}
        {/* Emergency / Paused Alert */}
        {queue?.status === 'emergency' && (
          <FadeInUp index={0} y={12}>
            <div className="bg-[#ffdad6] text-[#93000a] rounded-3xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>تنبيه عاجل من العيادة:</strong> يوجد حالة طارئة داخل غرفة الكشف حالياً، سيعود التسلسل فور الانتهاء.
              </div>
            </div>
          </FadeInUp>
        )}

        {queue?.status === 'paused' && (
          <FadeInUp index={0} y={12}>
            <div className="bg-[#fef3c7] text-[#574500] rounded-3xl p-4 flex items-start gap-3">
              <Clock size={20} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>استراحة مؤقتة:</strong> {queue.pausedReason || 'الطبيب في استراحة قصيرة وسيُستأنف الكشف قريباً.'}
              </div>
            </div>
          </FadeInUp>
        )}

        {/* My Turn Highlight */}
        <FadeInUp index={0}>
          <div
            className={`rounded-3xl p-6 text-center shadow-civic-2 space-y-3 transition-colors ${
              isCancelled
                ? 'bg-[#fff5f5] border border-[#ffdad6] text-[#93000a]'
                : isMyTurn
                  ? 'bg-[#003820] text-white'
                  : 'bg-white border border-[#e4ece7] text-[#181c1c]'
            }`}
          >
            <p
              className={`text-xs font-semibold ${
                isCancelled ? 'text-[#ba1a1a]' : isMyTurn ? 'text-[#9ff1bd]' : 'text-[#146c43]'
              }`}
            >
              {isCancelled
                ? 'تم إلغاء هذه التذكرة — يرجى التواصل مع العيادة أو حجز دور جديد'
                : isCompleted
                  ? 'تم إتمام الكشف بنجاح — نتمنى لك الشفاء العاجل'
                  : isMyTurn
                    ? 'حان دورك الآن! يرجى التوجه لشباك الاستقبال'
                    : 'تحديث لحظي مباشر من سكرتارية العيادة'}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className={`rounded-2xl p-4 ${isMyTurn ? 'bg-white/10' : 'bg-[#f7faf8]'}`}>
                <p className={`text-xs ${isMyTurn ? 'text-white/75' : 'text-[#707971]'}`}>رقم دورك</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">#{ticket.ticketNumber}</p>
              </div>
              <div className={`rounded-2xl p-4 ${isMyTurn ? 'bg-white/10' : 'bg-[#e6f4ec]'}`}>
                <p className={`text-xs ${isMyTurn ? 'text-white/75' : 'text-[#146c43]'}`}>الدور الحالي الآن</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">#{currentNum}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-xs tabular-nums">
              <div className={`rounded-2xl p-3 flex items-center justify-center gap-2 ${isMyTurn ? 'bg-white/10' : 'bg-[#f1f4f2]'}`}>
                <Users size={15} />
                <span>أمامك: {remaining} مريض</span>
              </div>
              <div className={`rounded-2xl p-3 flex items-center justify-center gap-2 ${isMyTurn ? 'bg-white/10' : 'bg-[#f1f4f2]'}`}>
                <Clock size={15} />
                <span>المتوقع: ~{estMinutes} دقيقة</span>
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* Ticket Summary */}
        <FadeInUp index={1}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#707971]">اسم المريض</span>
              <span className="font-bold">{ticket.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#707971]">نوع الزيارة</span>
              <span className="font-semibold">{ticket.visitType || 'كشف جديد'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#707971]">حالة التذكرة</span>
              <span className="font-bold text-[#0f5132]">
                {ticket.status === 'waiting'
                  ? 'في الانتظار'
                  : ticket.status === 'called'
                    ? 'تم النداء عليك'
                    : ticket.status === 'in_room'
                      ? 'داخل غرفة الكشف'
                      : ticket.status === 'completed'
                        ? 'مكتمل'
                        : ticket.status === 'emergency'
                          ? 'حالة طارئة'
                          : 'ملغي'}
              </span>
            </div>
          </div>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};
