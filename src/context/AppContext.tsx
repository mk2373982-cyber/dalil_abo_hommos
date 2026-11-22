import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  logFirestoreListenerError,
  loginWithGoogle,
  logoutUser,
  OperationType,
} from '../firebase';
import { generateSecureToken } from '../lib/formatters';
import { readOfflineCatalog, writeOfflineCatalog } from '../lib/offlineCache';
import { appendActivityHistory, saveCitizenProfile } from '../lib/citizenProfile';
import {
  SEED_AGENCIES,
  SEED_CAMPAIGNS,
  SEED_CATEGORIES,
  SEED_CLINIC_QUEUES,
  SEED_EMERGENCY,
  SEED_FINANCE_CONFIG,
  SEED_FINANCE_SETTLEMENTS,
  SEED_OFFERS,
  SEED_PLACES,
  SEED_PROMO_FILTERS,
  SEED_PROPERTIES,
  SEED_SETTINGS,
} from '../data/seedData';
import type {
  ActiveTracker,
  AdminRole,
  Agency,
  AnalyticsEvent,
  Campaign,
  CartItem,
  Category,
  ClinicQueue,
  ClinicTicket,
  DeliveryRide,
  EmergencyContact,
  FinanceConfig,
  FinanceSettlement,
  Offer,
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

interface AppContextValue {
  // Auth
  user: User | null;
  authReady: boolean;
  adminRole: AdminRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPartner: boolean;
  signInAdmin: () => Promise<boolean>;
  signOutAdmin: () => Promise<void>;

  // Live Firestore Catalog
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
  clinicQueues: ClinicQueue[];
  settings: PublicSettings;
  isCloudSeeded: boolean;

  // Live Operational & Admin Streams (synced when admin/operator signed in)
  clinicTickets: ClinicTicket[];
  restaurantOrders: RestaurantOrder[];
  deliveryRides: DeliveryRide[];
  submissions: Submission[];
  whatsappQueue: WhatsappQueueItem[];
  financeConfig: FinanceConfig;
  financeSettlements: FinanceSettlement[];
  analyticsEvents: AnalyticsEvent[];

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

  // Partner Operational Console Mutations (Live Firestore)
  updateClinicQueueState: (doctorId: string, patch: Partial<ClinicQueue>) => Promise<void>;
  updateClinicTicketStatus: (ticketId: string, status: ClinicTicket['status']) => Promise<void>;
  updateRestaurantOrderStatus: (
    orderId: string,
    patch: Partial<Pick<RestaurantOrder, 'status' | 'captainName' | 'captainPhone'>>
  ) => Promise<void>;
  updateDeliveryRideStatus: (
    rideId: string,
    patch: Partial<Pick<DeliveryRide, 'status' | 'captainName' | 'captainPhone'>>
  ) => Promise<void>;

  // Admin Mutations (Live Firestore — 100% Dynamic)
  seedCloudDatabase: (force?: boolean) => Promise<void>;
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
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);

  const isSuperAdmin = adminRole === 'super_admin';
  const isAdmin = adminRole === 'super_admin' || adminRole === 'moderator' || adminRole === 'auditor';
  const isPartner = isAdmin || adminRole === 'partner';

  // Hydrate previously loaded public directory from device cache for instant offline browsing
  const cachedCatalog = useMemo(() => readOfflineCatalog(), []);

  // Cloud state (pre-hydrated from last synced offline snapshot if available, otherwise null until cloud loads)
  const [cloudCategories, setCloudCategories] = useState<Category[] | null>(
    () => (cachedCatalog?.categories?.length ? cachedCatalog.categories : null)
  );
  const [cloudPromoFilters, setCloudPromoFilters] = useState<PromoFilter[] | null>(
    () => (cachedCatalog?.promoFilters ? cachedCatalog.promoFilters : null)
  );
  const [cloudPlaces, setCloudPlaces] = useState<Place[] | null>(
    () => (cachedCatalog?.places ? cachedCatalog.places : null)
  );
  const [cloudProperties, setCloudProperties] = useState<Property[] | null>(
    () => (cachedCatalog?.properties ? cachedCatalog.properties : null)
  );
  const [cloudAgencies, setCloudAgencies] = useState<Agency[] | null>(
    () => (cachedCatalog?.agencies ? cachedCatalog.agencies : null)
  );
  const [cloudOffers, setCloudOffers] = useState<Offer[] | null>(
    () => (cachedCatalog?.offers ? cachedCatalog.offers : null)
  );
  const [cloudCampaigns, setCloudCampaigns] = useState<Campaign[] | null>(
    () => (cachedCatalog?.campaigns ? cachedCatalog.campaigns : null)
  );
  const [cloudEmergency, setCloudEmergency] = useState<EmergencyContact[] | null>(
    () => (cachedCatalog?.emergencyContacts ? cachedCatalog.emergencyContacts : null)
  );
  const [cloudQueues, setCloudQueues] = useState<ClinicQueue[] | null>(
    () => (cachedCatalog?.clinicQueues ? cachedCatalog.clinicQueues : null)
  );
  const [cloudSettings, setCloudSettings] = useState<PublicSettings | null>(
    () => (cachedCatalog?.settings ? cachedCatalog.settings : null)
  );

  // Operational & Admin collections (never pre-seeded with fake local data)
  const [clinicTickets, setClinicTickets] = useState<ClinicTicket[]>([]);
  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrder[]>([]);
  const [deliveryRides, setDeliveryRides] = useState<DeliveryRide[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [whatsappQueue, setWhatsappQueue] = useState<WhatsappQueueItem[]>([]);
  const [financeConfig, setFinanceConfig] = useState<FinanceConfig>(SEED_FINANCE_CONFIG);
  const [financeSettlements, setFinanceSettlements] = useState<FinanceSettlement[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);

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
  const seededOnceRef = useRef(false);

  const showToast = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setActiveTracker = useCallback((tracker: ActiveTracker | null) => {
    setActiveTrackerState(tracker);
    try {
      if (tracker) localStorage.setItem('abh_active_tracker', JSON.stringify(tracker));
      else localStorage.removeItem('abh_active_tracker');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Auth listener with RBAC role lookup
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setAdminRole(null);
        setAuthReady(true);
        return;
      }
      const isOwner =
        firebaseUser.emailVerified &&
        firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
      if (isOwner) {
        setAdminRole('super_admin');
        setAuthReady(true);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        if (adminSnap.exists()) {
          const role = (adminSnap.data() as { role?: AdminRole }).role;
          if (role === 'super_admin' || role === 'partner' || role === 'moderator' || role === 'auditor') {
            setAdminRole(role);
          } else {
            setAdminRole(null);
          }
        } else {
          setAdminRole(null);
        }
      } catch {
        setAdminRole(null);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Public real-time Firestore subscriptions (zero-login civic catalog)
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'categories'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
          list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          setCloudCategories(list);
          if (list.length > 0) writeOfflineCatalog({ categories: list });
        },
        (err) => console.warn('categories snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'promo_filters'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as PromoFilter), id: d.id }));
          list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          setCloudPromoFilters(list);
          writeOfflineCatalog({ promoFilters: list });
        },
        (err) => console.warn('promo_filters snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'places'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Place), id: d.id }));
          setCloudPlaces(list);
          writeOfflineCatalog({ places: list });
        },
        (err) => console.warn('places snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'properties'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Property), id: d.id }));
          setCloudProperties(list);
          writeOfflineCatalog({ properties: list });
        },
        (err) => console.warn('properties snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'agencies'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Agency), id: d.id }));
          setCloudAgencies(list);
          writeOfflineCatalog({ agencies: list });
        },
        (err) => console.warn('agencies snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'offers'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Offer), id: d.id }));
          setCloudOffers(list);
          writeOfflineCatalog({ offers: list });
        },
        (err) => console.warn('offers snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'campaigns'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Campaign), id: d.id }));
          list.sort((a, b) => a.slotNumber - b.slotNumber);
          setCloudCampaigns(list);
          writeOfflineCatalog({ campaigns: list });
        },
        (err) => console.warn('campaigns snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'emergency_contacts'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as EmergencyContact), id: d.id }));
          list.sort((a, b) => a.priority - b.priority);
          setCloudEmergency(list);
          writeOfflineCatalog({ emergencyContacts: list });
        },
        (err) => console.warn('emergency snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'clinic_queues'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as ClinicQueue), doctorId: d.id }));
          setCloudQueues(list);
          writeOfflineCatalog({ clinicQueues: list });
        },
        (err) => console.warn('clinic_queues snapshot warning:', err.message)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'public_settings', 'main'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as PublicSettings;
            setCloudSettings(data);
            writeOfflineCatalog({ settings: data });
          }
        },
        (err) => console.warn('public_settings snapshot warning:', err.message)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  // Increment public visits counter once per browser session when online and cloud settings exist
  useEffect(() => {
    if (!cloudSettings) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const sessionKey = 'abh_visit_counted_v1';
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      return;
    }
    const nextCount = (cloudSettings.visitsCount ?? 0) + 1;
    void updateDoc(doc(db, 'public_settings', 'main'), {
      visitsCount: nextCount,
    }).catch(() => {
      // Non-blocking: ignore offline or race conflicts
    });
  }, [cloudSettings]);

  // Partner Operational real-time streams (attached for partners + admins, bounded with limit())
  useEffect(() => {
    if (!authReady || !isPartner) {
      setClinicTickets([]);
      setRestaurantOrders([]);
      setDeliveryRides([]);
      return;
    }
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'clinic_tickets'), limit(150)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as ClinicTicket), id: d.id }));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setClinicTickets(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'clinic_tickets')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'restaurant_orders'), limit(150)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as RestaurantOrder), id: d.id }));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setRestaurantOrders(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'restaurant_orders')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'delivery_rides'), limit(150)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as DeliveryRide), id: d.id }));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setDeliveryRides(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'delivery_rides')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady, isPartner]);

  // Admin Panel real-time streams (attached only for super_admin / moderator / auditor)
  useEffect(() => {
    if (!authReady || !isAdmin) {
      setSubmissions([]);
      setWhatsappQueue([]);
      setAnalyticsEvents([]);
      return;
    }
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'submissions'), limit(200)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Submission), id: d.id }));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setSubmissions(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'submissions')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'whatsapp_queue'), limit(150)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as WhatsappQueueItem), id: d.id }));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setWhatsappQueue(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'whatsapp_queue')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'analytics_events'), limit(300)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as AnalyticsEvent), id: d.id }));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setAnalyticsEvents(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'analytics_events')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady, isAdmin]);

  // Finance real-time streams (strictly super_admin or auditor)
  const canReadFinance = isSuperAdmin || adminRole === 'auditor';
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
        query(collection(db, 'finance_settlements'), limit(100)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as FinanceSettlement), id: d.id }));
          setFinanceSettlements(list);
        },
        (error) => logFirestoreListenerError(error, OperationType.LIST, 'finance_settlements')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady, canReadFinance]);

  // Seed Firestore automatically once when a Super Admin signs in and cloud catalog is still empty
  const seedCloudDatabase = useCallback(
    async (force = false) => {
      if (!isSuperAdmin) {
        showToast('مزامنة بيانات التأسيس متاحة لصلاحية المشرف العام فقط', 'error');
        return;
      }
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();

        if (force || !cloudCategories || cloudCategories.length === 0) {
          SEED_CATEGORIES.forEach((c) => {
            batch.set(doc(db, 'categories', c.id), stripUndefined({ ...c, updatedAt: now }));
          });
        }
        if (force || !cloudPromoFilters || cloudPromoFilters.length === 0) {
          SEED_PROMO_FILTERS.forEach((pf) => {
            batch.set(doc(db, 'promo_filters', pf.id), stripUndefined({ ...pf, updatedAt: now }));
          });
        }
        if (force || !cloudPlaces || cloudPlaces.length === 0) {
          SEED_PLACES.forEach((p) => {
            batch.set(doc(db, 'places', p.id), stripUndefined({ ...p, createdAt: now, updatedAt: now }));
          });
        }
        if (force || !cloudAgencies || cloudAgencies.length === 0) {
          SEED_AGENCIES.forEach((a) => {
            batch.set(doc(db, 'agencies', a.id), stripUndefined({ ...a }));
          });
        }
        if (force || !cloudProperties || cloudProperties.length === 0) {
          SEED_PROPERTIES.forEach((prop) => {
            batch.set(doc(db, 'properties', prop.id), stripUndefined({ ...prop, createdAt: now }));
          });
        }
        if (force || !cloudOffers || cloudOffers.length === 0) {
          SEED_OFFERS.forEach((o) => {
            batch.set(doc(db, 'offers', o.id), stripUndefined({ ...o }));
          });
        }
        if (force || !cloudCampaigns || cloudCampaigns.length === 0) {
          SEED_CAMPAIGNS.forEach((camp) => {
            batch.set(doc(db, 'campaigns', camp.id), stripUndefined({ ...camp }));
          });
        }
        if (force || !cloudEmergency || cloudEmergency.length === 0) {
          SEED_EMERGENCY.forEach((em) => {
            batch.set(doc(db, 'emergency_contacts', em.id), stripUndefined({ ...em }));
          });
        }
        if (force || !cloudQueues || cloudQueues.length === 0) {
          SEED_CLINIC_QUEUES.forEach((q) => {
            batch.set(doc(db, 'clinic_queues', q.doctorId), stripUndefined({ ...q, updatedAt: now }));
          });
        }
        if (!cloudSettings) {
          batch.set(doc(db, 'public_settings', 'main'), stripUndefined({ ...SEED_SETTINGS, updatedAt: now }));
        }
        // NEVER overwrite existing partner finance configuration or immutable closed settlements
        const finSnap = await getDoc(doc(db, 'finance_config', 'partners'));
        if (!finSnap.exists()) {
          batch.set(doc(db, 'finance_config', 'partners'), stripUndefined({ ...SEED_FINANCE_CONFIG, updatedAt: now }));
        }
        for (const s of SEED_FINANCE_SETTLEMENTS) {
          const sSnap = await getDoc(doc(db, 'finance_settlements', s.id));
          if (!sSnap.exists()) {
            batch.set(doc(db, 'finance_settlements', s.id), stripUndefined({ ...s }));
          }
        }

        await batch.commit();
        showToast('تمت مزامنة بيانات دليل أبوحمص مع Firebase بنجاح', 'success');
      } catch (error) {
        showToast('تعذرت مزامنة بعض البيانات مع السحابة، يرجى التحقق من الصلاحيات', 'error');
        handleFirestoreError(error, OperationType.WRITE, 'seedCloudDatabase');
      }
    },
    [
      isSuperAdmin,
      cloudCategories,
      cloudPromoFilters,
      cloudPlaces,
      cloudAgencies,
      cloudProperties,
      cloudOffers,
      cloudCampaigns,
      cloudEmergency,
      cloudQueues,
      cloudSettings,
      showToast,
    ]
  );

  useEffect(() => {
    if (isSuperAdmin && cloudCategories !== null && cloudCategories.length === 0 && !seededOnceRef.current) {
      seededOnceRef.current = true;
      void seedCloudDatabase(false);
    }
  }, [isSuperAdmin, cloudCategories, seedCloudDatabase]);

  // Cloud-seeded detection: once cloud has been initialized, empty collections stay empty instead of resurrecting seed items
  const isCloudSeeded = Boolean(cloudCategories && cloudCategories.length > 0);

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
  const clinicQueues = useMemo(
    () => (cloudQueues !== null && (cloudQueues.length > 0 || isCloudSeeded) ? cloudQueues : SEED_CLINIC_QUEUES),
    [cloudQueues, isCloudSeeded]
  );
  const settings = useMemo(() => cloudSettings || SEED_SETTINGS, [cloudSettings]);

  // Auth helpers
  const signInAdmin = useCallback(async () => {
    try {
      const signedUser = await loginWithGoogle();
      const isOwner =
        signedUser.emailVerified &&
        signedUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
      if (isOwner) {
        setAdminRole('super_admin');
        showToast(`أهلاً بك ${signedUser.displayName || 'في بوابة الإدارة'}`, 'success');
        return true;
      }
      const snap = await getDoc(doc(db, 'admins', signedUser.uid));
      if (snap.exists()) {
        const role = (snap.data() as { role?: AdminRole }).role;
        if (role === 'super_admin' || role === 'partner' || role === 'moderator' || role === 'auditor') {
          setAdminRole(role);
          showToast('تم التحقق من صلاحية الحساب بنجاح', 'success');
          return true;
        }
      }
      showToast('هذا الحساب غير مسجل ضمن المشرفين أو المشغلين المعتمدين للدليل', 'error');
      return false;
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      showToast('تعذر إتمام تسجيل الدخول عبر Google', 'error');
      return false;
    }
  }, [showToast]);

  const signOutAdmin = useCallback(async () => {
    await logoutUser();
    setAdminRole(null);
    showToast('تم تسجيل الخروج بأمان', 'info');
  }, [showToast]);

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
          ? baseItems.map((i) => (i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i))
          : [...baseItems, { ...item, quantity: 1 }];
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
        .map((i) => (i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i))
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

  const logAnalyticsEvent = useCallback(async (event: Omit<AnalyticsEvent, 'createdAt'>) => {
    try {
      const id = generateSafeId('EVT');
      await setDoc(
        doc(db, 'analytics_events', id),
        stripUndefined({
          ...event,
          createdAt: new Date().toISOString(),
        })
      );
    } catch {
      // Non-blocking analytics
    }
  }, []);

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
      const now = new Date().toISOString();
      const fallbackQueue = clinicQueues.find((q) => q.doctorId === input.doctorId);
      const fallbackLast = fallbackQueue?.lastTicketNumber ?? 8;
      const ticketId = generateSafeId('TKT');
      const queueRef = doc(db, 'clinic_queues', input.doctorId);
      const ticketRef = doc(db, 'clinic_tickets', ticketId);

      let createdTicket: ClinicTicket;
      try {
        createdTicket = await runTransaction(db, async (tx) => {
          const qSnap = await tx.get(queueRef);
          const nextNumber = qSnap.exists()
            ? ((qSnap.data() as ClinicQueue).lastTicketNumber ?? 0) + 1
            : fallbackLast + 1;

          const ticket: ClinicTicket = {
            id: ticketId,
            ticketCode: ticketId,
            ticketNumber: nextNumber,
            doctorId: input.doctorId,
            doctorName: input.doctorName,
            patientName: input.patientName.trim(),
            patientPhone: input.patientPhone.trim(),
            visitType: input.visitType,
            fee: input.fee,
            status: 'waiting',
            notes: input.notes?.trim() || '',
            createdAt: now,
            updatedAt: now,
          };

          tx.set(ticketRef, stripUndefined(ticket as unknown as Record<string, unknown>));
          if (qSnap.exists()) {
            tx.update(queueRef, {
              lastTicketNumber: nextNumber,
              updatedAt: now,
            });
          }
          return ticket;
        });
      } catch (error) {
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
        subtitle: `${input.visitType} · ${input.fee} ج.م`,
        route: `/medical/live-queue/${createdTicket.id}`,
      });
      saveCitizenProfile({ name: input.patientName, phone: input.patientPhone });
      return createdTicket;
    },
    [clinicQueues, setActiveTracker]
  );

  const placeRestaurantOrder = useCallback(
    async (input: {
      restaurantId: string;
      restaurantName: string;
      customerName: string;
      customerPhone: string;
      deliveryArea: string;
      deliveryAddress: string;
      locationShared: boolean;
      items: CartItem[];
      subtotal: number;
      deliveryFee: number;
      total: number;
      notes?: string;
    }): Promise<RestaurantOrder> => {
      const now = new Date().toISOString();
      const orderId = generateSafeId('ORD');
      const order: RestaurantOrder = {
        id: orderId,
        orderCode: orderId,
        restaurantId: input.restaurantId,
        restaurantName: input.restaurantName,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        deliveryArea: input.deliveryArea,
        deliveryAddress: input.deliveryAddress.trim(),
        locationShared: input.locationShared,
        items: input.items,
        subtotal: input.subtotal,
        deliveryFee: input.deliveryFee,
        total: input.total,
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
        title: `طلب من ${input.restaurantName}`,
        route: `/orders/tracking/${orderId}`,
      });
      appendActivityHistory({
        type: 'order',
        code: orderId,
        title: `طلب من ${input.restaurantName}`,
        subtitle: `${input.items.length} أصناف · ${input.total} ج.م`,
        route: `/orders/tracking/${orderId}`,
      });
      saveCitizenProfile({
        name: input.customerName,
        phone: input.customerPhone,
        area: input.deliveryArea,
        address: input.deliveryAddress,
      });
      return order;
    },
    [clearCart, setActiveTracker]
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
        customerPhone: input.customerPhone.trim(),
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
        phone: input.customerPhone,
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
      const now = new Date().toISOString();
      const token = generateSafeId('TRK');
      const submission: Submission = {
        id: token,
        trackingToken: token,
        type: input.type,
        targetPlaceId: input.targetPlaceId,
        title: input.title.trim(),
        submitterName: input.submitterName.trim(),
        submitterPhone: input.submitterPhone.trim(),
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
        phone: input.submitterPhone,
      });
      return submission;
    },
    []
  );

  // --- Partner & Admin Live Mutations ---

  const updateClinicQueueState = useCallback(
    async (doctorId: string, patch: Partial<ClinicQueue>) => {
      const existingQueue = clinicQueues.find((q) => q.doctorId === doctorId);
      if (!existingQueue) return;
      const updated: ClinicQueue = {
        ...existingQueue,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'clinic_queues', doctorId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم تحديث حالة طابور العيادة لحظياً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `clinic_queues/${doctorId}`);
      }
    },
    [clinicQueues, showToast]
  );

  const updateClinicTicketStatus = useCallback(
    async (ticketId: string, status: ClinicTicket['status']) => {
      const target = clinicTickets.find((t) => t.id === ticketId);
      if (!target) return;
      const updated: ClinicTicket = { ...target, status, updatedAt: new Date().toISOString() };
      try {
        await setDoc(doc(db, 'clinic_tickets', ticketId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم تحديث حالة المريض فوراً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `clinic_tickets/${ticketId}`);
      }
    },
    [clinicTickets, showToast]
  );

  const updateRestaurantOrderStatus = useCallback(
    async (
      orderId: string,
      patch: Partial<Pick<RestaurantOrder, 'status' | 'captainName' | 'captainPhone'>>
    ) => {
      const target = restaurantOrders.find((o) => o.id === orderId);
      if (!target) return;
      const updated: RestaurantOrder = { ...target, ...patch, updatedAt: new Date().toISOString() };
      try {
        await setDoc(doc(db, 'restaurant_orders', orderId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم تحديث حالة الطلب وإبلاغ العميل لحظياً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `restaurant_orders/${orderId}`);
      }
    },
    [restaurantOrders, showToast]
  );

  const updateDeliveryRideStatus = useCallback(
    async (
      rideId: string,
      patch: Partial<Pick<DeliveryRide, 'status' | 'captainName' | 'captainPhone'>>
    ) => {
      const target = deliveryRides.find((r) => r.id === rideId);
      if (!target) return;
      const updated: DeliveryRide = { ...target, ...patch, updatedAt: new Date().toISOString() };
      try {
        await setDoc(doc(db, 'delivery_rides', rideId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم تحديث حالة المشوار لدى العميل مباشرة', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `delivery_rides/${rideId}`);
      }
    },
    [deliveryRides, showToast]
  );

  // Dynamic Categories CRUD + Reorder (User Requested Feature!)
  const saveCategory = useCallback(
    async (category: Category) => {
      const payload: Category = {
        ...category,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'categories', category.id), stripUndefined(payload as unknown as Record<string, unknown>));
        showToast(`تم حفظ قسم «${category.name}» ومزامنته فوراً`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `categories/${category.id}`);
      }
    },
    [showToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
        showToast('تم حذف القسم نهائياً من قاعدة البيانات', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
      }
    },
    [showToast]
  );

  const reorderCategories = useCallback(
    async (orderedIds: string[]) => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        orderedIds.forEach((id, index) => {
          const cat = categories.find((c) => c.id === id);
          if (cat) {
            batch.set(
              doc(db, 'categories', id),
              stripUndefined({ ...cat, order: index + 1, updatedAt: now })
            );
          }
        });
        await batch.commit();
        showToast('تم تحديث ترتيب الأقسام في الرئيسية فوراً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'categories/reorder');
      }
    },
    [categories, showToast]
  );

  // Dynamic Promotional Filters & Badges CRUD + Reorder + 1-Click Subscriber Toggle
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
        showToast(`تم حفظ فلتر التمييز «${filter.name}» ومزامنته فوراً`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `promo_filters/${filter.id}`);
      }
    },
    [showToast]
  );

  const deletePromoFilter = useCallback(
    async (filterId: string) => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        batch.delete(doc(db, 'promo_filters', filterId));

        // Clean orphaned references from subscribed places
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
        showToast('تم حذف فلتر التمييز وتنظيف ارتباطاته نهائياً', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `promo_filters/${filterId}`);
      }
    },
    [places, showToast]
  );

  const reorderPromoFilters = useCallback(
    async (orderedIds: string[]) => {
      try {
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        orderedIds.forEach((id, index) => {
          const pf = promoFilters.find((f) => f.id === id);
          if (pf) {
            batch.set(
              doc(db, 'promo_filters', id),
              stripUndefined({ ...pf, order: index + 1, updatedAt: now })
            );
          }
        });
        await batch.commit();
        showToast('تم تحديث ترتيب فلاتر التمييز فوراً', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'promo_filters/reorder');
      }
    },
    [promoFilters, showToast]
  );

  const togglePlacePromoFilter = useCallback(
    async (placeId: string, filterId: string, expiresAt?: string) => {
      const target = places.find((p) => p.id === placeId);
      if (!target) return;
      const currentTags = Array.isArray(target.filterTags) ? target.filterTags : [];
      const exists = currentTags.includes(filterId);
      const nextTags = exists
        ? currentTags.filter((id) => id !== filterId)
        : [...currentTags.slice(0, 14), filterId];
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
        showToast(
          exists
            ? `تمت إزالة «${target.name}» من الفلتر`
            : `تم تسكين «${target.name}» داخل الفلتر بنجاح`,
          exists ? 'info' : 'success'
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `places/${placeId}`);
      }
    },
    [places, showToast]
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
        showToast('تم تحديث تاريخ انتهاء اشتراك الشارة', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `places/${placeId}`);
      }
    },
    [places, showToast]
  );

  const savePlace = useCallback(
    async (place: Place) => {
      const now = new Date().toISOString();
      const payload: Place = { ...place, updatedAt: now, createdAt: place.createdAt || now };
      try {
        await setDoc(doc(db, 'places', place.id), stripUndefined(payload as unknown as Record<string, unknown>));
        showToast(`تم حفظ «${place.name}» ونشره في الدليل`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `places/${place.id}`);
      }
    },
    [showToast]
  );

  const deletePlace = useCallback(
    async (placeId: string) => {
      try {
        await deleteDoc(doc(db, 'places', placeId));
        showToast('تم حذف المكان من الدليل', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `places/${placeId}`);
      }
    },
    [showToast]
  );

  const saveProperty = useCallback(
    async (property: Property) => {
      const payload: Property = { ...property, createdAt: property.createdAt || new Date().toISOString() };
      try {
        await setDoc(doc(db, 'properties', property.id), stripUndefined(payload as unknown as Record<string, unknown>));
        showToast('تم حفظ إعلان العقار بنجاح', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `properties/${property.id}`);
      }
    },
    [showToast]
  );

  const deleteProperty = useCallback(
    async (propertyId: string) => {
      try {
        await deleteDoc(doc(db, 'properties', propertyId));
        showToast('تم حذف إعلان العقار', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `properties/${propertyId}`);
      }
    },
    [showToast]
  );

  const saveOffer = useCallback(
    async (offer: Offer) => {
      try {
        await setDoc(doc(db, 'offers', offer.id), stripUndefined(offer as unknown as Record<string, unknown>));
        showToast(`تم حفظ التخفيض «${offer.title}»`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `offers/${offer.id}`);
      }
    },
    [showToast]
  );

  const saveCampaign = useCallback(
    async (campaign: Campaign) => {
      try {
        await setDoc(doc(db, 'campaigns', campaign.id), stripUndefined(campaign as unknown as Record<string, unknown>));
        showToast('تم تحديث كرسي الواجهة الترويجي بنجاح', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `campaigns/${campaign.id}`);
      }
    },
    [showToast]
  );

  const updateSubmissionStatus = useCallback(
    async (submissionId: string, status: Submission['status'], adminNote?: string) => {
      const target = submissions.find((s) => s.id === submissionId);
      if (!target) return;
      const updated: Submission = {
        ...target,
        status,
        adminNote: adminNote ?? target.adminNote,
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'submissions', submissionId), stripUndefined(updated as unknown as Record<string, unknown>));
        showToast('تم تحديث حالة الطلب وانعكس في رابط المتابعة الخاص بالعميل', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `submissions/${submissionId}`);
      }
    },
    [submissions, showToast]
  );

  const saveWhatsappQueueItem = useCallback(
    async (item: WhatsappQueueItem) => {
      try {
        await setDoc(doc(db, 'whatsapp_queue', item.id), stripUndefined({ ...item, createdAt: item.createdAt || new Date().toISOString() }));
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
        showToast('تم حفظ الإعدادات العامة للمنظومة', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'public_settings/main');
      }
    },
    [showToast]
  );

  const value: AppContextValue = {
    user,
    authReady,
    adminRole,
    isAdmin,
    isSuperAdmin,
    isPartner,
    signInAdmin,
    signOutAdmin,
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
    clinicQueues,
    settings,
    isCloudSeeded,
    clinicTickets,
    restaurantOrders,
    deliveryRides,
    submissions,
    whatsappQueue,
    financeConfig,
    financeSettlements,
    analyticsEvents,
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
    updateClinicTicketStatus,
    updateRestaurantOrderStatus,
    updateDeliveryRideStatus,
    seedCloudDatabase,
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
