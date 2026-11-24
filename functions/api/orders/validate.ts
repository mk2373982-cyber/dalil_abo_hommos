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
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

const DEFAULT_PROJECT_ID = 'teak-canto-3t86m';
const DEFAULT_DATABASE_ID = 'ai-studio-bd327efc-a997-4475-a7c6-ee14154881c2';
const VALID_ID_RE = /^[a-zA-Z0-9_-]{2,100}$/;
const MAX_ITEMS = 15;
const MAX_QTY = 20;

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
    let body: ValidateOrderRequest;
    try {
      body = (await context.request.json()) as ValidateOrderRequest;
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

    const projectId = (context.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID).trim();
    const databaseId = (context.env.FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID).trim();
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/places/${encodeURIComponent(
      restaurantId
    )}`;

    const fsRes = await fetch(docUrl, { method: 'GET' });
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
