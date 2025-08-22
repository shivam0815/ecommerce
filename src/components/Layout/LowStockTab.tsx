import React, { useCallback, useEffect, useState } from 'react';
import { getLowStockProducts, ProductsResponse } from '../../config/adminApi';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
  threshold?: number;
};

const LowStockTab: React.FC<Props> = ({ showNotification, checkNetworkStatus, threshold = 10 }) => {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      const res = await getLowStockProducts(threshold);
      setData(res);
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load low stock products', 'error');
    } finally {
      setLoading(false);
    }
  }, [checkNetworkStatus, showNotification, threshold]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="low-stock">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="m-0">📉 Low Stock Items (≤ {threshold})</h2>
        <button className="refresh-btn" onClick={load}>🔄 Refresh</button>
      </div>

      <div className="inventory-table-container">
        {loading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading…</p></div>
        ) : !data || data.products.length === 0 ? (
          <div className="empty-state"><p>✅ No low stock items</p></div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map(p => (
                <tr key={p._id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.category || '—'}</td>
                  <td><span className="stock-number">{(p as any).stock ?? (p as any).stockQuantity ?? 0}</span></td>
                  <td>₹{Number(p.price || 0).toLocaleString()}</td>
                  <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LowStockTab;
