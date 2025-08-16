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
import { Review, ChartData, QualityAssessment } from '../../types';
import './ProductReview.css';

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
  // ✅ Initialize as empty array to prevent filter errors
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setError(null);
      
      // ✅ Add authentication headers to fix 401 error
      const token = localStorage.getItem('adminToken'); // or wherever you store your auth token
      
      const response = await fetch('/api/admin/reviews', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // ✅ Add authorization header
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
      
      // ✅ Ensure data is always an array
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
      // ✅ Set empty array on error to prevent filter issues
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Safe filtering with array check
  const filteredReviews = selectedProduct === 'all' 
    ? reviews 
    : reviews.filter(review => review.productId === selectedProduct);

  // Calculate rating distribution
  const ratingDistribution = [1, 2, 3, 4, 5].map(rating => 
    filteredReviews.filter(review => review.rating === rating).length
  );

  // Calculate average rating
  const averageRating = filteredReviews.length > 0 
    ? filteredReviews.reduce((sum, review) => sum + review.rating, 0) / filteredReviews.length 
    : 0;

  // Quality assessment based on rating
  const qualityData = {
    excellent: filteredReviews.filter(r => r.rating >= 4.5).length,
    good: filteredReviews.filter(r => r.rating >= 3.5 && r.rating < 4.5).length,
    average: filteredReviews.filter(r => r.rating >= 2.5 && r.rating < 3.5).length,
    poor: filteredReviews.filter(r => r.rating < 2.5).length,
  };

  const barChartData = {
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

  const pieChartData = {
    labels: ['Excellent', 'Good', 'Average', 'Poor'],
    datasets: [{
      data: [qualityData.excellent, qualityData.good, qualityData.average, qualityData.poor],
      backgroundColor: ['#4caf50', '#66bb6a', '#ffa726', '#ff6b6b'],
    }]
  };

  // Get unique products for filter (with safety check)
  const uniqueProducts = Array.from(new Set(reviews.map(r => r.productId)))
    .map(id => ({
      id,
      name: reviews.find(r => r.productId === id)?.productName || 'Unknown'
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
              {[1, 2, 3, 4, 5].map(star => (
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
            {filteredReviews.filter(r => r.verified).length}
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
                legend: { position: 'bottom' },
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
          filteredReviews.slice(0, 10).map((review) => (
            <div key={review._id} className="review-item">
              <div className="review-header">
                <span className="user-name">{review.userName}</span>
                <div className="rating">
                  {[1, 2, 3, 4, 5].map(star => (
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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductReview;
