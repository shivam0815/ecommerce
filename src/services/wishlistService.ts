import api from '../config/api';
import { Product } from '../types';

export interface WishlistResponse {
  success: boolean;
  wishlist: {
    items: Array<{
      productId: string;
      product: Product;
      addedAt: string;
    }>;
  };
}

export const wishlistService = {
  async getWishlist(): Promise<WishlistResponse> {
    try {
      const response = await api.get('/wishlist');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Please login to access wishlist');
      }
      throw new Error(error.response?.data?.message || 'Failed to fetch wishlist');
    }
  },

  async addToWishlist(productId: string): Promise<WishlistResponse> {
    try {
      const response = await api.post('/wishlist', { productId });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Please login to add items to wishlist');
      }
      if (error.response?.status === 409) {
        throw new Error('Item already in wishlist');
      }
      throw new Error(error.response?.data?.message || 'Failed to add to wishlist');
    }
  },

  async removeFromWishlist(productId: string): Promise<WishlistResponse> {
    try {
      const response = await api.delete(`/wishlist/${productId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to remove from wishlist');
    }
  },

  async clearWishlist(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete('/wishlist/clear');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to clear wishlist');
    }
  }
};
