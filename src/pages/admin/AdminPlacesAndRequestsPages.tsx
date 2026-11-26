import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Inbox,
  ListChecks,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  QrCode,
  Search,
  Star,
  Store,
  Trash2,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminShell, CivicImage, QRCodeCard } from '../../components/SharedUI';
import {
  AnimatedEmptyState,
  AnimatedFilterChip,
  AnimatedListContainer,
  AnimatedListItem,
  FadeInUp,
} from '../../components/MotionEffects';
import { getIconComponent } from '../../lib/icons';
import { buildWhatsAppUrl, validateEgyptPhone } from '../../lib/formatters';
import { buildMerchantWhatsAppReport, computePlacePerformance } from '../../lib/merchantReport';
import { isPlaceSubscribedToFilter, PlacePromoBadges } from '../../lib/promoFilters';
import {
  createEmptySchedule,
  formatWeeklyScheduleSummary,
  ORDERED_WEEKDAYS,
  parseHoursTextToSchedule,
  WEEKDAY_ARABIC_LABELS,
} from '../../lib/workingHours';
import type {
  GalleryItem,
  MenuItem,
  Place,
  PlaceService,
  Submission,
  WeekdayKey,
  WeeklySchedule,
} from '../../types';

const MAX_MENU_ITEMS = 60;
const MAX_SERVICES = 30;
const MAX_GALLERY_ITEMS = 20;

type EditorTab = 'basic' | 'hours' | 'menu' | 'services' | 'gallery';

