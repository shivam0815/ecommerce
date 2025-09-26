// src/hooks/useCart.ts — guest-safe + server cart
import { useState, useEffect, useCallback, useRef } from 'react';
import { cartService } from '../services/cartService';
import type { CartItem } from '../types';

interface UseCartReturn {
  cart: CartItem[];
  cartItems: CartItem[];
  totalAmount: number;
  isLoading: boolean;
  error: string | null;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: (force?: boolean) => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

const TOKEN_KEY = 'guestCart';
const USER_KEY  = 'nakoda-user';
const CART_KEY  = 'nakoda-cart';

const isAuthed = () =>
  !!(localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY));

/* -------------------- Local cache (shared) -------------------- */
const readCache = (): { items: CartItem[]; totalAmount: number } => {
  try {
    const s = localStorage.getItem(CART_KEY);
    if (!s) return { items: [], totalAmount: 0 };
    const j = JSON.parse(s);
    return {
      items: Array.isArray(j?.items) ? j.items : [],
      totalAmount: Number(j?.totalAmount ?? 0),
    };
  } catch {
    return { items: [], totalAmount: 0 };
  }
};

const writeCache = (payload: { items: CartItem[]; totalAmount: number }) => {
  localStorage.setItem(CART_KEY, JSON.stringify(payload));
};

/* -------------------- Guest helpers -------------------- */
type GuestLine = { productId: string; quantity: number; price?: number; name?: string; image?: string };

const upsertGuest = (arr: GuestLine[], line: GuestLine) => {
  const idx = arr.findIndex(i => String(i.productId) === String(line.productId));
  if (idx >= 0) arr[idx].quantity = Math.min(100, (arr[idx].quantity || 0) + (line.quantity || 0));
  else arr.push({ ...line, quantity: Math.min(100, Math.max(1, line.quantity || 1)) });
};

const setGuestQty = (arr: GuestLine[], productId: string, qty: number) => {
  const i = arr.findIndex(x => String(x.productId) === String(productId));
  if (i >= 0) arr[i].quantity = Math.min(100, Math.max(1, Math.floor(qty)));
};

const removeGuest = (arr: GuestLine[], productId: string) => {
  const i = arr.findIndex(x => String(x.productId) === String(productId));
  if (i >= 0) arr.splice(i, 1);
};

const recomputeGuestTotal = (items: GuestLine[]) =>
  items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);

/* ================================================================ */

export const useCart = (): UseCartReturn => {
  // Hydrate immediately from cache so UI never flashes empty
  const cached = readCache();
  const [cart, setCart] = useState<CartItem[]>(cached.items);
  const [totalAmount, setTotalAmount] = useState(cached.totalAmount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetch guards
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchCart = useCallback(async (force = false) => {
    // Guests: serve cache only
    if (!isAuthed()) {
      const c = readCache();
      setCart(c.items);
      setTotalAmount(c.totalAmount);
      return;
    }

    if (isFetchingRef.current) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 1200) return;

    try {
      isFetchingRef.current = true;
      lastFetchRef.current = now;
      setIsLoading(true);
      setError(null);

      const resp = await cartService.getCart(); // guest-safe service
      const items = Array.isArray(resp?.cart?.items) ? resp.cart.items : [];
      const amount = Number(resp?.cart?.totalAmount ?? 0);

      setCart(items);
      setTotalAmount(amount);
      writeCache({ items, totalAmount: amount });
    } catch (e: any) {
      if (e?.response?.status === 401) {
        const c = readCache();
        setCart(c.items);
        setTotalAmount(c.totalAmount);
      } else {
        setError(e?.message || 'Failed to fetch cart');
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => { fetchCart(false); }, [fetchCart]);

  /* -------------------- Actions -------------------- */
  const addToCart = useCallback(async (productId: string, quantity = 1) => {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));

    if (!isAuthed()) {
      const c = readCache();
      const items = [...(c.items as any[])];
      upsertGuest(items as any, { productId, quantity: qty });
      const total = recomputeGuestTotal(items as any);
      writeCache({ items: items as any, totalAmount: total });
      setCart(items as any);
      setTotalAmount(total);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.addToCart(productId, qty);
      await fetchCart(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to add item to cart');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));

    if (!isAuthed()) {
      const c = readCache();
      const items = [...(c.items as any[])];
      setGuestQty(items as any, productId, qty);
      const total = recomputeGuestTotal(items as any);
      writeCache({ items: items as any, totalAmount: total });
      setCart(items as any);
      setTotalAmount(total);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.updateCartItem(productId, qty);
      await fetchCart(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to update cart item');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  const removeFromCart = useCallback(async (productId: string) => {
    if (!isAuthed()) {
      const c = readCache();
      const items = [...(c.items as any[])];
      removeGuest(items as any, productId);
      const total = recomputeGuestTotal(items as any);
      writeCache({ items: items as any, totalAmount: total });
      setCart(items as any);
      setTotalAmount(total);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.removeFromCart(productId);
      await fetchCart(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to remove item from cart');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  const clearCart = useCallback(async () => {
    if (!isAuthed()) {
      writeCache({ items: [], totalAmount: 0 });
      setCart([]);
      setTotalAmount(0);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.clearCart();
      setCart([]);
      setTotalAmount(0);
      localStorage.removeItem(CART_KEY);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to clear cart');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* -------------------- Derivations -------------------- */
  const getTotalPrice = useCallback(
    () => (cart || []).reduce(
      (sum, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity ?? it.qty) || 0),
      0
    ),
    [cart]
  );

  const getTotalItems = useCallback(
    () => (cart || []).reduce((sum, it: any) => sum + (Number(it.quantity ?? it.qty) || 0), 0),
    [cart]
  );

  return {
    cart,
    cartItems: cart,
    totalAmount,
    isLoading,
    error,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart: fetchCart,
    getTotalItems,
    getTotalPrice,
  };
};
