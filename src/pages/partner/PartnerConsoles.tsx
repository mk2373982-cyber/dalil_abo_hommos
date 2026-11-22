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
  Lock,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  PlayCircle,
  RotateCcw,
  Stethoscope,
  Users,
  Volume2,
  VolumeX,
  XCircle,
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
import { validateEgyptPhone } from '../../lib/formatters';
import { getCairoDateString } from '../../lib/workingHours';

/** 1. Clinic Secretary Live Queue Console (SCREEN_109 / SCREEN_107) */
export const ClinicConsolePage: React.FC = () => {
  const {
    clinicQueues,
    clinicTickets,
    isAdmin,
    isAuditor,
    managedPlaceIds,
    updateClinicQueueState,
    callNextClinicTicket,
    resetClinicDaySession,
    updateClinicTicketStatus,
    hasMoreClinicTickets,
    loadMoreClinicTickets,
    showToast,
  } = useApp();

  const visibleQueues = useMemo(() => {
    if (isAdmin) return clinicQueues;
    return clinicQueues.filter((q) => managedPlaceIds.includes(q.doctorId));
  }, [clinicQueues, isAdmin, managedPlaceIds]);

  const [selectedDoctorId, setSelectedDoctorId] = useState(
    visibleQueues[0]?.doctorId || ''
  );
  const [dateScope, setDateScope] = useState<'today' | 'all'>('today');
  const [busyAction, setBusyAction] = useState(false);

  const todayCairo = getCairoDateString();

  useEffect(() => {
    if (visibleQueues.length === 0) return;
    if (!visibleQueues.some((q) => q.doctorId === selectedDoctorId)) {
      setSelectedDoctorId(visibleQueues[0].doctorId);
    }
  }, [visibleQueues, selectedDoctorId]);

  const activeQueue =
    visibleQueues.find((q) => q.doctorId === selectedDoctorId) || visibleQueues[0];

  const doctorTickets = useMemo(() => {
    if (!activeQueue) return [];
    return clinicTickets
      .filter((t) => {
        if (t.doctorId !== activeQueue.doctorId) return false;
        if (dateScope === 'today') {
          const tDate = t.sessionDate || (t.createdAt ? t.createdAt.slice(0, 10) : todayCairo);
          return tDate === (activeQueue.sessionDate || todayCairo);
        }
        return true;
      })
      .sort((a, b) => a.ticketNumber - b.ticketNumber);
  }, [clinicTickets, activeQueue, dateScope, todayCairo]);

  const waitingTickets = doctorTickets.filter(
    (t) => t.status === 'waiting' || t.status === 'called' || t.status === 'in_room'
  );

  const handleCallNext = async () => {
    if (!activeQueue || isAuditor) return;
    setBusyAction(true);
    try {
      await callNextClinicTicket(activeQueue.doctorId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر نداء الدور التالي حالياً', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetDay = async () => {
    if (!activeQueue || isAuditor) return;
    setBusyAction(true);
    try {
      await resetClinicDaySession(activeQueue.doctorId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تهيئة جلسة اليوم الجديد', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <PartnerConsoleGate
      requiredScope="clinic"
      title="شاشة سكرتارية ونداء العيادة"
      description="واجهة تشغيل معزولة لإدارة طابور العيادة المصرّح لك بها ونداء المرضى لحظياً."
    >
      <StackLayout
        title="لوحة سكرتارية العيادة"
        subtitle={`جلسة اليوم (${todayCairo}) — تحكم حي في طابور الكشف`}
        backTo={isAdmin ? '/admin/dashboard' : '/home'}
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
          {isAuditor && (
            <div className="bg-[#e0f2fe] border border-[#bae6fd] rounded-2xl px-4 py-3 text-xs font-bold text-[#0369a1]">
              وضع المراجع (قراءة فقط): لا يمكنك تعديل الطابور أو تغيير حالات التذاكر.
            </div>
          )}

          {visibleQueues.length === 0 ? (
            <AnimatedEmptyState>
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2">
                <Stethoscope size={32} className="mx-auto text-[#707971]" />
                <p className="text-sm font-bold text-[#181c1c]">لا توجد عيادات مرتبطة بحسابك حالياً</p>
                <p className="text-xs text-[#404942]">
                  اطلب من الإدارة ربط حسابك بالعيادة المخصصة لك من شاشة «الإعدادات العامة».
                </p>
              </div>
            </AnimatedEmptyState>
          ) : (
            <>
              {/* Doctor Selector */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {visibleQueues.map((q) => (
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
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#9ff1bd] flex items-center gap-1.5">
                          <Stethoscope size={15} />
                          {activeQueue.doctorName}
                        </p>
                        <p className="text-xs text-white/75 mt-0.5">
                          {activeQueue.clinicAddress} · جلسة {activeQueue.sessionDate || todayCairo}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                          activeQueue.status === 'closed'
                            ? 'bg-white/20 text-white'
                            : activeQueue.status === 'emergency'
                              ? 'bg-[#ba1a1a] text-white'
                              : activeQueue.status === 'paused'
                                ? 'bg-[#cca730] text-[#241a00]'
                                : 'bg-[#9ff1bd] text-[#003820]'
                        }`}
                      >
                        {activeQueue.status === 'closed'
                          ? 'العيادة مغلقة'
                          : activeQueue.status === 'emergency'
                            ? 'حالة طارئة نشطة'
                            : activeQueue.status === 'paused'
                              ? 'استراحة مؤقتة'
                              : 'العيادة تستقبل المرضى'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center tabular-nums">
                      <div className="bg-white/10 rounded-2xl p-4">
                        <p className="text-xs text-white/75">الدور الحالي داخل الكشف</p>
                        <p className="text-4xl font-bold mt-1 text-[#ffe088]">
                          {activeQueue.currentNumber > 0 ? `#${activeQueue.currentNumber}` : '—'}
                        </p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-4">
                        <p className="text-xs text-white/75">آخر رقم محجوز في الجلسة</p>
                        <p className="text-4xl font-bold mt-1">
                          {activeQueue.lastTicketNumber > 0 ? `#${activeQueue.lastTicketNumber}` : '0'}
                        </p>
                      </div>
                    </div>

                    {/* Primary Operational Controls */}
                    {!isAuditor && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleCallNext()}
                          className="min-h-[50px] bg-[#9ff1bd] text-[#003820] font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
                        >
                          <BellRing size={17} />
                          نداء الدور التالي
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            void updateClinicQueueState(activeQueue.doctorId, {
                              status: activeQueue.status === 'closed' ? 'open' : 'closed',
                              pausedReason: '',
                            })
                          }
                          className={`min-h-[50px] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 ${
                            activeQueue.status === 'closed'
                              ? 'bg-[#146c43] text-white'
                              : 'bg-white/15 hover:bg-white/25 text-white'
                          }`}
                        >
                          <Lock size={16} />
                          {activeQueue.status === 'closed' ? 'فتح الحجز الآن' : 'إغلاق الحجز'}
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            void updateClinicQueueState(activeQueue.doctorId, {
                              status: activeQueue.status === 'paused' ? 'open' : 'paused',
                              pausedReason:
                                activeQueue.status === 'paused'
                                  ? ''
                                  : 'الطبيب في استراحة قصيرة لمدة 15 دقيقة',
                            })
                          }
                          className="min-h-[50px] bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                        >
                          {activeQueue.status === 'paused' ? (
                            <PlayCircle size={17} />
                          ) : (
                            <PauseCircle size={17} />
                          )}
                          {activeQueue.status === 'paused' ? 'استئناف الكشف' : 'إيقاف مؤقت'}
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            void updateClinicQueueState(activeQueue.doctorId, {
                              status: activeQueue.status === 'emergency' ? 'open' : 'emergency',
                            })
                          }
                          className={`min-h-[50px] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 ${
                            activeQueue.status === 'emergency'
                              ? 'bg-white text-[#93000a]'
                              : 'bg-[#ba1a1a] text-white'
                          }`}
                        >
                          <AlertTriangle size={16} />
                          {activeQueue.status === 'emergency' ? 'إنهاء الطوارئ' : 'حالة طارئة'}
                        </button>
                      </div>
                    )}

                    {!isAuditor && (
                      <div className="flex justify-end pt-1 border-t border-white/15">
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleResetDay()}
                          className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <RotateCcw size={14} />
                          فتح جلسة يوم جديد ({todayCairo}) وتصفير العداد
                        </button>
                      </div>
                    )}
                  </div>
                </FadeInUp>
              )}

              {/* Live Patient Tickets Queue */}
              <FadeInUp delay={0.08}>
                <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                      <Users size={17} className="text-[#0f5132]" />
                      قائمة الحجوزات ({waitingTickets.length} قيد الانتظار / {doctorTickets.length} إجمالي)
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDateScope('today')}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                          dateScope === 'today'
                            ? 'bg-[#003820] text-white'
                            : 'bg-[#f1f4f2] text-[#404942]'
                        }`}
                      >
                        جلسة اليوم
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateScope('all')}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                          dateScope === 'all'
                            ? 'bg-[#003820] text-white'
                            : 'bg-[#f1f4f2] text-[#404942]'
                        }`}
                      >
                        كل السجل المحمّل
                      </button>
                    </div>
                  </div>

                  {doctorTickets.length === 0 ? (
                    <AnimatedEmptyState>
                      <p className="text-xs text-[#707971] py-6 text-center">
                        لا توجد تذاكر محجوزة إلكترونياً لهذه الجلسة بعد.
                      </p>
                    </AnimatedEmptyState>
                  ) : (
                    <div className="divide-y divide-[#e4ece7]">
                      {doctorTickets.map((t, idx) => (
                        <FadeInUp key={t.id} index={idx} y={14}>
                          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-11 h-11 rounded-2xl font-bold text-sm flex items-center justify-center shrink-0 tabular-nums ${
                                  t.status === 'cancelled'
                                    ? 'bg-[#ffdad6] text-[#93000a]'
                                    : t.status === 'called' || t.status === 'in_room'
                                      ? 'bg-[#003820] text-[#ffe088]'
                                      : 'bg-[#e6f4ec] text-[#003820]'
                                }`}
                              >
                                #{t.ticketNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-[#181c1c]">{t.patientName}</p>
                                  {t.sessionDate && (
                                    <span className="text-[10px] font-mono text-[#707971]">
                                      {t.sessionDate}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#404942]">
                                  {t.visitType} · {t.patientPhone} {t.notes ? `· ${t.notes}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {!isAuditor && t.status !== 'completed' && t.status !== 'cancelled' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await updateClinicTicketStatus(t.id, 'called');
                                        if (activeQueue) {
                                          await updateClinicQueueState(activeQueue.doctorId, {
                                            currentNumber: t.ticketNumber,
                                            lastTicketNumber: Math.max(
                                              activeQueue.lastTicketNumber,
                                              t.ticketNumber
                                            ),
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
                                  <button
                                    type="button"
                                    onClick={() => void updateClinicTicketStatus(t.id, 'cancelled')}
                                    className="min-h-[38px] px-2.5 rounded-xl bg-[#ffdad6]/70 text-[#93000a] text-xs font-bold inline-flex items-center gap-1"
                                  >
                                    <XCircle size={13} /> إلغاء
                                  </button>
                                </>
                              )}
                              {t.status === 'completed' && (
                                <span className="text-xs font-bold text-[#146c43]">مكتمل</span>
                              )}
                              {t.status === 'cancelled' && (
                                <span className="text-xs font-bold text-[#ba1a1a]">ملغى</span>
                              )}
                            </div>
                          </div>
                        </FadeInUp>
                      ))}
                    </div>
                  )}

                  {hasMoreClinicTickets && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={loadMoreClinicTickets}
                        className="min-h-[40px] px-5 rounded-2xl bg-[#f1f4f2] hover:bg-[#e4ece7] text-xs font-bold text-[#003820]"
                      >
                        تحميل تذاكر أقدم
                      </button>
                    </div>
                  )}
                </div>
              </FadeInUp>
            </>
          )}
        </div>
      </StackLayout>
    </PartnerConsoleGate>
  );
};

