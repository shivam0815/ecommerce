import api from '../config/api';
import { Order, Address } from '../types';

export interface OrdersResponse {
  orders: Order[];
  totalPages: number;
  currentPage: number;
  total: number;
}

export interface CreateOrderData {
  shippingAddress: Address & { name: string; phone: string };
  paymentMethod: 'razorpay' | 'stripe' | 'cod';
}

export const orderService = {
  async createOrder(data: CreateOrderData): Promise<{ message: string; order: Order }> {
    const response = await api.post('/orders', data);
    return response.data;
  },

  async getOrders(page: number = 1, limit: number = 10): Promise<OrdersResponse> {
    const response = await api.get('/orders', { params: { page, limit } });
    return response.data;
  },

  async getOrder(id: string): Promise<{ order: Order }> {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  async getAllOrders(page: number = 1, limit: number = 20, status?: string): Promise<OrdersResponse> {
    const response = await api.get('/orders/admin/all', { 
      params: { page, limit, status } 
    });
    return response.data;
  },

  async updateOrderStatus(id: string, status: string, trackingNumber?: string): Promise<{ message: string; order: Order }> {
    const response = await api.put(`/orders/${id}/status`, { status, trackingNumber });
    return response.data;
  }
};