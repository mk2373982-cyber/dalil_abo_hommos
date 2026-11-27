/**
 * Cloudflare Pages Function — Trusted Server-Side Order Pricing Validator
 * Endpoint: POST /api/orders/validate
 *
 * Fetches the authoritative restaurant menu directly from Firestore REST API,
 * verifies every item exists and belongs to the restaurant, validates quantities,
 * detects client-side price tampering, computes subtotal + deliveryFee + total,
 * and returns a verified OrderPricingSnapshot compatible with firestore.rules.
 */

interface RequestItemInput {
  menuItemId: string;
  quantity: number;
  clientPrice?: number;
}

interface ValidateOrderRequest {
  restaurantId: string;
  deliveryArea?: string;
  items: RequestItemInput[];
  clientSubtotal?: number;
  clientDeliveryFee?: number;
  clientTotal?: number;
}

interface Env {
  FIREBASE_PROJECT_ID?: string;
  FIRESTORE_DATABASE_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]{2,100}$/;
const MAX_ITEMS = 15;
const MAX_QTY = 20;
const MAX_BODY_BYTES = 16 * 1024; // 16 KB hard cap on the JSON request body
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // max validations per IP per window

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function decodeFirestoreNumber(val?: FirestoreValue): number | undefined {
  if (!val) return undefined;
  if (typeof val.doubleValue === 'number') return val.doubleValue;
  if (typeof val.integerValue === 'string') {
    const n = Number(val.integerValue);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

// ---------------------------------------------------------------------------
// Service-account authentication: signed JWT -> OAuth2 access token (cached in memory)
// ---------------------------------------------------------------------------
let tokenCache: { token: string; expiresAt: number } | null = null;

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToBytes(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

async function signServiceAccountJwt(clientEmail: string, privateKeyPem: string): Promise<string> {
  const header = base64UrlFromBytes(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlFromBytes(
    new TextEncoder().encode(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }
  const clientEmail = (env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = (env.FIREBASE_PRIVATE_KEY || '').trim();
  if (!clientEmail || !privateKey) {
    throw new Error('Firebase service account credentials are not configured.');
  }
  const assertion = await signServiceAccountJwt(clientEmail, privateKey);
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Failed to obtain Firebase access token (${tokenRes.status}).`);
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  const token = tokenData.access_token;
  if (!token) throw new Error('Firebase access token missing from OAuth response.');
  const expiresIn = Number(tokenData.expires_in) || 3600;
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

// ---------------------------------------------------------------------------
// Basic in-memory per-IP fixed-window rate limiting
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateLimitMap.size > 5000) {
      for (const [key, value] of rateLimitMap) {
        if (value.resetAt <= now) rateLimitMap.delete(key);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
  });
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  try {
    // Fail closed: without explicit Firebase env config we cannot validate prices.
    const projectId = (context.env.FIREBASE_PROJECT_ID || '').trim();
    const databaseId = (context.env.FIRESTORE_DATABASE_ID || '').trim();
    if (!projectId || !databaseId) {
      return jsonResponse(
        {
          ok: false,
          code: 'CONFIG_MISSING',
          error: 'المتغيرات البيئية ل Firebase غير مُعرَّفة على الخادم.',
        },
        503
      );
    }

    // Basic per-IP rate limiting to prevent abuse of this public endpoint.
    if (!checkRateLimit(getClientIp(context.request))) {
      return jsonResponse(
        {
          ok: false,
          code: 'RATE_LIMITED',
          error: 'الحد الأقصى لطلبات التحقق من الأسعار تم تجاوزه. حاول لاحقاً.',
        },
        429
      );
    }

    // Enforce a hard cap on the request body size before parsing.
    const contentLength = context.request.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return jsonResponse(
        { ok: false, code: 'BODY_TOO_LARGE', error: 'حجم الطلب كبير جداً.' },
        413
      );
    }

    let rawText: string;
    try {
      rawText = await context.request.text();
    } catch {
      return jsonResponse(
        { ok: false, code: 'INVALID_BODY', error: 'تعذر قراءة صيغة الطلب.' },
        400
      );
    }
    if (rawText.length > MAX_BODY_BYTES) {
      return jsonResponse(
        { ok: false, code: 'BODY_TOO_LARGE', error: 'حجم الطلب كبير جداً.' },
        413
      );
    }

    let body: ValidateOrderRequest;
    try {
      body = JSON.parse(rawText) as ValidateOrderRequest;
    } catch {
      return jsonResponse(
        { ok: false, code: 'INVALID_JSON', error: 'صيغة الطلب غير صالحة.' },
        400
      );
    }

    const restaurantId = String(body.restaurantId || '').trim();
    if (!VALID_ID_RE.test(restaurantId)) {
      return jsonResponse(
        { ok: false, code: 'INVALID_RESTAURANT_ID', error: 'معرّف المطعم غير صالح.' },
        400
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return jsonResponse(
        { ok: false, code: 'EMPTY_ITEMS', error: 'السلة فارغة — أضف صنفاً واحداً على الأقل.' },
        400
      );
    }

    if (body.items.length > MAX_ITEMS) {
      return jsonResponse(
        {
          ok: false,
          code: 'TOO_MANY_ITEMS',
          error: `الحد الأقصى للطلب الواحد هو ${MAX_ITEMS} صنفاً.`,
        },
        400
      );
    }

    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/places/${encodeURIComponent(
      restaurantId
    )}`;

    // Authenticate the Firestore REST lookup with the service-account access token.
    let accessToken: string;
    try {
      accessToken = await getAccessToken(context.env);
    } catch {
      return jsonResponse(
        {
          ok: false,
          code: 'AUTH_UNAVAILABLE',
          error: 'تعذر التحقق من الأسعار على الخادم حالياً.',
        },
        503
      );
    }
    const fsRes = await fetch(docUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (fsRes.status === 404) {
      return jsonResponse(
        { ok: false, code: 'RESTAURANT_NOT_FOUND', error: 'المطعم غير موجود في الدليل.' },
        404
      );
    }
    if (!fsRes.ok) {
      return jsonResponse(
        {
          ok: false,
          code: 'CATALOG_UNAVAILABLE',
          error: 'تعذر التحقق من قائمة المطعم من الخادم حالياً.',
        },
        502
      );
    }

    const fsDoc = (await fsRes.json()) as { fields?: Record<string, FirestoreValue> };
    const fields = fsDoc.fields || {};

    if (fields.categorySlug?.stringValue !== 'restaurants') {
      return jsonResponse(
        { ok: false, code: 'NOT_A_RESTAURANT', error: 'هذا النشاط غير مفعّل لطلبات المطاعم.' },
        400
      );
    }

    // Build authoritative catalog lookup from menuItems & menuPriceMap
    const menuMap = new Map<string, { id: string; name: string; price: number }>();
    const menuValues = fields.menuItems?.arrayValue?.values || [];
    for (const entry of menuValues) {
      const f = entry.mapValue?.fields;
      if (!f) continue;
      const id = f.id?.stringValue?.trim();
      const name = f.name?.stringValue?.trim();
      const price = decodeFirestoreNumber(f.price);
      if (id && name && typeof price === 'number' && Number.isFinite(price) && price > 0) {
        menuMap.set(id, { id, name, price });
      }
    }

    const priceMapFields = fields.menuPriceMap?.mapValue?.fields || {};
    for (const [id, val] of Object.entries(priceMapFields)) {
      const price = decodeFirestoreNumber(val);
      if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
        const existing = menuMap.get(id);
        if (existing) {
          existing.price = price;
        } else {
          menuMap.set(id, { id, name: id, price });
        }
      }
    }

    if (menuMap.size === 0) {
      return jsonResponse(
        {
          ok: false,
          code: 'MENU_UNCONFIGURED',
          error: 'قائمة أسعار هذا المطعم غير مكتملة حالياً.',
        },
        400
      );
    }

    // Validate items & detect price tampering
    const verifiedItems: Array<{
      menuItemId: string;
      name: string;
      price: number;
      quantity: number;
    }> = [];
    const seenIds = new Set<string>();
    let subtotal = 0;
    let priceMismatchDetected = false;

    for (const reqItem of body.items) {
      const menuItemId = String(reqItem?.menuItemId || '').trim();
      const qty = Number(reqItem?.quantity);

      if (!menuItemId || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return jsonResponse(
          {
            ok: false,
            code: 'INVALID_QUANTITY',
            error: `الكمية يجب أن تكون عدداً صحيحاً بين 1 و ${MAX_QTY}.`,
          },
          400
        );
      }

      if (seenIds.has(menuItemId)) {
        return jsonResponse(
          {
            ok: false,
            code: 'DUPLICATE_ITEM',
            error: 'يوجد صنف مكرر في الطلب؛ يرجى تجميع الكمية في سطر واحد.',
          },
          400
        );
      }
      seenIds.add(menuItemId);

      const catalogItem = menuMap.get(menuItemId);
      if (!catalogItem) {
        return jsonResponse(
          {
            ok: false,
            code: 'UNKNOWN_MENU_ITEM',
            error: `الصنف (${menuItemId}) غير موجود في منيو هذا المطعم.`,
          },
          400
        );
      }

      if (
        typeof reqItem.clientPrice === 'number' &&
        Number.isFinite(reqItem.clientPrice) &&
        Math.abs(reqItem.clientPrice - catalogItem.price) > 0.001
      ) {
        priceMismatchDetected = true;
      }

      verifiedItems.push({
        menuItemId: catalogItem.id,
        name: catalogItem.name,
        price: catalogItem.price,
        quantity: qty,
      });
      subtotal += catalogItem.price * qty;
    }

    const deliveryArea = String(body.deliveryArea || '');
    const isVillage = deliveryArea.includes('قرية');
    const feeInTown = decodeFirestoreNumber(fields.deliveryFeeInTown) ?? 15;
    const feeVillage = decodeFirestoreNumber(fields.deliveryFeeVillage) ?? 25;
    const deliveryFee = isVillage ? feeVillage : feeInTown;
    const total = subtotal + deliveryFee;

    if (
      (typeof body.clientSubtotal === 'number' && Math.abs(body.clientSubtotal - subtotal) > 0.001) ||
      (typeof body.clientDeliveryFee === 'number' &&
        Math.abs(body.clientDeliveryFee - deliveryFee) > 0.001) ||
      (typeof body.clientTotal === 'number' && Math.abs(body.clientTotal - total) > 0.001)
    ) {
      priceMismatchDetected = true;
    }

    const validatedAt = new Date().toISOString();
    const pricingSnapshot = {
      currency: 'EGP' as const,
      subtotal,
      deliveryFee,
      total,
      validatedAt,
      pricingSource: 'api_validator' as const,
    };

    if (priceMismatchDetected) {
      return jsonResponse(
        {
          ok: false,
          tampered: true,
          code: 'PRICE_MISMATCH',
          error:
            'تم رفض الطلب: الأسعار المرسلة لا تطابق قائمة المطعم المعتمدة. يرجى تحديث الصفحة والمحاولة بالسعر الرسمي.',
          expected: {
            restaurantId,
            restaurantName: fields.name?.stringValue || '',
            items: verifiedItems,
            subtotal,
            deliveryFee,
            total,
            pricingSnapshot,
          },
        },
        422
      );
    }

    return jsonResponse(
      {
        ok: true,
        restaurantId,
        restaurantName: fields.name?.stringValue || '',
        items: verifiedItems,
        subtotal,
        deliveryFee,
        total,
        pricingSnapshot,
      },
      200
    );
  } catch {
    return jsonResponse(
      { ok: false, code: 'INTERNAL_ERROR', error: 'حدث خطأ أثناء التحقق من أسعار الطلب.' },
      500
    );
  }
};
