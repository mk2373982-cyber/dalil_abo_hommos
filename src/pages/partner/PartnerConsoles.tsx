import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  PlayCircle,
  Stethoscope,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PartnerConsoleGate, StackLayout } from '../../components/SharedUI';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import { playNotificationChime, triggerVibration } from '../../lib/alertSounds';

/** 1. Clinic Secretary Live Queue Console (SCREEN_109 / SCREEN_107) */
export const ClinicConsolePage: React.FC = () => {
  const {
    clinicQueues,
    clinicTickets,
    updateClinicQueueState,
    updateClinicTicketStatus,
    showToast,
  } = useApp();
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    clinicQueues[0]?.doctorId || 'ahmed-mahmoud'
  );

  const activeQueue =
    clinicQueues.find((q) => q.doctorId === selectedDoctorId) || clinicQueues[0];

  const doctorTickets = useMemo(
    () =>
      clinicTickets
        .filter((t) => t.doctorId === activeQueue?.doctorId)
        .sort((a, b) => a.ticketNumber - b.ticketNumber),
    [clinicTickets, activeQueue?.doctorId]
  );

  const waitingTickets = doctorTickets.filter(
    (t) => t.status === 'waiting' || t.status === 'called' || t.status === 'in_room'
  );

  const handleCallNext = async () => {
    if (!activeQueue) return;
    const nextNum = activeQueue.currentNumber + 1;
    try {
      await updateClinicQueueState(activeQueue.doctorId, {
        currentNumber: nextNum,
        lastTicketNumber: Math.max(activeQueue.lastTicketNumber, nextNum),
        status: 'open',
        pausedReason: '',
      });
      const matchedTicket = doctorTickets.find((t) => t.ticketNumber === nextNum);
      if (matchedTicket) {
        await updateClinicTicketStatus(matchedTicket.id, 'called');
      }
    } catch {
      showToast('تعذر تحديث الدور حالياً، يرجى المحاولة مجدداً', 'error');
    }
  };

  return (
    <PartnerConsoleGate
      title="شاشة سكرتارية ونداء العيادة"
      description="واجهة تشغيل حية لإدارة طابور العيادة ونداء المرضى؛ كل تحديث ينعكس لحظياً على شاشات المرضى."
    >
      <StackLayout
        title="لوحة سكرتارية العيادة"
        subtitle="التحكم الحي في طابور الكشف"
        backTo="/admin/dashboard"
        rightAction={
          <Link
            to="/medical"
            className="min-h-[38px] px-3 rounded-xl bg-[#e6f4ec] text-[#003820] text-xs font-bold flex items-center"
          >
            صفحة الجمهور
          </Link>
        }
      >
        <div className="space-y-5">
          {/* Doctor Selector */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {clinicQueues.map((q) => (
              <AnimatedFilterChip
                key={q.doctorId}
                active={activeQueue?.doctorId === q.doctorId}
                onClick={() => setSelectedDoctorId(q.doctorId)}
                className={`min-h-[42px] px-4 rounded-2xl text-xs font-bold whitespace-nowrap ${
                  activeQueue?.doctorId === q.doctorId
                    ? 'bg-[#003820] text-white'
                    : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                {q.doctorName}
              </AnimatedFilterChip>
            ))}
          </div>

          {activeQueue && (
            <FadeInUp delay={0.02}>
              <div className="bg-[#003820] text-white rounded-3xl p-6 shadow-civic-2 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[#9ff1bd] flex items-center gap-1.5">
                    <Stethoscope size={15} />
                    {activeQueue.doctorName}
                  </p>
                  <p className="text-xs text-white/75 mt-0.5">{activeQueue.clinicAddress}</p>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                    activeQueue.status === 'emergency'
                      ? 'bg-[#ba1a1a] text-white'
                      : activeQueue.status === 'paused'
                        ? 'bg-[#cca730] text-[#241a00]'
                        : 'bg-[#9ff1bd] text-[#003820]'
                  }`}
                >
                  {activeQueue.status === 'emergency'
                    ? 'حالة طارئة نشطة'
                    : activeQueue.status === 'paused'
                      ? 'استراحة مؤقتة'
                      : 'العيادة تستقبل المرضى'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center tabular-nums">
                <div className="bg-white/10 rounded-2xl p-4">
                  <p className="text-xs text-white/75">الدور الحالي داخل الكشف</p>
                  <p className="text-4xl font-bold mt-1 text-[#ffe088]">#{activeQueue.currentNumber}</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-4">
                  <p className="text-xs text-white/75">آخر رقم محجوز اليوم</p>
                  <p className="text-4xl font-bold mt-1">#{activeQueue.lastTicketNumber}</p>
                </div>
              </div>

              {/* Primary Operational Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleCallNext}
                  className="min-h-[52px] bg-[#9ff1bd] text-[#003820] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                >
                  <BellRing size={18} />
                  نداء الدور التالي (#{activeQueue.currentNumber + 1})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void updateClinicQueueState(activeQueue.doctorId, {
                      status: activeQueue.status === 'emergency' ? 'open' : 'emergency',
                    })
                  }
                  className={`min-h-[52px] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 ${
                    activeQueue.status === 'emergency'
                      ? 'bg-white text-[#93000a]'
                      : 'bg-[#ba1a1a] text-white'
                  }`}
                >
                  <AlertTriangle size={17} />
                  {activeQueue.status === 'emergency' ? 'إنهاء حالة الطوارئ' : 'إدخال حالة طارئة'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void updateClinicQueueState(activeQueue.doctorId, {
                      status: activeQueue.status === 'paused' ? 'open' : 'paused',
                      pausedReason:
                        activeQueue.status === 'paused'
                          ? ''
                          : 'الطبيب في استراحة قصيرة لمدة 15 دقيقة',
                    })
                  }
                  className="min-h-[52px] bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                >
                  {activeQueue.status === 'paused' ? <PlayCircle size={17} /> : <PauseCircle size={17} />}
                  {activeQueue.status === 'paused' ? 'استئناف الكشف' : 'إيقاف مؤقت'}
                </button>
              </div>
              </div>
            </FadeInUp>
          )}

          {/* Live Patient Tickets Queue */}
          <FadeInUp delay={0.08}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                  <Users size={17} className="text-[#0f5132]" />
                  قائمة الحجوزات الواردة من التطبيق ({waitingTickets.length})
                </h2>
              </div>

              {doctorTickets.length === 0 ? (
                <AnimatedEmptyState>
                  <p className="text-xs text-[#707971] py-6 text-center">
                    لا توجد تذاكر محجوزة إلكترونياً لهذه العيادة بعد. جرّب حجز دور من صفحة الأطباء لتراه يظهر هنا فورياً!
                  </p>
                </AnimatedEmptyState>
              ) : (
                <div className="divide-y divide-[#e4ece7]">
                {doctorTickets.map((t, idx) => (
                  <FadeInUp key={t.id} index={idx} y={14}>
                    <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#003820] font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                          #{t.ticketNumber}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[#181c1c]">{t.patientName}</p>
                          <p className="text-xs text-[#404942]">
                            {t.visitType} · {t.patientPhone} {t.notes ? `· ${t.notes}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.status !== 'completed' && (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateClinicTicketStatus(t.id, 'called');
                                  if (activeQueue) {
                                    await updateClinicQueueState(activeQueue.doctorId, {
                                      currentNumber: t.ticketNumber,
                                      lastTicketNumber: Math.max(activeQueue.lastTicketNumber, t.ticketNumber),
                                      status: 'open',
                                    });
                                  }
                                } catch {
                                  showToast('تعذر نداء المريض حالياً', 'error');
                                }
                              }}
                              className="min-h-[38px] px-3 rounded-xl bg-[#003820] text-white text-xs font-bold"
                            >
                              نداء الآن
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateClinicTicketStatus(t.id, 'completed')}
                              className="min-h-[38px] px-3 rounded-xl bg-[#e6f4ec] text-[#0f5132] text-xs font-bold"
                            >
                              تم الكشف
                            </button>
                          </>
                        )}
                        {t.status === 'completed' && (
                          <span className="text-xs font-bold text-[#146c43]">مكتمل</span>
                        )}
                      </div>
                    </div>
                  </FadeInUp>
                ))}
                </div>
              )}
            </div>
          </FadeInUp>
        </div>
      </StackLayout>
    </PartnerConsoleGate>
  );
};

/** 2. Restaurant Kitchen Display System (KDS) — SCREEN_91 */
export const KitchenKDSPage: React.FC = () => {
  const { restaurantOrders, places, updateRestaurantOrderStatus, showToast } = useApp();
  const [filter, setFilter] = useState<'active' | 'delivered'>('active');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const restaurantOptions = useMemo(() => {
    const map = new Map<string, string>();
    places
      .filter((p) => p.categorySlug === 'restaurants')
      .forEach((p) => map.set(p.id, p.name));
    restaurantOrders.forEach((o) => {
      if (o.restaurantId && !map.has(o.restaurantId)) {
        map.set(o.restaurantId, o.restaurantName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [places, restaurantOrders]);

  const scopedOrders = useMemo(
    () =>
      selectedRestaurantId === 'all'
        ? restaurantOrders
        : restaurantOrders.filter((o) => o.restaurantId === selectedRestaurantId),
    [restaurantOrders, selectedRestaurantId]
  );

  // Zero-cost real-time audio alert on newly arriving active orders
  useEffect(() => {
    const activeIds = scopedOrders
      .filter((o) => o.status === 'new')
      .map((o) => o.id);

    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = new Set(activeIds);
      return;
    }

    const newlyArrived = activeIds.filter((id) => !knownOrderIdsRef.current!.has(id));
    knownOrderIdsRef.current = new Set(activeIds);

    if (newlyArrived.length > 0) {
      if (soundEnabled) {
        playNotificationChime('order');
        triggerVibration([200, 100, 200]);
      }
      showToast(`وصل طلب مطعم جديد! (${newlyArrived.length})`, 'success');
    }
  }, [scopedOrders, soundEnabled, showToast]);

  const list = scopedOrders.filter((o) =>
    filter === 'active'
      ? o.status !== 'delivered' && o.status !== 'cancelled'
      : o.status === 'delivered' || o.status === 'cancelled'
  );

  const nextAction = (status: string) => {
    if (status === 'new') return { next: 'preparing' as const, label: 'بدء التجهيز بالمطبخ' };
    if (status === 'preparing') return { next: 'ready' as const, label: 'جاهز لاستلام الكابتن' };
    if (status === 'ready') return { next: 'on_the_way' as const, label: 'تسليم للكابتن (في الطريق)' };
    return { next: 'delivered' as const, label: 'تأكيد التسليم للعميل' };
  };

  return (
    <PartnerConsoleGate
      title="لوحة مطبخ وكاشير المطعم (KDS)"
      description="استقبل طلبات الوجبات الحية وحدّث مراحل التجهيز لتنعكس فوراً في شاشة متابعة العميل."
    >
      <StackLayout
        title="مطبخ وكاشير المطعم"
        subtitle="تحديث حي مباشر مع العميل والكابتن"
        backTo="/admin/dashboard"
        rightAction={
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playNotificationChime('gentle');
            }}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-[#e6f4ec] text-[#003820]'
                : 'bg-[#f1f4f2] text-[#707971]'
            }`}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="hidden sm:inline">{soundEnabled ? 'التنبيه الصوتي يعمل' : 'الصوت مكتوم'}</span>
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AnimatedFilterChip
                active={filter === 'active'}
                onClick={() => setFilter('active')}
                className={`min-h-[42px] px-4 rounded-2xl text-xs font-bold ${
                  filter === 'active' ? 'bg-[#003820] text-white' : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                طلبات قيد التشغيل ({scopedOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length})
              </AnimatedFilterChip>
              <AnimatedFilterChip
                active={filter === 'delivered'}
                onClick={() => setFilter('delivered')}
                className={`min-h-[42px] px-4 rounded-2xl text-xs font-bold ${
                  filter === 'delivered' ? 'bg-[#003820] text-white' : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                المكتملة
              </AnimatedFilterChip>
            </div>
            {restaurantOptions.length > 0 && (
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                aria-label="تصفية حسب المطعم"
                className="min-h-[42px] px-3.5 rounded-2xl bg-white border border-[#e4ece7] text-xs font-bold text-[#003820] outline-none"
              >
                <option value="all">كل المطاعم</option>
                {restaurantOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {list.length === 0 ? (
            <AnimatedEmptyState>
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
                <ChefHat size={34} className="mx-auto text-[#707971]" />
                <p className="text-sm font-bold text-[#181c1c]">لا توجد طلبات في هذه القائمة حالياً</p>
                <p className="text-xs text-[#404942]">
                  عند إرسال أي طلب من منيو «مطعم البرنس» سيظهر هنا لحظياً عبر Firestore.
                </p>
              </div>
            </AnimatedEmptyState>
          ) : (
            <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {list.map((order, idx) => {
                const action = nextAction(order.status);
                return (
                  <AnimatedListItem key={order.id} index={idx} className="h-full">
                    <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4 h-full">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-[#707971]">{order.orderCode}</p>
                          <h3 className="text-base font-bold text-[#003820]">{order.restaurantName}</h3>
                          <p className="text-xs text-[#404942]">{order.customerName} · {order.customerPhone}</p>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-xl bg-[#fef3c7] text-[#735c00]">
                          {order.status === 'new'
                            ? 'طلب جديد'
                            : order.status === 'preparing'
                              ? 'جاري التجهيز'
                              : order.status === 'ready'
                                ? 'جاهز للكابتن'
                                : order.status === 'on_the_way'
                                  ? 'مع الكابتن'
                                  : 'تم التسليم'}
                        </span>
                      </div>

                      <div className="bg-[#f7faf8] rounded-2xl p-3 space-y-1.5 text-xs">
                        {order.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between font-medium tabular-nums">
                            <span>{item.quantity} × {item.name}</span>
                            <span>{item.price * item.quantity} ج.م</span>
                          </div>
                        ))}
                        <div className="pt-1.5 border-t border-[#e4ece7] flex justify-between font-bold text-[#003820] tabular-nums">
                          <span>الإجمالي</span>
                          <span>{order.total} ج.م</span>
                        </div>
                      </div>

                      <p className="text-xs text-[#404942] flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#0f5132] shrink-0" />
                        {order.deliveryAddress}
                      </p>

                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void updateRestaurantOrderStatus(order.id, { status: action.next })}
                            className="flex-1 min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            {action.label}
                            <ArrowLeft size={14} />
                          </button>
                          <a
                            href={`tel:${order.customerPhone}`}
                            aria-label="اتصال بالعميل"
                            className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center shrink-0"
                          >
                            <Phone size={17} />
                          </a>
                        </div>
                      )}
                    </div>
                  </AnimatedListItem>
                );
              })}
            </AnimatedListContainer>
          )}
        </div>
      </StackLayout>
    </PartnerConsoleGate>
  );
};

/** 3. Delivery Captain Live Dashboard — SCREEN_68 */
export const CaptainDashboardPage: React.FC = () => {
  const {
    deliveryRides,
    restaurantOrders,
    updateDeliveryRideStatus,
    updateRestaurantOrderStatus,
    user,
    showToast,
  } = useApp();
  const [captainName, setCaptainName] = useState(() => {
    try {
      return localStorage.getItem('abh_captain_name') || user?.displayName || '';
    } catch {
      return user?.displayName || '';
    }
  });
  const [captainPhone, setCaptainPhone] = useState(() => {
    try {
      return localStorage.getItem('abh_captain_phone') || '';
    } catch {
      return '';
    }
  });

  const handleCaptainNameChange = (val: string) => {
    setCaptainName(val);
    try {
      localStorage.setItem('abh_captain_name', val);
    } catch {
      // ignore storage errors
    }
  };

  const handleCaptainPhoneChange = (val: string) => {
    setCaptainPhone(val);
    try {
      localStorage.setItem('abh_captain_phone', val);
    } catch {
      // ignore storage errors
    }
  };

  const ensureCaptainIdentity = () => {
    if (captainName.trim().length < 2 || captainPhone.trim().length < 8) {
      showToast('يرجى إدخال اسم الكابتن ورقم هاتفه الصحيح أولاً قبل قبول الطلب', 'error');
      return false;
    }
    return true;
  };

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const knownDispatchIdsRef = useRef<Set<string> | null>(null);

  const activeRides = deliveryRides.filter((r) => r.status !== 'delivered' && r.status !== 'cancelled');
  const readyFoodOrders = restaurantOrders.filter((o) => o.status === 'ready' || o.status === 'on_the_way');

  // Zero-cost real-time audio alert when a new pending ride or ready food order arrives
  useEffect(() => {
    const incomingIds = [
      ...activeRides.filter((r) => r.status === 'pending').map((r) => `ride:${r.id}`),
      ...readyFoodOrders.filter((o) => o.status === 'ready').map((o) => `food:${o.id}`),
    ];

    if (knownDispatchIdsRef.current === null) {
      knownDispatchIdsRef.current = new Set(incomingIds);
      return;
    }

    const newlyArrived = incomingIds.filter((id) => !knownDispatchIdsRef.current!.has(id));
    knownDispatchIdsRef.current = new Set(incomingIds);

    if (newlyArrived.length > 0) {
      if (soundEnabled) {
        playNotificationChime('order');
        triggerVibration([220, 100, 220]);
      }
      showToast('يوجد مشوار أو طلب توصيل جاهز جديد!', 'success');
    }
  }, [activeRides, readyFoodOrders, soundEnabled, showToast]);

  return (
    <PartnerConsoleGate
      title="لوحة كابتن الدليفري الموحد"
      description="استقبل مشاوير التوصيل وطلبات المطاعم الجاهزة وحدّث مسارك مباشرة ليرى العميل حالتك لحظياً."
    >
      <StackLayout
        title="لوحة كابتن الدليفري"
        subtitle="مشاوير أبوحمص وتوصيل المطاعم"
        backTo="/admin/dashboard"
        rightAction={
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playNotificationChime('gentle');
            }}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-[#e6f4ec] text-[#003820]'
                : 'bg-[#f1f4f2] text-[#707971]'
            }`}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="hidden sm:inline">{soundEnabled ? 'التنبيه يعمل' : 'مكتوم'}</span>
          </button>
        }
      >
        <div className="space-y-5">
          {/* Captain Identity Bar */}
          <FadeInUp delay={0.02}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={captainName}
                onChange={(e) => handleCaptainNameChange(e.target.value)}
                placeholder="اسم الكابتن (مطلوب قبل قبول المشوار)"
                className="min-h-[44px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm font-bold"
              />
              <input
                type="tel"
                dir="ltr"
                value={captainPhone}
                onChange={(e) => handleCaptainPhoneChange(e.target.value)}
                placeholder="رقم هاتف الكابتن (01XXXXXXXXX)"
                className="min-h-[44px] px-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7dbd9] text-sm text-right tabular-nums"
              />
            </div>
          </FadeInUp>

          {/* Unified Delivery Rides */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#003820] flex items-center gap-2">
              <Bike size={18} />
              مشاوير الدليفري الموحد النشطة ({activeRides.length})
            </h2>

            {activeRides.length === 0 ? (
              <AnimatedEmptyState>
                <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 text-center text-xs text-[#707971]">
                  لا توجد مشاوير دليفري معلقة حالياً.
                </div>
              </AnimatedEmptyState>
            ) : (
              <AnimatedListContainer className="space-y-3">
                {activeRides.map((ride, idx) => (
                  <AnimatedListItem key={ride.id} index={idx}>
                    <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[#707971]">{ride.rideCode}</span>
                        <span className="text-sm font-bold text-[#003820] tabular-nums">{ride.estimatedFee ?? 20} ج.م</span>
                      </div>
                      <div className="text-xs text-[#404942] space-y-1">
                        <p><strong>استلام من:</strong> {ride.pickupArea} {ride.pickupDetails}</p>
                        <p><strong>تسليم إلى:</strong> {ride.dropoffArea} {ride.dropoffDetails}</p>
                        <p className="flex items-center gap-1"><Package size={13} /> {ride.itemDescription}</p>
                        <p>العميل: {ride.customerName} ({ride.customerPhone})</p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {ride.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!ensureCaptainIdentity()) return;
                              void updateDeliveryRideStatus(ride.id, {
                                status: 'accepted',
                                captainName: captainName.trim(),
                                captainPhone: captainPhone.trim(),
                              });
                            }}
                            className="flex-1 min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl"
                          >
                            قبول المشوار
                          </button>
                        )}
                        {ride.status === 'accepted' && (
                          <button
                            type="button"
                            onClick={() => void updateDeliveryRideStatus(ride.id, { status: 'picked_up' })}
                            className="flex-1 min-h-[44px] bg-[#0f5132] text-white text-xs font-bold rounded-2xl"
                          >
                            تم الاستلام
                          </button>
                        )}
                        {ride.status === 'picked_up' && (
                          <button
                            type="button"
                            onClick={() => void updateDeliveryRideStatus(ride.id, { status: 'on_the_way' })}
                            className="flex-1 min-h-[44px] bg-[#146c43] text-white text-xs font-bold rounded-2xl"
                          >
                            في الطريق للعميل
                          </button>
                        )}
                        {ride.status === 'on_the_way' && (
                          <button
                            type="button"
                            onClick={() => void updateDeliveryRideStatus(ride.id, { status: 'delivered' })}
                            className="flex-1 min-h-[44px] bg-[#003820] text-[#9ff1bd] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 size={16} />
                            تأكيد التسليم
                          </button>
                        )}
                        <a
                          href={`tel:${ride.customerPhone}`}
                          aria-label="اتصال بالعميل"
                          className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center"
                        >
                          <Phone size={17} />
                        </a>
                      </div>
                    </div>
                  </AnimatedListItem>
                ))}
              </AnimatedListContainer>
            )}
          </section>

          {/* Ready Restaurant Orders for Captain Pickup */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#003820] flex items-center gap-2">
              <Clock size={18} />
              طلبات مطاعم جاهزة للتوصيل ({readyFoodOrders.length})
            </h2>
            {readyFoodOrders.length === 0 ? (
              <AnimatedEmptyState>
                <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 text-center text-xs text-[#707971]">
                  لا توجد طلبات مطاعم جاهزة للاستلام الآن.
                </div>
              </AnimatedEmptyState>
            ) : (
              <AnimatedListContainer className="space-y-3">
                {readyFoodOrders.map((order, idx) => (
                  <AnimatedListItem key={order.id} index={idx}>
                    <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-2.5">
                      <div className="flex justify-between">
                        <span className="font-bold text-sm">{order.restaurantName} ({order.orderCode})</span>
                        <span className="font-bold text-sm text-[#003820] tabular-nums">{order.total} ج.م</span>
                      </div>
                      <p className="text-xs text-[#404942]">التوصيل إلى: {order.deliveryAddress}</p>
                      <div className="flex gap-2">
                        {order.status === 'ready' ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!ensureCaptainIdentity()) return;
                              void updateRestaurantOrderStatus(order.id, {
                                status: 'on_the_way',
                                captainName: captainName.trim(),
                                captainPhone: captainPhone.trim(),
                              });
                            }}
                            className="flex-1 min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl"
                          >
                            استلام الوجبة والانطلاق للعميل
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updateRestaurantOrderStatus(order.id, { status: 'delivered' })}
                            className="flex-1 min-h-[44px] bg-[#146c43] text-white text-xs font-bold rounded-2xl"
                          >
                            تأكيد تسليم الوجبة للعميل
                          </button>
                        )}
                        <a
                          href={`tel:${order.customerPhone}`}
                          aria-label="اتصال بالعميل"
                          className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center"
                        >
                          <Phone size={16} />
                        </a>
                      </div>
                    </div>
                  </AnimatedListItem>
                ))}
              </AnimatedListContainer>
            )}
          </section>
        </div>
      </StackLayout>
    </PartnerConsoleGate>
  );
};
