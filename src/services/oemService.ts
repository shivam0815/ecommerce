import api from '../config/api';
import { OEMInquiry } from '../types';

export interface OEMInquiryData {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory: string;
  quantity: number;
  customization: string;
  message: string;
}

export interface OEMInquiriesResponse {
  inquiries: OEMInquiry[];
  totalPages: number;
  currentPage: number;
  total: number;
}

export const oemService = {
  async createInquiry(data: OEMInquiryData): Promise<{ message: string; inquiry: any }> {
    const response = await api.post('/oem', data);
    return response.data;
  },

  async getInquiries(page: number = 1, limit: number = 20, status?: string): Promise<OEMInquiriesResponse> {
    const response = await api.get('/oem', { 
      params: { page, limit, status } 
    });
    return response.data;
  },

  async updateInquiry(id: string, status: string): Promise<{ message: string; inquiry: OEMInquiry }> {
    const response = await api.put(`/oem/${id}`, { status });
    return response.data;
  }
};