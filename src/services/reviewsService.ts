import api from '../config/api';

export interface ReviewInput {
  productId: string;
  rating: number;      // 1..5
  title?: string;
  comment: string;
  userName?: string;
  userEmail?: string;
}

export const reviewsService = {
  async list(productId: string, page = 1, limit = 10) {
    const { data } = await api.get('/reviews', { params: { productId, page, limit } });
    return data; // { success, reviews, pagination, distribution }
  },
  async create(payload: ReviewInput) {
    const { data } = await api.post('/reviews', payload);
    return data; // { success, message, review }
  }
};
