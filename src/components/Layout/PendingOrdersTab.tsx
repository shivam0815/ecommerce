import React, { useCallback, useEffect, useState } from 'react';
import { getAdminOrders, AdminOrder } from '../../config/adminApi';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
};

const PendingOrdersTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      const res = await getAdminOrders({ status: 'pending', page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });
      if (res.success) setOrders(res.orders || []);
      else throw new Error(res.message || 'Failed to load pending orders');
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load pending orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [checkNetworkStatus, showNotification]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="pending-orders">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="m-0">⏳ Pending Orders</h2>
        <button className="refresh-btn" onClick={load}>🔄 Refresh</button>
      </div>

      <div className="inventory-table-container">
        {loading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading…</p></div>
        ) : orders.length === 0 ? (
          <div className="empty-state"><p>🎉 No pending orders</p></div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Placed At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id}>
                  <td><strong>{o.orderNumber || o._id.slice(-6).toUpperCase()}</strong></td>
                  <td>{o.user?.name || '—'}</td>
                  <td>₹{Number(o.total || 0).toLocaleString()}</td>
                  <td>{(o.paymentStatus || 'pending').toUpperCase()}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PendingOrdersTab;
