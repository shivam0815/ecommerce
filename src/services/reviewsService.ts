// src/services/reviewsService.ts
import api from '../config/api';

export interface ReviewInput {
  productId: string;
  rating: number;      // 1..5
  title?: string;
  comment: string;
  userName?: string;
  userEmail?: string;
}

type Pagination = { page: number; limit: number; total: number; pages: number };

function normPagination(p: any, fallback: Pagination): Pagination {
  return {
    page: Number(p?.page ?? p?.currentPage ?? fallback.page),
    limit: Number(p?.limit ?? fallback.limit),
    total: Number(p?.total ?? p?.totalProducts ?? fallback.total),
    pages: Number(p?.pages ?? p?.totalPages ?? fallback.pages),
  };
}

/** Let other tabs/components know reviews changed for a product */
function notifyReviewsChanged(productId: string) {
  try {
    // DOM event (same tab)
    window.dispatchEvent(new CustomEvent('reviews:changed', { detail: { productId } }));
    // localStorage ping (other tabs)
    localStorage.setItem(`reviews:changed:${productId}`, String(Date.now()));
  } catch {}
}

export const reviewsService = {
  /** GET /api/products/:productId/reviews */
  async list(
    productId: string,
    page = 1,
    limit = 10,
    sort: 'new' | 'old' | 'top' = 'new'
  ): Promise<{ reviews: any[]; pagination: Pagination }> {
    const { data } = await api.get(`/products/${productId}/reviews`, {
      params: { page, limit, sort, _ts: Date.now() }, // cache-bust
    });
    if (!data?.success) throw new Error(data?.message || 'Failed to fetch reviews');

    const fallback: Pagination = { page, limit, total: 0, pages: 1 };
    return {
      reviews: Array.isArray(data.data) ? data.data : [],
      pagination: normPagination(data.pagination, fallback),
    };
  },

  /** POST /api/products/:productId/reviews */
  async create(payload: ReviewInput): Promise<any> {
    const { productId, ...body } = payload;
    try {
      const { data } = await api.post(`/products/${productId}/reviews`, body);
      if (!data?.success) throw new Error(data?.message || 'Failed to submit review');

      // 🔔 Tell product cards / other tabs to refresh their summary
      notifyReviewsChanged(productId);

      return data.data; // review doc
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 400) throw new Error(msg || 'Invalid review data.');
      if (status === 403) throw new Error(msg || 'Only verified purchasers can review this product.');
      if (status === 404) throw new Error(msg || 'Product not found.');
      if (status === 409) throw new Error(msg || 'You already reviewed this product.');
      throw new Error(msg || 'Server error while submitting review.');
    }
  },

  /** POST /api/reviews/:id/helpful */
  async markHelpful(reviewId: string): Promise<void> {
    await api.post(`/reviews/${reviewId}/helpful`);
  },

  /**
   * GET /api/reviews/summary?productId=...
   * Returns the canonical aggregate used by cards & headers.
   */
  async summary(
    productId: string
  ): Promise<{ averageRating: number; reviewCount: number }> {
    const { data } = await api.get(`/reviews/summary`, {
      params: { productId, _ts: Date.now() },
    });
    const payload = data?.data || data || {};
    return {
      averageRating: Number(payload?.averageRating ?? 0),
      reviewCount: Number(payload?.reviewCount ?? 0),
    };
  },
};

export default reviewsService;
