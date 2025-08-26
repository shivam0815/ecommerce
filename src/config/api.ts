import axios from 'axios';

const API_BASE_URL = 
    import.meta.env.VITE_API_URL || 'http://localhost:5000/api';


// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nakoda-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nakoda-token');
      localStorage.removeItem('nakoda-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);



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

export default api;
