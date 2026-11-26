import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  MapPin,
  Palette,
  Percent,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AdminShell, CivicImage } from '../../components/SharedUI';
import { AnimatedFilterChip, FadeInUp } from '../../components/MotionEffects';
import { COLOR_PRESETS, DynamicCategoryIcon, getIconComponent, ICON_LIBRARY } from '../../lib/icons';
import {
  BADGE_COLOR_PRESETS,
  getTodayISO,
  isPlaceSubscribedToFilter,
} from '../../lib/promoFilters';
import {
  getEffectiveCategoryFilters,
  getEffectiveOfferFilters,
  getMatchFieldShortLabel,
  isBooleanMatchField,
  MATCH_FIELD_OPTIONS,
  matchesCategoryFilter,
  matchesFixedFeatured,
  matchesFixedVip,
  matchesOfferFilter,
  matchesOfferFixedFeatured,
  matchesOfferFixedVip,
  matchesPropertyCategoryFilter,
  matchesPropertyFixedFeatured,
  matchesPropertyFixedVip,
  OFFERS_FILTER_SCOPE_ID,
} from '../../lib/categoryFilters';
import { isOfferExpired } from '../../lib/formatters';
import type {
  Category,
  CategoryFilter,
  CategoryFilterMatchField,
  PromoFilter,
  TemplateType,
} from '../../types';

const TEMPLATE_OPTIONS: Array<{ value: TemplateType; label: string; desc: string }> = [
  { value: 'general', label: 'دليل عام (محلات وخدمات)', desc: 'بطاقات محلات وخدمات مع اتصال وواتساب وخريطة' },
  { value: 'medical', label: 'عيادات وأطباء', desc: 'حجز أدوار إلكتروني وطابور انتظار حي' },
  { value: 'restaurants', label: 'مطاعم وطلبات', desc: 'قائمة طعام وسلة شراء وتتبع تجهيز وتوصيل' },
  { value: 'real-estate', label: 'عقارات ومكاتب', desc: 'بيع وإيجار وطلبات معاينة ومكاتب معتمدة' },
  { value: 'heroes', label: 'حرفيين ومكافحين', desc: 'معرض أعمال وحرف بدون عمولة 0%' },
];

/** Always produces a URL-safe ASCII slug matching Firestore ^[a-z0-9-]+$ */
function slugifyAscii(text: string, prefix: string): string {
  const ascii = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (ascii.length >= 2) return ascii.slice(0, 44);
  return `${prefix}-${Date.now().toString(36).slice(-5)}`;
}

