import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  Home,
  ImageDown,
  Inbox,
  LayoutDashboard,
  Layers,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Percent,
  Settings,
  Share2,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadShareablePlaceCard } from '../lib/shareCard';
import type { PartnerScope } from '../types';
import { FadeInUp, FloatingScrollTopButton, PageTransition } from './MotionEffects';

/** Zero-Broken-Image resilient media frame with smooth fade-in reveal */
export const CivicImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}> = ({ src, alt, className = '', fallbackLabel }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-[#e6f4ec] via-[#f1f4f2] to-[#d7ebe0] flex flex-col items-center justify-center text-[#0f5132] p-3 text-center ${className}`}
      >
        <Store size={26} className="opacity-70 mb-1" />
        <span className="text-[11px] font-semibold line-clamp-1">{fallbackLabel || alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={`object-cover bg-[#e6f4ec] transition-opacity duration-300 ${
        loaded ? 'opacity-100' : 'opacity-80'
      } ${className}`}
    />
  );
};

/** Dual Floating Pill Header + Responsive Container + Unified 4-Tab Bottom Bar */
export const PublicRootLayout: React.FC<{
  children: React.ReactNode;
  hideBottomBar?: boolean;
}> = ({ children, hideBottomBar = false }) => {
  const { settings } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
      }
    };
  }, []);

  const handleBrandClick = (e: React.MouseEvent) => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current);
    }

    if (tapCountRef.current >= 5) {
      e.preventDefault();
      tapCountRef.current = 0;
      navigate('/admin');
      return;
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);
  };

  const navItems = [
    { to: '/home', label: 'الرئيسية', icon: Home },
    { to: '/real-estate', label: 'العقارات', icon: Building2 },
    { to: '/offers', label: 'التخفيضات', icon: Percent },
    { to: '/more', label: 'المزيد', icon: MoreHorizontal },
  ];

  const formattedVisits =
    settings.visitsCount >= 1000
      ? `${(settings.visitsCount / 1000).toFixed(1)} ألف زيارة`
      : `${settings.visitsCount} زيارة`;

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#181c1c] flex flex-col">
      {/* Unified Dual Floating Pill Header (v3.1) */}
      <header className="sticky top-0 z-30 bg-[#f7faf8]/90 backdrop-blur-md border-b border-[#e4ece7]/70">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Right Capsule: Brand Mark (5 quick taps opens /admin) */}
          <Link
            to="/home"
            onClick={handleBrandClick}
            className="flex items-center gap-2.5 bg-white border border-[#e4ece7] rounded-full px-3.5 py-2 shadow-civic-1 active:scale-95 transition-transform whitespace-nowrap shrink-0"
          >
            <img
              src="/logo.png"
              alt="دليل أبوحمص"
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#e4ece7]"
            />
            <span className="text-sm sm:text-base font-bold text-[#003820] tracking-tight">
              دليل أبوحمص
            </span>
          </Link>

          {/* Desktop inline navigation links with gliding active indicator */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#404942]">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-2 transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'text-[#003820] font-bold' : 'hover:text-[#0f5132]'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="desktopNavUnderline"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#0f5132]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Left Capsule: Interactive Visits Counter */}
          <div className="flex items-center gap-2 bg-white border border-[#e4ece7] rounded-full px-3.5 py-2 shadow-civic-1 whitespace-nowrap shrink-0">
            <Eye size={15} className="text-[#146c43]" />
            <span className="text-xs font-bold text-[#003820] tabular-nums">{formattedVisits}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area — smooth route transition */}
      <main className={`flex-1 w-full max-w-6xl mx-auto px-4 pt-4 ${hideBottomBar ? 'pb-10' : 'pb-28 md:pb-12'}`}>
        <PageTransition routeKey={location.pathname}>{children}</PageTransition>
      </main>

      <FloatingScrollTopButton hasBottomBar={!hideBottomBar} />

      {/* Unified Floating Glass Capsule Bottom Bar with Spring Gliding Indicator */}
      {!hideBottomBar && (
        <nav
          aria-label="التنقل الرئيسي"
          className="md:hidden fixed bottom-3 inset-x-4 z-40 max-w-lg mx-auto bg-white/95 backdrop-blur-md border border-[#e4ece7] rounded-full px-2 py-1.5 shadow-civic-2"
        >
          <div className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `relative min-h-[48px] rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                      isActive ? 'text-white font-bold' : 'text-[#404942] hover:bg-[#f1f4f2]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="mobileBottomTabPill"
                          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                          className="absolute inset-0 rounded-full bg-[#003820] shadow-sm"
                        />
                      )}
                      <motion.span
                        animate={isActive ? { scale: 1.08, y: -0.5 } : { scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                        className="relative z-10 flex flex-col items-center justify-center gap-0.5"
                      >
                        <Icon size={19} strokeWidth={2.1} />
                        <span className="text-[11px] leading-tight whitespace-nowrap">{item.label}</span>
                      </motion.span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

/** Unified Arabic Stack Header with RTL circular back button (hides bottom bar on deep screens per v3.1) */
export const StackLayout: React.FC<{
  title: string;
  subtitle?: string;
  backTo?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, backTo, rightAction, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#181c1c] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#f7faf8]/95 backdrop-blur-md border-b border-[#e4ece7]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.05, x: 2 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
              className="w-11 h-11 rounded-full bg-white border border-[#e4ece7] hover:border-[#0f5132]/40 flex items-center justify-center text-[#003820] shadow-civic-1 shrink-0 cursor-pointer"
              aria-label="رجوع"
            >
              <ChevronRight size={22} />
            </motion.button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#181c1c] truncate">{title}</h1>
              {subtitle && <p className="text-xs text-[#404942] truncate">{subtitle}</p>}
            </div>
          </div>
          {rightAction && <div className="shrink-0 flex items-center gap-2">{rightAction}</div>}
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 pb-12">
        <PageTransition routeKey={location.pathname}>{children}</PageTransition>
      </main>
      <FloatingScrollTopButton hasBottomBar={false} />
    </div>
  );
};

/** Real Scannable QR Code Card with Download + WhatsApp Share + PNG Status Card */
export const QRCodeCard: React.FC<{
  title: string;
  code: string;
  shareUrl: string;
  subtitle?: string;
  phone?: string;
  area?: string;
  specialty?: string;
}> = ({
  title,
  code,
  shareUrl,
  subtitle = 'امسح الكود للوصول السريع لبيانات ومواعيد المكان',
  phone,
  area,
  specialty,
}) => {
  const { showToast } = useApp();
  const qrId = `qr-${code.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const handleDownload = () => {
    const svg = document.getElementById(qrId);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadStatusCard = () => {
    const ok = downloadShareablePlaceCard({
      title,
      subtitle: specialty || subtitle,
      area,
      phone,
      code,
      badge: specialty || 'دليل أبوحمص الشامل',
    });
    if (ok) {
      showToast('تم تحميل البطاقة كصورة جاهزة لحالة الواتساب وفيسبوك', 'success');
    } else {
      showToast('تعذر توليد الصورة على هذا المتصفح', 'error');
    }
  };

  const waShare = `https://wa.me/?text=${encodeURIComponent(`${title} — دليل أبوحمص\n${shareUrl}`)}`;

  return (
    <div className="bg-[#003820] text-white rounded-3xl p-5 shadow-civic-2">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-[#9ff1bd]">البطاقة الذكية الرسمية</p>
          <h3 className="text-base font-bold truncate">{title}</h3>
          <p className="text-xs text-white/75 leading-relaxed">{subtitle}</p>
          <p className="text-[11px] font-mono text-[#ffe088] pt-1">كود الاعتماد: {code}</p>
        </div>
        <div className="bg-white p-2.5 rounded-2xl shrink-0">
          <QRCodeSVG id={qrId} value={shareUrl} size={86} fgColor="#003820" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <a
          href={waShare}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] bg-[#146c43] hover:bg-[#198754] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Share2 size={15} />
          مشاركة عبر واتساب
        </a>
        <button
          type="button"
          onClick={handleDownload}
          className="min-h-[44px] bg-white/12 hover:bg-white/20 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Download size={15} />
          تنزيل QR
        </button>
      </div>
      <button
        type="button"
        onClick={handleDownloadStatusCard}
        className="w-full mt-2.5 min-h-[42px] bg-[#d4a017]/20 hover:bg-[#d4a017]/30 border border-[#ffe088]/35 text-[#ffe088] text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <ImageDown size={15} />
        تحميل بطاقة جاهزة لحالة الواتساب (PNG)
      </button>
    </div>
  );
};

/** Responsive Admin Dashboard Shell (Desktop Sidebar + Mobile Off-Canvas Drawer per v3.1) */
export const AdminShell: React.FC<{
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, headerAction, children }) => {
  const {
    user,
    adminRole,
    isAdmin,
    isSuperAdmin,
    isAuditor,
    authReady,
    signOutAdmin,
    isCloudSeeded,
    isDemoPreviewMode,
    initializeEssentialConfig,
  } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const canAccessFinance = isSuperAdmin || adminRole === 'auditor';
  const adminNav = [
    { to: '/admin/dashboard', label: 'النظرة العامة', icon: LayoutDashboard, visible: true },
    { to: '/admin/taxonomy', label: 'الأقسام والمناطق', icon: Layers, visible: true },
    { to: '/admin/places', label: 'إدارة الأماكن', icon: Store, visible: true },
    { to: '/admin/requests', label: 'الطلبات والبلاغات', icon: Inbox, visible: true },
    { to: '/admin/whatsapp-queue', label: 'طابور واتساب', icon: MessageCircle, visible: true },
    { to: '/admin/campaigns', label: 'التخفيضات والبنرات', icon: Megaphone, visible: true },
    { to: '/admin/finance', label: 'حسابات الشريكين', icon: Coins, visible: canAccessFinance },
    { to: '/admin/import', label: 'استيراد CSV', icon: FileSpreadsheet, visible: isSuperAdmin || adminRole === 'moderator' },
    { to: '/admin/analytics', label: 'التقارير والتحليلات', icon: BarChart3, visible: true },
    { to: '/admin/settings', label: 'الإعدادات العامة', icon: Settings, visible: isSuperAdmin },
  ].filter((item) => item.visible);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center">
        <div className="text-sm font-semibold text-[#0f5132]">جارٍ التحقق من جلسة الإدارة...</div>
      </div>
    );
  }

  const isRestrictedRoute =
    (location.pathname.startsWith('/admin/finance') && !canAccessFinance) ||
    (location.pathname.startsWith('/admin/settings') && !isSuperAdmin);

  if (!isAdmin || isRestrictedRoute) {
    return (
      <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center p-4">
        <FadeInUp delay={0.03} className="max-w-md w-full">
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 w-full text-center shadow-civic-1 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-lg font-bold text-[#181c1c]">
              {isAdmin ? 'صلاحيات غير كافية لهذه الشاشة' : 'بوابة الإدارة المركزية محمية'}
            </h2>
            <p className="text-sm text-[#404942]">
              {isAdmin
                ? 'هذه الصفحة مخصصة لصلاحية المشرف العام فقط لحماية الإعدادات والحسابات المالية.'
                : 'يرجى تسجيل الدخول بحساب المشرف المعتمد للوصول إلى لوحة تحكم «دليل أبوحمص».'}
            </p>
            <button
              type="button"
              onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/admin/login')}
              className="w-full min-h-[48px] bg-[#003820] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <LogIn size={18} />
              {isAdmin ? 'العودة للنظرة العامة' : 'الانتقال لتسجيل الدخول'}
            </button>
          </div>
        </FadeInUp>
      </div>
    );
  }

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#003820] text-white">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#0f5132] border border-[#9ff1bd]/30 flex items-center justify-center">
            <ShieldCheck size={20} className="text-[#9ff1bd]" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">دليل أبوحمص</p>
            <p className="text-[11px] text-[#9ff1bd]">بوابة الإدارة المركزية</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
          aria-label="إغلاق القائمة"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {adminNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `min-h-[46px] px-3.5 py-2.5 rounded-2xl flex items-center gap-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#9ff1bd] text-[#003820] font-bold'
                    : 'text-white/85 hover:bg-white/10 font-medium'
                }`
              }
            >
              <Icon size={18} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}

        <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold text-white/50">لوحات التشغيل الحية</p>
          <Link
            to="/clinic/console"
            onClick={() => setDrawerOpen(false)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs text-white/80 hover:bg-white/10"
          >
            <span>سكرتارية العيادة (الطابور الحي)</span>
          </Link>
          <Link
            to="/restaurant/kitchen"
            onClick={() => setDrawerOpen(false)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs text-white/80 hover:bg-white/10"
          >
            <span>مطبخ وكاشير المطعم (KDS)</span>
          </Link>
          <Link
            to="/captain/dashboard"
            onClick={() => setDrawerOpen(false)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs text-white/80 hover:bg-white/10"
          >
            <span>لوحة كابتن الدليفري</span>
          </Link>
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 space-y-2">
        <Link
          to="/home"
          className="w-full min-h-[44px] rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center justify-center gap-2"
        >
          <Home size={15} />
          معاينة تطبيق الجمهور
        </Link>
        <button
          type="button"
          onClick={async () => {
            await signOutAdmin();
            navigate('/home');
          }}
          className="w-full min-h-[44px] rounded-2xl bg-[#ba1a1a]/25 hover:bg-[#ba1a1a]/40 text-[#ffdad6] text-xs font-semibold flex items-center justify-center gap-2"
        >
          <LogOut size={15} />
          تسجيل الخروج ({user?.email?.split('@')[0]})
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7faf8] flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-68 shrink-0 sticky top-0 h-screen">{SidebarContent}</aside>

      {/* Mobile Off-Canvas Drawer with smooth RTL spring slide */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden fixed inset-0 z-50 bg-[#003820]/50 backdrop-blur-xs flex"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="w-72 max-w-[85vw] h-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {SidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e4ece7] px-4 lg:px-8 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden w-12 h-12 rounded-2xl bg-[#f1f4f2] text-[#003820] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              aria-label="فتح القائمة"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-[#181c1c] truncate">{title}</h1>
              {subtitle && <p className="text-xs text-[#404942] truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAuditor && (
              <span className="px-3 py-1.5 rounded-xl bg-[#e0f2fe] text-[#0369a1] text-xs font-bold whitespace-nowrap">
                وضع التدقيق (قراءة فقط)
              </span>
            )}
            {isDemoPreviewMode && (
              <span className="px-3 py-1.5 rounded-xl bg-[#fef3c7] text-[#92400e] text-xs font-bold whitespace-nowrap">
                معاينة تجريبية
              </span>
            )}
            {isSuperAdmin && !isCloudSeeded && (
              <button
                type="button"
                onClick={() => void initializeEssentialConfig()}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#fef3c7] text-[#735c00] text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
              >
                تهيئة الإعدادات الأساسية
              </button>
            )}
            {headerAction}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <PageTransition routeKey={location.pathname}>{children}</PageTransition>
        </main>
        <FloatingScrollTopButton hasBottomBar={false} />
      </div>
    </div>
  );
};

/** Secure, Scope-Isolated Operator Sign-in Gate for Live Partner Consoles (Clinic / Kitchen / Captain) */
export const PartnerConsoleGate: React.FC<{
  title: string;
  description: string;
  requiredScope?: PartnerScope;
  children: React.ReactNode;
}> = ({ title, description, requiredScope, children }) => {
  const {
    authReady,
    user,
    isPartner,
    isAdmin,
    isAuditor,
    canAccessPartnerScope,
    managedPlaceIds,
    signInError,
    signInAdmin,
    signOutAdmin,
    showToast,
  } = useApp();
  const [signingIn, setSigningIn] = useState(false);

  if (!authReady) {
    return (
      <StackLayout title={title} backTo="/home">
        <div className="bg-white rounded-3xl border border-[#e4ece7] p-8 text-center text-sm text-[#404942]">
          جارٍ التحقق من صلاحية المشغّل...
        </div>
      </StackLayout>
    );
  }

  const hasScopeAccess = requiredScope ? canAccessPartnerScope(requiredScope) : isPartner;
  const needsPlaceAssignment =
    !isAdmin &&
    (requiredScope === 'clinic' || requiredScope === 'restaurant') &&
    managedPlaceIds.length === 0;

  if (!isPartner || !hasScopeAccess || needsPlaceAssignment) {
    const scopeLabel =
      requiredScope === 'clinic'
        ? 'سكرتارية العيادات'
        : requiredScope === 'restaurant'
          ? 'مطبخ المطاعم'
          : requiredScope === 'captain'
            ? 'كباتن الدليفري'
            : 'لوحة التشغيل';

    return (
      <StackLayout title={title} subtitle="واجهة تشغيل حية محمية ومعزولة" backTo="/home">
        <FadeInUp delay={0.03} className="max-w-md mx-auto mt-6">
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 text-center shadow-civic-1 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-lg font-bold text-[#181c1c]">{title}</h2>
            <p className="text-sm text-[#404942] leading-relaxed">{description}</p>

            {signInError && (
              <div className="p-3.5 rounded-2xl bg-[#ffdad6] text-[#93000a] text-xs font-semibold leading-relaxed text-right">
                {signInError}
              </div>
            )}

            {user && (!isPartner || !hasScopeAccess || needsPlaceAssignment) && (
              <div className="p-3.5 rounded-2xl bg-[#fef3c7] border border-[#f5d061] text-[#735c00] text-xs leading-relaxed text-right space-y-2">
                <p className="font-bold">
                  {!isPartner
                    ? `الحساب (${user.email}) غير مسجل كشريك تشغيل معتمد.`
                    : !hasScopeAccess
                      ? `حسابك الحالي لا يملك صلاحية الوصول إلى نطاق «${scopeLabel}».`
                      : 'لم يتم ربط أي عيادة أو مطعم بحسابك بعد. تواصل مع المشرف العام لتعيين نشاطك.'}
                </p>
                <div className="flex items-center justify-between gap-2 bg-white/80 rounded-xl px-2.5 py-1.5 border border-[#e4ece7]">
                  <span className="font-mono text-[11px] text-[#181c1c] truncate" dir="ltr">
                    UID: {user.uid}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(user.uid);
                      showToast('تم نسخ معرّف الحساب (UID) بنجاح', 'success');
                    }}
                    className="text-[11px] font-bold text-[#0f5132] shrink-0"
                  >
                    نسخ
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={signingIn}
              onClick={async () => {
                setSigningIn(true);
                await signInAdmin();
                setSigningIn(false);
              }}
              className="w-full min-h-[48px] bg-[#003820] hover:bg-[#0f5132] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <LogIn size={18} />
              {signingIn ? 'جارٍ فتح نافذة Google...' : 'تسجيل دخول المشغّل عبر Google'}
            </button>

            {user && (
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="w-full min-h-[44px] bg-[#f1f4f2] hover:bg-[#e4ece7] text-[#181c1c] font-bold text-xs rounded-2xl flex items-center justify-center gap-2"
              >
                <LogOut size={15} />
                تسجيل الخروج لتبديل الحساب
              </button>
            )}
          </div>
        </FadeInUp>
      </StackLayout>
    );
  }

  return (
    <>
      {isAuditor && (
        <div className="max-w-4xl mx-auto px-4 pt-3">
          <div className="p-3 rounded-2xl bg-[#e0f2fe] border border-[#bae6fd] text-[#0369a1] text-xs font-bold text-center">
            أنت تتصفح لوحة التشغيل بصلاحية «مدقق (قراءة فقط)» — لا يمكن إجراء تعديلات تشغيلية.
          </div>
        </div>
      )}
      {children}
    </>
  );
};

/** Global Animated Toast Feedback Overlay (Replaces browser alert()) */
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="fixed top-20 inset-x-4 z-50 flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => dismissToast(t.id)}
            className={`pointer-events-auto cursor-pointer max-w-md w-full px-4 py-3 rounded-2xl shadow-civic-2 text-sm font-semibold flex items-center justify-between gap-3 ${
              t.tone === 'error'
                ? 'bg-[#ba1a1a] text-white'
                : t.tone === 'info'
                  ? 'bg-[#181c1c] text-white'
                  : 'bg-[#003820] text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={17} className="shrink-0" />
              <span>{t.text}</span>
            </div>
            <X size={15} className="opacity-70 shrink-0" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};