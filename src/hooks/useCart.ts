// src/hooks/useCart.ts - OPTIMIZED PRODUCTION VERSION

import { useState, useEffect, useCallback, useRef } from 'react';
import { cartService, CartResponse } from '../services/cartService';
import { CartItem } from '../types';

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
  refreshCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCart = (): UseCartReturn => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ Prevent infinite loops with refs
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Check if user is authenticated
  const isAuthenticated = () => {
    const token = localStorage.getItem('nakoda-token');
    const user = localStorage.getItem('nakoda-user');
    return !!(token && user);
  };

  // ✅ Debounced fetch cart to prevent excessive API calls
  const debouncedFetchCart = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      fetchCart();
    }, 300); // 300ms debounce
  }, []);

  // ✅ Optimized fetch cart with caching and rate limiting
  const fetchCart = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    
    // Rate limiting - don't fetch more than once per 2 seconds
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) return;
    
    if (!isAuthenticated()) {
      const savedCart = localStorage.getItem('nakoda-cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setCart(Array.isArray(parsedCart.items) ? parsedCart.items : []);
          setTotalAmount(parsedCart.totalAmount || 0);
        } catch (error) {
          setCart([]);
          setTotalAmount(0);
        }
      } else {
        setCart([]);
        setTotalAmount(0);
      }
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      setIsLoading(true);
      setError(null);
      
      const response = await cartService.getCart();
      const items = Array.isArray(response.cart?.items) ? response.cart.items : [];
      
      setCart(items);
      setTotalAmount(response.cart?.totalAmount || 0);
      
      // Cache for offline use
      localStorage.setItem('nakoda-cart', JSON.stringify({
        items: items,
        totalAmount: response.cart?.totalAmount || 0
      }));
      
    } catch (err: any) {
      if (err.response?.status === 401) {
        const savedCart = localStorage.getItem('nakoda-cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            setCart(Array.isArray(parsedCart.items) ? parsedCart.items : []);
            setTotalAmount(parsedCart.totalAmount || 0);
          } catch (parseError) {
            setCart([]);
            setTotalAmount(0);
          }
        } else {
          setCart([]);
          setTotalAmount(0);
        }
      } else {
        setError(err.message || 'Failed to fetch cart');
        setCart([]);
        setTotalAmount(0);
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // ✅ Optimized add to cart
  const addToCart = useCallback(async (productId: string, quantity: number = 1) => {
    if (!isAuthenticated()) {
      setError('Please login to add items to cart');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.addToCart(productId, quantity);
      await fetchCart();
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Authentication failed. Please login again.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to add item to cart');
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  // ✅ Optimized update quantity
  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!isAuthenticated()) {
      setError('Please login to update cart');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.updateCartItem(productId, quantity);
      await fetchCart();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update cart item');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  // ✅ Optimized remove from cart
  const removeFromCart = useCallback(async (productId: string) => {
    if (!isAuthenticated()) {
      setError('Please login to remove items from cart');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await cartService.removeFromCart(productId);
      await fetchCart();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to remove item from cart');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCart]);

  // ✅ Clear cart
  const clearCart = useCallback(async () => {
    if (!isAuthenticated()) {
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
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to clear cart');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ Optimized calculation functions
  const getTotalPrice = useCallback((): number => {
    if (!Array.isArray(cart)) return 0;
    
    return cart.reduce((total, item) => {
      const price = typeof item?.price === 'number' ? item.price : 0;
      const quantity = typeof item?.quantity === 'number' ? item.quantity : 0;
      return total + (price * quantity);
    }, 0);
  }, [cart]);

  const getTotalItems = useCallback((): number => {
    if (!Array.isArray(cart)) return 0;
    
    return cart.reduce((total, item) => {
      const quantity = typeof item?.quantity === 'number' ? item.quantity : 0;
      return total + quantity;
    }, 0);
  }, [cart]);

  // ✅ Load cart only once on mount
  useEffect(() => {
    debouncedFetchCart();
    
    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []); // Empty dependency array to run only once

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
