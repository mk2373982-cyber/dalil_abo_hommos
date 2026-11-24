import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  CloudUpload,
  Coins,
  FileSpreadsheet,
  Lock,
  Megaphone,
  MessageCircle,
  Percent,
  PhoneCall,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminShell } from '../../components/SharedUI';
import { AnimatedFilterChip, FadeInUp } from '../../components/MotionEffects';
import { buildWhatsAppUrl, parseCsvLine, validateEgyptPhone } from '../../lib/formatters';
import { buildMerchantWhatsAppReport, computePlacePerformance } from '../../lib/merchantReport';
import type { AdminRole, AdminUser, Campaign, FinanceSettlement, Offer, PartnerScope, Place } from '../../types';

// ============================================================
// 1. WHATSAPP MANUAL QUEUE (SCREEN_8)
// ============================================================
export const AdminWhatsappQueuePage: React.FC = () => {
  const { whatsappQueue, isAuditor, saveWhatsappQueueItem, updateWhatsappStatus, showToast } = useApp();
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [templateName, setTemplateName] = useState('ترحيب بنشاط جديد');
  const [messageBody, setMessageBody] = useState(
    'أهلاً بك في مبادرة دليل أبوحمص الرقمية! تم تفعيل بطاقة نشاطك بنجاح وتظهر الآن لأهالي المركز.'
  );

  const templates = [
    {
      name: 'ترحيب بنشاط جديد',
      body: 'أهلاً بك في مبادرة دليل أبوحمص الرقمية! تم تفعيل بطاقة نشاطك بنجاح وتظهر الآن لأهالي المركز مجاناً.',
    },
    {
      name: 'تأكيد تعديل بيانات',
      body: 'تم تحديث رقم الهاتف ومواعيد العمل الخاصة بكم على دليل أبوحمص بناءً على طلبكم. بالتوفيق دائماً!',
    },
    {
      name: 'رد على طلب إعلان',
      body: 'شكراً لتواصلكم مع فريق الترويج التجاري بدليل أبوحمص. نرسل لكم تفاصيل باقات الظهور بالواجهة الرئيسية.',
    },
  ];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientName.trim().length < 2 || phone.trim().length < 8 || messageBody.trim().length < 2) {
      showToast('يرجى استكمال اسم المستلم ورقم الهاتف ونص الرسالة بشكل صحيح', 'error');
      return;
    }
    try {
      await saveWhatsappQueueItem({
        id: `wa-${Date.now().toString(36)}`,
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        templateName,
        messageBody: messageBody.trim(),
        status: 'pending',
      });
      setRecipientName('');
      setPhone('');
    } catch {
      showToast('تعذرت إضافة الرسالة لطابور واتساب حالياً', 'error');
    }
  };

  return (
    <AdminShell
      title="طابور رسائل واتساب اليدوي"
      subtitle="قوالب جاهزة للتواصل المباشر مع أصحاب الأنشطة وتوثيق الإرسال"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Composer */}
        <FadeInUp delay={0.02} className="lg:col-span-5">
          <form
            onSubmit={handleAdd}
            className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4"
          >
            <h2 className="text-sm font-bold text-[#003820]">إضافة رسالة جديدة للطابور</h2>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <AnimatedFilterChip
                  key={t.name}
                  active={templateName === t.name}
                  onClick={() => {
                    setTemplateName(t.name);
                    setMessageBody(t.body);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                    templateName === t.name
                      ? 'bg-[#003820] text-white'
                      : 'bg-[#f1f4f2] text-[#404942] hover:bg-[#e6f4ec]'
                  }`}
                >
                  {t.name}
                </AnimatedFilterChip>
              ))}
            </div>

          <input
            type="text"
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="اسم صاحب النشاط أو العميل"
            className="w-full min-h-[44px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
          />
          <input
            type="tel"
            required
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010XXXXXXXX"
            className="w-full min-h-[44px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-mono text-left"
          />
          <textarea
            rows={4}
            required
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            className="w-full p-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
          />
            <button
              type="submit"
              disabled={isAuditor}
              className="w-full min-h-[46px] rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Plus size={17} /> {isAuditor ? 'وضع القراءة فقط' : 'إضافة للطابور'}
            </button>
          </form>
        </FadeInUp>

        {/* Queue List */}
        <div className="lg:col-span-7 space-y-3">
          {whatsappQueue.map((item, idx) => (
            <FadeInUp key={item.id} index={idx}>
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#181c1c]">{item.recipientName}</h3>
                      <span className="text-xs font-mono text-[#404942]">{item.phone}</span>
                    </div>
                    <p className="text-[11px] text-[#0f5132] font-semibold mt-0.5">
                      {item.templateName || 'رسالة مباشرة'} {item.relatedTitle ? `· ${item.relatedTitle}` : ''}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      item.status === 'sent'
                        ? 'bg-[#e6f4ec] text-[#0f5132]'
                        : 'bg-[#fef3c7] text-[#92400e]'
                    }`}
                  >
                    {item.status === 'sent' ? 'تم الإرسال' : 'بانتظار الإرسال'}
                  </span>
                </div>

                <p className="text-xs text-[#404942] bg-[#f7faf8] p-3 rounded-2xl leading-relaxed">
                  {item.messageBody}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={buildWhatsAppUrl(item.phone, item.messageBody)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#146c43] hover:bg-[#198754] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <MessageCircle size={15} /> فتح واتساب للإرسال
                  </a>
                  {!isAuditor && item.status !== 'sent' && (
                    <button
                      type="button"
                      onClick={() => void updateWhatsappStatus(item.id, 'sent')}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#e6f4ec] text-[#003820] text-xs font-bold flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={15} /> توثيق كـ تم الإرسال
                    </button>
                  )}
                </div>
              </div>
            </FadeInUp>
          ))}
        </div>
      </div>
    </AdminShell>
  );
};