export const AdminPlacesPage: React.FC = () => {
  const {
    categories,
    promoFilters,
    places,
    analyticsEvents,
    settings,
    isAuditor,
    savePlace,
    deletePlace,
    showToast,
  } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [selectedPromoId, setSelectedPromoId] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('basic');
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null);
  const [qrTarget, setQrTarget] = useState<Place | null>(null);

  const [form, setForm] = useState<Place>({
    id: '',
    name: '',
    categoryId: categories[0]?.id || 'cat-medical',
    categorySlug: categories[0]?.slug || 'medical',
    specialty: '',
    area: settings.areas?.[0] || 'شارع بورسعيد',
    address: '',
    phone: '',
    whatsapp: '',
    description: '',
    imageUrl: '',
    hours: '',
    verified: false,
    featured: false,
    openNow: true,
    qrCode: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editorOpen && !qrTarget && !deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(null);
      else if (qrTarget) setQrTarget(null);
      else if (editorOpen) setEditorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen, qrTarget, deleteTarget]);

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      const catMatch =
        selectedCatId === 'all' || p.categoryId === selectedCatId || p.categorySlug === selectedCatId;
      const promoMatch =
        selectedPromoId === 'all' || isPlaceSubscribedToFilter(p, selectedPromoId);
      const textMatch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.specialty || '').toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.phone.includes(q);
      return catMatch && promoMatch && textMatch;
    });
  }, [places, search, selectedCatId, selectedPromoId]);

  const toggleFormPromoFilter = (filterId: string) => {
    const current = Array.isArray(form.filterTags) ? form.filterTags : [];
    const exists = current.includes(filterId);
    const nextTags = exists
      ? current.filter((id) => id !== filterId)
      : [...current.slice(0, 14), filterId];
    const nextExp = { ...(form.filterExpirations || {}) };
    if (exists) delete nextExp[filterId];
    setForm({
      ...form,
      filterTags: nextTags,
      filterExpirations: Object.keys(nextExp).length > 0 ? nextExp : undefined,
      featured: nextTags.length > 0 ? true : form.featured,
    });
  };

  const updateFormFilterExpiry = (filterId: string, dateVal: string) => {
    const nextExp = { ...(form.filterExpirations || {}) };
    if (dateVal.trim()) nextExp[filterId] = dateVal.trim();
    else delete nextExp[filterId];
    setForm({
      ...form,
      filterExpirations: Object.keys(nextExp).length > 0 ? nextExp : undefined,
    });
  };

  const openNewPlace = () => {
    if (isAuditor) return;
    const firstCat = categories[0];
    const code = `ABH-${Math.floor(1000 + Math.random() * 9000)}`;
    setForm({
      id: `plc-${Date.now().toString(36)}`,
      name: '',
      categoryId: firstCat?.id || 'cat-general',
      categorySlug: firstCat?.slug || 'general',
      specialty: '',
      subCategory: '',
      area: settings.areas?.[0] || 'شارع بورسعيد',
      address: '',
      phone: '',
      whatsapp: '',
      description: '',
      imageUrl: '',
      hours: '',
      workingSchedule: undefined,
      is24Hours: false,
      hasDelivery: false,
      verified: false,
      featured: false,
      openNow: true,
      rating: undefined,
      reviewCount: undefined,
      tags: [],
      menuItems: [],
      services: [],
      gallery: [],
      qrCode: code,
    });
    setEditorTab('basic');
    setEditorOpen(true);
  };

  const openEditPlace = (place: Place) => {
    setForm({
      ...place,
      qrCode: place.qrCode || `ABH-${place.id.slice(-4).toUpperCase()}`,
    });
    setEditorTab('basic');
    setEditorOpen(true);
  };

  // --- Structured Weekly Schedule helpers ---
  const ensureSchedule = (): WeeklySchedule => {
    if (form.workingSchedule) return form.workingSchedule;
    const parsed = parseHoursTextToSchedule(form.hours);
    return parsed?.schedule || createEmptySchedule();
  };

  const updateDaySchedule = (
    day: WeekdayKey,
    updater: (cur: Array<{ open: string; close: string }>) => Array<{ open: string; close: string }>
  ) => {
    const base = ensureSchedule();
    const curSlots = base[day] || [];
    const next: WeeklySchedule = { ...base, [day]: updater(curSlots) };
    const summary = formatWeeklyScheduleSummary(next);
    setForm({
      ...form,
      workingSchedule: next,
      hours: summary || form.hours,
      is24Hours: false,
    });
  };

  // --- Menu items helpers ---
  const addMenuItem = () => {
    const cur = form.menuItems || [];
    if (cur.length >= MAX_MENU_ITEMS) {
      showToast(`الحد الأقصى لأصناف المنيو هو ${MAX_MENU_ITEMS} صنفاً`, 'error');
      return;
    }
    const item: MenuItem = {
      id: `m-${Date.now().toString(36)}-${cur.length + 1}`,
      category: cur[cur.length - 1]?.category || 'الأطباق الرئيسية',
      name: '',
      price: 0,
      description: '',
      imageUrl: '',
    };
    setForm({ ...form, menuItems: [...cur, item] });
  };

  const updateMenuItem = (idx: number, patch: Partial<MenuItem>) => {
    const next = [...(form.menuItems || [])];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, menuItems: next });
  };

  const removeMenuItem = (idx: number) => {
    const next = (form.menuItems || []).filter((_, i) => i !== idx);
    setForm({ ...form, menuItems: next });
  };

  // --- Services helpers ---
  const addService = () => {
    const cur = form.services || [];
    if (cur.length >= MAX_SERVICES) {
      showToast(`الحد الأقصى للخدمات هو ${MAX_SERVICES} خدمة`, 'error');
      return;
    }
    const srv: PlaceService = { name: '', description: '', priceLabel: '' };
    setForm({ ...form, services: [...cur, srv] });
  };

  const updateService = (idx: number, patch: Partial<PlaceService>) => {
    const next = [...(form.services || [])];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, services: next });
  };

  const removeService = (idx: number) => {
    setForm({ ...form, services: (form.services || []).filter((_, i) => i !== idx) });
  };

  // --- Gallery helpers ---
  const addGalleryItem = () => {
    const cur = form.gallery || [];
    if (cur.length >= MAX_GALLERY_ITEMS) {
      showToast(`الحد الأقصى لمعرض الصور هو ${MAX_GALLERY_ITEMS} صورة`, 'error');
      return;
    }
    const item: GalleryItem = {
      title: '',
      subtitle: '',
      tag: '',
      imageUrl: '',
    };
    setForm({ ...form, gallery: [...cur, item] });
  };

  const updateGalleryItem = (idx: number, patch: Partial<GalleryItem>) => {
    const next = [...(form.gallery || [])];
    next[idx] = { ...next[idx], ...patch };
    setForm({ ...form, gallery: next });
  };

  const removeGalleryItem = (idx: number) => {
    setForm({ ...form, gallery: (form.gallery || []).filter((_, i) => i !== idx) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuditor) {
      showToast('حساب المراجع للقراءة فقط', 'error');
      return;
    }
    if (form.name.trim().length < 2 || form.address.trim().length < 2) {
      showToast('يرجى إدخال اسم النشاط والعنوان التفصيلي بشكل صحيح', 'error');
      return;
    }
    const phoneCheck = validateEgyptPhone(form.phone, { allowLandline: true });
    if (!phoneCheck.valid) {
      showToast(phoneCheck.error || 'رقم الهاتف غير صالح', 'error');
      return;
    }

    let normalizedWhatsapp = phoneCheck.displayLocal;
    if (form.whatsapp?.trim()) {
      const waCheck = validateEgyptPhone(form.whatsapp, { allowLandline: true });
      if (!waCheck.valid) {
        showToast(waCheck.error || 'رقم الواتساب غير صالح', 'error');
        return;
      }
      normalizedWhatsapp = waCheck.displayLocal;
    }

    const isSafeUrl = (u: string): boolean =>
      /^https?:\/\/\S+$/i.test(u) || u.startsWith('/');

    if (form.imageUrl?.trim() && !isSafeUrl(form.imageUrl.trim())) {
      showToast('رابط الصورة الرئيسية يجب أن يبدأ بـ https:// أو http://', 'error');
      return;
    }

    // Validate & clean nested arrays according to Firestore rules bounds
    const usedMenuIds = new Set<string>();
    const cleanedMenu = (form.menuItems || [])
      .map((m, idx) => {
        let baseId = (m.id || `m-${idx + 1}`).trim() || `m-${idx + 1}`;
        while (usedMenuIds.has(baseId)) {
          baseId = `${baseId}-${idx + 1}`;
        }
        usedMenuIds.add(baseId);
        return {
          id: baseId,
          category: m.category.trim() || 'عام',
          name: m.name.trim(),
          price: Number(m.price),
          description: (m.description || '').trim(),
          ...(m.imageUrl?.trim() ? { imageUrl: m.imageUrl.trim() } : {}),
        };
      })
      .filter((m) => m.name.length > 0);

    if (cleanedMenu.length > MAX_MENU_ITEMS) {
      showToast(`لا يمكن حفظ أكثر من ${MAX_MENU_ITEMS} صنفاً في المنيو`, 'error');
      return;
    }
    for (const item of cleanedMenu) {
      if (!Number.isFinite(item.price) || item.price <= 0) {
        showToast(`يرجى إدخال سعر صحيح أكبر من صفر للصنف «${item.name}»`, 'error');
        return;
      }
      if (item.imageUrl && !isSafeUrl(item.imageUrl)) {
        showToast(`رابط صورة الصنف «${item.name}» غير صالح (يجب أن يبدأ بـ https://)`, 'error');
        return;
      }
    }

    const cleanedServices = (form.services || [])
      .map((s) => ({
        name: s.name.trim(),
        description: (s.description || '').trim(),
        priceLabel: (s.priceLabel || '').trim(),
      }))
      .filter((s) => s.name.length > 0)
      .slice(0, MAX_SERVICES);

    const cleanedGallery: GalleryItem[] = (form.gallery || [])
      .map((g, idx) => ({
        title: g.title.trim() || `صورة ${idx + 1}`,
        subtitle: (g.subtitle || '').trim(),
        tag: (g.tag || '').trim(),
        imageUrl: g.imageUrl.trim(),
      }))
      .filter((g) => g.imageUrl.length > 0)
      .slice(0, MAX_GALLERY_ITEMS);

    for (const g of cleanedGallery) {
      if (!isSafeUrl(g.imageUrl)) {
        showToast(`رابط الصورة «${g.title}» في المعرض غير صالح (يجب أن يبدأ بـ https://)`, 'error');
        return;
      }
    }

    const computedHours = form.is24Hours
      ? 'مفتوح 24 ساعة يومياً'
      : form.workingSchedule
        ? formatWeeklyScheduleSummary(form.workingSchedule) || form.hours
        : form.hours;

    setSaving(true);
    try {
      const chosenCat = categories.find((c) => c.id === form.categoryId);
      const cleanedTags = (form.tags || [])
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 20);
      await savePlace({
        ...form,
        name: form.name.trim(),
        specialty: form.specialty?.trim() || undefined,
        subCategory: form.subCategory?.trim() || undefined,
        address: form.address.trim(),
        imageUrl: form.imageUrl?.trim() || undefined,
        phone: phoneCheck.displayLocal,
        whatsapp: normalizedWhatsapp,
        categorySlug: chosenCat?.slug || form.categorySlug,
        hours: computedHours,
        hasDelivery: form.hasDelivery ? true : undefined,
        tags: cleanedTags.length > 0 ? cleanedTags : undefined,
        menuItems: cleanedMenu.length > 0 ? cleanedMenu : undefined,
        services: cleanedServices.length > 0 ? cleanedServices : undefined,
        gallery: cleanedGallery.length > 0 ? cleanedGallery : undefined,
      });
      setEditorOpen(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر حفظ المكان حالياً، يرجى مراجعة البيانات والمحاولة مجدداً',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://abuhoms.guide';

  return (
    <AdminShell
      title="إدارة الأماكن والأنشطة"
      subtitle="محرر متكامل للأماكن، المواعيد المنظمة، قوائم الطعام، الخدمات، ومعرض الصور (روابط URL)"
      headerAction={
        !isAuditor ? (
          <button
            type="button"
            onClick={openNewPlace}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-civic-1"
          >
            <Plus size={18} />
            إضافة مكان جديد
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Search & Dynamic Category Filter */}
        <FadeInUp delay={0.02}>
          <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#707971]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم، التخصص، المنطقة، أو الهاتف..."
                className="w-full min-h-[44px] pr-10 pl-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
              />
            </div>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#f1f4f2] border border-transparent focus:border-[#0f5132] outline-none text-sm font-semibold text-[#181c1c]"
            >
              <option value="all">كل الأقسام ({places.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {!c.active ? '(مخفي)' : ''}
                </option>
              ))}
            </select>
            <select
              value={selectedPromoId}
              onChange={(e) => setSelectedPromoId(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#fef3c7]/60 border border-[#f5d061] focus:border-[#0f5132] outline-none text-sm font-semibold text-[#735c00]"
            >
              <option value="all">كل باقات التمييز</option>
              {promoFilters.map((pf) => (
                <option key={pf.id} value={pf.id}>
                  {pf.name}
                </option>
              ))}
            </select>
          </div>
        </FadeInUp>

        {/* Places Grid */}
        {filteredPlaces.length === 0 ? (
          <AnimatedEmptyState>
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-8 text-center space-y-2 shadow-civic-1">
              <Store size={30} className="mx-auto text-[#707971]" />
              <p className="text-sm font-bold text-[#181c1c]">لا توجد أماكن مطابقة للبحث الحالي</p>
              <p className="text-xs text-[#404942]">جرّب تغيير الفلتر أو إضافة مكان جديد.</p>
            </div>
          </AnimatedEmptyState>
        ) : (
          <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPlaces.map((pl, idx) => {
              const cat = categories.find((c) => c.id === pl.categoryId || c.slug === pl.categorySlug);
              return (
                <AnimatedListItem key={pl.id} index={idx} className="h-full">
                  <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 flex flex-col justify-between gap-4 h-full">
                    <div className="flex items-start gap-3">
                      <CivicImage
                        src={pl.imageUrl}
                        alt={pl.name}
                        className="w-16 h-16 rounded-2xl shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-[#181c1c] truncate">{pl.name}</h3>
                          {pl.verified && <BadgeCheck size={15} className="text-[#0f5132] shrink-0" />}
                        </div>
                        <p className="text-xs text-[#404942] truncate">
                          {pl.specialty || cat?.name || 'نشاط محلي'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="px-2 py-0.5 rounded-lg bg-[#e6f4ec] text-[#0f5132] text-[10px] font-bold">
                            {cat?.name || pl.categorySlug}
                          </span>
                          {pl.isDemoData && (
                            <span className="px-2 py-0.5 rounded-lg bg-[#fef3c7] text-[#92400e] text-[10px] font-bold">
                              بيانات تجريبية
                            </span>
                          )}
                          <span className="text-[11px] text-[#707971] flex items-center gap-0.5">
                            <MapPin size={11} /> {pl.area}
                          </span>
                        </div>
                        <PlacePromoBadges place={pl} promoFilters={promoFilters} className="pt-1" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e4ece7]">
                      <span className="text-xs font-mono text-[#404942]">{pl.phone}</span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={buildWhatsAppUrl(
                            pl.whatsapp || pl.phone,
                            buildMerchantWhatsAppReport(pl, computePlacePerformance(pl, analyticsEvents))
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 rounded-xl bg-[#e6f4ec] hover:bg-[#d1ebd9] text-[#0f5132] flex items-center justify-center"
                          title="إرسال تقرير الأداء عبر واتساب"
                          aria-label="إرسال تقرير الأداء عبر واتساب"
                        >
                          <MessageCircle size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setQrTarget(pl)}
                          className="w-9 h-9 rounded-xl bg-[#f1f4f2] hover:bg-[#e6f4ec] text-[#003820] flex items-center justify-center"
                          title="عرض الباركود الذكي وبطاقة الواتساب"
                        >
                          <QrCode size={16} />
                        </button>
                        {!isAuditor && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditPlace(pl)}
                              className="min-h-[36px] px-3 rounded-xl bg-[#f1f4f2] hover:bg-[#e4ece7] text-[#181c1c] text-xs font-bold flex items-center gap-1"
                            >
                              <Edit3 size={14} /> تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(pl)}
                              className="w-9 h-9 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center"
                              aria-label="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimatedListItem>
              );
            })}
          </AnimatedListContainer>
        )}
      </div>

      {/* PLACE EDITOR MODAL WITH STRUCTURED SCHEDULE, MENU, SERVICES & GALLERY */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#e4ece7] px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#003820]">
                  محرر بيانات المكان المتكامل + معاينة الموبايل
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { id: 'basic', label: 'البيانات الأساسية', icon: Store },
                    { id: 'hours', label: 'مواعيد العمل', icon: Clock },
                    { id: 'menu', label: `المنيو (${(form.menuItems || []).length})`, icon: UtensilsCrossed },
                    { id: 'services', label: `الخدمات (${(form.services || []).length})`, icon: ListChecks },
                    { id: 'gallery', label: `المعرض (${(form.gallery || []).length})`, icon: ImageIcon },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEditorTab(tab.id as EditorTab)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                          editorTab === tab.id
                            ? 'bg-[#003820] text-white'
                            : 'bg-[#f1f4f2] text-[#404942] hover:bg-[#e6f4ec]'
                        }`}
                      >
                        <Icon size={13} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setEditorOpen(false)}
                className="w-10 h-10 rounded-full bg-[#f1f4f2] flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Column */}
              <div className="lg:col-span-7 space-y-4">
                {editorTab === 'basic' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">اسم المكان أو الطبيب *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">القسم الديناميكي *</label>
                        <select
                          value={form.categoryId}
                          onChange={(e) => {
                            const c = categories.find((item) => item.id === e.target.value);
                            setForm({
                              ...form,
                              categoryId: e.target.value,
                              categorySlug: c?.slug || form.categorySlug,
                            });
                          }}
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] outline-none text-sm font-semibold"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {!c.active ? '(مخفي)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">التخصص / الوصف المختصر</label>
                        <input
                          type="text"
                          value={form.specialty || ''}
                          onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                          placeholder="مثال: استشاري أطفال، مشويات بلدي..."
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">التصنيف الفرعي (لمطابقة فلاتر القسم)</label>
                        <input
                          type="text"
                          value={form.subCategory || ''}
                          onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                          placeholder="مثال: أطفال، مشويات، كافيهات..."
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">المنطقة / القرية</label>
                        <select
                          value={form.area}
                          onChange={(e) => setForm({ ...form, area: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] outline-none text-sm"
                        >
                          {(settings.areas || ['شارع بورسعيد']).map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">وسوم الفلترة (مفصولة بفاصلة)</label>
                        <input
                          type="text"
                          value={(form.tags || []).join('، ')}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              tags: e.target.value
                                .split(/[,،|;]/)
                                .map((t) => t.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="مثال: توصيل، عائلات، 24 ساعة"
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Quick-match category filter chips */}
                    {(() => {
                      const activeCat = categories.find((c) => c.id === form.categoryId);
                      const catFilters = (activeCat?.categoryFilters || []).filter((f) => f.enabled);
                      if (catFilters.length === 0) return null;
                      return (
                        <div className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2">
                          <p className="text-[11px] font-bold text-[#003820]">
                            تعيين سريع لفلاتر قسم «{activeCat?.name}» (اضغط لإدراج البطاقة تحت الفلتر):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {catFilters.map((cf) => (
                              <button
                                key={cf.id}
                                type="button"
                                onClick={() => {
                                  const val = (cf.matchValue || cf.label).trim();
                                  if (cf.matchField === 'hasDelivery') {
                                    setForm({ ...form, hasDelivery: !form.hasDelivery });
                                  } else if (cf.matchField === 'is24Hours') {
                                    setForm({
                                      ...form,
                                      is24Hours: !form.is24Hours,
                                      hours: !form.is24Hours ? 'مفتوح 24 ساعة يومياً' : form.hours,
                                    });
                                  } else if (cf.matchField === 'subCategory') {
                                    setForm({ ...form, subCategory: val });
                                  } else if (cf.matchField === 'specialty') {
                                    setForm({ ...form, specialty: val });
                                  } else if (cf.matchField === 'area') {
                                    setForm({ ...form, area: val });
                                  } else {
                                    const cur = form.tags || [];
                                    if (!cur.includes(val)) {
                                      setForm({ ...form, tags: [...cur, val].slice(0, 20) });
                                    }
                                  }
                                }}
                                className="px-2.5 py-1 rounded-xl bg-white border border-[#d7ebe0] hover:bg-[#e6f4ec] text-[#003820] text-[11px] font-bold"
                              >
                                + {cf.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-1">
                      <label className="text-xs font-bold">العنوان التفصيلي *</label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="أبوحمص - بجوار..."
                        className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">رقم الهاتف *</label>
                        <input
                          type="tel"
                          required
                          dir="ltr"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-mono text-left"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">رقم الواتساب</label>
                        <input
                          type="tel"
                          dir="ltr"
                          value={form.whatsapp || ''}
                          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-mono text-left"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">قيمة الكشف (للعيادات فقط - اختياري)</label>
                        <input
                          type="number"
                          min={0}
                          value={form.consultationFee ?? ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              consultationFee: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder="150"
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">رابط صورة الواجهة (URL مباشر)</label>
                        <input
                          type="url"
                          dir="ltr"
                          value={form.imageUrl || ''}
                          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                          placeholder="https://..."
                          className="w-full min-h-[44px] px-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-xs font-mono text-left"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold">نبذة تعريفية</label>
                      <textarea
                        rows={3}
                        value={form.description || ''}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full p-3.5 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                      />
                    </div>

                    {/* Dynamic Promotional Badges */}
                    <div className="p-4 rounded-2xl bg-[#f7faf8] border border-[#d7ebe0] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#003820]">
                          <Award size={16} className="text-[#92400e]" />
                          <span>باقات التمييز والفلاتر المشترك بها</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#404942]">
                          المختار: {(form.filterTags || []).length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {promoFilters.map((pf) => {
                          const isChecked = (form.filterTags || []).includes(pf.id);
                          const Icon = getIconComponent(pf.iconKey);
                          const expDate = form.filterExpirations?.[pf.id] || '';
                          return (
                            <div
                              key={pf.id}
                              className={`p-3 rounded-2xl border transition-all space-y-2 ${
                                isChecked
                                  ? 'bg-white border-[#0f5132] shadow-xs'
                                  : 'bg-white/60 border-[#e4ece7]'
                              }`}
                            >
                              <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <span
                                  style={{ backgroundColor: pf.badgeBgColor, color: pf.badgeTextColor }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                >
                                  <Icon size={12} />
                                  <span>{pf.name}</span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFormPromoFilter(pf.id)}
                                  className="w-4 h-4 accent-[#0f5132]"
                                />
                              </label>
                              {isChecked && (
                                <label className="flex items-center justify-between gap-2 pt-1 border-t border-[#e4ece7] text-[11px] text-[#404942]">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} className="text-[#0f5132]" /> انتهاء الاشتراك:
                                  </span>
                                  <input
                                    type="date"
                                    dir="ltr"
                                    value={expDate}
                                    onChange={(e) => updateFormFilterExpiry(pf.id, e.target.value)}
                                    className="bg-[#f1f4f2] px-2 py-1 rounded-lg text-[11px] font-mono outline-none"
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.verified)}
                          onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                          className="w-4 h-4 accent-[#0f5132]"
                        />
                        نشاط موثّق (بعد التحقق اليدوي)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.featured)}
                          onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                          className="w-4 h-4 accent-[#0f5132]"
                        />
                        مميز بالرئيسية
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.openNow)}
                          onChange={(e) => setForm({ ...form, openNow: e.target.checked })}
                          className="w-4 h-4 accent-[#0f5132]"
                        />
                        مفعل للتشغيل
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.hasDelivery)}
                          onChange={(e) => setForm({ ...form, hasDelivery: e.target.checked })}
                          className="w-4 h-4 accent-[#0f5132]"
                        />
                        يتوفر توصيل (دليفري)
                      </label>
                    </div>
                  </>
                )}

                {editorTab === 'hours' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f7faf8] border border-[#e4ece7] rounded-2xl p-3.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-[#003820] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(form.is24Hours)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              is24Hours: e.target.checked,
                              hours: e.target.checked ? 'مفتوح 24 ساعة يومياً' : form.hours,
                            })
                          }
                          className="w-4 h-4 accent-[#0f5132]"
                        />
                        يعمل 24 ساعة يومياً (صيدلية نوبتجية / طوارئ)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseHoursTextToSchedule(form.hours);
                          if (parsed?.is24Hours) {
                            setForm({
                              ...form,
                              is24Hours: true,
                              workingSchedule: createEmptySchedule(),
                              hours: 'مفتوح 24 ساعة يومياً',
                            });
                            showToast('تم تفعيل وضع 24 ساعة من النص الحالي', 'success');
                          } else if (parsed) {
                            setForm({
                              ...form,
                              is24Hours: false,
                              workingSchedule: parsed.schedule,
                              hours: formatWeeklyScheduleSummary(parsed.schedule) || form.hours,
                            });
                            showToast('تم تحويل النص الحالي إلى جدول أسبوعي منظم', 'success');
                          } else {
                            setForm({ ...form, workingSchedule: createEmptySchedule() });
                            showToast('تم فتح جدول فارغ لتحديد المواعيد يدوياً', 'info');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-[#0f5132] text-[#003820] text-[11px] font-bold"
                      >
                        استيراد من النص / تهيئة الجدول
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold">ملخص المواعيد النصي (يُحدّث تلقائياً من الجدول)</label>
                      <input
                        type="text"
                        value={form.hours || ''}
                        onChange={(e) => setForm({ ...form, hours: e.target.value })}
                        placeholder="مثال: السبت إلى الأربعاء: 4 م - 9 م | الخميس: 3 م - 8 م"
                        className="w-full min-h-[42px] px-3.5 rounded-2xl bg-[#f1f4f2] text-xs outline-none"
                      />
                    </div>

                    {!form.is24Hours && (
                      <div className="space-y-2">
                        {ORDERED_WEEKDAYS.map((dayKey) => {
                          const daySlots = (form.workingSchedule || createEmptySchedule())[dayKey] || [];
                          const isOpenDay = daySlots.length > 0;
                          return (
                            <div
                              key={dayKey}
                              className="p-3 rounded-2xl border border-[#e4ece7] bg-[#f7faf8] space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-[#181c1c] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isOpenDay}
                                    onChange={(e) => {
                                      updateDaySchedule(dayKey, () =>
                                        e.target.checked
                                          ? [{ open: '09:00', close: '21:00' }]
                                          : []
                                      );
                                    }}
                                    className="w-4 h-4 accent-[#0f5132]"
                                  />
                                  <span>{WEEKDAY_ARABIC_LABELS[dayKey]}</span>
                                  {!isOpenDay && (
                                    <span className="text-[11px] text-[#ba1a1a] font-semibold">
                                      (إجازة / مغلق)
                                    </span>
                                  )}
                                </label>
                                {isOpenDay && daySlots.length < 3 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateDaySchedule(dayKey, (cur) => [
                                        ...cur,
                                        { open: '18:00', close: '23:00' },
                                      ])
                                    }
                                    className="text-[11px] font-bold text-[#0f5132] hover:underline"
                                  >
                                    + إضافة فترة ثانية
                                  </button>
                                )}
                              </div>

                              {isOpenDay && (
                                <div className="space-y-1.5">
                                  {daySlots.map((slot, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-2 text-xs">
                                      <span className="text-[#707971]">من</span>
                                      <input
                                        type="time"
                                        dir="ltr"
                                        value={slot.open}
                                        onChange={(e) =>
                                          updateDaySchedule(dayKey, (cur) =>
                                            cur.map((s, i) =>
                                              i === sIdx ? { ...s, open: e.target.value } : s
                                            )
                                          )
                                        }
                                        className="px-2 py-1 rounded-xl bg-white border border-[#d7ebe0] font-mono text-xs"
                                      />
                                      <span className="text-[#707971]">إلى</span>
                                      <input
                                        type="time"
                                        dir="ltr"
                                        value={slot.close}
                                        onChange={(e) =>
                                          updateDaySchedule(dayKey, (cur) =>
                                            cur.map((s, i) =>
                                              i === sIdx ? { ...s, close: e.target.value } : s
                                            )
                                          )
                                        }
                                        className="px-2 py-1 rounded-xl bg-white border border-[#d7ebe0] font-mono text-xs"
                                      />
                                      {daySlots.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateDaySchedule(dayKey, (cur) =>
                                              cur.filter((_, i) => i !== sIdx)
                                            )
                                          }
                                          className="text-[#ba1a1a] p-1"
                                          aria-label="حذف الفترة"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {editorTab === 'menu' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f7faf8] border border-[#e4ece7] rounded-2xl p-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-bold">رسوم التوصيل داخل البندر (ج.م)</label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={form.deliveryFeeInTown ?? 15}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              deliveryFeeInTown: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#d7ebe0] text-sm tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold">رسوم التوصيل لقرى المركز (ج.م)</label>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={form.deliveryFeeVillage ?? 25}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              deliveryFeeVillage: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#d7ebe0] text-sm tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#003820]">
                        أصناف المنيو ({(form.menuItems || []).length} / {MAX_MENU_ITEMS}) — تُستخدم الأسعار هنا كمرجع معتمد في قواعد Firestore
                      </p>
                      <button
                        type="button"
                        onClick={addMenuItem}
                        className="min-h-[36px] px-3 rounded-xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Plus size={14} /> إضافة صنف
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                      {(form.menuItems || []).map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2"
                        >
                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateMenuItem(idx, { name: e.target.value })}
                              placeholder="اسم الصنف *"
                              className="col-span-5 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) => updateMenuItem(idx, { category: e.target.value })}
                              placeholder="التصنيف (مشويات...)"
                              className="col-span-3 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                            />
                            <input
                              type="number"
                              min={1}
                              value={item.price}
                              onChange={(e) => updateMenuItem(idx, { price: Number(e.target.value) })}
                              placeholder="السعر"
                              className="col-span-3 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs font-bold tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => removeMenuItem(idx)}
                              className="col-span-1 min-h-[38px] rounded-xl bg-[#ffdad6] text-[#93000a] flex items-center justify-center"
                              aria-label="حذف صنف"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateMenuItem(idx, { description: e.target.value })}
                              placeholder="وصف قصير للصنف"
                              className="min-h-[36px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                            />
                            <input
                              type="url"
                              dir="ltr"
                              value={item.imageUrl || ''}
                              onChange={(e) => updateMenuItem(idx, { imageUrl: e.target.value })}
                              placeholder="رابط صورة URL (اختياري)"
                              className="min-h-[36px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs font-mono text-left"
                            />
                          </div>
                        </div>
                      ))}
                      {(form.menuItems || []).length === 0 && (
                        <p className="text-xs text-[#707971] text-center py-6">
                          لا توجد أصناف منيو مضافة بعد. اضغط «إضافة صنف» للبدء.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {editorTab === 'services' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#003820]">
                        الخدمات والأسعار المعلنة ({(form.services || []).length} / {MAX_SERVICES})
                      </p>
                      <button
                        type="button"
                        onClick={addService}
                        className="min-h-[36px] px-3 rounded-xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Plus size={14} /> إضافة خدمة
                      </button>
                    </div>
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {(form.services || []).map((srv, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2"
                        >
                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              value={srv.name}
                              onChange={(e) => updateService(idx, { name: e.target.value })}
                              placeholder="اسم الخدمة *"
                              className="col-span-6 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={srv.priceLabel}
                              onChange={(e) => updateService(idx, { priceLabel: e.target.value })}
                              placeholder="السعر (مثال: 150 ج.م)"
                              className="col-span-5 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => removeService(idx)}
                              className="col-span-1 min-h-[38px] rounded-xl bg-[#ffdad6] text-[#93000a] flex items-center justify-center"
                              aria-label="حذف خدمة"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={srv.description}
                            onChange={(e) => updateService(idx, { description: e.target.value })}
                            placeholder="وصف الخدمة"
                            className="w-full min-h-[36px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                          />
                        </div>
                      ))}
                      {(form.services || []).length === 0 && (
                        <p className="text-xs text-[#707971] text-center py-6">
                          لا توجد خدمات مضافة بعد.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {editorTab === 'gallery' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#003820]">
                          معرض الصور والمنتجات ({(form.gallery || []).length} / {MAX_GALLERY_ITEMS})
                        </p>
                        <p className="text-[11px] text-[#707971]">
                          يعتمد المعرض على روابط صور URL مباشرة (لا يوجد رفع ملفات محلية).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addGalleryItem}
                        className="min-h-[36px] px-3 rounded-xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Plus size={14} /> إضافة رابط صورة
                      </button>
                    </div>
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {(form.gallery || []).map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2"
                        >
                          <div className="grid grid-cols-12 gap-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => updateGalleryItem(idx, { title: e.target.value })}
                              placeholder="عنوان الصورة *"
                              className="col-span-6 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={item.tag || ''}
                              onChange={(e) => updateGalleryItem(idx, { tag: e.target.value })}
                              placeholder="وسم (اختياري)"
                              className="col-span-5 min-h-[38px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryItem(idx)}
                              className="col-span-1 min-h-[38px] rounded-xl bg-[#ffdad6] text-[#93000a] flex items-center justify-center"
                              aria-label="حذف صورة"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="url"
                              dir="ltr"
                              value={item.imageUrl}
                              onChange={(e) => updateGalleryItem(idx, { imageUrl: e.target.value })}
                              placeholder="https://example.com/photo.jpg"
                              className="w-full min-h-[36px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs font-mono text-left"
                            />
                            <input
                              type="text"
                              value={item.subtitle || ''}
                              onChange={(e) => updateGalleryItem(idx, { subtitle: e.target.value })}
                              placeholder="وصف مختصر للصورة (اختياري)"
                              className="w-full min-h-[36px] px-2.5 rounded-xl bg-white border border-[#d7dbd9] text-xs"
                            />
                          </div>
                        </div>
                      ))}
                      {(form.gallery || []).length === 0 && (
                        <p className="text-xs text-[#707971] text-center py-6">
                          لا توجد صور مضافة في المعرض بعد.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-[#e4ece7]">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="min-h-[44px] px-5 rounded-2xl bg-[#f1f4f2] text-[#404942] text-sm font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving || isAuditor}
                    className="min-h-[44px] px-6 rounded-2xl bg-[#003820] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check size={16} />
                    {saving ? 'جارٍ الحفظ...' : 'حفظ ونشر في الدليل'}
                  </button>
                </div>
              </div>

              {/* Live Mobile Preview + QR Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-3xl p-4 space-y-3">
                  <p className="text-xs font-bold text-[#0f5132]">معاينة بطاقة الموبايل الحية</p>
                  <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 shadow-civic-1 space-y-3">
                    <PlacePromoBadges place={form} promoFilters={promoFilters} size="sm" />
                    <div className="flex items-start gap-3">
                      <CivicImage
                        src={form.imageUrl}
                        alt={form.name || 'معاينة'}
                        className="w-16 h-16 rounded-2xl shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1">
                          <h4 className="text-sm font-bold text-[#181c1c] truncate">
                            {form.name || 'اسم النشاط التجاري'}
                          </h4>
                          {form.verified && <BadgeCheck size={15} className="text-[#0f5132] shrink-0" />}
                        </div>
                        <p className="text-xs text-[#404942] truncate">
                          {form.specialty || 'التخصص أو الخدمة'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#707971]">
                          {typeof form.rating === 'number' && form.rating > 0 && (
                            <>
                              <span className="flex items-center gap-0.5 text-[#735c00] font-bold">
                                <Star size={11} className="fill-[#e6b800] text-[#e6b800]" /> {form.rating}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          <span className="truncate">{form.area}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="min-h-[38px] rounded-xl bg-[#003820] text-white text-xs font-bold flex items-center justify-center gap-1.5">
                        <Phone size={13} /> اتصال مباشر
                      </div>
                      <div className="min-h-[38px] rounded-xl bg-[#e6f4ec] text-[#0f5132] text-xs font-bold flex items-center justify-center gap-1.5">
                        <MessageCircle size={13} /> واتساب
                      </div>
                    </div>
                  </div>
                </div>

                <QRCodeCard
                  title={form.name || 'بطاقة نشاط بدليل أبوحمص'}
                  code={form.qrCode || form.id}
                  shareUrl={`${shareOrigin}/places/${form.id}`}
                  phone={form.phone}
                  area={form.area}
                  specialty={form.specialty}
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Quick View Modal */}
      {qrTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setQrTarget(null)}
        >
          <div className="max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <QRCodeCard
              title={qrTarget.name}
              code={qrTarget.qrCode || qrTarget.id}
              shareUrl={`${shareOrigin}/places/${qrTarget.id}`}
              phone={qrTarget.phone}
              area={qrTarget.area}
              specialty={qrTarget.specialty}
            />
            <button
              type="button"
              onClick={() => setQrTarget(null)}
              className="w-full min-h-[44px] rounded-2xl bg-white text-[#181c1c] text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#181c1c]">حذف «{deleteTarget.name}»؟</h3>
            <p className="text-xs text-[#404942]">سيتم حذف المكان نهائياً من قاعدة بيانات الدليل.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[42px] rounded-2xl bg-[#f1f4f2] text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deletePlace(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="min-h-[42px] rounded-2xl bg-[#ba1a1a] text-white text-xs font-bold"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

const SUBMISSION_TYPE_LABELS: Record<Submission['type'], string> = {
  suggest_place: 'اقتراح مكان جديد',
  report_edit: 'تعديل / بلاغ مكان',
  advertise: 'طلب إعلان تجاري',
  add_property: 'إضافة عقار',
  property_inspection: 'طلب معاينة عقار',
  join_hero: 'انضمام لحرفيي المكافحين',
  hero_inquiry: 'طلب معاينة / تواصل مع حرفي',
};

export const AdminRequestsPage: React.FC = () => {
  const {
    submissions,
    categories,
    isAuditor,
    hasMoreSubmissions,
    loadMoreSubmissions,
    updateSubmissionStatus,
    applyCorrectionSubmission,
    publishSubmissionAsPlace,
    publishSubmissionAsProperty,
    saveWhatsappQueueItem,
    showToast,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<'all' | Submission['status']>('all');
  const [selected, setSelected] = useState<Submission | null>(submissions[0] || null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? submissions
        : submissions.filter((s) => s.status === statusFilter),
    [submissions, statusFilter]
  );

  const currentSub = selected
    ? submissions.find((s) => s.id === selected.id) || selected
    : filtered[0] || null;

  const handleStatusChange = async (sub: Submission, status: Submission['status']) => {
    if (isAuditor) return;
    setProcessing(true);
    try {
      await updateSubmissionStatus(sub.id, status, adminNote.trim() || sub.adminNote);
      setAdminNote('');
    } catch {
      showToast('تعذر تحديث حالة الطلب حالياً، يرجى المحاولة مجدداً', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyCorrection = async (sub: Submission) => {
    if (isAuditor) return;
    setProcessing(true);
    try {
      await applyCorrectionSubmission(sub.id, adminNote.trim() || undefined);
      setAdminNote('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر تطبيق التعديلات على المكان',
        'error'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handlePublishAsPlace = async (sub: Submission) => {
    if (isAuditor) return;
    setProcessing(true);
    try {
      const p = sub.payload || {};
      const catSlug = String(p.categorySlug || (sub.type === 'join_hero' ? 'heroes' : 'general'));
      const matchedCat = categories.find((c) => c.slug === catSlug || c.id === catSlug) || categories[0];
      const parsedFee = p.consultationFee !== undefined ? Number(p.consultationFee) : NaN;
      const parsedLat = p.lat !== undefined ? Number(p.lat) : NaN;
      const parsedLng = p.lng !== undefined ? Number(p.lng) : NaN;
      const cleanImageUrl = typeof p.imageUrl === 'string' ? p.imageUrl.trim().slice(0, 600) : '';
      const cleanDescription = typeof p.description === 'string' ? p.description.trim().slice(0, 1500) : '';
      const newPlace: Place = {
        id: `plc-${Date.now().toString(36)}`,
        name: String(p.name || sub.title).trim(),
        categoryId: matchedCat?.id || 'cat-general',
        categorySlug: matchedCat?.slug || 'general',
        specialty: String(p.specialty || ''),
        area: String(p.area || 'أبوحمص'),
        address: String(p.address || 'مركز أبوحمص'),
        phone: String(p.phone || sub.submitterPhone),
        whatsapp: String(p.whatsapp || p.phone || sub.submitterPhone),
        hours: String(p.hours || ''),
        ...(cleanDescription ? { description: cleanDescription } : {}),
        ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
        ...(!Number.isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? { lat: parsedLat } : {}),
        ...(!Number.isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? { lng: parsedLng } : {}),
        ...(!Number.isNaN(parsedFee) && parsedFee >= 0 && parsedFee <= 50000
          ? { consultationFee: parsedFee }
          : {}),
        verified: false,
        openNow: true,
        qrCode: `ABH-${Math.floor(1000 + Math.random() * 9000)}`,
      };
      await publishSubmissionAsPlace(
        sub.id,
        newPlace,
        adminNote.trim() || 'تم اعتماد النشاط ونشره في دليل أبوحمص.'
      );
      setAdminNote('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر نشر النشاط في الدليل، يرجى مراجعة البيانات والمحاولة مجدداً',
        'error'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handlePublishAsProperty = async (sub: Submission) => {
    if (isAuditor) return;
    setProcessing(true);
    try {
      const p = sub.payload || {};
      const validTypes = new Set(['apartment', 'shop', 'land', 'warehouse']);
      const rawType = String(p.propertyType || 'apartment');
      const propertyType = (validTypes.has(rawType) ? rawType : 'apartment') as
        | 'apartment'
        | 'shop'
        | 'land'
        | 'warehouse';
      const cleanTitle = String(p.title || sub.title.replace(/^إضافة عقار:\s*/, '')).trim();
      const parsedPrice = Number(p.price);
      const parsedArea = Number(p.areaSqm);
      const isResidential = propertyType === 'apartment';

      await publishSubmissionAsProperty(
        sub.id,
        {
          id: `prop-${Date.now().toString(36)}`,
          title: cleanTitle.length >= 2 ? cleanTitle : sub.title,
          listingType: p.listingType === 'rent' ? 'rent' : 'sale',
          propertyType,
          price: !Number.isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0,
          areaSqm: !Number.isNaN(parsedArea) && parsedArea > 0 ? parsedArea : 100,
          rooms:
            p.rooms !== undefined && !Number.isNaN(Number(p.rooms))
              ? Number(p.rooms)
              : isResidential
                ? 3
                : undefined,
          baths:
            p.baths !== undefined && !Number.isNaN(Number(p.baths))
              ? Number(p.baths)
              : isResidential
                ? 1
                : undefined,
          floor: p.floor ? String(p.floor) : undefined,
          finishing: p.finishing ? String(p.finishing) : undefined,
          area: String(p.area || 'أبوحمص'),
          address: String(p.address || p.area || 'أبوحمص'),
          phone: String(p.phone || sub.submitterPhone),
          whatsapp: String(p.whatsapp || p.phone || sub.submitterPhone),
          agencyId: p.agencyId ? String(p.agencyId) : undefined,
          agencyName: p.agencyName ? String(p.agencyName) : undefined,
          verified: false,
          status: 'approved',
        },
        adminNote.trim() || 'تم تدقيق العقار ونشره في قسم عقارات أبوحمص.'
      );
      setAdminNote('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'تعذر نشر العقار حالياً، يرجى مراجعة البيانات والمحاولة مجدداً',
        'error'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handlePushToWhatsapp = async (sub: Submission) => {
    if (isAuditor) return;
    try {
      const shareUrl = `${window.location.origin}/track/${sub.trackingToken}`;
      await saveWhatsappQueueItem({
        id: `wa-${Date.now().toString(36)}`,
        recipientName: sub.submitterName,
        phone: sub.submitterPhone,
        relatedType: SUBMISSION_TYPE_LABELS[sub.type],
        relatedTitle: sub.title,
        templateName: 'تحديث حالة الطلب',
        messageBody: `أهلاً أ/ ${sub.submitterName}، تم تحديث حالة طلبك «${sub.title}» في دليل أبوحمص. يمكنك المتابعة عبر الرابط: ${shareUrl}`,
        status: 'pending',
      });
      showToast('تمت إضافة الرسالة لطابور واتساب', 'success');
    } catch {
      showToast('تعذرت إضافة الرسالة لطابور واتساب حالياً', 'error');
    }
  };

  return (
    <AdminShell
      title="الطلبات والبلاغات الواردة"
      subtitle="مقارنة التعديلات (Diff View)، تطبيق التصحيحات ذرياً على الأماكن، ومنع النشر المكرر"
    >
      <div className="space-y-4">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `الكل (${submissions.length})` },
            { id: 'received', label: `جديد (${submissions.filter((s) => s.status === 'received').length})` },
            { id: 'reviewing', label: `قيد المراجعة (${submissions.filter((s) => s.status === 'reviewing').length})` },
            { id: 'approved', label: `معتمد (${submissions.filter((s) => s.status === 'approved').length})` },
            { id: 'rejected', label: `مرفوض (${submissions.filter((s) => s.status === 'rejected').length})` },
          ].map((tab) => (
            <AnimatedFilterChip
              key={tab.id}
              active={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id as 'all' | Submission['status'])}
              className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#003820] text-white'
                  : 'bg-white border border-[#e4ece7] text-[#404942]'
              }`}
            >
              {tab.label}
            </AnimatedFilterChip>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Submissions List */}
          <div className="lg:col-span-5 bg-white border border-[#e4ece7] rounded-3xl shadow-civic-1 overflow-hidden">
            {filtered.length === 0 ? (
              <AnimatedEmptyState>
                <div className="p-8 text-center space-y-2">
                  <Inbox size={28} className="mx-auto text-[#707971]" />
                  <p className="text-sm font-bold text-[#404942]">لا توجد طلبات في هذا التصنيف</p>
                </div>
              </AnimatedEmptyState>
            ) : (
              <AnimatedListContainer className="divide-y divide-[#e4ece7]">
                {filtered.map((sub, idx) => {
                  const isSelected = currentSub?.id === sub.id;
                  return (
                    <AnimatedListItem key={sub.id} index={idx} y={12}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(sub);
                          setAdminNote(sub.adminNote || '');
                        }}
                        className={`w-full text-right p-4 transition-colors ${
                          isSelected ? 'bg-[#e6f4ec]/65' : 'hover:bg-[#f7faf8]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-lg bg-[#f1f4f2] text-[#003820] text-[10px] font-bold">
                            {SUBMISSION_TYPE_LABELS[sub.type]}
                          </span>
                          <div className="flex items-center gap-1">
                            {(sub.applied || sub.publishedTargetId) && (
                              <span className="px-2 py-0.5 rounded-full bg-[#003820] text-[#9ff1bd] text-[10px] font-bold">
                                تم التطبيق
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                        </div>
                        <p className="text-sm font-bold text-[#181c1c] truncate">{sub.title}</p>
                        <p className="text-xs text-[#404942] mt-0.5">
                          {sub.submitterName} · {sub.submitterPhone}
                        </p>
                      </button>
                    </AnimatedListItem>
                  );
                })}
              </AnimatedListContainer>
            )}

            {hasMoreSubmissions && (
              <div className="p-3 border-t border-[#e4ece7] text-center">
                <button
                  type="button"
                  onClick={loadMoreSubmissions}
                  className="min-h-[38px] px-4 rounded-xl bg-[#f1f4f2] hover:bg-[#e4ece7] text-xs font-bold text-[#003820]"
                >
                  تحميل طلبات أقدم
                </button>
              </div>
            )}
          </div>

          {/* Detail + Diff View Panel */}
          <FadeInUp delay={0.06} className="lg:col-span-7">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-5">
              {!currentSub ? (
                <p className="text-sm text-[#707971] text-center py-10">اختر طلباً من القائمة لمراجعته</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#e4ece7]">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#0f5132]">
                        {SUBMISSION_TYPE_LABELS[currentSub.type]} · كود المتابعة:{' '}
                        <span className="font-mono">{currentSub.trackingToken}</span>
                      </span>
                      <h2 className="text-lg font-bold text-[#181c1c]">{currentSub.title}</h2>
                      <p className="text-xs text-[#404942]">
                        مقدم الطلب: <strong>{currentSub.submitterName}</strong> · هاتف:{' '}
                        <span className="font-mono">{currentSub.submitterPhone}</span>
                      </p>
                      {currentSub.type === 'report_edit' && !currentSub.targetPlaceId && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[11px] font-bold">
                          بلاغ عام غير مرتبط بمكان محدد — مراجعة يدوية فقط
                        </span>
                      )}
                    </div>
                    <a
                      href={`/track/${currentSub.trackingToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#f1f4f2] text-[#003820] text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink size={14} /> رابط متابعة العميل
                    </a>
                  </div>

                  {/* Audit Trail Badge if already reviewed/applied */}
                  {(currentSub.reviewedBy || currentSub.publishedTargetId || currentSub.applied) && (
                    <div className="bg-[#e6f4ec]/60 border border-[#b7e2c8] rounded-2xl p-3 text-xs text-[#003820] space-y-1">
                      <p className="font-bold">
                        سجل القرار الإداري:{' '}
                        {currentSub.applied
                          ? 'تم تطبيق التعديلات على المكان في قاعدة البيانات'
                          : currentSub.publishedTargetId
                            ? `تم النشر الفعلي (المعرّف: ${currentSub.publishedTargetId})`
                            : 'تمت المراجعة وتحديث الحالة'}
                      </p>
                      {currentSub.reviewedBy && (
                        <p className="text-[11px] text-[#0f5132]">
                          بواسطة: {currentSub.reviewedBy}
                          {currentSub.reviewedAt
                            ? ` · ${new Date(currentSub.reviewedAt).toLocaleString('ar-EG')}`
                            : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Diff View (Previous vs Proposed) */}
                  {currentSub.previousData && Object.keys(currentSub.previousData).length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#003820]">مقارنة التعديلات المقترحة (Diff View)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-2xl bg-[#ffdad6]/35 border border-[#ffb4ab] space-y-1.5">
                          <p className="text-[11px] font-bold text-[#93000a]">البيانات السابقة</p>
                          {Object.entries(currentSub.previousData).map(([k, v]) => (
                            <div key={k} className="text-xs">
                              <span className="text-[#707971]">{k}: </span>
                              <span className="font-semibold line-through text-[#93000a]">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="p-3.5 rounded-2xl bg-[#e6f4ec]/65 border border-[#b7e2c8] space-y-1.5">
                          <p className="text-[11px] font-bold text-[#0f5132]">البيانات الجديدة المقترحة</p>
                          {Object.entries(currentSub.payload || {}).map(([k, v]) => (
                            <div key={k} className="text-xs">
                              <span className="text-[#707971]">{k}: </span>
                              <span className="font-bold text-[#003820]">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] space-y-2">
                      <p className="text-xs font-bold text-[#003820]">تفاصيل الطلب المرسلة</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(currentSub.payload || {}).map(([k, v]) => {
                          const isImageField =
                            (k === 'imageUrl' || k === 'menuImageUrl') &&
                            typeof v === 'string' &&
                            /^https?:\/\//i.test(v);
                          const isMapsField =
                            k === 'mapsUrl' &&
                            typeof v === 'string' &&
                            /^https?:\/\//i.test(v);
                          return (
                            <div key={k} className="bg-white rounded-xl px-3 py-2 border border-[#e4ece7] text-xs">
                              <span className="text-[#707971] block text-[10px] mb-1">{k}</span>
                              {isImageField ? (
                                <a href={v} target="_blank" rel="noopener noreferrer" className="block space-y-1">
                                  <img
                                    src={v}
                                    alt={k}
                                    className="w-full h-32 object-cover rounded-lg border border-[#e4ece7]"
                                  />
                                  <span className="text-[11px] font-bold text-[#0f5132] underline">
                                    فتح الصورة بالحجم الكامل
                                  </span>
                                </a>
                              ) : isMapsField ? (
                                <a
                                  href={v}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-bold text-[#0f5132] hover:underline"
                                >
                                  <MapPin size={14} />
                                  <span>فتح الموقع على خرائط جوجل</span>
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span className="font-bold text-[#181c1c] whitespace-pre-line break-words">
                                  {String(v)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Admin Response Note */}
                  {!isAuditor && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#181c1c]">
                        ملاحظة الإدارة للعميل (تظهر فوراً في صفحة المتابعة الخاصة به)
                      </label>
                      <textarea
                        rows={2}
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder={currentSub.adminNote || 'اكتب رد الإدارة أو سبب القرار...'}
                        className="w-full p-3 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-xs"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!isAuditor && (
                    <div className="flex flex-wrap gap-2">
                      {currentSub.type === 'report_edit' && currentSub.targetPlaceId && (
                        <button
                          type="button"
                          disabled={processing || Boolean(currentSub.applied)}
                          onClick={() => void handleApplyCorrection(currentSub)}
                          className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={15} />
                          {currentSub.applied
                            ? 'تم تطبيق التعديلات بالفعل'
                            : 'اعتماد وتطبيق التعديلات على المكان'}
                        </button>
                      )}

                      {(currentSub.type === 'suggest_place' || currentSub.type === 'join_hero') && (
                        <button
                          type="button"
                          disabled={processing || Boolean(currentSub.publishedTargetId)}
                          onClick={() => void handlePublishAsPlace(currentSub)}
                          className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Store size={15} />
                          {currentSub.publishedTargetId
                            ? 'تم النشر في الدليل بالفعل'
                            : 'اعتماد ونشر كمكان في الدليل'}
                        </button>
                      )}

                      {currentSub.type === 'add_property' && (
                        <button
                          type="button"
                          disabled={processing || Boolean(currentSub.publishedTargetId)}
                          onClick={() => void handlePublishAsProperty(currentSub)}
                          className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={15} />
                          {currentSub.publishedTargetId
                            ? 'تم نشر العقار بالفعل'
                            : 'اعتماد ونشر في العقارات'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleStatusChange(currentSub, 'approved')}
                        className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#146c43] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={15} /> اعتماد (مراجعة فقط)
                      </button>
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleStatusChange(currentSub, 'reviewing')}
                        className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#fef3c7] disabled:opacity-50 text-[#735c00] text-xs font-bold flex items-center gap-1.5"
                      >
                        <Clock size={15} /> قيد المراجعة
                      </button>
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handleStatusChange(currentSub, 'rejected')}
                        className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#ffdad6] disabled:opacity-50 text-[#93000a] text-xs font-bold flex items-center gap-1.5"
                      >
                        <XCircle size={15} /> رفض
                      </button>
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => void handlePushToWhatsapp(currentSub)}
                        className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#e6f4ec] text-[#0f5132] text-xs font-bold flex items-center gap-1.5"
                      >
                        <MessageCircle size={15} /> تحويل لطابور واتساب
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </FadeInUp>
        </div>
      </div>
    </AdminShell>
  );
};
