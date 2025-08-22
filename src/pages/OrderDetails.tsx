// src/pages/OrderDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import api from '../config/api';
import {
  ArrowLeftIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CreditCardIcon,
  MapPinIcon,
  ShoppingBagIcon,
  PrinterIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/solid';

// Types
interface OrderItem {
  productId: string;
  name: string;
  quantity: number | string;
  price: number | string;
  image?: string;
}
interface Address {
  fullName: string;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}
interface OrderDetails {
  _id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: 'razorpay' | 'cod';
  paymentOrderId: string;
  paymentId?: string;
  paymentSignature?: string;
  subtotal: number | string;
  tax: number | string;
  shipping: number | string;
  total: number | string;
  // optional alternates some backends use:
  shippingFee?: number | string;
  shippingCost?: number | string;
  deliveryCharge?: number | string;
  taxes?: number | string;
  gst?: number | string;
  vat?: number | string;
  taxRate?: number | string;
  gstPercent?: number | string;

  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderStatus: string;
  paymentStatus: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: string;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

const fade = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
};

const ORDER_FLOW: OrderDetails['status'][] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

/* -------------------- helpers: robust numeric + money utils -------------------- */
const toNum = (v: any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    // remove currency symbols, commas, spaces, any non digit/.- chars
    const cleaned = v.replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

/* Derive a reliable breakdown no matter how the backend sends numbers */
function deriveBreakdown(o: OrderDetails) {
  const itemsSubtotal = (o.items || []).reduce((sum, it) => {
    const q = toNum(it.quantity);
    const p = toNum(it.price);
    return sum + q * p;
  }, 0);

  // Known values from order / alternates
  let subtotal = toNum(o.subtotal) || itemsSubtotal;
  let shippingKnown =
    toNum((o as any).shipping) ||
    toNum((o as any).shippingFee) ||
    toNum((o as any).shippingCost) ||
    toNum((o as any).deliveryCharge);
  let taxKnown =
    toNum((o as any).tax) ||
    toNum((o as any).taxes) ||
    toNum((o as any).gst) ||
    toNum((o as any).vat);
  const totalKnown = toNum(o.total);

  // If a percentage is provided (order or item-level), prefer that for tax
  const taxRatePct =
    toNum((o as any).taxRate) ||
    toNum((o as any).gstPercent) ||
    0;

  if (taxKnown === 0 && taxRatePct > 0) {
    taxKnown = +(itemsSubtotal * (taxRatePct / 100)).toFixed(2);
  }

  // If still missing, try to back-solve from total
  if (totalKnown > 0) {
    // 1) have tax, missing shipping
    if (shippingKnown === 0 && taxKnown > 0) {
      const s = totalKnown - subtotal - taxKnown;
      shippingKnown = Math.max(0, +s.toFixed(2));
    }
    // 2) have shipping, missing tax
    else if (taxKnown === 0 && shippingKnown > 0) {
      const t = totalKnown - subtotal - shippingKnown;
      taxKnown = Math.max(0, +t.toFixed(2));
    }
    // 3) both missing; assign entire remainder to shipping by default
    else if (shippingKnown === 0 && taxKnown === 0) {
      const rest = totalKnown - subtotal;
      // If a tax rate isn’t known, we can’t split confidently. Prefer “shipping = rest”.
      shippingKnown = Math.max(0, +rest.toFixed(2));
      taxKnown = 0;
      // If you prefer a different rule, change here (e.g., try 18% tax if your store uses fixed GST).
    }
  } else {
    // No total given → rebuild total from parts we know
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
  if (!s) return 'N/A';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const pillColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'paid':
    case 'cod_paid':
      return 'text-emerald-700 bg-emerald-100';
    case 'shipped':
    case 'processing':
      return 'text-indigo-700 bg-indigo-100';
    case 'pending':
    case 'awaiting_payment':
    case 'cod_pending':
      return 'text-amber-700 bg-amber-100';
    case 'cancelled':
    case 'failed':
      return 'text-rose-700 bg-rose-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
};

const statusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'paid':
      return <CheckCircleIcon className="w-4 h-4" />;
    case 'shipped':
      return <TruckIcon className="w-4 h-4" />;
    case 'processing':
      return <ClockIcon className="w-4 h-4" />;
    case 'cancelled':
    case 'failed':
      return <XCircleIcon className="w-4 h-4" />;
    default:
      return <ClockIcon className="w-4 h-4" />;
  }
};

const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) fetchOrderDetails(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchOrderDetails = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/orders/${id}`);

      let orderData: any = null;
      if (response.data) {
        if (response.data.success && response.data.order) orderData = response.data.order;
        else if (response.data.order) orderData = response.data.order;
        else if (response.data._id || response.data.orderNumber) orderData = response.data;
      }

      if (orderData?._id) {
        setOrder(orderData as OrderDetails);
      } else {
        setError('Order not found - Invalid response format');
      }
    } catch (err: any) {
      if (err?.response?.status === 404) setError('Order not found');
      else if (err?.response?.status === 401) setError('Access denied - Please log in');
      else setError(err?.response?.data?.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const onPrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 w-full max-w-md text-center"
          initial="hidden"
          animate="visible"
          variants={fade}
        >
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-gray-900 border-t-transparent animate-spin" />
          <div className="text-sm text-gray-600">Loading order…</div>
          {orderId && <div className="text-xs text-gray-400 mt-1">#{orderId}</div>}
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 w-full max-w-md text-center"
          initial="hidden"
          animate="visible"
          variants={fade}
        >
          <XCircleIcon className="w-12 h-12 text-rose-600 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Something went wrong</div>
          <div className="text-sm text-gray-600 mt-1">{error}</div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => fetchOrderDetails(orderId!)}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-black"
            >
              Try again
            </button>
            <button
              onClick={() => navigate('/profile?tab=orders')}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-900"
            >
              Back to Orders
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 w-full max-w-md text-center"
          initial="hidden"
          animate="visible"
          variants={fade}
        >
          <div className="text-5xl mb-2">📦</div>
          <div className="font-semibold text-gray-900">No order data</div>
          <button
            onClick={() => navigate('/profile?tab=orders')}
            className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-black"
          >
            Back to Orders
          </button>
        </motion.div>
      </div>
    );
  }

  // Use robust derived values everywhere we show money
  const breakdown = deriveBreakdown(order);

  const isCancelled = order.status === 'cancelled';
  const currentStep = isCancelled ? -1 : Math.max(0, ORDER_FLOW.indexOf(order.status));
  const showTracking = order.trackingUrl || order.trackingNumber;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Summary */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6"
          initial="hidden"
          animate="visible"
          variants={fade}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/profile?tab=orders')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div>
                <div className="text-lg md:text-xl font-semibold text-gray-900">
                  Order <span className="font-mono">#{order.orderNumber}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Placed on {niceDate(order.createdAt)} • {order.paymentMethod.toUpperCase()}
                  {showTracking && (
                    <>
                      {' '}•{' '}
                      {order.trackingUrl ? (
                        <a
                          className="underline underline-offset-2"
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Track package
                        </a>
                      ) : (
                        <Link className="underline underline-offset-2" to={`/track-order/${order.trackingNumber}`}>
                          Track package
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                <PrinterIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Print</span>
              </button>
              <button
                onClick={() => navigate('/profile?tab=support')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
              >
                <ChatBubbleLeftIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Support</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={clsx('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium', pillColor(order.status))}>
              {statusIcon(order.status)}
              <span className="capitalize">{order.status}</span>
            </span>
            <span className={clsx('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium', pillColor(order.paymentStatus))}>
              <CreditCardIcon className="w-4 h-4" />
              {order.paymentStatus.replace('_', ' ')}
            </span>
            {order.estimatedDelivery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-indigo-700 bg-indigo-100">
                <TruckIcon className="w-4 h-4" />
                ETA: {niceDate(order.estimatedDelivery)}
              </span>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 md:gap-3">
              {isCancelled ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                  <XCircleIcon className="w-4 h-4" />
                  Order cancelled {order.cancelledAt ? `on ${niceDate(order.cancelledAt)}` : ''}
                </div>
              ) : (
                ORDER_FLOW.map((s, i) => {
                  const done = i <= currentStep;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold',
                        done ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600')}>
                        {i + 1}
                      </div>
                      {i < ORDER_FLOW.length - 1 && (
                        <div className={clsx('h-0.5 w-6 md:w-12 rounded', done ? 'bg-gray-900' : 'bg-gray-200')} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

        {/* Items + Summary */}
        <motion.div
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6"
          initial="hidden"
          animate="visible"
          variants={fade}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBagIcon className="w-5 h-5 text-gray-900" />
              <h2 className="text-lg font-semibold text-gray-900">Items</h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-gray-900">{inr(breakdown.total)}</div>
              <div className="text-xs text-gray-500 text-right">
                {order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={`${item.productId}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={String(item.name)} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBagIcon className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{item.name}</div>
                  <div className="text-xs text-gray-500">
                    Qty {toNum(item.quantity)} × {inr(toNum(item.price))}
                  </div>
                </div>
                <div className="text-right font-semibold text-gray-900">
                  {inr(toNum(item.quantity) * toNum(item.price))}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{inr(breakdown.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{inr(breakdown.tax)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{inr(breakdown.shipping)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>{inr(breakdown.total)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Addresses & Payment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shipping */}
          <motion.div
            className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6"
            initial="hidden"
            animate="visible"
            variants={fade}
            transition={{ delay: 0.08 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPinIcon className="w-5 h-5 text-gray-900" />
              <h3 className="font-semibold text-gray-900">Shipping address</h3>
            </div>
            <div className="text-sm text-gray-800 space-y-1">
              <div className="font-medium">{order.shippingAddress.fullName}</div>
              <div>{order.shippingAddress.addressLine1}</div>
              {order.shippingAddress.addressLine2 && <div>{order.shippingAddress.addressLine2}</div>}
              <div>
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
              </div>
              <div className="text-gray-600 mt-2">
                <div>📞 {order.shippingAddress.phoneNumber}</div>
                <div>📧 {order.shippingAddress.email}</div>
              </div>
            </div>
          </motion.div>

          {/* Payment */}
          <motion.div
            className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6"
            initial="hidden"
            animate="visible"
            variants={fade}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CreditCardIcon className="w-5 h-5 text-gray-900" />
              <h3 className="font-semibold text-gray-900">Payment</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Method</span>
                <span className="font-medium uppercase">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <span className={clsx('px-2 py-1 rounded text-xs font-medium', pillColor(order.paymentStatus))}>
                  {order.paymentStatus.replace('_', ' ')}
                </span>
              </div>
              {order.paymentId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID</span>
                  <span className="font-mono text-xs">{order.paymentId}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid at</span>
                  <span>{niceDate(order.paidAt)}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsPage;