// ============================================================
// 2. CAMPAIGNS (5 FAIR-ROTATION SLOTS) & OFFERS (SCREEN_16)
// ============================================================
export const AdminCampaignsPage: React.FC = () => {
  const { campaigns, offers, places, categories, isAuditor, saveCampaign, saveOffer, showToast } = useApp();
  const [editingSlot, setEditingSlot] = useState<Campaign | null>(null);
  const [newOfferTitle, setNewOfferTitle] = useState('');
  const [selectedOfferPlaceId, setSelectedOfferPlaceId] = useState('');
  const [newOfferPlace, setNewOfferPlace] = useState('');
  const [newOfferCategorySlug, setNewOfferCategorySlug] = useState(categories[0]?.slug || 'general');
  const [newOfferDiscount, setNewOfferDiscount] = useState('25');
  const [newOfferOriginal, setNewOfferOriginal] = useState('200');
  const [newOfferSale, setNewOfferSale] = useState('150');
  const [newOfferCode, setNewOfferCode] = useState('HOMOS25');
  const defaultExpiry = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [newOfferExpiresAt, setNewOfferExpiresAt] = useState(defaultExpiry);

  useEffect(() => {
    if (!editingSlot) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingSlot(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingSlot]);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOfferTitle.trim().length < 2 || newOfferPlace.trim().length < 2) {
      showToast('يرجى كتابة عنوان التخفيض واسم المكان (حرفان على الأقل)', 'error');
      return;
    }
    const discount = Math.max(0, Math.min(100, Number(newOfferDiscount) || 0));
    const originalPrice = Math.max(0, Number(newOfferOriginal) || 0);
    const salePrice = Math.max(0, Number(newOfferSale) || 0);
    const offer: Offer = {
      id: `off-${Date.now().toString(36)}`,
      title: newOfferTitle.trim(),
      placeId: selectedOfferPlaceId || undefined,
      placeName: newOfferPlace.trim(),
      categorySlug: newOfferCategorySlug || 'general',
      discountPercent: discount,
      originalPrice,
      salePrice,
      couponCode: newOfferCode.trim().toUpperCase() || 'HOMOS20',
      expiresAt: newOfferExpiresAt || defaultExpiry,
      active: true,
      featured: true,
    };
    try {
      await saveOffer(offer);
      setNewOfferTitle('');
      setSelectedOfferPlaceId('');
      setNewOfferPlace('');
      setNewOfferExpiresAt(defaultExpiry);
    } catch {
      showToast('تعذر نشر التخفيض حالياً، يرجى مراجعة البيانات والمحاولة مجدداً', 'error');
    }
  };

  return (
    <AdminShell
      title="إدارة التخفيضات وكراسي الواجهة (5-Slot Rotation)"
      subtitle="التحكم في كراسي الإعلانات الخمسة العادلة بالرئيسية وقسائم تبويب «التخفيضات»"
    >
      <div className="space-y-6">
        {/* 5 Fair Rotation Slots */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
            <Megaphone size={18} /> كراسي الواجهة الترويجية (دوران عادل بين 5 كراسي)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((camp, idx) => (
              <FadeInUp key={camp.id} index={idx} className="h-full">
                <div
                  className={`bg-white border rounded-3xl p-4 shadow-civic-1 space-y-3 h-full ${
                    camp.active ? 'border-[#e4ece7]' : 'border-dashed border-[#c0c9c0] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-xl bg-[#003820] text-[#9ff1bd] text-xs font-bold tabular-nums">
                      كرسي #{camp.slotNumber}
                    </span>
                    <button
                      type="button"
                      disabled={isAuditor}
                      onClick={() => void saveCampaign({ ...camp, active: !camp.active })}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold disabled:opacity-50 ${
                        camp.active ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#f1f4f2] text-[#404942]'
                      }`}
                    >
                      {camp.active ? 'نشط' : 'متوقف'}
                    </button>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#181c1c]">{camp.title}</h3>
                    <p className="text-xs text-[#404942] mt-1 line-clamp-2">{camp.subtitle}</p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#707971] pt-2 border-t border-[#e4ece7]">
                    <span>ظهور: {(camp.impressions || 0).toLocaleString('ar-EG')}</span>
                    <span>نقرات: {(camp.clicks || 0).toLocaleString('ar-EG')}</span>
                    {!isAuditor && (
                      <button
                        type="button"
                        onClick={() => setEditingSlot(camp)}
                        className="text-[#0f5132] font-bold hover:underline"
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Offers / Coupons Manager */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <FadeInUp delay={0.02} className="lg:col-span-5">
            <form
              onSubmit={handleCreateOffer}
              className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3.5"
            >
            <h2 className="text-sm font-bold text-[#003820] flex items-center gap-2">
              <Percent size={17} /> إضافة قسيمة تخفيض جديدة
            </h2>
            <input
              type="text"
              required
              value={newOfferTitle}
              onChange={(e) => setNewOfferTitle(e.target.value)}
              placeholder="عنوان العرض (مثال: خصم 30% على صينية المشاوي)"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
            />
            <select
              value={selectedOfferPlaceId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedOfferPlaceId(pid);
                const found = places.find((p) => p.id === pid);
                if (found) {
                  setNewOfferPlace(found.name);
                  setNewOfferCategorySlug(found.categorySlug);
                }
              }}
              className="w-full min-h-[42px] px-3.5 rounded-2xl bg-[#f1f4f2] text-xs font-semibold outline-none"
            >
              <option value="">ربط بمكان من الدليل (اختياري)</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.area}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={newOfferPlace}
              onChange={(e) => setNewOfferPlace(e.target.value)}
              placeholder="اسم المحل أو المطعم"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newOfferCategorySlug}
                onChange={(e) => setNewOfferCategorySlug(e.target.value)}
                className="min-h-[42px] px-3 rounded-2xl bg-[#f1f4f2] text-xs font-semibold outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                dir="ltr"
                value={newOfferExpiresAt}
                onChange={(e) => setNewOfferExpiresAt(e.target.value)}
                aria-label="تاريخ انتهاء العرض"
                className="min-h-[42px] px-3 rounded-2xl bg-[#f1f4f2] text-xs font-mono outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={newOfferDiscount}
                onChange={(e) => setNewOfferDiscount(e.target.value)}
                placeholder="الخصم %"
                className="min-h-[42px] px-3 rounded-2xl bg-[#f1f4f2] text-xs tabular-nums outline-none"
              />
              <input
                type="number"
                min={0}
                value={newOfferOriginal}
                onChange={(e) => setNewOfferOriginal(e.target.value)}
                placeholder="قبل الخصم"
                className="min-h-[42px] px-3 rounded-2xl bg-[#f1f4f2] text-xs tabular-nums outline-none"
              />
              <input
                type="number"
                min={0}
                value={newOfferSale}
                onChange={(e) => setNewOfferSale(e.target.value)}
                placeholder="بعد الخصم"
                className="min-h-[42px] px-3 rounded-2xl bg-[#f1f4f2] text-xs tabular-nums outline-none"
              />
            </div>
            <input
              type="text"
              dir="ltr"
              value={newOfferCode}
              onChange={(e) => setNewOfferCode(e.target.value)}
              placeholder="HOMOS25"
              className="w-full min-h-[42px] px-3.5 rounded-2xl bg-[#f1f4f2] text-xs font-mono text-left outline-none"
            />
              <button
                type="submit"
                disabled={isAuditor}
                className="w-full min-h-[46px] rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-sm font-bold"
              >
                {isAuditor ? 'وضع القراءة فقط' : 'نشر في تبويب «التخفيضات»'}
              </button>
            </form>
          </FadeInUp>

          <FadeInUp delay={0.06} className="lg:col-span-7">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
            <h2 className="text-sm font-bold text-[#003820]">التخفيضات المنشورة ({offers.length})</h2>
            <div className="divide-y divide-[#e4ece7]">
              {offers.map((off, idx) => (
                <FadeInUp key={off.id} index={idx} y={12}>
                  <div className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#181c1c] truncate">{off.title}</p>
                      <p className="text-xs text-[#404942]">
                        {off.placeName} · كود <span className="font-mono font-bold text-[#0f5132]">{off.couponCode}</span> ·{' '}
                        {off.salePrice} ج.م (خصم {off.discountPercent}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isAuditor}
                      onClick={() => void saveOffer({ ...off, active: !off.active })}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold shrink-0 disabled:opacity-50 ${
                        off.active ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#f1f4f2] text-[#707971]'
                      }`}
                    >
                      {off.active ? 'فعّال' : 'موقوف'}
                    </button>
                  </div>
                </FadeInUp>
              ))}
            </div>
            </div>
          </FadeInUp>
        </section>
      </div>

      {/* Edit Campaign Slot Modal */}
      {editingSlot && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingSlot(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#003820]">
              تعديل كرسي الواجهة #{editingSlot.slotNumber}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editingSlot.title}
                onChange={(e) => setEditingSlot({ ...editingSlot, title: e.target.value })}
                placeholder="العنوان الرئيسي"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
              />
              <textarea
                rows={2}
                value={editingSlot.subtitle || ''}
                onChange={(e) => setEditingSlot({ ...editingSlot, subtitle: e.target.value })}
                placeholder="الوصف المختصر"
                className="w-full p-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
              />
              <input
                type="text"
                dir="ltr"
                value={editingSlot.targetRoute}
                onChange={(e) => setEditingSlot({ ...editingSlot, targetRoute: e.target.value })}
                placeholder="/offers"
                className="w-full min-h-[42px] px-3.5 rounded-2xl bg-[#f1f4f2] text-xs font-mono text-left outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="min-h-[42px] rounded-2xl bg-[#f1f4f2] text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await saveCampaign(editingSlot);
                    setEditingSlot(null);
                  } catch {
                    showToast('تعذر حفظ تعديلات الكرسي الترويجي', 'error');
                  }
                }}
                className="min-h-[42px] rounded-2xl bg-[#003820] text-white text-xs font-bold"
              >
                حفظ الكرسي
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

// ============================================================
// 3. STRICT PARTNER FINANCE ENGINE — رائد & محمد (SCREEN_12)
// ============================================================
export const AdminFinancePage: React.FC = () => {
  const { financeConfig, financeSettlements, isAuditor, saveFinanceConfig, closeNewSettlement, user, showToast } =
    useApp();

  const [raedInput, setRaedInput] = useState<string>(
    financeConfig.isConfigured && financeConfig.raedPercent !== undefined
      ? String(financeConfig.raedPercent)
      : ''
  );
  const [mohamedInput, setMohamedInput] = useState<string>(
    financeConfig.isConfigured && financeConfig.mohamedPercent !== undefined
      ? String(financeConfig.mohamedPercent)
      : ''
  );
  const [changeNote, setChangeNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New Settlement Modal State
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [closingCycle, setClosingCycle] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('');
  const [totalRevenue, setTotalRevenue] = useState('');
  const [expenses, setExpenses] = useState('');
  const financeSyncKeyRef = useRef<string>('');

  useEffect(() => {
    const syncKey = `${financeConfig.isConfigured}-${financeConfig.raedPercent ?? ''}-${financeConfig.mohamedPercent ?? ''}-${financeConfig.updatedAt ?? ''}`;
    if (syncKey === financeSyncKeyRef.current) return;
    financeSyncKeyRef.current = syncKey;
    if (financeConfig.isConfigured) {
      setRaedInput(financeConfig.raedPercent !== undefined ? String(financeConfig.raedPercent) : '');
      setMohamedInput(
        financeConfig.mohamedPercent !== undefined ? String(financeConfig.mohamedPercent) : ''
      );
    }
  }, [financeConfig]);

  useEffect(() => {
    if (!settlementOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettlementOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settlementOpen]);

  // Auto-balance counterpart field cleanly while supporting decimals (e.g., 52.5 / 47.5)
  const handleRaedChange = (val: string) => {
    setRaedInput(val);
    setValidationError(null);
    const trimmed = val.trim();
    if (trimmed === '') return;
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      const counterpart = Number((100 - parsed).toFixed(2));
      setMohamedInput(String(counterpart));
    }
  };

  const handleMohamedChange = (val: string) => {
    setMohamedInput(val);
    setValidationError(null);
    const trimmed = val.trim();
    if (trimmed === '') return;
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      const counterpart = Number((100 - parsed).toFixed(2));
      setRaedInput(String(counterpart));
    }
  };

  // STRICT SAVE VALIDATION (SCREEN_12):
  // Rejects empty, non-numeric, negative, >100, or sum != 100%.
  // Preserves user input, shows inline error, NO success toast, NO history log on failure!
  const handleSaveRatios = async (e: React.FormEvent) => {
    e.preventDefault();
    const rTrim = raedInput.trim();
    const mTrim = mohamedInput.trim();

    if (rTrim === '' || mTrim === '') {
      setValidationError('يرجى إدخال نسبة كل من «رائد» و«محمد» بالكامل قبل الحفظ.');
      return;
    }

    const rVal = Number(rTrim);
    const mVal = Number(mTrim);

    if (Number.isNaN(rVal) || Number.isNaN(mVal) || !Number.isFinite(rVal) || !Number.isFinite(mVal)) {
      setValidationError('القيم المدخلة يجب أن تكون أرقاماً صحيحة أو عشرية فقط (مثال: 52.5 و 47.5).');
      return;
    }

    if (rVal < 0 || mVal < 0) {
      setValidationError('لا يمكن قبول نسب سالبة؛ يجب أن تكون كل نسبة بين 0% و 100%.');
      return;
    }

    if (rVal > 100 || mVal > 100) {
      setValidationError('لا يمكن أن تتجاوز نسبة أي شريك 100%.');
      return;
    }

    const sum = Number((rVal + mVal).toFixed(4));
    if (Math.abs(sum - 100) > 0.001) {
      setValidationError(
        `مجموع النسبتين حالياً هو ${sum}% ويجب أن يساوي 100% بالضبط قبل الحفظ.`
      );
      return;
    }

    setValidationError(null);
    setSaving(true);
    try {
      const nextLog = {
        raedPercent: rVal,
        mohamedPercent: mVal,
        changedBy: user?.displayName || user?.email || 'الإدارة',
        changedAt: new Date().toISOString(),
        note: changeNote.trim() || 'تحديث نسب توزيع الدورات المالية القادمة',
      };
      await saveFinanceConfig({
        isConfigured: true,
        raedPercent: rVal,
        mohamedPercent: mVal,
        updatedBy: nextLog.changedBy,
        history: [nextLog, ...(financeConfig.history || [])],
      });
      setChangeNote('');
    } catch {
      showToast('تعذر حفظ نسب الشراكة حالياً، تأكد من الصلاحيات وحاول مجدداً', 'error');
    } finally {
      setSaving(false);
    }
  };

  // CANCEL RESTORES LAST SAVED VALUES
  const handleCancel = () => {
    setValidationError(null);
    if (financeConfig.isConfigured) {
      setRaedInput(String(financeConfig.raedPercent ?? ''));
      setMohamedInput(String(financeConfig.mohamedPercent ?? ''));
    } else {
      setRaedInput('');
      setMohamedInput('');
    }
    setChangeNote('');
    showToast('تم استرجاع آخر نسب محفوظة', 'info');
  };

  const handleCloseCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!financeConfig.isConfigured) {
      showToast('يجب تحديد نسب التوزيع وحفظها أولاً قبل إغلاق دورة مالية', 'error');
      return;
    }
    const rev = Number(totalRevenue);
    const exp = Number(expenses || 0);
    if (!periodLabel.trim() || Number.isNaN(rev) || rev < 0 || Number.isNaN(exp) || exp < 0) {
      showToast('يرجى إدخال اسم الدورة وأرقام إيرادات ومصروفات صحيحة', 'error');
      return;
    }
    const net = Math.max(0, rev - exp);
    const rPct = financeConfig.raedPercent ?? 0;
    const mPct = financeConfig.mohamedPercent ?? 0;
    const settlement: FinanceSettlement = {
      id: `set-${Date.now().toString(36)}`,
      periodLabel: periodLabel.trim(),
      totalRevenue: rev,
      expenses: exp,
      netProfit: net,
      raedPercentLocked: rPct,
      mohamedPercentLocked: mPct,
      raedShare: Number(((net * rPct) / 100).toFixed(2)),
      mohamedShare: Number(((net * mPct) / 100).toFixed(2)),
      status: 'closed',
      closedAt: new Date().toISOString(),
    };
    setClosingCycle(true);
    try {
      await closeNewSettlement(settlement);
      setPeriodLabel('');
      setTotalRevenue('');
      setExpenses('');
      setSettlementOpen(false);
    } catch {
      showToast('تعذر إغلاق الدورة المالية حالياً، يرجى المحاولة مجدداً', 'error');
    } finally {
      setClosingCycle(false);
    }
  };

  const parsedSum = useMemo(() => {
    const r = Number(raedInput);
    const m = Number(mohamedInput);
    if (raedInput.trim() === '' || mohamedInput.trim() === '' || Number.isNaN(r) || Number.isNaN(m)) {
      return null;
    }
    return Number((r + m).toFixed(2));
  }, [raedInput, mohamedInput]);

  return (
    <AdminShell
      title="حسابات الشريكين والتسويات المالية"
      subtitle="إدارة نسب توزيع الأرباح بين «رائد» و«محمد» مع قفل التسويات السابقة تاريخياً"
      headerAction={
        !isAuditor ? (
          <button
            type="button"
            disabled={!financeConfig.isConfigured}
            onClick={() => setSettlementOpen(true)}
            className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#003820] disabled:opacity-45 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Lock size={15} /> إغلاق دورة مالية جديدة
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Status Banner */}
        <FadeInUp delay={0.02}>
          {!financeConfig.isConfigured ? (
            <div className="bg-[#fef3c7] border border-[#f5d061] rounded-3xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-[#92400e] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#735c00]">نسب التوزيع لم تُحدد بعد</p>
                <p className="text-xs text-[#92400e] leading-relaxed">
                  لم يتم تعيين نسب افتراضية مسبقاً. يرجى إدخال نسب الشريكين «رائد» و«محمد» يدوياً بحيث يكون مجموعهما 100% بالضبط، وستُطبَّق النسب المعتمدة على الدورات المالية القادمة فقط.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#e6f4ec] border border-[#b7e2c8] rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={22} className="text-[#0f5132] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#003820]">
                    النسب المعتمدة للدورات القادمة: رائد ({financeConfig.raedPercent}%) · محمد ({financeConfig.mohamedPercent}%)
                  </p>
                  <p className="text-xs text-[#0f5132]">
                    آخر تحديث بواسطة: {financeConfig.updatedBy || 'الإدارة'} — لا يؤثر التعديل على التسويات المغلقة سابقاً.
                  </p>
                </div>
              </div>
            </div>
          )}
        </FadeInUp>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Ratio Configuration Form */}
          <FadeInUp delay={0.06} className="lg:col-span-6">
            <form
              onSubmit={handleSaveRatios}
              noValidate
              className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4"
            >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
                <Coins size={18} /> إعداد نسب توزيع الشريكين
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f1f4f2] text-[#404942]">
                للدورات القادمة فقط
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2">
                <label className="text-xs font-bold text-[#003820] block">نسبة الشريك: رائد (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={raedInput}
                  onChange={(e) => handleRaedChange(e.target.value)}
                  placeholder="مثال: 52.5"
                  className="w-full min-h-[48px] px-3.5 rounded-xl bg-white border border-[#d7ebe0] focus:border-[#0f5132] outline-none text-lg font-bold tabular-nums text-left text-[#003820]"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2">
                <label className="text-xs font-bold text-[#735c00] block">نسبة الشريك: محمد (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={mohamedInput}
                  onChange={(e) => handleMohamedChange(e.target.value)}
                  placeholder="مثال: 47.5"
                  className="w-full min-h-[48px] px-3.5 rounded-xl bg-white border border-[#e4ece7] focus:border-[#0f5132] outline-none text-lg font-bold tabular-nums text-left text-[#735c00]"
                />
              </div>
            </div>

            {/* Live Sum Indicator */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#f1f4f2] text-xs font-bold">
              <span>إجمالي النسبتين المطلوب: 100%</span>
              <span
                className={`tabular-nums ${
                  parsedSum === null
                    ? 'text-[#707971]'
                    : Math.abs(parsedSum - 100) <= 0.001
                      ? 'text-[#0f5132]'
                      : 'text-[#ba1a1a]'
                }`}
              >
                المجموع الحالي: {parsedSum === null ? '—' : `${parsedSum}%`}
              </span>
            </div>

            {/* Inline Validation Error (Preserves Input!) */}
            {validationError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a] text-xs font-bold flex items-start gap-2"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#181c1c]">ملاحظة التوثيق (اختياري)</label>
              <input
                type="text"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="مثال: اتفاق الشريكين لربع السنة الجديد"
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isAuditor}
                onClick={handleCancel}
                className="min-h-[46px] rounded-2xl bg-[#f1f4f2] hover:bg-[#e4ece7] disabled:opacity-50 text-[#404942] text-sm font-bold flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={16} /> إلغاء واستعادة
              </button>
              <button
                type="submit"
                disabled={saving || isAuditor}
                className="min-h-[46px] rounded-2xl bg-[#003820] hover:bg-[#0f5132] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5"
              >
                <Save size={16} /> {isAuditor ? 'قراءة فقط' : saving ? 'جارٍ الحفظ...' : 'حفظ النسب'}
              </button>
            </div>
            </form>
          </FadeInUp>

          {/* Audit Log */}
          <FadeInUp delay={0.1} className="lg:col-span-6">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <h2 className="text-base font-bold text-[#003820]">سجل تغييرات النسب (Audit Trail)</h2>
            {!financeConfig.history || financeConfig.history.length === 0 ? (
              <p className="text-xs text-[#707971] py-8 text-center">
                لم يتم تسجيل أي تغييرات في النسب حتى الآن.
              </p>
            ) : (
              <div className="divide-y divide-[#e4ece7]">
                {financeConfig.history.map((log, i) => (
                  <div key={`${log.changedAt}-${i}`} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#181c1c]">
                        رائد {log.raedPercent}% · محمد {log.mohamedPercent}%
                      </p>
                      <p className="text-[11px] text-[#404942]">{log.note}</p>
                    </div>
                    <div className="text-left text-[10px] text-[#707971] shrink-0">
                      <p className="font-semibold">{log.changedBy}</p>
                      <p>{new Date(log.changedAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </FadeInUp>
        </div>

        {/* Locked Historical Settlements (Immutable against Retroactive Ratio Changes!) */}
        <FadeInUp delay={0.14}>
          <section className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
                <Lock size={17} /> التسويات المالية المغلقة (مقفلة تاريخياً ولا تتأثر بأي تعديل لاحق)
              </h2>
              <p className="text-xs text-[#404942] mt-0.5">
                تحتفظ كل دورة مغلقة بنسبها التاريخية المقفلة وقيم توزيعها الأصلية.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#e4ece7] text-[#707971]">
                  <th className="py-3 px-3">الدورة المالية</th>
                  <th className="py-3 px-3">الإيرادات</th>
                  <th className="py-3 px-3">المصروفات</th>
                  <th className="py-3 px-3">صافي الربح</th>
                  <th className="py-3 px-3">حصة رائد (مقفلة)</th>
                  <th className="py-3 px-3">حصة محمد (مقفلة)</th>
                  <th className="py-3 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4ece7]">
                {financeSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f7faf8]">
                    <td className="py-3.5 px-3 font-bold text-[#181c1c]">{s.periodLabel}</td>
                    <td className="py-3.5 px-3 tabular-nums">{s.totalRevenue.toLocaleString('ar-EG')} ج.م</td>
                    <td className="py-3.5 px-3 tabular-nums">{s.expenses.toLocaleString('ar-EG')} ج.م</td>
                    <td className="py-3.5 px-3 font-bold text-[#003820] tabular-nums">
                      {s.netProfit.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <span className="font-bold text-[#0f5132]">
                        {(s.raedShare ?? (s.netProfit * s.raedPercentLocked) / 100).toLocaleString('ar-EG')} ج.م
                      </span>{' '}
                      <span className="text-[10px] text-[#707971]">({s.raedPercentLocked}%)</span>
                    </td>
                    <td className="py-3.5 px-3 tabular-nums">
                      <span className="font-bold text-[#735c00]">
                        {(s.mohamedShare ?? (s.netProfit * s.mohamedPercentLocked) / 100).toLocaleString('ar-EG')} ج.م
                      </span>{' '}
                      <span className="text-[10px] text-[#707971]">({s.mohamedPercentLocked}%)</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e6f4ec] text-[#0f5132] text-[10px] font-bold">
                        <Lock size={11} /> مغلقة وموثقة
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </section>
        </FadeInUp>
      </div>

      {/* Close New Cycle Modal */}
      {settlementOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSettlementOpen(false)}
        >
          <form
            onSubmit={handleCloseCycle}
            className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#003820]">إغلاق دورة مالية جديدة</h3>
            <p className="text-xs text-[#404942]">
              سيتم قفل هذه الدورة باستخدام النسب الحالية: رائد ({financeConfig.raedPercent}%) · محمد ({financeConfig.mohamedPercent}%).
            </p>
            <input
              type="text"
              required
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="اسم الدورة (مثال: مارس 2025)"
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="number"
                required
                min="0"
                value={totalRevenue}
                onChange={(e) => setTotalRevenue(e.target.value)}
                placeholder="إجمالي الإيرادات (ج.م)"
                className="min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm tabular-nums outline-none"
              />
              <input
                type="number"
                min="0"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                placeholder="المصروفات (ج.م)"
                className="min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm tabular-nums outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettlementOpen(false)}
                className="min-h-[44px] rounded-2xl bg-[#f1f4f2] text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={closingCycle}
                className="min-h-[44px] rounded-2xl bg-[#003820] disabled:opacity-60 text-white text-xs font-bold"
              >
                {closingCycle ? 'جارٍ الإغلاق...' : 'اعتماد وإغلاق الدورة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
};

// ============================================================
// 4. CSV BATCH IMPORT (SCREEN_42)
// ============================================================
export const AdminImportPage: React.FC = () => {
  const { categories, isAuditor, savePlace, showToast } = useApp();
  const [targetCatId, setTargetCatId] = useState(categories[0]?.id || 'cat-general');
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const { parsedRows, skippedRowsCount } = useMemo(() => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length <= 1) return { parsedRows: [], skippedRowsCount: 0 };
    const all = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      const rawPhone = cols[4] || '';
      const phoneCheck = validateEgyptPhone(rawPhone, { allowLandline: true });
      return {
        name: cols[0] || '',
        specialty: cols[1] || '',
        area: cols[2] || 'أبوحمص',
        address: cols[3] || 'مركز أبوحمص',
        phone: phoneCheck.valid ? phoneCheck.displayLocal : '',
        phoneValid: phoneCheck.valid,
      };
    });
    const valid = all.filter(
      (r) => r.name.length >= 2 && r.address.length >= 2 && r.phoneValid
    );
    return { parsedRows: valid, skippedRowsCount: all.length - valid.length };
  }, [csvText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCsvText(reader.result);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImportAll = async () => {
    if (isAuditor) return;
    if (parsedRows.length === 0) {
      showToast('لا توجد صفوف صالحة للاستيراد', 'error');
      return;
    }
    setImporting(true);
    let successCount = 0;
    let failedCount = 0;
    try {
      const cat = categories.find((c) => c.id === targetCatId) || categories[0];
      for (const row of parsedRows) {
        const place: Place = {
          id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          name: row.name,
          categoryId: cat?.id || 'cat-general',
          categorySlug: cat?.slug || 'general',
          specialty: row.specialty,
          area: row.area,
          address: row.address,
          phone: row.phone,
          whatsapp: row.phone,
          verified: false,
          openNow: true,
          qrCode: `ABH-${Math.floor(1000 + Math.random() * 9000)}`,
        };
        try {
          await savePlace(place);
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      if (failedCount === 0) {
        showToast(`تم استيراد ونشر ${successCount} مكان في الدليل بنجاح`, 'success');
      } else {
        showToast(
          `تم استيراد ${successCount} مكان، وتعذر حفظ ${failedCount} صفوف`,
          successCount > 0 ? 'info' : 'error'
        );
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminShell
      title="استيراد جماعي للأماكن (CSV Import)"
      subtitle="ارفع ملف CSV أو الصق البيانات لرفع عشرات الأماكن دفعة واحدة في ثوانٍ"
    >
      <div className="space-y-5 max-w-4xl">
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#181c1c]">القسم المستهدف للاستيراد</label>
              <select
                value={targetCatId}
                onChange={(e) => setTargetCatId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm font-semibold outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#181c1c]">رفع ملف CSV من جهازك</label>
              <label className="w-full min-h-[44px] px-4 rounded-2xl bg-[#e6f4ec] text-[#003820] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Upload size={16} /> اختر ملف (.csv)
                <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#181c1c]">
                محتوى CSV (الأعمدة: الاسم,التخصص,المنطقة,العنوان,الهاتف)
              </label>
              <button
                type="button"
                onClick={() =>
                  setCsvText(
                    'الاسم,التخصص,المنطقة,العنوان,الهاتف\nمثال نشاط,تخصص النشاط,شارع المحطة,أمام محطة قطار أبوحمص,01012345678'
                  )
                }
                className="text-[11px] font-bold text-[#0f5132] hover:underline"
              >
                إدراج قالب CSV توضيحي
              </button>
            </div>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'الاسم,التخصص,المنطقة,العنوان,الهاتف\n...'}
              className="w-full p-3.5 rounded-2xl bg-[#f1f4f2] font-mono text-xs outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#0f5132]">
              الصفوف الجاهزة للنشر: {parsedRows.length} صف
              {skippedRowsCount > 0 && (
                <span className="text-[#ba1a1a] mr-2">
                  (تم تخطي {skippedRowsCount} صفوف ناقصة البيانات أو بأرقام هواتف غير صالحة)
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={importing || isAuditor || parsedRows.length === 0}
              onClick={handleImportAll}
              className="min-h-[46px] px-6 rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
            >
              <FileSpreadsheet size={17} />
              {isAuditor
                ? 'للقراءة فقط (مراجع)'
                : importing
                  ? 'جارٍ النشر في Firestore...'
                  : `استيراد ونشر (${parsedRows.length}) مكان`}
            </button>
          </div>
        </div>
        </FadeInUp>

        {/* Preview Table */}
        {parsedRows.length > 0 && (
          <FadeInUp delay={0.08}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 overflow-x-auto">
            <p className="text-xs font-bold text-[#003820] mb-3">معاينة الصفوف قبل الاعتماد</p>
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#e4ece7] text-[#707971]">
                  <th className="py-2 px-3">الاسم</th>
                  <th className="py-2 px-3">التخصص</th>
                  <th className="py-2 px-3">المنطقة</th>
                  <th className="py-2 px-3">العنوان</th>
                  <th className="py-2 px-3">الهاتف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4ece7]">
                {parsedRows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-bold">{r.name}</td>
                    <td className="py-2.5 px-3">{r.specialty}</td>
                    <td className="py-2.5 px-3">{r.area}</td>
                    <td className="py-2.5 px-3">{r.address}</td>
                    <td className="py-2.5 px-3 font-mono">{r.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </FadeInUp>
        )}
      </div>
    </AdminShell>
  );
};

// ============================================================
// 5. ANALYTICS & ZERO-RESULT SEARCH DETECTOR (SCREEN_10)
// ============================================================
export const AdminAnalyticsPage: React.FC = () => {
  const {
    analyticsEvents,
    analyticsSampleLimit,
    hasMoreAnalytics,
    loadMoreAnalytics,
    places,
    settings,
    showToast,
  } = useApp();

  const callClicks = analyticsEvents.filter((e) => e.eventType === 'call_click').length;
  const waClicks = analyticsEvents.filter((e) => e.eventType === 'whatsapp_click').length;
  const searchEvents = analyticsEvents.filter((e) => e.eventType === 'search');
  const zeroSearches = analyticsEvents.filter((e) => e.eventType === 'zero_search');

  const merchantPerformance = useMemo(() => {
    return places
      .map((pl) => ({
        place: pl,
        stats: computePlacePerformance(pl, analyticsEvents),
      }))
      .sort((a, b) => {
        if (b.stats.totalInteractions !== a.stats.totalInteractions) {
          return b.stats.totalInteractions - a.stats.totalInteractions;
        }
        const bFeatured = b.place.featured || (b.place.filterTags && b.place.filterTags.length > 0) ? 1 : 0;
        const aFeatured = a.place.featured || (a.place.filterTags && a.place.filterTags.length > 0) ? 1 : 0;
        return bFeatured - aFeatured;
      })
      .slice(0, 10);
  }, [places, analyticsEvents]);

  const zeroSearchSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    zeroSearches.forEach((e) => {
      const q = (e.query || '').trim();
      if (q) counts[q] = (counts[q] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [zeroSearches]);

  return (
    <AdminShell
      title="التقارير والتحليلات وكاشف البحث الصفري"
      subtitle="رصد تفاعل أهالي أبوحمص واكتشاف الخدمات التي يبحثون عنها ولم تُضف بعد"
    >
      <div className="space-y-6">
        {/* Honest Sample Scope Notice */}
        <FadeInUp delay={0.01}>
          <div className="bg-[#e0f2fe] border border-[#bae6fd] rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs text-[#0369a1]">
              <p className="font-bold">
                نطاق التقرير الحالي: أحدث {analyticsEvents.length} حدث مسجّل (حد التحميل الحالي: {analyticsSampleLimit})
              </p>
              <p className="text-[#0c4a6e]">
                الأرقام التالية تمثل العينة الأحدث المرتّبة زمنياً من Firestore وليست بالضرورة إجمالي النشاط التاريخي الكامل.
              </p>
            </div>
            {hasMoreAnalytics && (
              <button
                type="button"
                onClick={loadMoreAnalytics}
                className="min-h-[38px] px-4 rounded-xl bg-[#0369a1] text-white text-xs font-bold shrink-0"
              >
                تحميل أحداث أقدم
              </button>
            )}
          </div>
        </FadeInUp>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FadeInUp index={0} className="h-full">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 h-full">
              <p className="text-xs text-[#404942] font-semibold">عداد الزيارات العام</p>
              <p className="text-2xl font-bold text-[#003820] tabular-nums mt-1">
                {settings.visitsCount.toLocaleString('ar-EG')}
              </p>
            </div>
          </FadeInUp>
          <FadeInUp index={1} className="h-full">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 h-full">
              <p className="text-xs text-[#404942] font-semibold flex items-center gap-1">
                <PhoneCall size={14} className="text-[#0f5132]" /> نقرات الاتصال
              </p>
              <p className="text-2xl font-bold text-[#181c1c] tabular-nums mt-1">{callClicks}</p>
            </div>
          </FadeInUp>
          <FadeInUp index={2} className="h-full">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 h-full">
              <p className="text-xs text-[#404942] font-semibold flex items-center gap-1">
                <MessageCircle size={14} className="text-[#146c43]" /> نقرات واتساب
              </p>
              <p className="text-2xl font-bold text-[#181c1c] tabular-nums mt-1">{waClicks}</p>
            </div>
          </FadeInUp>
          <FadeInUp index={3} className="h-full">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 h-full">
              <p className="text-xs text-[#404942] font-semibold flex items-center gap-1">
                <Search size={14} className="text-[#92400e]" /> بحث بلا نتائج
              </p>
              <p className="text-2xl font-bold text-[#ba1a1a] tabular-nums mt-1">{zeroSearches.length}</p>
            </div>
          </FadeInUp>
        </div>

        {/* Zero-Result Search Detector */}
        <FadeInUp delay={0.08}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
                  <Sparkles size={17} /> كاشف البحث بلا نتائج (فرص توسيع الدليل)
                </h2>
                <p className="text-xs text-[#404942]">
                  كلمات بحث عنها المواطنون في شاشة البحث ولم يجدوا لها نتائج — أضف أنشطة تغطيها فوراً.
                </p>
              </div>
              <Link
                to="/admin/places"
                className="min-h-[38px] px-4 rounded-xl bg-[#003820] text-white text-xs font-bold flex items-center"
              >
                إضافة مكان جديد
              </Link>
            </div>

            {zeroSearchSummary.length === 0 ? (
              <p className="text-xs text-[#707971] py-6 text-center">
                لم تُسجل عمليات بحث صفرية حتى الآن — جرّب البحث عن كلمة غير موجودة في شاشة البحث لتظهر هنا فوراً.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zeroSearchSummary.map(([term, count]) => (
                  <div
                    key={term}
                    className="p-3.5 rounded-2xl bg-[#fef3c7]/50 border border-[#f5d061] flex items-center justify-between"
                  >
                    <span className="text-sm font-bold text-[#735c00]">«{term}»</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-[#92400e] text-xs font-bold tabular-nums">
                      {count} مرة
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeInUp>

        {/* Monthly Merchant Performance WhatsApp Reports (Zero extra DB reads) */}
        <FadeInUp delay={0.1}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
                <Send size={17} /> تقارير أداء المشتركين والأنشطة (إرسال فوري عبر واتساب)
              </h2>
              <p className="text-xs text-[#404942] mt-0.5">
                أرسل لصاحب النشاط ملخص التفاعل (المكالمات، رسائل واتساب، وعمليات البحث) بضغطة واحدة لتعزيز الثقة وتجديد اشتراكات التمييز.
              </p>
            </div>
            <div className="divide-y divide-[#e4ece7]">
              {merchantPerformance.map(({ place, stats }) => {
                const reportText = buildMerchantWhatsAppReport(place, stats);
                return (
                  <div key={place.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#181c1c] truncate">{place.name}</p>
                        {(place.featured || (place.filterTags && place.filterTags.length > 0)) && (
                          <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#735c00] text-[10px] font-bold">
                            مميز
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#404942] mt-0.5 tabular-nums">
                        اتصال: <strong>{stats.callClicks}</strong> · واتساب: <strong>{stats.whatsappClicks}</strong> · بحث: <strong>{stats.searchMentions}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={buildWhatsAppUrl(place.whatsapp || place.phone, reportText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3.5 rounded-xl bg-[#146c43] hover:bg-[#198754] text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <MessageCircle size={14} /> إرسال التقرير عبر واتساب
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(reportText);
                            showToast('تم نسخ نص التقرير للحافظة', 'success');
                          } catch {
                            showToast('تعذر النسخ التلقائي على هذا المتصفح', 'info');
                          }
                        }}
                        className="min-h-[38px] px-3 rounded-xl bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] text-xs font-bold"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeInUp>

        {/* Recent Searches */}
        <FadeInUp delay={0.12}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-3">
            <h2 className="text-sm font-bold text-[#003820] flex items-center gap-2">
              <BarChart3 size={16} /> أحدث عمليات البحث المسجلة ({searchEvents.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {searchEvents.slice(0, 15).map((ev, i) => (
                <span
                  key={ev.id || i}
                  className="px-3 py-1.5 rounded-full bg-[#f1f4f2] text-xs font-semibold text-[#181c1c]"
                >
                  {ev.query} ({ev.resultCount ?? 0})
                </span>
              ))}
              {searchEvents.length === 0 && (
                <span className="text-xs text-[#707971]">لا توجد أحداث بحث مسجلة بعد.</span>
              )}
            </div>
          </div>
        </FadeInUp>
      </div>
    </AdminShell>
  );
};

// ============================================================
// 6. GLOBAL SETTINGS & CIVIC DISCLAIMER (SCREEN_4)
// ============================================================
export const AdminSettingsPage: React.FC = () => {
  const {
    settings,
    places,
    isSuperAdmin,
    isAuditor,
    adminsList,
    saveAdminUser,
    deleteAdminUser,
    savePublicSettings,
    initializeEssentialConfig,
    seedDemoCatalog,
    migrateRestaurantMenuPriceMaps,
    showToast,
  } = useApp();

  const [appName, setAppName] = useState(settings.appName);
  const [disclaimer, setDisclaimer] = useState(settings.disclaimer);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone || '');
  const [supportWhatsapp, setSupportWhatsapp] = useState(settings.supportWhatsapp || '');
  const [visitsCount, setVisitsCount] = useState(String(settings.visitsCount || 0));
  const [pwaInstallPromptEnabled, setPwaInstallPromptEnabled] = useState(
    settings.pwaInstallPromptEnabled !== false
  );
  const [saving, setSaving] = useState(false);
  const [opsBusy, setOpsBusy] = useState(false);
  const syncedKeyRef = useRef<string>('');

  // Partner / Admin Team Management State
  const [memberUid, setMemberUid] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<AdminRole>('partner');
  const [memberScopes, setMemberScopes] = useState<PartnerScope[]>(['clinic']);
  const [memberPlaces, setMemberPlaces] = useState<string[]>([]);
  const [memberActive, setMemberActive] = useState(true);
  const [savingMember, setSavingMember] = useState(false);

  const assignablePlaces = useMemo(
    () =>
      places.filter((p) => p.categorySlug === 'medical' || p.categorySlug === 'restaurants'),
    [places]
  );

  const demoPlacesForReview = useMemo(
    () => places.filter((p) => p.isDemoData),
    [places]
  );

  useEffect(() => {
    const syncKey = `${settings.appName}|${settings.disclaimer}|${settings.supportPhone ?? ''}|${settings.supportWhatsapp ?? ''}|${settings.visitsCount}|${settings.pwaInstallPromptEnabled ?? true}|${settings.updatedAt ?? ''}`;
    if (syncKey === syncedKeyRef.current) return;
    syncedKeyRef.current = syncKey;
    setAppName(settings.appName);
    setDisclaimer(settings.disclaimer);
    setSupportPhone(settings.supportPhone || '');
    setSupportWhatsapp(settings.supportWhatsapp || '');
    setVisitsCount(String(settings.visitsCount || 0));
    setPwaInstallPromptEnabled(settings.pwaInstallPromptEnabled !== false);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedVisits = Number(visitsCount);
      await savePublicSettings({
        ...settings,
        appName: appName.trim() || 'دليل أبوحمص',
        disclaimer: disclaimer.trim(),
        supportPhone: supportPhone.trim(),
        supportWhatsapp: supportWhatsapp.trim(),
        visitsCount: !Number.isNaN(parsedVisits) && parsedVisits >= 0 ? parsedVisits : settings.visitsCount,
        pwaInstallPromptEnabled,
      });
    } catch {
      showToast('تعذر حفظ الإعدادات حالياً، تأكد من الصلاحيات وحاول مجدداً', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleScope = (scope: PartnerScope) => {
    setMemberScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const toggleManagedPlace = (placeId: string) => {
    setMemberPlaces((prev) =>
      prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId]
    );
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberUid.trim() || !memberEmail.trim()) {
      showToast('يرجى إدخال معرّف Firebase UID والبريد الإلكتروني للمستخدم', 'error');
      return;
    }
    if (memberRole === 'partner' && memberScopes.length === 0) {
      showToast('يرجى تحديد نطاق واحد على الأقل للشريك (عيادة / مطعم / كابتن)', 'error');
      return;
    }
    setSavingMember(true);
    try {
      const record: AdminUser = {
        uid: memberUid.trim(),
        email: memberEmail.trim().toLowerCase(),
        name: memberName.trim() || memberEmail.trim(),
        role: memberRole,
        active: memberActive,
        ...(memberRole === 'partner'
          ? {
              partnerTypes: memberScopes,
              managedPlaceIds: memberPlaces,
            }
          : {
              partnerTypes: [],
              managedPlaceIds: [],
            }),
      };
      await saveAdminUser(record);
      setMemberUid('');
      setMemberEmail('');
      setMemberName('');
      setMemberRole('partner');
      setMemberScopes(['clinic']);
      setMemberPlaces([]);
      setMemberActive(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حفظ صلاحيات المستخدم', 'error');
    } finally {
      setSavingMember(false);
    }
  };

  const loadMemberIntoForm = (m: AdminUser) => {
    setMemberUid(m.uid);
    setMemberEmail(m.email);
    setMemberName(m.name || '');
    setMemberRole(m.role);
    setMemberScopes(m.partnerTypes || []);
    setMemberPlaces(m.managedPlaceIds || []);
    setMemberActive(m.active !== false);
  };

  return (
    <AdminShell
      title="الإعدادات العامة وعزل صلاحيات الشركاء"
      subtitle="الهوية المجتمعية، ربط الشركاء بأنشطتهم، والتهيئة الآمنة لقاعدة البيانات"
    >
      <div className="max-w-4xl space-y-6">
        <FadeInUp delay={0.02}>
          <form
            onSubmit={handleSave}
            className="bg-white border border-[#e4ece7] rounded-3xl p-5 sm:p-6 shadow-civic-1 space-y-4"
          >
            <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
              <Settings size={18} /> إعدادات المنصة العامة
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold">اسم المنصة</label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">عداد الزيارات المعروض بالرأس</label>
                <input
                  type="number"
                  value={visitsCount}
                  onChange={(e) => setVisitsCount(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm tabular-nums outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold">هاتف الدعم الفني</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm font-mono text-left outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">واتساب الإدارة</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] text-sm font-mono text-left outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold">
                نص المبادرة وإخلاء المسؤولية (مبادرة مجتمعية مستقلة غير حكومية)
              </label>
              <textarea
                rows={3}
                value={disclaimer}
                onChange={(e) => setDisclaimer(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-[#f1f4f2] text-sm outline-none"
              />
            </div>

            <label className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-bold text-[#003820] block">
                  إظهار نافذة تثبيت التطبيق التلقائية (PWA Install Modal)
                </span>
                <span className="text-[11px] text-[#404942] leading-relaxed block">
                  تظهر تلقائياً عند أول فتح للصفحة الرئيسية ولوحة الإدارة على الأجهزة غير المثبتة، وتختفي نهائياً بعد التثبيت.
                </span>
              </div>
              <input
                type="checkbox"
                disabled={isAuditor}
                checked={pwaInstallPromptEnabled}
                onChange={(e) => setPwaInstallPromptEnabled(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-[#0f5132] shrink-0"
              />
            </label>

            <button
              type="submit"
              disabled={saving || isAuditor}
              className="min-h-[46px] px-6 rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
            >
              <Check size={17} /> {isAuditor ? 'للقراءة فقط (مراجع)' : saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات ومزامنتها'}
            </button>
          </form>
        </FadeInUp>

        {/* Partner & Admin RBAC Isolation Management */}
        {isSuperAdmin && (
          <FadeInUp delay={0.06}>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 sm:p-6 shadow-civic-1 space-y-5">
              <div>
                <h2 className="text-base font-bold text-[#003820] flex items-center gap-2">
                  <Users size={18} /> إدارة المشرفين والشركاء وعزل الصلاحيات (/admins)
                </h2>
                <p className="text-xs text-[#404942] mt-1">
                  اربط كل حساب شريك عبر معرّف Firebase UID بنطاقه (عيادة / مطعم / كابتن) وبالأنشطة المحددة له فقط. يتم فرض هذا العزل مباشرة داخل قواعد Firestore.
                </p>
              </div>

              <form onSubmit={handleSaveMember} className="bg-[#f7faf8] border border-[#e4ece7] rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold">معرّف المستخدم (Firebase UID) *</label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={memberUid}
                      onChange={(e) => setMemberUid(e.target.value)}
                      placeholder="UID من صفحة دخول الشريك"
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#d7dbd9] text-xs font-mono text-left"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="partner@gmail.com"
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#d7dbd9] text-xs font-mono text-left"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold">الاسم المعروض</label>
                    <input
                      type="text"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="مثال: سكرتارية د. أحمد"
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-xs font-bold">الدور الوظيفي (Role)</label>
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value as AdminRole)}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white border border-[#d7dbd9] text-xs font-bold"
                    >
                      <option value="partner">شريك تشغيل معزول (Partner)</option>
                      <option value="moderator">مشرف محتوى (Moderator)</option>
                      <option value="auditor">مراجع مالي وإداري — قراءة فقط (Auditor)</option>
                      <option value="super_admin">مدير عام (Super Admin)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold pt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberActive}
                      onChange={(e) => setMemberActive(e.target.checked)}
                      className="w-4 h-4 accent-[#0f5132]"
                    />
                    حساب مفعل (إلغاء التفعيل يوقف الوصول فوراً)
                  </label>
                </div>

                {memberRole === 'partner' && (
                  <div className="space-y-3 pt-2 border-t border-[#e4ece7]">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[#003820]">نطاقات الشريك المسموحة:</p>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { id: 'clinic' as PartnerScope, label: 'سكرتارية عيادة (clinic)' },
                          { id: 'restaurant' as PartnerScope, label: 'مطبخ مطعم (restaurant)' },
                          { id: 'captain' as PartnerScope, label: 'كابتن توصيل (captain)' },
                        ].map((sc) => (
                          <label key={sc.id} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={memberScopes.includes(sc.id)}
                              onChange={() => toggleScope(sc.id)}
                              className="w-4 h-4 accent-[#0f5132]"
                            />
                            {sc.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {(memberScopes.includes('clinic') || memberScopes.includes('restaurant')) && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-[#003820]">
                          العيادات / المطاعم المصرّح لهذا الحساب بإدارتها ({memberPlaces.length}):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-[#e4ece7]">
                          {assignablePlaces.map((pl) => (
                            <label
                              key={pl.id}
                              className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-[#f7faf8] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={memberPlaces.includes(pl.id)}
                                onChange={() => toggleManagedPlace(pl.id)}
                                className="w-4 h-4 accent-[#0f5132]"
                              />
                              <span className="truncate font-semibold">{pl.name}</span>
                              <span className="text-[10px] text-[#707971] shrink-0">
                                ({pl.categorySlug === 'medical' ? 'عيادة' : 'مطعم'})
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingMember}
                  className="min-h-[42px] px-5 rounded-xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <UserPlus size={15} />
                  {savingMember ? 'جارٍ الحفظ...' : 'حفظ / تحديث صلاحيات الحساب'}
                </button>
              </form>

              {/* Current Admins & Partners List */}
              <div className="divide-y divide-[#e4ece7]">
                {adminsList.map((m) => (
                  <div key={m.uid} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-[#181c1c]">{m.name || m.email}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#e6f4ec] text-[#0f5132] text-[10px] font-bold">
                          {m.role}
                        </span>
                        {m.active === false && (
                          <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] text-[10px] font-bold">
                            موقوف
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-[#404942] truncate">
                        {m.email} · UID: {m.uid}
                      </p>
                      {m.role === 'partner' && (
                        <p className="text-[11px] text-[#707971]">
                          النطاقات: {(m.partnerTypes || []).join(', ') || '—'} · الأنشطة:{' '}
                          {(m.managedPlaceIds || []).length}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => loadMemberIntoForm(m)}
                        className="px-3 py-1.5 rounded-xl bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] font-bold"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAdminUser(m.uid)}
                        className="p-2 rounded-xl bg-[#ffdad6]/70 text-[#93000a]"
                        aria-label="حذف المستخدم"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {adminsList.length === 0 && (
                  <p className="text-xs text-[#707971] py-4 text-center">
                    لا توجد حسابات إضافية مسجلة بعد (حساب المدير العام الأساسي يعمل عبر الصلاحيات الافتراضية).
                  </p>
                )}
              </div>
            </div>
          </FadeInUp>
        )}

        {/* Safe Initialization, Migration & Explicit Demo Seeding */}
        {isSuperAdmin && (
          <FadeInUp delay={0.1}>
            <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-3xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={22} className="text-[#0f5132] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#181c1c]">
                    التهيئة الآمنة وترحيل البيانات (بدون مسح أو استبدال لتعديلات الإدارة)
                  </p>
                  <p className="text-xs text-[#404942] mt-0.5 leading-relaxed">
                    لا يتم حقن بيانات تجريبية أو تسويات مالية وهمية تلقائياً في الإنتاج. جميع العمليات التالية تكتب فقط المستندات أو الحقول الناقصة دون الكتابة فوق تعديلاتك القائمة.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={opsBusy}
                  onClick={async () => {
                    setOpsBusy(true);
                    try {
                      await initializeEssentialConfig();
                    } finally {
                      setOpsBusy(false);
                    }
                  }}
                  className="min-h-[44px] px-3.5 rounded-2xl bg-[#003820] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CloudUpload size={15} /> تهيئة الإعدادات والأقسام الناقصة
                </button>
                <button
                  type="button"
                  disabled={opsBusy}
                  onClick={async () => {
                    setOpsBusy(true);
                    try {
                      await migrateRestaurantMenuPriceMaps();
                    } finally {
                      setOpsBusy(false);
                    }
                  }}
                  className="min-h-[44px] px-3.5 rounded-2xl bg-white border border-[#0f5132] text-[#003820] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} /> ترحيل خرائط الأسعار والطوابير
                </button>
                <button
                  type="button"
                  disabled={opsBusy}
                  onClick={async () => {
                    setOpsBusy(true);
                    try {
                      await seedDemoCatalog();
                    } finally {
                      setOpsBusy(false);
                    }
                  }}
                  className="min-h-[44px] px-3.5 rounded-2xl bg-[#fef3c7] border border-[#f5d061] text-[#735c00] text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <AlertTriangle size={15} /> إضافة عينات عرض تجريبية (اختياري)
                </button>
              </div>

              {demoPlacesForReview.length > 0 && (
                <div className="bg-white border border-[#f5d061] rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-[#735c00]">
                    مراجعة السجلات المصنفة كبيانات تجريبية ({demoPlacesForReview.length}) — لا تُحذف تلقائياً:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {demoPlacesForReview.map((pl) => (
                      <span
                        key={pl.id}
                        className="px-2.5 py-1 rounded-xl bg-[#fef3c7]/60 text-[#735c00] text-[11px] font-semibold"
                      >
                        {pl.name} ({pl.id})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FadeInUp>
        )}
      </div>
    </AdminShell>
  );
};
