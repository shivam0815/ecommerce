// src/services/oemService.ts
import api from '../config/api';
import type { OEMInquiry } from '../types';

export interface OEMInquiryData {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;              // allow "+country" and digits
  productCategory: string;    // backend enum will validate
  quantity: number;           // MOQ 100 (validated below)
  customization: string;
  message?: string;
}

export interface OEMInquiriesResponse {
  inquiries: OEMInquiry[];
  totalPages: number;
  currentPage: number;
  total: number;
}

type CreateOEMResponseRaw = {
  message: string;
  inquiry: {
    id?: string;
    _id?: string;
    companyName: string;
    contactPerson: string;
    status: 'pending' | 'contacted' | 'quoted' | 'closed';
  };
};

type UpdateOEMResponseRaw = {
  message: string;
  inquiry: any; // normalized below to OEMInquiry-ish shape
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const phoneRegex = /^\+?[0-9]{7,15}$/;

function normalizeId<T extends Record<string, any>>(obj: T): T & { id: string } {
  const id = (obj.id ?? obj._id)?.toString?.() ?? obj.id ?? obj._id;
  return { ...obj, id };
}

function extractErrorMessage(err: any): string {
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    'Something went wrong';
  return String(msg);
}

function validatePayload(data: OEMInquiryData) {
  if (!data.companyName?.trim()) throw new Error('Company name is required');
  if (!data.contactPerson?.trim()) throw new Error('Contact person is required');

  if (!emailRegex.test(data.email || '')) throw new Error('Please enter a valid email');
  if (!phoneRegex.test((data.phone || '').replace(/\s+/g, '')))
    throw new Error('Please enter a valid phone number');

  if (!data.productCategory) throw new Error('Product category is required');

  // MOQ aligned with backend (100)
  if (!Number.isInteger(data.quantity) || data.quantity < 100)
    throw new Error('Quantity must be an integer of at least 100');

  if (!data.customization?.trim())
    throw new Error('Please describe your customization requirements');
}

export const oemService = {
  /** Create a new OEM inquiry (public) */
  async createInquiry(
    data: OEMInquiryData
  ): Promise<{ message: string; inquiry: { id: string; companyName: string; contactPerson: string; status: OEMInquiry['status'] } }> {
    try {
      validatePayload(data);

      // Normalize FE value “Custom Product” → backend enum “Custom” (also handled server-side)
      const payload = {
        ...data,
        productCategory:
          data.productCategory === 'Custom Product' ? 'Custom' : data.productCategory,
      };

      const res = await api.post<CreateOEMResponseRaw>('/oem', payload);
      const normalizedInquiry = normalizeId(res.data.inquiry);

      return {
        message: res.data.message,
        inquiry: {
          id: normalizedInquiry.id,
          companyName: normalizedInquiry.companyName,
          contactPerson: normalizedInquiry.contactPerson,
          status: normalizedInquiry.status,
        },
      };
    } catch (err: any) {
      throw new Error(extractErrorMessage(err));
    }
  },

  /** Admin: list inquiries (requires auth on backend) */
  async getInquiries(
    page: number = 1,
    limit: number = 20,
    status?: OEMInquiry['status']
  ): Promise<OEMInquiriesResponse> {
    try {
      const res = await api.get('/oem', { params: { page, limit, status } });

      const inquiries: OEMInquiry[] = Array.isArray(res.data?.inquiries)
        ? res.data.inquiries.map((i: any) => normalizeId(i))
        : [];

      return {
        inquiries,
        totalPages: Number(res.data?.totalPages ?? 0),
        currentPage: Number(res.data?.currentPage ?? page),
        total: Number(res.data?.total ?? inquiries.length),
      };
    } catch (err: any) {
      throw new Error(extractErrorMessage(err));
    }
  },

  /** Admin: update inquiry status */
  async updateInquiry(
    id: string,
    status: OEMInquiry['status']
  ): Promise<{ message: string; inquiry: OEMInquiry }> {
    try {
      const res = await api.put<UpdateOEMResponseRaw>(`/oem/${id}`, { status });
      const normalized = normalizeId(res.data.inquiry);
      return {
        message: res.data.message,
        inquiry: normalized,
      };
    } catch (err: any) {
      throw new Error(extractErrorMessage(err));
    }
  },
};
