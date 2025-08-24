import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Vite Environment Variables (import.meta.env instead of process.env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nakoda Mobile';
const API_TIMEOUT = 30000;
const IS_DEVELOPMENT = import.meta.env.DEV;
const IS_PRODUCTION = import.meta.env.PROD;

// ============== Types ==============
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
  stock?: number; // UI convenience
  status: 'active' | 'inactive' | 'pending';
  category: string;
  description?: string;
  imageUrl?: string;
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
  compareAtPrice?: number | null; // preferred by UI
  originalPrice?: number | null;  // mirror for legacy readers
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

export type AdminNotificationType =
  | 'order'
  | 'promo'
  | 'system'
  | 'product'
  | 'announcement';

export interface AdminNotification {
  _id: string;
  userId?: string;
  title: string;
  message: string;
  type: AdminNotificationType;
  isRead?: boolean;
  createdAt: string;
  cta?: { label?: string; href?: string };
}

export interface AdminNotificationsListResponse {
  success: boolean;
  notifications: AdminNotification[];
  total?: number;
}

// ============== Logging helpers ==============
const log = (message: string, ...args: any[]) => {
  if (IS_DEVELOPMENT) console.log(message, ...args);
};
const logError = (message: string, ...args: any[]) => {
  if (IS_DEVELOPMENT) console.error(message, ...args);
};

// ============== Token helpers ==============
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

// ============== Axios instance ==============
const adminApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use(
  (config) => {
    log('🚀 API Request:', config.method?.toUpperCase(), config.url);
    const token = getAdminToken();
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
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

// ============== Compatibility helpers ==============

// Normalize one product so UI can rely on compareAtPrice + stock consistently
const normalizeProduct = (p: any): Product => {
  const cmp = p?.compareAtPrice ?? p?.originalPrice ?? null;
  const stockQty = p?.stockQuantity ?? p?.stock ?? 0;
  return {
    ...p,
    compareAtPrice: cmp,
    originalPrice: cmp,
    stockQuantity: stockQty,
    stock: p?.stock ?? stockQty,
  };
};

// Ensure outgoing payload carries both compareAtPrice & originalPrice, and mirrors stockQuantity
const withCompareCompat = <T extends Record<string, any>>(obj: T): T => {
  if (!obj) return obj;
  const out: any = { ...obj };

  // price compatibility
  const cmp = out.compareAtPrice ?? out.originalPrice;
  if (cmp !== undefined) {
    out.compareAtPrice = cmp;
    out.originalPrice = cmp;
  }

  // stock compatibility
  if (out.stock !== undefined && out.stockQuantity === undefined) {
    out.stockQuantity = out.stock;
  }

  return out as T;
};

const withCompareCompatArray = <T extends Record<string, any>>(arr: T[]): T[] =>
  (Array.isArray(arr) ? arr.map((x) => withCompareCompat(x)) : arr);

// ============== Utils ==============
const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ============== AUTH (Admin) ==============
export const adminSendOtp = async (data: { email: string }): Promise<ApiResponse> => {
  try {
    if (!validateEmail(data.email)) throw new Error('Invalid email format');
    log('📧 Sending OTP to email:', data.email);
    const { data: res } = await adminApi.post('/admin/send-otp', data);
    log('✅ Email OTP sent successfully');
    return res;
  } catch (error: any) {
    logError('❌ Send email OTP failed:', error.response?.data || error.message);
    throw error;
  }
};

export const adminVerifyOtp = async (data: { email: string; otp: string }): Promise<ApiResponse> => {
  try {
    if (!validateEmail(data.email)) throw new Error('Invalid email format');
    if (!/^\d{6}$/.test(data.otp)) throw new Error('OTP must be 6 digits');

    log('🔑 Verifying email OTP for:', data.email);
    const { data: res } = await adminApi.post('/admin/verify-otp', data);

    if (res.sessionToken || res.token) {
      const token = res.sessionToken || res.token;
      localStorage.setItem('adminToken', token);
      log('✅ Email OTP verification successful');
    }
    return res;
  } catch (error: any) {
    logError('❌ Email OTP verification failed:', error.response?.data || error.message);
    throw error;
  }
};

// ============== DASHBOARD ==============
export const getAdminStats = async (): Promise<AdminStats> => {
  try {
    log('📊 Fetching admin stats...');
    const { data } = await adminApi.get('/admin/stats');
    log('✅ Stats fetched successfully');
    return data;
  } catch (error: any) {
    logError('❌ Get stats failed:', error.response?.data || error.message);
    throw error;
  }
};

// ============== PRODUCT MANAGEMENT ==============
export const uploadProduct = async (formData: FormData): Promise<ApiResponse> => {
  try {
    log('⬆️ Uploading single product...');
    const { data } = await adminApi.post('/admin/products/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    log('✅ Product uploaded successfully');
    return data;
  } catch (error: any) {
    logError('❌ Upload product failed:', error.response?.data || error.message);
    throw error;
  }
};

export const bulkUploadProducts = async (products: Partial<Product>[]): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and cannot be empty');
    }
    log('📦 Bulk uploading products...', products.length, 'products');

    // ✅ ensure compareAtPrice/originalPrice + stockQuantity are mirrored
    const payload = { products: withCompareCompatArray(products) };

    const { data } = await adminApi.post('/admin/products/bulk-upload', payload, { timeout: 120000 });
    log('✅ Bulk upload completed');
    return data;
  } catch (error: any) {
    logError('❌ Bulk upload failed:', error.response?.data || error.message);
    throw error;
  }
};

export const getProducts = async (params: ProductFilters = {}): Promise<ProductsResponse> => {
  try {
    log('📦 Fetching products with filters:', params);
    const { data } = await adminApi.get('/admin/products', { params });
    log('✅ Products fetched successfully');
    const normalized: ProductsResponse = {
      ...data,
      products: (data.products || []).map(normalizeProduct),
    };
    return normalized;
  } catch (error: any) {
    logError('❌ Get products failed:', error.response?.data || error.message);
    throw error;
  }
};

export const getProductById = async (
  productId: string
): Promise<{ success: boolean; product: Product; message?: string }> => {
  try {
    log('📦 Fetching product by ID:', productId);
    const { data } = await adminApi.get(`/admin/products/${productId}`);
    log('✅ Product fetched successfully');
    return { ...data, product: normalizeProduct(data.product) };
  } catch (error: any) {
    logError('❌ Get product by ID failed:', error.response?.data || error.message);
    throw error;
  }
};

export const updateProduct = async (
  productId: string,
  productData: Partial<Product>
): Promise<ApiResponse> => {
  try {
    log('✏️ Updating product:', productId);

    // ✅ send compat body so backend (or other readers) get both fields
    const body = withCompareCompat(productData);

    const { data } = await adminApi.put(`/admin/products/${productId}`, body);
    log('✅ Product updated successfully');
    return data;
  } catch (error: any) {
    logError('❌ Update product failed:', error.response?.data || error.message);
    throw error;
  }
};

export const deleteProduct = async (productId: string): Promise<ApiResponse> => {
  try {
    log('🗑️ Deleting product:', productId);
    const { data } = await adminApi.delete(`/admin/products/${productId}`);
    log('✅ Product deleted successfully');
    return data;
  } catch (error: any) {
    logError('❌ Delete product failed:', error.response?.data || error.message);
    throw error;
  }
};

export const bulkUpdateProducts = async (
  productIds: string[],
  updateData: Partial<Product>
): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs array is required and cannot be empty');
    }
    log('📝 Bulk updating products:', productIds.length, 'products');

    // ✅ mirror compareAtPrice/originalPrice + stockQuantity
    const payload = {
      productIds,
      updateData: withCompareCompat(updateData),
    };

    const { data } = await adminApi.put('/admin/products/bulk-update', payload);
    log('✅ Bulk update completed');
    return data;
  } catch (error: any) {
    logError('❌ Bulk update failed:', error.response?.data || error.message);
    throw error;
  }
};

