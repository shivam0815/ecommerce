// src/components/Profile/ReturnsTab.tsx
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { getMyReturns, cancelMyReturn } from '../../config/api';

const pill = (s: string) => {
  const m: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-rose-100 text-rose-700',
    received: 'bg-indigo-100 text-indigo-700',
    refund_completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-700',
  };
  return m[s] || 'bg-gray-100 text-gray-700';
};

const ReturnsTab: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyReturns();
      setRows(res.returns || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCancel = async (id: string) => {
    if (!confirm('Cancel this return request?')) return;
    await cancelMyReturn(id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Your Returns</h3>
        <button onClick={load} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">Refresh</button>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-600">You have no return requests.</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">Return ID</th>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-right p-3">Refund</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-gray-100">
                  <td className="p-3 font-medium text-gray-900">#{String(r._id).slice(-6)}</td>
                  <td className="p-3">#{r?.order?.orderNumber || String(r.order).slice(-6)}</td>
                  <td className="p-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', pill(r.status))}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 capitalize">{r.reasonType}</td>
                  <td className="p-3 text-right">₹{Number(r.refundAmount || 0).toFixed(2)}</td>
                  <td className="p-3 text-right">
                    {['pending','approved'].includes(r.status) ? (
                      <button onClick={() => onCancel(r._id)} className="text-rose-600 hover:underline">Cancel</button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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

export default ReturnsTab;
