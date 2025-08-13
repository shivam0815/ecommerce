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

export const productService = {
  // ✅ Enhanced getProducts with cache busting
  async getProducts(filters: ProductFilters = {}, forceRefresh = false): Promise<ProductsResponse> {
    try {
      // ✅ Add cache busting parameter
      const params = {
        ...filters,
        ...(forceRefresh && { _t: Date.now() })
      };
      console.log('📤 Fetching products with params:', params);
      const response = await api.get('/products', { params });
      console.log('✅ Products fetched:', response.data.products?.length || 0);

      // ✅ Cache successful response
      if (response.data.products) {
        localStorage.setItem('products-cache', JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }));
      }
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      // ✅ Try cache as fallback
      const cached = this.getCachedProducts();
      if (cached) {
        console.log('📦 Using cached products as fallback');
        return cached;
      }
      throw error;
    }
  },

  // ✅ NEW: Get single product by ID
  async getProduct(id: string): Promise<{ success: boolean; product: Product; message?: string }> {
    try {
      console.log('📤 Fetching single product:', id);
      
      // Validate ID format (MongoDB ObjectId should be 24 characters)
      if (!id || id.length !== 24) {
        throw new Error('Invalid product ID format. Product IDs must be 24-character MongoDB ObjectIds.');
      }

      const response = await api.get(`/products/${id}`);
      console.log('✅ Single product fetched:', response.data.product?.name || 'Unknown');
      
      return {
        success: true,
        product: response.data.product,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('❌ Failed to fetch single product:', error);
      
      // Enhanced error handling
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

  // ✅ Enhanced createProduct with cache invalidation
  async createProduct(formData: FormData): Promise<{ message: string; product: Product }> {
    try {
      console.log('📤 Creating product...');
      const response = await api.post('/products', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('✅ Product created successfully:', response.data.product?._id);
      
      // ✅ CRITICAL: Clear cache immediately after creation
      this.clearCache();
      this.setRefreshFlag();
      
      return response.data;
    } catch (error) {
      console.error('❌ Product creation failed:', error);
      throw error;
    }
  },

  async updateProduct(id: string, formData: FormData): Promise<{ message: string; product: Product }> {
    try {
      const response = await api.put(`/products/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // ✅ Clear cache after update
      this.clearCache();
      this.setRefreshFlag();
      return response.data;
    } catch (error) {
      console.error('❌ Product update failed:', error);
      throw error;
    }
  },

  async deleteProduct(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/products/${id}`);
      // ✅ Clear cache after delete
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

  // ✅ New method to set refresh flag for all sessions
  setRefreshFlag() {
    sessionStorage.setItem('force-refresh-products', 'true');
    localStorage.setItem('force-refresh-products', Date.now().toString());
    console.log('🔄 Set refresh flag for all sessions');
  },

  // ✅ Check if refresh is needed
  shouldRefresh(): boolean {
    const sessionFlag = sessionStorage.getItem('force-refresh-products');
    const globalFlag = localStorage.getItem('force-refresh-products');
    
    if (sessionFlag || globalFlag) {
      // Clear flags after checking
      sessionStorage.removeItem('force-refresh-products');
      if (globalFlag) {
        const flagTime = parseInt(globalFlag);
        // Clear global flag if older than 30 seconds
        if (Date.now() - flagTime > 30000) {
          localStorage.removeItem('force-refresh-products');
        }
      }
      return true;
    }
    
    return false;
  },

  // ✅ Cache management methods
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
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 300000) {
          return data;
        }
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  },

  // ✅ Force refresh products
  async refreshProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
    this.clearCache();
    this.setRefreshFlag();
    return this.getProducts(filters, true);
  }
};