/** 2. Restaurant Kitchen Display System (KDS) — SCREEN_91 */
export const KitchenKDSPage: React.FC = () => {
  const {
    restaurantOrders,
    places,
    isAdmin,
    isAuditor,
    managedPlaceIds,
    updateRestaurantOrderStatus,
    hasMoreOrders,
    loadMoreOrders,
    showToast,
  } = useApp();
  const [filter, setFilter] = useState<'active' | 'delivered'>('active');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const restaurantOptions = useMemo(() => {
    const map = new Map<string, string>();
    places
      .filter((p) => p.categorySlug === 'restaurants')
      .filter((p) => isAdmin || managedPlaceIds.includes(p.id))
      .forEach((p) => map.set(p.id, p.name));
    restaurantOrders.forEach((o) => {
      if (o.restaurantId && !map.has(o.restaurantId) && (isAdmin || managedPlaceIds.includes(o.restaurantId))) {
        map.set(o.restaurantId, o.restaurantName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [places, restaurantOrders, isAdmin, managedPlaceIds]);

  const scopedOrders = useMemo(() => {
    const authorized = isAdmin
      ? restaurantOrders
      : restaurantOrders.filter((o) => managedPlaceIds.includes(o.restaurantId));
    return selectedRestaurantId === 'all'
      ? authorized
      : authorized.filter((o) => o.restaurantId === selectedRestaurantId);
  }, [restaurantOrders, selectedRestaurantId, isAdmin, managedPlaceIds]);

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
      requiredScope="restaurant"
      title="لوحة مطبخ وكاشير المطعم (KDS)"
      description="واجهة معزولة لمطعمك لاستقبال طلبات الوجبات الحية وتحديث مراحل التجهيز لحظياً."
    >
      <StackLayout
        title="مطبخ وكاشير المطعم"
        subtitle="تحديث حي مباشر مع العميل والكابتن"
        backTo={isAdmin ? '/admin/dashboard' : '/home'}
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
          {isAuditor && (
            <div className="bg-[#e0f2fe] border border-[#bae6fd] rounded-2xl px-4 py-3 text-xs font-bold text-[#0369a1]">
              وضع المراجع (قراءة فقط): لا يمكنك تعديل حالات طلبات المطاعم.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AnimatedFilterChip
                active={filter === 'active'}
                onClick={() => setFilter('active')}
                className={`min-h-[42px] px-4 rounded-2xl text-xs font-bold ${
                  filter === 'active'
                    ? 'bg-[#003820] text-white'
                    : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                طلبات قيد التشغيل (
                {scopedOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length})
              </AnimatedFilterChip>
              <AnimatedFilterChip
                active={filter === 'delivered'}
                onClick={() => setFilter('delivered')}
                className={`min-h-[42px] px-4 rounded-2xl text-xs font-bold ${
                  filter === 'delivered'
                    ? 'bg-[#003820] text-white'
                    : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                المكتملة والملغاة
              </AnimatedFilterChip>
            </div>
            {restaurantOptions.length > 1 && (
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                aria-label="تصفية حسب المطعم"
                className="min-h-[42px] px-3.5 rounded-2xl bg-white border border-[#e4ece7] text-xs font-bold text-[#003820] outline-none"
              >
                <option value="all">كل المطاعم المصرّح بها</option>
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
                  ستظهر الطلبات الجديدة الخاصة بمطعمك هنا لحظياً فور إرسالها من التطبيق.
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
                          <p className="text-xs text-[#404942]">
                            {order.customerName} · {order.customerPhone}
                          </p>
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
                                  : order.status === 'cancelled'
                                    ? 'ملغى'
                                    : 'تم التسليم'}
                        </span>
                      </div>

                      <div className="bg-[#f7faf8] rounded-2xl p-3 space-y-1.5 text-xs">
                        {order.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between font-medium tabular-nums">
                            <span>
                              {item.quantity} × {item.name}
                            </span>
                            <span>{item.price * item.quantity} ج.م</span>
                          </div>
                        ))}
                        <div className="pt-1.5 border-t border-[#e4ece7] flex justify-between font-bold text-[#003820] tabular-nums">
                          <span>الإجمالي (شامل التوصيل {order.deliveryFee} ج.م)</span>
                          <span>{order.total} ج.م</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs text-[#404942] flex items-center gap-1.5">
                          <MapPin size={14} className="text-[#0f5132] shrink-0" />
                          <span>
                            {order.deliveryArea} — {order.deliveryAddress}
                          </span>
                        </p>
                        {order.deliveryCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0f5132] hover:underline"
                          >
                            <MapPin size={12} /> فتح موقع العميل GPS على الخريطة
                          </a>
                        )}
                      </div>

                      {!isAuditor && order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void updateRestaurantOrderStatus(order.id, { status: action.next })
                            }
                            className="flex-1 min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            {action.label}
                            <ArrowLeft size={14} />
                          </button>
                          {(order.status === 'new' || order.status === 'preparing') && (
                            <button
                              type="button"
                              onClick={() =>
                                void updateRestaurantOrderStatus(order.id, { status: 'cancelled' })
                              }
                              className="min-h-[44px] px-3 rounded-2xl bg-[#ffdad6]/70 text-[#93000a] text-xs font-bold"
                            >
                              إلغاء
                            </button>
                          )}
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

          {hasMoreOrders && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={loadMoreOrders}
                className="min-h-[42px] px-6 rounded-2xl bg-white border border-[#e4ece7] text-xs font-bold text-[#003820] shadow-civic-1"
              >
                تحميل طلبات أقدم
              </button>
            </div>
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
    claimDeliveryRide,
    claimRestaurantOrder,
    updateDeliveryRideStatus,
    updateRestaurantOrderStatus,
    hasMoreRides,
    loadMoreRides,
    hasMoreOrders,
    loadMoreOrders,
    user,
    isAdmin,
    isAdminWriter,
    isAuditor,
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
  const [claimingId, setClaimingId] = useState<string | null>(null);

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

  const ensureCaptainIdentity = (): { name: string; phone: string } | null => {
    const phoneCheck = validateEgyptPhone(captainPhone);
    if (captainName.trim().length < 2) {
      showToast('يرجى إدخال اسم الكابتن الصحيح أولاً قبل قبول الطلب', 'error');
      return null;
    }
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'رقم هاتف الكابتن غير صحيح', 'error');
      return null;
    }
    return { name: captainName.trim(), phone: phoneCheck.normalized };
  };

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const knownDispatchIdsRef = useRef<Set<string> | null>(null);

  const activeRides = useMemo(
    () =>
      deliveryRides.filter((r) => {
        if (r.status === 'delivered' || r.status === 'cancelled') return false;
        if (r.status === 'pending') return true;
        return isAdmin || r.captainUid === user?.uid;
      }),
    [deliveryRides, isAdmin, user?.uid]
  );

  const readyFoodOrders = useMemo(
    () =>
      restaurantOrders.filter((o) => {
        if (o.status === 'ready') return true;
        if (o.status === 'on_the_way') return isAdmin || o.captainUid === user?.uid;
        return false;
      }),
    [restaurantOrders, isAdmin, user?.uid]
  );

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
      requiredScope="captain"
      title="لوحة كابتن الدليفري الموحد"
      description="قبول ذري للمشاوير وطلبات المطاعم الجاهزة يمنع التضارب بين الكباتن ويربط كل مشوار بحساب الكابتن الموثق."
    >
      <StackLayout
        title="لوحة كابتن الدليفري"
        subtitle="مشاوير أبوحمص وتوصيل المطاعم"
        backTo={isAdmin ? '/admin/dashboard' : '/home'}
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
          {isAuditor && (
            <div className="bg-[#e0f2fe] border border-[#bae6fd] rounded-2xl px-4 py-3 text-xs font-bold text-[#0369a1]">
              وضع المراجع (قراءة فقط): لا يمكنك قبول أو تعديل المشاوير.
            </div>
          )}

          {/* Captain Identity Bar */}
          {!isAuditor && (
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
          )}

          {/* Unified Delivery Rides */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#003820] flex items-center gap-2">
              <Bike size={18} />
              مشاوير الدليفري الموحد ({activeRides.length})
            </h2>

            {activeRides.length === 0 ? (
              <AnimatedEmptyState>
                <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 text-center text-xs text-[#707971]">
                  لا توجد مشاوير دليفري معلقة أو مسندة لك حالياً.
                </div>
              </AnimatedEmptyState>
            ) : (
              <AnimatedListContainer className="space-y-3">
                {activeRides.map((ride, idx) => {
                  const isMine = Boolean(ride.captainUid && ride.captainUid === user?.uid);
                  const canAdvance = !isAuditor && (isMine || isAdminWriter);
                  return (
                    <AnimatedListItem key={ride.id} index={idx}>
                      <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[#707971]">{ride.rideCode}</span>
                            {isMine && (
                              <span className="px-2 py-0.5 rounded-full bg-[#e6f4ec] text-[#0f5132] text-[10px] font-bold">
                                مسند إليك
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-[#003820] tabular-nums">
                            {ride.estimatedFee ?? 20} ج.م
                          </span>
                        </div>
                        <div className="text-xs text-[#404942] space-y-1">
                          <p>
                            <strong>استلام من:</strong> {ride.pickupArea} {ride.pickupDetails}
                          </p>
                          <p>
                            <strong>تسليم إلى:</strong> {ride.dropoffArea} {ride.dropoffDetails}
                          </p>
                          <p className="flex items-center gap-1">
                            <Package size={13} /> {ride.itemDescription}
                          </p>
                          <p>
                            العميل: {ride.customerName} ({ride.customerPhone})
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          {!isAuditor && ride.status === 'pending' && (
                            <button
                              type="button"
                              disabled={claimingId === ride.id}
                              onClick={async () => {
                                const identity = ensureCaptainIdentity();
                                if (!identity) return;
                                setClaimingId(ride.id);
                                try {
                                  await claimDeliveryRide(ride.id, identity.name, identity.phone);
                                } catch {
                                  showToast('تعذر قبول المشوار حالياً', 'error');
                                } finally {
                                  setClaimingId(null);
                                }
                              }}
                              className="flex-1 min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl disabled:opacity-60"
                            >
                              {claimingId === ride.id ? 'جارٍ تثبيت القبول...' : 'قبول المشوار (ذري)'}
                            </button>
                          )}
                          {canAdvance && ride.status === 'accepted' && (
                            <button
                              type="button"
                              onClick={() => void updateDeliveryRideStatus(ride.id, { status: 'picked_up' })}
                              className="flex-1 min-h-[44px] bg-[#0f5132] text-white text-xs font-bold rounded-2xl"
                            >
                              تم الاستلام
                            </button>
                          )}
                          {canAdvance && ride.status === 'picked_up' && (
                            <button
                              type="button"
                              onClick={() => void updateDeliveryRideStatus(ride.id, { status: 'on_the_way' })}
                              className="flex-1 min-h-[44px] bg-[#146c43] text-white text-xs font-bold rounded-2xl"
                            >
                              في الطريق للعميل
                            </button>
                          )}
                          {canAdvance && ride.status === 'on_the_way' && (
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
                  );
                })}
              </AnimatedListContainer>
            )}

            {hasMoreRides && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={loadMoreRides}
                  className="min-h-[40px] px-5 rounded-2xl bg-white border border-[#e4ece7] text-xs font-bold text-[#003820]"
                >
                  تحميل مشاوير أقدم
                </button>
              </div>
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
                {readyFoodOrders.map((order, idx) => {
                  const isMine = Boolean(order.captainUid && order.captainUid === user?.uid);
                  const canComplete = !isAuditor && (isMine || isAdminWriter);
                  return (
                    <AnimatedListItem key={order.id} index={idx}>
                      <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-2.5">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-sm">
                            {order.restaurantName} ({order.orderCode})
                          </span>
                          <span className="font-bold text-sm text-[#003820] tabular-nums">
                            {order.total} ج.م
                          </span>
                        </div>
                        <p className="text-xs text-[#404942]">
                          التوصيل إلى: {order.deliveryArea} — {order.deliveryAddress}
                        </p>
                        {order.deliveryCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${order.deliveryCoords.lat},${order.deliveryCoords.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0f5132] hover:underline"
                          >
                            <MapPin size={14} /> فتح موقع العميل GPS على خرائط جوجل
                          </a>
                        )}
                        <div className="flex gap-2">
                          {!isAuditor && order.status === 'ready' ? (
                            <button
                              type="button"
                              disabled={claimingId === order.id}
                              onClick={async () => {
                                const identity = ensureCaptainIdentity();
                                if (!identity) return;
                                setClaimingId(order.id);
                                try {
                                  await claimRestaurantOrder(order.id, identity.name, identity.phone);
                                } catch {
                                  showToast('تعذر استلام الطلب حالياً', 'error');
                                } finally {
                                  setClaimingId(null);
                                }
                              }}
                              className="flex-1 min-h-[44px] bg-[#003820] text-white text-xs font-bold rounded-2xl disabled:opacity-60"
                            >
                              {claimingId === order.id
                                ? 'جارٍ تثبيت الاستلام...'
                                : 'استلام الوجبة والانطلاق للعميل (ذري)'}
                            </button>
                          ) : canComplete && order.status === 'on_the_way' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void updateRestaurantOrderStatus(order.id, { status: 'delivered' })
                              }
                              className="flex-1 min-h-[44px] bg-[#146c43] text-white text-xs font-bold rounded-2xl"
                            >
                              تأكيد تسليم الوجبة للعميل
                            </button>
                          ) : null}
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
                  );
                })}
              </AnimatedListContainer>
            )}

            {hasMoreOrders && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={loadMoreOrders}
                  className="min-h-[40px] px-5 rounded-2xl bg-white border border-[#e4ece7] text-xs font-bold text-[#003820]"
                >
                  تحميل طلبات مطاعم أقدم
                </button>
              </div>
            )}
          </section>
        </div>
      </StackLayout>
    </PartnerConsoleGate>
  );
};
