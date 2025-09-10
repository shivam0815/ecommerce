// src/pages/OrderSuccess.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Calendar, ShoppingBag, MapPin, Mail, Phone } from 'lucide-react';

type SuccessState = {
  order?: any;                      // full order from backend (preferred)
  orderId?: string | null;          // explicit id if you sent it on navigate
  paymentMethod?: 'razorpay' | 'cod';
  paymentId?: string | null;
};

const formatINR = (n: number) => `₹${Math.max(0, Math.round(Number(n) || 0)).toLocaleString()}`;

// Coalesce different possible id fields into a single displayable id
const coalesceOrderId = (o: any) =>
  o?.orderNumber || o?._id || o?.id || o?.order_id || undefined;

const OrderSuccess: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const incoming = (location.state as SuccessState | null) || null;

  // Prefer full order from navigation state; otherwise try localStorage snapshot
  const [order, setOrder] = useState<any | null>(incoming?.order || null);
  const [orderId, setOrderId] = useState<string | undefined>(
    incoming?.orderId || undefined
  );

  // On mount: pull from localStorage if needed, and read id from URL for display
  useEffect(() => {
    const urlId = searchParams.get('id') || undefined;
    if (urlId && !orderId) setOrderId(urlId);

    if (!incoming) {
      try {
        const raw = localStorage.getItem('lastOrderSuccess');
        if (raw) {
          const parsed = JSON.parse(raw);
          // If you stored a full order, use it; else use minimal snapshot
          setOrder(parsed.order || parsed.snapshot || null);
          if (!orderId && parsed.orderId) setOrderId(parsed.orderId);
        }
      } catch {}
    } else {
      // persist for refresh safety
      localStorage.setItem('lastOrderSuccess', JSON.stringify(incoming));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Mapping to YOUR fields -----
  const resolvedId =
    orderId || coalesceOrderId(order) || '—';

  const orderDate = useMemo(() => {
    const iso = order?.createdAt || new Date().toISOString();
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return '—';
    }
  }, [order?.createdAt]);

  const totalAmount =
    order?.total ?? order?.amount ?? 0;

  const items: Array<{ name?: string; quantity?: number; price?: number; image?: string; productId?: string }> =
    order?.items ?? [];

  const shipping = order?.shippingAddress || {};
  const shippingName = shipping?.fullName || shipping?.name || '—';
  const shippingPhone = shipping?.phoneNumber || shipping?.phone || '—';
  const shippingEmail = shipping?.email || '—';
  const shippingLines = [shipping?.addressLine1, shipping?.addressLine2, shipping?.landmark].filter(Boolean).join(', ');
  const shippingCityLine = [shipping?.city, shipping?.state, shipping?.pincode].filter(Boolean).join(', ');

  // Helpful logs while testing (remove later)
  useEffect(() => {
    console.log('[OrderSuccess] state:', incoming);
    console.log('[OrderSuccess] resolvedId:', resolvedId);
    console.log('[OrderSuccess] order:', order);
  }, [incoming, resolvedId, order]);

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
                  <div className="mt-1 text-xl font-bold text-gray-900 break-all">{resolvedId}</div>
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
                  <div className="mt-1 text-xl font-extrabold text-emerald-600">{formatINR(totalAmount)}</div>
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
                  items.map((it, idx) => {
                    const name = it?.name || (it as any)?.product?.name || (it?.productId ? `#${it.productId}` : 'Product');
                    const qty = it?.quantity || 1;
                    const price = it?.price || 0;
                    const lineTotal = price * qty;
                    return (
                      <div key={idx} className="px-5 py-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                          {it?.image ? (
                            // eslint-disable-next-line jsx-a11y/alt-text
                            <img src={it.image} className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{name}</div>
                          <div className="text-sm text-gray-500 mt-0.5">Qty: {qty}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">{formatINR(lineTotal)}</div>
                          <div className="text-xs text-gray-500">{formatINR(price)} each</div>
                        </div>
                      </div>
                    );
                  })
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

            {/* Short note only */}
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
