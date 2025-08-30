import { useState, useEffect, useCallback, useRef } from "react";
import { wishlistService, WishlistResponse } from "../services/wishlistService";
import toast from "react-hot-toast";

export const useWishlist = () => {
  const [items, setItems] = useState<WishlistResponse["wishlist"]["items"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  const isAuthenticated = () => {
    const token = localStorage.getItem("nakoda-token");
    const user = localStorage.getItem("nakoda-user");
    return !!(token && user);
  };

  const fetchWishlist = useCallback(async (force: boolean = false) => {
    if (isFetchingRef.current) return;
    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < 2000) return;

    if (!isAuthenticated()) {
      const cached = wishlistService.getCachedWishlist();
      setItems(cached.items || []);
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchAtRef.current = now;
      setIsLoading(true);
      setError(null);

      const res = await wishlistService.getWishlist();
      setItems(res.wishlist.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch wishlist");
      setItems([]);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const addToWishlist = useCallback(async (productId: string) => {
    if (!isAuthenticated()) {
      toast.error("Please login to add items to wishlist");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await wishlistService.addToWishlist(productId);
      setItems(res.wishlist.items || []);
      toast.success("Added to wishlist");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeFromWishlist = useCallback(async (productId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await wishlistService.removeFromWishlist(productId);
      setItems(res.wishlist.items || []);
      toast.success("Removed from wishlist");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearWishlist = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await wishlistService.clearWishlist();
      setItems([]);
      toast.success("Wishlist cleared");
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => items.some((i) => i.productId === productId),
    [items]
  );

  // Initial load once per tab
  const didInitKey = "__nakoda_wishlist_init__" as const;
  useEffect(() => {
    if (!(globalThis as any)[didInitKey]) {
      (globalThis as any)[didInitKey] = true;
      fetchWishlist(false);
    }
  }, [fetchWishlist]);

  return {
    items: items.map((item) => ({
      id: item.productId,
      name: item.product.name,
      price: item.product.price,
      originalPrice: item.product.originalPrice,
      image: item.product.images?.[0] || item.product.image,
      images: item.product.images,
      category: item.product.category,
      addedAt: item.addedAt,
    })),
    isLoading,
    error,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    isInWishlist,
    refreshWishlist: fetchWishlist,
    getTotalItems: () => items.length,
  };
};
