// src/pages/admin/TodaySalesTab.tsx
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { motion } from 'framer-motion';
import { getAdminOrders, AdminOrder } from '../../config/adminApi';
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
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';

/* --------------------------- IST Date Utilities --------------------------- */
const istDayBoundsUTC = (when = Date.now()): [number, number] => {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const ist = when + IST_OFFSET;
  const startIst = Math.floor(ist / 86400000) * 86400000;
  const endIst = startIst + 86400000 - 1;
  return [startIst - IST_OFFSET, endIst - IST_OFFSET];
};
const iso = (msUTC: number) => new Date(msUTC).toISOString();

type RangeKey = 'today' | 'yesterday' | 'last7';
const getRangeUTC = (key: RangeKey): { fromISO: string; toISO: string; label: string } => {
  const now = Date.now();
  if (key === 'today') {
    const [s, e] = istDayBoundsUTC(now);
    return { fromISO: iso(s), toISO: iso(e), label: 'Today' };
  }
  if (key === 'yesterday') {
    const [s, e] = istDayBoundsUTC(now - 86400000);
    return { fromISO: iso(s), toISO: iso(e), label: 'Yesterday' };
  }
  const [todayStart] = istDayBoundsUTC(now);
  const start7 = todayStart - 6 * 86400000;
  const [, todayEnd] = istDayBoundsUTC(now);
  return { fromISO: iso(start7), toISO: iso(todayEnd), label: 'Last 7 days' };
};

