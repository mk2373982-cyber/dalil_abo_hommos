import type {
  Agency,
  Campaign,
  Category,
  ClinicQueue,
  EmergencyContact,
  Offer,
  Place,
  PromoFilter,
  Property,
  PublicSettings,
} from '../types';

export interface OfflineCatalogSnapshot {
  categories?: Category[];
  promoFilters?: PromoFilter[];
  places?: Place[];
  properties?: Property[];
  agencies?: Agency[];
  offers?: Offer[];
  campaigns?: Campaign[];
  emergencyContacts?: EmergencyContact[];
  clinicQueues?: ClinicQueue[];
  settings?: PublicSettings;
  cachedAt: string;
}

const OFFLINE_CATALOG_STORAGE_KEY = 'abh_offline_catalog_v1';

/**
 * Reads the last synced public directory snapshot from localStorage so citizens can
 * browse previously loaded places, categories, offers, and services immediately offline.
 */
export function readOfflineCatalog(storage?: Pick<Storage, 'getItem'>): OfflineCatalogSnapshot | null {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!store) return null;
    const raw = store.getItem(OFFLINE_CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineCatalogSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Merges and persists public catalog slices into localStorage with graceful QuotaExceeded handling.
 */
export function writeOfflineCatalog(
  patch: Partial<Omit<OfflineCatalogSnapshot, 'cachedAt'>>,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!store) return false;
    const existing = readOfflineCatalog(store) || { cachedAt: new Date().toISOString() };
    const next: OfflineCatalogSnapshot = {
      ...existing,
      ...patch,
      cachedAt: new Date().toISOString(),
    };
    store.setItem(OFFLINE_CATALOG_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    // Gracefully ignore storage quota or private-mode restriction errors
    return false;
  }
}
