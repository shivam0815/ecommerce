// src/services/cartService.ts - ROBUST PRODUCTION VERSION (guest-safe reads)

import api from '../config/api';
import type { CartItem } from '../types';

export interface CartPayload {
  items: CartItem[];
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
  // Mark AFTER waiting so we never “push time into the future”
  requestBuckets.set(key, Date.now());
  return request();
};

/* -----------------------------------------
   Auth helpers
------------------------------------------ */
const TOKEN_KEY = 'nakoda-token';
const USER_KEY = 'nakoda-user';
const CART_KEY = 'nakoda-cart';

const validateAuthentication = (): boolean => {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
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
  // don’t nuke CART_KEY here; let guest cache persist for UX
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
   Tiny memory cache + coalescing
------------------------------------------ */
const inflight = new Map<string, Promise<any>>();
function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn()
    .catch((e) => {
      // ensure other callers don’t stay stuck if this one fails
      throw e;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

let lastCartMemory: CartResponse | null = null;
let lastCartFetchedAt = 0;
const CART_TTL_MS = 1500;

/* -----------------------------------------
   Local cache helpers
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
   Service
------------------------------------------ */
export const cartService = {
  /* READ cart: never throw just because user is logged out.
     Return cached/empty so the Cart page and Checkout link can render. */
  async getCart(): Promise<CartResponse> {
    const isAuthed = validateAuthentication();

    // Memory hit within TTL
    const now = Date.now();
    if (lastCartMemory && now - lastCartFetchedAt < CART_TTL_MS) {
      return lastCartMemory;
    }

    // If not authenticated, serve cached (or empty) cart without throwing
    if (!isAuthed) {
      const cached = readCachedCart();
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

        // normalize shape
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
        // On 401, clear tokens and still return cached/empty (don’t break UI)
        if (error?.response?.status === 401) {
          clearAuthData();
          const cached = readCachedCart();
          const fallback: CartResponse = { success: true, cart: cached, message: 'Session expired' };
          lastCartMemory = fallback;
          lastCartFetchedAt = Date.now();
          return fallback;
        }
        // On any other error, return cached (soft-fail)
        const cached = readCachedCart();
        const soft: CartResponse = { success: false, cart: cached, message: 'Failed to fetch cart' };
        lastCartMemory = soft;
        lastCartFetchedAt = Date.now();
        return soft;
      }
    });
  },

  /* ADD item (requires auth) */
  async addToCart(productId: string | number, quantity: number = 1): Promise<CartItemResponse> {
    return debounceRequest('POST:/cart', async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to add items to cart');
        }

        const cleanProductId = safeProductIdConvert(productId);
        const q = Math.floor(Number(quantity));
        if (!q || q < 1 || q > 100) throw new Error('Quantity must be between 1 and 100');

        const response = await api.post('/cart', { productId: cleanProductId, quantity: q });
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
          throw new Error('Session expired. Please login again.');
        }
        if (error?.response?.status === 400) {
          throw new Error(error?.response?.data?.message || 'Invalid request');
        }
        if (error?.response?.status === 404) {
          throw new Error('Product not found or unavailable');
        }
        if (error?.response?.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to add item to cart');
      }
    });
  },

  /* UPDATE quantity (requires auth) */
  async updateCartItem(productId: string | number, quantity: number): Promise<CartItemResponse> {
    return debounceRequest('PUT:/cart/item', async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to update cart');
        }

        const cleanProductId = safeProductIdConvert(productId);
        const q = Math.floor(Number(quantity));
        if (!q || q < 1 || q > 100) throw new Error('Quantity must be between 1 and 100');

        const response = await api.put('/cart/item', { productId: cleanProductId, quantity: q });
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
          throw new Error('Session expired. Please login again.');
        }
        if (error?.response?.status === 404) {
          throw new Error('Item not found in cart');
        }
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to update cart item');
      }
    });
  },

  /* REMOVE item (requires auth) */
  async removeFromCart(productId: string | number): Promise<CartItemResponse> {
    return debounceRequest('DELETE:/cart/item', async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to remove items from cart');
        }

        const cleanProductId = safeProductIdConvert(productId);
        const response = await api.delete(`/cart/item/${cleanProductId}`);
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
          throw new Error('Session expired. Please login again.');
        }
        if (error?.response?.status === 404) {
          throw new Error('Item not found in cart');
        }
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to remove item from cart');
      }
    });
  },

  /* CLEAR cart (requires auth) */
  async clearCart(): Promise<{ success: boolean; message: string }> {
    return debounceRequest('DELETE:/cart/clear', async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to clear cart');
        }
        const response = await api.delete('/cart/clear');

        // clear memory + local cache
        writeCachedCart({ items: [], totalAmount: 0 });
        lastCartMemory = { success: true, cart: { items: [], totalAmount: 0 } };
        lastCartFetchedAt = Date.now();

        return response?.data ?? { success: true, message: 'Cart cleared' };
      } catch (error: any) {
        if (error?.response?.status === 401) {
          clearAuthData();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(error?.response?.data?.message || error?.message || 'Failed to clear cart');
      }
    });
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
} = cartService;

export default cartService;
