import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  logFirestoreListenerError,
  loginWithGoogle,
  logoutUser,
  OperationType,
} from '../firebase';
import { generateSecureToken, validateEgyptPhone, validateImageUrl } from '../lib/formatters';
import { buildPlaceMenuPriceMap, computeAuthoritativeOrder } from '../lib/orderPricing';
import { getCairoDateString } from '../lib/workingHours';
import { isOfflineCatalogFresh, readOfflineCatalog, writeOfflineCatalog } from '../lib/offlineCache';
import { appendActivityHistory, saveCitizenProfile } from '../lib/citizenProfile';
import {
  SEED_AGENCIES,
  SEED_CAMPAIGNS,
  SEED_CATEGORIES,
  SEED_CLINIC_QUEUES,
  SEED_EMERGENCY,
  SEED_FINANCE_CONFIG,
  SEED_OFFERS,
  SEED_PLACES,
  SEED_PROMO_FILTERS,
  SEED_PROPERTIES,
  SEED_SETTINGS,
} from '../data/seedData';
import type {
  ActiveTracker,
  AdminRole,
  AdminUser,
  Agency,
  AnalyticsEvent,
  Campaign,
  CartItem,
  Category,
  ClinicQueue,
  ClinicTicket,
  DeliveryCoords,
  DeliveryRide,
  EmergencyContact,
  FinanceConfig,
  FinanceSettlement,
  Offer,
  PartnerScope,
  Place,
  PromoFilter,
  Property,
  PublicSettings,
  RestaurantOrder,
  Submission,
  WhatsappQueueItem,
} from '../types';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

const CORRECTION_ALLOWLIST = new Set([
  'name',
  'phone',
  'whatsapp',
  'hours',
  'address',
  'area',
  'specialty',
  'description',
]);

