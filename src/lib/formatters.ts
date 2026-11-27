import type { Offer, Place } from '../types';
import { normalizeArabicDigits } from './arabicSearch';

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

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  displayLocal: string;
  error?: string;
}

/**
 * Normalizes Egyptian local/international phone numbers (including Arabic-Indic ٠-٩ and Persian ۰-۹ digits)
 * into wa.me international digits format (e.g. 201012345678 or 20452560110).
 * Returns empty string for empty or invalid short inputs.
 */
export function formatEgyptWhatsApp(raw?: string): string {
  if (!raw) return '';
  const ascii = normalizeArabicDigits(raw).trim();
  let digits = ascii.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Already prefixed with Egypt country code 20
  if (digits.startsWith('20')) {
    // Handle common mistake: +20 010xxxxxxxx -> 20010xxxxxxxx
    if (digits.startsWith('200') && digits.length === 13 && /^2001[0125]\d{8}$/.test(digits)) {
      return `20${digits.slice(3)}`;
    }
    if (digits.startsWith('200') && digits.length >= 11 && digits.length <= 12) {
      return `20${digits.slice(3)}`;
    }
    if (/^201[0125]\d{8}$/.test(digits)) {
      return digits;
    }
    // Egyptian landlines with country code (e.g. 20452560110 or 202xxxxxxxx)
    if (digits.length >= 10 && digits.length <= 12) {
      return digits;
    }
    return '';
  }

  // Local Egyptian mobile: 010 / 011 / 012 / 015 (11 digits)
  if (/^01[0125]\d{8}$/.test(digits)) {
    return `20${digits.slice(1)}`;
  }

  // Mobile without leading zero: 10 / 11 / 12 / 15 (10 digits)
  if (/^1[0125]\d{8}$/.test(digits)) {
    return `20${digits}`;
  }

  // Egyptian landline with leading 0 (e.g., 0452560110 -> 20452560110, 9-10 digits)
  if (/^0[2-9]\d{7,8}$/.test(digits)) {
    return `20${digits.slice(1)}`;
  }

  return '';
}

/**
 * Validates Egyptian mobile or landline phone input (supports Arabic-Indic digits, +20, 0020, 01x, landlines).
 */
export function validateEgyptPhone(
  raw?: string,
  options: { allowLandline?: boolean; allowHotline?: boolean } = {}
): PhoneValidationResult {
  const { allowLandline = true, allowHotline = false } = options;
  if (!raw || !raw.trim()) {
    return {
      valid: false,
      normalized: '',
      displayLocal: '',
      error: 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)',
    };
  }

  const ascii = normalizeArabicDigits(raw).trim();
  const digits = ascii.replace(/\D/g, '');

  if (allowHotline && /^\d{3,5}$/.test(digits)) {
    return { valid: true, normalized: digits, displayLocal: digits };
  }

  const normalized = formatEgyptWhatsApp(ascii);
  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      displayLocal: '',
      error: 'رقم الهاتف غير صحيح. يرجى إدخال رقم موبايل مصري (010/011/012/015) أو خط أرضي صحيح.',
    };
  }

  const isMobile = /^201[0125]\d{8}$/.test(normalized);
  if (!isMobile && !allowLandline) {
    return {
      valid: false,
      normalized: '',
      displayLocal: '',
      error: 'يرجى إدخال رقم موبايل مصري صالح يبدأ بـ 010 أو 011 أو 012 أو 015.',
    };
  }

  const displayLocal = `0${normalized.slice(2)}`;
  return { valid: true, normalized, displayLocal };
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

export interface ImageUrlValidationResult {
  valid: boolean;
  url: string;
  error?: string;
}

/**
 * Validates a user-supplied image URL so only safe values are accepted:
 * - empty string is valid (optional field)
 * - same-origin relative paths (e.g. "/src/assets/...") are allowed for seeded content
 * - absolute URLs MUST use https:// and carry a real hostname
 * - javascript:, data:, vbscript:, and other non-https schemes are rejected
 *
 * This mirrors the Google Maps URL validator's strictness for user-generated links.
 */
export function validateImageUrl(raw?: string): ImageUrlValidationResult {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { valid: true, url: '' };

  // Same-origin relative asset paths are safe and used by seeded data.
  if (trimmed.startsWith('/')) return { valid: true, url: trimmed };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      url: '',
      error: 'رابط الصورة غير صالح. يرجى استخدام رابط https:// صحيح أو رفع الصورة مباشرة.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      url: '',
      error: 'يجب أن يبدأ رابط الصورة بـ https:// (غير مسموح بـ javascript: أو data:).',
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || !host.includes('.')) {
    return {
      valid: false,
      url: '',
      error: 'رابط الصورة غير صالح. يرجى استخدام رابط https:// صحيح.',
    };
  }

  return { valid: true, url: trimmed };
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
