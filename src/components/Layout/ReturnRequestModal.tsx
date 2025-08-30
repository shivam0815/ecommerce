// src/components/Profile/ReturnRequestModal.tsx
import React, { useMemo, useState } from 'react';
import { createReturn } from '../../config/api';

type Reason =
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'defective'
  | 'no_longer_needed'
  | 'other';

const reasons: { key: Reason; label: string }[] = [
  { key: 'damaged', label: 'Damaged item' },
  { key: 'wrong_item', label: 'Wrong item received' },
  { key: 'not_as_described', label: 'Not as described' },
  { key: 'defective', label: 'Defective / not working' },
  { key: 'no_longer_needed', label: 'No longer needed' },
  { key: 'other', label: 'Other' },
];

const RETURN_WINDOW_DAYS = Number(import.meta.env.VITE_RETURN_WINDOW_DAYS ?? 7);

const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;

// ----- helpers to be resilient to varying order.item shapes -----
const getItemKey = (it: any, idx: number) =>
  it?._id || it?.id || it?.orderItemId || it?.productId || String(idx);

const getProductId = (it: any) =>
  it?.productId ||
  it?.product?._id ||
  it?.product?.id ||
  (typeof it?.product === 'string' ? it.product : undefined);

const ReturnRequestModal: React.FC<{
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ order, onClose, onSuccess }) => {
  const [reasonType, setReasonType] = useState<Reason>('damaged');
  const [reasonNote, setReasonNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // quantities keyed using robust key (not just _id)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const obj: Record<string, number> = {};
    (order?.items || []).forEach((it: any, idx: number) => {
      const key = getItemKey(it, idx);
      const purchased = Number(it?.quantity || 1);
      obj[key] = Math.min(1, purchased);
    });
    return obj;
  });

  const totalSelected = useMemo(
    () =>
      (order?.items || []).reduce((sum: number, it: any, idx: number) => {
        const key = getItemKey(it, idx);
        return sum + (Number(quantities[key]) || 0);
      }, 0),
    [order?.items, quantities]
  );

  const onPickFiles: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;

    const errs: string[] = [];
    const valid: File[] = [];

    const all = [...files, ...picked].slice(0, MAX_IMAGES);
    all.forEach((f) => {
      if (!ALLOWED_TYPES.includes(f.type as any)) {
        errs.push(`${f.name}: unsupported type`);
      } else if (f.size > MAX_IMAGE_SIZE) {
        errs.push(`${f.name}: exceeds 5MB`);
      } else {
        valid.push(f);
      }
    });

    if (errs.length) alert(errs.join('\n'));
    setFiles(valid.slice(0, MAX_IMAGES));
  };

  const submit = async () => {
    if (!order?._id) {
      alert('Order is missing. Please reload and try again.');
      return;
    }

    // Build items payload using robust key + robust productId
    const items = (order?.items || [])
      .map((it: any, idx: number) => {
        const key = getItemKey(it, idx);
        const productId = getProductId(it);
        const q = Number(quantities[key] || 0);
        return productId
          ? {
              productId,
              orderItemId: it?._id || it?.id || it?.orderItemId, // optional
              quantity: q,
              // Optional per-item note could be added later
            }
          : null;
      })
      .filter((x: any) => x && x.quantity > 0) as {
      productId: string;
      orderItemId?: string;
      quantity: number;
    }[];

    if (items.length === 0) {
      alert('Pick at least one item to return (quantity > 0).');
      return;
    }

    try {
      await createReturn({
        orderId: order._id,
        items,
        reasonType,
        reasonNote: reasonNote.trim(),
        images: files.slice(0, MAX_IMAGES),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Failed to create return';
      alert(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Request a Return</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Items */}
          <div>
            <h4 className="font-medium mb-2">Items</h4>
            <div className="space-y-3">
              {(order?.items || []).map((it: any, idx: number) => {
                const key = getItemKey(it, idx);
                const maxQ = Number(it?.quantity || 1);
                const value = Number(quantities[key] ?? 0);
                return (
                  <div key={key} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-md overflow-hidden flex items-center justify-center">
                      {it?.image ? (
                        <img src={it.image} alt={it?.name || 'Item'} className="w-full h-full object-cover" />
                      ) : (
                        <span>📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{it?.name || 'Item'}</div>
                      <div className="text-xs text-gray-500">Qty purchased: {maxQ}</div>
                    </div>
                    <input
                      type="number"
                      className="w-24 border rounded-lg p-2 text-sm"
                      min={0}
                      max={maxQ}
                      step={1}
                      value={Number.isFinite(value) ? value : 0}
                      onChange={(e) =>
                        setQuantities((p) => ({
                          ...p,
                          [key]: Math.max(0, Math.min(maxQ, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-500 mt-1">Selected total: {totalSelected}</div>
          </div>

          {/* Reason & note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <select
                className="w-full border rounded-lg p-2"
                value={reasonType}
                onChange={(e) => setReasonType(e.target.value as Reason)}
              >
                {reasons.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
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
              <div className="text-[11px] text-gray-400 mt-1">{reasonNote.length}/300</div>
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium mb-1">Photos (optional)</label>
            <input type="file" accept={ALLOWED_TYPES.join(',')} multiple onChange={onPickFiles} />
            <div className="text-xs text-gray-500 mt-1">
              Up to {MAX_IMAGES} images, JPG/PNG/WebP, max 5MB each.
              {files.length > 0 && <span className="ml-2">{files.length} selected</span>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={totalSelected === 0}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-60"
            >
              Submit Request
            </button>
          </div>
        </div>

        <div className="px-5 py-4 bg-gray-50 text-xs text-gray-600">
          By submitting, you agree to our returns policy (return window {RETURN_WINDOW_DAYS} days).
        </div>
      </div>
    </div>
  );
};

export default ReturnRequestModal;
