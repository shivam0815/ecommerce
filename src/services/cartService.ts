// src/services/cartService.ts - OPTIMIZED PRODUCTION VERSION

import api from '../config/api';
import { CartItem } from '../types';

export interface CartResponse {
  success: boolean;
  cart: {
    items: CartItem[];
    totalAmount: number;
  };
}

export interface CartItemResponse {
  success: boolean;
  message: string;
  cart: {
    items: CartItem[];
    totalAmount: number;
  };
}

// ✅ Request debouncing
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

const debounceRequest = async <T>(request: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  
  if (timeSinceLast < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  return await request();
};

// ✅ Enhanced authentication validation
const validateAuthentication = (): boolean => {
  const token = localStorage.getItem('nakoda-token');
  const user = localStorage.getItem('nakoda-user');
  
  if (!token || !user) return false;
  
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    localStorage.removeItem('nakoda-token');
    localStorage.removeItem('nakoda-user');
    return false;
  }
  
  try {
    const payload = JSON.parse(atob(tokenParts[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    
    if (isExpired) {
      localStorage.removeItem('nakoda-token');
      localStorage.removeItem('nakoda-user');
      return false;
    }
    
    return true;
  } catch (error) {
    localStorage.removeItem('nakoda-token');
    localStorage.removeItem('nakoda-user');
    return false;
  }
};

const clearAuthData = (): void => {
  localStorage.removeItem('nakoda-token');
  localStorage.removeItem('nakoda-user');
  localStorage.removeItem('nakoda-cart');
};

const safeProductIdConvert = (productId: string | number | any): string => {
  if (productId === null || productId === undefined) {
    throw new Error('Product ID is required');
  }
  
  let cleanProductId: string;
  try {
    cleanProductId = String(productId).trim();
  } catch (error) {
    throw new Error('Invalid Product ID format');
  }
  
  if (!cleanProductId || cleanProductId === 'null' || cleanProductId === 'undefined') {
    throw new Error('Product ID cannot be empty');
  }
  
  return cleanProductId;
};

export const cartService = {
  // ✅ Get cart from backend
  async getCart(): Promise<CartResponse> {
    return debounceRequest(async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to access cart');
        }
        
        const response = await api.get('/cart');
        
        if (response.data?.cart) {
          localStorage.setItem('nakoda-cart', JSON.stringify(response.data.cart));
        }
        
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearAuthData();
          throw new Error('Session expired. Please login again.');
        }
        throw error;
      }
    });
  },

  // ✅ Add item to cart
  async addToCart(productId: string | number, quantity: number = 1): Promise<CartItemResponse> {
    return debounceRequest(async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to add items to cart');
        }
        
        const cleanProductId = safeProductIdConvert(productId);
        
        if (!quantity || quantity < 1 || quantity > 100) {
          throw new Error('Quantity must be between 1 and 100');
        }
        
        const validQuantity = Math.floor(Number(quantity));
        const requestData = {
          productId: cleanProductId,
          quantity: validQuantity
        };
        
        const response = await api.post('/cart', requestData);
        
        if (response.data?.cart) {
          localStorage.setItem('nakoda-cart', JSON.stringify(response.data.cart));
        }
        
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearAuthData();
          throw new Error('Session expired. Please login again.');
        }
        
        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.message || 'Invalid request';
          throw new Error(errorMessage);
        }
        
        if (error.response?.status === 404) {
          throw new Error('Product not found or unavailable');
        }
        
        if (error.response?.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        const errorMessage = error.response?.data?.message || error.message || 'Failed to add item to cart';
        throw new Error(errorMessage);
      }
    });
  },

  // ✅ Update cart item quantity
  async updateCartItem(productId: string | number, quantity: number): Promise<CartItemResponse> {
    return debounceRequest(async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to update cart');
        }
        
        const cleanProductId = safeProductIdConvert(productId);
        
        if (!quantity || quantity < 1 || quantity > 100) {
          throw new Error('Quantity must be between 1 and 100');
        }
        
        const requestData = {
          productId: cleanProductId,
          quantity: Math.floor(Number(quantity))
        };
        
        const response = await api.put('/cart/item', requestData);
        
        if (response.data?.cart) {
          localStorage.setItem('nakoda-cart', JSON.stringify(response.data.cart));
        }
        
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearAuthData();
          throw new Error('Session expired. Please login again.');
        }
        
        if (error.response?.status === 404) {
          throw new Error('Item not found in cart');
        }
        
        const errorMessage = error.response?.data?.message || error.message || 'Failed to update cart item';
        throw new Error(errorMessage);
      }
    });
  },

  // ✅ Remove item from cart
  async removeFromCart(productId: string | number): Promise<CartItemResponse> {
    return debounceRequest(async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to remove items from cart');
        }
        
        const cleanProductId = safeProductIdConvert(productId);
        const response = await api.delete(`/cart/item/${cleanProductId}`);
        
        if (response.data?.cart) {
          localStorage.setItem('nakoda-cart', JSON.stringify(response.data.cart));
        }
        
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearAuthData();
          throw new Error('Session expired. Please login again.');
        }
        
        if (error.response?.status === 404) {
          throw new Error('Item not found in cart');
        }
        
        const errorMessage = error.response?.data?.message || error.message || 'Failed to remove item from cart';
        throw new Error(errorMessage);
      }
    });
  },

  // ✅ Clear entire cart
  async clearCart(): Promise<{ success: boolean; message: string }> {
    return debounceRequest(async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error('Please login to clear cart');
        }
        
        const response = await api.delete('/cart/clear');
        localStorage.removeItem('nakoda-cart');
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearAuthData();
          throw new Error('Session expired. Please login again.');
        }
        
        const errorMessage = error.response?.data?.message || error.message || 'Failed to clear cart';
        throw new Error(errorMessage);
      }
    });
  },

  // ✅ Get cached cart data
  getCachedCart(): { items: CartItem[]; totalAmount: number } {
    try {
      const cachedCart = localStorage.getItem('nakoda-cart');
      if (cachedCart) {
        const cart = JSON.parse(cachedCart);
        return {
          items: cart.items || [],
          totalAmount: cart.totalAmount || 0
        };
      }
    } catch (error) {
      // Silent fail for cache errors
    }
    
    return { items: [], totalAmount: 0 };
  }
};

export const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCachedCart
} = cartService;

export default cartService;
