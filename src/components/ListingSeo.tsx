import React, { useEffect } from 'react';
import type { WeeklySchedule } from '../types';
import { ORDERED_WEEKDAYS, parseHoursTextToSchedule } from '../lib/workingHours';

const DEFAULT_TITLE = 'دليل أبوحمص — الدليل والخدمات اليومية لأهالي أبوحمص';
const DEFAULT_DESC =
  'الدليل الرسمي والخدمات اليومية لأهالي مركز ومدينة أبوحمص والقرى المجاورة: أطباء، صيدليات، مطاعم، حرفيين، عقارات، دليفري، وعروض يومية.';

const WEEKDAY_EN_NAMES: Record<string, string> = {
  sat: 'Saturday',
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

export type ListingSeoSchemaType =
  | 'LocalBusiness'
  | 'Restaurant'
  | 'MedicalClinic'
  | 'Product'
  | 'WebPage';

export interface ListingSeoProps {
  /** JSON-LD schema type to inject (LocalBusiness/Restaurant/MedicalClinic for places, Product for property/offer, WebPage for listing pages). */
  type: ListingSeoSchemaType;
  title?: string;
  description?: string;
  /** App-relative canonical path, e.g. /places/abc123. */
  path?: string;
  /** Absolute URL override (e.g. share link). */
  url?: string;
  area?: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  hours?: string;
  workingSchedule?: WeeklySchedule;
  is24Hours?: boolean;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  /** For Product/Offer schemas: price as a plain numeric string, e.g. "225". */
  price?: string;
  currency?: string;
  /** For Offer schemas: discount percentage. */
  discountPercent?: number;
}

function setMetaTag(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute('content', content);
}

function buildOpeningHoursSpecification(
  hours?: string,
  workingSchedule?: WeeklySchedule,
  is24Hours?: boolean
): Array<Record<string, unknown>> | undefined {
  if (is24Hours) {
    return [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ORDERED_WEEKDAYS.map((d) => WEEKDAY_EN_NAMES[d]),
        opens: '00:00',
        closes: '24:00',
      },
    ];
  }

  const hasSlots =
    workingSchedule && ORDERED_WEEKDAYS.some((d) => Array.isArray(workingSchedule[d]));
  const schedule = hasSlots ? workingSchedule : parseHoursTextToSchedule(hours)?.schedule;
  if (!schedule) return undefined;

  const spec: Array<Record<string, unknown>> = [];
  for (const day of ORDERED_WEEKDAYS) {
    const slots = schedule[day] || [];
    if (slots.length === 0) continue;
    for (const slot of slots) {
      spec.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [WEEKDAY_EN_NAMES[day]],
        opens: slot.open,
        closes: slot.close,
      });
    }
  }
  return spec.length > 0 ? spec : undefined;
}

function buildJsonLd(props: ListingSeoProps, absoluteUrl?: string): Record<string, unknown> {
  const {
    type,
    title,
    description,
    area,
    address,
    phone,
    rating,
    reviewCount,
    hours,
    workingSchedule,
    is24Hours,
    lat,
    lng,
    imageUrl,
    price,
    currency,
    discountPercent,
  } = props;

  if (type === 'WebPage') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title || DEFAULT_TITLE,
      description: description || DEFAULT_DESC,
      ...(absoluteUrl ? { url: absoluteUrl } : {}),
      inLanguage: 'ar',
    };
  }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    name: title || DEFAULT_TITLE,
    description: description || DEFAULT_DESC,
  };
  if (absoluteUrl) schema.url = absoluteUrl;
  if (imageUrl) schema.image = imageUrl;
  if (phone) schema.telephone = phone;
  if (area || address) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(area ? { addressLocality: area } : {}),
      ...(address ? { streetAddress: address } : {}),
      addressCountry: 'EG',
    };
  }
  if (typeof lat === 'number' && typeof lng === 'number') {
    schema.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  }
  if (typeof rating === 'number' && rating > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      ratingCount: typeof reviewCount === 'number' ? reviewCount : 0,
    };
  }

  const openingHours = buildOpeningHoursSpecification(hours, workingSchedule, is24Hours);
  if (openingHours) schema.openingHoursSpecification = openingHours;

  if (type === 'Product' && price) {
    schema.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: currency || 'EGP',
      availability: 'https://schema.org/InStock',
      ...(typeof discountPercent === 'number' ? { discountPercent } : {}),
    };
  }

  return schema;
}

/**
 * Reusable dynamic SEO + structured-data component for listing and detail views.
 * Updates <title>, meta description, canonical URL, OpenGraph/Twitter tags, and injects
 * valid JSON-LD (LocalBusiness / Restaurant / MedicalClinic / Product / WebPage).
 * Renders nothing — all effects happen in the DOM.
 */
export const ListingSeo: React.FC<ListingSeoProps> = (props) => {
  useEffect(() => {
    const { title, description, path, url, imageUrl } = props;

    const fullTitle = title ? `${title} | دليل أبوحمص` : DEFAULT_TITLE;
    const desc = description?.trim() || DEFAULT_DESC;
    const absoluteUrl =
      url ||
      (typeof window !== 'undefined' && path
        ? `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
        : undefined);

    document.title = fullTitle;
    setMetaTag('meta[name="description"]', desc);
    setMetaTag('meta[property="og:title"]', fullTitle);
    setMetaTag('meta[property="og:description"]', desc);
    setMetaTag('meta[name="twitter:title"]', fullTitle);
    setMetaTag('meta[name="twitter:description"]', desc);
    setMetaTag('meta[name="twitter:card"]', 'summary_large_image');
    if (absoluteUrl) {
      setMetaTag('meta[property="og:url"]', absoluteUrl);
    }
    if (imageUrl) {
      setMetaTag('meta[property="og:image"]', imageUrl);
      setMetaTag('meta[name="twitter:image"]', imageUrl);
    }

    // Canonical link: update existing, create (and remove on cleanup) if missing.
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    let canonicalEl: HTMLLinkElement | null = canonical;
    const createdCanonical = canonical ? false : true;
    if (absoluteUrl) {
      if (canonical) {
        canonical.setAttribute('href', absoluteUrl);
      } else {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = absoluteUrl;
        document.head.appendChild(link);
        canonicalEl = link;
      }
    }

    // JSON-LD structured data.
    const jsonLd = buildJsonLd(props, absoluteUrl);
    let script = document.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"][data-listing-seo="true"]'
    );
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-listing-seo', 'true');
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag('meta[name="description"]', DEFAULT_DESC);
      setMetaTag('meta[property="og:title"]', DEFAULT_TITLE);
      setMetaTag('meta[property="og:description"]', DEFAULT_DESC);
      setMetaTag('meta[name="twitter:title"]', DEFAULT_TITLE);
      setMetaTag('meta[name="twitter:description"]', DEFAULT_DESC);
      setMetaTag('meta[property="og:url"]', '');
      setMetaTag('meta[property="og:image"]', '');
      setMetaTag('meta[name="twitter:image"]', '');
      if (createdCanonical && canonicalEl) {
        canonicalEl.remove();
      }
      script?.remove();
    };
  }, [props]);

  return null;
};
