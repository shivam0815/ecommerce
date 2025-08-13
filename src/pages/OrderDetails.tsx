// src/pages/OrderDetails.tsx - COMPLETELY FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ChatBubbleLeftIcon
} from '@heroicons/react/24/solid';

// ✅ FIXED: Proper TypeScript interfaces
interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
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
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
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

const fadeVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const OrderDetails: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  // ✅ FIXED: Proper TypeScript typing
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails(orderId);
    }
  }, [orderId]);

  // ✅ FIXED: Enhanced error handling and response parsing
  const fetchOrderDetails = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching order details for:', id);
      
      const response = await api.get(`/orders/${id}`);
      console.log('📋 Full API Response:', response);
      console.log('📊 Response Status:', response.status);
      console.log('📦 Response Data:', response.data);
      
      // ✅ FIXED: Handle multiple response formats
      let orderData = null;
      
      if (response.data) {
        // Format 1: {success: true, order: {...}}
        if (response.data.success && response.data.order) {
          orderData = response.data.order;
        }
        // Format 2: {order: {...}}
        else if (response.data.order) {
          orderData = response.data.order;
        }
        // Format 3: Direct order object {...}
        else if (response.data._id || response.data.orderNumber) {
          orderData = response.data;
        }
      }
      
      if (orderData && orderData._id) {
        setOrder(orderData);
        console.log('✅ Order details loaded successfully:', orderData.orderNumber);
      } else {
        console.log('❌ No order data found in response:', response.data);
        setError('Order not found - Invalid response format');
      }
      
    } catch (err: any) {
      console.error('❌ API Error Details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config
      });
      
      if (err.response?.status === 404) {
        setError('Order not found');
      } else if (err.response?.status === 401) {
        setError('Access denied - Please log in');
      } else {
        setError(err.response?.data?.message || 'Failed to load order details');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': case 'paid': case 'cod_paid': 
        return 'text-green-600 bg-green-100';
      case 'shipped': case 'processing': 
        return 'text-blue-600 bg-blue-100';
      case 'pending': case 'awaiting_payment': case 'cod_pending': 
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': case 'failed': 
        return 'text-red-600 bg-red-100';
      default: 
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered': case 'paid': 
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'shipped': 
        return <TruckIcon className="w-5 h-5" />;
      case 'processing': 
        return <ClockIcon className="w-5 h-5" />;
      case 'cancelled': case 'failed': 
        return <XCircleIcon className="w-5 h-5" />;
      default: 
        return <ClockIcon className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // ✅ ENHANCED: Loading State with Debug Info
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4"
          initial="hidden"
          animate="visible"
          variants={fadeVariants}
        >
          <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold text-center text-gray-700 mb-2">Loading Order Details</h3>
          <p className="text-gray-500 text-center">Fetching order: {orderId}</p>
          <p className="text-gray-500 text-center text-sm mt-2">Please wait...</p>
        </motion.div>
      </div>
    );
  }

  // ✅ ENHANCED: Error State with Debug Info
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center"
          initial="hidden"
          animate="visible"
          variants={fadeVariants}
        >
          <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Order Not Found</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <div className="text-sm text-gray-400 mb-6">
            <p>Order ID: {orderId}</p>
            <p>If this issue persists, please contact support.</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => fetchOrderDetails(orderId!)}
              className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition font-medium"
            >
              Back to Profile
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ✅ ENHANCED: No Order State
  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center"
          initial="hidden"
          animate="visible"
          variants={fadeVariants}
        >
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Order Data</h3>
          <p className="text-gray-500 mb-6">The order data could not be loaded.</p>
          <button
            onClick={() => navigate('/profile')}
            className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition font-medium"
          >
            Back to Profile
          </button>
        </motion.div>
      </div>
    );
  }

  // ✅ MAIN ORDER DETAILS DISPLAY
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-blue-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          className="bg-white bg-opacity-60 backdrop-blur rounded-3xl shadow-2xl mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeVariants}
        >
          {/* Top Header */}
          <div className="bg-gradient-to-r from-green-500 to-blue-500 p-6 text-white rounded-t-3xl">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Back to Profile
              </button>
              <div className="flex items-center gap-4">
                <button className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition">
                  <PrinterIcon className="w-5 h-5" />
                </button>
                <button className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition">
                  <ChatBubbleLeftIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div>
              <h1 className="text-3xl font-bold mb-2">Order #{order.orderNumber}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/90">
                <span>📅 Placed on {formatDate(order.createdAt)}</span>
                <span>•</span>
                <span className="capitalize">💳 {order.paymentMethod} Payment</span>
                {order.trackingNumber && (
                  <>
                    <span>•</span>
                    <span>📦 Tracking: {order.trackingNumber}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="p-6 border-b bg-gray-50">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className={clsx('flex items-center gap-2 px-4 py-2 rounded-full font-medium', getStatusColor(order.status))}>
                  {getStatusIcon(order.status)}
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </div>
                <div className={clsx('flex items-center gap-2 px-4 py-2 rounded-full font-medium', getStatusColor(order.paymentStatus))}>
                  <CreditCardIcon className="w-4 h-4" />
                  {order.paymentStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">₹{order.total.toFixed(2)}</div>
                <div className="text-sm text-gray-600">{order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Order Items */}
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-6 mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeVariants}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ShoppingBagIcon className="w-6 h-6 text-green-500" />
            Order Items
          </h2>
          
          <div className="space-y-4">
            {order.items?.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBagIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <div className="text-sm text-gray-600">Quantity: {item.quantity}</div>
                  <div className="text-sm text-gray-600">Price: ₹{item.price.toFixed(2)} each</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">₹{(item.quantity * item.price).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-6 pt-6 border-t">
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>₹{order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>₹{order.shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                <span>Total</span>
                <span>₹{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Shipping Address */}
          <motion.div
            className="bg-white rounded-2xl shadow-xl p-6"
            initial="hidden"
            animate="visible"
            variants={fadeVariants}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPinIcon className="w-5 h-5 text-green-500" />
              Shipping Address
            </h3>
            <div className="text-gray-700 space-y-1">
              <div className="font-medium">{order.shippingAddress.fullName}</div>
              <div>{order.shippingAddress.addressLine1}</div>
              {order.shippingAddress.addressLine2 && <div>{order.shippingAddress.addressLine2}</div>}
              <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</div>
              <div className="text-sm text-gray-600 mt-2">
                <div>📞 {order.shippingAddress.phoneNumber}</div>
                <div>📧 {order.shippingAddress.email}</div>
              </div>
            </div>
          </motion.div>

          {/* Payment Information */}
          <motion.div
            className="bg-white rounded-2xl shadow-xl p-6"
            initial="hidden"
            animate="visible"
            variants={fadeVariants}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCardIcon className="w-5 h-5 text-blue-500" />
              Payment Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Method</span>
                <span className="font-medium capitalize">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className={clsx('px-2 py-1 rounded text-xs font-medium', getStatusColor(order.paymentStatus))}>
                  {order.paymentStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              {order.paymentId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment ID</span>
                  <span className="font-mono text-xs">{order.paymentId}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid At</span>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
