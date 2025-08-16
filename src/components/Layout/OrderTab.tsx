import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getSocket, joinAdminRoom } from '../../config/socket';

// ===== Types =====
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
  status: OrderStatus; // UI status; we map from orderStatus if needed
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus?: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  createdAt: string;
}

// ===== Utils =====
const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const dt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const getAdminToken = () =>
  localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

const API_BASE = '/api/orders'; // keep relative to your API proxy/origin

// Small hook to debounce values for responsive/performant filtering
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryDebounced = useDebounced(query, 250);

  // 🔔 NEW: simple in-app banner + sound
  const [banner, setBanner] = useState<string | null>(null);
  const dingRef = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef<string>(document.title);

  useEffect(() => {
    // preload audio + request Notification permission once
    dingRef.current = new Audio('/sounds/new-order.wav');
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // reset title when user returns to tab
    const onVisible = () => (document.title = originalTitle.current);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const filtered = useMemo(() => {
    const q = queryDebounced.trim().toLowerCase();
    return orders.filter((o) => {
      const byStatus = filter === 'all' || o.status === filter;
      const idMatch = o._id.toLowerCase().includes(q) || (o.orderNumber || '').toLowerCase().includes(q);
      const userMatch = (o.userId?.email || '').toLowerCase().includes(q) || (o.userId?.name || '').toLowerCase().includes(q);
      return byStatus && (q ? idMatch || userMatch : true);
    });
  }, [orders, filter, queryDebounced]);

  async function fetchOrders() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/all`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to load orders');

      const list: IOrder[] = (Array.isArray(data) ? data : data.orders || data.data || [])
        .map((o: any) => ({ ...o, status: o.status || o.orderStatus || 'pending' }));
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setOrders(list);
    } catch (e: any) {
      setError(e.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: OrderStatus) {
    try {
      setBusyId(id);
      const res = await fetch(`${API_BASE}/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to update order');

      const updated = (data.order || data.data || data) as any;
      setOrders((prev) =>
        prev.map((o) => (o._id === id ? { ...o, ...updated, status: updated.status || updated.orderStatus || status } : o))
      );
    } catch (e: any) {
      alert(e.message || 'Failed to update order');
    } finally {
      setBusyId(null);
    }
  }

  const acceptOrder = (id: string) => setStatus(id, 'confirmed');

  useEffect(() => {
    fetchOrders();
  }, []);

  // 🧠 helper: show all forms of notification
  const notifyNewOrder = (order: IOrder) => {
    const titleNum = (order.orderNumber || order._id.slice(-8)).toUpperCase();
    const who = order.userId?.name || order.userId?.email || 'New customer';
    const body = `${who} • ${order.items.length} item(s) • ${currency(order.total)}`;

    // In-app banner
    setBanner(`🆕 New order #${titleNum} — ${body}`);
    setTimeout(() => setBanner(null), 6000);

    // Sound
    dingRef.current?.play().catch(() => {
      /* autoplay blocked, ignore */
    });

    // Browser Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New order #${titleNum}`, {
        body,
        icon: '/favicon.ico', // or a custom 128/192 icon
        tag: order._id, // collapses duplicate notifications per order
      });
    }

    // Tab title badge if tab hidden
    if (document.hidden) {
      document.title = `● New order! — ${originalTitle.current}`;
    }

    // Vibration (mobile)
    if (navigator.vibrate) navigator.vibrate(150);
  };

  // SOCKET: join admin room + live handlers
  useEffect(() => {
    const socket = getSocket();
    joinAdminRoom();

    const onCreated = (payload: any) => {
      const normalized: IOrder = { ...payload, status: payload.status || payload.orderStatus || 'pending' };
      setOrders((prev) => (prev.some((o) => o._id === normalized._id) ? prev : [normalized, ...prev]));
      notifyNewOrder(normalized); // 🔔 notify here
    };

    const onUpdated = (payload: any) => {
      setOrders((prev) =>
        prev.map((o) => (o._id === payload._id ? { ...o, ...payload, status: payload.status || payload.orderStatus || o.status } : o))
      );
    };

    socket.on('orderCreated', onCreated);
    socket.on('orderStatusUpdated', onUpdated);
    return () => {
      socket.off('orderCreated', onCreated);
      socket.off('orderStatusUpdated', onUpdated);
    };
  }, []);

  // ===== Render =====
  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Banner */}
      {banner && (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-800 shadow-sm">
          {banner}
        </div>
      )}

      {/* Header + Controls (stack on mobile) */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl sm:text-2xl font-semibold">Orders</h2>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order ID, number, customer, email"
            className="w-full sm:w-72 border rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
            inputMode="search"
          />
          <select
            className="border rounded-md px-3 py-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
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

      {/* Status summary chips – horizontally scrollable on small screens */}
      <div className="mb-4 -mx-3 sm:mx-0">
        <div className="flex gap-2 overflow-x-auto px-3 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-4">
          {(['pending', 'confirmed', 'processing', 'shipped'] as OrderStatus[]).map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            return (
              <div key={s} className="min-w-[11rem] sm:min-w-0 bg-white border rounded-lg p-3 shrink-0">
                <div className="text-sm text-gray-500 capitalize">{s}</div>
                <div className="text-xl font-semibold">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content states */}
      {loading ? (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-500">Loading orders…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-500">No orders found.</div>
      ) : (
        <>
          {/* TABLE (md and up) */}
          <div className="hidden md:block bg-white border rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 sticky top-0">
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
                            <img
                              key={idx}
                              src={src}
                              alt=""
                              className="w-8 h-8 rounded object-cover border bg-white"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div
                              key={idx}
                              className="w-8 h-8 rounded bg-gray-100 border flex items-center justify-center text-[10px] text-gray-500"
                            >
                              {(typeof it.productId === 'object' && it.productId?.name) || it.name || 'Item'}
                            </div>
                          );
                        })}
                        {o.items.length > 5 && (
                          <div className="w-8 h-8 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-600">+{o.items.length - 5}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold">{currency(o.total)}</td>
                    <td className="p-3">
                      <span
                        className={
                          'inline-flex items-center px-2 py-1 rounded-full text-xs capitalize ' +
                          (o.status === 'pending'
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            : o.status === 'confirmed'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : o.status === 'processing'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : o.status === 'shipped'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : o.status === 'delivered'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-50 text-gray-700 border border-gray-200')
                        }
                      >
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

          {/* MOBILE CARDS (shown below md) */}
          <div className="md:hidden space-y-3">
            {filtered.map((o) => (
              <div key={o._id} className="bg-white border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">#{(o.orderNumber || o._id.slice(-8)).toUpperCase()}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{dt(o.createdAt)}</div>
                  </div>
                  <span
                    className={
                      'inline-flex items-center px-2 py-1 rounded-full text-[10px] capitalize ' +
                      (o.status === 'pending'
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : o.status === 'confirmed'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : o.status === 'processing'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : o.status === 'shipped'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : o.status === 'delivered'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-700 border border-gray-200')
                    }
                  >
                    {o.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 overflow-x-auto -mx-1 px-1">
                  {o.items.slice(0, 6).map((it, idx) => {
                    const src = (typeof it.productId === 'object' && it.productId?.image) || it.image;
                    return src ? (
                      <img
                        key={idx}
                        src={src}
                        alt=""
                        className="w-10 h-10 rounded object-cover border bg-white shrink-0"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div
                        key={idx}
                        className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center text-[10px] text-gray-500 shrink-0"
                      >
                        {(typeof it.productId === 'object' && it.productId?.name) || it.name || 'Item'}
                      </div>
                    );
                  })}
                  {o.items.length > 6 && (
                    <div className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center text-xs text-gray-600 shrink-0">
                      +{o.items.length - 6}
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Customer</div>
                    <div className="font-medium truncate">{o.userId?.name || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500">Total</div>
                    <div className="font-semibold">{currency(o.total)}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-600">
                  <div className="truncate">{o.userId?.email || '—'}</div>
                  <div className="uppercase">{o.paymentMethod} • {o.paymentStatus || '-'}</div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 px-3 py-2 rounded-md border hover:bg-gray-50"
                    onClick={() => window.open(`/admin/orders/${o._id}`, '_blank')}
                  >
                    View
                  </button>
                  <button
                    className="flex-1 px-3 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                    onClick={() => acceptOrder(o._id)}
                    disabled={busyId === o._id || o.status !== 'pending'}
                  >
                    {busyId === o._id ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OrdersTab;
