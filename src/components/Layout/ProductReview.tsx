import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import toast from 'react-hot-toast';
import './ProductReview.css';

import {
  getAdminReviews,
  updateReviewStatus,
  deleteReviewById,
  type Review,
  type ReviewStatus,
} from '../../config/adminApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const ProductReview: React.FC = () => {
  // data + meta
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // ui state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // filters + paging
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [status, setStatus] = useState<'all' | ReviewStatus>('all');
  const [qInput, setQInput] = useState<string>(''); // typed input
  const [q, setQ] = useState<string>(''); // debounced query

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // fetch when filters change
  useEffect(() => {
    void fetchReviews(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, selectedProduct, status, q]);

  const fetchReviews = async (p = 1): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const { items, meta } = await getAdminReviews({
        page: p,
        limit,
        status,
        productId: selectedProduct !== 'all' ? selectedProduct : undefined,
        q: q || undefined,
      });
      setReviews(items);
      setTotal(meta.total);
      setTotalPages(meta.totalPages);
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      setError(err?.message || 'Failed to load reviews.');
      setReviews([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (reviewId: string, nextStatus: ReviewStatus) => {
    try {
      setUpdating(reviewId);
      await updateReviewStatus(reviewId, nextStatus);
      setReviews(prev => prev.map(r => (r._id === reviewId ? { ...r, status: nextStatus } : r)));
      toast.success(`Review ${nextStatus} successfully!`);
    } catch (err: any) {
      console.error('Update review status error:', err);
      toast.error(err?.message || 'Failed to update review status');
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    const ok = window.confirm('Delete this review? This cannot be undone.');
    if (!ok) return;
    try {
      setDeleting(reviewId);
      await deleteReviewById(reviewId);
      setReviews(prev => prev.filter(r => r._id !== reviewId));
      setTotal(t => Math.max(0, t - 1));
      toast.success('Review deleted');

      // if list is empty after delete and not on first page, go back a page
      if (reviews.length === 1 && page > 1) {
        setPage(p => Math.max(1, p - 1));
      }
    } catch (err: any) {
      console.error('Delete review error:', err);
      toast.error(err?.message || 'Failed to delete review');
    } finally {
      setDeleting(null);
    }
  };

  // Unique products (from current page data)
  const uniqueProducts = useMemo(() => {
    const ids = new Set(reviews.map(r => r.productId).filter(Boolean));
    return Array.from(ids).map(id => ({
      id,
      name: reviews.find(r => r.productId === id)?.productName || 'Unknown',
    }));
  }, [reviews]);

  // Charts based on currently visible reviews (server-side filtered by params)
  const ratingDistribution: number[] = useMemo(
    () => [1, 2, 3, 4, 5].map(star => reviews.filter(r => r.rating === star).length),
    [reviews]
  );

  const averageRating: number = useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  const qualityBuckets = useMemo(() => {
    const excellent = reviews.filter(r => r.rating >= 4.5).length;
    const good = reviews.filter(r => r.rating >= 3.5 && r.rating < 4.5).length;
    const average = reviews.filter(r => r.rating >= 2.5 && r.rating < 3.5).length;
    const poor = reviews.filter(r => r.rating < 2.5).length;
    return { excellent, good, average, poor };
  }, [reviews]);

  const barChartData = useMemo(
    () => ({
      labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
      datasets: [
        {
          label: 'Number of Reviews',
          data: ratingDistribution,
          backgroundColor: ['#ff6b6b', '#ffa726', '#ffcc02', '#66bb6a', '#4caf50'],
          borderColor: ['#e53935', '#f57c00', '#ffa000', '#43a047', '#388e3c'],
          borderWidth: 1,
        },
      ],
    }),
    [ratingDistribution]
  );

  const pieChartData = useMemo(
    () => ({
      labels: ['Excellent', 'Good', 'Average', 'Poor'],
      datasets: [
        {
          data: [qualityBuckets.excellent, qualityBuckets.good, qualityBuckets.average, qualityBuckets.poor],
          backgroundColor: ['#4caf50', '#66bb6a', '#ffa726', '#ff6b6b'],
        },
      ],
    }),
    [qualityBuckets]
  );

  // Paging helpers
  const from = Math.min((page - 1) * limit + 1, Math.max(total, 1));
  const to = Math.min(page * limit, total);

  // loading view
  if (loading) return <div className="loading">Loading reviews...</div>;

  return (
    <div className="product-review-container">
      {/* Error Banner */}
      {error && (
        <div
          className="error-banner"
          style={{
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            padding: '10px',
            margin: '10px 0',
            borderRadius: '4px',
            color: '#856404',
          }}
        >
          ⚠️ {error}
          {error.includes('Unauthorized') && (
            <div>
              <button onClick={() => window.location.reload()}>🔄 Refresh Page</button>
            </div>
          )}
        </div>
      )}

      {/* Header + Filters */}
      <div className="header">
        <h2>⭐ Product Reviews &amp; Feedback</h2>

        <div className="filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Product filter */}
          <select
            value={selectedProduct}
            onChange={e => {
              setSelectedProduct(e.target.value);
              setPage(1);
            }}
            title="Filter by product"
          >
            <option value="all">All Products</option>
            {uniqueProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
            title="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Search */}
          <input
            placeholder="Search comment, user, product…"
            value={qInput}
            onChange={e => {
              setQInput(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: 220 }}
          />

          {/* Page size */}
          <select
            value={limit}
            onChange={e => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            title="Page size"
          >
            {[10, 20, 50, 100].map(n => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>

          <button onClick={() => void fetchReviews(1)}>↻ Refresh</button>
        </div>
      </div>

      {/* ====== REVIEWS FIRST ====== */}
      <div className="reviews-list">
        <div
          className="list-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h3>Recent Reviews</h3>
          <div className="page-info" style={{ opacity: 0.8 }}>
            Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="no-data">
            <p>📝 No reviews found</p>
          </div>
        ) : (
          reviews.map(review => (
            <div key={review._id} className="review-item">
              <div className="review-header">
                <span className="user-name">{review.userName || 'Anonymous'}</span>
                <div className="rating">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={star <= review.rating ? 'star filled' : 'star'}>
                      ⭐
                    </span>
                  ))}
                </div>
                <span className="date">
                  {new Date(review.reviewDate || review.createdAt || Date.now()).toLocaleDateString()}
                </span>
                {review.verified && <span className="verified">✅ Verified</span>}
              </div>

              <p className="comment">{review.comment}</p>

              <div className="review-footer">
                <span className="product-name">{review.productName || 'Unknown Product'}</span>
                {typeof review.helpful === 'number' && <span className="helpful">👍 {review.helpful} helpful</span>}

                <div className="review-actions">
                  <span className={`status status-${review.status}`}>{review.status.toUpperCase()}</span>

                  {/* Approve / Reject for pending */}
                  {review.status === 'pending' && (
                    <div className="action-buttons">
                      <button
                        onClick={() => void handleStatus(review._id, 'approved')}
                        className="approve-btn"
                        disabled={updating === review._id}
                        title="Approve"
                      >
                        {updating === review._id ? '⏳' : '✅'} Approve
                      </button>
                      <button
                        onClick={() => void handleStatus(review._id, 'rejected')}
                        className="reject-btn"
                        disabled={updating === review._id}
                        title="Reject"
                      >
                        {updating === review._id ? '⏳' : '❌'} Reject
                      </button>
                    </div>
                  )}

                  {/* Delete always available */}
                  <button
                    onClick={() => void handleDelete(review._id)}
                    className="delete-btn"
                    disabled={deleting === review._id}
                    title="Delete review"
                    style={{ marginLeft: 8 }}
                  >
                    {deleting === review._id ? '⏳ Deleting…' : '🗑️ Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Pagination controls (stay with list) */}
        <div className="pagination" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} title="Previous page">
            ◀ Prev
          </button>

          <span style={{ alignSelf: 'center' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            title="Next page"
          >
            Next ▶
          </button>
        </div>
      </div>

      {/* ====== THEN STATS + CHARTS ====== */}
      <div className="stats-overview" style={{ marginTop: 24 }}>
        <div className="stat-card">
          <h3>Average Rating</h3>
          <div className="rating-display">
            <span className="rating-number">{averageRating.toFixed(1)}</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className={star <= averageRating ? 'star filled' : 'star'}>
                  ⭐
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <h3>Total Reviews (filtered)</h3>
          <span className="stat-number">{total}</span>
        </div>

        <div className="stat-card">
          <h3>Verified (this page)</h3>
          <span className="stat-number">{reviews.filter(r => r.verified).length}</span>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart">
          <h3>Rating Distribution</h3>
          <Bar
            data={barChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                title: { display: true, text: 'Reviews by Star Rating' },
              },
            }}
          />
        </div>

        <div className="chart">
          <h3>Quality Assessment</h3>
          <Pie
            data={pieChartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom' as const },
                title: { display: true, text: 'Review Quality Distribution' },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductReview;
