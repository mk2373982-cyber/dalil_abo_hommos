import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Bath,
  BedDouble,
  Bookmark,
  Building2,
  Calendar,
  Clock,
  Flag,
  MapPin,
  Maximize2,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Store,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CivicImage, PublicRootLayout, QRCodeCard, StackLayout } from '../../components/SharedUI';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  AnimatedStickyBar,
  FadeInUp,
} from '../../components/MotionEffects';
import { DynamicCategoryIcon } from '../../lib/icons';
import {
  isPlaceSubscribedToFilter,
  PlacePromoBadges,
  PromoFilterChipsBar,
  sortPlacesByPromoPriority,
} from '../../lib/promoFilters';
import { ABU_HOMS_AREAS } from '../../data/seedData';
import { buildWhatsAppUrl, validateEgyptPhone } from '../../lib/formatters';
import { matchesArabicQuery } from '../../lib/arabicSearch';
import { evaluateOpenStatus } from '../../lib/workingHours';
import { readCitizenProfile } from '../../lib/citizenProfile';
import { usePageSeo } from '../../lib/shareCard';

export const RealEstateListPage: React.FC = () => {
  const { properties, agencies } = useApp();
  const [listingType, setListingType] = useState<'all' | 'sale' | 'rent'>('all');
  const [propType, setPropType] = useState<'all' | 'apartment' | 'shop' | 'land'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (p.status !== 'approved') return false;
      if (listingType !== 'all' && p.listingType !== listingType) return false;
      if (propType !== 'all' && p.propertyType !== propType) return false;
      if (search.trim()) {
        return matchesArabicQuery(`${p.title} ${p.area} ${p.address || ''}`, search);
      }
      return true;
    });
  }, [properties, listingType, propType, search]);

  return (
    <PublicRootLayout>
      <div className="space-y-5">
        <FadeInUp delay={0.02}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#003820]">عقارات وأراضي أبوحمص</h1>
              <p className="text-xs sm:text-sm text-[#404942]">
                إعلانات عقارية مراجَعة وموثقة من مكاتب وملاك مركز ومدينة أبوحمص
              </p>
            </div>
            <Link
              to={`/real-estate/agency/${agencies[0]?.id || 'delta-realty'}`}
              className="min-h-[44px] px-4 rounded-2xl bg-[#003820] text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 active:scale-95 transition-transform"
            >
              <Plus size={16} />
              إضافة عقار للمراجعة
            </Link>
          </div>
        </FadeInUp>

        {/* Search & Filters */}
        <FadeInUp delay={0.06}>
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0f5132]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالمنطقة، الشارع، أو نوع العقار..."
                className="w-full min-h-[48px] pr-11 pl-4 rounded-2xl bg-white border border-[#e4ece7] text-sm focus:border-[#0f5132] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'sale', label: 'للبيع والتمليك' },
                { id: 'rent', label: 'للإيجار' },
              ].map((tab) => (
                <AnimatedFilterChip
                  key={tab.id}
                  onClick={() => setListingType(tab.id as typeof listingType)}
                  className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    listingType === tab.id
                      ? 'bg-[#003820] text-white'
                      : 'bg-white border border-[#e4ece7] text-[#404942]'
                  }`}
                >
                  {tab.label}
                </AnimatedFilterChip>
              ))}
              <span className="text-[#c0c9c0]">|</span>
              {[
                { id: 'all', label: 'كل الأنواع' },
                { id: 'apartment', label: 'شقق' },
                { id: 'shop', label: 'محلات' },
                { id: 'land', label: 'أراضي' },
              ].map((tab) => (
                <AnimatedFilterChip
                  key={tab.id}
                  onClick={() => setPropType(tab.id as typeof propType)}
                  className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                    propType === tab.id
                      ? 'bg-[#e6f4ec] text-[#003820] border border-[#0f5132]/30'
                      : 'bg-white border border-[#e4ece7] text-[#404942]'
                  }`}
                >
                  {tab.label}
                </AnimatedFilterChip>
              ))}
            </div>
          </div>
        </FadeInUp>

        {/* Verified Agencies Strip */}
        <section className="space-y-2.5">
          <h2 className="text-sm font-bold text-[#181c1c]">مكاتب عقارية معتمدة بأبوحمص</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agencies.map((ag, idx) => (
              <FadeInUp key={ag.id} index={idx}>
                <Link
                  to={`/real-estate/agency/${ag.id}`}
                  className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3 hover:border-[#0f5132]/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center shrink-0">
                      <Building2 size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h3 className="text-sm font-bold truncate">{ag.name}</h3>
                        {ag.verified && <BadgeCheck size={15} className="text-[#cca730] shrink-0" />}
                      </div>
                      <p className="text-xs text-[#404942] truncate">{ag.area}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#0f5132] whitespace-nowrap">الملف</span>
                </Link>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Property Cards */}
        {filtered.length === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
            <Building2 size={30} className="mx-auto text-[#707971]" />
            <h3 className="text-sm font-bold text-[#181c1c]">لا توجد عقارات مطابقة للبحث أو التصفية الحالية</h3>
            <p className="text-xs text-[#404942]">جرّب تغيير نوع العقار أو البحث بكلمة أخرى.</p>
          </AnimatedEmptyState>
        ) : (
        <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((prop, idx) => (
            <AnimatedListItem key={prop.id} index={idx}>
              <Link
                to={`/real-estate/${prop.id}`}
                className="block bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1 hover:border-[#0f5132]/40 transition-all h-full"
              >
                <div className="relative h-48 overflow-hidden">
                  <CivicImage src={prop.imageUrl} alt={prop.title} className="w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <span className="absolute top-3 right-3 bg-[#003820] text-white text-[11px] font-bold px-3 py-1 rounded-xl">
                    {prop.listingType === 'sale' ? 'للبيع والتمليك' : 'للإيجار الشهري'}
                  </span>
                  <span className="absolute bottom-3 left-3 bg-white text-[#003820] text-sm font-bold px-3 py-1.5 rounded-xl shadow tabular-nums">
                    {prop.price.toLocaleString('ar-EG')} ج.م{prop.listingType === 'rent' ? ' / شهر' : ''}
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-base font-bold text-[#181c1c] line-clamp-1">{prop.title}</h3>
                  <p className="text-xs text-[#404942] flex items-center gap-1">
                    <MapPin size={13} className="text-[#0f5132] shrink-0" />
                    <span className="truncate">{prop.area}</span>
                  </p>
                  <div className="flex items-center gap-4 pt-2 border-t border-[#e4ece7] text-xs text-[#404942] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Maximize2 size={13} />
                      {prop.areaSqm} م²
                    </span>
                    {prop.rooms && (
                      <span className="inline-flex items-center gap-1">
                        <BedDouble size={13} />
                        {prop.rooms} غرف
                      </span>
                    )}
                    {prop.baths && (
                      <span className="inline-flex items-center gap-1">
                        <Bath size={13} />
                        {prop.baths} حمام
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </AnimatedListItem>
          ))}
        </AnimatedListContainer>
        )}
      </div>
    </PublicRootLayout>
  );
};

export const PropertyDetailPage: React.FC = () => {
  const { propertyId } = useParams();
  const { properties, agencies } = useApp();

  const property = properties.find((p) => p.id === propertyId);
  const agency = agencies.find((a) => a.id === property?.agencyId);
  usePageSeo(
    property?.title,
    property
      ? `${property.listingType === 'sale' ? 'للبيع' : 'للإيجار'} في ${property.area} — ${property.areaSqm} م²`
      : undefined
  );

  if (!property) {
    return (
      <StackLayout title="تفاصيل العقار" backTo="/real-estate">
        <div className="bg-white rounded-3xl p-8 text-center">العقار غير متاح.</div>
      </StackLayout>
    );
  }

  return (
    <StackLayout title="تفاصيل إعلان العقار" subtitle={property.area} backTo="/real-estate">
      <div className="space-y-4 pb-20">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1">
            <div className="relative h-60">
              <CivicImage src={property.imageUrl} alt={property.title} className="w-full h-full" />
              <span className="absolute top-4 right-4 bg-[#003820] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl">
                {property.listingType === 'sale' ? 'للبيع والتمليك' : 'للإيجار الشهري'}
              </span>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-[#181c1c]">{property.title}</h2>
                <p className="text-xl font-bold text-[#003820] tabular-nums">
                  {property.price.toLocaleString('ar-EG')} ج.م{property.listingType === 'rent' ? ' / شهر' : ''}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center tabular-nums">
                <div className="bg-[#f7faf8] rounded-2xl p-3">
                  <p className="text-[11px] text-[#707971]">المساحة</p>
                  <p className="text-sm font-bold">{property.areaSqm} م²</p>
                </div>
                {property.propertyType !== 'land' && (
                  <>
                    <div className="bg-[#f7faf8] rounded-2xl p-3">
                      <p className="text-[11px] text-[#707971]">الغرف</p>
                      <p className="text-sm font-bold">{property.rooms || '—'}</p>
                    </div>
                    <div className="bg-[#f7faf8] rounded-2xl p-3">
                      <p className="text-[11px] text-[#707971]">الدور</p>
                      <p className="text-sm font-bold">{property.floor || '—'}</p>
                    </div>
                    <div className="bg-[#f7faf8] rounded-2xl p-3">
                      <p className="text-[11px] text-[#707971]">التشطيب</p>
                      <p className="text-sm font-bold">{property.finishing || '—'}</p>
                    </div>
                  </>
                )}
                {property.propertyType === 'land' && (
                  <div className="bg-[#f7faf8] rounded-2xl p-3">
                    <p className="text-[11px] text-[#707971]">نوع العقار</p>
                    <p className="text-sm font-bold">أرض للبناء</p>
                  </div>
                )}
              </div>

              <p className="text-sm text-[#404942] leading-relaxed">{property.description}</p>
              <p className="text-xs text-[#404942] flex items-center gap-1.5">
                <MapPin size={15} className="text-[#0f5132]" />
                {property.address || property.area}
              </p>
            </div>
          </div>
        </FadeInUp>

        {/* Agency Card */}
        {agency && (
          <FadeInUp delay={0.08}>
            <Link
              to={`/real-estate/agency/${agency.id}`}
              className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
                  <Building2 size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold">{agency.name}</h3>
                    <BadgeCheck size={15} className="text-[#cca730]" />
                  </div>
                  <p className="text-xs text-[#404942]">
                    ترخيص: {agency.licenseNumber} · {agency.dealsCount} صفقة موثقة
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#0f5132]">ملف المكتب</span>
            </Link>
          </FadeInUp>
        )}
      </div>

      <AnimatedStickyBar className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#e4ece7] p-3.5 pb-safe">
        <div className="max-w-4xl mx-auto grid grid-cols-12 gap-2.5">
          <Link
            to={`/real-estate/inspect/${property.id}`}
            className="col-span-6 min-h-[48px] bg-[#003820] text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <Calendar size={16} />
            حجز موعد معاينة
          </Link>
          <a
            href={`tel:${property.phone}`}
            className="col-span-3 min-h-[48px] bg-[#e6f4ec] text-[#0f5132] font-bold text-xs rounded-2xl flex items-center justify-center gap-1"
          >
            <Phone size={15} />
            اتصال
          </a>
          <a
            href={buildWhatsAppUrl(property.whatsapp || property.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-3 min-h-[48px] bg-[#f1f4f2] text-[#003820] font-bold text-xs rounded-2xl flex items-center justify-center gap-1"
          >
            <MessageCircle size={15} />
            واتساب
          </a>
        </div>
      </AnimatedStickyBar>
    </StackLayout>
  );
};

export const PropertyInspectionPage: React.FC = () => {
  const { propertyId } = useParams();
  const { properties, createSubmission, showToast } = useApp();
  const navigate = useNavigate();

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const property = properties.find((p) => p.id === propertyId);
  const [name, setName] = useState(savedProfile.name || '');
  const [phone, setPhone] = useState(savedProfile.phone || '');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('العصر (4:00 م - 6:00 م)');
  const [submitting, setSubmitting] = useState(false);

  if (!property) {
    return (
      <StackLayout title="حجز موعد معاينة العقار" backTo="/real-estate">
        <div className="bg-white rounded-3xl p-8 text-center text-sm text-[#404942]">
          لم يتم العثور على العقار المطلوب للمعاينة.
        </div>
      </StackLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      showToast('يرجى إدخال اسمك بشكل صحيح', 'error');
      return;
    }
    const phoneCheck = validateEgyptPhone(phone, { allowLandline: true });
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'يرجى إدخال رقم هاتف مصري صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'property_inspection',
        targetPlaceId: property.id,
        title: `طلب معاينة: ${property.title}`,
        submitterName: name,
        submitterPhone: phoneCheck.displayLocal,
        payload: {
          propertyTitle: property.title,
          preferredDate,
          preferredTime,
        },
      });
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تسجيل طلب المعاينة حالياً، يرجى المحاولة مرة أخرى',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title="حجز موعد معاينة العقار"
      subtitle={property?.title}
      backTo={`/real-estate/${property?.id || ''}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold">الاسم الكامل *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: طارق محمود"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">رقم الهاتف / الواتساب *</label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">اليوم المناسب للمعاينة</label>
                <input
                  type="date"
                  required
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">الفترة المفضلة</label>
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
                >
                  <option>الصباح (10:00 ص - 1:00 ظ)</option>
                  <option>العصر (4:00 م - 6:00 م)</option>
                  <option>المساء (6:00 م - 9:00 م)</option>
                </select>
              </div>
            </div>
          </div>
        </FadeInUp>
        <FadeInUp delay={0.08}>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] bg-[#003820] text-white font-bold text-sm rounded-2xl active:scale-[0.98] transition-transform"
          >
            {submitting ? 'جارٍ تسجيل الموعد...' : 'تأكيد طلب المعاينة واستلام رابط المتابعة'}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

export const AgencyProfileAndAddPropertyPage: React.FC = () => {
  const { agencyId } = useParams();
  const { agencies, properties, createSubmission, showToast } = useApp();
  const navigate = useNavigate();

  const agency = agencies.find((a) => a.id === agencyId);
  const agencyProps = properties.filter((p) => p.agencyId === agency?.id);

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const [advertiserRole, setAdvertiserRole] = useState('مكتب عقاري معتمد');
  const [listingType, setListingType] = useState<'sale' | 'rent'>('sale');
  const [propertyType, setPropertyType] = useState<'apartment' | 'shop' | 'land' | 'warehouse'>('apartment');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [area, setArea] = useState(
    savedProfile.area && ABU_HOMS_AREAS.includes(savedProfile.area) ? savedProfile.area : ABU_HOMS_AREAS[2]
  );
  const [contactName, setContactName] = useState(savedProfile.name || '');
  const [contactPhone, setContactPhone] = useState(savedProfile.phone || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(price);
    const numericArea = Number(areaSqm);
    if (
      title.trim().length < 4 ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0 ||
      !Number.isFinite(numericArea) ||
      numericArea <= 0 ||
      contactName.trim().length < 2
    ) {
      showToast('يرجى استكمال عنوان العقار (4 أحرف على الأقل)، السعر، المساحة، واسم المعلن', 'error');
      return;
    }
    const phoneCheck = validateEgyptPhone(contactPhone, { allowLandline: true });
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'يرجى إدخال رقم هاتف مصري صحيح', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const sub = await createSubmission({
        type: 'add_property',
        title: `إضافة عقار: ${title.trim()}`,
        submitterName: contactName,
        submitterPhone: phoneCheck.displayLocal,
        payload: {
          title: title.trim(),
          advertiserRole,
          listingType,
          propertyType,
          price: numericPrice,
          areaSqm: numericArea,
          area,
          agencyId: agency?.id || '',
          agencyName: agency?.name || '',
        },
      });
      navigate(`/track/${sub.trackingToken}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر إرسال إعلان العقار حالياً، يرجى المحاولة مرة أخرى',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StackLayout
      title={agency?.name || 'المكتب العقاري وإضافة عقار'}
      subtitle="معرض العقارات وإضافة إعلان جديد للمراجعة"
      backTo="/real-estate"
    >
      <div className="space-y-6">
        {/* Agency Summary */}
        {agency && (
          <FadeInUp delay={0.02}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-lg font-bold text-[#181c1c]">{agency.name}</h2>
                    <BadgeCheck size={17} className="text-[#cca730]" />
                  </div>
                  <p className="text-xs text-[#404942] mt-1">ترخيص نقابي ومدني رقم: {agency.licenseNumber}</p>
                  <p className="text-xs text-[#404942] mt-0.5">{agency.address}</p>
                </div>
                <span className="text-xs font-bold text-[#735c00] inline-flex items-center gap-1 tabular-nums">
                  <Star size={14} className="fill-[#cca730] text-[#cca730]" />
                  {agency.rating}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center tabular-nums">
                <div className="bg-[#f7faf8] rounded-2xl p-3">
                  <p className="text-lg font-bold text-[#003820]">{agencyProps.length}</p>
                  <p className="text-[11px] text-[#707971]">عقار معروض</p>
                </div>
                <div className="bg-[#f7faf8] rounded-2xl p-3">
                  <p className="text-lg font-bold text-[#0f5132]">{agency.dealsCount}</p>
                  <p className="text-[11px] text-[#707971]">صفقة ناجحة</p>
                </div>
                <div className="bg-[#f7faf8] rounded-2xl p-3">
                  <p className="text-lg font-bold text-[#735c00]">+{agency.yearsExperience}</p>
                  <p className="text-[11px] text-[#707971]">سنوات خبرة</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`tel:${agency.phone}`}
                  className="min-h-[46px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <Phone size={15} />
                  اتصال بالمبيعات
                </a>
                <a
                  href={buildWhatsAppUrl(agency.whatsapp || agency.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <MessageCircle size={15} />
                  واتساب المكتب
                </a>
              </div>
            </div>
          </FadeInUp>
        )}

        {/* Add Property Form */}
        <FadeInUp delay={0.08}>
          <form onSubmit={handleSubmit} className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#003820]">إضافة عقار جديد للمراجعة والاعتماد</h3>
              <p className="text-xs text-[#404942] mt-1">
                يتم فحص ومراجعة كافة البيانات بمعرفة الفريق الرقابي لدليل أبوحمص خلال 48 ساعة لحماية المواطنين من الإعلانات الوهمية.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {['مكتب عقاري معتمد', 'مالك مباشر للعقار'].map((role) => (
                <AnimatedFilterChip
                  key={role}
                  onClick={() => setAdvertiserRole(role)}
                  className={`min-h-[44px] rounded-2xl text-xs font-bold transition-colors ${
                    advertiserRole === role ? 'bg-[#003820] text-white' : 'bg-[#f1f4f2] text-[#404942]'
                  }`}
                >
                  {role}
                </AnimatedFilterChip>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <AnimatedFilterChip
                onClick={() => setListingType('sale')}
                className={`min-h-[42px] rounded-xl text-xs font-bold transition-colors ${
                  listingType === 'sale' ? 'bg-[#e6f4ec] text-[#003820] border border-[#0f5132]/40' : 'bg-[#f7faf8] text-[#404942]'
                }`}
              >
                للبيع والتمليك
              </AnimatedFilterChip>
              <AnimatedFilterChip
                onClick={() => setListingType('rent')}
                className={`min-h-[42px] rounded-xl text-xs font-bold transition-colors ${
                  listingType === 'rent' ? 'bg-[#e6f4ec] text-[#003820] border border-[#0f5132]/40' : 'bg-[#f7faf8] text-[#404942]'
                }`}
              >
                للإيجار الشهري
              </AnimatedFilterChip>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'apartment', label: 'شقة سكنية' },
                { id: 'shop', label: 'محل تجاري' },
                { id: 'land', label: 'أرض للبناء' },
                { id: 'warehouse', label: 'مخزن / ورشة' },
              ].map((pt) => (
                <AnimatedFilterChip
                  key={pt.id}
                  onClick={() => setPropertyType(pt.id as typeof propertyType)}
                  className={`min-h-[42px] rounded-xl text-xs font-bold transition-colors ${
                    propertyType === pt.id ? 'bg-[#003820] text-white' : 'bg-[#f1f4f2] text-[#404942]'
                  }`}
                >
                  {pt.label}
                </AnimatedFilterChip>
              ))}
            </div>

            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الإعلان (مثال: شقة 130م² شارع بورسعيد تشطيب حديث)"
              className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="السعر المطلوب (ج.م)"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm tabular-nums"
              />
              <input
                type="number"
                required
                min={1}
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value)}
                placeholder="المساحة (م²)"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm tabular-nums"
              />
            </div>

            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
            >
              {ABU_HOMS_AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="اسم المسؤول / المعلن"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
              <input
                type="tel"
                required
                dir="ltr"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="رقم الهاتف / الواتساب"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[50px] bg-[#003820] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <ShieldCheck size={18} />
              {submitting ? 'جارٍ إرسال الإعلان للمراجعة...' : 'إرسال الإعلان للمراجعة والاعتماد'}
            </button>
          </form>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};

export const GenericServiceCategoryPage: React.FC = () => {
  const { categorySlug } = useParams();
  const { categories, activePromoFilters, places, logAnalyticsEvent } = useApp();
  const [search, setSearch] = useState('');
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

  const category = categories.find((c) => c.slug === categorySlug);
  const baseCategoryPlaces = useMemo(
    () => places.filter((p) => p.categorySlug === categorySlug),
    [places, categorySlug]
  );

  const categoryPlaces = useMemo(() => {
    let list = selectedPromoId
      ? baseCategoryPlaces.filter((p) => isPlaceSubscribedToFilter(p, selectedPromoId))
      : [...baseCategoryPlaces];
    if (search.trim()) {
      list = list.filter((p) =>
        matchesArabicQuery(`${p.name} ${p.specialty || ''} ${p.area} ${p.address}`, search)
      );
    }
    return sortPlacesByPromoPriority(list, activePromoFilters);
  }, [baseCategoryPlaces, selectedPromoId, search, activePromoFilters]);

  return (
    <StackLayout
      title={category?.name || 'الخدمات والأنشطة'}
      subtitle={category?.description || 'دليل المنشآت والخدمات المعتمدة بأبوحمص'}
      backTo="/home"
    >
      <div className="space-y-4">
        {category && (
          <FadeInUp delay={0.02}>
            <div className="group bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <DynamicCategoryIcon
                  iconKey={category.iconKey}
                  imageUrl={category.imageUrl}
                  bgColor={category.bgColor}
                  iconColor={category.iconColor}
                  size="lg"
                />
                <div>
                  <h2 className="text-base font-bold text-[#181c1c]">{category.name}</h2>
                  <p className="text-xs text-[#404942]">
                    {categoryPlaces.length} منشأة مسجلة في هذا القسم
                  </p>
                </div>
              </div>
              <Link
                to="/places/suggest"
                className="min-h-[40px] px-3.5 rounded-xl bg-[#e6f4ec] text-[#003820] text-xs font-bold inline-flex items-center gap-1 shrink-0"
              >
                <Plus size={14} />
                أضف نشاط
              </Link>
            </div>
          </FadeInUp>
        )}

        <FadeInUp delay={0.06}>
          <div className="relative">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0f5132]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`ابحث داخل قسم ${category?.name || 'الخدمات'}...`}
              className="w-full min-h-[48px] pr-11 pl-4 rounded-2xl bg-white border border-[#e4ece7] text-sm"
            />
          </div>
        </FadeInUp>

        <PromoFilterChipsBar
          promoFilters={activePromoFilters}
          selectedFilterId={selectedPromoId}
          onSelect={setSelectedPromoId}
          placesPool={baseCategoryPlaces}
          allLabel="الكل"
        />

        {categoryPlaces.length === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-3">
            <Store size={32} className="mx-auto text-[#707971]" />
            <h3 className="text-sm font-bold text-[#181c1c]">
              لا توجد منشآت مضافة في «{category?.name || categorySlug}» بعد
            </h3>
            <p className="text-xs text-[#404942]">
              يمكنك أن تكون أول من يضيف نشاطه مجاناً في هذا القسم ليظهر لأهالي أبوحمص.
            </p>
            <Link
              to="/places/suggest"
              className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#003820] text-white text-xs font-bold"
            >
              أضف مكاناً جديداً مجاناً
            </Link>
          </AnimatedEmptyState>
        ) : (
          <AnimatedListContainer className="space-y-3">
            {categoryPlaces.map((place, idx) => {
              const openStatus = evaluateOpenStatus(
                place.hours,
                place.openNow,
                undefined,
                place.workingSchedule,
                place.is24Hours
              );
              return (
              <AnimatedListItem key={place.id} index={idx}>
                <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-3">
                  <Link to={`/places/${place.id}`} className="flex items-start gap-3.5">
                    <CivicImage src={place.imageUrl} alt={place.name} className="w-18 h-18 rounded-2xl shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <PlacePromoBadges place={place} promoFilters={activePromoFilters} maxBadges={2} />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-[#181c1c] truncate">{place.name}</h3>
                          {place.verified && <BadgeCheck size={15} className="text-[#cca730] shrink-0" />}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                            openStatus.state === 'open'
                              ? 'bg-[#e6f4ec] text-[#0f5132]'
                              : openStatus.state === 'unknown'
                                ? 'bg-[#fef3c7] text-[#735c00]'
                                : 'bg-[#f1f4f2] text-[#707971]'
                          }`}
                        >
                          {openStatus.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#146c43] line-clamp-1">{place.specialty}</p>
                      <p className="text-xs text-[#404942] flex items-center gap-1 truncate">
                        <MapPin size={12} />
                        {place.address}
                      </p>
                    </div>
                  </Link>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#e4ece7]">
                    <a
                      href={`tel:${place.phone}`}
                      onClick={() =>
                        void logAnalyticsEvent({ eventType: 'call_click', targetId: place.id, targetName: place.name })
                      }
                      className="min-h-[42px] bg-[#003820] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Phone size={14} />
                      اتصال
                    </a>
                    <a
                      href={buildWhatsAppUrl(place.whatsapp || place.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={14} />
                      واتساب
                    </a>
                    <Link
                      to={`/places/${place.id}`}
                      className="min-h-[42px] bg-[#f1f4f2] text-[#181c1c] text-xs font-bold rounded-xl flex items-center justify-center"
                    >
                      التفاصيل وQR
                    </Link>
                  </div>
                </div>
              </AnimatedListItem>
              );
            })}
          </AnimatedListContainer>
        )}
      </div>
    </StackLayout>
  );
};

export const PlaceDetailPage: React.FC = () => {
  const { placeId } = useParams();
  const { places, favorites, toggleFavorite, logAnalyticsEvent } = useApp();

  const place = places.find((p) => p.id === placeId);
  usePageSeo(
    place?.name,
    place ? `${place.specialty || 'نشاط محلي'} في ${place.area} — ${place.address}` : undefined
  );
  if (!place) {
    return (
      <StackLayout title="تفاصيل المكان" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center">لم يتم العثور على هذا المكان.</div>
      </StackLayout>
    );
  }

  const isFav = favorites.includes(place.id);
  const openStatus = evaluateOpenStatus(
    place.hours,
    place.openNow,
    undefined,
    place.workingSchedule,
    place.is24Hours
  );

  return (
    <StackLayout
      title={place.name}
      subtitle={place.area}
      rightAction={
        <button
          type="button"
          onClick={() => toggleFavorite(place.id)}
          className={`w-11 h-11 rounded-full border flex items-center justify-center ${
            isFav ? 'bg-[#003820] border-[#003820] text-white' : 'bg-white border-[#e4ece7] text-[#404942]'
          }`}
          aria-label="حفظ"
        >
          <Bookmark size={18} className={isFav ? 'fill-current' : ''} />
        </button>
      }
    >
      <div className="space-y-4">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex items-start gap-4">
              <CivicImage src={place.imageUrl} alt={place.name} className="w-22 h-22 rounded-2xl shrink-0" />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-[#181c1c]">{place.name}</h2>
                  {place.verified && <BadgeCheck size={17} className="text-[#cca730] shrink-0" />}
                </div>
                <p className="text-xs font-semibold text-[#146c43]">{place.specialty}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-[#404942] flex items-center gap-1">
                    <Clock size={13} />
                    {place.hours || 'مفتوح يومياً'}
                  </p>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                      openStatus.isOpen ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#f1f4f2] text-[#707971]'
                    }`}
                  >
                    {openStatus.label}
                  </span>
                </div>
              </div>
            </div>

            {place.description && (
              <p className="text-sm text-[#404942] leading-relaxed">{place.description}</p>
            )}

            <div className="bg-[#f7faf8] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <p className="text-xs text-[#404942] flex items-center gap-1.5">
                <MapPin size={15} className="text-[#0f5132] shrink-0" />
                {place.address}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `أبوحمص البحيرة ${place.address}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-3 rounded-xl bg-white border border-[#e4ece7] text-xs font-bold text-[#003820] inline-flex items-center gap-1 shrink-0"
              >
                <Navigation size={13} />
                الاتجاهات
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`tel:${place.phone}`}
                onClick={() =>
                  void logAnalyticsEvent({ eventType: 'call_click', targetId: place.id, targetName: place.name })
                }
                className="min-h-[48px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
              >
                <Phone size={16} />
                اتصال هاتفي
              </a>
              <a
                href={buildWhatsAppUrl(place.whatsapp || place.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                واتساب مباشر
              </a>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.08}>
          <QRCodeCard
            title={place.name}
            code={place.qrCode || `ABH-${place.id.toUpperCase()}`}
            shareUrl={`${window.location.origin}/places/${place.id}`}
            phone={place.phone}
            area={place.area}
            specialty={place.specialty}
          />
        </FadeInUp>

        <FadeInUp delay={0.12}>
          <Link
            to={`/places/report/${place.id}`}
            className="w-full min-h-[46px] bg-white border border-[#e4ece7] rounded-2xl text-xs font-bold text-[#404942] flex items-center justify-center gap-2 hover:border-[#ba1a1a]/40 hover:text-[#ba1a1a]"
          >
            <Flag size={15} />
            تعديل بيانات هذا المكان أو الإبلاغ عن خطأ
          </Link>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};
