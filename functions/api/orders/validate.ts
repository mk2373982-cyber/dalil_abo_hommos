/**
 * Cloudflare Pages Function: POST /api/orders/validate
 *
 * Server-side authoritative order validation & pricing calculator.
 * Reads the restaurant document directly from Firestore REST API (using FIREBASE_PROJECT_ID
 * and FIRESTORE_DATABASE_ID env vars), verifies every menuItemId belongs to the restaurant,
 * validates quantities (1..20, max 15 line items), recalculates unit prices, deliveryFee,
 * subtotal, and total, and rejects tampered client prices or unknown items with HTTP 400/422.
 */

interface ValidateOrderBody {
  restaurantId: string;
  deliveryArea: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    clientPrice?: number;
  }>;
}

interface Env {
  FIREBASE_PROJECT_ID?: string;
  FIRESTORE_DATABASE_ID?: string;
}

function extractNumberField(field: Record<string, unknown> | undefined): number | undefined {
  if (!field) return undefined;
  if (typeof field.integerValue === 'string') return Number(field.integerValue);
  if (typeof field.doubleValue === 'number') return field.doubleValue;
  return undefined;
}

function extractStringField(field: Record<string, unknown> | undefined): string {
  if (!field || typeof field.stringValue !== 'string') return '';
  return field.stringValue;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  let body: ValidateOrderBody;
  try {
    body = (await context.request.json()) as ValidateOrderBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'صيغة JSON غير صالحة' }), {
      status: 400,
      headers,
    });
  }

  if (!body || typeof body.restaurantId !== 'string' || !body.restaurantId.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'معرّف المطعم مطلوب' }), {
      status: 400,
      headers,
    });
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 15) {
    return new Response(
      JSON.stringify({ ok: false, error: 'يجب أن يحتوي الطلب على صنف واحد إلى 15 صنفاً' }),
      { status: 400, headers }
    );
  }

  const projectId = context.env.FIREBASE_PROJECT_ID;
  const databaseId = context.env.FIRESTORE_DATABASE_ID || '(default)';
  if (!projectId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'لم يتم ضبط FIREBASE_PROJECT_ID في متغيرات بيئة Cloudflare Pages',
      }),
      { status: 500, headers }
    );
  }

  const safeRestaurantId = encodeURIComponent(body.restaurantId.trim());
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/places/${safeRestaurantId}`;

  const docRes = await fetch(firestoreUrl, { method: 'GET' });
  if (docRes.status === 404) {
    return new Response(JSON.stringify({ ok: false, error: 'المطعم غير موجود' }), {
      status: 404,
      headers,
    });
  }
  if (!docRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'تعذر قراءة بيانات المطعم من Firestore' }), {
      status: 502,
      headers,
    });
  }

  const docJson = (await docRes.json()) as {
    fields?: Record<string, Record<string, unknown>>;
  };
  const fields = docJson.fields || {};
  if (extractStringField(fields.categorySlug) !== 'restaurants') {
    return new Response(JSON.stringify({ ok: false, error: 'النشاط المختار ليس مطعماً' }), {
      status: 400,
      headers,
    });
  }

  const priceMapFields =
    (fields.menuPriceMap?.mapValue as { fields?: Record<string, Record<string, unknown>> } | undefined)
      ?.fields || {};

  const menuArrayValues =
    (fields.menuItems?.arrayValue as { values?: Array<{ mapValue?: { fields?: Record<string, Record<string, unknown>> } }> } | undefined)
      ?.values || [];

  const catalog = new Map<string, { name: string; price: number }>();
  for (const [id, val] of Object.entries(priceMapFields)) {
    const p = extractNumberField(val);
    if (p && p > 0) catalog.set(id, { name: id, price: p });
  }
  for (const entry of menuArrayValues) {
    const f = entry.mapValue?.fields;
    if (!f) continue;
    const id = extractStringField(f.id);
    const name = extractStringField(f.name);
    const price = extractNumberField(f.price);
    if (id && price && price > 0) {
      catalog.set(id, { name: name || id, price });
    }
  }

  const validatedItems: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
  }> = [];
  let subtotal = 0;

  for (const raw of body.items) {
    const itemId = typeof raw.menuItemId === 'string' ? raw.menuItemId.trim() : '';
    const qty = Number(raw.quantity);
    if (!itemId || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return new Response(
        JSON.stringify({ ok: false, error: 'الكمية يجب أن تكون عدداً صحيحاً بين 1 و 20' }),
        { status: 422, headers }
      );
    }
    const catItem = catalog.get(itemId);
    if (!catItem) {
      return new Response(
        JSON.stringify({ ok: false, error: `الصنف (${itemId}) غير موجود في منيو هذا المطعم` }),
        { status: 422, headers }
      );
    }
    if (
      typeof raw.clientPrice === 'number' &&
      Math.abs(raw.clientPrice - catItem.price) > 0.001
    ) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'PRICE_MISMATCH',
          error: `سعر الصنف «${catItem.name}» تغيّر — السعر المعتمد هو ${catItem.price} ج.م`,
          expectedPrice: catItem.price,
        }),
        { status: 422, headers }
      );
    }
    validatedItems.push({
      menuItemId: itemId,
      name: catItem.name,
      price: catItem.price,
      quantity: qty,
    });
    subtotal += catItem.price * qty;
  }

  const feeInTown = extractNumberField(fields.deliveryFeeInTown) ?? 15;
  const feeVillage = extractNumberField(fields.deliveryFeeVillage) ?? 25;
  const isVillage = typeof body.deliveryArea === 'string' && body.deliveryArea.includes('قرية');
  const deliveryFee = isVillage ? feeVillage : feeInTown;
  const total = subtotal + deliveryFee;

  return new Response(
    JSON.stringify({
      ok: true,
      restaurantId: body.restaurantId.trim(),
      restaurantName: extractStringField(fields.name),
      items: validatedItems,
      subtotal,
      deliveryFee,
      total,
      pricingSnapshot: {
        verifiedAt: new Date().toISOString(),
        source: 'cloudflare_pages_function',
        currency: 'EGP',
        deliveryFeeApplied: deliveryFee,
        items: validatedItems.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          unitPrice: i.price,
          quantity: i.quantity,
          lineTotal: i.price * i.quantity,
        })),
      },
    }),
    { status: 200, headers }
  );
}
