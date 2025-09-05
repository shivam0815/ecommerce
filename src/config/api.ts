// src/config/api.ts
import axios from "axios";

/** Base URL
 * Prefer env; otherwise use a RELATIVE "/api" so it works on any domain.
 * (Avoid hardcoding a domain to dodge typos and CORS issues.)
 */
const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || "/api";

/** One axios instance for the app */
const api = axios.create({
  baseURL: API_BASE_URL,
  // ❌ Do NOT set a global Content-Type; let axios infer it (JSON vs FormData)
  withCredentials: true,
  timeout: 20000,
});

/* -------------------------- REQUEST INTERCEPTOR -------------------------- */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("nakoda-token");

    // Handle both relative and absolute urls
    const url = (config.url || "").replace(config.baseURL || "", "");
    const isPhoneAuth =
      url.startsWith("/auth/phone/") || url.includes("/auth/phone/");

    if (!isPhoneAuth && token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* -------------------------- RESPONSE INTERCEPTOR ------------------------- */
const shouldSkip401Redirect = (config?: any): boolean => {
  const url: string = config?.url || "";
  if (url.includes("/support/tickets/my")) return true;
  const p = config?.params || {};
  if (String(p.skip401) === "1" || String(p.skipRedirect) === "1") return true;
  return false;
};

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && !shouldSkip401Redirect(error.config)) {
      localStorage.removeItem("nakoda-token");
      localStorage.removeItem("nakoda-user");
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/* ============================== RETURNS (user) ============================== */
export const getMyReturns = () => api.get("/returns").then((r) => r.data);

export const createReturn = (payload: {
  orderId: string;
  items: { productId: string; orderItemId?: string; quantity: number; reason?: string }[];
  reasonType:
    | "damaged"
    | "wrong_item"
    | "not_as_described"
    | "defective"
    | "no_longer_needed"
    | "other";
  reasonNote?: string;
  images?: File[];
  pickupAddress?: any;
}) => {
  const fd = new FormData();
  fd.append("orderId", payload.orderId);
  fd.append("reasonType", payload.reasonType);
  if (payload.reasonNote) fd.append("reasonNote", payload.reasonNote);
  fd.append("items", JSON.stringify(payload.items));
  if (payload.pickupAddress) fd.append("pickupAddress", JSON.stringify(payload.pickupAddress));
  (payload.images || []).forEach((f) => fd.append("images", f));

  // ✅ No headers override: axios will set multipart/form-data with boundary
  return api.post("/returns", fd).then((r) => r.data);
};

export const cancelMyReturn = (id: string) =>
  api.patch(`/returns/${id}/cancel`, {}).then((r) => r.data);

/* ============================== SUPPORT (types) ============================= */
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high";

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

/* ============================== SUPPORT (calls) ============================= */
export const getSupportConfig = () =>
  api.get("/support/config").then((r) => r.data as { success: boolean; config: SupportConfig });

export const getSupportFaqs = (params?: { q?: string; category?: string }) =>
  api.get("/support/faqs", { params }).then((r) => r.data as { success: boolean; faqs: SupportFaq[] });

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
  form.append("subject", payload.subject);
  form.append("message", payload.message);
  form.append("email", payload.email);
  if (payload.phone) form.append("phone", payload.phone);
  if (payload.orderId) form.append("orderId", payload.orderId);
  if (payload.category) form.append("category", payload.category);
  if (payload.priority) form.append("priority", payload.priority);
  (payload.attachments || []).forEach((f) => form.append("attachments", f));

  // ✅ No Content-Type override here either
  const { data } = await api.post("/support/tickets", form);
  return data as { success: boolean; ticket: { _id: string; status: TicketStatus } };
};

// Public OTP endpoints (skip 401 redirects)
export const getMySupportTickets = () =>
  api.get("/support/tickets/my", { params: { skip401: 1 } })
     .then((r) => r.data as { success: boolean; tickets: SupportTicket[] });

export const sendPhoneOtp = (phone: string) =>
  api.post("/auth/phone/send-otp", { phone }, { params: { skip401: 1 } })
     .then((r) => r.data);

export const verifyPhoneOtp = (phone: string, otp: string) =>
  api.post("/auth/phone/verify", { phone, otp }, { params: { skip401: 1 } })
     .then((r) => r.data);

export default api;
