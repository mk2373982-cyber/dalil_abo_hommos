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
 * TTL for the cache-first public catalog snapshot. While `cachedAt` is fresh, app
 * load hydrates entirely from the cache and skips the network `getDocs` calls,
 * keeping Firestore read consumption well within free-tier limits.
 */
export const CATALOG_CACHE_TTL_MS = 7_200_000; // 2 hours

/** Throttle: skip redundant writes when content is unchanged or written very recently. */
const OFFLINE_WRITE_THROTTLE_MS = 60_000;

/** After a QuotaExceededError, stop hammering localStorage for a while. */
const OFFLINE_QUOTA_COOLDOWN_MS = 120_000;

let lastSerializedContent = '';
let lastWriteEpoch = 0;
let quotaCooldownUntil = 0;

/**
 * Returns true when the cached catalog snapshot is still within the TTL window,
 * i.e. `Date.now() - cachedAt < CATALOG_CACHE_TTL_MS`.
 */
export function isOfflineCatalogFresh(
  snapshot: OfflineCatalogSnapshot | null,
  now: number = Date.now()
): boolean {
  if (!snapshot || !snapshot.cachedAt) return false;
  const cachedAtMs = Date.parse(snapshot.cachedAt);
  if (Number.isNaN(cachedAtMs)) return false;
  return now - cachedAtMs < CATALOG_CACHE_TTL_MS;
}

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
 * Merges and persists the public catalog slice into localStorage with graceful
 * QuotaExceeded handling. The snapshot stores full documents (no field stripping)
 * because it is the primary hydration source for the TTL cache-first strategy —
 * stripping fields would break restaurant menus, descriptions, and gallery views
 * whenever the cache is fresh and the network fetch is skipped.
 *
 * Unchanged content is not re-written, and repeated quota failures trigger a
 * cooldown so snapshot ticks cannot thrash localStorage.
 */
export function writeOfflineCatalog(
  patch: Partial<Omit<OfflineCatalogSnapshot, 'cachedAt'>>,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): boolean {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!store) return false;
    const now = Date.now();
    if (now < quotaCooldownUntil) {
      // Recent quota failure — skip until the cooldown expires.
      return false;
    }

    const existing = readOfflineCatalog(store) || { cachedAt: new Date().toISOString() };
    const next: OfflineCatalogSnapshot = {
      ...existing,
      ...patch,
      cachedAt: new Date().toISOString(),
    };

    // Compare content excluding cachedAt (which changes on every call).
    const { cachedAt: _ignoredCachedAt, ...nextContent } = next;
    const serializedContent = JSON.stringify(nextContent);

    // Nothing changed since the last successful write — avoid redundant localStorage churn.
    if (serializedContent === lastSerializedContent && now - lastWriteEpoch < OFFLINE_WRITE_THROTTLE_MS) {
      return true;
    }

    store.setItem(OFFLINE_CATALOG_STORAGE_KEY, JSON.stringify(next));
    lastSerializedContent = serializedContent;
    lastWriteEpoch = now;
    return true;
  } catch {
    // Gracefully ignore storage quota or private-mode restriction errors;
    // pause further writes for a while so snapshot ticks cannot thrash storage.
    quotaCooldownUntil = Date.now() + OFFLINE_QUOTA_COOLDOWN_MS;
    return false;
  }
}
