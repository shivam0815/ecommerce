// src/pages/OrderSuccess.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Printer,
  Home,
  ShoppingBag,
  ArrowRight,
  Shield,
  Wallet,
  Truck,
  Calendar,
  Receipt,
  MapPin,
} from 'lucide-react';

const formatINR = (n: number) => `₹${Math.max(0, Math.round(n || 0)).toLocaleString()}`;

type SuccessState = {
  order?: any;
  paymentMethod: 'razorpay' | 'stripe' | 'cod';
  paymentId?: string | null;
};

const OrderSuccess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as SuccessState | null) || null;

  // Fallback from localStorage if user refreshed the page
  const [successData, setSuccessData] = useState<SuccessState | null>(fromState);

  useEffect(() => {
    if (!fromState) {
      try {
        const local = localStorage.getItem('lastOrderSuccess');
        if (local) setSuccessData(JSON.parse(local));
      } catch {
        // ignore
      }
    } else {
      // Keep a copy so refresh still works
      localStorage.setItem('lastOrderSuccess', JSON.stringify(fromState));
    }
  }, [fromState]);

  const order = successData?.order || {};
  const paymentMethod = successData?.paymentMethod || 'cod';
  const paymentId = successData?.paymentId || null;

  // Try to derive friendly fields
  const orderNumber =
    order?.orderNumber || order?.order_id || order?.id || String(order?._id || '').slice(-8) || '—';
  const orderDate = useMemo(() => {
    const iso =
      order?.createdAt ||
      order?.order_date ||
      new Date().toISOString();
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return '—';
    }
  }, [order?.createdAt, order?.order_date]);

  const totalAmount =
    order?.pricing?.total ??
    order?.amount ??
    order?.total ??
    0;

  const items: Array<{
    name?: string;
    quantity?: number;
    price?: number;
    productId?: string;
    image?: string;
  }> =
    order?.items ||
    order?.line_items ||
    [];

  const shipping = order?.shippingAddress || order?.shipping || {};
  const shippingName = shipping?.fullName || shipping?.name || '—';
  const shippingPhone = shipping?.phoneNumber || shipping?.phone || '—';
  const shippingEmail = shipping?.email || '—';
  const shippingLines = [
    shipping?.addressLine1,
    shipping?.addressLine2,
    shipping?.landmark,
    shipping?.city,
    shipping?.state,
    shipping?.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadInvoice = async () => {
    // If your backend returns an invoice PDF URL on the order object, prefer that.
    // Example: const url = order?.invoiceUrl;
    // For now, fall back to print dialog (users can save as PDF).
    handlePrint();
  };

  const badgeByMethod = {
    razorpay: { label: 'Razorpay', icon: <Shield className="h-4 w-4" /> },
    stripe: { label: 'Stripe', icon: <Wallet className="h-4 w-4" /> },
    cod: { label: 'Cash on Delivery', icon: <Truck className="h-4 w-4" /> },
  } as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 print:bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top acknowledgement card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                  Thank you for your order!
                </h1>
                <p className="text-white/90 mt-1">
                  Your order is confirmed and currently being processed.
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 sm:p-8">
            {/* Row: Order summary + Payment */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Order meta */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500">Order Number</div>
                      <div className="text-xl font-bold text-gray-900">{orderNumber}</div>
                    </div>

                    <div className="hidden sm:block h-10 w-px bg-gray-200" />

                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500">Order Date</div>
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        {orderDate}
                      </div>
                    </div>

                    <div className="hidden sm:block h-10 w-px bg-gray-200" />

                    <div>
                      <div className="text-xs uppercase tracking-wider text-gray-500">Amount</div>
                      <div className="text-xl font-extrabold text-emerald-600">{formatINR(totalAmount)}</div>
                    </div>
                  </div>

                  {/* Payment badge */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-gray-500">Payment</span>
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                      {badgeByMethod[paymentMethod].icon}
                      {badgeByMethod[paymentMethod].label}
                    </span>
                    {paymentId && (
                      <span className="text-xs text-gray-500">• Ref: <span className="font-medium">{paymentId}</span></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-gray-200 p-5 h-full">
                  <div className="font-semibold text-gray-900 mb-3">What’s next?</div>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex gap-2">
                      <Receipt className="h-4 w-4 mt-0.5 text-gray-500" />
                      We’re verifying payment & preparing your items.
                    </li>
                    <li className="flex gap-2">
                      <Truck className="h-4 w-4 mt-0.5 text-gray-500" />
                      You’ll receive tracking info once shipped.
                    </li>
                  </ul>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      onClick={handleDownloadInvoice}
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold"
                    >
                      <Download className="h-4 w-4" />
                      Invoice
                    </button>
                    <button
                      onClick={handlePrint}
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-black font-semibold"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <button
                      onClick={() => navigate('/orders')}
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      View My Orders
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-semibold"
                    >
                      <Home className="h-4 w-4" />
                      Continue Shopping
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Items & Shipping */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Items */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                    <div className="font-semibold text-gray-800">Items in your order</div>
                  </div>

                  <div className="divide-y">
                    {items?.length ? (
                      items.map((it, idx) => (
                        <div key={idx} className="px-5 py-4 flex items-center gap-4">
                          <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                            {it?.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.image} alt={it.name || 'Product'} className="h-full w-full object-cover" />
                            ) : (
                              <ShoppingBag className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{it?.name || 'Product'}</div>
                            <div className="text-sm text-gray-500 mt-0.5">Qty: {it?.quantity || 1}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{formatINR((it?.price || 0) * (it?.quantity || 1))}</div>
                            <div className="text-xs text-gray-500">{formatINR(it?.price || 0)} each</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-5 py-6 text-gray-500 text-sm">No line items found.</div>
                    )}
                  </div>

                  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between">
                    <div className="text-sm text-gray-600">Order Total</div>
                    <div className="text-lg font-extrabold text-emerald-600">{formatINR(totalAmount)}</div>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                    <div className="font-semibold text-gray-800">Shipping Address</div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full p-2 bg-blue-50 text-blue-700">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="text-sm">
                        <div className="font-semibold text-gray-900">{shippingName}</div>
                        <div className="text-gray-700">{shippingLines || '—'}</div>
                        <div className="mt-2 text-gray-500">Phone: {shippingPhone}</div>
                        {shippingEmail && <div className="text-gray-500">Email: {shippingEmail}</div>}
                      </div>
                    </div>
                    <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      We’ll add shipping charges (if any) after packing and share the final invoice & tracking link on your email/phone.
                    </div>
                  </div>
                </div>

                {/* Status pill */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Order Confirmed
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    Next: Processing <ArrowRight className="h-3 w-3" /> Packing <ArrowRight className="h-3 w-3" /> Shipping
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-sm text-blue-900">
                  You’ll receive updates by SMS/Email/WhatsApp. For any help, reply to your order confirmation or contact support.
                </div>
                <button
                  onClick={() => navigate('/support')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 font-semibold"
                >
                  <Shield className="h-4 w-4" />
                  Get Support
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Back home CTA */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white hover:bg-black font-semibold"
          >
            <Home className="h-4 w-4" />
            Go to Homepage
          </button>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 text-gray-800 hover:bg-gray-50 font-semibold"
          >
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
