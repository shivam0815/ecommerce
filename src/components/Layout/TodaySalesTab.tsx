import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getAdminOrders, AdminOrder } from '../../config/adminApi';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
};

const startOfTodayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const endOfTodayISO = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const TodaySalesTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      const res = await getAdminOrders({
        page: 1,
        limit: 200,            // plenty for a single day
        dateFrom: startOfTodayISO(),
        dateTo: endOfTodayISO(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (res.success) {
        setOrders(res.orders || []);
      } else {
        throw new Error(res.message || 'Failed to load today orders');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load today orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [checkNetworkStatus, showNotification]);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const count = orders.length;
    const revenue = orders.reduce((s: number, o: AdminOrder) => s + (Number(o.total) || 0), 0);
    const aov = count ? Math.round((revenue / count) * 100) / 100 : 0;
    // hourly spark
    const buckets = new Array(24).fill(0);
    orders.forEach(o => {
      const h = new Date(o.createdAt).getHours();
      buckets[h] += Number(o.total) || 0;
    });
    return { count, revenue, aov, buckets };
  }, [orders]);

  const tinySpark = (vals: number[]) => {
    const data = vals;
    const w = 280, h = 60, pad = 8;
    const max = Math.max(...data, 1);
    const step = (w - pad * 2) / (data.length - 1 || 1);
    const pts = data.map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h}>
        <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={pts} />
      </svg>
    );
  };

  return (
    <div className="today-sales">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="m-0">💸 Today’s Sales</h2>
        <button className="refresh-btn" onClick={load}>🔄 Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="grid" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}>
        <motion.div whileHover={{ scale: 1.02 }} className="stat-card">
          <div className="stat-title">Revenue (₹)</div>
          <div className="stat-number">₹{metrics.revenue.toLocaleString()}</div>
          <div className="mt-2">{tinySpark(metrics.buckets)}</div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="stat-card">
          <div className="stat-title">Orders</div>
          <div className="stat-number">{metrics.count}</div>
          <div className="text-xs" style={{color:'#666'}}>All orders placed today</div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="stat-card">
          <div className="stat-title">Avg Order Value</div>
          <div className="stat-number">₹{metrics.aov.toLocaleString()}</div>
          <div className="text-xs" style={{color:'#666'}}>Revenue / Orders</div>
        </motion.div>
      </div>

      {/* List */}
      <div className="inventory-table-container" style={{marginTop:12}}>
        {loading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading today’s orders…</p></div>
        ) : orders.length === 0 ? (
          <div className="empty-state"><p>🗒 No orders yet today</p></div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Placed At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id}>
                  <td><strong>{o.orderNumber || o._id.slice(-6).toUpperCase()}</strong></td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column'}}>
                      <span>{o.user?.name || '—'}</span>
                      <small style={{color:'#666'}}>{o.user?.email || '—'}</small>
                    </div>
                  </td>
                  <td><span className={`status ${o.status}`}>{o.status.toUpperCase?.() || String(o.status).toUpperCase()}</span></td>
                  <td><span className={`status ${o.paymentStatus}`}>{(o.paymentStatus || 'pending').toUpperCase()}</span></td>
                  <td>₹{Number(o.total || 0).toLocaleString()}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .today-sales .stat-card{background:#fff;border:1px solid #eee;border-radius:12px;padding:12px}
        .today-sales .stat-title{color:#666;font-size:12px}
        .today-sales .stat-number{font-weight:700;font-size:24px}
        @media (max-width: 900px){
          .today-sales .grid{grid-template-columns:1fr}
        }
      `}</style>
    </div>
  );
};

export default TodaySalesTab;