export const bulkDeleteProducts = async (productIds: string[]): Promise<ApiResponse> => {
  try {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs array is required and cannot be empty');
    }
    log('🗑️ Bulk deleting products:', productIds.length, 'products');
    const { data } = await adminApi.delete('/admin/products/bulk-delete', {
      data: { productIds },
    });
    log('✅ Bulk delete completed');
    return data;
  } catch (error: any) {
    logError('❌ Bulk delete failed:', error.response?.data || error.message);
    throw error;
  }
};

export const updateProductStatus = async (
  productId: string,
  status: 'active' | 'inactive' | 'pending'
): Promise<ApiResponse> => {
  try {
    log('🔄 Updating product status:', productId, status);

    // ⚠️ Your admin router uses PUT /products/:id/status
    const { data } = await adminApi.put(`/admin/products/${productId}/status`, { status });

    log('✅ Product status updated successfully');
    return data;
  } catch (error: any) {
    logError('❌ Update product status failed:', error.response?.data || error.message);
    throw error;
  }
};

export const updateProductStock = async (productId: string, stock: number): Promise<ApiResponse> => {
  try {
    log('📦 Updating product stock:', productId, stock);

    // If you wire a route, make sure it exists server-side: PATCH /products/:id/stock
    const { data } = await adminApi.patch(`/admin/products/${productId}/stock`, {
      stock,
      stockQuantity: stock,
    });

    log('✅ Product stock updated successfully');
    return data;
  } catch (error: any) {
    logError('❌ Update product stock failed:', error.response?.data || error.message);
    throw error;
  }
};

