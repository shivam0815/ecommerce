// src/services/productService.ts
import api from '../config/api';
import { Product } from '../types';

export interface ProductsResponse {
  products: Product[];
  totalPages: number;
  currentPage: number;
  total: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    hasMore: boolean;
    limit: number;
  };
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  excludeId?: string;
  /** NEW: ask server for pricing preview & WA routing for this qty */
  qty?: number;
}

/* ---------- helpers ---------- */
const coerceNumber = (v: any): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function normalizeSpecifications(input: any): Record<string, any> {
  if (input == null) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof Map !== 'undefined' && input instanceof Map) {
    return Object.fromEntries(input as Map<string, any>);
  }
  if (typeof input === 'object' && !Array.isArray(input)) return input;
  return {};
}

/**
 * IMPORTANT:
 * Standardize rating fields so UI always finds them.
 * Also surface whatsappAfterQty (default 100) and pass through _pricingPreview.
 */
function normalizeProduct(p: any): Product {
  const avg =
    coerceNumber(p?.averageRating) ??
    coerceNumber(p?.ratingAvg) ??
    coerceNumber(p?.ratingAverage) ??
    coerceNumber(p?.rating) ??
    0;

  const count =
    coerceNumber(p?.ratingsCount) ??
    coerceNumber(p?.reviewCount) ??
    coerceNumber(p?.reviewsCount) ??
    coerceNumber(p?.numReviews) ??
    (Array.isArray(p?.reviews) ? p.reviews.length : undefined) ??
    0;

  const whatsappAfterQty = coerceNumber((p as any)?.whatsappAfterQty) ?? 100;

  return {
    ...p,
    // normalized aggregates
    averageRating: avg,
    rating: avg, // keep old UI happy
    ratingsCount: count,
    reviewCount: count,
    reviewsCount: count,
    // normalized specs
    specifications: normalizeSpecifications(p?.specifications),
    // NEW: ensure WA threshold always present
    whatsappAfterQty,
    // NEW: keep server's pricing preview (if provided by ?qty=)
    _pricingPreview: (p as any)?._pricingPreview,
  } as Product;
}

function normalizeProductsResponse(data: any): ProductsResponse {
  // Accept multiple common shapes
  const raw =
    (Array.isArray(data?.products) && data.products) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    [];

  const products: Product[] = raw.map(normalizeProduct);

  const pagination = data?.pagination ?? {};

  const totalPages = Number(
    data?.totalPages ??
      pagination.totalPages ??
      pagination.pages ??
      1
  );

  const currentPage = Number(
    data?.currentPage ??
      pagination.currentPage ??
      pagination.page ??
      1
  );

  const total = Number(
    data?.total ??
      pagination.totalProducts ??
      pagination.total ??
      products.length
  );

  const limit = Number(
    pagination.limit ??
      data?.limit ??
      (products.length || 12)
  );

  const hasMore = Boolean(
    pagination.hasMore ??
      (Number(currentPage) < Number(totalPages))
  );

  return {
    products,
    totalPages,
    currentPage,
    total,
    pagination: {
      currentPage,
      totalPages,
      totalProducts: total,
      hasMore,
      limit,
    },
  };
}

/* ---------- tiny in-memory cache (per-tab) ---------- */
const memCache = new Map<string, { data: ProductsResponse; ts: number }>();
// Feel free to shorten while testing; set back to 60_000 later
const MC_TTL = 15_000;

const keyOf = (path: string, params?: Record<string, any>) =>
  `${path}?${new URLSearchParams(
    Object.entries(params || {}).reduce((acc, [k, v]) => {
      if (v != null) acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  ).toString()}`;

/* ---------- constants ---------- */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

