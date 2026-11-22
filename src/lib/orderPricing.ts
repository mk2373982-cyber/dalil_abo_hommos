import type { CartItem, MenuItem, OrderPricingSnapshot, Place } from '../types';

export const MAX_ORDER_ITEMS = 15;
export const MAX_ITEM_QUANTITY = 20;
export const DEFAULT_DELIVERY_FEE_IN_TOWN = 15;
export const DEFAULT_DELIVERY_FEE_VILLAGE = 25;

export interface OrderDraftItemInput {
  menuItemId: string;
  quantity: number;
  /** Client-supplied price (optional, used only to detect price tampering) */
  clientPrice?: number;
}

export interface OrderPricingValidationSuccess {
  ok: true;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  pricingSnapshot: OrderPricingSnapshot;
}

export interface OrderPricingValidationFailure {
  ok: false;
  code:
    | 'INVALID_RESTAURANT'
    | 'EMPTY_ITEMS'
    | 'TOO_MANY_ITEMS'
    | 'ITEM_NOT_FOUND'
    | 'INVALID_QUANTITY'
    | 'PRICE_MISMATCH'
    | 'INVALID_MENU_PRICE';
  message: string;
}

export type OrderPricingResult = OrderPricingValidationSuccess | OrderPricingValidationFailure;

/**
 * Builds the authoritative menuPriceMap (`{ [menuItemId]: price }`) stored on a restaurant Place doc.
 * Firestore security rules read this exact map to validate every restaurant_order on creation.
 */
export function buildPlaceMenuPriceMap(menuItems?: MenuItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  if (!Array.isArray(menuItems)) return map;
  for (const item of menuItems) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;
    const price = Number(item.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    map[item.id.trim()] = Math.round(price * 100) / 100;
  }
  return map;
}

/**
 * Authoritatively computes delivery fee based on delivery area and restaurant settings.
 * Mirrors the exact formula enforced in Firestore security rules.
 */
export function calculateDeliveryFee(
  deliveryArea?: string,
  restaurant?: Pick<Place, 'deliveryFeeInTown' | 'deliveryFeeVillage'>
): number {
  const inTown =
    typeof restaurant?.deliveryFeeInTown === 'number' &&
    Number.isFinite(restaurant.deliveryFeeInTown) &&
    restaurant.deliveryFeeInTown >= 0
      ? restaurant.deliveryFeeInTown
      : DEFAULT_DELIVERY_FEE_IN_TOWN;

  const village =
    typeof restaurant?.deliveryFeeVillage === 'number' &&
    Number.isFinite(restaurant.deliveryFeeVillage) &&
    restaurant.deliveryFeeVillage >= 0
      ? restaurant.deliveryFeeVillage
      : DEFAULT_DELIVERY_FEE_VILLAGE;

  return (deliveryArea || '').includes('قرية') ? village : inTown;
}

/**
 * Validates and computes authoritative order pricing against the official restaurant catalog.
 * Rejects unknown/foreign items, invalid quantities, and tampered client prices.
 */
export function computeAuthoritativeOrder(params: {
  restaurant: Pick<Place, 'id' | 'name' | 'categorySlug' | 'menuItems' | 'menuPriceMap' | 'deliveryFeeInTown' | 'deliveryFeeVillage'> | null | undefined;
  draftItems: OrderDraftItemInput[];
  deliveryArea?: string;
  pricingSource?: 'firestore_catalog' | 'api_validator';
  nowIso?: string;
}): OrderPricingResult {
  const { restaurant, draftItems, deliveryArea, pricingSource = 'firestore_catalog', nowIso = new Date().toISOString() } = params;

  if (!restaurant || restaurant.categorySlug !== 'restaurants') {
    return {
      ok: false,
      code: 'INVALID_RESTAURANT',
      message: 'المطعم المطلوب غير موجود أو غير متاح لاستقبال الطلبات.',
    };
  }

  if (!Array.isArray(draftItems) || draftItems.length === 0) {
    return {
      ok: false,
      code: 'EMPTY_ITEMS',
      message: 'سلة الطلبات فارغة. يرجى اختيار صنف واحد على الأقل.',
    };
  }

  if (draftItems.length > MAX_ORDER_ITEMS) {
    return {
      ok: false,
      code: 'TOO_MANY_ITEMS',
      message: `الحد الأقصى للطلب الواحد هو ${MAX_ORDER_ITEMS} صنفاً مختلفاً.`,
    };
  }

  const catalogById = new Map<string, MenuItem>();
  for (const m of restaurant.menuItems || []) {
    if (m && typeof m.id === 'string' && m.id.trim()) {
      catalogById.set(m.id.trim(), m);
    }
  }

  const priceMap = restaurant.menuPriceMap && Object.keys(restaurant.menuPriceMap).length > 0
    ? restaurant.menuPriceMap
    : buildPlaceMenuPriceMap(restaurant.menuItems);

  const authoritativeItems: CartItem[] = [];
  let subtotal = 0;

  for (const input of draftItems) {
    const id = typeof input.menuItemId === 'string' ? input.menuItemId.trim() : '';
    const qty = Number(input.quantity);

    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ITEM_QUANTITY) {
      return {
        ok: false,
        code: 'INVALID_QUANTITY',
        message: `الكمية غير صالحة (يجب أن تكون عدداً صحيحاً بين 1 و ${MAX_ITEM_QUANTITY}).`,
      };
    }

    const menuItem = catalogById.get(id);
    const officialPrice = id ? priceMap[id] ?? menuItem?.price : undefined;

    if (!id || officialPrice === undefined || !menuItem) {
      return {
        ok: false,
        code: 'ITEM_NOT_FOUND',
        message: 'أحد الأصناف المختارة غير موجود في قائمة هذا المطعم.',
      };
    }

    if (!Number.isFinite(officialPrice) || officialPrice <= 0) {
      return {
        ok: false,
        code: 'INVALID_MENU_PRICE',
        message: `سعر الصنف «${menuItem.name}» غير مهيأ بشكل صحيح.`,
      };
    }

    // Detect tampered client price if supplied
    if (typeof input.clientPrice === 'number' && Math.abs(input.clientPrice - officialPrice) > 0.001) {
      return {
        ok: false,
        code: 'PRICE_MISMATCH',
        message: `تم رصد اختلاف في سعر الصنف «${menuItem.name}» عن سعر القائمة الرسمي (${officialPrice} ج.م). يرجى تحديث السلة.`,
      };
    }

    const unitPrice = Math.round(officialPrice * 100) / 100;
    authoritativeItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: unitPrice,
      quantity: qty,
    });
    subtotal += unitPrice * qty;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const deliveryFee = calculateDeliveryFee(deliveryArea, restaurant);
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  return {
    ok: true,
    items: authoritativeItems,
    subtotal,
    deliveryFee,
    total,
    pricingSnapshot: {
      currency: 'EGP',
      subtotal,
      deliveryFee,
      total,
      validatedAt: nowIso,
      pricingSource,
    },
  };
}
