import React, { useState, useEffect } from 'react';
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
import toast from 'react-hot-toast'; // ✅ Add missing import
import './ProductReview.css';

// ✅ Define proper Review interface
interface Review {
  _id: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  helpful: number;
  reviewDate: string;
  createdAt?: string;
  updatedAt?: string;
}

// ✅ Define other required interfaces
interface ChartData {
  labels: string[];
  datasets: any[];
}

interface QualityAssessment {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const ProductReview: React.FC = () => {
  // ✅ Properly typed state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null); // ✅ Track which review is being updated

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async (): Promise<void> => {
    try {
      setError(null);
      
      const token = localStorage.getItem('adminToken');
      
      const response = await fetch('/api/admin/reviews', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized access. Please log in again.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setReviews(data.data);
      } else if (Array.isArray(data)) {
        setReviews(data);
      } else {
        console.warn('API response is not an array:', data);
        setReviews([]);
      }
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      setError(error.message || 'Failed to load reviews. Please check your connection.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fix the update review status function
  const updateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected'): Promise<void> => {
    try {
      setUpdating(reviewId);
      const token = localStorage.getItem('adminToken');
      
      const response = await fetch(`/api/admin/reviews/${reviewId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update review status');
      }

      const result = await response.json();
      
      if (result.success) {
        // ✅ Update local state instead of refetching
        setReviews(prevReviews => 
          prevReviews.map(review => 
            review._id === reviewId 
              ? { ...review, status } 
              : review
          )
        );
        toast.success(`Review ${status} successfully!`);
      } else {
        throw new Error(result.message || 'Failed to update review');
      }
    } catch (error: any) {
      console.error('Update review status error:', error);
      toast.error(error.message || 'Failed to update review status');
    } finally {
      setUpdating(null);
    }
  };

  // ✅ Safe filtering with proper typing
  const filteredReviews: Review[] = selectedProduct === 'all' 
    ? reviews 
    : reviews.filter((review: Review) => review.productId === selectedProduct);

  // Calculate rating distribution
  const ratingDistribution: number[] = [1, 2, 3, 4, 5].map((rating: number) => 
    filteredReviews.filter((review: Review) => review.rating === rating).length
  );

  // Calculate average rating
  const averageRating: number = filteredReviews.length > 0 
    ? filteredReviews.reduce((sum: number, review: Review) => sum + review.rating, 0) / filteredReviews.length 
    : 0;

  // Quality assessment based on rating
  const qualityData: QualityAssessment = {
    excellent: filteredReviews.filter((r: Review) => r.rating >= 4.5).length,
    good: filteredReviews.filter((r: Review) => r.rating >= 3.5 && r.rating < 4.5).length,
    average: filteredReviews.filter((r: Review) => r.rating >= 2.5 && r.rating < 3.5).length,
    poor: filteredReviews.filter((r: Review) => r.rating < 2.5).length,
  };

  const barChartData: ChartData = {
    labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
    datasets: [{
      label: 'Number of Reviews',
      data: ratingDistribution,
      backgroundColor: [
        '#ff6b6b', '#ffa726', '#ffcc02', '#66bb6a', '#4caf50'
      ],
      borderColor: [
        '#e53935', '#f57c00', '#ffa000', '#43a047', '#388e3c'
      ],
      borderWidth: 1
    }]
  };

  const pieChartData: ChartData = {
    labels: ['Excellent', 'Good', 'Average', 'Poor'],
    datasets: [{
      data: [qualityData.excellent, qualityData.good, qualityData.average, qualityData.poor],
      backgroundColor: ['#4caf50', '#66bb6a', '#ffa726', '#ff6b6b'],
    }]
  };

  // Get unique products for filter
  const uniqueProducts = Array.from(new Set(reviews.map((r: Review) => r.productId)))
    .map((id: string) => ({
      id,
      name: reviews.find((r: Review) => r.productId === id)?.productName || 'Unknown'
    }));

  if (loading) return <div className="loading">Loading reviews...</div>;

  return (
    <div className="product-review-container">
      {error && (
        <div className="error-banner" style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          padding: '10px', 
          margin: '10px 0', 
          borderRadius: '4px',
          color: '#856404'
        }}>
          ⚠️ {error}
          {error.includes('Unauthorized') && (
            <div>
              <button onClick={() => window.location.reload()}>
                🔄 Refresh Page
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="header">
        <h2>⭐ Product Reviews & Feedback</h2>
        <select 
          value={selectedProduct} 
          onChange={(e) => setSelectedProduct(e.target.value)}
        >
          <option value="all">All Products</option>
          {uniqueProducts.map(product => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <div className="stats-overview">
        <div className="stat-card">
          <h3>Average Rating</h3>
          <div className="rating-display">
            <span className="rating-number">{averageRating.toFixed(1)}</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((star: number) => (
                <span 
                  key={star} 
                  className={star <= averageRating ? 'star filled' : 'star'}
                >
                  ⭐
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <h3>Total Reviews</h3>
          <span className="stat-number">{filteredReviews.length}</span>
        </div>
        
        <div className="stat-card">
          <h3>Verified Reviews</h3>
          <span className="stat-number">
            {filteredReviews.filter((r: Review) => r.verified).length}
          </span>
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
                title: { display: true, text: 'Reviews by Star Rating' }
              }
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
                title: { display: true, text: 'Review Quality Distribution' }
              }
            }}
          />
        </div>
      </div>

      <div className="reviews-list">
        <h3>Recent Reviews</h3>
        {filteredReviews.length === 0 ? (
          <div className="no-data">
            <p>📝 No reviews found</p>
          </div>
        ) : (
          filteredReviews.slice(0, 10).map((review: Review) => (
            <div key={review._id} className="review-item">
              <div className="review-header">
                <span className="user-name">{review.userName}</span>
                <div className="rating">
                  {[1, 2, 3, 4, 5].map((star: number) => (
                    <span 
                      key={star} 
                      className={star <= review.rating ? 'star filled' : 'star'}
                    >
                      ⭐
                    </span>
                  ))}
                </div>
                <span className="date">
                  {new Date(review.reviewDate).toLocaleDateString()}
                </span>
                {review.verified && <span className="verified">✅ Verified</span>}
              </div>
              
              <p className="comment">{review.comment}</p>
              
              <div className="review-footer">
                <span className="product-name">{review.productName}</span>
                <span className="helpful">👍 {review.helpful} helpful</span>
                
                {/* ✅ Add review status and action buttons */}
                <div className="review-actions">
                  <span className={`status status-${review.status}`}>
                    {review.status.toUpperCase()}
                  </span>
                  
                  {review.status === 'pending' && (
                    <div className="action-buttons">
                      <button 
                        onClick={() => updateReviewStatus(review._id, 'approved')}
                        className="approve-btn"
                        disabled={updating === review._id}
                      >
                        {updating === review._id ? '⏳' : '✅'} Approve
                      </button>
                      <button 
                        onClick={() => updateReviewStatus(review._id, 'rejected')}
                        className="reject-btn"
                        disabled={updating === review._id}
                      >
                        {updating === review._id ? '⏳' : '❌'} Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductReview;
