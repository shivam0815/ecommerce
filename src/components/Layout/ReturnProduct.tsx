import React, { useEffect, useState } from 'react';
import {
  adminGetReturns,
  adminGetReturnById,
  adminReturnDecision,
  adminReturnMarkReceived,
  adminReturnRefund
} from '../../config/adminApi';

const statusColor: Record<string,string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  rejected: 'bg-rose-50 text-rose-700',
  received: 'bg-indigo-50 text-indigo-700',
  refund_completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-50 text-gray-700'
};

const ReturnProduct: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [drawer, setDrawer] = useState<{open:boolean; data?:any}>({open:false});
  const [note, setNote] = useState('');
  const [refundRef, setRefundRef] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminGetReturns({ status, page, limit: 20 });
      setRows(res.returns || []);
      setTotalPages(res.totalPages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, page]);

  const open = async (id: string) => {
    const res = await adminGetReturnById(id);
    setDrawer({ open: true, data: res.returnRequest });
    setNote('');
    setRefundRef('');
  };

  const actApprove = async () => {
    if (!drawer.data) return;
    await adminReturnDecision(drawer.data._id, { action: 'approve', adminNote: note });
    await load(); await open(drawer.data._id);
  };
  const actReject = async () => {
    if (!drawer.data) return;
    if (!confirm('Reject this return?')) return;
    await adminReturnDecision(drawer.data._id, { action: 'reject', adminNote: note });
    await load(); setDrawer({open:false});
  };
  const actReceived = async () => {
    if (!drawer.data) return;
    await adminReturnMarkReceived(drawer.data._id, { note });
    await load(); await open(drawer.data._id);
  };
  const actRefund = async () => {
    if (!drawer.data) return;
    await adminReturnRefund(drawer.data._id, { method: 'original', reference: refundRef });
    await load(); await open(drawer.data._id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Returns</h2>
        <div className="flex gap-2">
          <select className="border rounded-lg p-2" value={status} onChange={e=>{setStatus(e.target.value); setPage(1);}}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="refund_completed">Refunded</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={load} className="px-3 py-2 border rounded-lg">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-gray-600">No returns.</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Return</th>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Refund</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r:any)=>(
                <tr key={r._id} className="border-t">
                  <td className="p-3 font-medium">#{String(r._id).slice(-6)}</td>
                  <td className="p-3">#{r?.order?.orderNumber || String(r.order).slice(-6)}</td>
                  <td className="p-3">{r?.user?.name} <span className="text-gray-500 text-xs">{r?.user?.email}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColor[r.status] || 'bg-gray-50'}`}>{r.status.replace('_',' ')}</span></td>
                  <td className="p-3 text-right">₹{Number(r.refundAmount).toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <button onClick={()=>open(r._id)} className="text-gray-900 hover:underline">Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* simple pagination */}
          <div className="flex items-center justify-end p-3 gap-2">
            <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-2 py-1 border rounded">Prev</button>
            <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded">Next</button>
          </div>
        </div>
      )}

      {/* Drawer / Side panel */}
      {drawer.open && drawer.data && (
        <div className="fixed inset-0 bg-black/30 z-[100]">
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Return #{String(drawer.data._id).slice(-6)}</h3>
              <button onClick={()=>setDrawer({open:false})}>✕</button>
            </div>

            <div className="space-y-4">
              <div className="text-sm">
                <div><span className="text-gray-500">Order:</span> #{drawer.data?.order?.orderNumber || String(drawer.data.order).slice(-6)}</div>
                <div><span className="text-gray-500">User:</span> {drawer.data?.user?.name} ({drawer.data?.user?.email})</div>
                <div><span className="text-gray-500">Status:</span> {drawer.data.status}</div>
                <div><span className="text-gray-500">Reason:</span> {drawer.data.reasonType} — {drawer.data.reasonNote || '—'}</div>
                <div><span className="text-gray-500">Refund:</span> ₹{Number(drawer.data.refundAmount).toFixed(2)}</div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Items</h4>
                <div className="border rounded-lg divide-y">
                  {drawer.data.items.map((it:any, idx:number)=>(
                    <div key={idx} className="p-3 text-sm flex items-center justify-between">
                      <div className="font-medium">{it.name || String(it.productId).slice(-6)}</div>
                      <div>x{it.quantity} @ ₹{it.unitPrice}</div>
                    </div>
                  ))}
                </div>
              </div>

              {drawer.data.images?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Photos</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {drawer.data.images.map((u:string, i:number)=>(
                      <a href={u} target="_blank" key={i} className="block">
                        <img src={u} className="w-full h-24 object-cover rounded-md border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Note</label>
                <textarea className="w-full border rounded-lg p-2 text-sm" rows={3} value={note} onChange={e=>setNote(e.target.value)} />
              </div>

              <div className="flex flex-wrap gap-2">
                {drawer.data.status === 'pending' && (
                  <>
                    <button onClick={actApprove} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Approve</button>
                    <button onClick={actReject} className="px-4 py-2 rounded-lg bg-rose-600 text-white">Reject</button>
                  </>
                )}
                {['approved','in_transit','pickup_scheduled'].includes(drawer.data.status) && (
                  <button onClick={actReceived} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Mark Received</button>
                )}
                {['received','refund_initiated'].includes(drawer.data.status) && (
                  <div className="flex items-center gap-2">
                    <input
                      className="border rounded-lg p-2 text-sm"
                      placeholder="Transaction ref"
                      value={refundRef}
                      onChange={e=>setRefundRef(e.target.value)}
                    />
                    <button onClick={actRefund} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">Mark Refunded</button>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">History</h4>
                <div className="border rounded-lg divide-y text-xs">
                  {drawer.data.history?.map((h:any, idx:number)=>(
                    <div key={idx} className="p-2 flex items-center justify-between">
                      <div>{h.action}{h.note ? ` — ${h.note}` : ''}</div>
                      <div className="text-gray-500">{new Date(h.at).toLocaleString()}</div>
                    </div>
                  )) || <div className="p-2 text-gray-500">—</div>}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnProduct;
