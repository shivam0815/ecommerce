// src/components/Profile/ReturnRequestModal.tsx
import React, { useState } from 'react';
import { createReturn } from '../../config/api';

type Reason = 'damaged' | 'wrong_item' | 'not_as_described' | 'defective' | 'no_longer_needed' | 'other';

const reasons: { key: Reason; label: string }[] = [
  { key: 'damaged', label: 'Damaged item' },
  { key: 'wrong_item', label: 'Wrong item received' },
  { key: 'not_as_described', label: 'Not as described' },
  { key: 'defective', label: 'Defective / not working' },
  { key: 'no_longer_needed', label: 'No longer needed' },
  { key: 'other', label: 'Other' },
];

const ReturnRequestModal: React.FC<{
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ order, onClose, onSuccess }) => {
  const [reasonType, setReasonType] = useState<Reason>('damaged');
  const [reasonNote, setReasonNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const obj: Record<string, number> = {};
    (order.items || []).forEach((it: any) => (obj[it._id] = Math.min(1, it.quantity || 1)));
    return obj;
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const items = (order.items || [])
      .filter((it: any) => (quantities[it._id] || 0) > 0)
      .map((it: any) => ({
        productId: it.productId || it.product?._id,
        orderItemId: it._id,
        quantity: Number(quantities[it._id]),
        reason: reasonNote?.slice(0, 300),
      }));

    if (items.length === 0) {
      alert('Pick at least one item to return');
      return;
    }

    setSubmitting(true);
    try {
      await createReturn({
        orderId: order._id,
        items,
        reasonType,
        reasonNote,
        images: files.slice(0, 6),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to create return');
    } finally {
      setSubmitting(false);
    }
  };
  

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Request a Return</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">✕</button>
        </div>

        <div className="p-5 space-y-6">
          {/* Items selector */}
          <div>
            <h4 className="font-medium mb-2">Items</h4>
            <div className="space-y-3">
              {(order.items || []).map((it: any) => (
                <div key={it._id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
                  <div className="w-12 h-12 bg-white border border-gray-200 rounded-md overflow-hidden flex items-center justify-center">
                    {it.image ? <img src={it.image} alt={it.name} className="w-full h-full object-cover" /> : <span>📦</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-gray-500">Qty purchased: {it.quantity}</div>
                  </div>
                  <input
                    type="number"
                    className="w-20 border rounded-lg p-2 text-sm"
                    min={0}
                    max={it.quantity}
                    value={quantities[it._id] ?? 0}
                    onChange={(e) => setQuantities((p) => ({ ...p, [it._id]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <select
                className="w-full border rounded-lg p-2"
                value={reasonType}
                onChange={(e) => setReasonType(e.target.value as any)}
              >
                {reasons.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <input
                className="w-full border rounded-lg p-2"
                placeholder="Explain the issue…"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                maxLength={300}
              />
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium mb-1">Photos (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && <div className="text-xs text-gray-500 mt-1">{files.length} selected</div>}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-gray-900 text-white rounded-lg">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>

        <div className="px-5 py-4 bg-gray-50 text-xs text-gray-600">
          By submitting, you agree to our returns policy (return window {process.env.RETURN_WINDOW_DAYS || 7} days).
        </div>
      </div>
    </div>
  );
};

export default ReturnRequestModal;