export const AdminTaxonomyPage: React.FC = () => {
  const {
    categories,
    promoFilters,
    activePromoFilters,
    places,
    properties,
    offers,
    settings,
    isAuditor,
    saveCategory,
    deleteCategory,
    reorderCategories,
    savePromoFilter,
    deletePromoFilter,
    reorderPromoFilters,
    togglePlacePromoFilter,
    setPlaceFilterExpiry,
    saveProperty,
    deleteProperty,
    deletePlace,
    savePublicSettings,
    showToast,
  } = useApp();

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'categories' | 'filters' | 'badges' | 'areas' | 'audit'>(
    initialTab === 'filters' || initialTab === 'badges' || initialTab === 'areas' || initialTab === 'audit'
      ? initialTab
      : 'categories'
  );

  // Ordered lists
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [categories]
  );
  const sortedPromoFilters = useMemo(
    () => [...promoFilters].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    [promoFilters]
  );

  // --- CATEGORY EDITOR STATE ---
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [iconKey, setIconKey] = useState('store');
  const [iconSearch, setIconSearch] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [bgColor, setBgColor] = useState('#e6f4ec');
  const [iconColor, setIconColor] = useState('#0f5132');
  const [templateType, setTemplateType] = useState<TemplateType>('general');
  const [active, setActive] = useState(true);
  const [savingCat, setSavingCat] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [forceDeleteConfirm, setForceDeleteConfirm] = useState(false);

  // --- PROMO FILTER / BADGE EDITOR STATE ---
  const [badgeEditorOpen, setBadgeEditorOpen] = useState(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState('');
  const [badgeSlug, setBadgeSlug] = useState('');
  const [badgeDesc, setBadgeDesc] = useState('');
  const [badgeIconKey, setBadgeIconKey] = useState('star');
  const [badgeIconSearch, setBadgeIconSearch] = useState('');
  const [badgeBgColor, setBadgeBgColor] = useState('#fef3c7');
  const [badgeTextColor, setBadgeTextColor] = useState('#92400e');
  const [badgePriority, setBadgePriority] = useState('100');
  const [badgeActive, setBadgeActive] = useState(true);
  const [savingBadge, setSavingBadge] = useState(false);
  const [draggedBadgeId, setDraggedBadgeId] = useState<string | null>(null);
  const [deleteBadgeTarget, setDeleteBadgeTarget] = useState<PromoFilter | null>(null);

  // --- QUICK SUBSCRIBER MANAGER MODAL FOR A PROMO FILTER ---
  const [subscribersModalFilterId, setSubscribersModalFilterId] = useState<string | null>(null);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberCatFilter, setSubscriberCatFilter] = useState<string>('all');
  const [onlySubscribed, setOnlySubscribed] = useState(false);

  // --- PER-CATEGORY & OFFERS FILTERS MANAGER STATE ---
  const initialScope = searchParams.get('scope');
  const [selectedFilterCatId, setSelectedFilterCatId] = useState<string>(
    initialScope === 'offers' ? OFFERS_FILTER_SCOPE_ID : ''
  );
  const [catFilterModalOpen, setCatFilterModalOpen] = useState(false);
  const [editingCatFilterId, setEditingCatFilterId] = useState<string | null>(null);
  const [cfLabel, setCfLabel] = useState('');
  const [cfMatchField, setCfMatchField] = useState<CategoryFilterMatchField>('specialty');
  const [cfMatchValue, setCfMatchValue] = useState('');
  const [cfEnabled, setCfEnabled] = useState(true);
  const [savingCatFilter, setSavingCatFilter] = useState(false);
  const [deleteCatFilterTarget, setDeleteCatFilterTarget] = useState<CategoryFilter | null>(null);

  // Areas Manager State
  const [newArea, setNewArea] = useState('');

  useEffect(() => {
    if (!selectedFilterCatId && sortedCategories.length > 0) {
      setSelectedFilterCatId(sortedCategories[0].id);
    }
  }, [selectedFilterCatId, sortedCategories]);

  const isOffersScopeSelected = selectedFilterCatId === OFFERS_FILTER_SCOPE_ID;

  const selectedFilterCategory = useMemo(() => {
    if (isOffersScopeSelected) return null;
    return sortedCategories.find((c) => c.id === selectedFilterCatId) || sortedCategories[0] || null;
  }, [isOffersScopeSelected, sortedCategories, selectedFilterCatId]);

  const activeOffersPool = useMemo(() => offers.filter((o) => !isOfferExpired(o)), [offers]);

  const selectedCategoryPlaces = useMemo(() => {
    if (!selectedFilterCategory) return [];
    return places.filter(
      (p) => p.categoryId === selectedFilterCategory.id || p.categorySlug === selectedFilterCategory.slug
    );
  }, [places, selectedFilterCategory]);

  const selectedCategoryApprovedProperties = useMemo(
    () => properties.filter((p) => p.status === 'approved'),
    [properties]
  );

  const isRealEstateSelected = selectedFilterCategory?.slug === 'real-estate';

  const { filters: selectedEffectiveFilters, isAutoDerived: selectedFiltersAreAuto } = useMemo(() => {
    if (isOffersScopeSelected) {
      return getEffectiveOfferFilters(settings.offersFilters, activeOffersPool, sortedCategories);
    }
    return getEffectiveCategoryFilters(selectedFilterCategory || undefined, selectedCategoryPlaces);
  }, [
    isOffersScopeSelected,
    settings.offersFilters,
    activeOffersPool,
    sortedCategories,
    selectedFilterCategory,
    selectedCategoryPlaces,
  ]);

  const selectedCatVipCount = useMemo(() => {
    if (isOffersScopeSelected) {
      return activeOffersPool.filter((o) => matchesOfferFixedVip(o, places, activePromoFilters)).length;
    }
    if (isRealEstateSelected) {
      return selectedCategoryApprovedProperties.filter((p) => matchesPropertyFixedVip(p)).length;
    }
    return selectedCategoryPlaces.filter((p) => matchesFixedVip(p, activePromoFilters)).length;
  }, [
    isOffersScopeSelected,
    activeOffersPool,
    places,
    isRealEstateSelected,
    selectedCategoryApprovedProperties,
    selectedCategoryPlaces,
    activePromoFilters,
  ]);

  const selectedCatFeaturedCount = useMemo(() => {
    if (isOffersScopeSelected) {
      return activeOffersPool.filter((o) => matchesOfferFixedFeatured(o, places, activePromoFilters)).length;
    }
    if (isRealEstateSelected) {
      return selectedCategoryApprovedProperties.filter((p) => matchesPropertyFixedFeatured(p)).length;
    }
    return selectedCategoryPlaces.filter((p) => matchesFixedFeatured(p, activePromoFilters)).length;
  }, [
    isOffersScopeSelected,
    activeOffersPool,
    places,
    isRealEstateSelected,
    selectedCategoryApprovedProperties,
    selectedCategoryPlaces,
    activePromoFilters,
  ]);

  const countMatchesForCatFilter = (filter: CategoryFilter): number => {
    if (isOffersScopeSelected) {
      return activeOffersPool.filter((o) => matchesOfferFilter(o, filter, places, sortedCategories)).length;
    }
    if (isRealEstateSelected) {
      return selectedCategoryApprovedProperties.filter((p) => matchesPropertyCategoryFilter(p, filter)).length;
    }
    return selectedCategoryPlaces.filter((p) => matchesCategoryFilter(p, filter)).length;
  };

  const selectedScopeDisplayName = isOffersScopeSelected
    ? 'التخفيضات والعروض'
    : selectedFilterCategory?.name || '';

  const suggestedMatchValues = useMemo(() => {
    const vals = new Set<string>();
    if (isOffersScopeSelected) {
      if (cfMatchField === 'area') {
        (settings.areas || []).forEach((a) => vals.add(a));
      } else if (cfMatchField === 'tags') {
        activeOffersPool.forEach((o) => {
          (o.tags || []).forEach((t) => {
            if (t.trim()) vals.add(t.trim());
          });
        });
      } else {
        sortedCategories.forEach((c) => {
          if (activeOffersPool.some((o) => o.categorySlug === c.slug)) {
            vals.add(c.name);
          }
        });
        sortedCategories.forEach((c) => vals.add(c.name));
      }
      return Array.from(vals).slice(0, 8);
    }

    if (cfMatchField === 'area') {
      (settings.areas || []).forEach((a) => vals.add(a));
      selectedCategoryPlaces.forEach((p) => {
        if (p.area?.trim()) vals.add(p.area.trim());
      });
    } else if (cfMatchField === 'specialty' || cfMatchField === 'subCategory') {
      selectedCategoryPlaces.forEach((p) => {
        if (p.subCategory?.trim()) vals.add(p.subCategory.trim());
        if (p.specialty?.trim()) vals.add(p.specialty.trim());
      });
    } else if (cfMatchField === 'tags') {
      selectedCategoryPlaces.forEach((p) => {
        (p.tags || []).forEach((t) => {
          if (t.trim()) vals.add(t.trim());
        });
      });
    }
    return Array.from(vals).slice(0, 8);
  }, [isOffersScopeSelected, cfMatchField, activeOffersPool, sortedCategories, selectedCategoryPlaces, settings.areas]);

  useEffect(() => {
    const anyModalOpen =
      editorOpen ||
      badgeEditorOpen ||
      catFilterModalOpen ||
      Boolean(subscribersModalFilterId) ||
      Boolean(deleteTarget) ||
      Boolean(deleteBadgeTarget) ||
      Boolean(deleteCatFilterTarget);
    if (!anyModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteCatFilterTarget) setDeleteCatFilterTarget(null);
      else if (deleteBadgeTarget) setDeleteBadgeTarget(null);
      else if (deleteTarget) setDeleteTarget(null);
      else if (subscribersModalFilterId) setSubscribersModalFilterId(null);
      else if (catFilterModalOpen) setCatFilterModalOpen(false);
      else if (badgeEditorOpen) setBadgeEditorOpen(false);
      else if (editorOpen) setEditorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    editorOpen,
    badgeEditorOpen,
    catFilterModalOpen,
    subscribersModalFilterId,
    deleteTarget,
    deleteBadgeTarget,
    deleteCatFilterTarget,
  ]);

  const getCategoryPlaceCount = (cat: Category) =>
    places.filter((p) => p.categoryId === cat.id || p.categorySlug === cat.slug).length;

  const todayISO = getTodayISO();
  const getFilterSubscribersCount = (filterId: string) =>
    places.filter((p) => isPlaceSubscribedToFilter(p, filterId, todayISO)).length;

  const filteredIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return ICON_LIBRARY;
    return ICON_LIBRARY.filter(
      (i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    );
  }, [iconSearch]);

  const filteredBadgeIcons = useMemo(() => {
    const q = badgeIconSearch.trim().toLowerCase();
    if (!q) return ICON_LIBRARY;
    return ICON_LIBRARY.filter(
      (i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    );
  }, [badgeIconSearch]);

  // Category Handlers
  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setIconKey('store');
    setIconSearch('');
    setImageUrl('');
    setBgColor('#e6f4ec');
    setIconColor('#0f5132');
    setTemplateType('general');
    setActive(true);
    setEditorOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setIconKey(cat.iconKey || 'store');
    setIconSearch('');
    setImageUrl(cat.imageUrl || '');
    setBgColor(cat.bgColor || '#e6f4ec');
    setIconColor(cat.iconColor || '#0f5132');
    setTemplateType(cat.templateType || 'general');
    setActive(cat.active);
    setEditorOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      showToast('يرجى كتابة اسم القسم بالعربي (حرفان على الأقل)', 'error');
      return;
    }
    setSavingCat(true);
    try {
      const existing = editingId ? categories.find((c) => c.id === editingId) : null;
      const computedSlug = slugifyAscii(slug.trim() || name, 'cat');
      const id = existing ? existing.id : `cat-${Date.now().toString(36)}`;
      const nextOrder = existing ? existing.order : sortedCategories.length + 1;

      await saveCategory({
        id,
        name: name.trim(),
        slug: computedSlug,
        description: description.trim() || undefined,
        iconKey,
        imageUrl: imageUrl.trim() || undefined,
        bgColor,
        iconColor,
        templateType,
        order: nextOrder,
        active,
        categoryFilters: existing?.categoryFilters,
      });
      setEditorOpen(false);
    } catch {
      showToast('تعذر حفظ القسم حالياً، تأكد من الصلاحيات وحاول مجدداً', 'error');
    } finally {
      setSavingCat(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sortedCategories.length) return;
    const next = [...sortedCategories];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    await reorderCategories(next.map((c) => c.id));
  };

  const handleDropOn = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const next = [...sortedCategories];
    const fromIdx = next.findIndex((c) => c.id === draggedId);
    const toIdx = next.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedId(null);
      return;
    }
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraggedId(null);
    await reorderCategories(next.map((c) => c.id));
  };

  // --- PER-CATEGORY & OFFERS FILTERS HANDLERS ---
  const getCurrentManualFilters = (): CategoryFilter[] => {
    const raw = isOffersScopeSelected
      ? settings.offersFilters
      : selectedFilterCategory?.categoryFilters;
    return Array.isArray(raw) ? [...raw].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) : [];
  };

  const persistSelectedScopeFilters = async (nextFilters: CategoryFilter[]) => {
    if (isAuditor) {
      showToast('حساب المراجع للقراءة فقط', 'error');
      return;
    }
    const normalized = nextFilters.slice(0, 40).map((f, index) => ({
      id: f.id,
      label: f.label.trim(),
      matchField: f.matchField,
      matchValue: isBooleanMatchField(f.matchField)
        ? f.matchValue || 'true'
        : (f.matchValue || f.label).trim(),
      order: index + 1,
      enabled: Boolean(f.enabled),
    }));
    if (isOffersScopeSelected) {
      await savePublicSettings({
        ...settings,
        offersFilters: normalized,
      });
      return;
    }
    if (!selectedFilterCategory) return;
    await saveCategory({
      ...selectedFilterCategory,
      categoryFilters: normalized,
    });
  };

  const openCreateCatFilterModal = () => {
    if (isAuditor) {
      showToast('حساب المراجع للقراءة فقط', 'error');
      return;
    }
    setEditingCatFilterId(null);
    setCfLabel('');
    setCfMatchField(isOffersScopeSelected ? 'subCategory' : 'specialty');
    setCfMatchValue('');
    setCfEnabled(true);
    setCatFilterModalOpen(true);
  };

  const openEditCatFilterModal = (filter: CategoryFilter) => {
    if (isAuditor) {
      showToast('حساب المراجع للقراءة فقط', 'error');
      return;
    }
    setEditingCatFilterId(filter.id);
    setCfLabel(filter.label);
    setCfMatchField(filter.matchField);
    setCfMatchValue(filter.matchValue);
    setCfEnabled(filter.enabled);
    setCatFilterModalOpen(true);
  };

  const handleSaveCatFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!isOffersScopeSelected && !selectedFilterCategory) || isAuditor) return;
    if (cfLabel.trim().length < 2) {
      showToast('يرجى كتابة اسم الفلتر (حرفان على الأقل)', 'error');
      return;
    }
    const existingManual = getCurrentManualFilters();

    if (!editingCatFilterId && existingManual.length >= 40) {
      showToast('الحد الأقصى للفلاتر المخصصة في القسم الواحد هو 40 فلتراً', 'error');
      return;
    }

    const effectiveValue = isBooleanMatchField(cfMatchField)
      ? 'true'
      : (cfMatchValue.trim() || cfLabel.trim());

    setSavingCatFilter(true);
    try {
      let nextList: CategoryFilter[];
      if (editingCatFilterId) {
        nextList = existingManual.map((f) =>
          f.id === editingCatFilterId
            ? {
                ...f,
                label: cfLabel.trim(),
                matchField: cfMatchField,
                matchValue: effectiveValue,
                enabled: cfEnabled,
              }
            : f
        );
      } else {
        const newItem: CategoryFilter = {
          id: `cf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          label: cfLabel.trim(),
          matchField: cfMatchField,
          matchValue: effectiveValue,
          order: existingManual.length + 1,
          enabled: cfEnabled,
        };
        nextList = [...existingManual, newItem];
      }
      await persistSelectedScopeFilters(nextList);
      setCatFilterModalOpen(false);
    } catch {
      showToast('تعذر حفظ الفلتر في قاعدة البيانات حالياً', 'error');
    } finally {
      setSavingCatFilter(false);
    }
  };

  const handleAdoptAutoFilters = async () => {
    if ((!isOffersScopeSelected && !selectedFilterCategory) || isAuditor || selectedEffectiveFilters.length === 0) {
      return;
    }
    const adopted: CategoryFilter[] = selectedEffectiveFilters.map((f, idx) => ({
      ...f,
      id: `cf-${Date.now().toString(36)}-${idx + 1}`,
      order: idx + 1,
      enabled: true,
    }));
    await persistSelectedScopeFilters(adopted);
  };

  const handleMoveCatFilter = async (index: number, direction: -1 | 1) => {
    if ((!isOffersScopeSelected && !selectedFilterCategory) || isAuditor) return;
    const current = getCurrentManualFilters();
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const [moved] = current.splice(index, 1);
    current.splice(targetIdx, 0, moved);
    await persistSelectedScopeFilters(current);
  };

  const handleToggleCatFilter = async (filterId: string) => {
    if ((!isOffersScopeSelected && !selectedFilterCategory) || isAuditor) return;
    const current = getCurrentManualFilters();
    const next = current.map((f) => (f.id === filterId ? { ...f, enabled: !f.enabled } : f));
    await persistSelectedScopeFilters(next);
  };

  const handleConfirmDeleteCatFilter = async () => {
    if ((!isOffersScopeSelected && !selectedFilterCategory) || !deleteCatFilterTarget || isAuditor) return;
    const current = getCurrentManualFilters();
    const next = current.filter((f) => f.id !== deleteCatFilterTarget.id);
    await persistSelectedScopeFilters(next);
    setDeleteCatFilterTarget(null);
  };

  // Promo Filter / Badge Handlers
  const openCreateBadgeModal = () => {
    setEditingBadgeId(null);
    setBadgeName('');
    setBadgeSlug('');
    setBadgeDesc('');
    setBadgeIconKey('star');
    setBadgeIconSearch('');
    setBadgeBgColor('#fef3c7');
    setBadgeTextColor('#92400e');
    setBadgePriority('90');
    setBadgeActive(true);
    setBadgeEditorOpen(true);
  };

  const openEditBadgeModal = (pf: PromoFilter) => {
    setEditingBadgeId(pf.id);
    setBadgeName(pf.name);
    setBadgeSlug(pf.slug);
    setBadgeDesc(pf.description || '');
    setBadgeIconKey(pf.iconKey || 'star');
    setBadgeIconSearch('');
    setBadgeBgColor(pf.badgeBgColor || '#fef3c7');
    setBadgeTextColor(pf.badgeTextColor || '#92400e');
    setBadgePriority(String(pf.priorityWeight ?? 80));
    setBadgeActive(pf.active);
    setBadgeEditorOpen(true);
  };

  const handleSavePromoFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (badgeName.trim().length < 2) {
      showToast('يرجى كتابة اسم فلتر التمييز بالعربي (حرفان على الأقل)', 'error');
      return;
    }
    setSavingBadge(true);
    try {
      const existing = editingBadgeId ? promoFilters.find((f) => f.id === editingBadgeId) : null;
      const computedSlug = slugifyAscii(badgeSlug.trim() || badgeName, 'badge');
      const id = existing ? existing.id : `promo-${Date.now().toString(36)}`;
      const nextOrder = existing ? existing.order : sortedPromoFilters.length + 1;
      const rawPriority = badgePriority.trim() === '' ? 80 : Number(badgePriority);
      const parsedPriority = Number.isNaN(rawPriority)
        ? 80
        : Math.max(0, Math.min(1000, rawPriority));

      await savePromoFilter({
        id,
        name: badgeName.trim(),
        slug: computedSlug,
        iconKey: badgeIconKey,
        badgeBgColor,
        badgeTextColor,
        priorityWeight: parsedPriority,
        order: nextOrder,
        active: badgeActive,
        description: badgeDesc.trim() || undefined,
      });
      setBadgeEditorOpen(false);
    } catch {
      showToast('تعذر حفظ فلتر التمييز حالياً، يرجى المحاولة مجدداً', 'error');
    } finally {
      setSavingBadge(false);
    }
  };

  const handleMoveBadge = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sortedPromoFilters.length) return;
    const next = [...sortedPromoFilters];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    await reorderPromoFilters(next.map((f) => f.id));
  };

  const handleDropBadgeOn = async (targetId: string) => {
    if (!draggedBadgeId || draggedBadgeId === targetId) {
      setDraggedBadgeId(null);
      return;
    }
    const next = [...sortedPromoFilters];
    const fromIdx = next.findIndex((f) => f.id === draggedBadgeId);
    const toIdx = next.findIndex((f) => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedBadgeId(null);
      return;
    }
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraggedBadgeId(null);
    await reorderPromoFilters(next.map((f) => f.id));
  };

  // Subscribers modal filtered places
  const activeModalFilter = subscribersModalFilterId
    ? promoFilters.find((f) => f.id === subscribersModalFilterId) || null
    : null;

  const modalPlaces = useMemo(() => {
    if (!activeModalFilter) return [];
    const q = subscriberSearch.trim().toLowerCase();
    return places
      .filter((p) => {
        if (subscriberCatFilter !== 'all' && p.categoryId !== subscriberCatFilter) return false;
        if (onlySubscribed && !(p.filterTags || []).includes(activeModalFilter.id)) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.specialty || '').toLowerCase().includes(q) ||
          p.area.toLowerCase().includes(q) ||
          p.phone.includes(q)
        );
      })
      .sort((a, b) => {
        const aIn = (a.filterTags || []).includes(activeModalFilter.id) ? 1 : 0;
        const bIn = (b.filterTags || []).includes(activeModalFilter.id) ? 1 : 0;
        return bIn - aIn;
      });
  }, [activeModalFilter, places, subscriberSearch, subscriberCatFilter, onlySubscribed]);

  // Smart Duplicate Places Detector (SCREEN_6)
  const duplicateGroups = useMemo(() => {
    const byPhone: Record<string, typeof places> = {};
    places.forEach((p) => {
      const normalized = (p.phone || '').replace(/\D/g, '');
      if (normalized.length >= 8) {
        if (!byPhone[normalized]) byPhone[normalized] = [];
        byPhone[normalized].push(p);
      }
    });
    return Object.entries(byPhone)
      .filter(([, list]) => list.length > 1)
      .map(([phone, list]) => ({ phone, list }));
  }, [places]);

  const areasList = settings.areas || [];

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newArea.trim();
    if (!trimmed) return;
    if (areasList.includes(trimmed)) {
      showToast('هذه المنطقة مضافة بالفعل', 'info');
      return;
    }
    await savePublicSettings({
      ...settings,
      areas: [...areasList, trimmed],
    });
    setNewArea('');
  };

  const handleRemoveArea = async (areaName: string) => {
    await savePublicSettings({
      ...settings,
      areas: areasList.filter((a) => a !== areaName),
    });
  };

  const targetPlaceCount = deleteTarget ? getCategoryPlaceCount(deleteTarget) : 0;
  const targetBadgeSubCount = deleteBadgeTarget
    ? places.filter((p) => (p.filterTags || []).includes(deleteBadgeTarget.id)).length
    : 0;

  const BadgePreviewIcon = getIconComponent(badgeIconKey);

  return (
    <AdminShell
      title="إدارة الأقسام وشارات التمييز والمناطق"
      subtitle="تحكم ديناميكي كامل 100% في الأقسام وباقات التمييز (VIP) مع تزامن فوري للجمهور"
      headerAction={
        activeTab === 'categories' && !isAuditor ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-civic-1 active:scale-95 transition-transform"
          >
            <Plus size={18} />
            <span>إضافة قسم جديد</span>
          </button>
        ) : activeTab === 'filters' && !isAuditor && (isOffersScopeSelected || selectedFilterCategory) ? (
          <button
            type="button"
            onClick={openCreateCatFilterModal}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-civic-1 active:scale-95 transition-transform"
          >
            <Plus size={18} />
            <span>إضافة فلتر جديد</span>
          </button>
        ) : activeTab === 'badges' && !isAuditor ? (
          <button
            type="button"
            onClick={openCreateBadgeModal}
            className="min-h-[44px] px-4 py-2 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-civic-1 active:scale-95 transition-transform"
          >
            <Plus size={18} />
            <span>إضافة فلتر / شارة تمييز</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white border border-[#e4ece7] p-1.5 rounded-2xl w-fit shadow-civic-1">
          <AnimatedFilterChip
            active={activeTab === 'categories'}
            onClick={() => setActiveTab('categories')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'categories'
                ? 'bg-[#003820] text-white'
                : 'text-[#404942] hover:bg-[#f1f4f2]'
            }`}
          >
            <Layers size={16} />
            الأقسام والتصنيفات ({categories.length})
          </AnimatedFilterChip>
          <AnimatedFilterChip
            active={activeTab === 'filters'}
            onClick={() => setActiveTab('filters')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'filters'
                ? 'bg-[#003820] text-white'
                : 'text-[#404942] hover:bg-[#f1f4f2]'
            }`}
          >
            <SlidersHorizontal size={16} />
            فلاتر الأقسام
          </AnimatedFilterChip>
          <AnimatedFilterChip
            active={activeTab === 'badges'}
            onClick={() => setActiveTab('badges')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'badges'
                ? 'bg-[#003820] text-white'
                : 'text-[#404942] hover:bg-[#f1f4f2]'
            }`}
          >
            <Award size={16} />
            فلاتر وشارات التمييز ({promoFilters.length})
          </AnimatedFilterChip>
          <AnimatedFilterChip
            active={activeTab === 'areas'}
            onClick={() => setActiveTab('areas')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'areas'
                ? 'bg-[#003820] text-white'
                : 'text-[#404942] hover:bg-[#f1f4f2]'
            }`}
          >
            <MapPin size={16} />
            الأحياء والقرى ({areasList.length})
          </AnimatedFilterChip>
          <AnimatedFilterChip
            active={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'audit'
                ? 'bg-[#003820] text-white'
                : 'text-[#404942] hover:bg-[#f1f4f2]'
            }`}
          >
            <Building2 size={16} />
            تدقيق العقارات وكاشف التكرار
          </AnimatedFilterChip>
        </div>

        {/* TAB 1: 100% DYNAMIC CATEGORIES MANAGER */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <FadeInUp delay={0.02}>
              <div className="bg-[#e6f4ec] border border-[#b7e2c8] rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#003820] text-[#9ff1bd] flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-[#003820]">إدارة مرنة للأقسام بدون تعديل الكود</p>
                    <p className="text-xs text-[#0f5132]">
                      اسحب أي قسم أو استخدم أسهم الترتيب (↑ ↓) لتغيير مكانه في الصفحة الرئيسية، أو أخفِ الأقسام الموسمية مؤقتاً دون مسح محلاتها.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#003820] bg-white px-3 py-1.5 rounded-xl shrink-0">
                  النشط للجمهور: {sortedCategories.filter((c) => c.active).length} من {sortedCategories.length}
                </span>
              </div>
            </FadeInUp>

            <div className="bg-white border border-[#e4ece7] rounded-3xl shadow-civic-1 divide-y divide-[#e4ece7] overflow-hidden">
              {sortedCategories.map((cat, idx) => {
                const count = getCategoryPlaceCount(cat);
                const tpl = TEMPLATE_OPTIONS.find((t) => t.value === cat.templateType);
                return (
                  <FadeInUp key={cat.id} index={idx} y={14}>
                    <div
                      draggable
                      onDragStart={() => setDraggedId(cat.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void handleDropOn(cat.id)}
                      className={`group p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                        draggedId === cat.id ? 'bg-[#e6f4ec]/60 opacity-75' : 'hover:bg-[#f7faf8]'
                      } ${!cat.active ? 'opacity-65 bg-[#f7faf8]/80' : ''}`}
                    >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="cursor-grab active:cursor-grabbing text-[#707971] hover:text-[#003820] p-1">
                        <GripVertical size={20} />
                      </div>
                      <span className="w-7 h-7 rounded-lg bg-[#f1f4f2] text-[#003820] text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                        {idx + 1}
                      </span>
                      <DynamicCategoryIcon
                        iconKey={cat.iconKey}
                        imageUrl={cat.imageUrl}
                        bgColor={cat.bgColor}
                        iconColor={cat.iconColor}
                        size="md"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-[#181c1c] truncate">{cat.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              cat.active ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#e4ece7] text-[#404942]'
                            }`}
                          >
                            {cat.active ? 'ظاهر للجمهور' : 'مخفي مؤقتاً'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f1f4f2] text-[#404942] text-[11px] font-semibold">
                            {tpl?.label || cat.templateType}
                          </span>
                        </div>
                        <p className="text-xs text-[#404942] flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-[#707971]">/{cat.slug}</span>
                          <span>·</span>
                          <span className="font-semibold text-[#0f5132] tabular-nums">{count} مكان مسجل</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                      <div className="flex items-center bg-[#f1f4f2] rounded-xl p-1 gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => void handleMove(idx, -1)}
                          className="w-9 h-9 rounded-lg bg-white hover:bg-[#e6f4ec] disabled:opacity-35 text-[#003820] flex items-center justify-center"
                          aria-label="تحريك للأعلى"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sortedCategories.length - 1}
                          onClick={() => void handleMove(idx, 1)}
                          className="w-9 h-9 rounded-lg bg-white hover:bg-[#e6f4ec] disabled:opacity-35 text-[#003820] flex items-center justify-center"
                          aria-label="تحريك للأسفل"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void saveCategory({ ...cat, active: !cat.active })}
                        className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                          cat.active
                            ? 'bg-[#fef3c7] hover:bg-[#fde68a] text-[#735c00]'
                            : 'bg-[#e6f4ec] hover:bg-[#d1fae5] text-[#0f5132]'
                        }`}
                      >
                        {cat.active ? <EyeOff size={15} /> : <Eye size={15} />}
                        <span>{cat.active ? 'إخفاء' : 'تفعيل'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFilterCatId(cat.id);
                          setActiveTab('filters');
                        }}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#e6f4ec] hover:bg-[#d1fae5] text-[#003820] text-xs font-bold flex items-center gap-1.5"
                      >
                        <SlidersHorizontal size={15} />
                        <span>
                          الفلاتر (
                          {cat.categoryFilters && cat.categoryFilters.length > 0
                            ? cat.categoryFilters.length
                            : 'تلقائي'}
                          )
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#f1f4f2] hover:bg-[#e4ece7] text-[#181c1c] text-xs font-bold flex items-center gap-1.5"
                      >
                        <Edit3 size={15} />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(cat);
                          setForceDeleteConfirm(false);
                        }}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 size={15} />
                        <span>حذف</span>
                      </button>
                    </div>
                    </div>
                  </FadeInUp>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PER-CATEGORY FILTERS MANAGER (All 12+ Categories & Future Ones) */}
        {activeTab === 'filters' && (
          <div className="space-y-4">
            <FadeInUp delay={0.02}>
              <div className="bg-[#e6f4ec] border border-[#b7e2c8] rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#003820] text-[#9ff1bd] flex items-center justify-center shrink-0">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-[#003820]">
                      إدارة فلاتر كل قسم بشكل مستقل (بدون تعديل الكود)
                    </p>
                    <p className="text-xs text-[#0f5132] leading-relaxed">
                      اختر أي قسم لتخصيص فلاتره (إضافة، تعديل، ترتيب، إخفاء أو حذف). تظهر جميع التعديلات فوراً للمستخدمين بعد فلترَي «VIP» و«الأكثر تميزاً» الثابتين.
                    </p>
                  </div>
                </div>
                {!isAuditor && (isOffersScopeSelected || selectedFilterCategory) && (
                  <button
                    type="button"
                    onClick={openCreateCatFilterModal}
                    className="min-h-[42px] px-4 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus size={16} />
                    إضافة فلتر جديد
                  </button>
                )}
              </div>
            </FadeInUp>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Category & Offers Selector Column */}
              <div className="lg:col-span-4 bg-white border border-[#e4ece7] rounded-3xl p-3.5 shadow-civic-1 space-y-2">
                <div className="px-2 py-1 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-[#003820]">
                    اختر القسم أو التبويب ({sortedCategories.length + 1})
                  </h2>
                  <span className="text-[11px] text-[#707971]">عدد الفلاتر</span>
                </div>
                <div className="space-y-1.5 max-h-[540px] overflow-y-auto pl-0.5">
                  {/* Offers Tab Scope */}
                  <button
                    type="button"
                    onClick={() => setSelectedFilterCatId(OFFERS_FILTER_SCOPE_ID)}
                    className={`w-full text-right p-2.5 rounded-2xl flex items-center justify-between gap-2.5 transition-all border ${
                      isOffersScopeSelected
                        ? 'bg-[#003820] text-white border-[#003820] shadow-civic-1'
                        : 'bg-[#fef9e7]/70 hover:bg-[#fef3c7] text-[#181c1c] border-[#f5d061]/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isOffersScopeSelected
                            ? 'bg-white/15 text-[#ffe088]'
                            : 'bg-[#fef3c7] text-[#92400e]'
                        }`}
                      >
                        <Percent size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">تبويب التخفيضات والعروض</p>
                        <p
                          className={`text-[10px] truncate ${
                            isOffersScopeSelected ? 'text-white/75' : 'text-[#735c00]'
                          }`}
                        >
                          {activeOffersPool.length} عرض فعّال حالياً
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 tabular-nums ${
                        isOffersScopeSelected
                          ? 'bg-[#ffe088] text-[#003820]'
                          : (settings.offersFilters?.length || 0) > 0
                            ? 'bg-[#e6f4ec] text-[#0f5132]'
                            : 'bg-white border border-[#e4ece7] text-[#707971]'
                      }`}
                    >
                      {(settings.offersFilters?.length || 0) > 0
                        ? `${settings.offersFilters?.length} مخصص`
                        : 'تلقائي'}
                    </span>
                  </button>

                  {sortedCategories.map((cat) => {
                    const isSelected = !isOffersScopeSelected && selectedFilterCategory?.id === cat.id;
                    const manualCount = cat.categoryFilters?.length || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedFilterCatId(cat.id)}
                        className={`w-full text-right p-2.5 rounded-2xl flex items-center justify-between gap-2.5 transition-all ${
                          isSelected
                            ? 'bg-[#003820] text-white shadow-civic-1'
                            : 'bg-[#f7faf8] hover:bg-[#e6f4ec]/60 text-[#181c1c]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <DynamicCategoryIcon
                            iconKey={cat.iconKey}
                            imageUrl={cat.imageUrl}
                            bgColor={isSelected ? 'rgba(255,255,255,0.14)' : cat.bgColor}
                            iconColor={isSelected ? '#9ff1bd' : cat.iconColor}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{cat.name}</p>
                            <p
                              className={`text-[10px] truncate ${
                                isSelected ? 'text-white/75' : 'text-[#707971]'
                              }`}
                            >
                              {getCategoryPlaceCount(cat)} بطاقة مسجلة
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 tabular-nums ${
                            isSelected
                              ? 'bg-[#9ff1bd] text-[#003820]'
                              : manualCount > 0
                                ? 'bg-[#e6f4ec] text-[#0f5132]'
                                : 'bg-white border border-[#e4ece7] text-[#707971]'
                          }`}
                        >
                          {manualCount > 0 ? `${manualCount} مخصص` : 'تلقائي'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Category / Offers Filters Workspace */}
              <div className="lg:col-span-8 space-y-4">
                {(isOffersScopeSelected || selectedFilterCategory) && (
                  <>
                    {/* Fixed Filters Banner (Always #1 VIP & #2 الأكثر تميزاً) */}
                    <div className="bg-white border border-[#e4ece7] rounded-3xl p-4 sm:p-5 shadow-civic-1 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {isOffersScopeSelected ? (
                            <div className="w-10 h-10 rounded-2xl bg-[#fef3c7] text-[#92400e] flex items-center justify-center shrink-0">
                              <Percent size={20} />
                            </div>
                          ) : (
                            selectedFilterCategory && (
                              <DynamicCategoryIcon
                                iconKey={selectedFilterCategory.iconKey}
                                imageUrl={selectedFilterCategory.imageUrl}
                                bgColor={selectedFilterCategory.bgColor}
                                iconColor={selectedFilterCategory.iconColor}
                                size="sm"
                              />
                            )
                          )}
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-[#003820]">
                              فلاتر {isOffersScopeSelected ? 'تبويب «التخفيضات والعروض»' : `قسم «${selectedScopeDisplayName}»`}
                            </h3>
                            <p className="text-[11px] text-[#404942]">
                              تظهر الفلاتر الثابتة دائماً في بداية شريط الفلاتر تليها الفلاتر المخصصة بالترتيب المحدد
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-2xl p-3.5 space-y-2.5">
                        <p className="text-[11px] font-bold text-[#404942]">
                          الفلاتر الثابتة في بداية الشريط (لا تُحذف):
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#003820] text-[#ffe088] text-xs font-bold">
                            <Crown size={13} />
                            <span>1. VIP</span>
                            <span className="bg-white/15 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums">
                              {selectedCatVipCount} {isOffersScopeSelected ? 'عرض' : 'بطاقة'}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fef3c7] border border-[#f5d061] text-[#92400e] text-xs font-bold">
                            <Star size={13} className="fill-current" />
                            <span>2. الأكثر تميزاً</span>
                            <span className="bg-white/80 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums">
                              {selectedCatFeaturedCount} {isOffersScopeSelected ? 'عرض' : 'بطاقة'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Auto-Derived Fallback Notice OR Custom Filters List */}
                    {selectedFiltersAreAuto ? (
                      <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
                        <div className="bg-[#fef9e7] border border-[#f5d061] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-[#735c00] flex items-center gap-1.5">
                              <Wand2 size={15} />
                              وضع الفلاتر الافتراضية التلقائية مفعل لهذا القسم
                            </p>
                            <p className="text-xs text-[#6c5712] leading-relaxed">
                              لم تضف فلاتر يدوياً بعد، لذلك يستخرج التطبيق الفلاتر تلقائياً من تخصصات وخدمات البطاقات الحالية. يمكنك اعتمادها للتعديل أو إضافة فلتر جديد فوراً.
                            </p>
                          </div>
                          {!isAuditor && selectedEffectiveFilters.length > 0 && (
                            <button
                              type="button"
                              onClick={() => void handleAdoptAutoFilters()}
                              className="min-h-[42px] px-4 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
                            >
                              <CheckCircle2 size={15} />
                              اعتمادها للتعديل ({selectedEffectiveFilters.length})
                            </button>
                          )}
                        </div>

                        {selectedEffectiveFilters.length === 0 ? (
                          <div className="p-6 text-center rounded-2xl bg-[#f7faf8] border border-dashed border-[#c0c9c0] space-y-2.5">
                            <SlidersHorizontal size={26} className="mx-auto text-[#707971]" />
                            <p className="text-sm font-bold text-[#181c1c]">
                              لا توجد بطاقات أو فلاتر مضافة في هذا القسم بعد
                            </p>
                            <p className="text-xs text-[#404942]">
                              يمكنك إضافة فلاتر جاهزة للقسم الآن، وعند استيراد أو إضافة بطاقات ستندرج تلقائياً تحت الفلتر المطابق.
                            </p>
                            {!isAuditor && (
                              <button
                                type="button"
                                onClick={openCreateCatFilterModal}
                                className="min-h-[42px] px-4 rounded-xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1.5"
                              >
                                <Plus size={15} /> إضافة أول فلتر للقسم
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-[#404942]">
                              معاينة الفلاتر المستخرجة تلقائياً حالياً:
                            </p>
                            <div className="divide-y divide-[#e4ece7] border border-[#e4ece7] rounded-2xl overflow-hidden">
                              {selectedEffectiveFilters.map((f, idx) => (
                                <div
                                  key={f.id}
                                  className="p-3.5 bg-[#f7faf8]/60 flex flex-wrap items-center justify-between gap-2"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-6 h-6 rounded-lg bg-white border border-[#e4ece7] text-[#404942] text-[11px] font-bold flex items-center justify-center tabular-nums">
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs sm:text-sm font-bold text-[#181c1c] truncate">
                                        {f.label}
                                      </p>
                                      <p className="text-[11px] text-[#707971]">
                                        الحقل: {getMatchFieldShortLabel(f.matchField)}
                                        {!isBooleanMatchField(f.matchField) ? ` · القيمة: «${f.matchValue}»` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="px-2.5 py-1 rounded-full bg-[#e6f4ec] text-[#0f5132] text-[11px] font-bold tabular-nums">
                                    يطابق {countMatchesForCatFilter(f)} بطاقة
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-[#e4ece7] rounded-3xl shadow-civic-1 overflow-hidden">
                        <div className="p-4 border-b border-[#e4ece7] flex flex-wrap items-center justify-between gap-2 bg-[#f7faf8]">
                          <p className="text-xs font-bold text-[#003820]">
                            الفلاتر المخصصة لهذا القسم ({selectedEffectiveFilters.length}) — المفعّل:{' '}
                            {selectedEffectiveFilters.filter((f) => f.enabled).length}
                          </p>
                          {!isAuditor && (
                            <button
                              type="button"
                              onClick={openCreateCatFilterModal}
                              className="min-h-[36px] px-3 rounded-xl bg-[#003820] text-white text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Plus size={14} /> إضافة فلتر
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-[#e4ece7]">
                          {selectedEffectiveFilters.map((f, idx) => {
                            const matchedCount = countMatchesForCatFilter(f);
                            return (
                              <div
                                key={f.id}
                                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                  !f.enabled ? 'opacity-65 bg-[#f7faf8]/80' : 'hover:bg-[#f7faf8]/60'
                                }`}
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <span className="w-7 h-7 rounded-lg bg-[#f1f4f2] text-[#003820] text-xs font-bold flex items-center justify-center tabular-nums shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <h4 className="text-sm font-bold text-[#181c1c]">{f.label}</h4>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          f.enabled
                                            ? 'bg-[#e6f4ec] text-[#0f5132]'
                                            : 'bg-[#e4ece7] text-[#404942]'
                                        }`}
                                      >
                                        {f.enabled ? 'ظاهر' : 'مخفي'}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full bg-[#f1f4f2] text-[#404942] text-[10px] font-semibold">
                                        {getMatchFieldShortLabel(f.matchField)}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full bg-[#e6f4ec]/70 text-[#003820] text-[10px] font-bold tabular-nums">
                                        يطابق {matchedCount} بطاقة
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-[#707971]">
                                      {isBooleanMatchField(f.matchField)
                                        ? `شرط تلقائي: ${f.matchField === 'hasDelivery' ? 'يتوفر توصيل' : 'يعمل 24 ساعة'}`
                                        : `قيمة المطابقة: «${f.matchValue || f.label}»`}
                                    </p>
                                  </div>
                                </div>

                                {!isAuditor && (
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                                    <div className="flex items-center bg-[#f1f4f2] rounded-xl p-1 gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => void handleMoveCatFilter(idx, -1)}
                                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#e6f4ec] disabled:opacity-35 text-[#003820] flex items-center justify-center"
                                        aria-label="تحريك الفلتر للأعلى"
                                      >
                                        <ArrowUp size={15} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === selectedEffectiveFilters.length - 1}
                                        onClick={() => void handleMoveCatFilter(idx, 1)}
                                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#e6f4ec] disabled:opacity-35 text-[#003820] flex items-center justify-center"
                                        aria-label="تحريك الفلتر للأسفل"
                                      >
                                        <ArrowDown size={15} />
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => void handleToggleCatFilter(f.id)}
                                      className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
                                        f.enabled
                                          ? 'bg-[#fef3c7] hover:bg-[#fde68a] text-[#735c00]'
                                          : 'bg-[#e6f4ec] hover:bg-[#d1fae5] text-[#0f5132]'
                                      }`}
                                    >
                                      {f.enabled ? <EyeOff size={14} /> : <Eye size={14} />}
                                      <span>{f.enabled ? 'إخفاء' : 'تفعيل'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEditCatFilterModal(f)}
                                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#f1f4f2] hover:bg-[#e4ece7] text-[#181c1c] text-xs font-bold flex items-center gap-1"
                                    >
                                      <Edit3 size={14} />
                                      <span>تعديل</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setDeleteCatFilterTarget(f)}
                                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold flex items-center gap-1"
                                    >
                                      <Trash2 size={14} />
                                      <span>حذف</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 100% DYNAMIC PROMOTIONAL BADGES & FILTERS (VIP / الأكثر تميزاً) */}
        {activeTab === 'badges' && (
          <div className="space-y-4">
            <FadeInUp delay={0.02}>
              <div className="bg-gradient-to-l from-[#fef3c7]/80 via-white to-[#e6f4ec]/80 border border-[#f5d061] rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#003820] text-[#ffe088] flex items-center justify-center shrink-0">
                    <Award size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-[#003820]">
                      نظام باقات وشارات التمييز الديناميكية (VIP &amp; الأكثر تميزاً)
                    </p>
                    <p className="text-xs text-[#404942] leading-relaxed">
                      أنشئ أي شارة أو باقة اشتراك، وحدد لونها وأولويتها، وسكّن المشتركين بداخلها بضغطة زر. يظهر المشتركون تلقائياً في مقدمة نتائج البحث والأقسام حاملين شارتهم الملونة.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#735c00] bg-white border border-[#f5d061] px-3 py-1.5 rounded-xl shrink-0">
                  فلاتر نشطة: {sortedPromoFilters.filter((f) => f.active).length} من {sortedPromoFilters.length}
                </span>
              </div>
            </FadeInUp>

            <div className="bg-white border border-[#e4ece7] rounded-3xl shadow-civic-1 divide-y divide-[#e4ece7] overflow-hidden">
              {sortedPromoFilters.map((pf, idx) => {
                const Icon = getIconComponent(pf.iconKey);
                const subCount = getFilterSubscribersCount(pf.id);
                return (
                  <FadeInUp key={pf.id} index={idx} y={14}>
                    <div
                      draggable
                      onDragStart={() => setDraggedBadgeId(pf.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void handleDropBadgeOn(pf.id)}
                      className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        draggedBadgeId === pf.id ? 'bg-[#fef3c7]/50 opacity-75' : 'hover:bg-[#f7faf8]'
                      } ${!pf.active ? 'opacity-65 bg-[#f7faf8]/80' : ''}`}
                    >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="cursor-grab active:cursor-grabbing text-[#707971] hover:text-[#003820] p-1">
                        <GripVertical size={20} />
                      </div>
                      <span className="w-7 h-7 rounded-lg bg-[#f1f4f2] text-[#003820] text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Live Badge Preview Chip */}
                          <span
                            style={{ backgroundColor: pf.badgeBgColor, color: pf.badgeTextColor }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs"
                          >
                            <Icon size={13} strokeWidth={2.3} />
                            <span>{pf.name}</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              pf.active ? 'bg-[#e6f4ec] text-[#0f5132]' : 'bg-[#e4ece7] text-[#404942]'
                            }`}
                          >
                            {pf.active ? 'ظاهر للجمهور' : 'مخفي'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f1f4f2] text-[#404942] text-[11px] font-semibold tabular-nums">
                            وزن الأولوية: {pf.priorityWeight}
                          </span>
                        </div>
                        <p className="text-xs text-[#404942] flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#003820] tabular-nums">
                            {subCount} مشترك فعّال حالياً
                          </span>
                          {pf.description && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-md">{pf.description}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Controls: Manage Subscribers + Reorder + Toggle + Edit + Delete */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSubscribersModalFilterId(pf.id);
                          setSubscriberSearch('');
                          setSubscriberCatFilter('all');
                          setOnlySubscribed(false);
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        <Users size={15} />
                        <span>إدارة المشتركين ({subCount})</span>
                      </button>

                      <div className="flex items-center bg-[#f1f4f2] rounded-xl p-1 gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => void handleMoveBadge(idx, -1)}
                          className="w-9 h-9 rounded-lg bg-white hover:bg-[#e6f4ec] disabled:opacity-35 text-[#003820] flex items-center justify-center"
                          aria-label="تحريك للأعلى"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sortedPromoFilters.length - 1}
                          onClick={() => void handleMoveBadge(idx, 1)}
                          className="w-9 h-9 rounded-lg bg-white hover:bg-[#e6f4ec] disabled:opacity-35 text-[#003820] flex items-center justify-center"
                          aria-label="تحريك للأسفل"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void savePromoFilter({ ...pf, active: !pf.active })}
                        className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                          pf.active
                            ? 'bg-[#fef3c7] hover:bg-[#fde68a] text-[#735c00]'
                            : 'bg-[#e6f4ec] hover:bg-[#d1fae5] text-[#0f5132]'
                        }`}
                      >
                        {pf.active ? <EyeOff size={15} /> : <Eye size={15} />}
                        <span>{pf.active ? 'إخفاء' : 'تفعيل'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditBadgeModal(pf)}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#f1f4f2] hover:bg-[#e4ece7] text-[#181c1c] text-xs font-bold flex items-center gap-1.5"
                      >
                        <Edit3 size={15} />
                        <span>تعديل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteBadgeTarget(pf)}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#ffdad6]/60 hover:bg-[#ffdad6] text-[#ba1a1a] text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 size={15} />
                        <span>حذف</span>
                      </button>
                    </div>
                    </div>
                  </FadeInUp>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: AREAS MANAGER */}
        {activeTab === 'areas' && (
          <FadeInUp delay={0.03} className="max-w-3xl">
            <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 sm:p-6 shadow-civic-1 space-y-5">
              <div>
                <h2 className="text-base font-bold text-[#003820]">أحياء وقرى مركز أبوحمص</h2>
                <p className="text-xs text-[#404942] mt-1">
                  تظهر هذه القائمة مباشرة في فلاتر البحث، ونموذج إضافة مكان، وطلبات التوصيل والعقارات.
                </p>
              </div>

              <form onSubmit={handleAddArea} className="flex gap-2">
                <input
                  type="text"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="مثال: عزبة الكوم الأخضر، قرية جواد حسني..."
                  className="flex-1 min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] border border-transparent focus:border-[#0f5132] focus:bg-white outline-none text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[46px] px-5 rounded-2xl bg-[#003820] text-white text-sm font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={18} />
                  إضافة
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {areasList.map((area) => (
                  <div
                    key={area}
                    className="px-3.5 py-2 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] flex items-center gap-2 text-xs font-bold text-[#181c1c]"
                  >
                    <MapPin size={14} className="text-[#0f5132]" />
                    <span>{area}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveArea(area)}
                      className="text-[#707971] hover:text-[#ba1a1a] p-0.5"
                      aria-label={`إزالة ${area}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </FadeInUp>
        )}

        {/* TAB 4: REAL ESTATE AUDIT & SMART DEDUPLICATOR */}
        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <FadeInUp delay={0.02} className="lg:col-span-7">
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#003820]">تدقيق إعلانات العقارات ({properties.length})</h2>
                <span className="text-xs text-[#404942]">اعتماد أو إخفاء فوري</span>
              </div>
              <div className="divide-y divide-[#e4ece7]">
                {properties.map((prop) => (
                  <div key={prop.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#181c1c] truncate">{prop.title}</p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            prop.status === 'approved'
                              ? 'bg-[#e6f4ec] text-[#0f5132]'
                              : prop.status === 'pending'
                                ? 'bg-[#fef3c7] text-[#92400e]'
                                : 'bg-[#e4ece7] text-[#404942]'
                          }`}
                        >
                          {prop.status === 'approved' ? 'معتمد ومنشور' : prop.status === 'pending' ? 'قيد التدقيق' : 'تم البيع'}
                        </span>
                      </div>
                      <p className="text-xs text-[#404942] mt-0.5">
                        {prop.area} · {prop.price.toLocaleString('ar-EG')} ج.م · {prop.areaSqm} م²
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {prop.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => void saveProperty({ ...prop, status: 'approved', verified: true })}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#003820] text-white text-xs font-bold"
                        >
                          اعتماد
                        </button>
                      )}
                      {prop.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => void saveProperty({ ...prop, status: 'sold' })}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#f1f4f2] text-[#404942] text-xs font-bold"
                        >
                          تحديد كمُباع
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteProperty(prop.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#ffdad6]/70 text-[#ba1a1a] text-xs font-bold"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.08} className="lg:col-span-5">
              <div className="bg-white border border-[#e4ece7] rounded-3xl p-5 shadow-civic-1 space-y-4">
              <div className="flex items-center gap-2">
                <Copy size={18} className="text-[#0f5132]" />
                <h2 className="text-base font-bold text-[#003820]">كاشف التكرار الذكي للأماكن</h2>
              </div>
              <p className="text-xs text-[#404942] leading-relaxed">
                يفحص تلقائياً أرقام الهواتف المتطابقة بين الأماكن المسجلة لمنع وجود بطاقات مكررة في الدليل.
              </p>

              {duplicateGroups.length === 0 ? (
                <div className="p-5 rounded-2xl bg-[#e6f4ec]/60 border border-[#b7e2c8] text-center space-y-2">
                  <CheckCircle2 size={28} className="mx-auto text-[#0f5132]" />
                  <p className="text-sm font-bold text-[#003820]">قاعدة البيانات نظيفة تماماً</p>
                  <p className="text-xs text-[#0f5132]">لا توجد أرقام هواتف مكررة بين الأماكن الحالية.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {duplicateGroups.map((grp) => (
                    <div key={grp.phone} className="p-3.5 rounded-2xl bg-[#fef3c7]/50 border border-[#f5d061] space-y-2">
                      <p className="text-xs font-bold text-[#735c00]">
                        هاتف مكرر: <span className="font-mono">{grp.phone}</span> ({grp.list.length} سجلات)
                      </p>
                      {grp.list.map((pl) => (
                        <div key={pl.id} className="bg-white rounded-xl p-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#181c1c] truncate">{pl.name}</p>
                            <p className="text-[11px] text-[#707971] truncate">{pl.area}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void deletePlace(pl.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold shrink-0"
                          >
                            حذف المكرر
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </FadeInUp>
          </div>
        )}
      </div>

      {/* ADD / EDIT DYNAMIC CATEGORY MODAL */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#e4ece7] px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#003820]">
                  {editingId ? 'تعديل القسم الحالي' : 'إضافة قسم جديد للدليل'}
                </h2>
                <p className="text-xs text-[#404942]">
                  اختر الأيقونة بالماوس أو اللمس، وحدد الألوان والقالب، وسيظهر فوراً للجمهور.
                </p>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setEditorOpen(false)}
                className="w-10 h-10 rounded-full bg-[#f1f4f2] flex items-center justify-center text-[#181c1c]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-6">
              <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <p className="text-xs font-bold text-[#0f5132]">معاينة حية كما سيظهر في الرئيسية</p>
                  <p className="text-[11px] text-[#404942]">
                    القالب المختار: {TEMPLATE_OPTIONS.find((t) => t.value === templateType)?.label}
                  </p>
                </div>
                <div className="group bg-white border border-[#e4ece7] rounded-3xl px-5 py-4 shadow-civic-1 flex flex-col items-center gap-3 min-w-[140px]">
                  <DynamicCategoryIcon
                    iconKey={iconKey}
                    imageUrl={imageUrl.trim() || undefined}
                    bgColor={bgColor}
                    iconColor={iconColor}
                    size="lg"
                  />
                  <span className="text-xs font-bold text-[#181c1c] text-center">
                    {name.trim() || 'اسم القسم الجديد'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#181c1c]">اسم القسم بالعربي *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingId) setSlug(slugifyAscii(e.target.value, 'cat'));
                    }}
                    placeholder="مثال: مستلزمات رمضان، معامل تحاليل..."
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#181c1c]">المعرّف الإنجليزي للرابط (Slug)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ramadan-offers"
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-mono text-left"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#181c1c]">نوع قالب القسم *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {TEMPLATE_OPTIONS.map((tpl) => {
                    const selected = templateType === tpl.value;
                    return (
                      <button
                        key={tpl.value}
                        type="button"
                        onClick={() => setTemplateType(tpl.value)}
                        className={`p-3 rounded-2xl border text-right transition-all ${
                          selected
                            ? 'bg-[#e6f4ec] border-[#0f5132] ring-1 ring-[#0f5132]'
                            : 'bg-[#f7faf8] border-[#e4ece7] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-[#003820]">{tpl.label}</span>
                          {selected && <Check size={15} className="text-[#0f5132]" />}
                        </div>
                        <p className="text-[11px] text-[#404942] mt-1 leading-relaxed">{tpl.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[#181c1c] flex items-center gap-1.5">
                  <Palette size={15} className="text-[#0f5132]" />
                  ألوان الخلفية والأيقونة
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((preset) => {
                    const activePreset = bgColor === preset.bg && iconColor === preset.icon;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setBgColor(preset.bg);
                          setIconColor(preset.icon);
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                          activePreset ? 'border-[#003820] ring-1 ring-[#003820]' : 'border-[#e4ece7]'
                        }`}
                        style={{ backgroundColor: preset.bg, color: preset.icon }}
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.icon }} />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center justify-between bg-[#f7faf8] border border-[#e4ece7] rounded-2xl px-3.5 py-2.5 text-xs font-semibold">
                    <span>لون الخلفية المخصص</span>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#f7faf8] border border-[#e4ece7] rounded-2xl px-3.5 py-2.5 text-xs font-semibold">
                    <span>لون الأيقونة المخصص</span>
                    <input
                      type="color"
                      value={iconColor}
                      onChange={(e) => setIconColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#181c1c]">مكتبة الأيقونات الجاهزة</label>
                  <div className="relative w-full sm:w-64">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707971]" />
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      placeholder="ابحث في الأيقونات..."
                      className="w-full min-h-[38px] pr-9 pl-3 rounded-xl bg-[#f1f4f2] text-xs outline-none focus:bg-white border border-transparent focus:border-[#0f5132]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-2 rounded-2xl bg-[#f7faf8] border border-[#e4ece7]">
                  {filteredIcons.map((item) => {
                    const Icon = item.icon;
                    const selected = iconKey === item.key && !imageUrl.trim();
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setIconKey(item.key);
                          setImageUrl('');
                        }}
                        className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          selected
                            ? 'bg-[#003820] text-white border-[#003820] shadow-sm'
                            : 'bg-white text-[#181c1c] border-[#e4ece7] hover:border-[#0f5132]'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-[10px] font-semibold text-center leading-tight line-clamp-1">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#181c1c] flex items-center gap-1.5">
                  <ImageIcon size={15} className="text-[#0f5132]" />
                  أو رابط صورة مخصصة بدل الأيقونة (اختياري)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/category-icon.png"
                  className="w-full min-h-[44px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-xs font-mono text-left"
                />
              </div>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#181c1c]">تفعيل وإظهار القسم للجمهور فوراً</p>
                  <p className="text-[11px] text-[#404942]">يمكنك تعطيله مؤقتاً للأقسام الموسمية دون حذف بياناته.</p>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-5 h-5 accent-[#0f5132]"
                />
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e4ece7]">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="min-h-[46px] px-5 rounded-2xl bg-[#f1f4f2] text-[#404942] text-sm font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="min-h-[46px] px-6 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-sm font-bold flex items-center gap-2"
                >
                  <Check size={17} />
                  <span>{savingCat ? 'جارٍ الحفظ...' : editingId ? 'حفظ التعديلات فوراً' : 'إنشاء ونشر القسم'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT DYNAMIC PROMO FILTER (BADGE) MODAL */}
      {badgeEditorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setBadgeEditorOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#e4ece7] px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#003820]">
                  {editingBadgeId ? 'تعديل فلتر / شارة التمييز' : 'إنشاء فلتر وشارة تمييز جديدة'}
                </h2>
                <p className="text-xs text-[#404942]">
                  مثال: «الأكثر تميزاً»، «اشتراك ذهبي VIP»، «موصى به»، «عروض حصرية»
                </p>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setBadgeEditorOpen(false)}
                className="w-10 h-10 rounded-full bg-[#f1f4f2] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePromoFilter} className="p-5 space-y-5">
              {/* Live Badge & Filter Chip Preview */}
              <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <p className="text-xs font-bold text-[#0f5132]">معاينة حية للشارة وزر التصفية للجمهور</p>
                  <p className="text-[11px] text-[#404942]">
                    ستظهر بهذا الشكل على بطاقات المشتركين وفي شريط البحث والأقسام.
                  </p>
                </div>
                <span
                  style={{ backgroundColor: badgeBgColor, color: badgeTextColor }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold shadow-civic-1"
                >
                  <BadgePreviewIcon size={15} strokeWidth={2.3} />
                  <span>{badgeName.trim() || 'الأكثر تميزاً'}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[#181c1c]">اسم الفلتر / الشارة بالعربي *</label>
                  <input
                    type="text"
                    required
                    value={badgeName}
                    onChange={(e) => {
                      setBadgeName(e.target.value);
                      if (!editingBadgeId) setBadgeSlug(slugifyAscii(e.target.value, 'badge'));
                    }}
                    placeholder="مثال: الأكثر تميزاً، اشتراك VIP ذهبي..."
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#181c1c]">وزن الأولوية (الترتيب)</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={badgePriority}
                    onChange={(e) => setBadgePriority(e.target.value)}
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#181c1c]">وصف الباقة للإدارة (اختياري)</label>
                <input
                  type="text"
                  value={badgeDesc}
                  onChange={(e) => setBadgeDesc(e.target.value)}
                  placeholder="مثال: تظهر المنشآت المشتركة بهذه الباقة في أعلى نتائج البحث..."
                  className="w-full min-h-[44px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-xs"
                />
              </div>

              {/* Badge Color Picker */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[#181c1c] flex items-center gap-1.5">
                  <Palette size={15} className="text-[#0f5132]" />
                  ألوان الشارة (Badge Color)
                </label>
                <div className="flex flex-wrap gap-2">
                  {BADGE_COLOR_PRESETS.map((preset) => {
                    const selected = badgeBgColor === preset.bg && badgeTextColor === preset.text;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setBadgeBgColor(preset.bg);
                          setBadgeTextColor(preset.text);
                        }}
                        style={{ backgroundColor: preset.bg, color: preset.text }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          selected ? 'ring-2 ring-[#003820] ring-offset-1' : 'opacity-90 hover:opacity-100'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center justify-between bg-[#f7faf8] border border-[#e4ece7] rounded-2xl px-3.5 py-2.5 text-xs font-semibold">
                    <span>لون خلفية الشارة</span>
                    <input
                      type="color"
                      value={badgeBgColor}
                      onChange={(e) => setBadgeBgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between bg-[#f7faf8] border border-[#e4ece7] rounded-2xl px-3.5 py-2.5 text-xs font-semibold">
                    <span>لون النص والأيقونة</span>
                    <input
                      type="color"
                      value={badgeTextColor}
                      onChange={(e) => setBadgeTextColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Icon Picker for Badge */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#181c1c]">أيقونة الشارة (اختر بالماوس أو اللمس)</label>
                  <div className="relative w-full sm:w-64">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707971]" />
                    <input
                      type="text"
                      value={badgeIconSearch}
                      onChange={(e) => setBadgeIconSearch(e.target.value)}
                      placeholder="ابحث عن أيقونة..."
                      className="w-full min-h-[38px] pr-9 pl-3 rounded-xl bg-[#f1f4f2] text-xs outline-none focus:bg-white border border-transparent focus:border-[#0f5132]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 rounded-2xl bg-[#f7faf8] border border-[#e4ece7]">
                  {filteredBadgeIcons.map((item) => {
                    const Icon = item.icon;
                    const selected = badgeIconKey === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setBadgeIconKey(item.key)}
                        className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                          selected
                            ? 'bg-[#003820] text-white border-[#003820] shadow-sm'
                            : 'bg-white text-[#181c1c] border-[#e4ece7] hover:border-[#0f5132]'
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[10px] font-semibold text-center leading-tight line-clamp-1">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-[#181c1c]">إظهار الفلتر والشارة للجمهور</p>
                  <p className="text-[11px] text-[#404942]">يمكنك إخفاؤه مؤقتاً في أي وقت دون إلغاء اشتراكات العملاء.</p>
                </div>
                <input
                  type="checkbox"
                  checked={badgeActive}
                  onChange={(e) => setBadgeActive(e.target.checked)}
                  className="w-5 h-5 accent-[#0f5132]"
                />
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e4ece7]">
                <button
                  type="button"
                  onClick={() => setBadgeEditorOpen(false)}
                  className="min-h-[46px] px-5 rounded-2xl bg-[#f1f4f2] text-[#404942] text-sm font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingBadge}
                  className="min-h-[46px] px-6 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-sm font-bold flex items-center gap-2"
                >
                  <Check size={17} />
                  <span>{savingBadge ? 'جارٍ الحفظ...' : editingBadgeId ? 'حفظ التعديلات' : 'إنشاء الفلتر فوراً'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK SUBSCRIBERS MANAGER MODAL (1-CLICK ADD/REMOVE PLACES INSIDE A FILTER) */}
      {activeModalFilter && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setSubscribersModalFilterId(null)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white border-b border-[#e4ece7] px-5 py-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      backgroundColor: activeModalFilter.badgeBgColor,
                      color: activeModalFilter.badgeTextColor,
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  >
                    {React.createElement(getIconComponent(activeModalFilter.iconKey), { size: 13 })}
                    <span>{activeModalFilter.name}</span>
                  </span>
                  <span className="text-xs font-bold text-[#0f5132] tabular-nums">
                    ({getFilterSubscribersCount(activeModalFilter.id)} مشترك نشط)
                  </span>
                </div>
                <p className="text-xs text-[#404942]">
                  أضف أو أزل أي مكان/دكتور/مطعم من هذه الباقة بضغطة زر مع إمكانية تحديد تاريخ انتهاء الاشتراك.
                </p>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setSubscribersModalFilterId(null)}
                className="w-10 h-10 rounded-full bg-[#f1f4f2] flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter controls inside modal */}
            <div className="p-4 bg-[#f7faf8] border-b border-[#e4ece7] flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#707971]" />
                <input
                  type="text"
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  placeholder="ابحث باسم الطبيب، المطعم، المحل، أو الهاتف..."
                  className="w-full min-h-[42px] pr-10 pl-3 rounded-2xl bg-white border border-[#e4ece7] text-xs outline-none focus:border-[#0f5132]"
                />
              </div>
              <select
                value={subscriberCatFilter}
                onChange={(e) => setSubscriberCatFilter(e.target.value)}
                className="min-h-[42px] px-3 rounded-2xl bg-white border border-[#e4ece7] text-xs font-semibold outline-none"
              >
                <option value="all">كل الأقسام</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOnlySubscribed((v) => !v)}
                className={`min-h-[42px] px-3.5 rounded-2xl text-xs font-bold whitespace-nowrap ${
                  onlySubscribed
                    ? 'bg-[#003820] text-white'
                    : 'bg-white border border-[#e4ece7] text-[#404942]'
                }`}
              >
                المشتركون فقط
              </button>
            </div>

            {/* Places List with 1-click toggle & optional Expiry Date */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#e4ece7]">
              {modalPlaces.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#707971]">لا توجد أماكن مطابقة للبحث</div>
              ) : (
                modalPlaces.map((pl) => {
                  const isIn = (pl.filterTags || []).includes(activeModalFilter.id);
                  const expiry = pl.filterExpirations?.[activeModalFilter.id] || '';
                  const isExpired = Boolean(expiry && expiry < todayISO);
                  return (
                    <div
                      key={pl.id}
                      className={`p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isIn ? 'bg-[#e6f4ec]/35' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CivicImage src={pl.imageUrl} alt={pl.name} className="w-12 h-12 rounded-2xl shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-[#181c1c] truncate">{pl.name}</p>
                            {isIn && isExpired && (
                              <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] text-[10px] font-bold">
                                اشتراك منتهي
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#404942] truncate">
                            {pl.specialty || pl.area} · {pl.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                        {isIn && (
                          <label className="flex items-center gap-1.5 bg-white border border-[#e4ece7] rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-[#404942]">
                            <Calendar size={13} className="text-[#0f5132]" />
                            <span>انتهاء:</span>
                            <input
                              type="date"
                              dir="ltr"
                              value={expiry}
                              onChange={(e) =>
                                void setPlaceFilterExpiry(pl.id, activeModalFilter.id, e.target.value)
                              }
                              className="bg-transparent outline-none text-[11px] font-mono text-[#003820]"
                            />
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() => void togglePlacePromoFilter(pl.id, activeModalFilter.id)}
                          className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                            isIn
                              ? 'bg-[#ffdad6] hover:bg-[#ffb4ab] text-[#93000a]'
                              : 'bg-[#003820] hover:bg-[#0f5132] text-white'
                          }`}
                        >
                          {isIn ? (
                            <>
                              <X size={14} /> إزالة من الفلتر
                            </>
                          ) : (
                            <>
                              <Plus size={14} /> إضافة للفلتر
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SAFE DELETE CATEGORY MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#181c1c]">حذف قسم «{deleteTarget.name}»</h3>
              {targetPlaceCount > 0 ? (
                <div className="p-3.5 rounded-2xl bg-[#ffdad6]/50 border border-[#ffb4ab] text-xs text-[#93000a] leading-relaxed space-y-1">
                  <p className="font-bold">تنبيه هام: يوجد حالياً ({targetPlaceCount}) مكان مسجل داخل هذا القسم!</p>
                  <p>
                    ننصح بشدة باستخدام زر «إخفاء القسم مؤقتاً» للحفاظ على جميع بيانات المحلات بأمان دون مسحها.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#404942] leading-relaxed">
                  هذا القسم فارغ حالياً (0 أماكن مسجلة). هل أنت متأكد من حذفه نهائياً؟
                </p>
              )}
            </div>

            {targetPlaceCount > 0 && (
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] cursor-pointer text-xs font-semibold text-[#181c1c]">
                <input
                  type="checkbox"
                  checked={forceDeleteConfirm}
                  onChange={(e) => setForceDeleteConfirm(e.target.checked)}
                  className="w-4 h-4 accent-[#ba1a1a]"
                />
                <span>أفهم التحذير وأرغب في الحذف النهائي رغم وجود أماكن</span>
              </label>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {targetPlaceCount > 0 && deleteTarget.active && (
                <button
                  type="button"
                  onClick={async () => {
                    await saveCategory({ ...deleteTarget, active: false });
                    setDeleteTarget(null);
                  }}
                  className="w-full min-h-[46px] rounded-2xl bg-[#003820] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
                >
                  <EyeOff size={16} /> إخفاء القسم مؤقتاً بدلاً من الحذف (موصى به)
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="min-h-[44px] rounded-2xl bg-[#f1f4f2] text-[#404942] text-xs font-bold"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  disabled={targetPlaceCount > 0 && !forceDeleteConfirm}
                  onClick={async () => {
                    await deleteCategory(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  className="min-h-[44px] rounded-2xl bg-[#ba1a1a] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={15} /> حذف نهائي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAFE DELETE PROMO FILTER MODAL */}
      {deleteBadgeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteBadgeTarget(null)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#181c1c]">
                حذف فلتر التمييز «{deleteBadgeTarget.name}»
              </h3>
              {targetBadgeSubCount > 0 ? (
                <p className="text-xs text-[#93000a] bg-[#ffdad6]/50 p-3 rounded-2xl leading-relaxed">
                  يوجد حالياً <strong>({targetBadgeSubCount})</strong> مكان مرتبط بهذا الفلتر. يمكنك إخفاء الفلتر مؤقتاً أو حذفه نهائياً (لن يتم مسح الأماكن نفسها).
                </p>
              ) : (
                <p className="text-xs text-[#404942]">هل أنت متأكد من حذف هذا الفلتر نهائياً؟</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {deleteBadgeTarget.active && (
                <button
                  type="button"
                  onClick={async () => {
                    await savePromoFilter({ ...deleteBadgeTarget, active: false });
                    setDeleteBadgeTarget(null);
                  }}
                  className="w-full min-h-[44px] rounded-2xl bg-[#003820] text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <EyeOff size={15} /> إخفاء الفلتر مؤقتاً بدلاً من الحذف
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteBadgeTarget(null)}
                  className="min-h-[42px] rounded-2xl bg-[#f1f4f2] text-xs font-bold"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deletePromoFilter(deleteBadgeTarget.id);
                    setDeleteBadgeTarget(null);
                  }}
                  className="min-h-[42px] rounded-2xl bg-[#ba1a1a] text-white text-xs font-bold"
                >
                  حذف نهائي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CATEGORY OR OFFERS FILTER MODAL */}
      {catFilterModalOpen && (isOffersScopeSelected || selectedFilterCategory) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCatFilterModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#e4ece7] px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base font-bold text-[#003820]">
                  {editingCatFilterId ? 'تعديل الفلتر' : `إضافة فلتر جديد لـ «${selectedScopeDisplayName}»`}
                </h3>
                <p className="text-[11px] text-[#404942]">
                  يُحفظ الفلتر في Firestore ويظهر فوراً في شريط الفلاتر
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCatFilterModalOpen(false)}
                className="w-9 h-9 rounded-full bg-[#f1f4f2] text-[#404942] flex items-center justify-center"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCatFilter} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#181c1c]">
                  اسم الفلتر الظاهر للمستخدم *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={cfLabel}
                  onChange={(e) => setCfLabel(e.target.value)}
                  placeholder="مثال: أطفال، مشويات، توصيل متاح، 24 ساعة..."
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#181c1c]">
                  الحقل الذي يطابقه الفلتر (matchField) *
                </label>
                <select
                  value={cfMatchField}
                  onChange={(e) => {
                    const nextField = e.target.value as CategoryFilterMatchField;
                    setCfMatchField(nextField);
                    if (isBooleanMatchField(nextField)) {
                      setCfMatchValue('true');
                      if (!cfLabel.trim()) {
                        setCfLabel(nextField === 'hasDelivery' ? 'توصيل متاح' : '24 ساعة');
                      }
                    } else if (cfMatchValue === 'true') {
                      setCfMatchValue('');
                    }
                  }}
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm font-semibold"
                >
                  {MATCH_FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#707971]">
                  {MATCH_FIELD_OPTIONS.find((o) => o.value === cfMatchField)?.description}
                </p>
              </div>

              {!isBooleanMatchField(cfMatchField) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#181c1c]">
                    القيمة المطابقة في البطاقة (matchValue)
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={cfMatchValue}
                    onChange={(e) => setCfMatchValue(e.target.value)}
                    placeholder={
                      MATCH_FIELD_OPTIONS.find((o) => o.value === cfMatchField)?.placeholder ||
                      'اتركه فارغاً لاستخدام نفس اسم الفلتر تلقائياً'
                    }
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-[#f1f4f2] focus:bg-white border border-transparent focus:border-[#0f5132] outline-none text-sm"
                  />
                  <p className="text-[11px] text-[#707971]">
                    إن تركت هذا الحقل فارغاً، سيُطابق الفلتر نفس قيمة «اسم الفلتر» تلقائياً مع تجاهل الهمزات والتشكيل.
                  </p>

                  {suggestedMatchValues.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-bold text-[#0f5132]">
                        قيم مقترحة حالياً (اضغط للاختيار):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedMatchValues.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setCfMatchValue(val);
                              if (!cfLabel.trim()) {
                                setCfLabel(val.length > 26 ? val.slice(0, 26).trim() : val);
                              }
                            }}
                            className="px-2.5 py-1 rounded-xl bg-[#e6f4ec] hover:bg-[#d1fae5] text-[#003820] text-[11px] font-semibold"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Match Preview */}
              {cfLabel.trim().length >= 2 && (
                <div className="p-3.5 rounded-2xl bg-[#f7faf8] border border-[#d7ebe0] flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#404942]">معاينة المطابقة الحالية:</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#003820] text-[#9ff1bd] text-xs font-bold tabular-nums">
                    يطابق{' '}
                    {countMatchesForCatFilter({
                      id: '_preview',
                      label: cfLabel.trim(),
                      matchField: cfMatchField,
                      matchValue: isBooleanMatchField(cfMatchField)
                        ? 'true'
                        : cfMatchValue.trim() || cfLabel.trim(),
                      order: 1,
                      enabled: true,
                    })}{' '}
                    {isOffersScopeSelected ? 'عرض' : 'بطاقة'} في «{selectedScopeDisplayName}»
                  </span>
                </div>
              )}

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#f7faf8] border border-[#e4ece7] cursor-pointer text-xs font-bold text-[#181c1c]">
                <input
                  type="checkbox"
                  checked={cfEnabled}
                  onChange={(e) => setCfEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#0f5132]"
                />
                <span>مفعّل وظاهر فوراً للمستخدمين في شريط الفلاتر</span>
              </label>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCatFilterModalOpen(false)}
                  className="min-h-[46px] rounded-2xl bg-[#f1f4f2] text-[#404942] text-sm font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingCatFilter}
                  className="min-h-[46px] rounded-2xl bg-[#003820] hover:bg-[#0f5132] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5"
                >
                  <Check size={16} />
                  {savingCatFilter ? 'جارٍ الحفظ...' : editingCatFilterId ? 'حفظ التعديلات' : 'إضافة الفلتر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY OR OFFERS FILTER CONFIRMATION MODAL */}
      {deleteCatFilterTarget && (isOffersScopeSelected || selectedFilterCategory) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#003820]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteCatFilterTarget(null)}
        >
          <div
            className="bg-white rounded-3xl border border-[#e4ece7] max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#181c1c]">
                حذف فلتر «{deleteCatFilterTarget.label}»
              </h3>
              <p className="text-xs text-[#404942] leading-relaxed">
                هل أنت متأكد من حذف هذا الفلتر من «{selectedScopeDisplayName}»؟ لن يتم حذف أي عروض أو بطاقات، ويمكنك إخفاء الفلتر مؤقتاً بدلاً من حذفه.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteCatFilterTarget(null)}
                className="min-h-[44px] rounded-2xl bg-[#f1f4f2] text-[#404942] text-xs font-bold"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteCatFilter()}
                className="min-h-[44px] rounded-2xl bg-[#ba1a1a] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Trash2 size={15} /> تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};
