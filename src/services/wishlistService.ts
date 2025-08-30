// src/services/wishlistService.ts - FINAL PRODUCTION VERSION (TS-safe)
import api from "../config/api";
import { Product } from "../types";

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

// ---- Auth check (mirror cartService) ----
const validateAuthentication = (): boolean => {
  const token = localStorage.getItem("nakoda-token");
  const user = localStorage.getItem("nakoda-user");
  if (!token || !user) return false;

  const parts = token.split(".");
  if (parts.length !== 3) {
    localStorage.removeItem("nakoda-token");
    localStorage.removeItem("nakoda-user");
    return false;
  }
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("nakoda-token");
      localStorage.removeItem("nakoda-user");
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem("nakoda-token");
    localStorage.removeItem("nakoda-user");
    return false;
  }
};

const clearAuthData = () => {
  localStorage.removeItem("nakoda-token");
  localStorage.removeItem("nakoda-user");
  localStorage.removeItem("nakoda-wishlist");
};

// ---- Coalescing + TTL memory cache ----
const inflight = new Map<string, Promise<any>>();
function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const ex = inflight.get(key);
  if (ex) return ex as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ✅ now `undefined` instead of null
let lastWishMemory: WishlistResponse | undefined = undefined;
let lastWishAt = 0;
const WISH_TTL_MS = 1500;

// ---- Debounce for writes ----
let lastReqAt = 0;
const MIN_INTERVAL = 800;
const debounceRequest = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const delta = now - lastReqAt;
  if (delta < MIN_INTERVAL) {
    const wait = MIN_INTERVAL - delta;
    lastReqAt = now + wait;
    await new Promise((r) => setTimeout(r, wait));
  } else {
    lastReqAt = now;
  }
  return fn();
};

// ---- Service API ----
export const wishlistService = {
  async getWishlist(): Promise<WishlistResponse> {
    if (!validateAuthentication()) {
      throw new Error("Please login to access wishlist");
    }

    const now = Date.now();
    if (lastWishMemory && now - lastWishAt < WISH_TTL_MS) {
      return lastWishMemory!; // ✅ TS-safe non-null
    }

    return coalesce("GET:/wishlist", async () => {
      try {
        const res = await api.get("/wishlist");
        lastWishMemory = res.data as WishlistResponse;
        lastWishAt = Date.now();
        localStorage.setItem(
          "nakoda-wishlist",
          JSON.stringify(lastWishMemory.wishlist)
        );
        return res.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          clearAuthData();
          throw new Error("Please login to access wishlist");
        }
        throw new Error(
          error.response?.data?.message || "Failed to fetch wishlist"
        );
      }
    });
  },

  async addToWishlist(productId: string): Promise<WishlistResponse> {
    return debounceRequest(async () => {
      try {
        if (!validateAuthentication()) {
          throw new Error("Please login to add items to wishlist");
        }
        const res = await api.post("/wishlist", { productId });
        lastWishMemory = res.data;
        lastWishAt = Date.now();
        localStorage.setItem(
          "nakoda-wishlist",
          JSON.stringify(lastWishMemory!.wishlist)
        );
        return res.data;
      } catch (error: any) {
        if (error.response?.status === 401)
          throw new Error("Please login to add items to wishlist");
        if (error.response?.status === 409)
          throw new Error("Item already in wishlist");
        throw new Error(
          error.response?.data?.message || "Failed to add to wishlist"
        );
      }
    });
  },

  async removeFromWishlist(productId: string): Promise<WishlistResponse> {
    return debounceRequest(async () => {
      try {
        const res = await api.delete(`/wishlist/${productId}`);
        lastWishMemory = res.data;
        lastWishAt = Date.now();
        localStorage.setItem(
          "nakoda-wishlist",
          JSON.stringify(lastWishMemory!.wishlist)
        );
        return res.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message || "Failed to remove from wishlist"
        );
      }
    });
  },

  async clearWishlist(): Promise<{ success: boolean; message: string }> {
    return debounceRequest(async () => {
      try {
        const res = await api.delete("/wishlist/clear");
        lastWishMemory = undefined; // ✅ reset safely
        lastWishAt = 0;
        localStorage.removeItem("nakoda-wishlist");
        return res.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message || "Failed to clear wishlist"
        );
      }
    });
  },

  // ✅ Offline cache getter
  getCachedWishlist(): WishlistResponse["wishlist"] {
    try {
      const raw = localStorage.getItem("nakoda-wishlist");
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // silent fail
    }
    return { items: [] };
  },
};
