// src/config/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ---------- Token on requests ----------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nakoda-token');
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// ---------- Safe 401 handling ----------
const shouldSkip401Redirect = (config?: any): boolean => {
  const url: string = config?.url || '';
  // treat this endpoint as optional (never redirect)
  if (url.includes('/support/tickets/my')) return true;

  // also allow explicit opt-out via query param (no custom header -> no preflight)
  const p = config?.params || {};
  if (String(p.skip401) === '1' || String(p.skipRedirect) === '1') return true;

  return false;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && !shouldSkip401Redirect(error.config)) {
      localStorage.removeItem('nakoda-token');
      localStorage.removeItem('nakoda-user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---------- RETURNS ----------
export const getMyReturns = () => api.get('/returns').then(r => r.data);

export const createReturn = (payload: {
  orderId: string;
  items: { productId: string; orderItemId?: string; quantity: number; reason?: string }[];
  reasonType: 'damaged' | 'wrong_item' | 'not_as_described' | 'defective' | 'no_longer_needed' | 'other';
  reasonNote?: string;
  images?: File[];
  pickupAddress?: any;
}) => {
  const fd = new FormData();
  fd.append('orderId', payload.orderId);
  fd.append('reasonType', payload.reasonType);
  if (payload.reasonNote) fd.append('reasonNote', payload.reasonNote);
  fd.append('items', JSON.stringify(payload.items));
  if (payload.pickupAddress) fd.append('pickupAddress', JSON.stringify(payload.pickupAddress));
  (payload.images || []).forEach(f => fd.append('images', f));
  return api.post('/returns', fd).then(r => r.data);
};

export const cancelMyReturn = (id: string) =>
  api.patch(`/returns/${id}/cancel`, {}).then(r => r.data);

// ---------- SUPPORT (types) ----------
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high';

export interface SupportFaq {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportConfig {
  channels: { email: boolean; phone: boolean; whatsapp: boolean; chat?: boolean };
  email: { address: string; responseTimeHours: number };
  phone: { number: string; hours: string };
  whatsapp: { number: string; link: string };
  faq: { enabled: boolean; url?: string };
  updatedAt?: string;
  createdAt?: string;
  _id?: string;
}

export interface SupportTicket {
  _id: string;
  subject: string;
  message: string;
  email: string;
  phone?: string;
  orderId?: string;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
}

// ---------- SUPPORT (calls) ----------
export const getSupportConfig = () =>
  api.get('/support/config').then(r =>
    r.data as { success: boolean; config: SupportConfig }
  );

export const getSupportFaqs = (params?: { q?: string; category?: string }) =>
  api.get('/support/faqs', { params }).then(r =>
    r.data as { success: boolean; faqs: SupportFaq[] }
  );

// field name MUST be "attachments"
export const createSupportTicket = async (payload: {
  subject: string;
  message: string;
  email: string;
  phone?: string;
  orderId?: string;
  category?: string;
  priority?: TicketPriority;
  attachments?: File[];
}) => {
  const form = new FormData();
  form.append('subject', payload.subject);
  form.append('message', payload.message);
  form.append('email', payload.email);
  if (payload.phone) form.append('phone', payload.phone);
  if (payload.orderId) form.append('orderId', payload.orderId);
  if (payload.category) form.append('category', payload.category);
  if (payload.priority) form.append('priority', payload.priority);
  (payload.attachments || []).forEach(f => form.append('attachments', f));

  const { data } = await api.post('/support/tickets', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as { success: boolean; ticket: { _id: string; status: TicketStatus } };
};

// ✅ IMPORTANT: Do NOT redirect to login if 401 here (page is public)
export const getMySupportTickets = () =>
  api.get('/support/tickets/my', {
    params: { skip401: 1 }, // 👈 replaces the custom header
  }).then(r => r.data as { success: boolean; tickets: SupportTicket[] });


export default api;
