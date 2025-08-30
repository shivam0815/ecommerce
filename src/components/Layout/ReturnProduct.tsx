import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  adminGetReturns,
  adminReturnDecision,
  adminReturnMarkReceived,
  adminReturnRefund,
} from '../../config/adminApi';

type AdminReturn = {
  _id: string;
  order?: { _id?: string; orderNumber?: string };
  user?: { _id?: string; name?: string; email?: string };
  status: 'pending' | 'approved' | 'rejected' | 'pickup_scheduled' | 'in_transit' | 'received' | 'refund_completed' | string;
  reasonType?: string;
  reasonNote?: string;
  items: Array<{ productId: string; name?: string; quantity: number; unitPrice: number }>;
  refundAmount?: number;
  currency?: string;
  images?: string[];
  createdAt?: string;
};

const pill = (s: string) => {
  const k = s.toLowerCase();
  if (['pending'].includes(k)) return 'text-amber-700 bg-amber-100';
  if (['approved','pickup_scheduled','in_transit'].includes(k)) return 'text-indigo-700 bg-indigo-100';
  if (['received'].includes(k)) return 'text-blue-700 bg-blue-100';
  if (['refund_completed'].includes(k)) return 'text-emerald-700 bg-emerald-100';
  if (['rejected','cancelled'].includes(k)) return 'text-rose-700 bg-rose-100';
  return 'text-gray-700 bg-gray-100';
};

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleString() : '—';

const money = (n?: number, cur = 'INR') =>
  typeof n === 'number' ? n.toLocaleString('en-IN', { style: 'currency', currency: cur }) : '—';

const ReturnProduct: React.FC<{
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
}> = ({ showNotification, checkNetworkStatus }) => {
  const [rows, setRows] = useState<AdminReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const fetchList = useCallback(async () => {
  if (!checkNetworkStatus()) return;
  setLoading(true);
  try {
    const res = await adminGetReturns({ page, limit, status: status || undefined, q: q || undefined });

    // If server sent 304 or empty (due to cache), keep existing rows instead of wiping to []
    if (res && Array.isArray(res.returns)) {
      setRows(res.returns);
      setTotal(res.total || 0);
    } // else: do nothing (retain current list)
  } catch (e: any) {
    showNotification(e?.response?.data?.message || 'Failed to load returns', 'error');
  } finally {
    setLoading(false);
  }
}, [page, limit, status, q, checkNetworkStatus, showNotification]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Actions
  const doDecision = async (id: string, action: 'approve' | 'reject') => {
    if (!checkNetworkStatus()) return;
    try {
      await adminReturnDecision(id, action);
      showNotification(`Return ${action}d`, 'success');
      fetchList();
    } catch (e: any) {
      showNotification(e?.response?.data?.message || `Failed to ${action}`, 'error');
    }
  };

  const doReceived = async (id: string) => {
    if (!checkNetworkStatus()) return;
    try {
      await adminReturnMarkReceived(id);
      showNotification('Marked as received', 'success');
      fetchList();
    } catch (e: any) {
      showNotification(e?.response?.data?.message || 'Failed to mark received', 'error');
    }
  };

  const doRefund = async (id: string) => {
    if (!checkNetworkStatus()) return;
    const method = window.prompt('Refund method: original | wallet | manual', 'original') as
      | 'original' | 'wallet' | 'manual' | null;
    if (!method) return;
    const reference = window.prompt('Reference / note (optional)') || undefined;

    try {
      await adminReturnRefund(id, { method, reference });
      showNotification('Refund completed', 'success');
      fetchList();
    } catch (e: any) {
      showNotification(e?.response?.data?.message || 'Failed to refund', 'error');
    }
  };

  return (
    <div className="p-2">
      <h2 className="text-xl font-semibold mb-3">🔁 Return Requests</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search…"
          className="border rounded-lg px-3 py-2"
        />
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-3 py-2">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="pickup_scheduled">Pickup Scheduled</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="refund_completed">Refund Completed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="border rounded-lg px-3 py-2">
          {[10,25,50].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button onClick={fetchList} disabled={loading} className="px-3 py-2 rounded-lg border">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded-xl">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Return ID</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Refund</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t">
                <td className="px-3 py-2 font-mono">{r._id.slice(-8)}</td>
                <td className="px-3 py-2">#{r.order?.orderNumber || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.user?.name || '—'}</span>
                    <span className="text-xs text-gray-500">{r.user?.email || ''}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium capitalize">{r.reasonType || '—'}</span>
                    {r.reasonNote && <span className="text-xs text-gray-500">{r.reasonNote}</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs text-gray-700">
                    {r.items?.map((it, i) => (
                      <div key={i}>• {it.name || it.productId} × {it.quantity}</div>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">{money(r.refundAmount, r.currency || 'INR')}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${pill(r.status)}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2">{fmt(r.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button className="px-2 py-1 rounded bg-emerald-600 text-white" onClick={() => doDecision(r._id, 'approve')}>Approve</button>
                        <button className="px-2 py-1 rounded bg-rose-600 text-white" onClick={() => doDecision(r._id, 'reject')}>Reject</button>
                      </>
                    )}
                    {['approved','pickup_scheduled','in_transit'].includes(r.status) && (
                      <button className="px-2 py-1 rounded bg-indigo-600 text-white" onClick={() => doReceived(r._id)}>Mark Received</button>
                    )}
                    {['received','refund_initiated'].includes(r.status) && (
                      <button className="px-2 py-1 rounded bg-gray-900 text-white" onClick={() => doRefund(r._id)}>Refund</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No returns found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {page} / {totalPages} • {total} total
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded" onClick={() => setPage(1)} disabled={page===1}>First</button>
          <button className="px-3 py-2 border rounded" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</button>
          <button className="px-3 py-2 border rounded" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next</button>
          <button className="px-3 py-2 border rounded" onClick={() => setPage(totalPages)} disabled={page===totalPages}>Last</button>
        </div>
      </div>
    </div>
  );
};

export default ReturnProduct;
