// src/utils/cartGuest.ts
// Guest cart with product snapshots for rich UI (no backend needed)

export type GuestItem = {
  productId: string;
  variantId?: string;
  qty: number;
  name: string;
  price: number;     // unit price snapshot shown on PDP at add time
  image: string;     // main image URL snapshot
  sku?: string;
};

export type GuestCart = {
  items: GuestItem[];
  totalAmount: number; // sum(price * qty)
};

const KEY = 'nakoda-cart'; // keep consistent with useCart/cartService

/* ---------------------------- internals ---------------------------- */
const clampQty = (n: any, min = 1, max = 100) =>
  Math.max(min, Math.min(Number.isFinite(+n) ? Math.floor(+n) : 1, max));

const lineKey = (i: Pick<GuestItem, 'productId' | 'variantId'>) =>
  `${i.productId}::${i.variantId || ''}`;

const computeTotal = (items: GuestItem[]) =>
  items.reduce((sum, it) => sum + (Number(it.price) || 0) * clampQty(it.qty), 0);

/* ----------------------------- storage ----------------------------- */
export function getGuestCart(): GuestCart {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Array.isArray(parsed.items)) {
      return { items: [], totalAmount: 0 };
    }
    // normalize
    const items: GuestItem[] = parsed.items.map((i: any) => ({
      productId: String(i.productId),
      variantId: i.variantId ? String(i.variantId) : undefined,
      qty: clampQty(i.qty ?? i.quantity ?? 1),
      name: String(i.name ?? ''),
      price: Number(i.price ?? 0),
      image: String(i.image ?? ''),
      sku: i.sku ? String(i.sku) : undefined,
    }));
    return { items, totalAmount: Number(parsed.totalAmount ?? computeTotal(items)) };
  } catch {
    return { items: [], totalAmount: 0 };
  }
}

export function setGuestCart(cart: GuestCart) {
  const safe: GuestCart = {
    items: (cart.items || []).map((i) => ({
      ...i,
      qty: clampQty(i.qty),
      price: Number(i.price || 0),
      name: i.name || '',
      image: i.image || '',
    })),
    totalAmount: Number(cart.totalAmount || computeTotal(cart.items || [])),
  };
  localStorage.setItem(KEY, JSON.stringify(safe));
}

export function clearGuestCart() {
  localStorage.removeItem(KEY);
}

/* ----------------------------- actions ----------------------------- */
/**
 * Add a product snapshot for guests.
 * @param snapshot minimal product data at add time
 * @param qty desired quantity (will be clamped 1..100)
 */
export function addGuestItem(
  snapshot: Omit<GuestItem, 'qty'> & { qty?: number }
) {
  const cart = getGuestCart();
  const items = [...cart.items];
  const incoming: GuestItem = {
    productId: snapshot.productId,
    variantId: snapshot.variantId,
    name: snapshot.name || 'Product',
    price: Number(snapshot.price || 0),
    image: snapshot.image || '',
    sku: snapshot.sku,
    qty: clampQty(snapshot.qty ?? 1),
  };

  const idx = items.findIndex((x) => lineKey(x) === lineKey(incoming));
  if (idx >= 0) {
    items[idx].qty = clampQty(items[idx].qty + incoming.qty);
  } else {
    items.push(incoming);
  }

  const totalAmount = computeTotal(items);
  setGuestCart({ items, totalAmount });
  return { items, totalAmount };
}

/** Set an exact quantity for a line (guest). */
export function updateGuestQty(productId: string, qty: number, variantId?: string) {
  const cart = getGuestCart();
  const items = [...cart.items];
  const key = lineKey({ productId, variantId });

  const idx = items.findIndex((x) => lineKey(x) === key);
  if (idx >= 0) {
    items[idx].qty = clampQty(qty);
  }
  const totalAmount = computeTotal(items);
  setGuestCart({ items, totalAmount });
  return { items, totalAmount };
}

/** Remove a line item from guest cart. */
export function removeGuestItem(productId: string, variantId?: string) {
  const cart = getGuestCart();
  const key = lineKey({ productId, variantId });
  const items = cart.items.filter((x) => lineKey(x) !== key);
  const totalAmount = computeTotal(items);
  setGuestCart({ items, totalAmount });
  return { items, totalAmount };
}

/** Clear all items (guest). */
export function clearGuestItems() {
  setGuestCart({ items: [], totalAmount: 0 });
  return { items: [], totalAmount: 0 };
}

/** Quick helpers for UI badges/totals. */
export function getGuestTotals() {
  const { items, totalAmount } = getGuestCart();
  const count = items.reduce((s, i) => s + clampQty(i.qty), 0);
  return { count, totalAmount };
}

/* -------------------------- server merge -------------------------- */
/**
 * Prepare minimal payload for /cart/merge after login.
 * Server usually expects: [{ productId, variantId?, qty }]
 */
export function toMergePayload() {
  const { items } = getGuestCart();
  return items.map((i) => ({
    productId: i.productId,
    variantId: i.variantId,
    qty: clampQty(i.qty),
  }));
}
