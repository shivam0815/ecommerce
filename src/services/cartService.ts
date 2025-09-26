// src/services/cartService.ts - ROBUST PRODUCTION VERSION (guest-safe + merge support)

import api from '../config/api';
import type { CartItem } from '../types';

/* -----------------------------------------
   Types
------------------------------------------ */
export interface CartPayload {
  items: CartItem[];       // [{ productId, variantId?, qty }]
  totalAmount: number;
}

export interface CartResponse {
  success: boolean;
  cart: CartPayload;
  message?: string;
}

export interface CartItemResponse {
  success: boolean;
  message: string;
  cart: CartPayload;
}

/* -----------------------------------------
   Debounce per endpoint (prevents cross-call delays)
------------------------------------------ */
const requestBuckets = new Map<string, number>();
const MIN_REQUEST_INTERVAL = 800; // ms; tuned down a bit for better UX

const debounceRequest = async <T>(
  key: string,
  request: () => Promise<T>
): Promise<T> => {
  const now = Date.now();
  const last = requestBuckets.get(key) ?? 0;
  const delta = now - last;

  if (delta < MIN_REQUEST_INTERVAL) {
    const waitMs = MIN_REQUEST_INTERVAL - delta;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  requestBuckets.set(key, Date.now());
  return request();
};

/* -----------------------------------------
   Auth helpers
------------------------------------------ */
const TOKEN_KEY = 'nakoda-token';
const USER_KEY  = 'nakoda-user';
const CART_KEY  = 'nakoda-cart';

const validateAuthentication = (): boolean => {
  const token = localStorage.getItem(TOKEN_KEY);
  const user  = localStorage.getItem(USER_KEY);
  if (!token || !user) return false;

  const parts = token.split('.');
  if (parts.length !== 3) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return false;
  }

  try {
    const payload = JSON.parse(atob(parts[1]));
    const isExpired = payload?.exp ? payload.exp * 1000 < Date.now() : true;
    if (isExpired) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return false;
  }
};

const clearAuthData = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Keep CART_KEY for guest UX
};

const safeProductIdConvert = (productId: string | number | any): string => {
  if (productId === null || productId === undefined) {
    throw new Error('Product ID is required');
  }
  const s = String(productId).trim();
  if (!s || s === 'null' || s === 'undefined') {
    throw new Error('Product ID cannot be empty');
  }
  return s;
};

/* -----------------------------------------
   Tiny inflight cache + coalescing
------------------------------------------ */
const inflight = new Map<string, Promise<any>>();
function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn()
    .catch((e) => { throw e; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

let lastCartMemory: CartResponse | null = null;
let lastCartFetchedAt = 0;
const CART_TTL_MS = 1500;

/* -----------------------------------------
   Local cache helpers (shared with guest)
------------------------------------------ */
const readCachedCart = (): CartPayload => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return { items: [], totalAmount: 0 };
    const cart = JSON.parse(raw);
    return {
      items: Array.isArray(cart?.items) ? cart.items : [],
      totalAmount: Number(cart?.totalAmount ?? 0),
    };
  } catch {
    return { items: [], totalAmount: 0 };
  }
};

const writeCachedCart = (payload?: CartPayload) => {
  if (!payload) return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota/serialization errors
  }
};

/* -----------------------------------------
   Guest cart helpers (localStorage)
------------------------------------------ */
type GuestCartItem = { productId: string; variantId?: string; qty: number };

function readGuestPayload(): CartPayload {
  const cached = readCachedCart();
  const items = (cached.items || []).map((it: any) => ({
    productId: String(it.productId),
    variantId: it.variantId ? String(it.variantId) : undefined,
    qty: Number(it.qty ?? it.quantity ?? 1),
  }));
  return { items: items as any, totalAmount: Number(cached.totalAmount || 0) };
}

function writeGuestPayload(p: CartPayload) {
  writeCachedCart({
    items: (p.items || []).map((it: any) => ({
      id: String(it.productId),
      productId: String(it.productId),
      product: it.product || {},
      name: it.name || '',
      price: it.price || 0,
      variantId: it.variantId ? String(it.variantId) : undefined,
      quantity: Number(it.qty ?? it.quantity ?? 1),
    })),
    totalAmount: Number(p.totalAmount || 0),
  });
}

