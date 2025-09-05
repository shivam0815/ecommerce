// src/pages/OrderSuccess.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, CreditCard, Truck, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../config/api'; // your axios instance

type Order = {
  _id: string;
  total: number;
  paymentMethod?: string;
  items: Array<{
    productId: { name: string; image?: string } | string;
    quantity: number;
    price: number;
  }>;
};

const OrderSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (location.state || {}) as {
    order?: Order;
    paymentId?: string | null;
    paymentMethod?: 'cod' | 'razorpay' | 'stripe' | string;
  };

  const [order, setOrder] = useState<Order | null>(initial.order ?? null);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(initial.paymentMethod);
  const [redirectTimer, setRedirectTimer] = useState(10);

  // Try to recover from query params (e.g., Stripe) or localStorage
  useEffect(() => {
    const url = new URL(window.location.href);
    const gateway = url.searchParams.get('gateway');      // 'stripe' expected
    const orderId = url.searchParams.get('orderId');      // if you append it in successUrl
    const sessionId = url.searchParams.get('session_id'); // Stripe default if you use it

    const fromStorage = localStorage.getItem('lastOrderSuccess');

    (async () => {
      if (order) {
        // already have it
        localStorage.setItem('lastOrderSuccess', JSON.stringify({
          order, paymentMethod, paymentId: initial.paymentId ?? null
        }));
        return;
      }

      if (fromStorage) {
        try {
          const parsed = JSON.parse(fromStorage);
          if (parsed?.order?._id) {
            setOrder(parsed.order);
            setPaymentMethod(parsed.paymentMethod);
            return;
          }
        } catch {}
      }

      // Option A: If you return with orderId in success URL, fetch it:
      if (orderId) {
        try {
          const { data } = await api.get(`/orders/${orderId}`);
          setOrder(data);
          setPaymentMethod(gateway ?? data.paymentMethod);
          localStorage.setItem('lastOrderSuccess', JSON.stringify({
            order: data, paymentMethod: gateway ?? data.paymentMethod, paymentId: null
          }));
          return;
        } catch {}
      }

      // Option B: If using Stripe session_id, let server resolve to order:
      if (sessionId) {
        try {
          const { data } = await api.get(`/payments/stripe/session/${sessionId}`);
          // expect { order, paymentMethod }
          setOrder(data.order);
          setPaymentMethod(data.paymentMethod || 'stripe');
          localStorage.setItem('lastOrderSuccess', JSON.stringify({
            order: data.order, paymentMethod: data.paymentMethod || 'stripe', paymentId: data.paymentId || null
          }));
          return;
        } catch {}
      }

      // Nothing found → go home
      navigate('/', { replace: true });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown → /orders
  useEffect(() => {
    if (!order) return;
    const t = setInterval(() => setRedirectTimer((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [order]);

  useEffect(() => {
    if (redirectTimer === 0) navigate('/orders', { replace: true });
  }, [redirectTimer, navigate]);

  if (!order) return null;

  // naive ETA: +5 days
  const estimatedDelivery = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }, []);

  return (
    <motion.div className="min-h-screen bg-gray-50 py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35 }} className="bg-white rounded-lg shadow-sm p-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          </motion.div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h1>
          <p className="text-gray-600 mb-4">Thank you for your purchase. Your order has been confirmed.</p>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-700 mb-8">
            <Calendar className="h-4 w-4" />
            Estimated Delivery: <span className="font-medium">{estimatedDelivery}</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Order ID</p>
                <p className="font-semibold">#{order._id?.slice(-8)}</p>
              </div>
              <div>
                <CreditCard className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold capitalize">
                  {paymentMethod === 'cod' ? 'Cash on Delivery' : (paymentMethod || order.paymentMethod || 'Online')}
                </p>
              </div>
              <div>
                <Truck className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="font-semibold">₹{Number(order.total || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Order Items</h3>
            <div className="space-y-4">
              {order.items?.map((item: any, i: number) => {
                const p = item.productId && typeof item.productId === 'object' ? item.productId : {};
                return (
                  <div key={i} className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-3">
                      {p?.image ? (
                        <img src={p.image} alt={p.name || 'Product'} className="w-12 h-12 object-cover rounded" />
                      ) : null}
                      <div>
                        <p className="font-medium">{p?.name || 'Product'}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold">₹{Number(item.price * item.quantity).toLocaleString('en-IN')}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/orders')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
              Track Order
            </button>
            <button onClick={() => navigate('/products')} className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700">
              Continue Shopping
            </button>
          </div>

          {paymentMethod === 'cod' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                💰 <strong>Cash on Delivery:</strong> Please keep ₹{Number(order.total || 0).toLocaleString('en-IN')} ready.
              </p>
            </div>
          )}

          <p className="text-gray-500 text-sm mt-6">
            Redirecting to your orders page in {redirectTimer} seconds...
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OrderSuccess;
