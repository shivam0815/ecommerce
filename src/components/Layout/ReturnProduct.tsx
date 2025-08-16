import React, { useState, useEffect } from 'react';
import './ReturnProduct.css';
import { ReturnedProduct, ReturnStatus } from '../../types';



const ReturnProduct: React.FC = () => {
  const [returnedProducts, setReturnedProducts] = useState<ReturnedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReturnStatus>('all'); // ✅ Use imported type

  useEffect(() => {
    fetchReturnedProducts();
  }, []);

const fetchReturnedProducts = async () => {
  try {
    setError(null);
    
    // ✅ Add authentication headers
    const token = localStorage.getItem('adminToken');
    
    const response = await fetch('/api/admin/returns', {
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
      setReturnedProducts(data.data);
    } else if (Array.isArray(data)) {
      setReturnedProducts(data);
    } else {
      setReturnedProducts([]);
    }
  } catch (error: any) {
    console.error('Error fetching returned products:', error);
    setError(error.message || 'Failed to load return data.');
    setReturnedProducts([]);
  } finally {
    setLoading(false);
  }
};


  // ❌ REMOVED - getMockData function completely removed

  const handleStatusUpdate = async (returnId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/returns/${returnId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update return status');
      }

      // Update local state
      setReturnedProducts(prev => 
        prev.map(product => 
          product._id === returnId 
            ? { ...product, status: newStatus as ReturnedProduct['status'] } // ✅ Better typing
            : product
        )
      );
    } catch (error) {
      console.error('Error updating return status:', error);
      setError('Failed to update return status');
    }
  };

  // ✅ Fixed syntax error: === instead of =
  const filteredReturns = Array.isArray(returnedProducts) 
    ? returnedProducts.filter(product => filter === 'all' || product.status === filter)
    : [];

  if (loading) return <div className="loading">Loading returned products...</div>;

  return (
    <div className="return-product-container">
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
        </div>
      )}
      
      <div className="header">
        <h2>🔄 Product Returns</h2>
        <div className="filters">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({returnedProducts.length})
          </button>
          <button 
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending ({returnedProducts.filter(r => r.status === 'pending').length})
          </button>
          <button 
            className={filter === 'approved' ? 'active' : ''}
            onClick={() => setFilter('approved')}
          >
            Approved ({returnedProducts.filter(r => r.status === 'approved').length})
          </button>
          <button 
            className={filter === 'rejected' ? 'active' : ''}
            onClick={() => setFilter('rejected')}
          >
            Rejected ({returnedProducts.filter(r => r.status === 'rejected').length})
          </button>
        </div>
      </div>

      {filteredReturns.length === 0 ? (
        <div className="no-data">
          <p>📦 No returned products found</p>
        </div>
      ) : (
        <div className="returns-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Customer</th>
                <th>Return Reason</th>
                <th>Return Date</th>
                <th>Refund Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.map((returnItem) => (
                <tr key={returnItem._id}>
                  <td>
                    <div className="product-info">
                      {returnItem.imageUrl ? (
                        <img src={returnItem.imageUrl} alt={returnItem.productName} />
                      ) : (
                        <div className="placeholder">📦</div>
                      )}
                      <span>{returnItem.productName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="customer-info">
                      <div>{returnItem.userName}</div>
                      <small>{returnItem.userEmail}</small>
                    </div>
                  </td>
                  <td>{returnItem.returnReason}</td>
                  <td>{new Date(returnItem.returnDate).toLocaleDateString()}</td>
                  <td>₹{returnItem.refundAmount}</td>
                  <td>
                    <span className={`status ${returnItem.status}`}>
                      {returnItem.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      {returnItem.status === 'pending' && (
                        <>
                          <button 
                            className="approve"
                            onClick={() => handleStatusUpdate(returnItem._id!, 'approved')}
                          >
                            ✅ Approve
                          </button>
                          <button 
                            className="reject"
                            onClick={() => handleStatusUpdate(returnItem._id!, 'rejected')}
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {returnItem.status === 'approved' && (
                        <button 
                          className="process"
                          onClick={() => handleStatusUpdate(returnItem._id!, 'processed')}
                        >
                          📦 Process Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReturnProduct;
