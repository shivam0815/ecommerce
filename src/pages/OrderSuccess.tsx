// src/pages/OrderSuccess.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Calendar, ShoppingBag, MapPin, Mail, Phone } from 'lucide-react';

const formatINR = (n: number) => `₹${Math.max(0, Math.round(n || 0)).toLocaleString()}`;

type SuccessState = {
  order?: any;
  paymentMethod?: 'razorpay' | 'stripe' | 'cod';
  paymentId?: string | null;
};

const OrderSuccess: React.FC = () => {
  const location = useLocation();
  const fromState = (location.state as SuccessState | null) || null;

  const [successData, setSuccessData] = useState<SuccessState | null>(fromState);

  // Fallback so refresh still works
  useEffect(() => {
    if (!fromState) {
      try {
        const local = localStorage.getItem('lastOrderSuccess');
        if (local) setSuccessData(JSON.parse(local));
      } catch {}
    } else {
      localStorage.setItem('lastOrderSuccess', JSON.stringify(fromState));
    }
  }, [fromState]);

  const order = successData?.order || {};
  const items: Array<{
    name?: string;
    quantity?: number;
    price?: number;
    image?: string;
  }> = order?.items || order?.line_items || [];

  // ---- Real data bindings ----
  const orderId =
    order?.orderNumber ||
    order?.order_id ||
    order?.id ||
    order?._id ||
    '—';

  const orderDate = useMemo(() => {
    const iso = order?.createdAt || order?.order_date || new Date().toISOString();
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

  const shipping = order?.shippingAddress || order?.shipping || {};
  const shippingName = shipping?.fullName || shipping?.name || '—';
  const shippingPhone = shipping?.phoneNumber || shipping?.phone || order?.userPhone || '—';
  const shippingEmail = shipping?.email || order?.userEmail || '—';
  const shippingLines = [shipping?.addressLine1, shipping?.addressLine2, shipping?.landmark]
    .filter(Boolean)
    .join(', ');
  const shippingCityLine = [shipping?.city, shipping?.state, shipping?.pincode].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 sm:p-8 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                  Thank you! Your order is confirmed.
                </h1>
                <p className="text-white/90 mt-1">We’ve received your order details.</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Order facts */}
            <div className="rounded-2xl border border-gray-200 p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500">Order ID</div>
                  <div className="mt-1 text-xl font-bold text-gray-900 break-all">{orderId}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500">Order Date</div>
                  <div className="mt-1 flex items-center gap-2 font-medium text-gray-900">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    {orderDate}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500">Total Amount</div>
                  <div className="mt-1 text-xl font-extrabold text-emerald-600">
                    {formatINR(totalAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <div className="font-semibold text-gray-800">Items</div>
              </div>
              <div className="divide-y">
                {items?.length ? (
                  items.map((it, idx) => (
                    <div key={idx} className="px-5 py-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {it?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt={it.name || 'Product'} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{it?.name || 'Product'}</div>
                        <div className="text-sm text-gray-500 mt-0.5">Qty: {it?.quantity || 1}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">
                          {formatINR((it?.price || 0) * (it?.quantity || 1))}
                        </div>
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

            {/* Shipping Address + Contact */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <div className="font-semibold text-gray-800">Shipping Address</div>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2 bg-blue-50 text-blue-700">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">{shippingName}</div>
                    <div className="text-gray-700">
                      {shippingLines || '—'}
                      {shippingLines && <>, </>}
                      {shippingCityLine || ''}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                  <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{shippingEmail || '—'}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{shippingPhone || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Short note */}
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-blue-900 text-sm">
              Thank you for shopping with us. We’ll share updates for your order on your email/phone.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
