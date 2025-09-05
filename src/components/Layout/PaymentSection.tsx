// src/components/admin/PaymentSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar, Legend,
} from 'recharts';
import { Payment, PaymentStatusFilter, DateFilter } from '../../types';
import './PaymentSection.css';

// ---------- URL Helper: prevents `/api/api/...` bugs ----------
const RAW_BASE = (import.meta as any).env?.VITE_API_URL || '';
const BASE = RAW_BASE.replace(/\/+$/, '');
const apiUrl = (path: string) => {
  const cleanPath = path.replace(/^\/+/, '');
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

  // ---------- Helpers ----------
  const INR = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n || 0);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const toKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const labelFromKey = (k: string) => {
    const d = new Date(k + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  // ---------- Filters ----------
  const filteredPayments = useMemo(() => {
    if (!Array.isArray(payments)) return [];

    const now = new Date();
    const today = startOfDay(now);

    const matchesDate = (p: Payment) => {
      if (filter === 'all') return true;
      const d = new Date(p.paymentDate);
      const sd = startOfDay(d);
      if (filter === 'today') return sd >= today;
      if (filter === 'weekly') {
        const weekAgo = addDays(today, -7);
        return sd >= weekAgo;
      }
      if (filter === 'monthly') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        return sd >= monthAgo;
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

  // ---------- Chart Data ----------
  // 1) Daily trend (area)
  const dailySeries = useMemo(() => {
    // Establish the x-domain (date keys) based on filter
    const today = startOfDay(new Date());
    let span = 1;
    if (filter === 'weekly') span = 7;
    else if (filter === 'monthly') span = 30;
    else if (filter === 'all') {
      // derive from dataset range (min->max), cap to 120 days for performance
      if (filteredPayments.length) {
        const minDate = filteredPayments.reduce(
          (m, p) => Math.min(m, +startOfDay(new Date(p.paymentDate))),
          +today
        );
        const maxDate = filteredPayments.reduce(
          (m, p) => Math.max(m, +startOfDay(new Date(p.paymentDate))),
          +today
        );
        span = Math.min(120, Math.max(1, Math.round((maxDate - minDate) / 86400000) + 1));
      } else {
        span = 1;
      }
    }

    const keys: string[] = [];
    for (let i = span - 1; i >= 0; i--) keys.push(toKey(addDays(today, -i)));

    const map: Record<string, { date: string; amount: number; count: number }> = {};
    keys.forEach((k) => (map[k] = { date: k, amount: 0, count: 0 }));

    filteredPayments.forEach((p) => {
      const k = toKey(new Date(p.paymentDate));
      if (!map[k]) map[k] = { date: k, amount: 0, count: 0 };
      map[k].amount += Number(p.amount) || 0;
      map[k].count += 1;
    });

    return Object.values(map).sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [filteredPayments, filter]);

  // 2) Payment method mix (pie)
  const methodPie = useMemo(() => {
    const count: Record<string, number> = {};
    filteredPayments.forEach((p) => {
      const k = (p.paymentMethod || 'Other').toString();
      count[k] = (count[k] || 0) + (Number(p.amount) || 0); // by value
    });
    return Object.entries(count).map(([name, value]) => ({ name, value }));
  }, [filteredPayments]);

  // 3) Status breakdown (bar)
  const statusBar = useMemo(() => {
    const count: Record<string, { value: number; amt: number }> = {};
    filteredPayments.forEach((p) => {
      const k = p.status || 'unknown';
      if (!count[k]) count[k] = { value: 0, amt: 0 };
      count[k].value += 1;
      count[k].amt += Number(p.amount) || 0;
    });
    return Object.entries(count)
      .map(([status, { value, amt }]) => ({ status, count: value, amount: amt }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredPayments]);

  // Pie colors (fallbacks)
  const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#14B8A6', '#8B5CF6'];

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

      {/* Toolbar */}
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

      {/* KPIs */}
      <div className="summary">
        <div><strong>Records:</strong> {filteredPayments.length}</div>
        <div><strong>Total Amount:</strong> {INR(totalAmount)}</div>
      </div>

      {/* ======== Charts ======== */}
      <div className="charts-grid">
        {/* Daily Revenue Trend */}
        <div className="chart-card">
          <div className="chart-title">Daily Revenue Trend</div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailySeries}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.04}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={labelFromKey}
                  minTickGap={24}
                />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v/1000)}k` : `${v}`)} />
                <Tooltip
                  formatter={(v: any, name: any) => [INR(Number(v)), name === 'amount' ? 'Amount' : 'Orders']}
                  labelFormatter={(l: any) => labelFromKey(l)}
                />
                <Area type="monotone" dataKey="amount" stroke="#6366F1" fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Mix */}
        <div className="chart-card">
          <div className="chart-title">Payment Method Mix</div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip formatter={(v: any) => INR(Number(v))} />
                <Pie
                  data={methodPie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={2}
                >
                  {methodPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="chart-card">
          <div className="chart-title">Status Breakdown</div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusBar}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip
                  formatter={(v: any, key: any) => key === 'amount' ? INR(Number(v)) : v}
                />
                <Legend />
                <Bar dataKey="count" name="Count" />
                <Bar dataKey="amount" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ======== Table ======== */}
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
                  <td style={{ textAlign: 'right' }}>{INR(Number(p.amount) || 0)}</td>
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
