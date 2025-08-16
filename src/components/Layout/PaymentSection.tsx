import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Payment, PaymentStats, PaymentStatusFilter, DateFilter } from '../../types';
import './PaymentSection.css';

const PaymentSection: React.FC = () => {
  // ✅ Initialize as empty array to prevent filter errors
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setError(null);
      
      // ✅ Add authentication headers if needed
      const token = localStorage.getItem('adminToken'); // or wherever you store your auth token
      
      const response = await fetch('/api/admin/payments', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // ✅ Add authorization header to fix 401 error
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
        setPayments(data.data);
      } else if (Array.isArray(data)) {
        setPayments(data);
      } else {
        console.warn('API response is not an array:', data);
        setPayments([]);
      }
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      setError(error.message || 'Failed to load payments. Please check your connection.');
      // ✅ Set empty array on error to prevent filter issues
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Safe filtering function with array check
  const filterPaymentsByDate = (payments: Payment[]) => {
    // Double check that payments is an array
    if (!Array.isArray(payments)) {
      console.warn('Payments is not an array:', payments);
      return [];
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return payments.filter(payment => {
      const paymentDate = new Date(payment.paymentDate);
      
      switch (filter) {
        case 'today':
          return paymentDate >= today;
        case 'weekly':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          return paymentDate >= weekAgo;
        case 'monthly':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          return paymentDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  // ✅ Apply filters safely
  const filteredPayments = filterPaymentsByDate(payments).filter(payment => 
    statusFilter === 'all' || payment.status === statusFilter
  );

  // Rest of your component...
  if (loading) return <div className="loading">Loading payment data...</div>;

  return (
    <div className="payment-section-container">
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
      
      {/* Rest of your component JSX */}
      {filteredPayments.length === 0 ? (
        <div className="no-data">
          <p>💳 No payment data found</p>
        </div>
      ) : (
        // Your existing table/display logic
        <div>Payment data displayed here...</div>
      )}
    </div>
  );
};

export default PaymentSection;