function upsertGuest(items: GuestCartItem[], incoming: GuestCartItem) {
  const key = (x: GuestCartItem) => `${x.productId}::${x.variantId || ''}`;
  const idx = items.findIndex((x) => key(x) === key(incoming));
  if (idx >= 0) items[idx].qty = Math.min(100, items[idx].qty + incoming.qty);
  else items.push({ ...incoming, qty: Math.min(100, Math.max(1, incoming.qty)) });
}

function setGuestQty(items: GuestCartItem[], target: GuestCartItem) {
  const key = (x: GuestCartItem) => `${x.productId}::${x.variantId || ''}`;
  const idx = items.findIndex((x) => key(x) === key(target));
  if (idx >= 0) items[idx].qty = Math.min(100, Math.max(1, target.qty));
}

function removeGuest(items: GuestCartItem[], target: GuestCartItem) {
  const key = (x: GuestCartItem) => `${x.productId}::${x.variantId || ''}`;
  const idx = items.findIndex((x) => key(x) === key(target));
  if (idx >= 0) items.splice(idx, 1);
}

/* -----------------------------------------
   Service
------------------------------------------ */
export const cartService = {
  /* READ cart: guest-safe (returns cached/empty if logged out) */
  async getCart(): Promise<CartResponse> {
    const isAuthed = validateAuthentication();

    // Memory hit within TTL
    const now = Date.now();
    if (lastCartMemory && now - lastCartFetchedAt < CART_TTL_MS) {
      return lastCartMemory;
    }

    // Guest path: serve local cache
    if (!isAuthed) {
      const cached = readGuestPayload();
      const resp: CartResponse = { success: true, cart: cached };
      lastCartMemory = resp;
      lastCartFetchedAt = Date.now();
      return resp;
    }

    // Authenticated → hit backend (coalesced)
    return coalesce('GET:/cart', async () => {
      try {
        const response = await debounceRequest('GET:/cart', () => api.get('/cart'));
        const data = (response?.data ?? {}) as CartResponse;

        const normalized: CartResponse = {
          success: Boolean(data.success ?? true),
          cart: {
            items: Array.isArray(data?.cart?.items) ? data.cart.items : [],
            totalAmount: Number(data?.cart?.totalAmount ?? 0),
          },
          message: data.message,
        };

        writeCachedCart(normalized.cart);
        lastCartMemory = normalized;
        lastCartFetchedAt = Date.now();
        return normalized;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearAuthData();
          const cached = readGuestPayload();
          const fallback: CartResponse = { success: true, cart: cached, message: 'Session expired' };
          lastCartMemory = fallback;
          lastCartFetchedAt = Date.now();
          return fallback;
        }
        const cached = readGuestPayload();
        const soft: CartResponse = { success: false, cart: cached, message: 'Failed to fetch cart' };
        lastCartMemory = soft;
        lastCartFetchedAt = Date.now();
        return soft;
      }
    });
  },

  /* ADD item (guest-safe) */
  async addToCart(
    productId: string | number,
    quantity: number = 1,
    variantId?: string
  ): Promise<CartItemResponse> {
    return debounceRequest('POST:/cart', async () => {
      const q = Math.floor(Number(quantity));
      if (!q || q < 1 || q > 100) throw new Error('Quantity must be between 1 and 100');
      const cleanProductId = safeProductIdConvert(productId);

      // Guest path
      if (!validateAuthentication()) {
        const guest = readGuestPayload();
        const items: GuestCartItem[] = guest.items as any;
        upsertGuest(items, { productId: cleanProductId, variantId, qty: q });
        writeGuestPayload({ items: items as any, totalAmount: guest.totalAmount });

        const resp: CartItemResponse = {
          success: true,
          message: 'Added to cart',
          cart: { items: items as any, totalAmount: guest.totalAmount },
        };
        lastCartMemory = resp as unknown as CartResponse;
        lastCartFetchedAt = Date.now();
        return resp;
      }

      // Authenticated path
      try {
        const response = await api.post('/cart', { productId: cleanProductId, quantity: q, variantId });
        const data = response?.data as CartItemResponse;

        const normalized: CartItemResponse = {
          success: Boolean(data.success ?? true),
          message: data.message || 'Added to cart',
          cart: {
            items: Array.isArray(data?.cart?.items) ? data.cart.items : [],
            totalAmount: Number(data?.cart?.totalAmount ?? 0),
          },
        };

        writeCachedCart(normalized.cart);
        lastCartMemory = normalized as unknown as CartResponse;
        lastCartFetchedAt = Date.now();
        return normalized;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearAuthData();
          // fallback to guest add
          const guest = readGuestPayload();
          const items: GuestCartItem[] = guest.items as any;
          upsertGuest(items, { productId: cleanProductId, variantId, qty: q });
          writeGuestPayload({ items: items as any, totalAmount: guest.totalAmount });
          return {
            success: true,
            message: 'Added to cart (guest)',
            cart: { items: items as any, totalAmount: guest.totalAmount },
          };
        }
        if (error?.response?.status === 404) throw new Error('Product not found or unavailable');
        if (error?.response?.status === 400) throw new Error(error?.response?.data?.message || 'Invalid request');
        if (error?.response?.status >= 500) throw new Error('Server error. Please try again later.');
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to add item to cart');
      }
    });
  },

  /* UPDATE quantity (guest-safe) */
  async updateCartItem(
    productId: string | number,
    quantity: number,
    variantId?: string
  ): Promise<CartItemResponse> {
    return debounceRequest('PUT:/cart/item', async () => {
      const q = Math.floor(Number(quantity));
      if (!q || q < 1 || q > 100) throw new Error('Quantity must be between 1 and 100');
      const cleanProductId = safeProductIdConvert(productId);

      if (!validateAuthentication()) {
        const guest = readGuestPayload();
        const items: GuestCartItem[] = guest.items as any;
        setGuestQty(items, { productId: cleanProductId, variantId, qty: q });
        writeGuestPayload({ items: items as any, totalAmount: guest.totalAmount });

        const resp: CartItemResponse = {
          success: true,
          message: 'Cart updated',
          cart: { items: items as any, totalAmount: guest.totalAmount },
        };
        lastCartMemory = resp as unknown as CartResponse;
        lastCartFetchedAt = Date.now();
        return resp;
      }

      try {
        const response = await api.put('/cart/item', { productId: cleanProductId, quantity: q, variantId });
        const data = response?.data as CartItemResponse;

        const normalized: CartItemResponse = {
          success: Boolean(data.success ?? true),
          message: data.message || 'Cart updated',
          cart: {
            items: Array.isArray(data?.cart?.items) ? data.cart.items : [],
            totalAmount: Number(data?.cart?.totalAmount ?? 0),
          },
        };

        writeCachedCart(normalized.cart);
        lastCartMemory = normalized as unknown as CartResponse;
        lastCartFetchedAt = Date.now();
        return normalized;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearAuthData();
          // guest fallback
          const guest = readGuestPayload();
          const items: GuestCartItem[] = guest.items as any;
          setGuestQty(items, { productId: cleanProductId, variantId, qty: q });
          writeGuestPayload({ items: items as any, totalAmount: guest.totalAmount });
          return {
            success: true,
            message: 'Cart updated (guest)',
            cart: { items: items as any, totalAmount: guest.totalAmount },
          };
        }
        if (error?.response?.status === 404) throw new Error('Item not found in cart');
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to update cart item');
      }
    });
  },

  /* REMOVE item (guest-safe) */
  async removeFromCart(productId: string | number, variantId?: string): Promise<CartItemResponse> {
    return debounceRequest('DELETE:/cart/item', async () => {
      const cleanProductId = safeProductIdConvert(productId);

      if (!validateAuthentication()) {
        const guest = readGuestPayload();
        const items: GuestCartItem[] = guest.items as any;
        removeGuest(items, { productId: cleanProductId, variantId, qty: 1 });
        writeGuestPayload({ items: items as any, totalAmount: guest.totalAmount });

        const resp: CartItemResponse = {
          success: true,
          message: 'Item removed',
          cart: { items: items as any, totalAmount: guest.totalAmount },
        };
        lastCartMemory = resp as unknown as CartResponse;
        lastCartFetchedAt = Date.now();
        return resp;
      }

      try {
        // note: include variantId in body if your API needs it
        const response = await api.delete(`/cart/item/${cleanProductId}`, { data: { variantId } as any });
        const data = response?.data as CartItemResponse;

        const normalized: CartItemResponse = {
          success: Boolean(data.success ?? true),
          message: data.message || 'Item removed',
          cart: {
            items: Array.isArray(data?.cart?.items) ? data.cart.items : [],
            totalAmount: Number(data?.cart?.totalAmount ?? 0),
          },
        };

        writeCachedCart(normalized.cart);
        lastCartMemory = normalized as unknown as CartResponse;
        lastCartFetchedAt = Date.now();
        return normalized;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearAuthData();
          // guest fallback
          const guest = readGuestPayload();
          const items: GuestCartItem[] = guest.items as any;
          removeGuest(items, { productId: cleanProductId, variantId, qty: 1 });
          writeGuestPayload({ items: items as any, totalAmount: guest.totalAmount });
          return {
            success: true,
            message: 'Item removed (guest)',
            cart: { items: items as any, totalAmount: guest.totalAmount },
          };
        }
        if (error?.response?.status === 404) throw new Error('Item not found in cart');
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to remove item from cart');
      }
    });
  },

  /* CLEAR cart (guest-safe) */
  async clearCart(): Promise<{ success: boolean; message: string }> {
    return debounceRequest('DELETE:/cart/clear', async () => {
      if (!validateAuthentication()) {
        writeGuestPayload({ items: [], totalAmount: 0 });
        lastCartMemory = { success: true, cart: { items: [], totalAmount: 0 } };
        lastCartFetchedAt = Date.now();
        return { success: true, message: 'Cart cleared' };
      }

      try {
        const response = await api.delete('/cart/clear');
        writeCachedCart({ items: [], totalAmount: 0 });
        lastCartMemory = { success: true, cart: { items: [], totalAmount: 0 } };
        lastCartFetchedAt = Date.now();
        return response?.data ?? { success: true, message: 'Cart cleared' };
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearAuthData();
          // UX fallback
          writeGuestPayload({ items: [], totalAmount: 0 });
          lastCartMemory = { success: true, cart: { items: [], totalAmount: 0 } };
          lastCartFetchedAt = Date.now();
          return { success: true, message: 'Cart cleared (guest)' };
        }
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to clear cart');
      }
    });
  },

  /* MERGE guest → server (call right after login success) */
  async mergeGuestCart(): Promise<CartResponse> {
    if (!validateAuthentication()) {
      return { success: true, cart: readGuestPayload() }; // nothing to do
    }

    const guest = readGuestPayload();
    const items = (guest.items || []).map((i: any) => ({
      productId: String(i.productId),
      variantId: i.variantId ? String(i.variantId) : undefined,
      qty: Number(i.qty ?? i.quantity ?? 1),
    }));

    if (!items.length) {
      // Still refresh server cart so UI is accurate
      return this.getCart();
    }

    try {
      const res = await api.post('/cart/merge', { items });
      const data = (res?.data ?? {}) as CartResponse;

      const normalized: CartResponse = {
        success: Boolean(data.success ?? true),
        cart: {
          items: Array.isArray(data?.cart?.items) ? data.cart.items : [],
          totalAmount: Number(data?.cart?.totalAmount ?? 0),
        },
        message: data.message,
      };

      // Clear guest cache after successful merge
      writeGuestPayload({ items: [], totalAmount: 0 });
      writeCachedCart(normalized.cart);
      lastCartMemory = normalized;
      lastCartFetchedAt = Date.now();

      return normalized;
    } catch (e) {
      // keep guest cache so user doesn’t lose items
      return { success: false, cart: guest, message: 'Cart merge failed' };
    }
  },

  /* GET cached cart (always safe) */
  getCachedCart(): CartPayload {
    return readCachedCart();
  },
};

/* Named exports for convenience */
export const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCachedCart,
  mergeGuestCart,
} = cartService;

export default cartService;
