// src/pages/OrderSuccess.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  CalendarIcon,
  ShoppingBagIcon,
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
} from '@heroicons/react/24/solid';

type SuccessState = {
  order?: any;
  orderId?: string | null;
  paymentMethod?: 'razorpay' | 'cod';
  paymentId?: string | null;
};

const fade = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
};

/* -------------------- helpers: robust numeric + money utils -------------------- */
const toNum = (v: any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

/* Derive a reliable breakdown no matter how the backend sends numbers */
function deriveBreakdown(o: any) {
  const items: any[] = o?.items || [];
  const itemsSubtotal = items.reduce((sum, it) => {
    const q = toNum(it?.quantity);
    const p = toNum(it?.price);
    return sum + q * p;
  }, 0);

  let subtotal = toNum(o?.subtotal) || itemsSubtotal;
  let shippingKnown =
    toNum(o?.shipping) ||
    toNum(o?.shippingFee) ||
    toNum(o?.shippingCost) ||
    toNum(o?.deliveryCharge);
  let taxKnown =
    toNum(o?.tax) ||
    toNum(o?.taxes) ||
    toNum(o?.gst) ||
    toNum(o?.vat);

  const totalKnown = toNum(o?.total);

  if (totalKnown > 0) {
    if (shippingKnown === 0 && taxKnown > 0) {
      shippingKnown = Math.max(0, +(totalKnown - subtotal - taxKnown).toFixed(2));
    } else if (taxKnown === 0 && shippingKnown > 0) {
      taxKnown = Math.max(0, +(totalKnown - subtotal - shippingKnown).toFixed(2));
    } else if (shippingKnown === 0 && taxKnown === 0) {
      shippingKnown = Math.max(0, +(totalKnown - subtotal).toFixed(2));
      taxKnown = 0;
    }
  }

  const total =
    totalKnown > 0 ? totalKnown : Math.max(0, +(subtotal + taxKnown + shippingKnown).toFixed(2));

  return {
    subtotal: Math.max(0, +subtotal.toFixed(2)),
    tax: Math.max(0, +taxKnown.toFixed(2)),
    shipping: Math.max(0, +shippingKnown.toFixed(2)),
    total,
  };
}

const niceDate = (s?: string) => {
  const iso = s || new Date().toISOString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const isPlainEmptyObject = (obj: any) =>
  !!obj && obj.constructor === Object && Object.keys(obj).length === 0;

const coalesceOrderId = (o: any) =>
  o?.orderNumber ||
  o?._id ||
  o?.id ||
  o?.order_id ||
  o?.paymentOrderId ||
  o?.paymentId ||
  undefined;

const OrderSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const incoming = (location.state as SuccessState | null) || null;
  const [order, setOrder] = useState<any | null>(incoming?.order || null);
  const [orderId, setOrderId] = useState<string | undefined>(incoming?.orderId || undefined);

  useEffect(() => {
    const urlId = searchParams.get('id') || undefined;
    if (urlId && !orderId) setOrderId(urlId);

    if (!incoming) {
      try {
        const raw = localStorage.getItem('lastOrderSuccess');
        if (raw) {
          const parsed = JSON.parse(raw);

          // Choose snapshot when order is {} or missing
          const preferSnapshot = !parsed.order || isPlainEmptyObject(parsed.order);
          const fromStorage = preferSnapshot ? parsed.snapshot || null : parsed.order;

          // Inject the stored id if the chosen object lacks it
          if (
            fromStorage &&
            parsed.orderId &&
            !fromStorage.orderNumber &&
            !fromStorage._id &&
            !fromStorage.id &&
            !fromStorage.order_id
          ) {
            fromStorage.orderNumber = parsed.orderId;
            fromStorage._id = parsed.orderId;
          }

          setOrder(fromStorage);
          if (!orderId && parsed.orderId) setOrderId(parsed.orderId);
        }
      } catch {
        // ignore
      }
    } else {
      // keep for refresh
      localStorage.setItem('lastOrderSuccess', JSON.stringify(incoming));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolvedId = orderId || coalesceOrderId(order) || '—';
  const breakdown = useMemo(() => deriveBreakdown(order || {}), [order]);

  const items: Array<{
    name?: string;
    quantity?: number;
    price?: number;
    image?: string;
    productId?: string;
  }> = order?.items || [];

  const shipping = order?.shippingAddress || {};
  const shippingName = shipping?.fullName || shipping?.name || '—';
  const shippingPhone = shipping?.phoneNumber || shipping?.phone || '—';
  const shippingEmail = shipping?.email || '—';
  const shippingLines = [shipping?.addressLine1, shipping?.addressLine2, shipping?.landmark]
    .filter(Boolean)
    .join(', ');
  const shippingCityLine = [shipping?.city, shipping?.state, shipping?.pincode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <CheckCircleIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                Thank you! Your order is confirmed.
              </h1>
              <p className="text-white/90 mt-1">We’ve received your order details.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Card */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6"
          initial="hidden"
          animate="visible"
          variants={fade}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">Order ID</div>
              <div className="mt-1 text-xl font-bold text-gray-900 break-all">{resolvedId}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">Order Date</div>
              <div className="mt-1 flex items-center gap-2 font-medium text-gray-900">
                <CalendarIcon className="w-4 h-4 text-gray-500" />
                {niceDate(order?.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">Total Amount</div>
              <div className="mt-1 text-xl font-extrabold text-emerald-600">
                {inr(toNum(breakdown.total))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Items Card */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm"
          initial="hidden"
          animate="visible"
          variants={fade}
          transition={{ delay: 0.03 }}
        >
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <ShoppingBagIcon className="w-5 h-5 text-gray-900" />
            <h2 className="text-lg font-semibold text-gray-900">Items</h2>
          </div>

          <div className="divide-y">
            {Array.isArray(items) && items.length > 0 ? (
              items.map((it, idx) => {
                const name = it?.name || (it as any)?.product?.name || (it?.productId ? `#${it.productId}` : 'Product');
                const qty = toNum(it?.quantity);
                const price = toNum(it?.price);
                return (
                  <div key={idx} className="px-5 py-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                      {it?.image ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <img src={it.image} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBagIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{name}</div>
                      <div className="text-xs text-gray-500">Qty {qty} × {inr(price)}</div>
                    </div>
                    <div className="text-right font-semibold text-gray-900">
                      {inr(qty * price)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-6 text-gray-500 text-sm">No line items found.</div>
            )}
          </div>

          <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-t border-gray-100">
            <div className="text-sm text-gray-600">Order Total</div>
            <div className="text-lg font-extrabold text-emerald-600">
              {inr(toNum(breakdown.total))}
            </div>
          </div>
        </motion.div>

        {/* Shipping Address Card */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm"
          initial="hidden"
          animate="visible"
          variants={fade}
          transition={{ delay: 0.06 }}
        >
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Shipping Address</h3>
          </div>

          <div className="p-5 space-y-3 text-sm text-gray-800">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2 bg-blue-50 text-blue-700">
                <MapPinIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{shippingName}</div>
                <div className="text-gray-700">
                  {shippingLines || '—'}
                  {shippingLines && <>, </>}
                  {shippingCityLine || ''}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                <EnvelopeIcon className="w-4 h-4 text-gray-500" />
                <span>{shippingEmail || '—'}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                <PhoneIcon className="w-4 h-4 text-gray-500" />
                <span>{shippingPhone || '—'}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Thanks + CTA */}
        <motion.div
          className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-blue-900 text-sm flex items-center justify-between"
          initial="hidden"
          animate="visible"
          variants={fade}
          transition={{ delay: 0.09 }}
        >
          <div>Thank you for shopping with us. We'll share updates for your order on your email/phone.</div>
          <button
            onClick={() => navigate('/products')}
            className="ml-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black"
          >
            Continue Shopping
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderSuccess;
