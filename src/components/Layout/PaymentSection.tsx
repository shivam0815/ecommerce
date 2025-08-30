// src/components/admin/PaymentSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Payment, PaymentStatusFilter, DateFilter } from '../../types';
import './PaymentSection.css';

// ---------- URL Helper: prevents `/api/api/...` bugs ----------
const RAW_BASE = (import.meta as any).env?.VITE_API_URL || ''; // e.g. "http://localhost:5000", "http://localhost:5000/api", or "/api"
const BASE = RAW_BASE.replace(/\/+$/, ''); // strip trailing slashes
const apiUrl = (path: string) => {
  const cleanPath = path.replace(/^\/+/, ''); // no leading slash
  // If BASE already ends with "/api" we don't add it again
  const hasApi = /\/api$/.test(BASE);
  const prefix = hasApi ? '' : '/api';
  return `${BASE}${prefix}/${cleanPath}`;
};

const PaymentSection: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<DateFilter>('today'); // today | weekly | monthly | all
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all'); // all | completed | pending | failed | refunded

  useEffect(() => {
    fetchAllPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authHeaders = () => {
    const token =
      localStorage.getItem('adminToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchAllPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(apiUrl('payment/admin/all'), {
        method: 'GET',
        headers: authHeaders(),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Unauthorized access. Please log in again.');
        if (res.status === 404) throw new Error('Endpoint not found. Check server routes and mount path.');
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        setPayments(data.data);
      } else if (Array.isArray(data)) {
        setPayments(data);
      } else {
        setPayments([]);
      }
    } catch (e: any) {
      console.error('Error fetching payments:', e);
      setError(e?.message || 'Failed to load payments.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Filters ----------
  const filteredPayments = useMemo(() => {
    if (!Array.isArray(payments)) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const matchesDate = (p: Payment) => {
      if (filter === 'all') return true;
      const d = new Date(p.paymentDate);
      if (filter === 'today') return d >= today;
      if (filter === 'weekly') {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return d >= weekAgo;
      }
      if (filter === 'monthly') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        return d >= monthAgo;
      }
      return true;
    };

    const matchesStatus = (p: Payment) => statusFilter === 'all' || p.status === statusFilter;

    return payments.filter((p) => matchesDate(p) && matchesStatus(p));
  }, [payments, filter, statusFilter]);

  const totalAmount = useMemo(
    () => filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [filteredPayments]
  );

  // ---------- Export ----------
  const exportToExcel = () => {
    const rows = filteredPayments.map((p) => ({
      Date: new Date(p.paymentDate).toLocaleString(),
      OrderID: p.orderId,
      TxnID: p.transactionId,
      User: `${p.userName} <${p.userEmail}>`,
      Method: p.paymentMethod,
      Status: p.status,
      Amount: p.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    saveAs(blob, `payments_${filter}_${statusFilter}.xlsx`);
  };

  // ---------- UI ----------
  if (loading) return <div className="loading">Loading payment data...</div>;

  return (
    <div className="payment-section-container">
      {error && (
        <div
          className="error-banner"
          style={{
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            padding: 10,
            margin: '10px 0',
            borderRadius: 6,
            color: '#856404',
          }}
        >
          ⚠️ {error}{' '}
          {error.includes('Unauthorized') && (
            <button onClick={() => window.location.reload()} style={{ marginLeft: 8 }}>
              🔄 Refresh
            </button>
          )}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-left">
          <label>
            Date:
            <select value={filter} onChange={(e) => setFilter(e.target.value as DateFilter)}>
              <option value="today">Today</option>
              <option value="weekly">Last 7 days</option>
              <option value="monthly">Last 30 days</option>
              <option value="all">All</option>
            </select>
          </label>

          <label>
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatusFilter)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
        </div>

        <div className="toolbar-right">
          <button onClick={fetchAllPayments}>🔄 Refresh</button>
          <button onClick={exportToExcel}>⬇️ Export XLSX</button>
        </div>
      </div>

      <div className="summary">
        <div>
          <strong>Records:</strong> {filteredPayments.length}
        </div>
        <div>
          <strong>Total Amount:</strong> {totalAmount}
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="no-data">
          <p>💳 No payment data found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Txn</th>
                <th>User</th>
                <th>Method</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.transactionId}>
                  <td>{new Date(p.paymentDate).toLocaleString()}</td>
                  <td>{p.orderId}</td>
                  <td>{p.transactionId}</td>
                  <td>
                    {p.userName}{' '}
                    <span className="muted">&lt;{p.userEmail}&gt;</span>
                  </td>
                  <td>{p.paymentMethod}</td>
                  <td>{p.status}</td>
                  <td style={{ textAlign: 'right' }}>{p.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentSection;
