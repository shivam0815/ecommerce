import { useState, useEffect, useCallback } from 'react';
import { wishlistService } from '../services/wishlistService';
import { useAuth } from './useAuth';
import { Product } from '../types';
import toast from 'react-hot-toast';

interface WishlistItem {
  productId: string;
  product: Product;
  addedAt: string;
}

export const useWishlist = () => {
  const { user, isAuthenticated } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch wishlist from backend
  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const response = await wishlistService.getWishlist();
      setWishlistItems(response.wishlist.items);
    } catch (error: any) {
      console.error('Error fetching wishlist:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Add to wishlist
  const addToWishlist = useCallback(async (product: Product) => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to wishlist');
      return;
    }

    const productId = product._id || product.id;
    if (!productId) {
      toast.error('Invalid product');
      return;
    }

    try {
      setIsLoading(true);
      const response = await wishlistService.addToWishlist(productId);
      setWishlistItems(response.wishlist.items);
      toast.success('Added to wishlist');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Remove from wishlist
  const removeFromWishlist = useCallback(async (productId: string) => {
    try {
      setIsLoading(true);
      const response = await wishlistService.removeFromWishlist(productId);
      setWishlistItems(response.wishlist.items);
      toast.success('Removed from wishlist');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if item is in wishlist
  const isInWishlist = useCallback((productId: string) => {
    return wishlistItems.some(item => item.productId === productId);
  }, [wishlistItems]);

  // Clear wishlist
  const clearWishlist = useCallback(async () => {
    try {
      setIsLoading(true);
      await wishlistService.clearWishlist();
      setWishlistItems([]);
      toast.success('Wishlist cleared');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load wishlist on mount
  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  return {
    wishlistItems: wishlistItems.map(item => ({
      id: item.productId,
      name: item.product.name,
      price: item.product.price,
      originalPrice: item.product.originalPrice,
      image: item.product.images?.[0] || item.product.image,
      images: item.product.images,
      category: item.product.category,
      addedAt: item.addedAt
    })),
    isLoading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    clearWishlist,
    refreshWishlist: fetchWishlist,
    totalItems: wishlistItems.length
  };
};
