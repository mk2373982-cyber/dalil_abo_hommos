import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع أثناء تشغيل الشاشة.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('App ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'حدث خطأ تقني مؤقت أثناء الاتصال بالبيانات. يمكنك إعادة المحاولة الآن.';
      if (this.state.message.includes('Missing or insufficient permissions')) {
        friendly = 'لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء. يرجى تسجيل الدخول بحساب المشرف المعتمد.';
      }
      return (
        <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center p-6" dir="rtl">
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-6 max-w-md w-full text-center shadow-civic-1">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mb-4">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-bold text-[#181c1c] mb-2">عذراً، تعذر تحميل الصفحة</h2>
            <p className="text-sm text-[#404942] leading-relaxed mb-6">{friendly}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/home';
              }}
              className="w-full min-h-[48px] bg-[#0f5132] text-white font-semibold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RotateCcw size={18} />
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
