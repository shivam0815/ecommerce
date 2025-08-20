import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Vite Environment Variables (import.meta.env instead of process.env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nakoda Mobile';
const API_TIMEOUT = 30000;
const IS_DEVELOPMENT = import.meta.env.DEV;
const IS_PRODUCTION = import.meta.env.PROD;

// Type definitions
export interface ApiResponse {
  success: boolean;
  sessionToken?: string;
  token?: string;
  expiresIn?: number;
  message?: string;
  error?: string;
  data?: any;
  successCount?: number;
  failureCount?: number;
}

export interface AdminStats {
  success: boolean;
  stats: {
    totalProducts: number;
    totalUsers: number;
    totalOrders: number;
    pendingOrders: number;
    todaySales: number;
    lowStockItems: number;
  };
}

export interface Product {
  _id: string;
  name: string;
  price: number;
  stockQuantity: number;
  status: 'active' | 'inactive' | 'pending';
  category: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductsResponse {
  success: boolean;
  products: Product[];
  totalProducts: number;
  totalPages: number;
  currentPage: number;
  message?: string;
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  stockFilter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
}

// Utility functions for logging
const log = (message: string, ...args: any[]) => {
  if (IS_DEVELOPMENT) {
    console.log(message, ...args);
  }
};

const logError = (message: string, ...args: any[]) => {
  if (IS_DEVELOPMENT) {
    console.error(message, ...args);
  }
};

// Create axios instance for admin API
const adminApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
adminApi.interceptors.request.use(
  (config) => {
    log('🚀 API Request:', config.method?.toUpperCase(), config.url);
    
    const token = getAdminToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      log('📋 Token check: Present');
    } else {
      log('⚠️ Token check: Missing');
    }
    
    return config;
  },
  (error) => {
    logError('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
adminApi.interceptors.response.use(
  (response: AxiosResponse) => {
    log('✅ API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    logError('❌ API Error:', error.response?.status, error.config?.url);
    logError('Error details:', error.response?.data);
    
    if (error.response?.status === 401) {
      log('🔒 Unauthorized - clearing token');
      clearAdminSession();
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Utility functions
export const isAdminAuthenticated = (): boolean => {
  const token = localStorage.getItem('adminToken');
  return !!token;
};

export const getAdminToken = (): string | null => {
  return localStorage.getItem('adminToken');
};

export const clearAdminSession = (): void => {
  localStorage.removeItem('adminToken');
};

// Email validation utility
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ✅ AUTHENTICATION FUNCTIONS

export const adminSendOtp = async (data: { email: string }): Promise<ApiResponse> => {
  try {
    if (!validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    log('📧 Sending OTP to email:', data.email);
    const response = await adminApi.post('/admin/send-otp', data);
    log('✅ Email OTP sent successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Send email OTP failed:', error.response?.data || error.message);
    throw error;
  }
};

export const adminVerifyOtp = async (data: { email: string; otp: string }): Promise<ApiResponse> => {
  try {
    if (!validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    if (!/^\d{6}$/.test(data.otp)) {
      throw new Error('OTP must be 6 digits');
    }

    log('🔑 Verifying email OTP for:', data.email);
    const response = await adminApi.post('/admin/verify-otp', data);
    
    if (response.data.sessionToken || response.data.token) {
      const token = response.data.sessionToken || response.data.token;
      localStorage.setItem('adminToken', token);
      log('✅ Email OTP verification successful');
    }
    
    return response.data;
  } catch (error: any) {
    logError('❌ Email OTP verification failed:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ DASHBOARD FUNCTIONS

export const getAdminStats = async (): Promise<AdminStats> => {
  try {
    log('📊 Fetching admin stats...');
    const response = await adminApi.get('/admin/stats');
    log('✅ Stats fetched successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Get stats failed:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ PRODUCT MANAGEMENT FUNCTIONS

// Single product upload
export const uploadProduct = async (formData: FormData): Promise<ApiResponse> => {
  try {
    log('⬆️ Uploading single product...');
    const response = await adminApi.post('/admin/products/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    log('✅ Product uploaded successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Upload product failed:', error.response?.data || error.message);
    throw error;
  }
};

// Bulk product upload
export const bulkUploadProducts = async (products: Partial<Product>[]): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and cannot be empty');
    }

    log('📦 Bulk uploading products...', products.length, 'products');
    const response = await adminApi.post('/admin/products/bulk-upload', {
      products
    }, {
      timeout: 120000,
    });
    log('✅ Bulk upload completed');
    return response.data;
  } catch (error: any) {
    logError('❌ Bulk upload failed:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ INVENTORY MANAGEMENT FUNCTIONS

// Get products with pagination and filters (for inventory management)
export const getProducts = async (params: ProductFilters = {}): Promise<ProductsResponse> => {
  try {
    log('📦 Fetching products with filters:', params);
    const response = await adminApi.get('/admin/products', { params });
    log('✅ Products fetched successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Get products failed:', error.response?.data || error.message);
    throw error;
  }
};

// Get single product by ID
export const getProductById = async (productId: string): Promise<{ success: boolean; product: Product; message?: string }> => {
  try {
    log('📦 Fetching product by ID:', productId);
    const response = await adminApi.get(`/admin/products/${productId}`);
    log('✅ Product fetched successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Get product by ID failed:', error.response?.data || error.message);
    throw error;
  }
};

// Update single product
export const updateProduct = async (
  productId: string, 
  productData: Partial<Product>
): Promise<ApiResponse> => {
  try {
    log('✏️ Updating product:', productId);
    const response = await adminApi.put(`/admin/products/${productId}`, productData);
    log('✅ Product updated successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Update product failed:', error.response?.data || error.message);
    throw error;
  }
};

// Delete single product
export const deleteProduct = async (productId: string): Promise<ApiResponse> => {
  try {
    log('🗑️ Deleting product:', productId);
    const response = await adminApi.delete(`/admin/products/${productId}`);
    log('✅ Product deleted successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Delete product failed:', error.response?.data || error.message);
    throw error;
  }
};

// Bulk update products
export const bulkUpdateProducts = async (
  productIds: string[], 
  updateData: Partial<Product>
): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs array is required and cannot be empty');
    }

    log('📝 Bulk updating products:', productIds.length, 'products');
    const response = await adminApi.put('/admin/products/bulk-update', {
      productIds,
      updateData
    });
    log('✅ Bulk update completed');
    return response.data;
  } catch (error: any) {
    logError('❌ Bulk update failed:', error.response?.data || error.message);
    throw error;
  }
};

// Bulk delete products
export const bulkDeleteProducts = async (productIds: string[]): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs array is required and cannot be empty');
    }

    log('🗑️ Bulk deleting products:', productIds.length, 'products');
    const response = await adminApi.delete('/admin/products/bulk-delete', {
      data: { productIds }
    });
    log('✅ Bulk delete completed');
    return response.data;
  } catch (error: any) {
    logError('❌ Bulk delete failed:', error.response?.data || error.message);
    throw error;
  }
};

// Update product status
export const updateProductStatus = async (
  productId: string, 
  status: 'active' | 'inactive' | 'pending'
): Promise<ApiResponse> => {
  try {
    log('🔄 Updating product status:', productId, status);
    const response = await adminApi.patch(`/admin/products/${productId}/status`, { status });
    log('✅ Product status updated successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Update product status failed:', error.response?.data || error.message);
    throw error;
  }
};

// Update product stock
export const updateProductStock = async (
  productId: string, 
  stock: number
): Promise<ApiResponse> => {
  try {
    log('📦 Updating product stock:', productId, stock);
    const response = await adminApi.patch(`/admin/products/${productId}/stock`, { stock });
    log('✅ Product stock updated successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Update product stock failed:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ ANALYTICS AND REPORTING FUNCTIONS

// Get low stock products
export const getLowStockProducts = async (threshold: number = 10): Promise<ProductsResponse> => {
  try {
    log('📉 Fetching low stock products...');
    const response = await adminApi.get(`/admin/products/low-stock?threshold=${threshold}`);
    log('✅ Low stock products fetched');
    return response.data;
  } catch (error: any) {
    logError('❌ Get low stock products failed:', error.response?.data || error.message);
    throw error;
  }
};

// Get products by category
export const getProductsByCategory = async (): Promise<{ success: boolean; categories: Record<string, number> }> => {
  try {
    log('📊 Fetching products by category...');
    const response = await adminApi.get('/admin/products/by-category');
    log('✅ Products by category fetched');
    return response.data;
  } catch (error: any) {
    logError('❌ Get products by category failed:', error.response?.data || error.message);
    throw error;
  }
};

// Export products to CSV
export const exportProducts = async (filters?: ProductFilters): Promise<Blob> => {
  try {
    log('📊 Exporting products to CSV...');
    const response = await adminApi.get('/admin/products/export', {
      params: filters,
      responseType: 'blob'
    });
    log('✅ Products exported successfully');
    return response.data;
  } catch (error: any) {
    logError('❌ Export products failed:', error.response?.data || error.message);
    throw error;
  }
};

// ✅ LEGACY SUPPORT (keeping for backward compatibility)
export const getAdminProducts = getProducts; // Alias for backward compatibility

// Export environment variables for use in components
export const env = {
  apiUrl: API_BASE_URL,
  appName: APP_NAME,
  isDevelopment: IS_DEVELOPMENT,
  isProduction: IS_PRODUCTION,
  razorpayKeyId: import.meta.env.VITE_RAZORPAY_KEY_ID,
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};

export default adminApi;