function generateSafeId(prefix: string): string {
  return generateSecureToken(prefix, 20);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Public catalog fetch bounds. Each one-time `getDocs` query is capped (and ordered by
// priority/recency) so the client never fetches an unbounded full collection, which
// both reduces bandwidth/read cost and keeps the TTL offline cache lightweight.
const PUBLIC_CATALOG_LIMITS = {
  categories: 100,
  promoFilters: 100,
  places: 300,
  properties: 300,
  agencies: 200,
  offers: 300,
  campaigns: 50,
  emergencyContacts: 50,
} as const;

function mapFirebaseAuthErrorToArabic(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
  if (code === 'auth/popup-blocked') {
    return 'المتصفح منع نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة (Popups) لهذا الموقع والمحاولة مرة أخرى.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية. يمكنك المحاولة مرة أخرى.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'نطاق الموقع الحالي غير مضاف في قائمة النطاقات المصرح بها في Firebase Authentication (Authorized Domains).';
  }
  if (code === 'auth/network-request-failed') {
    return 'تعذر الاتصال بخدمة المصادقة بسبب مشكلة في الإنترنت. تحقق من الشبكة وحاول مجدداً.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'تسجيل الدخول عبر Google غير مفعّل في إعدادات Firebase Authentication لهذا المشروع.';
  }
  const msg = err instanceof Error ? err.message : '';
  return msg
    ? `تعذر إتمام تسجيل الدخول عبر Google (${code || msg}).`
    : 'تعذر إتمام تسجيل الدخول عبر Google. حاول مرة أخرى.';
}

interface AppContextValue {
  // Auth & RBAC
  user: User | null;
  authReady: boolean;
  adminRole: AdminRole | null;
  adminProfile: AdminUser | null;
  isAdmin: boolean;
  isAdminWriter: boolean;
  isAuditor: boolean;
  isSuperAdmin: boolean;
  isPartner: boolean;
  partnerScopes: PartnerScope[];
  managedPlaceIds: string[];
  canAccessPartnerScope: (scope: PartnerScope) => boolean;
  canManagePlace: (placeId: string, scope: 'clinic' | 'restaurant') => boolean;
  signInError: string | null;
  clearSignInError: () => void;
  signInAdmin: () => Promise<boolean>;
  signOutAdmin: () => Promise<void>;

  // Admin Team Management (Super Admin only)
  adminsList: AdminUser[];
  saveAdminUser: (record: AdminUser) => Promise<void>;
  deleteAdminUser: (uid: string) => Promise<void>;

  // Catalog (TTL cache-first: offline snapshot hydration, one-time getDocs on expiry)
  categories: Category[];
  activeCategories: Category[];
  promoFilters: PromoFilter[];
  activePromoFilters: PromoFilter[];
  places: Place[];
  properties: Property[];
  agencies: Agency[];
  offers: Offer[];
  campaigns: Campaign[];
  emergencyContacts: EmergencyContact[];
  settings: PublicSettings;
  isCloudSeeded: boolean;
  isDemoPreviewMode: boolean;
  refreshCatalog: () => void;

  // Live Operational & Admin Streams (role/tenant scoped + server-ordered)
  clinicTickets: ClinicTicket[];
  restaurantOrders: RestaurantOrder[];
  deliveryRides: DeliveryRide[];
  submissions: Submission[];
  whatsappQueue: WhatsappQueueItem[];
  financeConfig: FinanceConfig;
  financeSettlements: FinanceSettlement[];
  analyticsEvents: AnalyticsEvent[];

  // Pagination controls
  hasMoreClinicTickets: boolean;
  loadMoreClinicTickets: () => void;
  hasMoreOrders: boolean;
  loadMoreOrders: () => void;
  hasMoreRides: boolean;
  loadMoreRides: () => void;
  hasMoreSubmissions: boolean;
  loadMoreSubmissions: () => void;
  hasMoreAnalytics: boolean;
  analyticsSampleLimit: number;
  loadMoreAnalytics: () => void;

  // Local Citizen State
  favorites: string[];
  toggleFavorite: (placeId: string) => void;
  cart: { restaurantId: string | null; items: CartItem[] };
  addToCart: (restaurantId: string, item: Omit<CartItem, 'quantity'>) => void;
  updateCartQty: (menuItemId: string, delta: number) => void;
  clearCart: () => void;
  activeTracker: ActiveTracker | null;
  setActiveTracker: (tracker: ActiveTracker | null) => void;

  // Toasts
  toasts: ToastMessage[];
  showToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  // Citizen Actions (Live Firestore writes, Zero-Login)
  bookClinicTicket: (input: {
    doctorId: string;
    doctorName: string;
    patientName: string;
    patientPhone: string;
    visitType: string;
    fee: number;
    notes?: string;
  }) => Promise<ClinicTicket>;
  placeRestaurantOrder: (input: {
    restaurantId: string;
    restaurantName: string;
    customerName: string;
    customerPhone: string;
    deliveryArea: string;
    deliveryAddress: string;
    locationShared: boolean;
    deliveryCoords?: DeliveryCoords;
    items: CartItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    notes?: string;
  }) => Promise<RestaurantOrder>;
  createDeliveryRide: (input: {
    pickupArea: string;
    pickupDetails: string;
    dropoffArea: string;
    dropoffDetails: string;
    itemDescription: string;
    customerName: string;
    customerPhone: string;
    estimatedFee: number;
  }) => Promise<DeliveryRide>;
  createSubmission: (input: {
    type: Submission['type'];
    title: string;
    submitterName: string;
    submitterPhone: string;
    targetPlaceId?: string;
    payload?: Record<string, string | number | boolean>;
    previousData?: Record<string, string | number | boolean>;
  }) => Promise<Submission>;
  logAnalyticsEvent: (event: Omit<AnalyticsEvent, 'createdAt'>) => Promise<void>;

  // Partner Operational Console Mutations (Atomic + Isolated)
  updateClinicQueueState: (doctorId: string, patch: Partial<ClinicQueue>) => Promise<void>;
  callNextClinicTicket: (doctorId: string) => Promise<ClinicTicket | null>;
  resetClinicDaySession: (doctorId: string) => Promise<void>;
  updateClinicTicketStatus: (ticketId: string, status: ClinicTicket['status']) => Promise<void>;
  claimRestaurantOrder: (orderId: string, captainName: string, captainPhone: string) => Promise<boolean>;
  updateRestaurantOrderStatus: (
    orderId: string,
    patch: Partial<Pick<RestaurantOrder, 'status' | 'captainName' | 'captainPhone'>>
  ) => Promise<void>;
  claimDeliveryRide: (rideId: string, captainName: string, captainPhone: string) => Promise<boolean>;
  updateDeliveryRideStatus: (
    rideId: string,
    patch: Partial<Pick<DeliveryRide, 'status' | 'captainName' | 'captainPhone'>>
  ) => Promise<void>;

  // Admin Mutations (Live Firestore — 100% Dynamic)
  seedCloudDatabase: (includeDemoCatalog?: boolean) => Promise<void>;
  initializeEssentialConfig: () => Promise<void>;
  seedDemoCatalog: () => Promise<void>;
  migrateRestaurantMenuPriceMaps: () => Promise<number>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
  savePromoFilter: (filter: PromoFilter) => Promise<void>;
  deletePromoFilter: (filterId: string) => Promise<void>;
  reorderPromoFilters: (orderedIds: string[]) => Promise<void>;
  togglePlacePromoFilter: (placeId: string, filterId: string, expiresAt?: string) => Promise<void>;
  setPlaceFilterExpiry: (placeId: string, filterId: string, expiresAt: string) => Promise<void>;
  savePlace: (place: Place) => Promise<void>;
  deletePlace: (placeId: string) => Promise<void>;
  saveProperty: (property: Property) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  saveOffer: (offer: Offer) => Promise<void>;
  saveCampaign: (campaign: Campaign) => Promise<void>;
  updateSubmissionStatus: (
    submissionId: string,
    status: Submission['status'],
    adminNote?: string
  ) => Promise<void>;
  applyCorrectionSubmission: (submissionId: string, adminNote?: string) => Promise<boolean>;
  publishSubmissionAsPlace: (submissionId: string, place: Place, adminNote?: string) => Promise<boolean>;
  publishSubmissionAsProperty: (submissionId: string, property: Property, adminNote?: string) => Promise<boolean>;
  saveWhatsappQueueItem: (item: WhatsappQueueItem) => Promise<void>;
  updateWhatsappStatus: (itemId: string, status: WhatsappQueueItem['status']) => Promise<void>;
  saveFinanceConfig: (config: FinanceConfig) => Promise<void>;
  closeNewSettlement: (settlement: FinanceSettlement) => Promise<void>;
  savePublicSettings: (settings: PublicSettings) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);

  const adminRole: AdminRole | null = adminProfile && adminProfile.active !== false ? adminProfile.role : null;
  const isSuperAdmin = adminRole === 'super_admin';
  const isAuditor = adminRole === 'auditor';
  const isAdminWriter = adminRole === 'super_admin' || adminRole === 'moderator';
  const isAdmin = adminRole === 'super_admin' || adminRole === 'moderator' || adminRole === 'auditor';
  const isPartner = isAdmin || adminRole === 'partner';

  const partnerScopes: PartnerScope[] = useMemo(() => {
    if (isAdmin) return ['clinic', 'restaurant', 'captain'];
    if (adminRole === 'partner' && Array.isArray(adminProfile?.partnerTypes)) {
      return adminProfile.partnerTypes;
    }
    return [];
  }, [isAdmin, adminRole, adminProfile]);

  const managedPlaceIds: string[] = useMemo(() => {
    if (adminRole === 'partner' && Array.isArray(adminProfile?.managedPlaceIds)) {
      return adminProfile.managedPlaceIds;
    }
    return [];
  }, [adminRole, adminProfile]);

  const canAccessPartnerScope = useCallback(
    (scope: PartnerScope) => {
      if (isAdmin) return true;
      return adminRole === 'partner' && partnerScopes.includes(scope);
    },
    [isAdmin, adminRole, partnerScopes]
  );

  const canManagePlace = useCallback(
    (placeId: string, scope: 'clinic' | 'restaurant') => {
      if (isAdminWriter) return true;
      if (isAuditor) return false;
      return adminRole === 'partner' && partnerScopes.includes(scope) && managedPlaceIds.includes(placeId);
    },
    [isAdminWriter, isAuditor, adminRole, partnerScopes, managedPlaceIds]
  );

  // Hydrate previously loaded public directory from device cache for instant offline browsing
  const catalogCache = useMemo(() => readOfflineCatalog(), []);

  // Cloud state
  const [cloudCategories, setCloudCategories] = useState<Category[] | null>(
    () => (catalogCache?.categories?.length ? catalogCache.categories : null)
  );
  const [cloudPromoFilters, setCloudPromoFilters] = useState<PromoFilter[] | null>(
    () => (catalogCache?.promoFilters ? catalogCache.promoFilters : null)
  );
  const [cloudPlaces, setCloudPlaces] = useState<Place[] | null>(
    () => (catalogCache?.places ? catalogCache.places : null)
  );
  const [cloudProperties, setCloudProperties] = useState<Property[] | null>(
    () => (catalogCache?.properties ? catalogCache.properties : null)
  );
  const [cloudAgencies, setCloudAgencies] = useState<Agency[] | null>(
    () => (catalogCache?.agencies ? catalogCache.agencies : null)
  );
  const [cloudOffers, setCloudOffers] = useState<Offer[] | null>(
    () => (catalogCache?.offers ? catalogCache.offers : null)
  );
  const [cloudCampaigns, setCloudCampaigns] = useState<Campaign[] | null>(
    () => (catalogCache?.campaigns ? catalogCache.campaigns : null)
  );
  const [cloudEmergency, setCloudEmergency] = useState<EmergencyContact[] | null>(
    () => (catalogCache?.emergencyContacts ? catalogCache.emergencyContacts : null)
  );
  const [cloudSettings, setCloudSettings] = useState<PublicSettings | null>(
    () => (catalogCache?.settings ? catalogCache.settings : null)
  );

  // Operational & Admin collections with server-ordered pagination limits
  const [clinicTickets, setClinicTickets] = useState<ClinicTicket[]>([]);
  const [clinicTicketsLimit, setClinicTicketsLimit] = useState(50);
  const [hasMoreClinicTickets, setHasMoreClinicTickets] = useState(false);

  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrder[]>([]);
  const [ordersLimit, setOrdersLimit] = useState(50);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);

  const [deliveryRides, setDeliveryRides] = useState<DeliveryRide[]>([]);
  const [ridesLimit, setRidesLimit] = useState(50);
  const [hasMoreRides, setHasMoreRides] = useState(false);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLimit, setSubmissionsLimit] = useState(50);
  const [hasMoreSubmissions, setHasMoreSubmissions] = useState(false);

  const [whatsappQueue, setWhatsappQueue] = useState<WhatsappQueueItem[]>([]);
  const [financeConfig, setFinanceConfig] = useState<FinanceConfig>(SEED_FINANCE_CONFIG);
  const [financeSettlements, setFinanceSettlements] = useState<FinanceSettlement[]>([]);

  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [analyticsSampleLimit, setAnalyticsSampleLimit] = useState(200);
  const [hasMoreAnalytics, setHasMoreAnalytics] = useState(false);

  // Local citizen persistence
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('abh_favorites') || '[]');
    } catch {
      return [];
    }
  });
  const [cart, setCart] = useState<{ restaurantId: string | null; items: CartItem[] }>(() => {
    try {
      return JSON.parse(localStorage.getItem('abh_cart') || '{"restaurantId":null,"items":[]}');
    } catch {
      return { restaurantId: null, items: [] };
    }
  });
  const [activeTracker, setActiveTrackerState] = useState<ActiveTracker | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('abh_active_tracker') || 'null');
    } catch {
      return null;
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearSignInError = useCallback(() => setSignInError(null), []);

  const setActiveTracker = useCallback((tracker: ActiveTracker | null) => {
    setActiveTrackerState(tracker);
    try {
      if (tracker) localStorage.setItem('abh_active_tracker', JSON.stringify(tracker));
      else localStorage.removeItem('abh_active_tracker');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Auth listener with full RBAC & partner scope lookup
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setAdminProfile(null);
        setAuthReady(true);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        if (adminSnap.exists()) {
          const raw = adminSnap.data() as Partial<AdminUser>;
          const role = raw.role;
          if (
            raw.active !== false &&
            (role === 'super_admin' || role === 'partner' || role === 'moderator' || role === 'auditor')
          ) {
            setAdminProfile({
              uid: firebaseUser.uid,
              email: raw.email || firebaseUser.email || '',
              name: raw.name || firebaseUser.displayName || '',
              role,
              partnerTypes: Array.isArray(raw.partnerTypes) ? raw.partnerTypes : [],
              managedPlaceIds: Array.isArray(raw.managedPlaceIds) ? raw.managedPlaceIds : [],
              active: raw.active ?? true,
              createdAt: raw.createdAt,
              updatedAt: raw.updatedAt,
            });
          } else {
            setAdminProfile(null);
          }
        } else {
          setAdminProfile(null);
        }
      } catch {
        setAdminProfile(null);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Super Admin team/partners registry subscription
  useEffect(() => {
    if (!authReady || !isSuperAdmin) {
      setAdminsList([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as AdminUser), uid: d.id }));
        list.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
        setAdminsList(list);
      },
      (error) => logFirestoreListenerError(error, OperationType.LIST, 'admins')
    );
    return () => unsub();
  }, [authReady, isSuperAdmin]);

  // Public civic catalog: cache-first TTL strategy.
  // On load, hydrate state from the offline snapshot when it is still fresh
  // (Date.now() - cachedAt < CATALOG_CACHE_TTL_MS) and skip the network getDocs
  // calls entirely. The network is only hit when the cache is missing/expired, or
  // when refreshCatalog() is called after an admin/partner mutation. This keeps
  // Firestore read consumption (and Spark free-tier bills) minimal while all
  // citizen features keep working from the cached catalog.
  const catalogCacheFresh = useMemo(() => isOfflineCatalogFresh(catalogCache), [catalogCache]);

  const loadCatalogFromFirestore = useCallback(async () => {
    try {
      const [categoriesSnap, promoFiltersSnap, placesSnap, propertiesSnap, agenciesSnap, offersSnap, campaignsSnap, emergencySnap, settingsSnap] =
        await Promise.all([
          getDocs(
            query(
              collection(db, 'categories'),
              orderBy('order', 'asc'),
              limit(PUBLIC_CATALOG_LIMITS.categories)
            )
          ),
          getDocs(
            query(
              collection(db, 'promo_filters'),
              orderBy('order', 'asc'),
              limit(PUBLIC_CATALOG_LIMITS.promoFilters)
            )
          ),
          getDocs(
            query(
              collection(db, 'places'),
              orderBy('createdAt', 'desc'),
              limit(PUBLIC_CATALOG_LIMITS.places)
            )
          ),
          getDocs(
            query(
              collection(db, 'properties'),
              orderBy('createdAt', 'desc'),
              limit(PUBLIC_CATALOG_LIMITS.properties)
            )
          ),
          getDocs(query(collection(db, 'agencies'), limit(PUBLIC_CATALOG_LIMITS.agencies))),
          getDocs(
            query(
              collection(db, 'offers'),
              orderBy('expiresAt', 'desc'),
              limit(PUBLIC_CATALOG_LIMITS.offers)
            )
          ),
          getDocs(
            query(
              collection(db, 'campaigns'),
              orderBy('slotNumber', 'asc'),
              limit(PUBLIC_CATALOG_LIMITS.campaigns)
            )
          ),
          getDocs(
            query(
              collection(db, 'emergency_contacts'),
              orderBy('priority', 'asc'),
              limit(PUBLIC_CATALOG_LIMITS.emergencyContacts)
            )
          ),
          getDoc(doc(db, 'public_settings', 'main')),
        ]);

      const categories = categoriesSnap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
      categories.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      setCloudCategories(categories);

      const promoFilters = promoFiltersSnap.docs.map((d) => ({
        ...(d.data() as PromoFilter),
        id: d.id,
      }));
      promoFilters.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      setCloudPromoFilters(promoFilters);

      setCloudPlaces(placesSnap.docs.map((d) => ({ ...(d.data() as Place), id: d.id })));
      setCloudProperties(propertiesSnap.docs.map((d) => ({ ...(d.data() as Property), id: d.id })));
      setCloudAgencies(agenciesSnap.docs.map((d) => ({ ...(d.data() as Agency), id: d.id })));
      setCloudOffers(offersSnap.docs.map((d) => ({ ...(d.data() as Offer), id: d.id })));

      const campaigns = campaignsSnap.docs.map((d) => ({ ...(d.data() as Campaign), id: d.id }));
      campaigns.sort((a, b) => a.slotNumber - b.slotNumber);
      setCloudCampaigns(campaigns);

      const emergencyContacts = emergencySnap.docs.map((d) => ({
        ...(d.data() as EmergencyContact),
        id: d.id,
      }));
      emergencyContacts.sort((a, b) => a.priority - b.priority);
      setCloudEmergency(emergencyContacts);

      if (settingsSnap.exists()) {
        setCloudSettings(settingsSnap.data() as PublicSettings);
      }

      writeOfflineCatalog({
        categories,
        promoFilters,
        places: placesSnap.docs.map((d) => ({ ...(d.data() as Place), id: d.id })),
        properties: propertiesSnap.docs.map((d) => ({ ...(d.data() as Property), id: d.id })),
        agencies: agenciesSnap.docs.map((d) => ({ ...(d.data() as Agency), id: d.id })),
        offers: offersSnap.docs.map((d) => ({ ...(d.data() as Offer), id: d.id })),
        campaigns,
        emergencyContacts,
      });
    } catch (error) {
      // Non-blocking: keep the hydrated cache (or seed fallback) visible.
      handleFirestoreError(error, OperationType.GET, 'catalog load');
    }
  }, []);

  // Skip the network entirely while the TTL cache is still fresh.
  useEffect(() => {
    if (catalogCacheFresh) return;
    void loadCatalogFromFirestore();
  }, [catalogCacheFresh, loadCatalogFromFirestore]);

  // Manual refresh after admin/partner save/delete actions so editors see their
  // updates immediately instead of waiting for the TTL to expire.
  const refreshCatalog = useCallback(() => {
    void loadCatalogFromFirestore();
  }, [loadCatalogFromFirestore]);

  // Tenant-Isolated & Server-Ordered Clinic Tickets Stream
  useEffect(() => {
    if (!authReady || (!isAdmin && !canAccessPartnerScope('clinic'))) {
      setClinicTickets([]);
      setHasMoreClinicTickets(false);
      return;
    }

    if (!isAdmin && managedPlaceIds.length === 0) {
      setClinicTickets([]);
      setHasMoreClinicTickets(false);
      return;
    }

    const unsubs: Array<() => void> = [];
    const buckets = new Map<string, ClinicTicket[]>();
    const streamHasMore = new Map<string, boolean>();

    const syncMerged = () => {
      const merged = new Map<string, ClinicTicket>();
      buckets.forEach((arr) => arr.forEach((item) => merged.set(item.id, item)));
      const sorted = Array.from(merged.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      setClinicTickets(sorted);
      setHasMoreClinicTickets(Array.from(streamHasMore.values()).some(Boolean));
    };

    const mapTickets = (snap: { docs: Array<{ id: string; data: () => unknown }> }): ClinicTicket[] =>
      snap.docs.map((d) => {
        const raw = d.data() as ClinicTicket;
        return {
          ...raw,
          id: d.id,
          sessionDate: raw.sessionDate || (raw.createdAt || '').slice(0, 10) || getCairoDateString(),
        };
      });

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'clinic_tickets'), orderBy('createdAt', 'desc'), limit(clinicTicketsLimit)),
          (snap) => {
            buckets.set('admin', mapTickets(snap));
            streamHasMore.set('admin', snap.docs.length >= clinicTicketsLimit);
            syncMerged();
          },
          (error) => logFirestoreListenerError(error, OperationType.LIST, 'clinic_tickets')
        )
      );
    } else {
      // One equality-filtered listener per assigned clinic guarantees Firestore Rules provability
      // against `resource.data.doctorId in get(admins/$(uid)).data.managedPlaceIds`.
      for (const placeId of managedPlaceIds) {
        unsubs.push(
          onSnapshot(
            query(
              collection(db, 'clinic_tickets'),
              where('doctorId', '==', placeId),
              orderBy('createdAt', 'desc'),
              limit(clinicTicketsLimit)
            ),
            (snap) => {
              buckets.set(`clinic:${placeId}`, mapTickets(snap));
              streamHasMore.set(`clinic:${placeId}`, snap.docs.length >= clinicTicketsLimit);
              syncMerged();
            },
            (error) => logFirestoreListenerError(error, OperationType.LIST, `clinic_tickets:${placeId}`)
          )
        );
      }
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, isAdmin, canAccessPartnerScope, managedPlaceIds, clinicTicketsLimit]);

  // Tenant-Isolated & Server-Ordered Restaurant Orders Stream (Admin / Restaurant Partner / Captain Partner)
  useEffect(() => {
    const canSeeRestaurant = isAdmin || (canAccessPartnerScope('restaurant') && managedPlaceIds.length > 0);
    const canSeeCaptain = !isAdmin && canAccessPartnerScope('captain') && Boolean(user?.uid);

    if (!authReady || (!canSeeRestaurant && !canSeeCaptain)) {
      setRestaurantOrders([]);
      setHasMoreOrders(false);
      return;
    }

    const unsubs: Array<() => void> = [];
    const buckets = new Map<string, RestaurantOrder[]>();
    const streamHasMore = new Map<string, boolean>();

    const syncMerged = () => {
      const merged = new Map<string, RestaurantOrder>();
      buckets.forEach((arr) => {
        arr.forEach((item) => merged.set(item.id, item));
      });
      const sorted = Array.from(merged.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      setRestaurantOrders(sorted);
      setHasMoreOrders(Array.from(streamHasMore.values()).some(Boolean));
    };

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'restaurant_orders'), orderBy('createdAt', 'desc'), limit(ordersLimit)),
          (snap) => {
            buckets.set(
              'admin',
              snap.docs.map((d) => ({ ...(d.data() as RestaurantOrder), id: d.id }))
            );
            streamHasMore.set('admin', snap.docs.length >= ordersLimit);
            syncMerged();
          },
          (error) => logFirestoreListenerError(error, OperationType.LIST, 'restaurant_orders')
        )
      );
    } else {
      if (canAccessPartnerScope('restaurant') && managedPlaceIds.length > 0) {
        // Equality filter per assigned restaurant for strict Firestore Rules provability
        for (const placeId of managedPlaceIds) {
          unsubs.push(
            onSnapshot(
              query(
                collection(db, 'restaurant_orders'),
                where('restaurantId', '==', placeId),
                orderBy('createdAt', 'desc'),
                limit(ordersLimit)
              ),
              (snap) => {
                buckets.set(
                  `restaurant:${placeId}`,
                  snap.docs.map((d) => ({ ...(d.data() as RestaurantOrder), id: d.id }))
                );
                streamHasMore.set(`restaurant:${placeId}`, snap.docs.length >= ordersLimit);
                syncMerged();
              },
              (error) =>
                logFirestoreListenerError(error, OperationType.LIST, `restaurant_orders:${placeId}`)
            )
          );
        }
      }

      if (canSeeCaptain && user?.uid) {
        unsubs.push(
          onSnapshot(
            query(
              collection(db, 'restaurant_orders'),
              where('status', '==', 'ready'),
              orderBy('createdAt', 'desc'),
              limit(ordersLimit)
            ),
            (snap) => {
              buckets.set(
                'captain_ready',
                snap.docs.map((d) => ({ ...(d.data() as RestaurantOrder), id: d.id }))
              );
              streamHasMore.set('captain_ready', snap.docs.length >= ordersLimit);
              syncMerged();
            },
            (error) => logFirestoreListenerError(error, OperationType.LIST, 'restaurant_orders:ready')
          )
        );
        unsubs.push(
          onSnapshot(
            query(
              collection(db, 'restaurant_orders'),
              where('captainUid', '==', user.uid),
              orderBy('createdAt', 'desc'),
              limit(ordersLimit)
            ),
            (snap) => {
              buckets.set(
                'captain_mine',
                snap.docs.map((d) => ({ ...(d.data() as RestaurantOrder), id: d.id }))
              );
              streamHasMore.set('captain_mine', snap.docs.length >= ordersLimit);
              syncMerged();
            },
            (error) => logFirestoreListenerError(error, OperationType.LIST, 'restaurant_orders:captain')
          )
        );
      }
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, isAdmin, canAccessPartnerScope, managedPlaceIds, user?.uid, ordersLimit]);

  // Tenant-Isolated & Server-Ordered Delivery Rides Stream (Admin / Captain Partner)
  useEffect(() => {
    const canSeeCaptain = !isAdmin && canAccessPartnerScope('captain') && Boolean(user?.uid);
    if (!authReady || (!isAdmin && !canSeeCaptain)) {
      setDeliveryRides([]);
      setHasMoreRides(false);
      return;
    }

    const unsubs: Array<() => void> = [];
    const buckets = new Map<string, DeliveryRide[]>();
    const streamHasMore = new Map<string, boolean>();

    const syncMerged = () => {
      const merged = new Map<string, DeliveryRide>();
      buckets.forEach((arr) => arr.forEach((r) => merged.set(r.id, r)));
      const sorted = Array.from(merged.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      setDeliveryRides(sorted);
      setHasMoreRides(Array.from(streamHasMore.values()).some(Boolean));
    };

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'delivery_rides'), orderBy('createdAt', 'desc'), limit(ridesLimit)),
          (snap) => {
            buckets.set(
              'admin',
              snap.docs.map((d) => ({ ...(d.data() as DeliveryRide), id: d.id }))
            );
            streamHasMore.set('admin', snap.docs.length >= ridesLimit);
            syncMerged();
          },
          (error) => logFirestoreListenerError(error, OperationType.LIST, 'delivery_rides')
        )
      );
    } else if (user?.uid) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'delivery_rides'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc'),
            limit(ridesLimit)
          ),
          (snap) => {
            buckets.set(
              'pending',
              snap.docs.map((d) => ({ ...(d.data() as DeliveryRide), id: d.id }))
            );
            streamHasMore.set('pending', snap.docs.length >= ridesLimit);
            syncMerged();
          },
          (error) => logFirestoreListenerError(error, OperationType.LIST, 'delivery_rides:pending')
        )
      );
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'delivery_rides'),
            where('captainUid', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(ridesLimit)
          ),
          (snap) => {
            buckets.set(
              'mine',
              snap.docs.map((d) => ({ ...(d.data() as DeliveryRide), id: d.id }))
            );
            streamHasMore.set('mine', snap.docs.length >= ridesLimit);
            syncMerged();
          },
          (error) => logFirestoreListenerError(error, OperationType.LIST, 'delivery_rides:mine')
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, isAdmin, canAccessPartnerScope, user?.uid, ridesLimit]);

  // Admin Panel real-time streams (server-ordered before limit!)
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setSubmissions([]);
      setHasMoreSubmissions(false);
      setWhatsappQueue([]);
      setAnalyticsEvents([]);
      setHasMoreAnalytics(false);
      return;
    }
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'submissions'), orderBy('createdAt', 'desc'), limit(submissionsLimit)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Submission), id: d.id }));
          setSubmissions(list);
          setHasMoreSubmissions(snap.docs.length >= submissionsLimit);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'submissions')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'whatsapp_queue'), orderBy('createdAt', 'desc'), limit(100)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as WhatsappQueueItem), id: d.id }));
          setWhatsappQueue(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'whatsapp_queue')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'analytics_events'), orderBy('createdAt', 'desc'), limit(analyticsSampleLimit)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as AnalyticsEvent), id: d.id }));
          setAnalyticsEvents(list);
          setHasMoreAnalytics(snap.docs.length >= analyticsSampleLimit);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'analytics_events')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady, isAdmin, submissionsLimit, analyticsSampleLimit]);

  // Finance real-time streams (strictly super_admin or auditor)
  const canReadFinance = isSuperAdmin || isAuditor;
  useEffect(() => {
    if (!authReady || !canReadFinance) {
      setFinanceConfig(SEED_FINANCE_CONFIG);
      setFinanceSettlements([]);
      return;
    }
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'finance_config', 'partners'),
        (snap) => {
          if (snap.exists()) {
            setFinanceConfig(snap.data() as FinanceConfig);
          } else {
            setFinanceConfig(SEED_FINANCE_CONFIG);
          }
        },
        (error) => logFirestoreListenerError(error, OperationType.GET, 'finance_config/partners')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'finance_settlements'), orderBy('closedAt', 'desc'), limit(100)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as FinanceSettlement), id: d.id }));
          setFinanceSettlements(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'finance_settlements')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady, canReadFinance]);

  // Pagination callbacks
  const loadMoreClinicTickets = useCallback(() => setClinicTicketsLimit((n) => Math.min(n + 50, 500)), []);
  const loadMoreOrders = useCallback(() => setOrdersLimit((n) => Math.min(n + 50, 500)), []);
  const loadMoreRides = useCallback(() => setRidesLimit((n) => Math.min(n + 50, 500)), []);
  const loadMoreSubmissions = useCallback(() => setSubmissionsLimit((n) => Math.min(n + 50, 500)), []);
  const loadMoreAnalytics = useCallback(() => setAnalyticsSampleLimit((n) => Math.min(n + 200, 1000)), []);

  // Safe, Non-Destructive Essential Config Initialization (NEVER overwrites existing docs, NEVER seeds demo data or settlements!)
  const initializeEssentialConfig = useCallback(async () => {
    if (!isSuperAdmin) {
      showToast('تهيئة الإعدادات الأساسية متاحة لصلاحية المشرف العام فقط', 'error');
      return;
    }
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      let createdCount = 0;

      for (const c of SEED_CATEGORIES) {
        const ref = doc(db, 'categories', c.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...c, updatedAt: now }));
          createdCount += 1;
        }
      }
      for (const pf of SEED_PROMO_FILTERS) {
        const ref = doc(db, 'promo_filters', pf.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...pf, updatedAt: now }));
          createdCount += 1;
        }
      }
      for (const em of SEED_EMERGENCY) {
        const ref = doc(db, 'emergency_contacts', em.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...em }));
          createdCount += 1;
        }
      }

      const settingsRef = doc(db, 'public_settings', 'main');
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) {
        batch.set(
          settingsRef,
          stripUndefined({ ...SEED_SETTINGS, visitsCount: 0, demoMode: false, updatedAt: now })
        );
        createdCount += 1;
      }

      const finRef = doc(db, 'finance_config', 'partners');
      const finSnap = await getDoc(finRef);
      if (!finSnap.exists()) {
        batch.set(finRef, stripUndefined({ ...SEED_FINANCE_CONFIG, updatedAt: now }));
        createdCount += 1;
      }

      if (createdCount === 0) {
        showToast('جميع الإعدادات الأساسية والأقسام مهيأة بالفعل ولم يتم تعديل أي سجل قائم', 'info');
        return;
      }

      await batch.commit();
      refreshCatalog();
      showToast(`تم إنشاء ${createdCount} عنصر تأسيس ناقص بأمان دون استبدال أي تعديلات قائمة`, 'success');
    } catch (error) {
      showToast('تعذرت تهيئة الإعدادات الأساسية، تحقق من الصلاحيات', 'error');
      handleFirestoreError(error, OperationType.WRITE, 'initializeEssentialConfig');
    }
  }, [isSuperAdmin, refreshCatalog, showToast]);

  // Explicit Opt-In Demo Catalog Seeding (create-only, NEVER overwrites admin edits, NEVER touches finance_settlements!)
  const seedDemoCatalog = useCallback(async () => {
    if (!isSuperAdmin) {
      showToast('إدراج البيانات التجريبية متاح للمشرف العام فقط', 'error');
      return;
    }
    try {
      await initializeEssentialConfig();
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const todayCairo = getCairoDateString();
      let createdCount = 0;

      for (const p of SEED_PLACES) {
        const ref = doc(db, 'places', p.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...p, isDemoData: true, createdAt: now, updatedAt: now }));
          createdCount += 1;
        }
      }
      for (const a of SEED_AGENCIES) {
        const ref = doc(db, 'agencies', a.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...a, isDemoData: true }));
          createdCount += 1;
        }
      }
      for (const prop of SEED_PROPERTIES) {
        const ref = doc(db, 'properties', prop.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...prop, isDemoData: true, createdAt: now }));
          createdCount += 1;
        }
      }
      for (const o of SEED_OFFERS) {
        const ref = doc(db, 'offers', o.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...o, isDemoData: true }));
          createdCount += 1;
        }
      }
      for (const camp of SEED_CAMPAIGNS) {
        const ref = doc(db, 'campaigns', camp.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(ref, stripUndefined({ ...camp, isDemoData: true }));
          createdCount += 1;
        }
      }
      for (const q of SEED_CLINIC_QUEUES) {
        const ref = doc(db, 'clinic_queues', q.doctorId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          batch.set(
            ref,
            stripUndefined({
              ...q,
              sessionDate: todayCairo,
              currentNumber: 0,
              lastTicketNumber: 0,
              updatedAt: now,
            })
          );
          createdCount += 1;
        }
      }

      if (createdCount === 0) {
        showToast('لا توجد سجلات تجريبية ناقصة لإضافتها؛ السجلات الحالية محفوظة كما هي', 'info');
        return;
      }

      await batch.commit();
      refreshCatalog();
      showToast(
        `تمت إضافة ${createdCount} سجل عرض تجريبي ناقص فقط (بدون تعديل السجلات القائمة وبدون تسويات مالية وهمية)`,
        'success'
      );
    } catch (error) {
      showToast('تعذرت إضافة بيانات العرض التجريبي', 'error');
      handleFirestoreError(error, OperationType.WRITE, 'seedDemoCatalog');
    }
  }, [isSuperAdmin, initializeEssentialConfig, refreshCatalog, showToast]);

  // Backward-compatible alias: NEVER overwrites existing docs and NEVER auto-seeds demo settlements
  const seedCloudDatabase = useCallback(
    async (includeDemoCatalog = false) => {
      if (includeDemoCatalog) {
        await seedDemoCatalog();
      } else {
        await initializeEssentialConfig();
      }
    },
    [initializeEssentialConfig, seedDemoCatalog]
  );

  // Safe migration helper: backfills authoritative `menuPriceMap` on existing restaurant docs & initializes missing clinic queues
  const migrateRestaurantMenuPriceMaps = useCallback(async (): Promise<number> => {
    if (!isAdminWriter) {
      showToast('هذه الأداة متاحة للمشرفين المصرح لهم بالتعديل فقط', 'error');
      return 0;
    }
    try {
      const snap = await getDocs(collection(db, 'places'));
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const todayCairo = getCairoDateString();
      let updatedCount = 0;

      for (const d of snap.docs) {
        const place = { ...(d.data() as Place), id: d.id };
        if (place.categorySlug === 'restaurants' && Array.isArray(place.menuItems) && place.menuItems.length > 0) {
          const nextMap = buildPlaceMenuPriceMap(place.menuItems);
          const currentMap = place.menuPriceMap || {};
          const needsUpdate =
            Object.keys(nextMap).length !== Object.keys(currentMap).length ||
            Object.entries(nextMap).some(([k, v]) => currentMap[k] !== v);
          if (needsUpdate) {
            batch.update(doc(db, 'places', place.id), {
              menuPriceMap: nextMap,
              updatedAt: now,
            });
            updatedCount += 1;
          }
        }
        if (place.categorySlug === 'medical') {
          const qRef = doc(db, 'clinic_queues', place.id);
          const qSnap = await getDoc(qRef);
          if (!qSnap.exists()) {
            batch.set(
              qRef,
              stripUndefined({
                doctorId: place.id,
                doctorName: place.name,
                specialty: place.specialty || '',
                clinicAddress: place.address || '',
                sessionDate: todayCairo,
                currentNumber: 0,
                lastTicketNumber: 0,
                status: 'open',
                avgMinutesPerPatient: 15,
                updatedAt: now,
              })
            );
            updatedCount += 1;
          } else {
            const qData = qSnap.data() as Partial<ClinicQueue>;
            if (!qData.sessionDate) {
              batch.update(qRef, { sessionDate: todayCairo, updatedAt: now });
              updatedCount += 1;
            }
          }
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        refreshCatalog();
        showToast(`تم تحديث وترحيل ${updatedCount} سجل (خرائط أسعار المطاعم + طوابير العيادات) بنجاح`, 'success');
      } else {
        showToast('جميع المطاعم والعيادات محدّثة بالفعل ولا تحتاج إلى ترحيل', 'info');
      }
      return updatedCount;
    } catch (error) {
      showToast('تعذر تنفيذ الترحيل التلقائي، تحقق من الصلاحيات', 'error');
      handleFirestoreError(error, OperationType.WRITE, 'migrateRestaurantMenuPriceMaps');
      return 0;
    }
  }, [isAdminWriter, refreshCatalog, showToast]);

  // Cloud-seeded detection: once cloud has categories, never fall back to demo seed data!
  const isCloudSeeded = Boolean(cloudCategories && cloudCategories.length > 0);
  const isDemoPreviewMode = !isCloudSeeded || Boolean(cloudSettings?.demoMode);

  const categories = useMemo(
    () => (cloudCategories !== null && (cloudCategories.length > 0 || isCloudSeeded) ? cloudCategories : SEED_CATEGORIES),
    [cloudCategories, isCloudSeeded]
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c.active).sort((a, b) => a.order - b.order),
    [categories]
  );
  const promoFilters = useMemo(
    () => (cloudPromoFilters !== null && (cloudPromoFilters.length > 0 || isCloudSeeded) ? cloudPromoFilters : SEED_PROMO_FILTERS),
    [cloudPromoFilters, isCloudSeeded]
  );
  const activePromoFilters = useMemo(
    () => promoFilters.filter((f) => f.active).sort((a, b) => a.order - b.order),
    [promoFilters]
  );
  const places = useMemo(
    () => (cloudPlaces !== null && (cloudPlaces.length > 0 || isCloudSeeded) ? cloudPlaces : SEED_PLACES),
    [cloudPlaces, isCloudSeeded]
  );
  const properties = useMemo(
    () => (cloudProperties !== null && (cloudProperties.length > 0 || isCloudSeeded) ? cloudProperties : SEED_PROPERTIES),
    [cloudProperties, isCloudSeeded]
  );
  const agencies = useMemo(
    () => (cloudAgencies !== null && (cloudAgencies.length > 0 || isCloudSeeded) ? cloudAgencies : SEED_AGENCIES),
    [cloudAgencies, isCloudSeeded]
  );
  const offers = useMemo(
    () => (cloudOffers !== null && (cloudOffers.length > 0 || isCloudSeeded) ? cloudOffers : SEED_OFFERS),
    [cloudOffers, isCloudSeeded]
  );
  const campaigns = useMemo(
    () => (cloudCampaigns !== null && (cloudCampaigns.length > 0 || isCloudSeeded) ? cloudCampaigns : SEED_CAMPAIGNS),
    [cloudCampaigns, isCloudSeeded]
  );
  const emergencyContacts = useMemo(
    () => (cloudEmergency !== null && (cloudEmergency.length > 0 || isCloudSeeded) ? cloudEmergency : SEED_EMERGENCY),
    [cloudEmergency, isCloudSeeded]
  );
  const settings = useMemo(() => cloudSettings || SEED_SETTINGS, [cloudSettings]);

  // Auth helpers with real error reporting
  const signInAdmin = useCallback(async () => {
    setSignInError(null);
    try {
      const signedUser = await loginWithGoogle();
      const snap = await getDoc(doc(db, 'admins', signedUser.uid));
      if (snap.exists()) {
        const raw = snap.data() as Partial<AdminUser>;
        const role = raw.role;
        if (raw.active === false) {
          const msg = 'هذا الحساب موقوف حالياً من قبل الإدارة العامة.';
          setSignInError(msg);
          showToast(msg, 'error');
          return false;
        }
        if (role === 'super_admin' || role === 'partner' || role === 'moderator' || role === 'auditor') {
          setAdminProfile({
            uid: signedUser.uid,
            email: raw.email || signedUser.email || '',
            name: raw.name || signedUser.displayName || '',
            role,
            partnerTypes: Array.isArray(raw.partnerTypes) ? raw.partnerTypes : [],
            managedPlaceIds: Array.isArray(raw.managedPlaceIds) ? raw.managedPlaceIds : [],
            active: raw.active ?? true,
          });
          showToast('تم التحقق من صلاحية الحساب بنجاح', 'success');
          return true;
        }
      }
      const notAuthorizedMsg = `الحساب (${signedUser.email || signedUser.uid}) غير مسجل ضمن المشرفين أو الشركاء المعتمدين. انسخ معرّف الحساب (UID) وأرسله للمشرف العام لإضافته.`;
      setSignInError(notAuthorizedMsg);
      showToast('هذا الحساب غير مسجل ضمن المشرفين أو المشغلين المعتمدين', 'error');
      return false;
    } catch (err) {
      const arabicErr = mapFirebaseAuthErrorToArabic(err);
      setSignInError(arabicErr);
      if (import.meta.env.DEV) console.error('Admin signIn error:', err);
      showToast(arabicErr, 'error');
      return false;
    }
  }, [showToast]);

  const signOutAdmin = useCallback(async () => {
    await logoutUser();
    setAdminProfile(null);
    setSignInError(null);
    showToast('تم تسجيل الخروج بأمان', 'info');
  }, [showToast]);

  // Admin Team & Partner Assignment CRUD (Super Admin only)
  const saveAdminUser = useCallback(
    async (record: AdminUser) => {
      if (!isSuperAdmin) {
        showToast('إدارة المشرفين والشركاء متاحة للمشرف العام فقط', 'error');
        return;
      }
      const uid = record.uid.trim();
      if (!uid) {
        showToast('يرجى إدخال معرّف حساب Firebase (UID) بشكل صحيح', 'error');
        return;
      }
      const now = new Date().toISOString();
      const payload: AdminUser = {
        uid,
        email: record.email.trim().toLowerCase(),
        name: record.name?.trim() || '',
        role: record.role,
        partnerTypes: record.role === 'partner' ? (record.partnerTypes || []).slice(0, 3) : [],
        managedPlaceIds: record.role === 'partner' ? (record.managedPlaceIds || []).slice(0, 20) : [],
        active: record.active !== false,
        createdAt: record.createdAt || now,
        updatedAt: now,
      };
      try {
        await setDoc(doc(db, 'admins', uid), stripUndefined(payload as unknown as Record<string, unknown>));
        showToast(`تم حفظ صلاحيات «${payload.name || payload.email}» بنجاح`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `admins/${uid}`);
      }
    },
    [isSuperAdmin, showToast]
  );

  const deleteAdminUser = useCallback(
    async (uid: string) => {
      if (!isSuperAdmin) return;
      try {
        await deleteDoc(doc(db, 'admins', uid));
        showToast('تم حذف الحساب من قائمة المشرفين والشركاء', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
      }
    },
    [isSuperAdmin, showToast]
  );

  // Local favorites & cart
  const toggleFavorite = useCallback(
    (placeId: string) => {
      setFavorites((prev) => {
        const next = prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId];
        localStorage.setItem('abh_favorites', JSON.stringify(next));
        showToast(prev.includes(placeId) ? 'تمت الإزالة من المحفوظات' : 'تم الحفظ في المفضلة على جهازك', 'info');
        return next;
      });
    },
    [showToast]
  );

  const addToCart = useCallback(
    (restaurantId: string, item: Omit<CartItem, 'quantity'>) => {
      setCart((prev) => {
        const reset = prev.restaurantId && prev.restaurantId !== restaurantId;
        const baseItems = reset ? [] : prev.items;
        const existing = baseItems.find((i) => i.menuItemId === item.menuItemId);
        const nextItems = existing
          ? baseItems.map((i) =>
              i.menuItemId === item.menuItemId ? { ...i, quantity: Math.min(20, i.quantity + 1) } : i
            )
          : [...baseItems.slice(0, 14), { ...item, quantity: 1 }];
        const next = { restaurantId, items: nextItems };
        localStorage.setItem('abh_cart', JSON.stringify(next));
        return next;
      });
      showToast(`تمت إضافة «${item.name}» للسلة`, 'success');
    },
    [showToast]
  );

  const updateCartQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const nextItems = prev.items
        .map((i) => (i.menuItemId === menuItemId ? { ...i, quantity: Math.min(20, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0);
      const next = { restaurantId: nextItems.length ? prev.restaurantId : null, items: nextItems };
      localStorage.setItem('abh_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    const empty = { restaurantId: null, items: [] };
    setCart(empty);
    localStorage.setItem('abh_cart', JSON.stringify(empty));
  }, []);

  // --- Citizen Live Firestore Writes ---

  // Analytics events are intentionally NOT written from the client anymore: each
  // search/interaction would consume a Firestore write against the Spark free-tier
  // limits. The function is kept on the context as a safe no-op so all callers
  // (search logging, call/whatsapp click tracking) keep working, and the admin
  // analytics view simply shows an empty (or server-seeded) dataset gracefully.
  const logAnalyticsEvent = useCallback(async (_event: Omit<AnalyticsEvent, 'createdAt'>) => {
    // No-op: client-side analytics writes are disabled to conserve Firestore quota.
  }, []);

  // Atomic Clinic Booking: enforces open clinic policy, Cairo day session partitioning, & coupled queue/ticket write
  const bookClinicTicket = useCallback(
    async (input: {
      doctorId: string;
      doctorName: string;
      patientName: string;
      patientPhone: string;
      visitType: string;
      fee: number;
      notes?: string;
    }): Promise<ClinicTicket> => {
      const phoneCheck = validateEgyptPhone(input.patientPhone, { allowLandline: false });
      if (!phoneCheck.valid) {
        throw new Error(phoneCheck.error || 'يرجى إدخال رقم موبايل مصري صحيح');
      }

      const now = new Date().toISOString();
      const todayCairo = getCairoDateString();
      const ticketId = generateSafeId('TKT');
      const queueRef = doc(db, 'clinic_queues', input.doctorId);
      const ticketRef = doc(db, 'clinic_tickets', ticketId);

      let createdTicket: ClinicTicket;
      try {
        createdTicket = await runTransaction(db, async (tx) => {
          const qSnap = await tx.get(queueRef);
          if (!qSnap.exists()) {
            throw new Error('طابور هذه العيادة غير مهيأ للحجز الإلكتروني حالياً. يرجى الاتصال بالعيادة مباشرة.');
          }
          const qData = qSnap.data() as Partial<ClinicQueue>;
          if (qData.status === 'closed') {
            throw new Error('العيادة مغلقة حالياً ولا تستقبل حجوزات جديدة.');
          }
          if (qData.status === 'paused' || qData.status === 'emergency') {
            throw new Error(
              qData.pausedReason?.trim()
                ? `الحجز متوقف مؤقتاً: ${qData.pausedReason}`
                : 'الحجز الإلكتروني متوقف مؤقتاً في هذه العيادة. يرجى المحاولة لاحقاً أو الاتصال بالعيادة.'
            );
          }

          const isSameSession = qData.sessionDate === todayCairo;
          const nextNumber = isSameSession ? (qData.lastTicketNumber ?? 0) + 1 : 1;
          const nextCurrent = isSameSession ? qData.currentNumber ?? 0 : 0;

          const ticket: ClinicTicket = {
            id: ticketId,
            ticketCode: ticketId,
            ticketNumber: nextNumber,
            sessionDate: todayCairo,
            doctorId: input.doctorId,
            doctorName: input.doctorName,
            patientName: input.patientName.trim(),
            patientPhone: phoneCheck.displayLocal,
            visitType: input.visitType,
            fee: input.fee,
            status: 'waiting',
            notes: input.notes?.trim() || '',
            createdAt: now,
            updatedAt: now,
          };

          tx.set(ticketRef, stripUndefined(ticket as unknown as Record<string, unknown>));
          tx.update(queueRef, {
            sessionDate: todayCairo,
            currentNumber: nextCurrent,
            lastTicketNumber: nextNumber,
            lastTicketId: ticketId,
            updatedAt: now,
          });
          return ticket;
        });
      } catch (error) {
        if (error instanceof Error && !error.message.includes('Missing or insufficient permissions')) {
          throw error;
        }
        handleFirestoreError(error, OperationType.CREATE, `clinic_tickets/${ticketId}`);
      }

      setActiveTracker({
        type: 'clinic',
        id: createdTicket.id,
        code: `#${createdTicket.ticketNumber}`,
        title: `دورك عند ${input.doctorName}`,
        route: `/medical/live-queue/${createdTicket.id}`,
      });
      appendActivityHistory({
        type: 'clinic',
        code: `#${createdTicket.ticketNumber}`,
        title: `حجز كشف — ${input.doctorName}`,
        subtitle: `${input.visitType} · ${input.fee} ج.م · جلسة ${todayCairo}`,
        route: `/medical/live-queue/${createdTicket.id}`,
      });
      saveCitizenProfile({ name: input.patientName, phone: phoneCheck.displayLocal });
      return createdTicket;
    },
    [setActiveTracker]
  );

  // Trusted Catalog-Verified Restaurant Order Placement (enforced both in client-fresh catalog check + Firestore Security Rules!)
  const placeRestaurantOrder = useCallback(
    async (input: {
      restaurantId: string;
      restaurantName: string;
      customerName: string;
      customerPhone: string;
      deliveryArea: string;
      deliveryAddress: string;
      locationShared: boolean;
      deliveryCoords?: DeliveryCoords;
      items: CartItem[];
      subtotal: number;
      deliveryFee: number;
      total: number;
      notes?: string;
    }): Promise<RestaurantOrder> => {
      const phoneCheck = validateEgyptPhone(input.customerPhone, { allowLandline: false });
      if (!phoneCheck.valid) {
        throw new Error(phoneCheck.error || 'يرجى إدخال رقم موبايل مصري صحيح');
      }

      const now = new Date().toISOString();
      let authoritativeName = input.restaurantName;
      let verifiedItems: CartItem[] | null = null;
      let verifiedSubtotal = 0;
      let verifiedDeliveryFee = 0;
      let verifiedTotal = 0;
      let verifiedSnapshot: RestaurantOrder['pricingSnapshot'] | undefined;

      // 1. Attempt trusted Cloudflare Pages Function server-side validator first (/api/orders/validate)
      let serverRejected = false;
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 4500);
        const apiRes = await fetch('/api/orders/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            restaurantId: input.restaurantId,
            deliveryArea: input.deliveryArea,
            items: input.items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              clientPrice: item.price,
            })),
            clientSubtotal: input.subtotal,
            clientDeliveryFee: input.deliveryFee,
            clientTotal: input.total,
          }),
        });
        window.clearTimeout(timeoutId);

        const contentType = apiRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const apiData = (await apiRes.json()) as {
            ok?: boolean;
            error?: string;
            restaurantName?: string;
            items?: CartItem[];
            subtotal?: number;
            deliveryFee?: number;
            total?: number;
            pricingSnapshot?: RestaurantOrder['pricingSnapshot'];
          };
          // Any 4xx (including 404 NOT_FOUND and 422 PRICE_MISMATCH) is a hard rejection:
          // reject the order immediately instead of silently falling back to client-side validation.
          if (!apiRes.ok && apiRes.status >= 400 && apiRes.status < 500) {
            serverRejected = true;
            throw new Error(apiData.error || 'تم رفض الطلب لعدم مطابقة الأسعار مع القائمة المعتمدة');
          }
          if (apiRes.ok && apiData.ok && Array.isArray(apiData.items) && apiData.pricingSnapshot) {
            authoritativeName = apiData.restaurantName || authoritativeName;
            verifiedItems = apiData.items;
            verifiedSubtotal = apiData.subtotal ?? 0;
            verifiedDeliveryFee = apiData.deliveryFee ?? 0;
            verifiedTotal = apiData.total ?? 0;
            verifiedSnapshot = apiData.pricingSnapshot;
          }
        }
      } catch (apiErr) {
        // Hard-reject on any explicit 4xx validation/tampering rejection from the server validator.
        if (serverRejected) {
          throw apiErr;
        }
        // Otherwise (e.g., network error, timeout, or 5xx CATALOG_UNAVAILABLE), fall back to the live
        // Firestore catalog check while Firestore Security Rules enforce exact menuPriceMap verification.
      }

      // 2. Fallback / double-check against live Firestore catalog (enforced by Firestore Security Rules!)
      if (!verifiedItems || !verifiedSnapshot) {
        const placeSnap = await getDoc(doc(db, 'places', input.restaurantId));
        const authoritativeRestaurant = placeSnap.exists()
          ? ({ ...(placeSnap.data() as Place), id: placeSnap.id } as Place)
          : places.find((p) => p.id === input.restaurantId);

        const pricingResult = computeAuthoritativeOrder({
          restaurant: authoritativeRestaurant,
          draftItems: input.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            clientPrice: item.price,
          })),
          deliveryArea: input.deliveryArea,
          pricingSource: 'firestore_catalog',
          nowIso: now,
        });

        if (!pricingResult.ok) {
          throw new Error(pricingResult.message);
        }

        authoritativeName = authoritativeRestaurant?.name || authoritativeName;
        verifiedItems = pricingResult.items;
        verifiedSubtotal = pricingResult.subtotal;
        verifiedDeliveryFee = pricingResult.deliveryFee;
        verifiedTotal = pricingResult.total;
        verifiedSnapshot = pricingResult.pricingSnapshot;
      }

      const hasValidCoords =
        Boolean(input.deliveryCoords) &&
        typeof input.deliveryCoords?.lat === 'number' &&
        typeof input.deliveryCoords?.lng === 'number' &&
        Number.isFinite(input.deliveryCoords.lat) &&
        Number.isFinite(input.deliveryCoords.lng);

      const orderId = generateSafeId('ORD');
      const order: RestaurantOrder = {
        id: orderId,
        orderCode: orderId,
        restaurantId: input.restaurantId,
        restaurantName: authoritativeName,
        customerName: input.customerName.trim(),
        customerPhone: phoneCheck.displayLocal,
        deliveryArea: input.deliveryArea,
        deliveryAddress: input.deliveryAddress.trim(),
        locationShared: Boolean(input.locationShared && hasValidCoords),
        deliveryCoords: hasValidCoords ? input.deliveryCoords : undefined,
        items: verifiedItems,
        subtotal: verifiedSubtotal,
        deliveryFee: verifiedDeliveryFee,
        total: verifiedTotal,
        pricingSnapshot: verifiedSnapshot,
        status: 'new',
        notes: input.notes?.trim() || '',
        createdAt: now,
        updatedAt: now,
      };

      try {
        await setDoc(doc(db, 'restaurant_orders', orderId), stripUndefined(order as unknown as Record<string, unknown>));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `restaurant_orders/${orderId}`);
      }

      clearCart();
      setActiveTracker({
        type: 'order',
        id: orderId,
        code: orderId,
        title: `طلب من ${order.restaurantName}`,
        route: `/orders/tracking/${orderId}`,
      });
      appendActivityHistory({
        type: 'order',
        code: orderId,
        title: `طلب من ${order.restaurantName}`,
        subtitle: `${verifiedItems.length} أصناف · ${verifiedTotal} ج.م`,
        route: `/orders/tracking/${orderId}`,
      });
      saveCitizenProfile({
        name: input.customerName,
        phone: phoneCheck.displayLocal,
        area: input.deliveryArea,
        address: input.deliveryAddress,
      });
      return order;
    },
    [places, clearCart, setActiveTracker]
  );

  const createDeliveryRide = useCallback(
    async (input: {
      pickupArea: string;
      pickupDetails: string;
      dropoffArea: string;
      dropoffDetails: string;
      itemDescription: string;
      customerName: string;
      customerPhone: string;
      estimatedFee: number;
    }): Promise<DeliveryRide> => {
      const phoneCheck = validateEgyptPhone(input.customerPhone, { allowLandline: false });
      if (!phoneCheck.valid) {
        throw new Error(phoneCheck.error || 'يرجى إدخال رقم موبايل مصري صحيح');
      }

      const now = new Date().toISOString();
      const rideId = generateSafeId('DLV');
      const ride: DeliveryRide = {
        id: rideId,
        rideCode: rideId,
        pickupArea: input.pickupArea,
        pickupDetails: input.pickupDetails.trim(),
        dropoffArea: input.dropoffArea,
        dropoffDetails: input.dropoffDetails.trim(),
        itemDescription: input.itemDescription.trim(),
        customerName: input.customerName.trim(),
        customerPhone: phoneCheck.displayLocal,
        estimatedFee: input.estimatedFee,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      try {
        await setDoc(doc(db, 'delivery_rides', rideId), stripUndefined(ride as unknown as Record<string, unknown>));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `delivery_rides/${rideId}`);
      }
      setActiveTracker({
        type: 'delivery',
        id: rideId,
        code: rideId,
        title: `مشوار توصيل (${input.pickupArea})`,
        route: `/delivery/tracking/${rideId}`,
      });
      appendActivityHistory({
        type: 'delivery',
        code: rideId,
        title: `مشوار من ${input.pickupArea} إلى ${input.dropoffArea}`,
        subtitle: `${input.itemDescription.slice(0, 40)} · ${input.estimatedFee} ج.م`,
        route: `/delivery/tracking/${rideId}`,
      });
      saveCitizenProfile({
        name: input.customerName,
        phone: phoneCheck.displayLocal,
        area: input.pickupArea,
      });
      return ride;
    },
    [setActiveTracker]
  );

  const createSubmission = useCallback(
    async (input: {
      type: Submission['type'];
      title: string;
      submitterName: string;
      submitterPhone: string;
      targetPlaceId?: string;
      payload?: Record<string, string | number | boolean>;
      previousData?: Record<string, string | number | boolean>;
    }): Promise<Submission> => {
      const phoneCheck = validateEgyptPhone(input.submitterPhone, { allowLandline: true });
      if (!phoneCheck.valid) {
        throw new Error(phoneCheck.error || 'يرجى إدخال رقم هاتف مصري صحيح');
      }

      const now = new Date().toISOString();
      const token = generateSafeId('TRK');
      const submission: Submission = {
        id: token,
        trackingToken: token,
        type: input.type,
        targetPlaceId: input.targetPlaceId,
        title: input.title.trim(),
        submitterName: input.submitterName.trim(),
        submitterPhone: phoneCheck.displayLocal,
        payload: input.payload || {},
        previousData: input.previousData,
        status: 'received',
        adminNote: 'تم استلام طلبك بنجاح وسيتم مراجعته من فريق دليل أبوحمص خلال أقل من 24 ساعة.',
        createdAt: now,
        updatedAt: now,
      };
      try {
        await setDoc(doc(db, 'submissions', token), stripUndefined(submission as unknown as Record<string, unknown>));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `submissions/${token}`);
      }
      appendActivityHistory({
        type: 'submission',
        code: token,
        title: submission.title,
        subtitle: 'متابعة حالة الطلب مع إدارة الدليل',
        route: `/track/${token}`,
      });
      saveCitizenProfile({
        name: input.submitterName,
        phone: phoneCheck.displayLocal,
      });
      return submission;
    },
    []
  );

  // --- Partner & Admin Live Mutations (Atomic + Tenant-Isolated) ---

  const updateClinicQueueState = useCallback(
    async (doctorId: string, patch: Partial<ClinicQueue>) => {
      const place = places.find((p) => p.id === doctorId);
      const now = new Date().toISOString();
      try {
        await runTransaction(db, async (tx) => {
          const qRef = doc(db, 'clinic_queues', doctorId);
          const snap = await tx.get(qRef);
          if (snap.exists()) {
            const existing = snap.data() as ClinicQueue;
            const merged: ClinicQueue = {
              ...existing,
              doctorId,
              sessionDate: existing.sessionDate || getCairoDateString(),
              ...patch,
              updatedAt: now,
            };
            tx.set(qRef, stripUndefined(merged as unknown as Record<string, unknown>));
          } else {
            const created: ClinicQueue = {
              doctorId,
              doctorName: patch.doctorName || place?.name || doctorId,
              specialty: patch.specialty ?? place?.specialty ?? '',
              clinicAddress: patch.clinicAddress ?? place?.address ?? '',
              sessionDate: patch.sessionDate || getCairoDateString(),
              currentNumber: patch.currentNumber ?? 0,
              lastTicketNumber: patch.lastTicketNumber ?? 0,
              status: patch.status || 'open',
              avgMinutesPerPatient: patch.avgMinutesPerPatient ?? 15,
              pausedReason: patch.pausedReason || '',
              updatedAt: now,
            };
            tx.set(qRef, stripUndefined(created as unknown as Record<string, unknown>));
          }
        });
        showToast('تم تحديث حالة طابور العيادة لحظياً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `clinic_queues/${doctorId}`);
      }
    },
    [places, showToast]
  );

  const resetClinicDaySession = useCallback(
    async (doctorId: string) => {
      await updateClinicQueueState(doctorId, {
        sessionDate: getCairoDateString(),
        currentNumber: 0,
        lastTicketNumber: 0,
        lastTicketId: '',
        status: 'open',
        pausedReason: '',
      });
    },
    [updateClinicQueueState]
  );

  // Atomic Call-Next: skips cancelled/completed tickets and synchronizes ticket status + queue.currentNumber
  const callNextClinicTicket = useCallback(
    async (doctorId: string): Promise<ClinicTicket | null> => {
      const todayCairo = getCairoDateString();
      const doctorTodayTickets = clinicTickets
        .filter((t) => t.doctorId === doctorId && (t.sessionDate || todayCairo) === todayCairo)
        .sort((a, b) => a.ticketNumber - b.ticketNumber);

      const nextWaiting = doctorTodayTickets.find((t) => t.status === 'waiting' || t.status === 'emergency');
      const currentlyActive = doctorTodayTickets.filter((t) => t.status === 'called' || t.status === 'in_room');

      if (!nextWaiting) {
        showToast('لا توجد أدوار منتظرة حالياً في جلسة اليوم', 'info');
        return null;
      }

      const now = new Date().toISOString();
      try {
        await runTransaction(db, async (tx) => {
          const qRef = doc(db, 'clinic_queues', doctorId);
          const qSnap = await tx.get(qRef);
          if (!qSnap.exists()) throw new Error('طابور العيادة غير موجود');

          const nextTicketRef = doc(db, 'clinic_tickets', nextWaiting.id);
          const nextTicketSnap = await tx.get(nextTicketRef);
          if (!nextTicketSnap.exists()) throw new Error('التذكرة غير موجودة');
          const liveNext = nextTicketSnap.data() as ClinicTicket;
          if (liveNext.status === 'cancelled' || liveNext.status === 'completed') {
            throw new Error('تم إلغاء أو إنهاء هذه التذكرة بالفعل، حاول مرة أخرى');
          }

          for (const activeT of currentlyActive) {
            tx.update(doc(db, 'clinic_tickets', activeT.id), {
              status: 'completed',
              updatedAt: now,
            });
          }

          tx.update(nextTicketRef, { status: 'called', updatedAt: now });
          tx.update(qRef, {
            currentNumber: liveNext.ticketNumber,
            sessionDate: todayCairo,
            updatedAt: now,
          });
        });

        showToast(`تم نداء الدور رقم #${nextWaiting.ticketNumber} (${nextWaiting.patientName})`, 'success');
        return nextWaiting;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر نداء الدور التالي', 'error');
        return null;
      }
    },
    [clinicTickets, showToast]
  );

  const updateClinicTicketStatus = useCallback(
    async (ticketId: string, status: ClinicTicket['status']) => {
      const target = clinicTickets.find((t) => t.id === ticketId);
      if (!target) return;
      const now = new Date().toISOString();
      const targetSession = target.sessionDate || getCairoDateString();
      const otherActive =
        status === 'called' || status === 'in_room'
          ? clinicTickets.filter(
              (t) =>
                t.id !== ticketId &&
                t.doctorId === target.doctorId &&
                (t.sessionDate || targetSession) === targetSession &&
                (t.status === 'called' || t.status === 'in_room')
            )
          : [];
      try {
        await runTransaction(db, async (tx) => {
          const tRef = doc(db, 'clinic_tickets', ticketId);
          const qRef = doc(db, 'clinic_queues', target.doctorId);
          const [tSnap, qSnap] = await Promise.all([tx.get(tRef), tx.get(qRef)]);
          if (!tSnap.exists()) throw new Error('التذكرة غير موجودة');
          const liveTicket = tSnap.data() as ClinicTicket;
          if (
            (status === 'called' || status === 'in_room') &&
            (liveTicket.status === 'cancelled' || liveTicket.status === 'completed')
          ) {
            throw new Error('لا يمكن نداء تذكرة ملغاة أو منتهية');
          }
          for (const activeT of otherActive) {
            tx.update(doc(db, 'clinic_tickets', activeT.id), {
              status: 'completed',
              updatedAt: now,
            });
          }
          tx.update(tRef, { status, updatedAt: now });
          if (qSnap.exists() && (status === 'called' || status === 'in_room')) {
            const liveQueue = qSnap.data() as ClinicQueue;
            tx.update(qRef, {
              currentNumber: liveTicket.ticketNumber,
              lastTicketNumber: Math.max(liveQueue.lastTicketNumber ?? 0, liveTicket.ticketNumber),
              sessionDate: liveTicket.sessionDate || targetSession,
              updatedAt: now,
            });
          }
        });
        showToast('تم تحديث حالة المريض ومزامنة الطابور فوراً', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر تحديث حالة التذكرة', 'error');
        handleFirestoreError(error, OperationType.UPDATE, `clinic_tickets/${ticketId}`);
      }
    },
    [clinicTickets, showToast]
  );

  // Atomic Captain Claim for Ready Restaurant Order (anti-double-claim)
  const claimRestaurantOrder = useCallback(
    async (orderId: string, captainName: string, captainPhone: string): Promise<boolean> => {
      if (!user?.uid) {
        showToast('يجب تسجيل الدخول بحساب كابتن معتمد أولاً', 'error');
        return false;
      }
      const phoneCheck = validateEgyptPhone(captainPhone, { allowLandline: false });
      if (!phoneCheck.valid) {
        showToast(phoneCheck.error || 'رقم هاتف الكابتن غير صحيح', 'error');
        return false;
      }

      const now = new Date().toISOString();
      try {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'restaurant_orders', orderId);
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('الطلب غير موجود');
          const data = snap.data() as RestaurantOrder;
          if (data.status !== 'ready' || data.captainUid) {
            throw new Error('عذراً، تم استلام هذا الطلب بالفعل بواسطة كابتن آخر أو تغيرت حالته');
          }
          tx.update(ref, {
            status: 'on_the_way',
            captainUid: user.uid,
            captainName: captainName.trim(),
            captainPhone: phoneCheck.displayLocal,
            updatedAt: now,
          });
        });
        showToast('تم إسناد طلب المطعم إليك بنجاح — بالتوفيق في التوصيل!', 'success');
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر قبول الطلب، ربما التقطه كابتن آخر', 'error');
        return false;
      }
    },
    [user?.uid, showToast]
  );

  const updateRestaurantOrderStatus = useCallback(
    async (
      orderId: string,
      patch: Partial<Pick<RestaurantOrder, 'status' | 'captainName' | 'captainPhone'>>
    ) => {
      if (patch.status === 'on_the_way' && patch.captainName && patch.captainPhone && !isAdminWriter) {
        await claimRestaurantOrder(orderId, patch.captainName, patch.captainPhone);
        return;
      }
      const now = new Date().toISOString();
      const updatePayload: Record<string, unknown> = { updatedAt: now };
      if (patch.status) updatePayload.status = patch.status;
      if (isAdminWriter) {
        if (patch.captainName !== undefined) updatePayload.captainName = patch.captainName;
        if (patch.captainPhone !== undefined) updatePayload.captainPhone = patch.captainPhone;
      }
      try {
        await updateDoc(doc(db, 'restaurant_orders', orderId), updatePayload);
        showToast('تم تحديث حالة الطلب وإبلاغ العميل لحظياً', 'success');
      } catch (error) {
        showToast('تعذر تحديث حالة الطلب — تحقق من تسلسل الحالات أو صلاحيتك', 'error');
        handleFirestoreError(error, OperationType.UPDATE, `restaurant_orders/${orderId}`);
      }
    },
    [isAdminWriter, claimRestaurantOrder, showToast]
  );

  // Atomic Captain Claim for Pending Delivery Ride (anti-double-claim)
  const claimDeliveryRide = useCallback(
    async (rideId: string, captainName: string, captainPhone: string): Promise<boolean> => {
      if (!user?.uid) {
        showToast('يجب تسجيل الدخول بحساب كابتن معتمد أولاً', 'error');
        return false;
      }
      const phoneCheck = validateEgyptPhone(captainPhone, { allowLandline: false });
      if (!phoneCheck.valid) {
        showToast(phoneCheck.error || 'رقم هاتف الكابتن غير صحيح', 'error');
        return false;
      }

      const now = new Date().toISOString();
      try {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, 'delivery_rides', rideId);
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('المشوار غير موجود');
          const data = snap.data() as DeliveryRide;
          if (data.status !== 'pending' || data.captainUid) {
            throw new Error('عذراً، تم قبول هذا المشوار بالفعل بواسطة كابتن آخر');
          }
          tx.update(ref, {
            status: 'accepted',
            captainUid: user.uid,
            captainName: captainName.trim(),
            captainPhone: phoneCheck.displayLocal,
            updatedAt: now,
          });
        });
        showToast('تم قبول المشوار وإسناده إلى حسابك بنجاح', 'success');
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر قبول المشوار، ربما قبله كابتن آخر', 'error');
        return false;
      }
    },
    [user?.uid, showToast]
  );

  const updateDeliveryRideStatus = useCallback(
    async (
      rideId: string,
      patch: Partial<Pick<DeliveryRide, 'status' | 'captainName' | 'captainPhone'>>
    ) => {
      if (patch.status === 'accepted' && patch.captainName && patch.captainPhone && !isAdminWriter) {
        await claimDeliveryRide(rideId, patch.captainName, patch.captainPhone);
        return;
      }
      const now = new Date().toISOString();
      const updatePayload: Record<string, unknown> = { updatedAt: now };
      if (patch.status) updatePayload.status = patch.status;
      if (isAdminWriter) {
        if (patch.captainName !== undefined) updatePayload.captainName = patch.captainName;
        if (patch.captainPhone !== undefined) updatePayload.captainPhone = patch.captainPhone;
      }
      try {
        await updateDoc(doc(db, 'delivery_rides', rideId), updatePayload);
        showToast('تم تحديث حالة المشوار لدى العميل مباشرة', 'success');
      } catch (error) {
        showToast('تعذر تحديث حالة المشوار — تحقق من تسلسل الحالات أو ملكية الإسناد', 'error');
        handleFirestoreError(error, OperationType.UPDATE, `delivery_rides/${rideId}`);
      }
    },
    [isAdminWriter, claimDeliveryRide, showToast]
  );

  // Dynamic Categories CRUD + Reorder
  const saveCategory = useCallback(
    async (category: Category) => {
      const payload: Category = {
        ...category,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'categories', category.id), stripUndefined(payload as unknown as Record<string, unknown>));
        refreshCatalog();
        showToast(`تم حفظ قسم «${category.name}» ومزامنته فوراً`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `categories/${category.id}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
        refreshCatalog();
        showToast('تم حذف القسم نهائياً من قاعدة البيانات', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const reorderCategories = useCallback(
    async (orderedIds: string[]) => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        orderedIds.forEach((id, index) => {
          const cat = categories.find((c) => c.id === id);
          if (cat) {
            batch.set(doc(db, 'categories', id), stripUndefined({ ...cat, order: index + 1, updatedAt: now }));
          }
        });
        await batch.commit();
        refreshCatalog();
        showToast('تم تحديث ترتيب الأقسام في الرئيسية فوراً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'categories/reorder');
      }
    },
    [categories, refreshCatalog, showToast]
  );

  // Dynamic Promotional Filters & Badges CRUD
  const savePromoFilter = useCallback(
    async (filter: PromoFilter) => {
      const payload: PromoFilter = {
        ...filter,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(
          doc(db, 'promo_filters', filter.id),
          stripUndefined(payload as unknown as Record<string, unknown>)
        );
        refreshCatalog();
        showToast(`تم حفظ فلتر التمييز «${filter.name}» ومزامنته فوراً`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `promo_filters/${filter.id}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const deletePromoFilter = useCallback(
    async (filterId: string) => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        batch.delete(doc(db, 'promo_filters', filterId));

        places.forEach((p) => {
          const hasTag = Array.isArray(p.filterTags) && p.filterTags.includes(filterId);
          const hasExp = Boolean(p.filterExpirations && filterId in p.filterExpirations);
          if (!hasTag && !hasExp) return;
          const nextTags = (p.filterTags || []).filter((id) => id !== filterId);
          const nextExpirations = { ...(p.filterExpirations || {}) };
          delete nextExpirations[filterId];
          const cleaned: Place = {
            ...p,
            filterTags: nextTags,
            filterExpirations: Object.keys(nextExpirations).length > 0 ? nextExpirations : undefined,
            updatedAt: now,
          };
          batch.set(doc(db, 'places', p.id), stripUndefined(cleaned as unknown as Record<string, unknown>));
        });

        await batch.commit();
        refreshCatalog();
        showToast('تم حذف فلتر التمييز وتنظيف ارتباطاته نهائياً', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `promo_filters/${filterId}`);
      }
    },
    [places, refreshCatalog, showToast]
  );

  const reorderPromoFilters = useCallback(
    async (orderedIds: string[]) => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        orderedIds.forEach((id, index) => {
          const pf = promoFilters.find((f) => f.id === id);
          if (pf) {
            batch.set(doc(db, 'promo_filters', id), stripUndefined({ ...pf, order: index + 1, updatedAt: now }));
          }
        });
        await batch.commit();
        refreshCatalog();
        showToast('تم تحديث ترتيب فلاتر التمييز فوراً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'promo_filters/reorder');
      }
    },
    [promoFilters, refreshCatalog, showToast]
  );

  const togglePlacePromoFilter = useCallback(
    async (placeId: string, filterId: string, expiresAt?: string) => {
      const target = places.find((p) => p.id === placeId);
      if (!target) return;
      const currentTags = Array.isArray(target.filterTags) ? target.filterTags : [];
      const exists = currentTags.includes(filterId);
      const nextTags = exists
        ? currentTags.filter((id) => id !== filterId)
        : [...currentTags.slice(0, 19), filterId];
      const nextExpirations: Record<string, string> = { ...(target.filterExpirations || {}) };
      if (exists) {
        delete nextExpirations[filterId];
      } else if (expiresAt && expiresAt.trim()) {
        nextExpirations[filterId] = expiresAt.trim();
      }
      const updated: Place = {
        ...target,
        filterTags: nextTags,
        filterExpirations: Object.keys(nextExpirations).length > 0 ? nextExpirations : undefined,
        featured: nextTags.length > 0 ? true : target.featured,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'places', placeId), stripUndefined(updated as unknown as Record<string, unknown>));
        refreshCatalog();
        showToast(
          exists ? `تمت إزالة «${target.name}» من الفلتر` : `تم تسكين «${target.name}» داخل الفلتر بنجاح`,
          exists ? 'info' : 'success'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `places/${placeId}`);
      }
    },
    [places, refreshCatalog, showToast]
  );

  const setPlaceFilterExpiry = useCallback(
    async (placeId: string, filterId: string, expiresAt: string) => {
      const target = places.find((p) => p.id === placeId);
      if (!target) return;
      const nextExpirations: Record<string, string> = { ...(target.filterExpirations || {}) };
      if (expiresAt.trim()) {
        nextExpirations[filterId] = expiresAt.trim();
      } else {
        delete nextExpirations[filterId];
      }
      const updated: Place = {
        ...target,
        filterExpirations: Object.keys(nextExpirations).length > 0 ? nextExpirations : undefined,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'places', placeId), stripUndefined(updated as unknown as Record<string, unknown>));
        refreshCatalog();
        showToast('تم تحديث تاريخ انتهاء اشتراك الشارة', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `places/${placeId}`);
      }
    },
    [places, refreshCatalog, showToast]
  );

  // Save Place: automatically updates menuPriceMap & initializes empty clinic_queues for new medical clinics
  const savePlace = useCallback(
    async (place: Place) => {
      const now = new Date().toISOString();
      const computedMenuPriceMap =
        place.menuItems && place.menuItems.length > 0 ? buildPlaceMenuPriceMap(place.menuItems) : undefined;
      const payload: Place = {
        ...place,
        menuPriceMap: computedMenuPriceMap,
        updatedAt: now,
        createdAt: place.createdAt || now,
      };
      try {
        await setDoc(doc(db, 'places', place.id), stripUndefined(payload as unknown as Record<string, unknown>));

        // Automatically initialize an empty valid ClinicQueue for medical places if none exists yet
        if (place.categorySlug === 'medical') {
          const qRef = doc(db, 'clinic_queues', place.id);
          const qSnap = await getDoc(qRef);
          if (!qSnap.exists()) {
            const initialQueue: ClinicQueue = {
              doctorId: place.id,
              doctorName: place.name,
              specialty: place.specialty || '',
              clinicAddress: place.address || '',
              sessionDate: getCairoDateString(),
              currentNumber: 0,
              lastTicketNumber: 0,
              status: 'open',
              avgMinutesPerPatient: 15,
              updatedAt: now,
            };
            await setDoc(qRef, stripUndefined(initialQueue as unknown as Record<string, unknown>));
          }
        }

        refreshCatalog();
        showToast(`تم حفظ «${place.name}» ونشره في الدليل`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `places/${place.id}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const deletePlace = useCallback(
    async (placeId: string) => {
      try {
        await deleteDoc(doc(db, 'places', placeId));
        refreshCatalog();
        showToast('تم حذف المكان من الدليل', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `places/${placeId}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const saveProperty = useCallback(
    async (property: Property) => {
      const payload: Property = { ...property, createdAt: property.createdAt || new Date().toISOString() };
      try {
        await setDoc(doc(db, 'properties', property.id), stripUndefined(payload as unknown as Record<string, unknown>));
        refreshCatalog();
        showToast('تم حفظ إعلان العقار بنجاح', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `properties/${property.id}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const deleteProperty = useCallback(
    async (propertyId: string) => {
      try {
        await deleteDoc(doc(db, 'properties', propertyId));
        refreshCatalog();
        showToast('تم حذف إعلان العقار', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `properties/${propertyId}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const saveOffer = useCallback(
    async (offer: Offer) => {
      try {
        await setDoc(doc(db, 'offers', offer.id), stripUndefined(offer as unknown as Record<string, unknown>));
        refreshCatalog();
        showToast(`تم حفظ التخفيض «${offer.title}»`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `offers/${offer.id}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const saveCampaign = useCallback(
    async (campaign: Campaign) => {
      try {
        await setDoc(doc(db, 'campaigns', campaign.id), stripUndefined(campaign as unknown as Record<string, unknown>));
        refreshCatalog();
        showToast('تم تحديث كرسي الواجهة الترويجي بنجاح', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaign.id}`);
      }
    },
    [refreshCatalog, showToast]
  );

  const updateSubmissionStatus = useCallback(
    async (submissionId: string, status: Submission['status'], adminNote?: string) => {
      const target = submissions.find((s) => s.id === submissionId);
      if (!target) return;
      const now = new Date().toISOString();
      const updated: Submission = {
        ...target,
        status,
        adminNote: adminNote ?? target.adminNote,
        reviewedBy: adminProfile?.name || user?.email || 'إدارة الدليل',
        reviewedByUid: user?.uid,
        reviewedAt: now,
        updatedAt: now,
      };
      try {
        await setDoc(doc(db, 'submissions', submissionId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم تحديث حالة الطلب وتوثيق المراجعة في السجل', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `submissions/${submissionId}`);
      }
    },
    [submissions, adminProfile, user, showToast]
  );

  // Atomic Correction Report Application: applies allowlisted fields to target place + saves audit trail
  const applyCorrectionSubmission = useCallback(
    async (submissionId: string, adminNote?: string): Promise<boolean> => {
      if (!isAdminWriter || !user?.uid) {
        showToast('تطبيق التعديلات متاح للمشرفين المصرح لهم بالتعديل فقط', 'error');
        return false;
      }
      const now = new Date().toISOString();
      try {
        await runTransaction(db, async (tx) => {
          const subRef = doc(db, 'submissions', submissionId);
          const subSnap = await tx.get(subRef);
          if (!subSnap.exists()) throw new Error('البلاغ غير موجود');
          const sub = subSnap.data() as Submission;

          if (sub.type !== 'report_edit') throw new Error('هذا الطلب ليس بلاغ تصحيح بيانات');
          if (sub.applied || sub.publishedTargetId) {
            throw new Error('تم تطبيق هذا التصحيح مسبقاً بالفعل');
          }
          if (!sub.targetPlaceId) {
            throw new Error('هذا البلاغ عام ولا يرتبط بمكان محدد؛ استخدم تحديث الحالة بعد المراجعة اليدوية.');
          }

          const placeRef = doc(db, 'places', sub.targetPlaceId);
          const placeSnap = await tx.get(placeRef);
          if (!placeSnap.exists()) {
            throw new Error('المكان المستهدف غير موجود في قاعدة البيانات');
          }
          const currentPlace = placeSnap.data() as Place;
          const payload = sub.payload || {};

          const changes: Record<string, string | number | boolean> = {};
          const prevSnapshot: Record<string, string | number | boolean> = { ...(sub.previousData || {}) };

          for (const [key, value] of Object.entries(payload)) {
            if (!CORRECTION_ALLOWLIST.has(key)) continue;
            if (typeof value === 'string' && value.trim()) {
              let cleanVal = value.trim();
              if (key === 'phone' || key === 'whatsapp') {
                const phoneRes = validateEgyptPhone(cleanVal, { allowLandline: true });
                if (!phoneRes.valid) {
                  throw new Error(phoneRes.error || 'رقم الهاتف في البلاغ غير صالح للتطبيق');
                }
                cleanVal = phoneRes.displayLocal;
              }
              const existingVal = (currentPlace as unknown as Record<string, unknown>)[key];
              if (typeof existingVal === 'string' || typeof existingVal === 'number' || typeof existingVal === 'boolean') {
                prevSnapshot[key] = existingVal;
              }
              changes[key] = cleanVal;
            }
          }

          if (Object.keys(changes).length === 0) {
            throw new Error('لا توجد حقول قابلة للتطبيق التلقائي داخل هذا البلاغ.');
          }

          tx.update(placeRef, { ...changes, updatedAt: now });
          tx.update(subRef, {
            status: 'approved',
            applied: true,
            appliedChanges: changes,
            previousData: prevSnapshot,
            publishedTargetId: sub.targetPlaceId,
            reviewedBy: adminProfile?.name || user.email || 'إدارة الدليل',
            reviewedByUid: user.uid,
            reviewedAt: now,
            adminNote: adminNote?.trim() || 'تم التحقق وتطبيق التعديلات فعلياً على صفحة المكان.',
            updatedAt: now,
          });
        });

        refreshCatalog();
        showToast('تم اعتماد وتطبيق التصحيحات فعلياً على بيانات المكان مع حفظ السجل السابق', 'success');
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر تطبيق تعديلات البلاغ', 'error');
        return false;
      }
    },
    [isAdminWriter, user, adminProfile, refreshCatalog, showToast]
  );

  // Atomic, Idempotent Publish Place from Submission (prevents duplicates on double-click/retry)
  const publishSubmissionAsPlace = useCallback(
    async (submissionId: string, place: Place, adminNote?: string): Promise<boolean> => {
      if (!isAdminWriter || !user?.uid) {
        showToast('النشر متاح للمشرفين المصرح لهم بالتعديل فقط', 'error');
        return false;
      }
      const placeImageCheck = validateImageUrl(place.imageUrl);
      if (!placeImageCheck.valid) {
        showToast(placeImageCheck.error || 'رابط الصورة غير مقبول', 'error');
        return false;
      }
      const now = new Date().toISOString();
      const computedMap =
        place.menuItems && place.menuItems.length > 0 ? buildPlaceMenuPriceMap(place.menuItems) : undefined;
      const placePayload: Place = {
        ...place,
        menuPriceMap: computedMap,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await runTransaction(db, async (tx) => {
          const subRef = doc(db, 'submissions', submissionId);
          const subSnap = await tx.get(subRef);
          if (!subSnap.exists()) throw new Error('الطلب غير موجود');
          const sub = subSnap.data() as Submission;
          if (sub.publishedTargetId || sub.applied) {
            throw new Error('تم نشر هذا الطلب بالفعل مسبقاً ولا يمكن تكراره');
          }

          const placeRef = doc(db, 'places', place.id);
          tx.set(placeRef, stripUndefined(placePayload as unknown as Record<string, unknown>));

          if (place.categorySlug === 'medical') {
            const qRef = doc(db, 'clinic_queues', place.id);
            tx.set(
              qRef,
              stripUndefined({
                doctorId: place.id,
                doctorName: place.name,
                specialty: place.specialty || '',
                clinicAddress: place.address || '',
                sessionDate: getCairoDateString(),
                currentNumber: 0,
                lastTicketNumber: 0,
                status: 'open',
                avgMinutesPerPatient: 15,
                updatedAt: now,
              })
            );
          }

          tx.update(subRef, {
            status: 'approved',
            applied: true,
            publishedTargetId: place.id,
            reviewedBy: adminProfile?.name || user.email || 'إدارة الدليل',
            reviewedByUid: user.uid,
            reviewedAt: now,
            adminNote: adminNote?.trim() || 'تمت المراجعة ونشر النشاط رسمياً في دليل أبوحمص.',
            updatedAt: now,
          });
        });

        refreshCatalog();
        showToast(`تم اعتماد ونشر «${place.name}» بنجاح دون تكرار`, 'success');
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر نشر النشاط من الطلب', 'error');
        return false;
      }
    },
    [isAdminWriter, user, adminProfile, refreshCatalog, showToast]
  );

  // Atomic, Idempotent Publish Property from Submission
  const publishSubmissionAsProperty = useCallback(
    async (submissionId: string, property: Property, adminNote?: string): Promise<boolean> => {
      if (!isAdminWriter || !user?.uid) {
        showToast('النشر متاح للمشرفين المصرح لهم بالتعديل فقط', 'error');
        return false;
      }
      const propImageCheck = validateImageUrl(property.imageUrl);
      if (!propImageCheck.valid) {
        showToast(propImageCheck.error || 'رابط الصورة غير مقبول', 'error');
        return false;
      }
      const now = new Date().toISOString();
      const propPayload: Property = { ...property, createdAt: now };
      try {
        await runTransaction(db, async (tx) => {
          const subRef = doc(db, 'submissions', submissionId);
          const subSnap = await tx.get(subRef);
          if (!subSnap.exists()) throw new Error('الطلب غير موجود');
          const sub = subSnap.data() as Submission;
          if (sub.publishedTargetId || sub.applied) {
            throw new Error('تم نشر هذا العقار بالفعل مسبقاً ولا يمكن تكراره');
          }

          tx.set(doc(db, 'properties', property.id), stripUndefined(propPayload as unknown as Record<string, unknown>));
          tx.update(subRef, {
            status: 'approved',
            applied: true,
            publishedTargetId: property.id,
            reviewedBy: adminProfile?.name || user.email || 'إدارة الدليل',
            reviewedByUid: user.uid,
            reviewedAt: now,
            adminNote: adminNote?.trim() || 'تم اعتماد ونشر إعلان العقار في سوق عقارات أبوحمص.',
            updatedAt: now,
          });
        });

        refreshCatalog();
        showToast('تم اعتماد ونشر العقار بنجاح دون تكرار', 'success');
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'تعذر نشر العقار من الطلب', 'error');
        return false;
      }
    },
    [isAdminWriter, user, adminProfile, refreshCatalog, showToast]
  );

  const saveWhatsappQueueItem = useCallback(
    async (item: WhatsappQueueItem) => {
      try {
        await setDoc(
          doc(db, 'whatsapp_queue', item.id),
          stripUndefined({ ...item, createdAt: item.createdAt || new Date().toISOString() })
        );
        showToast('تمت الإضافة لطابور واتساب', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `whatsapp_queue/${item.id}`);
      }
    },
    [showToast]
  );

  const updateWhatsappStatus = useCallback(
    async (itemId: string, status: WhatsappQueueItem['status']) => {
      const target = whatsappQueue.find((w) => w.id === itemId);
      if (!target) return;
      const updated: WhatsappQueueItem = {
        ...target,
        status,
        sentAt: status === 'sent' ? new Date().toISOString() : target.sentAt,
      };
      try {
        await setDoc(doc(db, 'whatsapp_queue', itemId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم توثيق حالة التواصل في السجل', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `whatsapp_queue/${itemId}`);
      }
    },
    [whatsappQueue, showToast]
  );

  const saveFinanceConfig = useCallback(
    async (config: FinanceConfig) => {
      try {
        await setDoc(
          doc(db, 'finance_config', 'partners'),
          stripUndefined({ ...config, updatedAt: new Date().toISOString() })
        );
        showToast('تم حفظ نسب توزيع الشريكين للدورات القادمة بنجاح', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'finance_config/partners');
      }
    },
    [showToast]
  );

  const closeNewSettlement = useCallback(
    async (settlement: FinanceSettlement) => {
      try {
        await setDoc(
          doc(db, 'finance_settlements', settlement.id),
          stripUndefined(settlement as unknown as Record<string, unknown>)
        );
        showToast(`تم إقفال تسوية «${settlement.periodLabel}» وتثبيت نسبها التاريخية`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `finance_settlements/${settlement.id}`);
      }
    },
    [showToast]
  );

  const savePublicSettings = useCallback(
    async (nextSettings: PublicSettings) => {
      try {
        await setDoc(
          doc(db, 'public_settings', 'main'),
          stripUndefined({ ...nextSettings, updatedAt: new Date().toISOString() })
        );
        refreshCatalog();
        showToast('تم حفظ الإعدادات العامة للمنظومة', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'public_settings/main');
      }
    },
    [refreshCatalog, showToast]
  );

  const value: AppContextValue = {
    user,
    authReady,
    adminRole,
    adminProfile,
    isAdmin,
    isAdminWriter,
    isAuditor,
    isSuperAdmin,
    isPartner,
    partnerScopes,
    managedPlaceIds,
    canAccessPartnerScope,
    canManagePlace,
    signInError,
    clearSignInError,
    signInAdmin,
    signOutAdmin,
    adminsList,
    saveAdminUser,
    deleteAdminUser,
    categories,
    activeCategories,
    promoFilters,
    activePromoFilters,
    places,
    properties,
    agencies,
    offers,
    campaigns,
    emergencyContacts,
    settings,
    isCloudSeeded,
    isDemoPreviewMode,
    refreshCatalog,
    clinicTickets,
    restaurantOrders,
    deliveryRides,
    submissions,
    whatsappQueue,
    financeConfig,
    financeSettlements,
    analyticsEvents,
    hasMoreClinicTickets,
    loadMoreClinicTickets,
    hasMoreOrders,
    loadMoreOrders,
    hasMoreRides,
    loadMoreRides,
    hasMoreSubmissions,
    loadMoreSubmissions,
    hasMoreAnalytics,
    analyticsSampleLimit,
    loadMoreAnalytics,
    favorites,
    toggleFavorite,
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    activeTracker,
    setActiveTracker,
    toasts,
    showToast,
    dismissToast,
    bookClinicTicket,
    placeRestaurantOrder,
    createDeliveryRide,
    createSubmission,
    logAnalyticsEvent,
    updateClinicQueueState,
    callNextClinicTicket,
    resetClinicDaySession,
    updateClinicTicketStatus,
    claimRestaurantOrder,
    updateRestaurantOrderStatus,
    claimDeliveryRide,
    updateDeliveryRideStatus,
    seedCloudDatabase,
    initializeEssentialConfig,
    seedDemoCatalog,
    migrateRestaurantMenuPriceMaps,
    saveCategory,
    deleteCategory,
    reorderCategories,
    savePromoFilter,
    deletePromoFilter,
    reorderPromoFilters,
    togglePlacePromoFilter,
    setPlaceFilterExpiry,
    savePlace,
    deletePlace,
    saveProperty,
    deleteProperty,
    saveOffer,
    saveCampaign,
    updateSubmissionStatus,
    applyCorrectionSubmission,
    publishSubmissionAsPlace,
    publishSubmissionAsProperty,
    saveWhatsappQueueItem,
    updateWhatsappStatus,
    saveFinanceConfig,
    closeNewSettlement,
    savePublicSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
