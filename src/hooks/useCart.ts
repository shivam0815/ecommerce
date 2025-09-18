// src/hooks/useCart.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { cartService } from '../services/cartService';
import type { CartItem } from '../types';

interface UseCartReturn {
  cart: CartItem[];
  cartItems: CartItem[];
  totalAmount: number;
  isLoading: boolean;
  error: string | null;
  addToCart: (productId: string, quantity?: number, price?: number, name?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: (force?: boolean) => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

const isAuthed = () =>
  !!(localStorage.getItem('nakoda-token') && localStorage.getItem('nakoda-user'));

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

const writeCache = (items: CartItem[]) => {
  const amount = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );
  localStorage.setItem('nakoda-cart', JSON.stringify({ items, totalAmount: amount }));
  return amount;
};

// ✅ Normalize quantity (min 10, step of 10)
const normalizeQty = (qty: number) => Math.max(10, Math.ceil(qty / 10) * 10);

export const useCart = (): UseCartReturn => {
  const cached = readCache();
  const [cart, setCart] = useState<CartItem[]>(cached.items);
  const [totalAmount, setTotalAmount] = useState(cached.totalAmount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const lastFetchRef = useRef(0);

  const fetchCart = useCallback(async (force = false) => {
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

      const resp = await cartService.getCart();
      const items = Array.isArray(resp?.cart?.items) ? resp.cart.items : [];
      const amount = Number(resp?.cart?.totalAmount ?? 0);

      setCart(items);
      setTotalAmount(amount);
      localStorage.setItem('nakoda-cart', JSON.stringify({ items, totalAmount: amount }));
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

  useEffect(() => {
    fetchCart(false);
  }, [fetchCart]);

  // ✅ Add to cart with min 10 step logic
  const addToCart = useCallback(
    async (productId: string, quantity = 1, price = 0, name = '') => {
      const normalizedQty = normalizeQty(quantity);

      if (!isAuthed()) {
        const current = readCache();
        const idx = current.items.findIndex((it) => it.productId === productId);

        if (idx > -1) {
          current.items[idx].quantity = normalizeQty(current.items[idx].quantity + quantity);
        } else {
          current.items.push({
            id: productId,
            productId,
            quantity: normalizedQty,
            price,
            name,
            product: null as any,
          } as CartItem);
        }

        const amount = writeCache(current.items);
        setCart(current.items);
        setTotalAmount(amount);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        await cartService.addToCart(productId, normalizedQty);
        await fetchCart(true);
      } catch (e: any) {
        setError(
          e?.response?.data?.message || e?.message || 'Failed to add item to cart'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [fetchCart]
  );

  // ✅ Update quantity with min 10 step logic
  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const normalizedQty = normalizeQty(quantity);

      if (!isAuthed()) {
        const current = readCache();
        const idx = current.items.findIndex((it) => it.productId === productId);
        if (idx > -1) {
          current.items[idx].quantity = normalizedQty;
          const amount = writeCache(current.items);
          setCart(current.items);
          setTotalAmount(amount);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        await cartService.updateCartItem(productId, normalizedQty);
        await fetchCart(true);
      } catch (e: any) {
        setError(
          e?.response?.data?.message || e?.message || 'Failed to update cart item'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [fetchCart]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (!isAuthed()) {
        const current = readCache();
        const newItems = current.items.filter((it) => it.productId !== productId);
        const amount = writeCache(newItems);
        setCart(newItems);
        setTotalAmount(amount);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        await cartService.removeFromCart(productId);
        await fetchCart(true);
      } catch (e: any) {
        setError(
          e?.response?.data?.message || e?.message || 'Failed to remove item from cart'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [fetchCart]
  );

  const clearCart = useCallback(async () => {
    if (!isAuthed()) {
      setCart([]);
      setTotalAmount(0);
      localStorage.removeItem('nakoda-cart');
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
      setError(
        e?.response?.data?.message || e?.message || 'Failed to clear cart'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTotalPrice = useCallback(() => {
    return (cart || []).reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );
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
