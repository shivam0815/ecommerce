import React, { useEffect, useMemo, useState } from 'react';

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface IUser {
  _id?: string;
  name?: string;
  email?: string;
}

interface IOrderItem {
  productId?: string | { _id?: string; name?: string; image?: string };
  name?: string;
  image?: string;
  quantity: number;
  price: number;
}

interface IOrder {
  _id: string;
  orderNumber?: string;
  userId?: IUser;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus?: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  createdAt: string;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const dt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const getAdminToken = () => localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

const API_BASE = '/api/orders'; // Adjust if your server mounts routes differently

const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(o => {
      const byStatus = filter === 'all' || o.status === filter;
      const idMatch = o._id.toLowerCase().includes(q) || (o.orderNumber || '').toLowerCase().includes(q);
      const userMatch = (o.userId?.email || '').toLowerCase().includes(q) || (o.userId?.name || '').toLowerCase().includes(q);
      return byStatus && (q ? (idMatch || userMatch) : true);
    });
  }, [orders, filter, query]);

  async function fetchOrders() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/all`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to load orders');
      }
      const list: IOrder[] = Array.isArray(data) ? data : (data.orders || data.data || []);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
    } catch (e: any) {
      setError(e.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  }

  async function acceptOrder(id: string) {
    try {
      setBusyId(id);
      const res = await fetch(`${API_BASE}/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'confirmed' as OrderStatus }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to accept order');
      }
      const updated: IOrder = data.order || data.data || data;
      setOrders(prev => prev.map(o => (o._id === id ? { ...o, ...updated } : o)));
    } catch (e: any) {
      alert(e.message || 'Failed to accept order');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold">Orders</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by order ID, number, customer, email"
            className="w-full sm:w-72 border rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
          />
          <select
            className="border rounded-md px-3 py-2"
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={fetchOrders}
            className="border rounded-md px-3 py-2 hover:bg-gray-50"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {['pending','confirmed','processing','shipped'].map((s) => {
          const count = orders.filter(o => o.status === (s as OrderStatus)).length;
          return (
            <div key={s} className="bg-white border rounded-lg p-3">
              <div className="text-sm text-gray-500 capitalize">{s}</div>
              <div className="text-xl font-semibold">{count}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-500">Loading orders…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-500">No orders found.</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Items</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Created</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o._id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">#{(o.orderNumber || o._id.slice(-8)).toUpperCase()}</div>
                    <div className="text-gray-500">{o.paymentMethod?.toUpperCase()} • {o.paymentStatus || '-'}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{o.userId?.name || '—'}</div>
                    <div className="text-gray-500">{o.userId?.email || '—'}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex -space-x-2 items-center">
                      {o.items.slice(0, 5).map((it, idx) => {
                        const src = (typeof it.productId === 'object' && it.productId?.image) || it.image;
                        return src ? (
                          <img key={idx} src={src} alt="" className="w-8 h-8 rounded object-cover border bg-white" />
                        ) : (
                          <div key={idx} className="w-8 h-8 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-500">
                            {(typeof it.productId === 'object' && it.productId?.name) || it.name || 'Item'}
                          </div>
                        );
                      })}
                      {o.items.length > 5 && (
                        <div className="w-8 h-8 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-600">
                          +{o.items.length - 5}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-semibold">{currency(o.total)}</td>
                  <td className="p-3">
                    <span className={
                      'inline-flex items-center px-2 py-1 rounded-full text-xs capitalize ' + 
                      (o.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                       o.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                       o.status === 'processing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                       o.status === 'shipped' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                       o.status === 'delivered' ? 'bg-green-50 text-green-700 border border-green-200' :
                       'bg-gray-50 text-gray-700 border border-gray-200')
                    }>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-3">{dt(o.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        className="px-3 py-1.5 rounded-md border hover:bg-gray-50"
                        onClick={() => window.open(`/admin/orders/${o._id}`, '_blank')}
                        title="View details"
                      >
                        View
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                        onClick={() => acceptOrder(o._id)}
                        disabled={busyId === o._id || o.status !== 'pending'}
                        title={o.status !== 'pending' ? 'Only pending orders can be accepted' : 'Accept order'}
                      >
                        {busyId === o._id ? 'Accepting…' : 'Accept'}
                      </button>
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

export default OrdersTab;
