import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'card' | 'compact' }> = ({ variant = 'card' }) => {
  const { deferredPrompt, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showIOSGuide]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await promptInstall();
    } else {
      setShowIOSGuide(true);
    }
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-[#146c43] bg-[#e6f4ec] px-3.5 py-2.5 rounded-2xl">
        <CheckCircle2 size={16} />
        <span>تطبيق «دليل أبوحمص» مثبّت بالفعل على جهازك</span>
      </div>
    );
  }

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-2xl bg-[#0f5132] text-white text-sm font-semibold hover:bg-[#146c43] active:scale-95 transition-all whitespace-nowrap shrink-0"
        >
          <Download size={16} />
          تثبيت التطبيق
        </button>
      ) : (
        <div className="bg-gradient-to-l from-[#003820] to-[#0f5132] text-white rounded-3xl p-5 shadow-civic-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[#9ff1bd] text-xs font-semibold">
                <Smartphone size={15} />
                <span>تطبيق ويب خفيف (PWA)</span>
              </div>
              <h3 className="text-base font-bold">ثبّت «دليل أبوحمص» على شاشة موبايلك</h3>
              <p className="text-xs text-white/80 leading-relaxed">
                وصول فوري بدون تحميل من المتجر، يعمل بسرعة فائقة حتى مع ضعف الإنترنت في القرى والطرق.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-4 w-full min-h-[48px] bg-[#9ff1bd] text-[#003820] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Download size={18} />
            {deferredPrompt ? 'تثبيت التطبيق الآن مجاناً' : isIOS ? 'خطوات التثبيت على iPhone / Safari' : 'تثبيت على الشاشة الرئيسية'}
          </button>
        </div>
      )}

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 bg-[#003820]/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-civic-3 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="pwa-install-guide-title" className="text-base font-bold text-[#181c1c]">تثبيت دليل أبوحمص على الهاتف</h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-10 h-10 rounded-full bg-[#f1f4f2] flex items-center justify-center text-[#404942]"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#404942]">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7]">
                <div className="w-7 h-7 rounded-full bg-[#0f5132] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <p>
                  {isIOS
                    ? 'افتح قائمة المشاركة في أسفل متصفح Safari عبر أيقونة المشاركة.'
                    : 'اضغط على قائمة المتصفح (النقاط الثلاث أعلى الشاشة) في Chrome أو Edge.'}
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7]">
                <div className="w-7 h-7 rounded-full bg-[#0f5132] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <p className="flex items-center gap-1.5 flex-wrap">
                  <span>اختر</span>
                  <strong className="text-[#003820]">«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong>
                  <Share size={14} className="inline text-[#0f5132]" />
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7]">
                <div className="w-7 h-7 rounded-full bg-[#0f5132] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <p>اضغط «إضافة» وسيظهر شعار «دليل أبوحمص» كتطبيق مستقل على شاشة هاتفك.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[46px] bg-[#0f5132] text-white font-semibold text-sm rounded-2xl"
            >
              فهمت، شكراً
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-[#735c00] text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-md">
      <WifiOff size={14} />
      <span>أنت تتصفح حالياً بدون إنترنت — البيانات المحفوظة متاحة، وستتزامن الطلبات فور عودة الشبكة.</span>
    </div>
  );
};
