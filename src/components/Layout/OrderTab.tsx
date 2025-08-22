// src/pages/admin/OrdersTab.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getSocket, joinAdminRoom } from '../../config/socket';
import {
  EyeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  XMarkIcon,
  CheckCircleIcon,
  TruckIcon,
  ClockIcon,
  BanknotesIcon,
  DocumentDuplicateIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';

/* =========================
   Types
========================= */
type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

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
  status: OrderStatus; // mapped from .orderStatus if needed
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus?: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  createdAt: string;
}

/** Full order (drawer fetch) – fields optional to be resilient */
interface IOrderFull extends IOrder {
  shippingAddress?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  billingAddress?: IOrderFull['shippingAddress'];
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  updatedAt?: string;
  paymentOrderId?: string;
  paymentId?: string;
  paymentSignature?: string;
}

/* =========================
   Utils
========================= */
const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const dt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

const getAdminToken = () =>
  localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

const API_BASE = '/api/orders';

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = ORDER_FLOW.indexOf(s);
  if (i === -1 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
};

const pill = (s: string) =>
  'inline-flex items-center px-2 py-1 rounded-full text-xs capitalize border ' +
  (s === 'pending'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : s === 'confirmed'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : s === 'processing'
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
    : s === 'shipped'
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : s === 'delivered'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'cod_paid' || s === 'paid'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'awaiting_payment' || s === 'cod_pending'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : s === 'failed' || s === 'cancelled'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-gray-50 text-gray-700 border-gray-200');

const iconFor = (s: string) => {
  switch (s) {
    case 'delivered':
    case 'paid':
    case 'cod_paid':
      return <CheckCircleIcon className="w-4 h-4" />;
    case 'shipped':
      return <TruckIcon className="w-4 h-4" />;
    case 'processing':
    case 'pending':
    default:
      return <ClockIcon className="w-4 h-4" />;
  }
};

/* =========================
   Main Component
========================= */
const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'createdAt' | 'total'>('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // drawer state
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<IOrderFull | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Alerts/sounds
  const [banner, setBanner] = useState<string | null>(null);
  const dingRef = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef<string>(document.title);

  const queryDebounced = useDebounced(query, 250);

  /* preload sound & notifications */
  useEffect(() => {
    dingRef.current = new Audio('/sounds/new-order.wav');
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const onVisible = () => (document.title = originalTitle.current);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  /* fetch list */
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
      if (!res.ok || data.success === false)
        throw new Error(data.message || 'Failed to load orders');

      const list: IOrder[] = (Array.isArray(data) ? data : data.orders || data.data || []).map(
        (o: any) => ({ ...o, status: o.status || o.orderStatus || 'pending' })
      );
      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setOrders(list);
    } catch (e: any) {
      setError(e.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrderDetails(id: string) {
    try {
      setDrawerLoading(true);
      const res = await fetch(`${API_BASE}/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false)
        throw new Error(data.message || 'Failed to load order');

      const o = (data.order || data.data || data) as IOrderFull;
      setSelected({ ...o, status: (o.status || (o as any).orderStatus || 'pending') as OrderStatus });
    } catch (e: any) {
      alert(e.message || 'Failed to load order details');
      setOpenDrawer(false);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function setStatus(id: string, status: OrderStatus) {
    try {
      setBusyId(id);
      const res = await fetch(`${API_BASE}/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false)
        throw new Error(data.message || 'Failed to update order');

      const updated = (data.order || data.data || data) as any;
      setOrders(prev =>
        prev.map(o =>
          o._id === id
            ? { ...o, ...updated, status: (updated.status || updated.orderStatus || status) as OrderStatus }
            : o
        )
      );
      if (selected && selected._id === id) {
        setSelected(prev => (prev ? { ...prev, ...updated, status: updated.status || updated.orderStatus || status } : prev));
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update order');
    } finally {
      setBusyId(null);
    }
  }

  const acceptOrder = (id: string) => setStatus(id, 'confirmed');
  const advance = (id: string, s: OrderStatus) => {
    const ns = nextStatus(s);
    if (ns) setStatus(id, ns);
  };
  const cancelOrder = (id: string) => {
    if (!confirm('Cancel this order?')) return;
    setStatus(id, 'cancelled');
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /* sockets */
  const notifyNewOrder = (order: IOrder) => {
    const titleNum = (order.orderNumber || order._id.slice(-8)).toUpperCase();
    const who = order.userId?.name || order.userId?.email || 'New customer';
    const body = `${who} • ${order.items.length} item(s) • ${currency(order.total)}`;

    setBanner(`🆕 New order #${titleNum} — ${body}`);
    setTimeout(() => setBanner(null), 6000);

    dingRef.current?.play().catch(() => {});
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New order #${titleNum}`, {
        body,
        icon: '/favicon.ico',
        tag: order._id,
      });
    }
    if (document.hidden) document.title = `● New order! — ${originalTitle.current}`;
    if (navigator.vibrate) navigator.vibrate(150);
  };

  useEffect(() => {
    const socket = getSocket();
    joinAdminRoom();

    const onCreated = (payload: any) => {
      const normalized: IOrder = {
        ...payload,
        status: payload.status || payload.orderStatus || 'pending',
      };
      setOrders(prev =>
        prev.some(o => o._id === normalized._id) ? prev : [normalized, ...prev]
      );
      notifyNewOrder(normalized);
    };

    const onUpdated = (payload: any) => {
      setOrders(prev =>
        prev.map(o =>
          o._id === payload._id
            ? { ...o, ...payload, status: payload.status || payload.orderStatus || o.status }
            : o
        )
      );
      if (selected && selected._id === payload._id) {
        setSelected(prev =>
            prev ? { ...prev, ...payload, status: payload.status || payload.orderStatus || prev.status } : prev
        );
      }
    };

    socket.on('orderCreated', onCreated);
    socket.on('orderStatusUpdated', onUpdated);
    return () => {
      socket.off('orderCreated', onCreated);
      socket.off('orderStatusUpdated', onUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /* filters + sorting + date range */
  const filtered = useMemo(() => {
    const q = queryDebounced.trim().toLowerCase();
    const start = fromDate ? +new Date(fromDate) : null;
    const end = toDate ? +new Date(toDate + 'T23:59:59') : null;

    let rows = orders.filter(o => {
      const byStatus = filter === 'all' || o.status === filter;
      const idMatch =
        o._id.toLowerCase().includes(q) ||
        (o.orderNumber || '').toLowerCase().includes(q);
      const userMatch =
        (o.userId?.email || '').toLowerCase().includes(q) ||
        (o.userId?.name || '').toLowerCase().includes(q);

      const createdTs = +new Date(o.createdAt);
      const dateOK =
        (start === null || createdTs >= start) &&
        (end === null || createdTs <= end);

      return byStatus && (q ? idMatch || userMatch : true) && dateOK;
    });

    rows = rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'createdAt') {
        return (+(new Date(a.createdAt)) - +(new Date(b.createdAt))) * dir;
      }
      return (a.total - b.total) * dir;
    });

    return rows;
  }, [orders, filter, queryDebounced, sortKey, sortDir, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    // reset page on filter/sort change
    setPage(1);
  }, [filter, queryDebounced, sortKey, sortDir, fromDate, toDate, pageSize]);

  /* csv export */
  const exportCSV = () => {
    const headers = [
      'OrderID',
      'OrderNumber',
      'CustomerName',
      'CustomerEmail',
      'ItemsCount',
      'Subtotal',
      'Tax',
      'Shipping',
      'Total',
      'Status',
      'PaymentMethod',
      'PaymentStatus',
      'CreatedAt',
    ];
    const lines = filtered.map(o =>
      [
        o._id,
        o.orderNumber || '',
        o.userId?.name || '',
        o.userId?.email || '',
        o.items.length,
        o.subtotal,
        o.tax,
        o.shipping,
        o.total,
        o.status,
        o.paymentMethod,
        o.paymentStatus || '',
        dt(o.createdAt),
      ].join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openDetails = (id: string) => {
    setSelectedId(id);
    setOpenDrawer(true);
    setSelected(null);
    fetchOrderDetails(id);
  };

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
    } catch {}
  };

  /* =========================
     Render
  ========================= */
  return (
    <div className="p-3 sm:p-4 md:p-6">
      {banner && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 shadow-sm">
          {banner}
        </div>
      )}

      {/* Header / controls */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-600">
            Manage orders in real-time. Click a row to view full details.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="lg:col-span-2 relative">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by order ID, number, customer, email"
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-gray-200"
              inputMode="search"
            />
            <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

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

          <div className="flex gap-2">
            <input
              type="date"
              className="border rounded-md px-3 py-2 w-full"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <input
              type="date"
              className="border rounded-md px-3 py-2 w-full"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              aria-label="To date"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSortKey('createdAt');
                setSortDir(d => (sortKey === 'createdAt' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
              }}
              className={
                'border rounded-md px-3 py-2 inline-flex items-center justify-center gap-2 ' +
                (sortKey === 'createdAt' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50')
              }
              title="Sort by created date"
            >
              <ClockIcon className="w-4 h-4" />
              Date {sortKey === 'createdAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button
              onClick={() => {
                setSortKey('total');
                setSortDir(d => (sortKey === 'total' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
              }}
              className={
                'border rounded-md px-3 py-2 inline-flex items-center justify-center gap-2 ' +
                (sortKey === 'total' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50')
              }
              title="Sort by total"
            >
              <BanknotesIcon className="w-4 h-4" />
              Total {sortKey === 'total' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchOrders}
              className="border rounded-md px-3 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <FunnelIcon className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="border rounded-md px-3 py-2 hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Quick stats (scrollable on small) */}
      <div className="mb-4 -mx-3 sm:mx-0">
        <div className="flex gap-2 overflow-x-auto px-3 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-4">
          {(['pending', 'confirmed', 'processing', 'shipped'] as OrderStatus[]).map(s => {
            const count = orders.filter(o => o.status === s).length;
            return (
              <div key={s} className="min-w-[11rem] sm:min-w-0 bg-white border rounded-lg p-3 shrink-0">
                <div className="text-sm text-gray-500 capitalize">{s}</div>
                <div className="text-xl font-semibold">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-500">
          Loading orders…
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-6 text-center text-gray-500">
          No orders found.
        </div>
      ) : (
        <>
          {/* TABLE (≥ md) */}
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
                {pageRows.map(o => (
                  <tr
                    key={o._id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={e => {
                      // avoid row open when clicking action buttons
                      const target = e.target as HTMLElement;
                      if (target.closest('button')) return;
                      openDetails(o._id);
                    }}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">
                          #{(o.orderNumber || o._id.slice(-8)).toUpperCase()}
                        </div>
                        <button
                          className="text-gray-400 hover:text-gray-700"
                          title="Copy"
                          onClick={e => {
                            e.stopPropagation();
                            copyText(o.orderNumber || o._id);
                          }}
                        >
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-gray-500">
                        {o.paymentMethod?.toUpperCase()} • {o.paymentStatus || '-'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.userId?.name || '—'}</div>
                      <div className="text-gray-500">{o.userId?.email || '—'}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex -space-x-2 items-center">
                        {o.items.slice(0, 5).map((it, idx) => {
                          const src =
                            (typeof it.productId === 'object' && it.productId?.image) ||
                            it.image;
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
                              {(typeof it.productId === 'object' && it.productId?.name) ||
                                it.name ||
                                'Item'}
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
                      <span className={pill(o.status)}>
                        {iconFor(o.status)}
                        <span className="ml-1">{o.status}</span>
                      </span>
                    </td>
                    <td className="p-3">{dt(o.createdAt)}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          className="px-3 py-1.5 rounded-md border hover:bg-gray-50 inline-flex items-center gap-1"
                          onClick={e => {
                            e.stopPropagation();
                            openDetails(o._id);
                          }}
                          title="View details"
                        >
                          <EyeIcon className="w-4 h-4" />
                          View
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                          onClick={e => {
                            e.stopPropagation();
                            acceptOrder(o._id);
                          }}
                          disabled={busyId === o._id || o.status !== 'pending'}
                          title={o.status !== 'pending' ? 'Only pending orders can be accepted' : 'Accept order'}
                        >
                          {busyId === o._id ? 'Accepting…' : 'Accept'}
                        </button>
                        {nextStatus(o.status) && (
                          <button
                            className="px-3 py-1.5 rounded-md border hover:bg-gray-50"
                            onClick={e => {
                              e.stopPropagation();
                              advance(o._id, o.status);
                            }}
                          >
                            Next: {nextStatus(o.status)}
                          </button>
                        )}
                        {o.status !== 'cancelled' && (
                          <button
                            className="px-3 py-1.5 rounded-md border hover:bg-rose-50 text-rose-700 border-rose-200"
                            onClick={e => {
                              e.stopPropagation();
                              cancelOrder(o._id);
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between p-3 border-t text-sm">
              <div className="text-gray-600">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded-md px-2 py-1"
                  value={pageSize}
                  onChange={e => setPageSize(+e.target.value)}
                >
                  {[10, 25, 50, 100].map(n => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
                <button
                  className="border rounded-md p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <div className="px-2">{page} / {totalPages}</div>
                <button
                  className="border rounded-md p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE CARDS (< md) */}
          <div className="md:hidden space-y-3">
            {pageRows.map(o => (
              <div
                key={o._id}
                className="bg-white border rounded-lg p-3"
                onClick={() => openDetails(o._id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      #{(o.orderNumber || o._id.slice(-8)).toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {dt(o.createdAt)}
                    </div>
                  </div>
                  <span className={pill(o.status)}>{o.status}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 overflow-x-auto -mx-1 px-1">
                  {o.items.slice(0, 6).map((it, idx) => {
                    const src =
                      (typeof it.productId === 'object' && it.productId?.image) ||
                      it.image;
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
                        {(typeof it.productId === 'object' && it.productId?.name) ||
                          it.name ||
                          'Item'}
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
                  <div className="uppercase">
                    {o.paymentMethod} • {o.paymentStatus || '-'}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 px-3 py-2 rounded-md border hover:bg-gray-50 inline-flex items-center gap-1 justify-center"
                    onClick={e => {
                      e.stopPropagation();
                      openDetails(o._id);
                    }}
                  >
                    <EyeIcon className="w-4 h-4" /> View
                  </button>
                  <button
                    className="flex-1 px-3 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                    onClick={e => {
                      e.stopPropagation();
                      acceptOrder(o._id);
                    }}
                    disabled={busyId === o._id || o.status !== 'pending'}
                  >
                    {busyId === o._id ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}

            {/* Mobile pagination */}
            <div className="flex items-center justify-between pt-2 text-sm">
              <div className="text-gray-600">
                {page} / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="border rounded-md p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  className="border rounded-md p-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer – Order Details */}
      <div
        className={
          'fixed inset-0 z-50 transition ' +
          (openDrawer ? 'pointer-events-auto' : 'pointer-events-none')
        }
        aria-hidden={!openDrawer}
      >
        {/* Scrim */}
        <div
          className={
            'absolute inset-0 bg-black/30 transition-opacity ' +
            (openDrawer ? 'opacity-100' : 'opacity-0')
          }
          onClick={() => setOpenDrawer(false)}
        />
        {/* Panel */}
        <div
          className={
            'absolute right-0 top-0 h-full w-full sm:w-[540px] bg-white shadow-xl border-l transform transition-transform ' +
            (openDrawer ? 'translate-x-0' : 'translate-x-full')
          }
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between p-4 border-b">
            <div className="min-w-0">
              <div className="text-sm text-gray-500 truncate">
                Order {selected?.orderNumber || selectedId}
              </div>
              <div className="text-lg font-semibold text-gray-900 truncate">
                {selected?.userId?.name || selected?.userId?.email || 'Customer'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="border rounded-md px-2.5 py-2 hover:bg-gray-50"
                onClick={() => window.print()}
                title="Print"
              >
                <PrinterIcon className="w-4 h-4" />
              </button>
              <button
                className="border rounded-md px-2.5 py-2 hover:bg-gray-50"
                onClick={() => setOpenDrawer(false)}
                title="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto h-[calc(100%-56px)] p-4 space-y-4">
            {drawerLoading || !selected ? (
              <div className="p-6 text-center text-gray-600">
                <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                Loading details…
              </div>
            ) : (
              <>
                {/* Status row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={pill(selected.status)}>
                    {iconFor(selected.status)}
                    <span className="ml-1">{selected.status}</span>
                  </span>
                  {selected.paymentStatus && (
                    <span className={pill(selected.paymentStatus)}>
                      {iconFor(selected.paymentStatus)}
                      <span className="ml-1">{selected.paymentStatus.replace('_', ' ')}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-gray-50 text-gray-700">
                    {selected.paymentMethod?.toUpperCase()}
                  </span>
                </div>

                {/* Progress */}
                {selected.status !== 'cancelled' && (
                  <div className="flex items-center gap-2">
                    {ORDER_FLOW.map((s, i) => {
                      const done = ORDER_FLOW.indexOf(selected.status) >= i;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <div
                            className={
                              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ' +
                              (done ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600')
                            }
                            title={s}
                          >
                            {i + 1}
                          </div>
                          {i < ORDER_FLOW.length - 1 && (
                            <div className={'h-0.5 w-8 rounded ' + (done ? 'bg-gray-900' : 'bg-gray-200')} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Money + meta */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-lg font-semibold">{currency(selected.total)}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500">Placed</div>
                    <div className="text-sm">{dt(selected.createdAt)}</div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="font-semibold text-gray-900 mb-2">Items</div>
                  <div className="space-y-2">
                    {selected.items.map((it, idx) => {
                      const src =
                        (typeof it.productId === 'object' && it.productId?.image) || it.image;
                      const name =
                        (typeof it.productId === 'object' && it.productId?.name) ||
                        it.name ||
                        'Item';
                      return (
                        <div key={idx} className="flex items-center gap-3 border rounded-lg p-2">
                          <div className="w-12 h-12 rounded bg-gray-100 border overflow-hidden flex items-center justify-center">
                            {src ? (
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-gray-500 px-1 text-center">{name}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                            <div className="text-xs text-gray-600">
                              Qty {it.quantity} × {currency(it.price)}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">
                            {currency(it.quantity * it.price)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{currency(selected.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax</span>
                      <span>{currency(selected.tax)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span>{currency(selected.shipping)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total</span>
                      <span>{currency(selected.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border rounded-lg p-3">
                    <div className="font-semibold text-gray-900 mb-1">Shipping address</div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <div>{selected.shippingAddress?.fullName}</div>
                      <div>{selected.shippingAddress?.addressLine1}</div>
                      {selected.shippingAddress?.addressLine2 && <div>{selected.shippingAddress?.addressLine2}</div>}
                      <div>
                        {selected.shippingAddress?.city}, {selected.shippingAddress?.state}{' '}
                        {selected.shippingAddress?.pincode}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        📞 {selected.shippingAddress?.phoneNumber} • 📧 {selected.shippingAddress?.email}
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-semibold text-gray-900 mb-1">Billing address</div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <div>{selected.billingAddress?.fullName}</div>
                      <div>{selected.billingAddress?.addressLine1}</div>
                      {selected.billingAddress?.addressLine2 && <div>{selected.billingAddress?.addressLine2}</div>}
                      <div>
                        {selected.billingAddress?.city}, {selected.billingAddress?.state}{' '}
                        {selected.billingAddress?.pincode}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment + Tracking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border rounded-lg p-3">
                    <div className="font-semibold text-gray-900 mb-1">Payment</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Method</span>
                        <span className="font-medium uppercase">{selected.paymentMethod}</span>
                      </div>
                      {selected.paymentStatus && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status</span>
                          <span className={pill(selected.paymentStatus)}>
                            {selected.paymentStatus.replace('_', ' ')}
                          </span>
                        </div>
                      )}
                      {selected.paymentId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment ID</span>
                          <span className="font-mono text-xs">{selected.paymentId}</span>
                        </div>
                      )}
                      {selected.paidAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Paid at</span>
                          <span>{dt(selected.paidAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="font-semibold text-gray-900 mb-1">Shipping</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Carrier</span>
                        <span>{selected.carrierName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tracking</span>
                        <span className="font-mono text-xs">{selected.trackingNumber || '-'}</span>
                      </div>
                      {selected.estimatedDelivery && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">ETA</span>
                          <span>{dt(selected.estimatedDelivery)}</span>
                        </div>
                      )}
                      {(selected.trackingUrl || selected.trackingNumber) && (
                        <div className="pt-1">
                          <a
                            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md hover:bg-gray-50"
                            href={
                              selected.trackingUrl ||
                              `/track-order/${selected.trackingNumber}`
                            }
                            target={selected.trackingUrl ? '_blank' : undefined}
                            rel="noreferrer"
                          >
                            <TruckIcon className="w-4 h-4" />
                            Track package
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    className="px-3 py-2 rounded-md border hover:bg-gray-50"
                    onClick={() => selected && acceptOrder(selected._id)}
                    disabled={selected.status !== 'pending' || busyId === selected._id}
                  >
                    {busyId === selected?._id ? 'Accepting…' : 'Accept'}
                  </button>
                  {selected.status !== 'cancelled' && nextStatus(selected.status) && (
                    <button
                      className="px-3 py-2 rounded-md border hover:bg-gray-50"
                      onClick={() => selected && advance(selected._id, selected.status)}
                      disabled={busyId === selected._id}
                    >
                      Next: {nextStatus(selected.status)}
                    </button>
                  )}
                  {selected.status !== 'cancelled' && (
                    <button
                      className="px-3 py-2 rounded-md border hover:bg-rose-50 text-rose-700 border-rose-200"
                      onClick={() => selected && cancelOrder(selected._id)}
                      disabled={busyId === selected._id}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersTab;
