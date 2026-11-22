/**
 * 100% client-side Citizen Quick Profile & Activity History (localStorage).
 * Saves citizen time across forms and keeps track of bookings/orders with ZERO extra server reads or writes.
 */

export interface CitizenProfile {
  name: string;
  phone: string;
  area: string;
  address: string;
}

export type ActivityRecordType = 'clinic' | 'order' | 'delivery' | 'submission';

export interface ActivityRecord {
  id: string;
  type: ActivityRecordType;
  code: string;
  title: string;
  subtitle?: string;
  route: string;
  createdAt: string;
}

const PROFILE_KEY = 'abh_citizen_profile_v1';
const ACTIVITY_KEY = 'abh_citizen_activity_v1';
const MAX_ACTIVITY_ITEMS = 30;

const EMPTY_PROFILE: CitizenProfile = {
  name: '',
  phone: '',
  area: '',
  address: '',
};

export function readCitizenProfile(): CitizenProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...EMPTY_PROFILE };
    const parsed = JSON.parse(raw) as Partial<CitizenProfile>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      area: typeof parsed.area === 'string' ? parsed.area : '',
      address: typeof parsed.address === 'string' ? parsed.address : '',
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveCitizenProfile(patch: Partial<CitizenProfile>): CitizenProfile {
  const current = readCitizenProfile();
  const next: CitizenProfile = {
    name: patch.name !== undefined && patch.name.trim() ? patch.name.trim() : current.name,
    phone: patch.phone !== undefined && patch.phone.trim() ? patch.phone.trim() : current.phone,
    area: patch.area !== undefined && patch.area.trim() ? patch.area.trim() : current.area,
    address: patch.address !== undefined && patch.address.trim() ? patch.address.trim() : current.address,
  };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota
  }
  return next;
}

export function replaceCitizenProfile(profile: CitizenProfile): CitizenProfile {
  const clean: CitizenProfile = {
    name: profile.name.trim(),
    phone: profile.phone.trim(),
    area: profile.area.trim(),
    address: profile.address.trim(),
  };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(clean));
  } catch {
    // ignore
  }
  return clean;
}

export function clearCitizenProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function readActivityHistory(): ActivityRecord[] {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ActivityRecord =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.route === 'string'
    );
  } catch {
    return [];
  }
}

export function appendActivityHistory(record: Omit<ActivityRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): ActivityRecord[] {
  const existing = readActivityHistory();
  const id = record.id || `${record.type}_${record.code}_${Date.now()}`;
  const entry: ActivityRecord = {
    id,
    type: record.type,
    code: record.code,
    title: record.title,
    subtitle: record.subtitle,
    route: record.route,
    createdAt: record.createdAt || new Date().toISOString(),
  };
  const deduped = existing.filter((item) => !(item.type === entry.type && item.code === entry.code));
  const next = [entry, ...deduped].slice(0, MAX_ACTIVITY_ITEMS);
  try {
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function removeActivityHistoryItem(id: string): ActivityRecord[] {
  const next = readActivityHistory().filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearActivityHistory(): void {
  try {
    window.localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // ignore
  }
}