/* ------------------------------ Small Helpers ----------------------------- */
const formatINR = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const copy = async (t: string) => {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
};

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const dt = (isoStr?: string) =>
  isoStr ? new Date(isoStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const getInitials = (name?: string, email?: string) => {
  const src = (name || email || 'U').trim();
  const parts = src.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getAdminToken = () =>
  localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

const API_SHIPROCKET_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

/* ------------------------------- Types ------------------------------------ */
// Reuse AdminOrder for list; define detailed order used in drawer
type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
type PaymentStatus = 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid' | 'refunded' | 'pending';

interface IOrderFull {
  _id: string;
  orderNumber?: string;
  items: {
    productId?: string | { _id?: string; name?: string; image?: string };
    name?: string;
    image?: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'razorpay' | 'cod' | string;
  paymentStatus?: PaymentStatus;
  createdAt: string;

  userId?: { _id?: string; name?: string; email?: string };
  shippingAddress?: {
    fullName?: string; phoneNumber?: string; email?: string;
    addressLine1?: string; addressLine2?: string;
    city?: string; state?: string; pincode?: string; landmark?: string;
  };
  billingAddress?: IOrderFull['shippingAddress'];
  paidAt?: string; shippedAt?: string; deliveredAt?: string; cancelledAt?: string;
  paymentOrderId?: string; paymentId?: string; paymentSignature?: string;

  // Shiprocket
  shipmentId?: number;
  awbCode?: string;
  courierName?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  shiprocketStatus?:
    | 'ORDER_CREATED'
    | 'AWB_ASSIGNED'
    | 'PICKUP_GENERATED'
    | 'LABEL_READY'
    | 'INVOICE_READY'
    | 'MANIFEST_READY'
    | 'TRACKING_UPDATED';

  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: string;
}

/* --------------------------- UI helpers/pills ----------------------------- */
const ORDER_FLOW: OrderStatus[] = ['pending','confirmed','processing','shipped','delivered'];
const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = ORDER_FLOW.indexOf(s);
  if (i === -1 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
};

const pill = (s: string) =>
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs capitalize border ' +
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
    default:
      return <ClockIcon className="w-4 h-4" />;
  }
};

function trackingHref(o: IOrderFull): string {
  const url = (o.trackingUrl || '').trim();
  if (url) return url;
  const awb = (o.awbCode || o.trackingNumber || '').trim();
  if (!awb) return '';
  const courier = (o.courierName || o.carrierName || '').toLowerCase();
  if (courier.includes('delhivery'))   return `https://www.delhivery.com/track/package/${awb}`;
  if (courier.includes('bluedart'))    return `https://bluedart.com/tracking?awb=${awb}`;
  if (courier.includes('dtdc'))        return `https://www.dtdc.in/tracking/default.aspx?awb=${awb}`;
  if (courier.includes('xpressbees'))  return `https://www.xpressbees.com/track?awb=${awb}`;
  if (courier.includes('ecom'))        return `https://ecomexpress.in/tracking/?awb=${awb}`;
  if (courier.includes('india post') || courier.includes('speed post'))
                                       return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?awb=${awb}`;
  return `https://track.shiprocket.in/?awb=${awb}`;
}

/* ------------------------------- Component -------------------------------- */
type Props = {
  showNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
  checkNetworkStatus: () => boolean;
};
const PAGE_SIZES = [10, 20, 50, 100];

const TodaySalesTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  // Controls
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [paymentFilters, setPaymentFilters] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [sortBy, setSortBy] = useState<keyof AdminOrder | '_total' | '_createdAt'>('_createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Data
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Realtime UI
  const [banner, setBanner] = useState<string | null>(null);
  const dingRef = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef<string>(document.title);

  // Drawer
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<IOrderFull | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Auto refresh (when visible)
  const timerRef = useRef<number | null>(null);
  const isVisible = () => document.visibilityState === 'visible';

  const load = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      setErr(null);
      const { fromISO, toISO } = getRangeUTC(rangeKey);
      const res = await getAdminOrders({
        page: 1,
        limit: 500,
        dateFrom: fromISO,
        dateTo: toISO,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      if (res.success) {
        setOrders(res.orders || []);
      } else {
        throw new Error(res.message || 'Failed to load orders');
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to load orders';
      setErr(msg);
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [checkNetworkStatus, rangeKey, showNotification]);

  useEffect(() => { load(); }, [load]);

  // sockets: new/updated orders while this tab is open
  useEffect(() => {
    dingRef.current = new Audio('/sounds/new-order.wav');
    const onVisible = () => (document.title = originalTitle.current);
    document.addEventListener('visibilitychange', onVisible);

    const socket = getSocket();
    joinAdminRoom();

    const onCreated = (payload: any) => {
      // only show if within selected range (today/last7 etc.)
      const createdAt = +new Date(payload.createdAt);
      const { fromISO, toISO } = getRangeUTC(rangeKey);
      const from = +new Date(fromISO);
      const to = +new Date(toISO);
      if (createdAt < from || createdAt > to) return;

      setOrders(prev => [payload, ...prev]);
      const titleNum = (payload.orderNumber || payload._id.slice(-8)).toUpperCase();
      const who = payload.user?.name || payload.userId?.name || payload.user?.email || payload.userId?.email || 'New customer';
      const body = `${who} • ${payload.items?.length || 0} items • ${formatINR(Number(payload.total || 0))}`;

      setBanner(`🆕 New order #${titleNum} — ${body}`);
      setTimeout(() => setBanner(null), 6000);

      dingRef.current?.play().catch(() => {});
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`New order #${titleNum}`, { body, icon: '/favicon.ico', tag: payload._id });
      }
      if (document.hidden) document.title = `● New order! — ${originalTitle.current}`;
      if (navigator.vibrate) navigator.vibrate(120);
    };

    const onUpdated = (payload: any) => {
      setOrders(prev => prev.map(o => (o._id === payload._id ? { ...o, ...payload } : o)));
      if (selectedId === payload._id) {
        setSelected(prev => (prev ? { ...prev, ...payload } : prev));
      }
    };

    socket.on('orderCreated', onCreated);
    socket.on('orderStatusUpdated', onUpdated);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('orderCreated', onCreated);
      socket.off('orderStatusUpdated', onUpdated);
    };
  }, [rangeKey, selectedId]);

  // auto refresh every 60s when visible
  useEffect(() => {
    const tick = () => { if (isVisible()) load(); };
    timerRef.current = window.setInterval(tick, 60000) as unknown as number;
    const onVis = () => { if (isVisible()) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  /* ----------------------- Filtering/Sorting/Paging ----------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders || []).filter(o => {
      const matchQ = !q ||
        (o.orderNumber?.toLowerCase().includes(q)) ||
        // @ts-ignore
        (o.user?.name?.toLowerCase().includes(q)) ||
        // @ts-ignore
        (o.user?.email?.toLowerCase().includes(q));
      const matchStatus = !statusFilters.length || (o.status && statusFilters.includes(String(o.status)));
      const matchPayment = !paymentFilters.length || (o.paymentStatus && paymentFilters.includes(String(o.paymentStatus)));
      return matchQ && matchStatus && matchPayment;
    });
  }, [orders, search, statusFilters, paymentFilters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string = '';
      let vb: number | string = '';
      if (sortBy === '_createdAt') {
        va = new Date(a.createdAt as any).getTime();
        vb = new Date(b.createdAt as any).getTime();
      } else if (sortBy === '_total') {
        va = Number(a.total || 0);
        vb = Number(b.total || 0);
      } else {
        // @ts-ignore
        va = (a[sortBy] ?? '') as any;
        // @ts-ignore
        vb = (b[sortBy] ?? '') as any;
      }
      const cmp = (va > vb ? 1 : va < vb ? -1 : 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  const pageRows = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  /* ------------------------------- Metrics -------------------------------- */
  const metrics = useMemo(() => {
    const count = filtered.length;
    const revenue = filtered.reduce((s: number, o: AdminOrder) => s + (Number(o.total) || 0), 0);
    const aov = count ? Math.round((revenue / count) * 100) / 100 : 0;

    const buckets = new Array(24).fill(0);
    const counts = new Array(24).fill(0);
    filtered.forEach(o => {
      const h = new Date(o.createdAt).getHours();
      buckets[h] += Number(o.total) || 0;
      counts[h] += 1;
    });
    const avgBuckets = buckets.map((sum, i) => (rangeKey === 'today' ? sum : (counts[i] ? sum / counts[i] : 0)));

    const byStatus = filtered.reduce<Record<string, { n: number; amt: number }>>((acc, o: any) => {
      const k = String(o.status || 'unknown');
      const t = Number(o.total || 0);
      if (!acc[k]) acc[k] = { n: 0, amt: 0 };
      acc[k].n += 1; acc[k].amt += t;
      return acc;
    }, {});
    return { count, revenue, aov, buckets: avgBuckets, byStatus };
  }, [filtered, rangeKey]);

  /* ------------------------------ CSV Export ------------------------------ */
  const exportCSV = () => {
    const headers = [
      'OrderNumber','CustomerName','CustomerEmail','Status','PaymentStatus','Total','CreatedAt(IST)'
    ];
    const rows = filtered.map((o: any) => ([
      o.orderNumber || o._id,
      o.user?.name || '',
      o.user?.email || '',
      String(o.status || ''),
      String(o.paymentStatus || ''),
      Number(o.total || 0),
      new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })
    ]));
    const csv = [headers, ...rows].map(r =>
      r.map(v => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const { label } = getRangeUTC(rangeKey);
    a.download = `orders_${label.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('CSV exported', 'success');
  };

  /* ------------------------------- Sparkline ------------------------------ */
  const tinySpark = (vals: number[]) => {
    const data = vals;
    const w = 280, h = 72, pad = 10;
    const max = Math.max(...data, 1);
    const step = (w - pad * 2) / (Math.max(data.length - 1, 1));
    const pts = data.map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="block">
        <polyline fill="none" stroke="#e5e7eb" strokeWidth="1" points={`${pad},${h - pad} ${w - pad},${h - pad}`} />
        <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={pts} />
        <text x={w - pad} y={pad + 8} textAnchor="end" fontSize="10" fill="#6b7280">{formatINR(max)}</text>
      </svg>
    );
  };

  const toggleChip = (arr: string[], setArr: (v: string[]) => void, k: string) => {
    setArr(arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]);
    setPage(1);
  };

  const headerCell = (label: string, key: keyof AdminOrder | '_total' | '_createdAt') => (
    <th
      onClick={() => {
        if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(key); setSortDir(key === '_createdAt' ? 'desc' : 'asc'); }
      }}
      className="cursor-pointer whitespace-nowrap text-left text-xs font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 bg-gray-50 sticky top-0"
      title="Click to sort"
    >
      {label}{' '}{sortBy === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
    </th>
  );

  /* -------------------------- Drawer data fetch --------------------------- */
  const fetchOrderDetails = async (id: string) => {
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/orders/admin/${id}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to load order');
      const o = data.order;
      setSelected({ ...o, status: (o.status || o.orderStatus || 'pending') });
    } catch (e: any) {
      showNotification(e.message || 'Failed to load order', 'error');
    } finally {
      setDrawerLoading(false);
    }
  };
  const openDetails = (id: string) => {
    setSelectedId(id);
    setOpenDrawer(true);
    setSelected(null);
    fetchOrderDetails(id);
  };

  /* ---------------------- Status transitions (optional) ------------------- */
  async function setStatus(id: string, status: OrderStatus) {
    try {
      setBusyId(id);
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Failed to update order');
      const updated = (data.order || data.data || data) as any;
      setOrders(prev => prev.map(o => (o._id === id ? { ...o, ...updated } : o)));
      if (selected && selected._id === id) setSelected(prev => (prev ? { ...prev, ...updated } : prev));
    } catch (e: any) {
      showNotification(e.message || 'Failed to update order', 'error');
    } finally {
      setBusyId(null);
    }
  }
  const acceptOrder = (id: string) => setStatus(id, 'confirmed');
  const advance = (id: string, s: OrderStatus) => { const ns = nextStatus(s); if (ns) setStatus(id, ns); };
  const cancelOrder = (id: string) => { if (confirm('Cancel this order?')) setStatus(id, 'cancelled'); };

  /* ------------------------- Shiprocket Action API ------------------------ */
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` });

  const srCreate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/create`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to create Shiprocket order');
      alert(`Shiprocket order created. shipmentId = ${data.shipmentId}`);
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally { setBusyId(null); }
  };

  const srAssignAwb = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/assign-awb`, {
        method: 'POST', headers: authHeaders(), credentials: 'include', body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to assign AWB');
      alert(`AWB: ${data.awbCode} (${data.courierName || 'courier'})`);
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally { setBusyId(null); }
  };

  const srPickup = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/pickup`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to generate pickup');
      alert('Pickup generated.');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally { setBusyId(null); }
  };

  const srLabel = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/label`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to generate label');
      if (data.labelUrl) window.open(data.labelUrl, '_blank');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally { setBusyId(null); }
  };

  const srInvoice = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/invoice`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to print invoice');
      if (data.invoiceUrl) window.open(data.invoiceUrl, '_blank');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally { setBusyId(null); }
  };

  const srManifest = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_SHIPROCKET_BASE}/orders/${id}/shiprocket/manifest`, {
        method: 'POST', headers: authHeaders(), credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Failed to print manifest');
      if (data.manifestUrl) window.open(data.manifestUrl, '_blank');
      if (selectedId === id) fetchOrderDetails(id);
    } catch (e: any) {
      alert(e.message || 'Shiprocket error');
    } finally { setBusyId(null); }
  };

  /* -------------------------------- Render -------------------------------- */
  return (
    <div className="today-sales">
      {banner && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 shadow-sm">
          {banner}
        </div>
      )}

      {/* Top bar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="m-0 text-xl font-semibold">💸 Sales</h2>
          <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs">
            {getRangeUTC(rangeKey).label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 inline-flex items-center gap-2"
            onClick={load}><ArrowPathIcon className="w-4 h-4" /> Refresh</button>
          <button className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 inline-flex items-center gap-2"
            onClick={exportCSV}><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            {(['today','yesterday','last7'] as RangeKey[]).map(k => (
              <button
                key={k}
                className={`px-3 py-1.5 rounded-lg text-sm ${rangeKey === k ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                onClick={() => { setRangeKey(k); setPage(1); }}
              >
                {getRangeUTC(k).label}
              </button>
            ))}
          </div>

          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search order # / name / email"
              className="min-w-[260px] bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['pending','confirmed','processing','shipped','delivered','cancelled'].map(s => (
              <button
                key={s}
                className={`px-3 py-1 rounded-full text-xs border ${statusFilters.includes(s)
                  ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-700'
                }`}
                onClick={() => toggleChip(statusFilters, setStatusFilters, s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['paid','pending','failed','refunded','cod'].map(s => (
              <button
                key={s}
                className={`px-3 py-1 rounded-full text-xs border ${paymentFilters.includes(s)
                  ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-700'
                }`}
                onClick={() => toggleChip(paymentFilters, setPaymentFilters, s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-600">Rows</label>
            <select
              className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <motion.div whileHover={{ scale: 1.02 }} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-xs text-gray-600">Revenue</div>
          <div className="text-2xl font-bold">{formatINR(metrics.revenue)}</div>
          <div className="mt-2">{tinySpark(metrics.buckets)}</div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-xs text-gray-600">Orders</div>
          <div className="text-2xl font-bold">{metrics.count}</div>
          <div className="text-[11px] text-gray-500">Filtered results</div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="text-xs text-gray-600">Avg Order Value</div>
          <div className="text-2xl font-bold">{formatINR(metrics.aov)}</div>
          <div className="text-[11px] text-gray-500">Revenue / Orders</div>
        </motion.div>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
        {Object.entries(metrics.byStatus).map(([k, v]) => (
          <div key={k} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1 capitalize">{k}</div>
            <div className="flex items-center justify-between text-sm">
              <span>{v.n} orders</span>
              <strong>{formatINR(v.amt)}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Table / Cards */}
      <div className="mt-3">
        {loading ? (
          <div className="p-6 text-center text-gray-600">
            <div className="h-40 rounded-xl bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[pulse_1.2s_ease-in-out_infinite]" />
            <p className="mt-2">Loading…</p>
          </div>
        ) : err ? (
          <div className="p-6 text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">⚠️ {err}</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center text-gray-600">🗒 No matching orders</div>
        ) : (
          <>
            {/* Table for md+ */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {headerCell('Order #', 'orderNumber' as any)}
                    {headerCell('Customer', 'user' as any)}
                    {headerCell('Status', 'status')}
                    {headerCell('Payment', 'paymentStatus')}
                    {headerCell('Total', '_total')}
                    {headerCell('Placed At', '_createdAt')}
                    <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 bg-gray-50 sticky top-0">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((o: any) => (
                    <tr key={o._id} className="odd:bg-white even:bg-gray-50 hover:bg-indigo-50/40">
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <strong>#{(o.orderNumber || o._id.slice(-8)).toUpperCase()}</strong>
                          <button
                            className="text-gray-600 underline text-xs"
                            onClick={async () => {
                              const ok = await copy(o.orderNumber || o._id);
                              showNotification(ok ? 'Order ID copied' : 'Copy failed', ok ? 'success' : 'error');
                            }}
                          >
                            Copy
                          </button>
                        </div>
                        <div className="text-[12px] text-gray-500 mt-0.5 uppercase tracking-wide">
                          {o.paymentMethod || '-'} • {o.paymentStatus || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[11px] font-semibold text-gray-700">
                            {getInitials(o.user?.name, o.user?.email)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{o.user?.name || '—'}</div>
                            <div className="text-gray-500 text-xs">{o.user?.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={pill(o.status || '')}>
                          {iconFor(o.status || '')}
                          <span>{o.status}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={pill(o.paymentStatus || '')}>
                          {iconFor(o.paymentStatus || '')}
                          <span>{(o.paymentStatus || '').replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">{formatINR(Number(o.total || 0))}</td>
                      <td className="px-3 py-2 align-top" title={new Date(o.createdAt).toISOString()}>
                        {new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="inline-flex gap-2">
                          <button
                            className="px-3 py-1.5 rounded-xl border hover:bg-gray-50 inline-flex items-center gap-1"
                            onClick={() => openDetails(o._id)}
                            title="View details"
                          >
                            <EyeIcon className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t text-sm bg-white">
                <div className="text-gray-600">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <select className="border rounded-xl px-2 py-1" value={pageSize} onChange={e => setPageSize(+e.target.value)}>
                    {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
                  </select>
                  <button className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>◀</button>
                  <div className="px-2">{page} / {pages}</div>
                  <button className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>▶</button>
                </div>
              </div>
            </div>

            {/* Card list for small screens */}
            <div className="md:hidden space-y-2">
              {pageRows.map((o: any) => (
                <div key={o._id} className="border border-gray-200 rounded-xl p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">#{(o.orderNumber || o._id.slice(-8)).toUpperCase()}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })}
                      </div>
                    </div>
                    <button className="text-indigo-600 text-sm inline-flex items-center gap-1" onClick={() => openDetails(o._id)}>
                      <EyeIcon className="w-4 h-4" /> View
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[11px] font-semibold text-gray-700">
                        {getInitials(o.user?.name, o.user?.email)}
                      </div>
                      <div>
                        <div className="text-gray-900 font-medium truncate">{o.user?.name || '—'}</div>
                        <div className="text-gray-500 text-xs truncate">{o.user?.email || '—'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">Total</div>
                      <div className="font-semibold">{formatINR(Number(o.total || 0))}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                    <span className="uppercase">{o.paymentMethod || '-'} • {o.paymentStatus || '-'}</span>
                    <span className={pill(o.status || '')}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Drawer – Order Details */}
      <div className={'fixed inset-0 z-50 transition ' + (openDrawer ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!openDrawer}>
        <div className={'absolute inset-0 bg-black/30 transition-opacity ' + (openDrawer ? 'opacity-100' : 'opacity-0')} onClick={() => setOpenDrawer(false)} />
        <div className={'absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white shadow-2xl border-l transform transition-transform ' + (openDrawer ? 'translate-x-0' : 'translate-x-full')} role="dialog" aria-modal="true">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
            <div className="min-w-0">
              <div className="text-sm text-gray-500 truncate">
                Order {selected?.orderNumber || selectedId}
              </div>
              <div className="text-lg font-semibold text-gray-900 truncate">
                {selected?.userId?.name || selected?.userId?.email || selected?.userId?.name || selected?.userId?.email || 'Customer'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="border rounded-xl px-2.5 py-2 hover:bg-gray-50" onClick={() => window.print()} title="Print">
                <PrinterIcon className="w-4 h-4" />
              </button>
              <button className="border rounded-xl px-2.5 py-2 hover:bg-gray-50" onClick={() => setOpenDrawer(false)} title="Close">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

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
                  <span className={pill(selected.status)}>{iconFor(selected.status)}<span>{selected.status}</span></span>
                  {selected.paymentStatus && (
                    <span className={pill(selected.paymentStatus)}>{iconFor(selected.paymentStatus)}<span>{selected.paymentStatus.replace('_',' ')}</span></span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border bg-gray-50 text-gray-700">
                    {(selected as any).paymentMethod?.toUpperCase?.() || 'PAYMENT'}
                  </span>
                  {selected.shiprocketStatus && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border bg-indigo-50 text-indigo-700">
                      SR: {selected.shiprocketStatus.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {/* Progress */}
                {selected.status !== 'cancelled' && (
                  <div className="flex items-center gap-2">
                    {ORDER_FLOW.map((s, i) => {
                      const done = ORDER_FLOW.indexOf(selected.status) >= i;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <div className={'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ' + (done ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600')} title={s}>
                            {i + 1}
                          </div>
                          {i < ORDER_FLOW.length - 1 && <div className={'h-0.5 w-8 rounded ' + (done ? 'bg-gray-900' : 'bg-gray-200')} />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Money + meta */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border rounded-2xl p-3">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-lg font-semibold">{currency(selected.total)}</div>
                  </div>
                  <div className="border rounded-2xl p-3">
                    <div className="text-xs text-gray-500">Placed</div>
                    <div className="text-sm">{dt(selected.createdAt)}</div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="font-semibold text-gray-900 mb-2">Items</div>
                  <div className="space-y-2">
                    {selected.items.map((it, idx) => {
                      const src = (typeof it.productId === 'object' && it.productId?.image) || it.image;
                      const name = (typeof it.productId === 'object' && it.productId?.name) || it.name || 'Item';
                      return (
                        <div key={idx} className="flex items-center gap-3 border rounded-2xl p-2">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 border overflow-hidden flex items-center justify-center">
                            {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-gray-500 px-1 text-center">{name}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                            <div className="text-xs text-gray-600">Qty {it.quantity} × {currency(it.price)}</div>
                          </div>
                          <div className="text-sm font-semibold">{currency(it.quantity * it.price)}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{currency(selected.subtotal)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Tax</span><span>{currency(selected.tax)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Shipping</span><span>{currency(selected.shipping)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span>{currency(selected.total)}</span></div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Shipping address</div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <div>{selected.shippingAddress?.fullName}</div>
                      <div>{selected.shippingAddress?.addressLine1}</div>
                      {selected.shippingAddress?.addressLine2 && <div>{selected.shippingAddress?.addressLine2}</div>}
                      <div>{selected.shippingAddress?.city}, {selected.shippingAddress?.state} {selected.shippingAddress?.pincode}</div>
                      <div className="text-xs text-gray-500 mt-1">📞 {selected.shippingAddress?.phoneNumber} • 📧 {selected.shippingAddress?.email}</div>
                    </div>
                  </div>
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Billing address</div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <div>{selected.billingAddress?.fullName}</div>
                      <div>{selected.billingAddress?.addressLine1}</div>
                      {selected.billingAddress?.addressLine2 && <div>{selected.billingAddress?.addressLine2}</div>}
                      <div>{selected.billingAddress?.city}, {selected.billingAddress?.state} {selected.billingAddress?.pincode}</div>
                    </div>
                  </div>
                </div>

                {/* Payment + Tracking */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Payment</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-600">Method</span><span className="font-medium uppercase">{(selected as any).paymentMethod}</span></div>
                      {selected.paymentStatus && <div className="flex justify-between"><span className="text-gray-600">Status</span><span className={pill(selected.paymentStatus)}>{selected.paymentStatus.replace('_',' ')}</span></div>}
                      {selected.paymentId && <div className="flex justify-between"><span className="text-gray-600">Payment ID</span><span className="font-mono text-xs">{selected.paymentId}</span></div>}
                      {selected.paidAt && <div className="flex justify-between"><span className="text-gray-600">Paid at</span><span>{dt(selected.paidAt)}</span></div>}
                    </div>
                  </div>
                  <div className="border rounded-2xl p-3">
                    <div className="font-semibold text-gray-900 mb-1">Shipping</div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-600">Carrier</span><span>{selected.courierName || selected.carrierName || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Tracking</span><span className="font-mono text-xs">{selected.awbCode || selected.trackingNumber || '-'}</span></div>
                      {selected.estimatedDelivery && <div className="flex justify-between"><span className="text-gray-600">ETA</span><span>{dt(selected.estimatedDelivery)}</span></div>}
                      {(selected.labelUrl || selected.invoiceUrl || selected.manifestUrl) && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          {selected.labelUrl && <a className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50" href={selected.labelUrl} target="_blank" rel="noreferrer">Label</a>}
                          {selected.invoiceUrl && <a className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50" href={selected.invoiceUrl} target="_blank" rel="noreferrer">Invoice</a>}
                          {selected.manifestUrl && <a className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50" href={selected.manifestUrl} target="_blank" rel="noreferrer">Manifest</a>}
                        </div>
                      )}
                      {(selected?.trackingUrl || selected?.trackingNumber || selected?.awbCode) && (
                        <div className="pt-1">
                          <button type="button" className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl hover:bg-gray-50"
                                  onClick={() => { const u = trackingHref(selected); u ? window.open(u, '_blank','noopener,noreferrer') : alert('No tracking details yet.'); }}>
                            <TruckIcon className="w-4 h-4" /> Track package
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && acceptOrder(selected._id)}
                          disabled={selected.status !== 'pending' || busyId === selected._id}>
                    {busyId === selected?._id ? 'Accepting…' : 'Accept'}
                  </button>
                  {selected.status !== 'cancelled' && nextStatus(selected.status) && (
                    <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                            onClick={() => selected && advance(selected._id, selected.status)}
                            disabled={busyId === selected._id}>
                      Next: {nextStatus(selected.status)}
                    </button>
                  )}
                  {selected.status !== 'cancelled' && (
                    <button className="px-3 py-2 rounded-xl border hover:bg-rose-50 text-rose-700 border-rose-200"
                            onClick={() => selected && cancelOrder(selected._id)}
                            disabled={busyId === selected._id}>
                      Cancel
                    </button>
                  )}

                  {/* Shiprocket */}
                  <div className="w-full h-0" />
                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && srCreate(selected._id)}
                          disabled={busyId === selected?._id || !!selected.shipmentId}
                          title={selected?.shipmentId ? 'Shipment already created' : 'Create Shiprocket order'}>
                    {selected?.shipmentId ? `Shipment: ${selected.shipmentId}` : 'SR: Create Order'}
                  </button>

                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && srAssignAwb(selected._id)}
                          disabled={busyId === selected?._id || !selected.shipmentId || !!selected.awbCode}
                          title={!selected?.shipmentId ? 'Create Shiprocket order first' : (selected?.awbCode ? 'AWB already assigned' : 'Assign AWB')}>
                    {selected?.awbCode ? `AWB: ${selected.awbCode}` : 'SR: Assign AWB'}
                  </button>

                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && srPickup(selected._id)}
                          disabled={busyId === selected?._id || !selected.shipmentId || !selected.awbCode}
                          title={!selected?.awbCode ? 'Assign AWB first' : 'Generate pickup'}>
                    SR: Pickup
                  </button>

                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && srLabel(selected._id)}
                          disabled={busyId === selected?._id || !selected.shipmentId}>
                    SR: Label
                  </button>
                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && srInvoice(selected._id)}
                          disabled={busyId === selected?._id || !selected.shipmentId}>
                    SR: Invoice
                  </button>
                  <button className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                          onClick={() => selected && srManifest(selected._id)}
                          disabled={busyId === selected?._id || !selected.shipmentId}>
                    SR: Manifest
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodaySalesTab;
