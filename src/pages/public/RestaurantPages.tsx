import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  BadgeCheck,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  LocateFixed,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import { CivicImage, QRCodeCard, StackLayout } from '../../components/SharedUI';
import { AnimatePresence } from 'motion/react';
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
import { ABU_HOMS_AREAS } from '../../data/seedData';
import { buildWhatsAppUrl, validateEgyptPhone } from '../../lib/formatters';
import { matchesArabicQuery } from '../../lib/arabicSearch';
import { calculateDeliveryFee } from '../../lib/orderPricing';
import { evaluateOpenStatus } from '../../lib/workingHours';
import { readCitizenProfile } from '../../lib/citizenProfile';
import { usePageSeo } from '../../lib/shareCard';
import type { DeliveryCoords, RestaurantOrder } from '../../types';

export const RestaurantsListPage: React.FC = () => {
  const { places, activePromoFilters } = useApp();
  const [search, setSearch] = useState('');
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

  const baseRestaurants = useMemo(
    () => places.filter((p) => p.categorySlug === 'restaurants'),
    [places]
  );

  const restaurants = useMemo(() => {
    let list = selectedPromoId
      ? baseRestaurants.filter((r) => isPlaceSubscribedToFilter(r, selectedPromoId))
      : [...baseRestaurants];
    if (search.trim()) {
      list = list.filter((r) =>
        matchesArabicQuery(`${r.name} ${r.specialty || ''} ${r.area} ${r.address}`, search)
      );
    }
    return sortPlacesByPromoPriority(list, activePromoFilters);
  }, [baseRestaurants, selectedPromoId, search, activePromoFilters]);

  return (
    <StackLayout
      title="المطاعم والكافيهات"
      subtitle="اطلب وجبتك أونلاين وتابع التجهيز والتوصيل لحظة بلحظة"
      backTo="/home"
    >
      <div className="space-y-4">
        <FadeInUp index={0} y={14}>
          <div className="relative">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0f5132]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مطعم، مشويات، حلويات، أو كافيه..."
              className="w-full min-h-[48px] pr-11 pl-4 rounded-2xl bg-white border border-[#e4ece7] focus:border-[#0f5132] focus:outline-none text-sm"
            />
          </div>
        </FadeInUp>

        <PromoFilterChipsBar
          promoFilters={activePromoFilters}
          selectedFilterId={selectedPromoId}
          onSelect={setSelectedPromoId}
          placesPool={baseRestaurants}
          allLabel="كل المطاعم"
        />

        {restaurants.length === 0 ? (
          <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
            <UtensilsCrossed size={30} className="mx-auto text-[#707971]" />
            <h3 className="text-sm font-bold text-[#181c1c]">لا توجد مطاعم مطابقة للبحث الحالي</h3>
            <p className="text-xs text-[#404942]">جرّب مسح البحث أو اختيار «كل المطاعم».</p>
          </AnimatedEmptyState>
        ) : (
        <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {restaurants.map((rest, idx) => (
            <AnimatedListItem key={rest.id} index={idx}>
              <div className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 transition-colors rounded-3xl overflow-hidden shadow-civic-1 flex flex-col h-full">
                <div className="relative h-44 overflow-hidden">
                  <CivicImage src={rest.imageUrl} alt={rest.name} className="w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <div className="absolute top-3 right-3 left-3">
                    <PlacePromoBadges place={rest} promoFilters={activePromoFilters} maxBadges={2} />
                  </div>
                  <div className="absolute bottom-3 right-4 left-4 text-white flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold truncate">{rest.name}</h3>
                        {rest.verified && <BadgeCheck size={16} className="text-[#ffe088] shrink-0" />}
                      </div>
                      <p className="text-xs text-white/80 truncate">{rest.specialty}</p>
                    </div>
                    {typeof rest.rating === 'number' && rest.rating > 0 && (
                      <span className="bg-white/90 text-[#003820] text-xs font-bold px-2.5 py-1 rounded-xl inline-flex items-center gap-1 shrink-0 tabular-nums">
                        <Star size={12} className="fill-[#cca730] text-[#cca730]" />
                        {rest.rating}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="text-xs text-[#404942] space-y-1">
                    <p className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#0f5132] shrink-0" />
                      <span className="truncate">{rest.address}</span>
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 min-w-0">
                        <Clock size={14} className="text-[#0f5132] shrink-0" />
                        <span className="truncate">{rest.hours || 'مواعيد غير محددة'}</span>
                      </p>
                      {(() => {
                        const status = evaluateOpenStatus(
                          rest.hours,
                          rest.openNow,
                          undefined,
                          rest.workingSchedule,
                          rest.is24Hours
                        );
                        return (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              status.state === 'open'
                                ? 'bg-[#e6f4ec] text-[#0f5132]'
                                : status.state === 'unknown'
                                  ? 'bg-[#fef3c7] text-[#735c00]'
                                  : 'bg-[#f1f4f2] text-[#707971]'
                            }`}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      to={`/restaurants/${rest.id}/menu`}
                      className="min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <UtensilsCrossed size={15} />
                      استعراض المنيو
                    </Link>
                    <Link
                      to={`/restaurants/${rest.id}`}
                      className="min-h-[44px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center active:scale-95"
                    >
                      ملف المطعم
                    </Link>
                  </div>
                </div>
              </div>
            </AnimatedListItem>
          ))}
        </AnimatedListContainer>
        )}
      </div>
    </StackLayout>
  );
};

export const RestaurantProfilePage: React.FC = () => {
  const { restaurantId } = useParams();
  const { places, logAnalyticsEvent } = useApp();
  const restaurant = places.find((p) => p.id === restaurantId);
  usePageSeo(
    restaurant?.name,
    restaurant ? `${restaurant.specialty || 'مطعم وكافيه'} في ${restaurant.area} — استعرض المنيو واطلب أونلاين عبر دليل أبوحمص.` : undefined
  );

  if (!restaurant) {
    return (
      <StackLayout title="ملف المطعم" backTo="/restaurants">
        <div className="bg-white rounded-3xl p-8 text-center">لم يتم العثور على المطعم.</div>
      </StackLayout>
    );
  }

  const openStatus = evaluateOpenStatus(
    restaurant.hours,
    restaurant.openNow,
    undefined,
    restaurant.workingSchedule,
    restaurant.is24Hours
  );

  return (
    <StackLayout title={restaurant.name} subtitle={restaurant.specialty} backTo="/restaurants">
      <div className="space-y-4 pb-20">
        <FadeInUp index={0}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl overflow-hidden shadow-civic-1">
            <div className="h-52 relative">
              <CivicImage src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span
                className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold ${
                  openStatus.state === 'open'
                    ? 'bg-[#e6f4ec] text-[#003820]'
                    : openStatus.state === 'unknown'
                      ? 'bg-[#fef3c7] text-[#735c00]'
                      : 'bg-black/65 text-white'
                }`}
              >
                {openStatus.label}
              </span>
              <div className="absolute bottom-4 right-4 left-4 text-white">
                <h2 className="text-xl font-bold">{restaurant.name}</h2>
                <p className="text-xs text-white/85">{restaurant.specialty}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-[#404942] leading-relaxed">{restaurant.description}</p>
              <div className="space-y-2 text-xs text-[#404942]">
                <p className="flex items-center gap-2">
                  <MapPin size={15} className="text-[#0f5132]" />
                  {restaurant.address}
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={15} className="text-[#0f5132]" />
                  {restaurant.hours}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`tel:${restaurant.phone}`}
                  onClick={() =>
                    void logAnalyticsEvent({
                      eventType: 'call_click',
                      targetId: restaurant.id,
                      targetName: restaurant.name,
                    })
                  }
                  className="min-h-[46px] bg-[#f1f4f2] text-[#003820] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Phone size={15} />
                  اتصال مباشر
                </a>
                <a
                  href={buildWhatsAppUrl(restaurant.whatsapp || restaurant.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] bg-[#e6f4ec] text-[#0f5132] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <MessageCircle size={15} />
                  واتساب المطعم
                </a>
              </div>
            </div>
          </div>
        </FadeInUp>

        <FadeInUp index={1}>
          <QRCodeCard
            title={restaurant.name}
            code={restaurant.qrCode || `REST-${restaurant.id.toUpperCase()}`}
            shareUrl={`${window.location.origin}/restaurants/${restaurant.id}/menu`}
            subtitle="امسح الباركود لفتح المنيو الرقمي والطلب الفوري"
            phone={restaurant.phone}
            area={restaurant.area}
            specialty={restaurant.specialty}
          />
        </FadeInUp>
      </div>

      <AnimatedStickyBar className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#e4ece7] p-3.5 pb-safe">
        <div className="max-w-4xl mx-auto">
          <Link
            to={`/restaurants/${restaurant.id}/menu`}
            className="w-full min-h-[50px] bg-[#003820] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <UtensilsCrossed size={18} />
            تصفح قائمة الطعام واطلب الآن
          </Link>
        </div>
      </AnimatedStickyBar>
    </StackLayout>
  );
};

export const RestaurantMenuPage: React.FC = () => {
  const { restaurantId } = useParams();
  const { places, cart, addToCart, updateCartQty } = useApp();
  const [activeCat, setActiveCat] = useState('الكل');

  const restaurant = places.find((p) => p.id === restaurantId);
  const cartRestaurant = cart.restaurantId ? places.find((p) => p.id === cart.restaurantId) : undefined;

  const menu = restaurant?.menuItems || [];
  const categories = useMemo(
    () => ['الكل', ...Array.from(new Set(menu.map((m) => m.category)))],
    [menu]
  );

  const filteredMenu = activeCat === 'الكل' ? menu : menu.filter((m) => m.category === activeCat);
  const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (!restaurant) {
    return (
      <StackLayout title="قائمة الطعام" backTo="/restaurants">
        <div className="bg-white rounded-3xl p-6 text-center">لم يتم العثور على المنيو.</div>
      </StackLayout>
    );
  }

  return (
    <StackLayout title={`منيو ${restaurant.name}`} subtitle="اختر وجباتك وأضفها للسلة" backTo={`/restaurants/${restaurant.id}`}>
      <div className="space-y-4 pb-24">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((c) => (
            <AnimatedFilterChip
              key={c}
              onClick={() => setActiveCat(c)}
              className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeCat === c
                  ? 'bg-[#003820] text-white'
                  : 'bg-white border border-[#e4ece7] text-[#404942]'
              }`}
            >
              {c}
            </AnimatedFilterChip>
          ))}
        </div>

        {/* Menu Items */}
        <AnimatedListContainer className="space-y-3">
          {filteredMenu.map((item, idx) => {
            const inCart = cart.restaurantId === restaurant.id
              ? cart.items.find((ci) => ci.menuItemId === item.id)
              : undefined;

            return (
              <AnimatedListItem key={item.id} index={idx}>
                <div className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/35 transition-colors rounded-3xl p-4 shadow-civic-1 flex items-center gap-3.5">
                {item.imageUrl && (
                  <CivicImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-20 h-20 rounded-2xl shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#181c1c]">{item.name}</h3>
                    <span className="text-sm font-bold text-[#003820] whitespace-nowrap tabular-nums">
                      {item.price} ج.م
                    </span>
                  </div>
                  <p className="text-xs text-[#404942] leading-relaxed line-clamp-2">{item.description}</p>

                  <div className="pt-2 flex justify-end">
                    {inCart ? (
                      <div className="inline-flex items-center gap-3 bg-[#e6f4ec] rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, 1)}
                          className="w-8 h-8 rounded-lg bg-[#003820] text-white flex items-center justify-center active:scale-90 transition-transform"
                          aria-label="زيادة"
                        >
                          <Plus size={15} />
                        </button>
                        <span className="text-sm font-bold text-[#003820] min-w-[20px] text-center tabular-nums">
                          {inCart.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, -1)}
                          className="w-8 h-8 rounded-lg bg-white text-[#003820] flex items-center justify-center active:scale-90 transition-transform"
                          aria-label="إنقاص"
                        >
                          <Minus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          addToCart(restaurant.id, {
                            menuItemId: item.id,
                            name: item.name,
                            price: item.price,
                          })
                        }
                        className="min-h-[38px] px-4 rounded-xl bg-[#0f5132] text-white text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Plus size={14} />
                        إضافة للسلة
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </AnimatedListItem>
            );
          })}
        </AnimatedListContainer>
      </div>

      <AnimatePresence>
        {cartCount > 0 && cart.restaurantId && (
          <AnimatedStickyBar className="fixed bottom-3 inset-x-4 z-30 max-w-4xl mx-auto">
            <Link
              to={`/restaurants/${cart.restaurantId}/cart`}
              className="w-full min-h-[54px] px-5 bg-[#003820] text-white rounded-2xl shadow-civic-2 flex items-center justify-between gap-2 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-[#9ff1bd] text-[#003820] text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                  {cartCount}
                </span>
                <span className="text-sm font-bold truncate">
                  {cart.restaurantId === restaurant.id
                    ? 'مراجعة السلة وتأكيد الطلب'
                    : `إكمال سلة ${cartRestaurant?.name || 'المطعم السابق'}`}
                </span>
              </div>
              <span className="text-sm font-bold shrink-0 tabular-nums">{cartTotal} ج.م</span>
            </Link>
          </AnimatedStickyBar>
        )}
      </AnimatePresence>
    </StackLayout>
  );
};

export const RestaurantCartPage: React.FC = () => {
  const { restaurantId } = useParams();
  const { places, cart, updateCartQty, placeRestaurantOrder, showToast } = useApp();
  const navigate = useNavigate();

  const restaurant =
    (cart.restaurantId ? places.find((p) => p.id === cart.restaurantId) : undefined) ||
    places.find((p) => p.id === restaurantId);

  const savedProfile = useMemo(() => readCitizenProfile(), []);
  const [customerName, setCustomerName] = useState(savedProfile.name);
  const [customerPhone, setCustomerPhone] = useState(savedProfile.phone);
  const [deliveryArea, setDeliveryArea] = useState(
    savedProfile.area && ABU_HOMS_AREAS.includes(savedProfile.area) ? savedProfile.area : ABU_HOMS_AREAS[0]
  );
  const [deliveryAddress, setDeliveryAddress] = useState(savedProfile.address);
  const [locationShared, setLocationShared] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<DeliveryCoords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = calculateDeliveryFee(deliveryArea, restaurant);
  const total = subtotal + deliveryFee;

  const handleShareLocation = () => {
    if (locating) return;
    setLocationError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationShared(false);
      setDeliveryCoords(null);
      const msg = 'متصفحك لا يدعم تحديد الموقع الجغرافي (GPS) — يمكنك إتمام الطلب بالعنوان المكتوب بالتفصيل.';
      setLocationError(msg);
      showToast(msg, 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : undefined;
        setDeliveryCoords(accuracy !== undefined ? { lat, lng, accuracy } : { lat, lng });
        setLocationShared(true);
        setLocationError(null);
        setLocating(false);
        showToast('تم التقاط إحداثيات موقعك بنجاح وإرفاقها للكابتن دون المساس بالعنوان المكتوب', 'success');
      },
      (err) => {
        setLocationShared(false);
        setDeliveryCoords(null);
        setLocating(false);
        let msg = 'تعذر تحديد موقعك حالياً. يرجى المحاولة مرة أخرى أو التأكد من تفعيل خدمة الموقع (GPS).';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'تم رفض إذن الوصول للموقع الجغرافي. يمكنك السماح بالإذن والمحاولة مجدداً أو الاعتماد على العنوان المكتوب.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'انتهت مهلة تحديد الموقع. تأكد من قوة إشارة GPS واضغط إعادة المحاولة.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'خدمة الموقع غير متاحة حالياً على جهازك. اكتب أقرب علامة مميزة في العنوان.';
        }
        setLocationError(msg);
        showToast(msg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant || cart.items.length === 0) return;
    const phoneCheck = validateEgyptPhone(customerPhone);
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'رقم الهاتف غير صالح', 'error');
      return;
    }
    if (customerName.trim().length < 2 || deliveryAddress.trim().length < 3) {
      showToast('يرجى استكمال الاسم والعنوان بالتفصيل', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const order = await placeRestaurantOrder({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        customerName,
        customerPhone: phoneCheck.normalized,
        deliveryArea,
        deliveryAddress,
        locationShared: Boolean(locationShared && deliveryCoords),
        deliveryCoords: deliveryCoords || undefined,
        items: cart.items,
        subtotal,
        deliveryFee,
        total,
        notes,
      });
      navigate(`/orders/tracking/${order.id}`);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'تعذر إرسال الطلب حالياً، يرجى التأكد من البيانات والمحاولة مرة أخرى';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <StackLayout title="سلة المشتريات" backTo={`/restaurants/${restaurantId || 'el-prince'}/menu`}>
        <AnimatedEmptyState className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-4">
          <ShoppingBag size={36} className="mx-auto text-[#707971]" />
          <h3 className="text-base font-bold">سلة الطلبات فارغة حالياً</h3>
          <Link
            to={`/restaurants/${restaurantId || 'el-prince'}/menu`}
            className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#0f5132] text-white text-xs font-bold active:scale-95 transition-transform"
          >
            العودة لقائمة الطعام
          </Link>
        </AnimatedEmptyState>
      </StackLayout>
    );
  }

  return (
    <StackLayout
      title="سلة الشراء ومشاركة اللوكيشن"
      subtitle={restaurant?.name}
      backTo={`/restaurants/${restaurant?.id}/menu`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Items Review */}
        <FadeInUp index={0}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
            <h2 className="text-sm font-bold text-[#181c1c]">الأصناف المختارة</h2>
            <div className="divide-y divide-[#e4ece7]">
              {cart.items.map((item) => (
                <div key={item.menuItemId} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#181c1c]">{item.name}</p>
                    <p className="text-xs text-[#404942] tabular-nums">{item.price} ج.م × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.menuItemId, 1)}
                      className="w-8 h-8 rounded-lg bg-[#e6f4ec] text-[#003820] flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs font-bold w-5 text-center tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.menuItemId, -1)}
                      className="w-8 h-8 rounded-lg bg-[#f1f4f2] text-[#404942] flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#f7faf8] rounded-2xl p-3.5 space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between text-[#404942]">
                <span>إجمالي الأصناف</span>
                <span>{subtotal} ج.م</span>
              </div>
              <div className="flex justify-between text-[#404942]">
                <span>خدمة التوصيل ({deliveryArea.includes('قرية') ? 'قرى المركز' : 'داخل البندر'})</span>
                <span>{deliveryFee} ج.م</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#003820] pt-1 border-t border-[#e4ece7]">
                <span>الإجمالي المطلوب عند الاستلام</span>
                <span>{total} ج.م</span>
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* Delivery Info + Location Share */}
        <FadeInUp index={1}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#181c1c]">بيانات التوصيل</h2>
              <button
                type="button"
                disabled={locating}
                onClick={handleShareLocation}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-60 ${
                  locationShared && deliveryCoords
                    ? 'bg-[#e6f4ec] text-[#0f5132]'
                    : 'bg-[#003820] text-white'
                }`}
              >
                <LocateFixed size={14} className={locating ? 'animate-spin' : ''} />
                {locating
                  ? 'جارٍ تحديد الموقع...'
                  : locationShared && deliveryCoords
                    ? 'تم حفظ إحداثيات GPS (تحديث)'
                    : locationError
                      ? 'إعادة محاولة تحديد الموقع'
                      : 'مشاركة اللوكيشن (GPS)'}
              </button>
            </div>

            {locationShared && deliveryCoords && (
              <div className="bg-[#e6f4ec] border border-[#b7e2c8] rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#003820]">
                <span>
                  تم إرفاق الإحداثيات للكابتن:{' '}
                  <span className="font-mono font-bold" dir="ltr">
                    {deliveryCoords.lat.toFixed(5)}, {deliveryCoords.lng.toFixed(5)}
                  </span>
                  {deliveryCoords.accuracy ? ` (دقة ~${deliveryCoords.accuracy}م)` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLocationShared(false);
                    setDeliveryCoords(null);
                  }}
                  className="text-[11px] font-bold text-[#ba1a1a] hover:underline"
                >
                  إزالة الموقع
                </button>
              </div>
            )}

            {locationError && (
              <div role="alert" className="bg-[#fff5f5] border border-[#ffdad6] rounded-2xl px-3.5 py-2.5 text-xs text-[#93000a]">
                {locationError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">الاسم الكريم *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: محمود حسن"
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
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
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">المنطقة أو القرية</label>
              <select
                value={deliveryArea}
                onChange={(e) => setDeliveryArea(e.target.value)}
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              >
                {ABU_HOMS_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">العنوان التفصيلي وأقرب علامة مميزة *</label>
              <input
                type="text"
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="مثال: شارع بورسعيد، بجوار مسجد النصر، الدور الثالث"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold">ملاحظات للمطبخ (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: بدون شطة، زيادة طحينة"
                className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm"
              />
            </div>
          </div>
        </FadeInUp>

        <FadeInUp index={2}>
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl shadow-civic-2 active:scale-95 transition-transform"
          >
            {submitting ? 'جارٍ إرسال الطلب لمطبخ المطعم...' : `تأكيد الطلب الآن (${total} ج.م)`}
          </button>
        </FadeInUp>
      </form>
    </StackLayout>
  );
};

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState<RestaurantOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(
      doc(db, 'restaurant_orders', orderId),
      (snap) => {
        if (snap.exists()) setOrder({ ...(snap.data() as RestaurantOrder), id: snap.id });
        else setOrder(null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [orderId]);

  const steps: Array<{ key: RestaurantOrder['status']; label: string; icon: React.ReactNode }> = [
    { key: 'new', label: 'تم استلام الطلب في المطبخ', icon: <ShoppingBag size={18} /> },
    { key: 'preparing', label: 'جاري التحضير والشوي الآن', icon: <ChefHat size={18} /> },
    { key: 'on_the_way', label: 'الكابتن في الطريق إليك', icon: <Bike size={18} /> },
    { key: 'delivered', label: 'تم التسليم — بالهنا والشفا', icon: <CheckCircle2 size={18} /> },
  ];

  const statusOrder: Record<RestaurantOrder['status'], number> = {
    new: 0,
    preparing: 1,
    ready: 1,
    on_the_way: 2,
    delivered: 3,
    cancelled: -1,
  };

  if (loading) {
    return (
      <StackLayout title="متابعة طلب الوجبة" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center text-sm text-[#404942]">
          جارٍ الاتصال بمطبخ المطعم لمتابعة طلبك...
        </div>
      </StackLayout>
    );
  }

  if (!order) {
    return (
      <StackLayout title="متابعة طلب الوجبة" backTo="/home">
        <div className="bg-white rounded-3xl p-8 text-center space-y-3">
          <h3 className="font-bold">لم يتم العثور على هذا الطلب</h3>
          <Link to="/restaurants" className="inline-flex min-h-[44px] px-5 items-center rounded-2xl bg-[#0f5132] text-white text-xs font-bold">
            تصفح المطاعم
          </Link>
        </div>
      </StackLayout>
    );
  }

  const activeIdx = statusOrder[order.status];

  return (
    <StackLayout title="متابعة طلب الوجبة" subtitle={`كود الطلب: ${order.orderCode}`} backTo="/home">
      <div className="space-y-4 max-w-lg mx-auto">
        {/* Live Progress */}
        <FadeInUp index={0}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#146c43]">متابعة حية من مطبخ {order.restaurantName}</p>
                <h2 className="text-lg font-bold text-[#003820] mt-0.5">
                  {order.status === 'cancelled'
                    ? 'تم إلغاء الطلب'
                    : order.status === 'ready'
                      ? 'الطلب جاهز وبانتظار كابتن الدليفري'
                      : steps[Math.max(0, activeIdx)]?.label}
                </h2>
              </div>
              <span className="text-xs font-mono bg-[#f1f4f2] px-3 py-1.5 rounded-xl font-bold text-[#003820]">
                {order.orderCode}
              </span>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => {
                const done = activeIdx >= idx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        done ? 'bg-[#0f5132] text-white' : 'bg-[#f1f4f2] text-[#707971]'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${done ? 'font-bold text-[#003820]' : 'text-[#707971]'}`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeInUp>

        {/* Captain Card if Assigned */}
        {order.captainName && (
          <FadeInUp index={1}>
            <div className="bg-[#003820] text-white rounded-3xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#9ff1bd] text-[#003820] flex items-center justify-center">
                  <Bike size={20} />
                </div>
                <div>
                  <p className="text-xs text-[#9ff1bd]">كابتن التوصيل المعتمد</p>
                  <p className="text-sm font-bold">{order.captainName}</p>
                </div>
              </div>
              {order.captainPhone && (
                <a
                  href={`tel:${order.captainPhone}`}
                  className="min-h-[42px] px-4 rounded-xl bg-white text-[#003820] text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Phone size={14} />
                  اتصال
                </a>
              )}
            </div>
          </FadeInUp>
        )}

        {/* Order Details */}
        <FadeInUp index={2}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 space-y-3 text-sm">
            <h3 className="font-bold text-[#181c1c]">ملخص الطلب</h3>
            <div className="divide-y divide-[#e4ece7]">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2 flex justify-between text-xs tabular-nums">
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span className="font-bold">{item.price * item.quantity} ج.م</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[#e4ece7] flex justify-between font-bold text-[#003820] tabular-nums">
              <span>الإجمالي عند الاستلام</span>
              <span>{order.total} ج.م</span>
            </div>
            <p className="text-xs text-[#404942]">العنوان: {order.deliveryAddress}</p>
            {order.deliveryCoords && (
              <a
                href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0f5132] hover:underline"
              >
                <MapPin size={14} />
                موقع التوصيل المرفق على الخريطة (GPS)
              </a>
            )}
          </div>
        </FadeInUp>

        <FadeInUp index={3}>
          <Link
            to="/home"
            className="w-full min-h-[46px] bg-[#f1f4f2] text-[#003820] font-bold text-xs rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          >
            العودة للرئيسية (سيبقى شريط المتابعة الحية نشطاً)
          </Link>
        </FadeInUp>
      </div>
    </StackLayout>
  );
};
