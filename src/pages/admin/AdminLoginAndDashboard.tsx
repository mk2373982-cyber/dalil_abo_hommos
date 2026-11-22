import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bike,
  Building2,
  ChefHat,
  Clock,
  CloudUpload,
  Coins,
  Inbox,
  Layers,
  LogIn,
  ShieldCheck,
  Stethoscope,
  Store,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminShell } from '../../components/SharedUI';
import { FadeInUp, PageTransition } from '../../components/MotionEffects';

export const AdminLoginPage: React.FC = () => {
  const { authReady, isAdmin, signInAdmin, user } = useApp();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (authReady && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [authReady, isAdmin, navigate]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    const ok = await signInAdmin();
    setSigningIn(false);
    if (ok) {
      navigate('/admin/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#181c1c] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#e4ece7] px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#003820] text-[#9ff1bd] flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#003820]">دليل أبوحمص</p>
              <p className="text-[11px] text-[#404942]">بوابة الإدارة الرقمية الموحدة</p>
            </div>
          </div>
          <Link
            to="/home"
            className="min-h-[40px] px-4 py-2 rounded-full bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] text-xs font-bold flex items-center gap-1.5"
          >
            العودة لتطبيق الجمهور
            <ArrowLeft size={14} />
          </Link>
        </div>
      </header>

      {/* Main Split Grid matching Stitch SCREEN_2 / screen(43) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12">
        <PageTransition
          routeKey="/admin/login"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Right Column (Info & Partner Protocol) */}
          <div className="lg:col-span-5 space-y-4">
            <FadeInUp delay={0.02}>
              <div className="bg-gradient-to-br from-[#e6f4ec] via-white to-[#f1f4f2] border border-[#d7ebe0] rounded-3xl p-6 shadow-civic-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#003820] text-[#9ff1bd] flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#0f5132]">نظام إدارة المدينة</span>
                    <h1 className="text-xl font-bold text-[#003820]">بوابة الإدارة المركزية</h1>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
                  المنصة التشغيلية الموحدة لإدارة أقسام الدليل ديناميكياً، ومراجعة طلبات الأهالي، وتشغيل لوحات العيادات والمطاعم والكباتن بمركز ومدينة أبوحمص.
                </p>
                <div className="bg-white border border-[#e4ece7] rounded-2xl p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#181c1c]">بروتوكول الشراكة والشفافية</p>
                    <p className="text-[11px] text-[#404942]">مصادقة Google الموثّقة + سجل تدقيق فوري</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-[#e6f4ec] text-[#0f5132] text-[11px] font-bold">
                    Firebase Auth
                  </span>
                </div>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.08}>
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
                <p className="text-xs font-bold text-[#003820]">أدوار المشرفين والشركاء المعتمدين</p>
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#003820] text-white font-bold flex items-center justify-center">
                        ر
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#181c1c]">رائد — الشريك التقني</p>
                        <p className="text-[11px] text-[#404942]">إدارة المنظومة والأقسام والمالية</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#0f5132] bg-[#e6f4ec] px-2.5 py-1 rounded-lg">
                      مشرف عام
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#146c43] text-white font-bold flex items-center justify-center">
                        م
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#181c1c]">محمد — شريك العمليات</p>
                        <p className="text-[11px] text-[#404942]">المراجعة الميدانية وطابور واتساب</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#735c00] bg-[#fef3c7] px-2.5 py-1 rounded-lg">
                      عمليات
                    </span>
                  </div>
                </div>
              </div>
            </FadeInUp>
          </div>

          {/* Left Column (Primary Google Auth Card) */}
          <FadeInUp delay={0.05} className="lg:col-span-7">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 sm:p-8 shadow-civic-2 space-y-6">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e6f4ec] text-[#0f5132] text-xs font-bold">
                  مصادقة آمنة ومشفرة
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#181c1c]">المصادقة وتأكيد الهوية</h2>
                <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
                  سجّل الدخول بحساب Google المعتمد للمشرف لفتح لوحة التحكم الكاملة ومزامنة بيانات «دليل أبوحمص» مباشرة على Firebase Firestore.
                </p>
              </div>

              {user && !isAdmin && (
                <div className="p-4 rounded-2xl bg-[#ffdad6] text-[#93000a] text-xs font-semibold leading-relaxed">
                  الحساب الحالي ({user.email}) مسجل الدخول لكنه غير مدرج ضمن قائمة المشرفين المعتمدين في Firestore.
                </div>
              )}

              <button
                type="button"
                disabled={signingIn}
                onClick={handleGoogleLogin}
                className="w-full min-h-[54px] bg-[#003820] hover:bg-[#0f5132] disabled:opacity-60 text-white font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-3 shadow-civic-1 active:scale-[0.99] transition-all"
              >
                <LogIn size={20} />
                <span>{signingIn ? 'جارٍ التحقق عبر Google...' : 'تسجيل الدخول إلى لوحة التحكم عبر Google'}</span>
              </button>

              <div className="p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2">
                <p className="text-xs font-bold text-[#003820]">حماية النشاط التزامني</p>
                <p className="text-xs text-[#404942] leading-relaxed">
                  كل تعديل في الأقسام أو الأماكن أو نسب الشراكة يُحفظ لحظياً في قاعدة البيانات السحابية وينعكس فوراً على جميع هواتف أهالي أبوحمص بدون إعادة تحميل.
                </p>
              </div>

              <div className="pt-2 border-t border-[#e4ece7] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#707971]">
                <span>بوابة مخصصة حصرياً لفريق إدارة مبادرة دليل أبوحمص</span>
                <span className="font-semibold text-[#0f5132]">اتصال مؤمّن · Firestore Rules Active</span>
              </div>
            </div>
          </FadeInUp>
        </PageTransition>
      </main>
    </div>
  );
};

export const AdminDashboardPage: React.FC = () => {
  const {
    categories,
    activeCategories,
    places,
    properties,
    submissions,
    clinicTickets,
    restaurantOrders,
    deliveryRides,
    whatsappQueue,
    financeConfig,
    isCloudSeeded,
    isSuperAdmin,
    adminRole,
    seedCloudDatabase,
    showToast,
  } = useApp();
  const [seeding, setSeeding] = useState(false);

  const pendingSubmissions = submissions.filter((s) => s.status === 'received' || s.status === 'reviewing');
  const activeOrders = restaurantOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const activeRides = deliveryRides.filter((r) => r.status !== 'delivered' && r.status !== 'cancelled');
  const waitingTickets = clinicTickets.filter((t) => t.status === 'waiting' || t.status === 'called');
  const pendingWhatsapp = whatsappQueue.filter((w) => w.status === 'pending');

  const kpis = [
    {
      label: 'الأقسام النشطة',
      value: `${activeCategories.length} / ${categories.length}`,
      sub: 'تحكم 100% ديناميكي',
      to: '/admin/taxonomy',
      icon: Layers,
      bg: 'bg-[#e6f4ec] text-[#0f5132]',
    },
    {
      label: 'الأماكن والخدمات',
      value: String(places.length),
      sub: `${places.filter((p) => p.verified).length} نشاط موثّق`,
      to: '/admin/places',
      icon: Store,
      bg: 'bg-[#e0f2fe] text-[#0369a1]',
    },
    {
      label: 'الطلبات والبلاغات',
      value: String(pendingSubmissions.length),
      sub: `من إجمالي ${submissions.length} طلب`,
      to: '/admin/requests',
      icon: Inbox,
      bg: 'bg-[#fef3c7] text-[#92400e]',
    },
    {
      label: 'العقارات المسجلة',
      value: String(properties.length),
      sub: `${properties.filter((p) => p.status === 'pending').length} بانتظار التدقيق`,
      to: '/admin/taxonomy',
      icon: Building2,
      bg: 'bg-[#f3e8ff] text-[#6b21a8]',
    },
  ];

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedCloudDatabase(true);
    } catch {
      showToast('تعذرت مزامنة البيانات الأساسية حالياً، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminShell
      title="النظرة العامة للمنظومة"
      subtitle="متابعة حية لدليل أبوحمص، الأقسام الديناميكية، ولوحات التشغيل"
      headerAction={
        isSuperAdmin ? (
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeed}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#003820] hover:bg-[#0f5132] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <CloudUpload size={16} />
            <span>{seeding ? 'جارٍ المزامنة...' : isCloudSeeded ? 'إعادة مزامنة البيانات الأساسية' : 'تهيئة قاعدة البيانات السحابية'}</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((item, idx) => {
            const Icon = item.icon;
            return (
              <FadeInUp key={item.label} index={idx} className="h-full">
                <Link
                  to={item.to}
                  className="bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 rounded-3xl p-5 shadow-civic-1 transition-all flex items-start justify-between gap-3 h-full"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#404942]">{item.label}</p>
                    <p className="text-2xl font-bold text-[#181c1c] tabular-nums">{item.value}</p>
                    <p className="text-[11px] text-[#707971]">{item.sub}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.bg}`}>
                    <Icon size={22} />
                  </div>
                </Link>
              </FadeInUp>
            );
          })}
        </section>

        {/* Live Partner Consoles Strip */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#003820]">لوحات التشغيل الحية للشركاء (تزامن لحظي)</h2>
            <span className="text-xs text-[#0f5132] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#198754] animate-pulse" />
              متصل بـ Firestore
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FadeInUp index={0} className="h-full">
              <Link
                to="/clinic/console"
                className="block h-full bg-white border border-[#e4ece7] hover:border-[#0f5132] rounded-3xl p-5 shadow-civic-1 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center">
                    <Stethoscope size={22} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#e6f4ec] text-[#0f5132] text-xs font-bold tabular-nums">
                    {waitingTickets.length} بالانتظار
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181c1c]">لوحة سكرتارية العيادة</h3>
                  <p className="text-xs text-[#404942] mt-1">
                    نداء الدور التالي، إيقاف مؤقت، وحالات الطوارئ بتحديث فوري على شاشة المريض.
                  </p>
                </div>
              </Link>
            </FadeInUp>

            <FadeInUp index={1} className="h-full">
              <Link
                to="/restaurant/kitchen"
                className="block h-full bg-white border border-[#e4ece7] hover:border-[#0f5132] rounded-3xl p-5 shadow-civic-1 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-[#ffedd5] text-[#c2410c] flex items-center justify-center">
                    <ChefHat size={22} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-xs font-bold tabular-nums">
                    {activeOrders.length} طلب نشط
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181c1c]">شاشة مطبخ وكاشير المطعم (KDS)</h3>
                  <p className="text-xs text-[#404942] mt-1">
                    استلام طلبات الطعام لحظياً وتحريكها بين جديد، جاري التجهيز، وجاهز للتوصيل.
                  </p>
                </div>
              </Link>
            </FadeInUp>

            <FadeInUp index={2} className="h-full">
              <Link
                to="/captain/dashboard"
                className="block h-full bg-white border border-[#e4ece7] hover:border-[#0f5132] rounded-3xl p-5 shadow-civic-1 space-y-3 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
                    <Bike size={22} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#e6f4ec] text-[#0f5132] text-xs font-bold tabular-nums">
                    {activeRides.length} مشوار متاح
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181c1c]">لوحة كابتن الدليفري</h3>
                  <p className="text-xs text-[#404942] mt-1">
                    قبول مشاوير أبوحمص وتوصيل طلبات المطاعم الجاهزة وتحديث الموقع والحالة.
                  </p>
                </div>
              </Link>
            </FadeInUp>
          </div>
        </section>

        {/* Bottom 2-Column Operational Summary */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Incoming Requests */}
          <FadeInUp index={0} className="lg:col-span-7 bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                <Clock size={17} className="text-[#0f5132]" />
                أحدث طلبات وبلاغات المواطنين
              </h3>
              <Link to="/admin/requests" className="text-xs font-bold text-[#0f5132] hover:underline">
                عرض الكل ({submissions.length})
              </Link>
            </div>
            {submissions.length === 0 ? (
              <p className="text-xs text-[#707971] py-6 text-center">لا توجد طلبات واردة حالياً</p>
            ) : (
              <div className="divide-y divide-[#e4ece7]">
                {submissions.slice(0, 5).map((sub) => (
                  <div key={sub.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#181c1c] truncate">{sub.title}</p>
                      <p className="text-xs text-[#404942] truncate">
                        {sub.submitterName} · {sub.submitterPhone} ·{' '}
                        <span className="font-mono text-[#0f5132]">{sub.trackingToken}</span>
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                        sub.status === 'approved'
                          ? 'bg-[#e6f4ec] text-[#0f5132]'
                          : sub.status === 'rejected'
                            ? 'bg-[#ffdad6] text-[#93000a]'
                            : 'bg-[#fef3c7] text-[#92400e]'
                      }`}
                    >
                      {sub.status === 'received'
                        ? 'جديد'
                        : sub.status === 'reviewing'
                          ? 'قيد المراجعة'
                          : sub.status === 'approved'
                            ? 'معتمد'
                            : 'مرفوض'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FadeInUp>

          {/* Governance & Quick Links */}
          <div className="lg:col-span-5 space-y-4">
            {(isSuperAdmin || adminRole === 'auditor') && (
              <FadeInUp index={1} className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#181c1c] flex items-center gap-2">
                    <Coins size={17} className="text-[#735c00]" />
                    حالة الشراكة المالية (رائد ومحمد)
                  </h3>
                  <Link to="/admin/finance" className="text-xs font-bold text-[#0f5132]">
                    إدارة
                  </Link>
                </div>
                {financeConfig.isConfigured ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-[#e6f4ec] text-center">
                      <p className="text-xs text-[#0f5132] font-semibold">حصة رائد</p>
                      <p className="text-xl font-bold text-[#003820] tabular-nums">
                        {financeConfig.raedPercent}%
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#fef3c7] text-center">
                      <p className="text-xs text-[#735c00] font-semibold">حصة محمد</p>
                      <p className="text-xl font-bold text-[#735c00] tabular-nums">
                        {financeConfig.mohamedPercent}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#fef3c7]/70 border border-[#f5d061] text-xs text-[#735c00] font-semibold leading-relaxed">
                    نسب التوزيع لم تُحدد بعد — ادخل على شاشة «حسابات الشريكين» لتحديد النسب للدورات القادمة.
                  </div>
                )}
              </FadeInUp>
            )}

            <FadeInUp index={2} className="bg-[#003820] text-white rounded-3xl p-5 shadow-civic-2 space-y-3">
              <div className="flex items-center gap-2 text-[#9ff1bd]">
                <Users size={18} />
                <span className="text-xs font-bold">جاهزية التفاعل الميداني</span>
              </div>
              <p className="text-sm font-bold">
                يوجد {pendingWhatsapp.length} رسالة واتساب جاهزة للإرسال اليدوي لأصحاب الأنشطة.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to="/admin/taxonomy"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#9ff1bd] text-[#003820] text-xs font-bold flex items-center"
                >
                  إدارة الأقسام (Icon Picker)
                </Link>
                <Link
                  to="/admin/whatsapp-queue"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center"
                >
                  فتح طابور واتساب
                </Link>
              </div>
            </FadeInUp>
          </div>
        </section>
      </div>
    </AdminShell>
  );
};
