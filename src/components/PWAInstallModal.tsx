import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Loader2, PlusSquare, Share, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  /** Tunes subtle copy for Public Home vs Admin Dashboard while sharing the same brand identity */
  context?: 'public' | 'admin';
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ context = 'public' }) => {
  const { settings, showToast } = useApp();
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isInstalling,
    isDismissedForSession,
    promptInstall,
    dismissForSession,
  } = usePWAInstall();

  // Admin toggle: enabled by default unless explicitly turned off in Admin Settings
  const isEnabledInSettings = settings.pwaInstallPromptEnabled !== false;

  // Show only when not installed, not dismissed in current session, enabled in settings,
  // and either Chromium/Android/Desktop native prompt is ready OR device is iOS Safari.
  const canShowDirectInstall = isInstallable;
  const canShowIOSPrompt = isIOS && !isInstallable;
  const shouldShow =
    isEnabledInSettings &&
    !isInstalled &&
    !isDismissedForSession &&
    (canShowDirectInstall || canShowIOSPrompt);

  useEffect(() => {
    if (!shouldShow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissForSession();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shouldShow, dismissForSession]);

  const handleDirectInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      showToast('تم تثبيت تطبيق «دليل أبوحمص» على جهازك بنجاح', 'success');
    } else if (outcome === 'dismissed') {
      dismissForSession();
    }
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          key="pwa-install-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissForSession}
          className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#02140c]/55 backdrop-blur-xl"
        >
          <motion.div
            key="pwa-install-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-modal-title"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm mt-8 rounded-[32px] bg-[#062416]/82 backdrop-blur-2xl border border-white/20 px-6 pt-12 pb-6 text-center text-white shadow-[0_28px_70px_-14px_rgba(0,20,10,0.75),0_0_0_1px_rgba(255,224,136,0.2),inset_0_1px_0_rgba(255,255,255,0.3)]"
          >
            {/* Ambient radial glow inside floating glass card */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[32px] overflow-hidden"
            >
              <div className="absolute -top-14 inset-x-10 h-32 rounded-full bg-[#ffe088]/20 blur-2xl" />
              <div className="absolute -bottom-16 inset-x-8 h-32 rounded-full bg-[#9ff1bd]/15 blur-2xl" />
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-[#ffe088]/80 to-transparent" />
            </div>

            {/* Floating Circular App Medallion hovering above card edge */}
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-[72px] h-[72px] rounded-full bg-[#09321f]/90 backdrop-blur-xl ring-2 ring-[#ffe088]/75 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.6),0_0_24px_-4px_rgba(255,224,136,0.45)] flex items-center justify-center p-2">
              <img
                src="/pwa-192x192.png"
                alt={settings.appName || 'دليل أبوحمص'}
                className="w-12 h-12 rounded-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            {/* Unified Floating Content */}
            <div className="relative space-y-4">
              <div className="space-y-1.5">
                <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#ffe088] tracking-wide">
                  <Smartphone size={13} />
                  <span>{context === 'admin' ? 'وصول فوري للوحة الإدارة' : 'تطبيق خفيف وسريع (PWA)'}</span>
                </p>
                <h2
                  id="pwa-install-modal-title"
                  className="text-lg sm:text-xl font-extrabold leading-snug text-white"
                >
                  ثبّت التطبيق لسهولة الوصول السريع
                </h2>
                <p className="text-xs sm:text-sm text-[#e6f4ec]/85 leading-relaxed pt-0.5">
                  {context === 'admin'
                    ? `افتح لوحة إدارة «${settings.appName || 'دليل أبوحمص'}» مباشرة من شاشة جهازك بضغطة واحدة لمتابعة الطلبات والتشغيل اللحظي.`
                    : `افتح «${settings.appName || 'دليل أبوحمص'}» من شاشة جهازك فوراً بدون الحاجة لمتجر التطبيقات وبأداء فائق السرعة.`}
                </p>
              </div>

              {canShowDirectInstall ? (
                <div className="relative pt-1">
                  {!isInstalling && (
                    <span
                      aria-hidden="true"
                      className="pwa-cta-ring pointer-events-none absolute inset-0 top-1 rounded-full border-2 border-[#ffe088]/75 bg-[#ffd863]/25"
                    />
                  )}
                  <button
                    type="button"
                    disabled={isInstalling}
                    onClick={() => void handleDirectInstall()}
                    className="pwa-cta-pulse relative overflow-hidden w-full min-h-[54px] px-7 rounded-full bg-[linear-gradient(112deg,#fff3be_0%,#ffd863_34%,#f2bd2e_72%,#e09f14_100%)] hover:brightness-105 disabled:opacity-65 text-[#0c1015] font-extrabold text-sm sm:text-[15px] flex items-center justify-center gap-2.5 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.85),0_12px_28px_-6px_rgba(242,189,46,0.62)] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {!isInstalling && (
                      <span
                        aria-hidden="true"
                        className="studio-banner-sheen pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                      />
                    )}
                    {isInstalling ? (
                      <>
                        <Loader2 size={18} className="animate-spin relative" />
                        <span className="relative">جارٍ فتح نافذة التثبيت...</span>
                      </>
                    ) : (
                      <>
                        <Download size={19} strokeWidth={2.5} className="relative" />
                        <span className="relative">تثبيت التطبيق الآن</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* iOS Safari concise single-line guide on frosted glass */
                <div className="px-4 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-semibold text-white flex items-center justify-center gap-1.5 flex-wrap leading-relaxed">
                  <span>اضغط</span>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#ffe088]/20 text-[#ffe088]">
                    <Share size={13} aria-label="أيقونة المشاركة" />
                  </span>
                  <span>ثم اختر</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#ffe088]">
                    <PlusSquare size={14} />
                    «إضافة إلى الشاشة الرئيسية»
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={dismissForSession}
                className="w-full py-2 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                ليس الآن
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
