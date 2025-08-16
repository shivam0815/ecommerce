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
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/* ---------- normalize helpers ---------- */
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

function normalizeProduct(p: any): Product {
  return {
    ...p,
    specifications: normalizeSpecifications(p?.specifications),
  };
}

function normalizeProductsResponse(data: any): ProductsResponse {
  const pagination = data?.pagination || {};
  const products = (data?.products || []).map(normalizeProduct);

  const totalPages =
    data?.totalPages ??
    pagination.totalPages ??
    pagination.pages ??
    1;

  const currentPage =
    data?.currentPage ??
    pagination.currentPage ??
    pagination.page ??
    1;

  const total =
    data?.total ??
    pagination.totalProducts ??
    pagination.total ??
    products.length;

  const limit = pagination.limit ?? data?.limit ?? 12;

  const hasMore =
    pagination.hasMore ??
    (Number(currentPage) < Number(totalPages));

  return {
    products,
    totalPages: Number(totalPages),
    currentPage: Number(currentPage),
    total: Number(total),
    pagination: {
      currentPage: Number(currentPage),
      totalPages: Number(totalPages),
      totalProducts: Number(total),
      hasMore: Boolean(hasMore),
      limit: Number(limit),
    },
  };
}

/* ---------- service ---------- */
export const productService = {
  async getProducts(filters: ProductFilters = {}, forceRefresh = false): Promise<ProductsResponse> {
    try {
      const params = { ...filters, ...(forceRefresh && { _t: Date.now() }) };
      console.log('📤 Fetching products with params:', params);
      const response = await api.get('/products', { params });

      const normalized = normalizeProductsResponse(response.data);
      localStorage.setItem(
        'products-cache',
        JSON.stringify({ data: normalized, timestamp: Date.now() })
      );

      console.log('✅ Products fetched:', normalized.products.length);
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

  async getProduct(id: string): Promise<{ success: boolean; product: Product; message?: string }> {
    try {
      console.log('📤 Fetching single product:', id);

      if (!id || id.length !== 24) {
        throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      }

      const response = await api.get(`/products/${id}`);
      const product = normalizeProduct(response.data.product);

      console.log('✅ Single product fetched:', product?.name || 'Unknown');

      return { success: true, product, message: response.data.message };
    } catch (error: any) {
      console.error('❌ Failed to fetch single product:', error);
      if (error.response?.status === 404) {
        throw new Error('Product not found or has been removed.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid product ID. Please check the product link.');
      } else if (error.message?.includes('Cast to ObjectId')) {
        throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      } else {
        throw new Error(error.response?.data?.message || 'Failed to load product details. Please try again.');
      }
    }
  },

  async createProduct(formData: FormData): Promise<{ message: string; product: Product }> {
    try {
      console.log('📤 Creating product...');
      const response = await api.post('/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      this.clearCache();
      this.setRefreshFlag();
      const product = normalizeProduct(response.data.product);
      return { ...response.data, product };
    } catch (error) {
      console.error('❌ Product creation failed:', error);
      throw error;
    }
  },

  async updateProduct(id: string, formData: FormData): Promise<{ message: string; product: Product }> {
    try {
      const response = await api.put(`/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      this.clearCache();
      this.setRefreshFlag();
      const product = normalizeProduct(response.data.product);
      return { ...response.data, product };
    } catch (error) {
      console.error('❌ Product update failed:', error);
      throw error;
    }
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/products/${id}`);
      this.clearCache();
      this.setRefreshFlag();
      return response.data;
    } catch (error) {
      console.error('❌ Product deletion failed:', error);
      throw error;
    }
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
        const flagTime = parseInt(globalFlag);
        if (Date.now() - flagTime > 30000) {
          localStorage.removeItem('force-refresh-products');
        }
      }
      return true;
    }
    return false;
  },

  clearCache() {
    localStorage.removeItem('products-cache');
    sessionStorage.removeItem('products-cache');
    console.log('🗑️ Product cache cleared');
  },

  getCachedProducts(): ProductsResponse | null {
    try {
      const cached = localStorage.getItem('products-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) return data; // 5 minutes
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
