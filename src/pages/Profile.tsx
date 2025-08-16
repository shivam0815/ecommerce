// src/pages/Profile.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import api from '../config/api';
import { io } from 'socket.io-client';
import {
  UserIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  CameraIcon,
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  CreditCardIcon,
  EyeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';

// Prefer Vite env → axios baseURL → window origin (no trailing slash)
const SOCKET_URL =
  (import.meta as any)?.env?.VITE_API_URL?.replace(/\/+$/, '') ||
  ((api as any).defaults?.baseURL?.replace(/\/+$/, '')) ||
  window.location.origin;

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  createdAt: string;
  avatar?: string;
  isVerified?: boolean;
  preferences?: {
    notifications: boolean;
    theme: 'light' | 'dark';
    language: string;
  };
}

interface ProfileStats {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  completedOrders: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderStatus: string;
  paymentStatus: 'awaiting_payment' | 'paid' | 'failed' | 'cod_pending' | 'cod_paid';
  paymentMethod: 'razorpay' | 'cod';
  total: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  createdAt: string;
  trackingNumber?: string;
}

const fadeVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -24 }
};

const statVariants = {
  hidden: { scale: 0.7, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: { delay: 0.07 * i }
  })
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Not available';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'paid':
    case 'cod_paid':
      return 'text-green-600 bg-green-100';
    case 'shipped':
    case 'processing':
      return 'text-blue-600 bg-blue-100';
    case 'pending':
    case 'awaiting_payment':
    case 'cod_pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'cancelled':
    case 'failed':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const getStatusIcon = (status: string) => {
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

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'settings' | 'security'>('profile');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const navigate = useNavigate();

  // Keep a single socket instance
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, statsRes] = await Promise.all([
        api.get('/auth/profile'),
        api.get('/user/stats').catch(() => {
          return { data: { totalOrders: 0, totalSpent: 0, pendingOrders: 0, completedOrders: 0 } };
        })
      ]);
      setUser(profileRes.data.user);
      setStats(statsRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load profile');
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const response = await api.get('/user/orders');
      setOrders(Array.isArray(response.data.orders) ? response.data.orders : []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setOrders([]);
      if (err.response?.status !== 404) setError('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const updateUserProfile = async (profileData: Partial<User>) => {
    try {
      setIsUpdating(true);
      const response = await api.put('/user/profile', profileData);
      if (response.data.success) {
        setUser(response.data.user);
        alert('Profile updated successfully! ✅');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Profile update failed:', error);
      alert('Failed to update profile: ' + (error.response?.data?.message || error.message));
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/user/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setUser(prev => (prev ? { ...prev, avatar: response.data.avatarUrl } : null));
        alert('Avatar updated successfully! ✅');
      }
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      alert('Failed to upload avatar: ' + (error.response?.data?.message || error.message));
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Poll orders every 30s only when "Orders" tab is active
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (activeTab === 'orders') {
      fetchOrders();
      intervalId = setInterval(fetchOrders, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab, fetchOrders]);

  // WebSocket: single connection, join user room, merge updates
  useEffect(() => {
    if (!user?._id) return;

    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket']
      });
    }
    const socket = socketRef.current;

    // join personal room
    socket.emit('join', { userId: user._id });

    const handleStatus = (payload: any) => {
      // payload example from server:
      // { _id, orderNumber, orderStatus, trackingNumber, updatedAt }
      setOrders(prev => {
        const idx = prev.findIndex(o => o._id === payload._id);
        if (idx === -1) return prev;
        const merged = {
          ...prev[idx],
          ...payload,
          status: payload.orderStatus ?? prev[idx].status
        } as Order;
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      });
    };

    const handleCreated = (payload: any) => {
      // only add if it belongs to this user
      if (payload?.userId && String(payload.userId) === String(user._id)) {
        setOrders(prev => {
          // avoid duplicates
          if (prev.some(o => o._id === payload._id)) return prev;
          // normalize status fields
          const normalized = {
            ...payload,
            status: payload.orderStatus ?? payload.status ?? 'pending'
          } as Order;
          return [normalized, ...prev];
        });
      }
    };

    socket.on('orderStatusUpdated', handleStatus);
    socket.on('orderCreated', handleCreated);

    return () => {
      socket.off('orderStatusUpdated', handleStatus);
      socket.off('orderCreated', handleCreated);
      // optional: disconnect if Profile is never kept mounted in your app
      // socket.disconnect();
      // socketRef.current = null;
    };
  }, [user?._id]);

  const filteredOrders = Array.isArray(orders)
    ? orders.filter(order => {
        if (orderFilter === 'pending') return ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status);
        if (orderFilter === 'completed') return ['delivered', 'cancelled'].includes(order.status);
        return true;
      })
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100">
        <motion.div
          className="w-56 h-56 bg-white/60 rounded-3xl shadow-2xl flex flex-col items-center justify-center"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-14 h-14 animate-pulse bg-gradient-to-tr from-green-500 to-blue-500 rounded-full mb-6"></div>
          <div className="h-4 w-40 bg-gradient-to-r from-green-100 to-blue-100 rounded mb-2"></div>
          <div className="h-4 w-32 bg-gradient-to-r from-green-100 to-blue-100 rounded"></div>
        </motion.div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-yellow-100">
        <motion.div className="w-[360px] bg-white/70 rounded-3xl shadow-2xl flex flex-col items-center p-10" variants={fadeVariants} initial="hidden" animate="visible">
          <span className="text-6xl mb-4">❌</span>
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={fetchProfileData}
            className="px-8 py-2 font-bold text-white bg-gradient-to-r from-green-600 to-blue-700 rounded-full shadow hover:from-green-700 hover:to-blue-800 hover:scale-105 transform transition"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 to-blue-200 py-8 px-2 md:px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div className="bg-white bg-opacity-60 backdrop-blur rounded-3xl shadow-2xl mb-8" initial="hidden" animate="visible" variants={fadeVariants}>
          <div className="bg-gradient-to-r from-green-500 to-blue-500 p-8 text-white rounded-t-3xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 z-10 relative">
              <motion.div className="relative" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                <div className="w-28 h-28 rounded-full bg-white/30 overflow-hidden flex items-center justify-center border-4 border-white shadow">
                  {user.avatar ? (
                    <motion.img
                      src={user.avatar}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      key={user.avatar}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', bounce: 0.35 }}
                    />
                  ) : (
                    <UserIcon className="w-14 h-14 text-blue-300" />
                  )}
                </div>
                <label className="absolute bottom-0 right-1 bg-white p-1.5 rounded-full shadow-lg cursor-pointer hover:bg-blue-100 transition">
                  <CameraIcon className="w-5 h-5 text-gray-500" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </motion.div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <span className="text-3xl font-extrabold">{user.name}</span>
                  {user.isVerified && <CheckCircleIcon className="w-6 h-6 text-green-300" />}
                </div>
                <div className="text-lg font-semibold opacity-90">{user.email}</div>
                <div className="capitalize text-lg font-semibold">{user.role === 'admin' ? '👑 Admin' : '🛍️ Customer'}</div>
              </div>
            </div>
          </div>

          {stats && (
            <div className="px-8 py-6 bg-gradient-to-l from-white/50 to-white/80 grid grid-cols-2 md:grid-cols-4 gap-6 border-b">
              {[
                { num: stats.totalOrders, label: 'Total Orders', color: 'text-green-500', icon: <ShoppingBagIcon className="w-5 h-5" />, i: 0 },
                { num: stats.totalSpent, label: 'Total Spent', color: 'text-blue-500', icon: <CreditCardIcon className="w-5 h-5" />, i: 1 },
                { num: stats.pendingOrders || 0, label: 'Pending', color: 'text-yellow-500', icon: <ClockIcon className="w-5 h-5" />, i: 2 },
                { num: stats.completedOrders || 0, label: 'Completed', color: 'text-green-600', icon: <CheckCircleIcon className="w-5 h-5" />, i: 3 }
              ].map((stat, idx) => (
                <motion.div className="text-center" key={stat.label} custom={idx} initial="hidden" animate="visible" variants={statVariants}>
                  <div className={clsx('flex items-center justify-center gap-2 mb-1', stat.color)}>
                    {stat.icon}
                    <div className="text-2xl font-extrabold">{stat.label === 'Total Spent' ? `₹${stats.totalSpent.toFixed(2)}` : stat.num}</div>
                  </div>
                  <div className="text-sm font-medium text-gray-500">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-xl">
          <div className="flex border-b">
            {[
              { id: 'profile', label: 'Profile', icon: <UserIcon className="w-5 h-5 inline mr-1" /> },
              { id: 'orders', label: 'Orders', icon: <ShoppingBagIcon className="w-5 h-5 inline mr-1" /> },
              { id: 'settings', label: 'Settings', icon: <Cog6ToothIcon className="w-5 h-5 inline mr-1" /> },
              { id: 'security', label: 'Security', icon: <ShieldCheckIcon className="w-5 h-5 inline mr-1" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={clsx(
                  'flex-1 py-4 px-6 text-center font-medium transition-all focus:outline-none text-lg',
                  activeTab === tab.id ? 'text-green-600 border-b-4 border-green-400 bg-gradient-to-b from-green-100/60 to-white' : 'text-gray-500 hover:text-green-600'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-8 min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div key="profile" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-7">
                  <ProfileEditForm user={user} onUpdate={updateUserProfile} isUpdating={isUpdating} />
                </motion.div>
              )}

              {activeTab === 'orders' && (
                <OrdersTab
                  orders={filteredOrders}
                  ordersLoading={ordersLoading}
                  orderFilter={orderFilter}
                  setOrderFilter={setOrderFilter}
                  onRefresh={fetchOrders}
                  navigate={navigate}
                />
              )}

              {/* Settings & Security tabs can be added here as needed */}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileEditForm: React.FC<{
  user: User;
  onUpdate: (data: Partial<User>) => Promise<boolean>;
  isUpdating: boolean;
}> = ({ user, onUpdate, isUpdating }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5">
        <div className="flex items-center space-x-4 bg-slate-100 rounded-xl p-4 shadow">
          <div className="w-12 h-12 bg-green-300/20 rounded-full flex items-center justify-center">
            <span className="text-xl">👤</span>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full text-lg bg-transparent border-none outline-none"
              required
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 bg-slate-100 rounded-xl p-4 shadow">
          <div className="w-12 h-12 bg-blue-300/20 rounded-full flex items-center justify-center">
            <span className="text-xl">📧</span>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full text-lg bg-transparent border-none outline-none"
              required
            />
            {user.isVerified && <span className="text-xs text-green-600 ml-1">✅ Verified</span>}
          </div>
        </div>

        <div className="flex items-center space-x-4 bg-slate-100 rounded-xl p-4 shadow">
          <div className="w-12 h-12 bg-purple-300/20 rounded-full flex items-center justify-center">
            <span className="text-xl">📱</span>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full text-lg bg-transparent border-none outline-none"
              placeholder="Enter your phone number"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4 bg-slate-100 rounded-xl p-4 shadow">
          <div className="w-12 h-12 bg-yellow-300/20 rounded-full flex items-center justify-center">
            <span className="text-xl">📅</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500">Joined</p>
            <p className="text-lg">{formatDate(user.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={isUpdating}
          className="flex-1 bg-gradient-to-r from-green-600 to-blue-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-blue-600 transition-all active:scale-95 shadow disabled:opacity-50"
        >
          {isUpdating ? '⏳ Updating...' : '✏️ Update Profile'}
        </button>
        <button type="button" className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-100 transition active:scale-95 shadow">
          📱 Change Password
        </button>
      </div>
    </form>
  );
};

const OrdersTab: React.FC<{
  orders: Order[];
  ordersLoading: boolean;
  orderFilter: 'all' | 'pending' | 'completed';
  setOrderFilter: (filter: 'all' | 'pending' | 'completed') => void;
  onRefresh: () => void;
  navigate: (path: string) => void;
}> = ({ orders, ordersLoading, orderFilter, setOrderFilter, onRefresh, navigate }) => {
  return (
    <motion.div key="orders" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Your Orders</h3>
          <p className="text-gray-600">Track and manage your orders</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Active' },
              { key: 'completed', label: 'Completed' }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setOrderFilter(filter.key as typeof orderFilter)}
                className={clsx(
                  'px-4 py-2 rounded-md font-medium text-sm transition',
                  orderFilter === filter.key ? 'bg-white text-green-600 shadow' : 'text-gray-600 hover:text-green-600'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <motion.button
            onClick={onRefresh}
            disabled={ordersLoading}
            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
            animate={ordersLoading ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: ordersLoading ? Infinity : 0, ease: 'linear' }}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {ordersLoading && orders.length === 0 && (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">Loading your orders...</p>
          </div>
        </div>
      )}

      {!ordersLoading && orders.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-gray-700 mb-2">No orders found</h4>
          <p className="text-gray-500 mb-6">{orderFilter === 'all' ? "You haven't placed any orders yet." : `No ${orderFilter} orders found.`}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-600 hover:to-blue-700 transition"
          >
            Start Shopping
          </button>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order, index) => (
            <motion.div
              key={order._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-gray-900">#{order.orderNumber}</h4>
                      <div className={clsx('flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium', getStatusColor(order.status))}>
                        {getStatusIcon(order.status)}
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {formatDate(order.createdAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCardIcon className="w-4 h-4" />
                        {order.paymentMethod.toUpperCase()}
                      </div>
                      <div className={clsx('flex items-center gap-1 px-2 py-1 rounded text-xs', getStatusColor(order.paymentStatus))}>
                        {order.paymentStatus.replace('_', ' ').charAt(0).toUpperCase() +
                          order.paymentStatus.replace('_', ' ').slice(1)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">₹{order.total.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <ShoppingBagIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Qty: {item.quantity} × ₹{item.price}
                        </p>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="flex items-center justify-center bg-gray-50 rounded-lg p-3">
                      <span className="text-gray-600">+{order.items.length - 3} more items</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate(`/order-details/${order._id}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View Details
                  </button>

                  {order.trackingNumber && (
                    <button
                      onClick={() => navigate(`/track-order/${order.trackingNumber}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                    >
                      <TruckIcon className="w-4 h-4" />
                      Track Order
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default Profile;