// ============== ANALYTICS / REPORTING ==============
export const getLowStockProducts = async (threshold: number = 10): Promise<ProductsResponse> => {
  try {
    log('📉 Fetching low stock products...');
    const { data } = await adminApi.get(`/admin/products/low-stock`, { params: { threshold } });
    log('✅ Low stock products fetched');
    return { ...data, products: (data.products || []).map(normalizeProduct) };
  } catch (error: any) {
    logError('❌ Get low stock products failed:', error.response?.data || error.message);
    throw error;
  }
};

export const getProductsByCategory = async (): Promise<{
  success: boolean;
  categories: Record<string, number>;
}> => {
  try {
    log('📊 Fetching products by category...');
    const { data } = await adminApi.get('/admin/products/by-category');
    log('✅ Products by category fetched');
    return data;
  } catch (error: any) {
    logError('❌ Get products by category failed:', error.response?.data || error.message);
    throw error;
  }
};

export const exportProducts = async (filters?: ProductFilters): Promise<Blob> => {
  try {
    log('📊 Exporting products to CSV...');
    const res = await adminApi.get('/admin/products/export', {
      params: filters,
      responseType: 'blob',
    });
    log('✅ Products exported successfully');
    return res.data;
  } catch (error: any) {
    logError('❌ Export products failed:', error.response?.data || error.message);
    throw error;
  }
};

export const adminListNotifications = async (
  params?: { limit?: number; page?: number }
): Promise<AdminNotificationsListResponse> => {
  const { data } = await adminApi.get('/admin/notifications', { params });
  return data;
};

export const adminCreateNotification = async (payload: {
  title: string;
  message: string;
  type?: AdminNotificationType;
  audience: 'all' | 'user';
  targetUserId?: string;
  cta?: { label?: string; href?: string };
}): Promise<ApiResponse> => {
  const { data } = await adminApi.post('/admin/notifications', payload);
  return data;
};

export const adminDeleteNotification = async (id: string): Promise<ApiResponse> => {
  const { data } = await adminApi.delete(`/admin/notifications/${id}`);
  return data;
};

// Legacy alias
export const getAdminProducts = getProducts;

// ============== ADMIN USERS (all via adminApi with Bearer) ==============
export const getUsers = async (params: {
  page?: number;
  limit?: number;
  q?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  const { data } = await adminApi.get('/admin/users', { params });
  return data; // { success, users, totalUsers, totalPages, ... }
};

export const updateUser = async (userId: string, patch: any) => {
  const { data } = await adminApi.patch(`/admin/users/${userId}`, patch);
  return data; // { success, message, user? }
};

export const toggleUserStatus = async (
  userId: string,
  status: 'active' | 'inactive' | 'banned'
) => {
  const { data } = await adminApi.patch(`/admin/users/${userId}/status`, { status });
  return data; // { success }
};

export const deleteUser = async (userId: string) => {
  const { data } = await adminApi.delete(`/admin/users/${userId}`);
  return data; // { success }
};

export const sendPasswordResetEmail = async (userId: string) => {
  const { data } = await adminApi.post(`/admin/users/${userId}/password-reset`);
  return data; // { success }
};

export const getUserAnalytics = async (params: { range: '7d' | '30d' | '90d' }) => {
  const { data } = await adminApi.get('/admin/users/analytics', { params });
  return data; // { success, analytics: {...} }
};

// === ORDERS (admin) ===========================================================
export interface AdminOrder {
  _id: string;
  orderNumber: string;
  user?: { _id: string; name?: string; email?: string };
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | string;
  total: number;
  createdAt: string;
}

export const getAdminOrders = (params: {
  page?: number;
  limit?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => adminApi.get('/admin/orders', { params }).then(r => r.data);

// ============== Env export ==============
export const env = {
  apiUrl: API_BASE_URL,
  appName: APP_NAME,
  isDevelopment: IS_DEVELOPMENT,
  isProduction: IS_PRODUCTION,
  razorpayKeyId: import.meta.env.VITE_RAZORPAY_KEY_ID,
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};

export default adminApi;
