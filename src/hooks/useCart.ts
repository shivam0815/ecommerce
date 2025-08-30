// src/hooks/useCart.ts — FIXED: no singleton guard, hydrate from cache immediately
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

const isAuthed = () => !!(localStorage.getItem('nakoda-token') && localStorage.getItem('nakoda-user'));

const readCache = (): { items: CartItem[]; totalAmount: number } => {
  try {
    const s = localStorage.getItem('nakoda-cart');
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

export const useCart = (): UseCartReturn => {
  // ✅ Hydrate immediately from cache so Checkout never mounts “empty”
  const cached = readCache();
  const [cart, setCart] = useState<CartItem[]>(cached.items);
  const [totalAmount, setTotalAmount] = useState(cached.totalAmount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetch guards
  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchCart = useCallback(async (force = false) => {
    // Guests: serve cache only (don’t throw, don’t blank)
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

      const resp = await cartService.getCart(); // should be soft-safe per earlier fix
      const items = Array.isArray(resp?.cart?.items) ? resp.cart.items : [];
      const amount = Number(resp?.cart?.totalAmount ?? 0);

      setCart(items);
      setTotalAmount(amount);
      localStorage.setItem('nakoda-cart', JSON.stringify({ items, totalAmount: amount }));
    } catch (e: any) {
      // ❗ Don’t nuke existing UI on non-401 errors
      if (e?.response?.status === 401) {
        const c = readCache();
        setCart(c.items);
        setTotalAmount(c.totalAmount);
      } else {
        setError(e?.message || 'Failed to fetch cart');
        // keep whatever we already had (likely from cache)
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Always fetch on mount (no global singleton). Service coalescing prevents bursts.
  useEffect(() => {
    fetchCart(false);
  }, [fetchCart]);

  const addToCart = useCallback(async (productId: string, quantity = 1) => {
    if (!isAuthed()) {
      setError('Please login to add items to cart');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await cartService.addToCart(productId, quantity);
      await fetchCart(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to add item to cart');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!isAuthed()) {
      setError('Please login to update cart');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await cartService.updateCartItem(productId, quantity);
      await fetchCart(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to update cart item');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  const removeFromCart = useCallback(async (productId: string) => {
    if (!isAuthed()) {
      setError('Please login to remove items from cart');
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
      setError('Please login to clear cart');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await cartService.clearCart();
      setCart([]);
      setTotalAmount(0);
      localStorage.removeItem('nakoda-cart');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to clear cart');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTotalPrice = useCallback(() => {
    return (cart || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  }, [cart]);

  const getTotalItems = useCallback(() => {
    return (cart || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [cart]);

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
