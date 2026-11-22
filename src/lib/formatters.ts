import type { Offer, Place } from '../types';

const TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically strong, URL-safe, unguessable tracking/document ID
 * (~100 bits of entropy across 20 unambiguous characters + prefix).
 */
export function generateSecureToken(prefix: string, length = 20): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Secure random generator is unavailable in this environment');
  }

  let body = '';
  for (let i = 0; i < length; i++) {
    body += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return `${prefix}-${body}`;
}

/**
 * Normalizes Egyptian local/international phone numbers into wa.me international digits format (e.g. 2010xxxxxxxx).
 */
export function formatEgyptWhatsApp(raw?: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('20') && digits.length >= 11) {
    return digits;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `20${digits.slice(1)}`;
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    return `20${digits.slice(1)}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `20${digits}`;
  }
  return digits;
}

/**
 * Builds a valid WhatsApp click-to-chat URL with normalized Egyptian country code and optional prefilled message.
 */
export function buildWhatsAppUrl(raw?: string, message?: string): string {
  const normalized = formatEgyptWhatsApp(raw);
  const base = normalized ? `https://wa.me/${normalized}` : 'https://wa.me/';
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}

/**
 * Determines whether an offer is expired based on its active flag and expiresAt ISO date/datetime.
 * Date-only values (YYYY-MM-DD) remain valid through the end of that day.
 */
export function isOfferExpired(
  offer: Pick<Offer, 'active' | 'expiresAt'>,
  nowMs: number = Date.now()
): boolean {
  if (!offer.active) return true;
  if (!offer.expiresAt || !offer.expiresAt.trim()) return false;

  const trimmed = offer.expiresAt.trim();
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsed = Date.parse(isDateOnly ? `${trimmed}T23:59:59.999` : trimmed);
  if (Number.isNaN(parsed)) return false;
  return parsed < nowMs;
}

/**
 * Parses a single RFC-4180 CSV line supporting quoted fields, embedded commas, and escaped double quotes ("").
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Maps any Place to its canonical public detail route based on categorySlug.
 */
export function getPlaceDetailRoute(place: Pick<Place, 'id' | 'categorySlug'>): string {
  if (place.categorySlug === 'medical') return `/medical/doctors/${place.id}`;
  if (place.categorySlug === 'restaurants') return `/restaurants/${place.id}`;
  if (place.categorySlug === 'heroes') return `/heroes/${place.id}`;
  return `/places/${place.id}`;
}
