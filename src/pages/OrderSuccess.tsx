import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, CreditCard, Truck, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const OrderSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { order, paymentId, paymentMethod } = location.state || {};
  const [redirectTimer, setRedirectTimer] = useState(10);

  useEffect(() => {
    if (!order) {
      navigate('/');
      return;
    }

    // Countdown timer for auto redirect
    const timer = setInterval(() => {
      setRedirectTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [order, navigate]);

  useEffect(() => {
    if (redirectTimer === 0) {
      navigate('/orders');
    }
  }, [redirectTimer, navigate]);

  if (!order) return null;

  // Estimated delivery date (5 days later for example)
  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

  return (
    <motion.div
      className="min-h-screen bg-gray-50 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-lg shadow-sm p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          </motion.div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Placed Successfully!
          </h1>
          <p className="text-gray-600 mb-4">
            Thank you for your purchase. Your order has been confirmed.
          </p>

          {/* Estimated Delivery */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-700 mb-8">
            <Calendar className="h-4 w-4 text-blue-600" />
            Estimated Delivery:{" "}
            <span className="font-medium">
              {estimatedDelivery.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>

          {/* Order Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Order ID</p>
                <p className="font-semibold">#{order._id.slice(-8)}</p>
              </div>

              <div>
                <CreditCard className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold capitalize">
                  {paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}
                </p>
              </div>

              <div>
                <Truck className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="font-semibold">₹{order.total.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Order Items</h3>
            <div className="space-y-4">
              {order.items.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b pb-3"
                >
                  <div className="flex items-center gap-3">
                    {item.productId.image && (
                      <img
                        src={item.productId.image}
                        alt={item.productId.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium">{item.productId.name}</p>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">
                    ₹{(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/orders')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Track Order
            </button>
            <button
              onClick={() => navigate('/products')}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
            >
              Continue Shopping
            </button>
          </div>

          {/* COD Info */}
          {paymentMethod === 'cod' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                💰 <strong>Cash on Delivery:</strong> Please keep ₹
                {order.total.toLocaleString()} ready for payment when your order
                arrives.
              </p>
            </div>
          )}

          {/* Auto redirect info */}
          <p className="text-gray-500 text-sm mt-6">
            Redirecting to your orders page in {redirectTimer} seconds...
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OrderSuccess;
