import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike,
  Check,
  ChevronLeft,
  Clock,
  FileText,
  History,
  Save,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StackLayout } from '../../components/SharedUI';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import {
  clearActivityHistory,
  clearCitizenProfile,
  readActivityHistory,
  readCitizenProfile,
  removeActivityHistoryItem,
  replaceCitizenProfile,
  type ActivityRecord,
  type ActivityRecordType,
} from '../../lib/citizenProfile';
import { usePageSeo } from '../../lib/shareCard';

const TYPE_META: Record<
  ActivityRecordType,
  { label: string; icon: React.ComponentType<{ size?: number }>; badgeClass: string }
> = {
  clinic: {
    label: 'حجز عيادة',
    icon: Stethoscope,
    badgeClass: 'bg-[#e6f4ec] text-[#0f5132]',
  },
  order: {
    label: 'طلب مطعم',
    icon: UtensilsCrossed,
    badgeClass: 'bg-[#fef3c7] text-[#92400e]',
  },
  delivery: {
    label: 'مشوار دليفري',
    icon: Bike,
    badgeClass: 'bg-[#e0f2fe] text-[#0369a1]',
  },
  submission: {
    label: 'طلب / بلاغ',
    icon: FileText,
    badgeClass: 'bg-[#f3e8ff] text-[#6b21a8]',
  },
};