/* ---------- service ---------- */
export const productService = {
  async getProducts(filters: ProductFilters = {}, forceRefresh = false): Promise<ProductsResponse> {
    try {
      const params: Record<string, any> = {
        page: filters.page ?? 1,
        ...filters,
        // ensure limit boundaries
        limit: Math.min(MAX_LIMIT, Number(filters.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
        // pass qty only if valid
        ...(filters.qty != null ? { qty: Number(filters.qty) } : {}),
        ...(forceRefresh ? { _t: Date.now() } : {}),
      };

      const urlKey = keyOf('/products', params);

      // respect global refresh flag you already set elsewhere
      const mustRefresh = forceRefresh || this.shouldRefresh();

      if (!mustRefresh) {
        const hit = memCache.get(urlKey);
        if (hit && Date.now() - hit.ts < MC_TTL) return hit.data;
      }

      const response = await api.get('/products', { params });
      const normalized = normalizeProductsResponse(response.data);

      memCache.set(urlKey, { data: normalized, ts: Date.now() });
      localStorage.setItem('products-cache', JSON.stringify({ data: normalized, timestamp: Date.now() }));

      return normalized;
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      const cached = this.getCachedProducts();
      if (cached) {
        console.log('📦 Using cached products as fallback');
        return cached;
      }
      throw error;
    }
  },

  async list(filters: ProductFilters = {}, limit = filters.limit ?? DEFAULT_LIMIT): Promise<Product[]> {
    const res = await this.getProducts({ ...filters, limit });
    const items = res.products.filter(p => {
      const pid = (p as any)._id || (p as any).id;
      return !filters.excludeId || pid !== filters.excludeId;
    });
    return items;
  },

  async getRelatedProducts(id: string, limit = 15): Promise<Product[]> {
    try {
      try {
        const r1 = await api.get(`/products/${id}/related`, { params: { limit } });
        const list = (Array.isArray(r1?.data?.products) ? r1.data.products : r1?.data) || [];
        if (list.length) return list.map(normalizeProduct);
      } catch {}
      try {
        const r2 = await api.get(`/products/related/${id}`, { params: { limit } });
        const list = (Array.isArray(r2?.data?.products) ? r2.data.products : r2?.data) || [];
        if (list.length) return list.map(normalizeProduct);
      } catch {}

      const { product } = await this.getProduct(id);
      const byCat = await this.list({ category: (product as any).category, excludeId: (product as any)._id || (product as any).id }, limit + 5);
      if (byCat.length) return byCat.slice(0, limit);

      return await this.getTrending(limit);
    } catch (e) {
      console.warn('getRelatedProducts fallback due to error', e);
      return this.getTrending(limit);
    }
  },

  async getTrending(limit = 15): Promise<Product[]> {
    try {
      const r = await api.get('/products/trending', { params: { limit } });
      const arr = (Array.isArray(r?.data?.products) ? r.data.products : r?.data) || [];
      if (arr.length) return arr.map(normalizeProduct);
    } catch {}
    const list = await this.list({ sortBy: 'trending', sortOrder: 'desc' }, limit);
    return list.slice(0, limit);
  },

  async getByBrand(brand: string, limit = 12, excludeId?: string): Promise<Product[]> {
    const items = await this.list({ brand, excludeId }, limit);
    return items.slice(0, limit);
  },

  async search(query: string, filters: Omit<ProductFilters, 'search'> = {}, limit = 20): Promise<Product[]> {
    const items = await this.list({ ...filters, search: query }, limit);
    return items.slice(0, limit);
  },

  /** NEW: optional qty for pricing preview / WA routing */
  async getProduct(id: string, qty?: number): Promise<{ success: boolean; product: Product; message?: string }> {
    try {
      console.log('📤 Fetching single product:', id, qty != null ? `(qty=${qty})` : '');
      if (!id || id.length !== 24) throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      const response = await api.get(`/products/${id}`, {
        params: qty != null ? { qty: Number(qty) } : undefined,
      });
      const product = normalizeProduct(response?.data?.product);
      console.log('✅ Single product fetched:', product?.name || 'Unknown');
      return { success: true, product, message: response?.data?.message };
    } catch (error: any) {
      console.error('❌ Failed to fetch single product:', error);
      if (error.response?.status === 404) throw new Error('Product not found or has been removed.');
      if (error.response?.status === 400) throw new Error('Invalid product ID. Please check the product link.');
      if (error.message?.includes('Cast to ObjectId')) throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      throw new Error(error.response?.data?.message || 'Failed to load product details. Please try again.');
    }
  },

  async createProduct(formData: FormData): Promise<{ message: string; product: Product }> {
    const response = await api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    this.clearCache(); this.setRefreshFlag();
    const product = normalizeProduct(response?.data?.product);
    return { ...(response.data || {}), product };
  },

  async updateProduct(id: string, formData: FormData): Promise<{ message: string; product: Product }> {
    const response = await api.put(`/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    this.clearCache(); this.setRefreshFlag();
    const product = normalizeProduct(response?.data?.product);
    return { ...(response.data || {}), product };
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/products/${id}`);
    this.clearCache(); this.setRefreshFlag();
    return response.data;
  },

  async getCategories(): Promise<{ categories: string[] }> {
    const response = await api.get('/products/categories');
    return response.data;
  },

  setRefreshFlag() {
    sessionStorage.setItem('force-refresh-products', 'true');
    localStorage.setItem('force-refresh-products', Date.now().toString());
    console.log('🔄 Set refresh flag for all sessions');
  },

  shouldRefresh(): boolean {
    const sessionFlag = sessionStorage.getItem('force-refresh-products');
    const globalFlag = localStorage.getItem('force-refresh-products');
    if (sessionFlag || globalFlag) {
      sessionStorage.removeItem('force-refresh-products');
      if (globalFlag) {
        const flagTime = parseInt(globalFlag, 10);
        if (Date.now() - flagTime > 30_000) localStorage.removeItem('force-refresh-products');
      }
      return true;
    }
    return false;
  },

  clearCache() {
    localStorage.removeItem('products-cache');
    sessionStorage.removeItem('products-cache');
    memCache.clear();
    console.log('🗑️ Product cache cleared');
  },

  getCachedProducts(): ProductsResponse | null {
    try {
      const cached = localStorage.getItem('products-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300_000) return data;
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  },

  async refreshProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
    this.clearCache();
    this.setRefreshFlag();
    return this.getProducts(filters, true);
  },
};
