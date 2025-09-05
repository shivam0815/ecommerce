import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdminOrders, AdminOrder } from '../../config/adminApi';
import { getSocket, joinAdminRoom } from '../../config/socket';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  BanknotesIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
} from '@heroicons/react/24/solid';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
  checkNetworkStatus: () => boolean;
};

/* ----------------------------- small helpers ----------------------------- */
const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const ageMinutes = (iso: string) => Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 60000));
const fmtAge = (mins: number) =>
  mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;

const pill = (txt: string, tone: 'gray' | 'amber' | 'emerald' | 'rose' | 'indigo' = 'gray') =>
  `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'rose'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : tone === 'indigo'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : 'bg-gray-50 text-gray-700 border-gray-200'
  }`;

const initials = (name?: string, email?: string) => {
  const src = (name || email || 'U').trim();
  const parts = src.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const getAdminToken = () =>
  localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

/* ------------------------------ main component --------------------------- */
const PAGE_SIZES = [10, 25, 50, 100];

const PendingOrdersTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // controls
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<'createdAt' | 'total' | 'age'>('createdAt');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [payFilter, setPayFilter] = useState<'all' | 'cod' | 'prepaid'>('all');

  // selection for bulk actions
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // auto-refresh
  const timer = useRef<number | null>(null);

  const fetchServer = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setLoading(true);
      setErr(null);
      // Try asking the API for pending specifically
      const res = await getAdminOrders({
        status: 'pending', // if api ignores this, we’ll fallback filter below
        page: 1,
        limit: 400,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const raw = res.success ? (res.orders || []) : [];
      // client fallback: keep only pending-ish
      const normalized = raw.filter((o: any) => {
        const orderStatus = String(o.status || o.orderStatus || '').toLowerCase();
        const payStatus = String(o.paymentStatus || '').toLowerCase();
        return (
          orderStatus === 'pending' ||
          orderStatus === 'awaiting' ||
          payStatus === 'awaiting_payment' ||
          payStatus === 'pending'
        );
      });
      setOrders(normalized);
      if (!res.success) throw new Error(res.message || 'Failed to load pending orders');
    } catch (e: any) {
      setErr(e?.message || 'Failed to load pending orders');
      showNotification(e?.message || 'Failed to load pending orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [checkNetworkStatus, showNotification]);

  useEffect(() => { fetchServer(); }, [fetchServer]);

  // light socket hook (optional, safe if socket exists)
  useEffect(() => {
    const socket = getSocket?.();
    if (!socket) return;
    joinAdminRoom?.();
    const onCreated = (o: any) => {
      const st = String(o.status || o.orderStatus || '').toLowerCase();
      const pst = String(o.paymentStatus || '').toLowerCase();
      if (st === 'pending' || pst === 'awaiting_payment' || pst === 'pending') {
        setOrders(prev => [o, ...prev]);
        showNotification(`New pending order #${(o.orderNumber || o._id).toUpperCase()}`, 'info');
      }
    };
    const onUpdated = (o: any) => {
      const st = String(o.status || o.orderStatus || '').toLowerCase();
      const pst = String(o.paymentStatus || '').toLowerCase();
      setOrders(prev => {
        const exists = prev.some(x => x._id === o._id);
        const isPending = st === 'pending' || pst === 'awaiting_payment' || pst === 'pending';
        if (exists && !isPending) return prev.filter(x => x._id !== o._id); // moved out of pending
        if (!exists && isPending) return [o, ...prev];
        return prev.map(x => (x._id === o._id ? { ...x, ...o } : x));
      });
    };
    socket.on?.('orderCreated', onCreated);
    socket.on?.('orderStatusUpdated', onUpdated);
    return () => {
      socket.off?.('orderCreated', onCreated);
      socket.off?.('orderStatusUpdated', onUpdated);
    };
  }, [showNotification]);

  // auto-refresh every 30s
  useEffect(() => {
    const t = window.setInterval(() => fetchServer(), 30000) as unknown as number;
    timer.current = t;
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [fetchServer]);

  // derive rows with search & filters
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = orders.filter(o => {
      const user = (o as any).user || (o as any).userId || {};
      const name = (user?.name || '').toLowerCase();
      const email = (user?.email || '').toLowerCase();
      const method = (o as any).paymentMethod || '';
      const pm = String(method).toLowerCase();

      const matchQ =
        !term ||
        (o.orderNumber || '').toLowerCase().includes(term) ||
        (o._id || '').toLowerCase().includes(term) ||
        name.includes(term) || email.includes(term);

      const matchPay =
        payFilter === 'all' ? true :
        payFilter === 'cod' ? pm.includes('cod') :
        !pm.includes('cod'); // prepaid

      return matchQ && matchPay;
    });

    const withAge = base.map(o => ({ o, age: ageMinutes(String(o.createdAt)) }));
    withAge.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'age') return (a.age - b.age) * dir;
      if (sortKey === 'total') return ((Number((a.o as any).total) || 0) - (Number((b.o as any).total) || 0)) * dir;
      // createdAt
      return ((+new Date(a.o.createdAt)) - (+new Date(b.o.createdAt))) * dir;
    });
    return withAge.map(x => x.o);
  }, [orders, q, payFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

  // topline metrics
  const metrics = useMemo(() => {
    const count = rows.length;
    const sum = rows.reduce((s, o: any) => s + (Number(o.total) || 0), 0);
    const aov = count ? Math.round(sum / count) : 0;
    const oldest = rows.reduce((m, o) => Math.max(m, ageMinutes(String(o.createdAt))), 0);
    return { count, sum, aov, oldest };
  }, [rows]);

  /* -------------------------- actions / api calls ------------------------- */
  async function setStatus(id: string, status: 'confirmed' | 'cancelled') {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Update failed');
      // remove if moved out of pending
      setOrders(prev => prev.filter(o => o._id !== id));
      showNotification(`Order ${status}`, 'success');
    } catch (e: any) {
      showNotification(e?.message || 'Failed to update order', 'error');
    }
  }
  const acceptOne = (id: string) => setStatus(id, 'confirmed');
  const cancelOne = (id: string) => {
    if (confirm('Cancel this order?')) setStatus(id, 'cancelled');
  };

  const acceptSelected = () => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (!ids.length) return;
    ids.forEach(id => setStatus(id, 'confirmed'));
    setSelected({});
  };
  const cancelSelected = () => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (!ids.length) return;
    if (!confirm(`Cancel ${ids.length} order(s)?`)) return;
    ids.forEach(id => setStatus(id, 'cancelled'));
    setSelected({});
  };

  // CSV
  const exportCSV = () => {
    const headers = ['OrderID','OrderNumber','CustomerName','CustomerEmail','Total','PaymentMethod','PaymentStatus','AgeMinutes','CreatedAt'];
    const lines = rows.map((o: any) => {
      const user = o.user || o.userId || {};
      const line = [
        o._id,
        o.orderNumber || '',
        user?.name || '',
        user?.email || '',
        Number(o.total || 0),
        o.paymentMethod || '',
        o.paymentStatus || '',
        ageMinutes(String(o.createdAt)),
        new Date(o.createdAt).toISOString(),
      ];
      return line.map(v => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pending_orders_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="p-3 sm:p-4 md:p-6 bg-gray-50 min-h-[calc(100vh-60px)]">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">⏳ Pending Orders</h2>
          <p className="text-sm text-gray-600">Triage, verify and act fast. Focused on orders waiting for confirmation/payment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchServer}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-white hover:bg-gray-50"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-white hover:bg-gray-50"
            title="Export CSV"
          >
            <ArrowDownTrayIcon className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl border bg-white p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-50/70 to-transparent" />
          <div className="relative text-xs text-gray-500">Pending count</div>
          <div className="relative text-2xl font-bold">{metrics.count}</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-white p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/70 to-transparent" />
          <div className="relative text-xs text-gray-500">Pending value</div>
          <div className="relative text-2xl font-bold">{INR(metrics.sum)}</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border bg-white p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/70 to-transparent" />
          <div className="relative text-xs text-gray-500">Avg order value</div>
          <div className="relative text-2xl font-bold">{INR(metrics.aov)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 rounded-2xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative grow min-w-[220px]">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by order ID, number, customer, email"
              className="w-full border rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              inputMode="search"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPayFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs border ${payFilter==='all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >All</button>
            <button
              onClick={() => setPayFilter('cod')}
              className={`px-3 py-1.5 rounded-full text-xs border ${payFilter==='cod' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >COD</button>
            <button
              onClick={() => setPayFilter('prepaid')}
              className={`px-3 py-1.5 rounded-full text-xs border ${payFilter==='prepaid' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >Prepaid</button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setSortKey('createdAt');
                setSortDir(d => (sortKey === 'createdAt' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
              }}
              className={`rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 ${sortKey==='createdAt' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 bg-white'}`}
              title="Sort by date"
            >
              <ClockIcon className="w-4 h-4" /> Date {sortKey==='createdAt' ? (sortDir==='desc' ? '↓' : '↑') : ''}
            </button>
            <button
              onClick={() => {
                setSortKey('total');
                setSortDir(d => (sortKey === 'total' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
              }}
              className={`rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 ${sortKey==='total' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 bg-white'}`}
              title="Sort by total"
            >
              <BanknotesIcon className="w-4 h-4" /> Total {sortKey==='total' ? (sortDir==='desc' ? '↓' : '↑') : ''}
            </button>
            <button
              onClick={() => {
                setSortKey('age');
                setSortDir(d => (sortKey === 'age' ? (d === 'desc' ? 'asc' : 'desc') : 'desc'));
              }}
              className={`rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2 ${sortKey==='age' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 bg-white'}`}
              title="Sort by age"
            >
              <ClockIcon className="w-4 h-4" /> Age {sortKey==='age' ? (sortDir==='desc' ? '↓' : '↑') : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Selected {Object.values(selected).filter(Boolean).length} of {rows.length}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"
            onClick={acceptSelected}
            disabled={!Object.values(selected).some(Boolean)}
          >
            Accept selected
          </button>
          <button
            className="px-3 py-2 rounded-xl border hover:bg-rose-50 text-rose-700 border-rose-200 disabled:opacity-50"
            onClick={cancelSelected}
            disabled={!Object.values(selected).some(Boolean)}
          >
            Cancel selected
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b">
              <div className="h-4 w-28 bg-gray-200 animate-pulse rounded" />
              <div className="h-4 w-40 bg-gray-200 animate-pulse rounded" />
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
              <div className="h-6 w-24 bg-gray-200 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : err ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700">{err}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-600 shadow-sm">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-semibold mb-1">No pending orders</div>
          <div className="text-sm">You’re all caught up.</div>
        </div>
      ) : (
        <>
          {/* Table (md+) */}
          <div className="hidden md:block bg-white border rounded-2xl overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left p-3 w-10">
                    <input
                      type="checkbox"
                      onChange={e => {
                        const all = e.target.checked;
                        const next: Record<string, boolean> = {};
                        pageRows.forEach(o => (next[o._id] = all));
                        setSelected(s => ({ ...s, ...next }));
                      }}
                    />
                  </th>
                  <th className="text-left p-3">Order</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Items</th>
                  <th className="text-left p-3">Payment</th>
                  <th className="text-left p-3">Age</th>
                  <th className="text-left p-3">Total</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-gray-50/40">
                {pageRows.map((o: any) => {
                  const user = o.user || o.userId || {};
                  const mins = ageMinutes(String(o.createdAt));
                  const riskCOD = String(o.paymentMethod || '').toLowerCase().includes('cod');
                  const riskHigh = (Number(o.total) || 0) >= 10000;
                  const qty = (o.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  const riskQty = qty >= 5;

                  return (
                    <tr key={o._id} className="border-t">
                      <td className="p-3 align-top">
                        <input
                          type="checkbox"
                          checked={!!selected[o._id]}
                          onChange={e => setSelected(s => ({ ...s, [o._id]: e.target.checked }))}
                        />
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900">#{(o.orderNumber || o._id.slice(-8)).toUpperCase()}</div>
                          <button
                            className="text-gray-500 hover:text-gray-900"
                            title="Copy"
                            onClick={() => navigator.clipboard.writeText(o.orderNumber || o._id)}
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-[12px] text-gray-500 mt-0.5 uppercase tracking-wide">
                          {(o.paymentMethod || '-').toString()} • {(o.paymentStatus || '-').toString()}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className={pill('pending','amber')}><ClockIcon className="w-3 h-3" /> pending</span>
                          {riskCOD && <span className={pill('COD','rose')}>COD</span>}
                          {riskHigh && <span className={pill('high','rose')}>High value</span>}
                          {riskQty && <span className={pill(`${qty} qty`,'indigo')}>Qty {qty}</span>}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[11px] font-semibold text-gray-700">
                            {user?.name || user?.email ? initials(user?.name, user?.email) : <UserIcon className="w-4 h-4 text-gray-500" />}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user?.name || '—'}</div>
                            <div className="text-gray-500 text-xs">{user?.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        {(o.items || []).slice(0, 4).map((it: any, i: number) => {
                          const src = (typeof it.productId === 'object' && it.productId?.image) || it.image;
                          const name = (typeof it.productId === 'object' && it.productId?.name) || it.name || 'Item';
                          return src ? (
                            <img key={i} src={src} alt="" title={name} className="inline-block w-8 h-8 rounded object-cover border mr-1" />
                          ) : (
                            <span key={i} title={name} className="inline-block text-[11px] px-2 py-1 mr-1 rounded border bg-gray-50">
                              {name}
                            </span>
                          );
                        })}
                        {(o.items || []).length > 4 && (
                          <span className="inline-block text-[11px] px-2 py-1 rounded border bg-gray-50">
                            +{(o.items || []).length - 4}
                          </span>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        {String(o.paymentMethod || '').toLowerCase().includes('cod')
                          ? <span className={pill('COD','rose')}>COD</span>
                          : <span className={pill('Prepaid','emerald')}>Prepaid</span>}
                      </td>
                      <td className="p-3 align-top">
                        <div className="font-medium">{fmtAge(mins)}</div>
                        <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="p-3 font-semibold align-top">{INR(Number(o.total || 0))}</td>
                      <td className="p-3 text-right align-top">
                        <div className="inline-flex gap-2">
                          <button
                            className="px-3 py-1.5 rounded-xl border hover:bg-gray-50 inline-flex items-center gap-1"
                            onClick={() => window.open(`/admin/orders/${o._id}`, '_blank')}
                          >
                            <EyeIcon className="w-4 h-4" /> View
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-xl text-white bg-blue-600 hover:bg-blue-700"
                            onClick={() => acceptOne(o._id)}
                          >
                            Accept
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-xl border hover:bg-rose-50 text-rose-700 border-rose-200"
                            onClick={() => cancelOne(o._id)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t text-sm bg-white">
              <div className="text-gray-600">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length}
              </div>
              <div className="flex items-center gap-2">
                <select className="border rounded-xl px-2 py-1" value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
                <button className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <div className="px-2">{page} / {totalPages}</div>
                <button className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {pageRows.map((o: any) => {
              const user = o.user || o.userId || {};
              const mins = ageMinutes(String(o.createdAt));
              return (
                <div key={o._id} className="bg-white border rounded-2xl p-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">#{(o.orderNumber || o._id.slice(-8)).toUpperCase()}</div>
                      <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{INR(Number(o.total || 0))}</div>
                      <div className="text-xs text-gray-500">Age {fmtAge(mins)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-[11px] font-semibold text-gray-700">
                      {user?.name || user?.email ? initials(user?.name, user?.email) : <UserIcon className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-gray-900 font-medium truncate">{user?.name || '—'}</div>
                      <div className="text-gray-500 text-xs truncate">{user?.email || '—'}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className={pill('pending','amber')}><ClockIcon className="w-3 h-3" /> pending</span>
                    {String(o.paymentMethod || '').toLowerCase().includes('cod')
                      ? <span className={pill('COD','rose')}>COD</span>
                      : <span className={pill('Prepaid','emerald')}>Prepaid</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <button className="px-3 py-2 rounded-xl border hover:bg-gray-50" onClick={() => window.open(`/admin/orders/${o._id}`, '_blank')}>
                      View
                    </button>
                    <button className="px-3 py-2 rounded-xl bg-blue-600 text-white" onClick={() => acceptOne(o._id)}>
                      Accept
                    </button>
                    <button className="px-3 py-2 rounded-xl border hover:bg-rose-50 text-rose-700 border-rose-200" onClick={() => cancelOne(o._id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}

            {/* mobile pagination */}
            <div className="flex items-center justify-between pt-2 text-sm">
              <div className="text-gray-600">{page} / {totalPages}</div>
              <div className="flex items-center gap-2">
                <button className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button className="border rounded-xl p-1.5 hover:bg-gray-50 disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PendingOrdersTab;