export const MyActivityPage: React.FC = () => {
  const { settings, showToast } = useApp();
  usePageSeo('طلباتي وحجوزاتي وبياناتي السريعة', 'سجل حجوزات العيادات وطلبات المطاعم ومشاوير الدليفري والبيانات السريعة المحفوظة على جهازك فقط.');

  const [profile, setProfile] = useState(() => readCitizenProfile());
  const [savedNotice, setSavedNotice] = useState(false);
  const [history, setHistory] = useState<ActivityRecord[]>(() => readActivityHistory());
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityRecordType>('all');

  const filteredHistory = useMemo(
    () => (typeFilter === 'all' ? history : history.filter((item) => item.type === typeFilter)),
    [history, typeFilter]
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = replaceCitizenProfile(profile);
    setProfile(cleaned);
    setSavedNotice(true);
    showToast('تم حفظ بياناتك السريعة على جهازك لتعبئة النماذج تلقائياً', 'success');
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleClearProfile = () => {
    clearCitizenProfile();
    setProfile({ name: '', phone: '', area: '', address: '' });
    showToast('تم مسح بيانات التعبئة السريعة من هذا الجهاز', 'info');
  };

  const handleRemoveItem = (id: string) => {
    setHistory(removeActivityHistoryItem(id));
  };

  const handleClearHistory = () => {
    clearActivityHistory();
    setHistory([]);
    showToast('تم مسح سجل الطلبات والحجوزات من هذا الجهاز', 'info');
  };

  return (
    <StackLayout
      title="طلباتي وحجوزاتي"
      subtitle="سجل معاملاتك وبيانات التعبئة السريعة المحفوظة على جهازك فقط"
      backTo="/more"
    >
      <div className="space-y-6">
        {/* Privacy Reassurance Banner */}
        <FadeInUp delay={0.02}>
          <div className="bg-[#e6f4ec] border border-[#b7e2c8] rounded-3xl p-4 flex items-start gap-3">
            <ShieldCheck size={20} className="text-[#0f5132] shrink-0 mt-0.5" />
            <div className="text-xs text-[#003820] leading-relaxed">
              <strong>خصوصية كاملة وسرعة فائقة:</strong> جميع بياناتك السريعة وسجل طلباتك هنا محفوظة
              محلياً على هاتفك فقط لتسهيل الحجز والطلب بضغطة واحدة دون إعادة كتابة اسمك ورقمك كل مرة.
            </div>
          </div>
        </FadeInUp>

        {/* Citizen Auto-Fill Profile Card */}
        <FadeInUp delay={0.05}>
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-[#e6f4ec] text-[#0f5132] flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#003820]">بيانات التعبئة السريعة</h2>
                  <p className="text-[11px] text-[#404942]">تُملأ تلقائياً في حجوزات العيادات والمطاعم والدليفري</p>
                </div>
              </div>
              {(profile.name || profile.phone || profile.area || profile.address) && (
                <button
                  type="button"
                  onClick={handleClearProfile}
                  className="px-3 py-1.5 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#93000a] text-[11px] font-bold flex items-center gap-1"
                >
                  <Trash2 size={13} /> مسح
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#181c1c]">الاسم الكامل</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="مثال: أحمد محمد حسن"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#181c1c]">رقم الموبايل / واتساب</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="010XXXXXXXX"
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-mono text-left"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#181c1c]">المنطقة أو القرية</label>
                <select
                  value={profile.area}
                  onChange={(e) => setProfile({ ...profile, area: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                >
                  <option value="">اختر منطقتك في أبوحمص...</option>
                  {(settings.areas || []).map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#181c1c]">العنوان التفصيلي (للتوصيل)</label>
                <input
                  type="text"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="الشارع، رقم العمارة، علامة مميزة..."
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto min-h-[46px] px-6 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {savedNotice ? <Check size={17} /> : <Save size={17} />}
              {savedNotice ? 'تم الحفظ بنجاح' : 'حفظ البيانات على جهازي'}
            </button>
          </form>
        </FadeInUp>

        {/* Activity History List */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
              <History size={18} />
              سجل طلباتي وحجوزاتي ({history.length})
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-bold text-[#ba1a1a] hover:underline flex items-center gap-1"
              >
                <Trash2 size={13} /> مسح السجل بالكامل
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: `الكل (${history.length})` },
              { id: 'clinic', label: 'العيادات' },
              { id: 'order', label: 'المطاعم' },
              { id: 'delivery', label: 'الدليفري' },
              { id: 'submission', label: 'البلاغات والطلبات' },
            ].map((tab) => (
              <AnimatedFilterChip
                key={tab.id}
                active={typeFilter === tab.id}
                onClick={() => setTypeFilter(tab.id as 'all' | ActivityRecordType)}
                className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-[#003820] text-white'
                    : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                {tab.label}
              </AnimatedFilterChip>
            ))}
          </div>

          {filteredHistory.length === 0 ? (
            <AnimatedEmptyState>
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2.5 shadow-civic-1">
                <History size={34} className="mx-auto text-[#707971]" />
                <p className="text-sm font-bold text-[#181c1c]">لا توجد معاملات مسجلة في هذا التصنيف بعد</p>
                <p className="text-xs text-[#404942] max-w-sm mx-auto leading-relaxed">
                  أي حجز عيادة أو طلب مطعم أو مشوار دليفري أو اقتراح مكان ترسله سيظهر هنا تلقائياً لمتابعته لحظياً.
                </p>
                <div className="pt-2 flex flex-wrap justify-center gap-2">
                  <Link
                    to="/medical"
                    className="px-4 py-2 rounded-xl bg-[#e6f4ec] text-[#003820] text-xs font-bold"
                  >
                    حجز عيادة
                  </Link>
                  <Link
                    to="/restaurants"
                    className="px-4 py-2 rounded-xl bg-[#fef3c7] text-[#735c00] text-xs font-bold"
                  >
                    طلب مطعم
                  </Link>
                  <Link
                    to="/delivery"
                    className="px-4 py-2 rounded-xl bg-[#e0f2fe] text-[#0369a1] text-xs font-bold"
                  >
                    طلب دليفري
                  </Link>
                </div>
              </div>
            </AnimatedEmptyState>
          ) : (
            <AnimatedListContainer className="space-y-3">
              {filteredHistory.map((item, idx) => {
                const meta = TYPE_META[item.type] || TYPE_META.submission;
                const Icon = meta.icon;
                return (
                  <AnimatedListItem key={item.id} index={idx}>
                    <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex items-center justify-between gap-3">
                      <Link to={item.route} className="flex items-center gap-3 min-w-0 flex-1 group">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.badgeClass}`}>
                          <Icon size={19} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                            <span className="text-[11px] font-mono text-[#707971]">{item.code}</span>
                          </div>
                          <p className="text-sm font-bold text-[#181c1c] truncate group-hover:text-[#0f5132]">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-[#707971]">
                            {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                            <span className="inline-flex items-center gap-0.5 shrink-0">
                              <Clock size={11} />
                              {new Date(item.createdAt).toLocaleDateString('ar-EG', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <ChevronLeft size={18} className="text-[#707971] shrink-0 group-hover:text-[#003820]" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label="حذف من السجل"
                        className="w-9 h-9 rounded-xl bg-[#f1f4f2] hover:bg-[#ffdad6] text-[#707971] hover:text-[#ba1a1a] flex items-center justify-center shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </AnimatedListItem>
                );
              })}
            </AnimatedListContainer>
          )}
        </section>
      </div>
    </StackLayout>
  );
};
