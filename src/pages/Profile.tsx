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
  ArrowPathIcon,
  BellIcon,
  LifebuoyIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/solid';

import NotificationCenter from '../components/Layout/NotificationCenter';
import HelpSupport from '../components/Layout/HelpSupport';
import FAQs from '../components/Layout/FAQs';
import Terms from './Terms';

// NEW: returns UI
import ReturnsTab from '../components/Layout/ReturnsTab';
import ReturnRequestModal from '../components/Layout/ReturnRequestModal';

// Prefer Vite env → axios baseURL → window origin (no trailing slash)
const { VITE_API_URL } = (import.meta as any).env as { VITE_API_URL?: string };
const SOCKET_URL =
  (VITE_API_URL?.replace(/\/+$/, '')) ||
  ((api as any).defaults?.baseURL?.replace(/\/+$/, '')) ||
  window.location.origin;

// ---- Shiprocket Post-Ship widget constants ----
const SHIPROCKET_CSS =
  'https://kr-shipmultichannel-mum.s3-ap-south-1.amazonaws.com/shiprocket-fronted/shiprocket_post_ship.css';
const SHIPROCKET_JS =
  'https://kr-shipmultichannel-mum.s3-ap-south-1.amazonaws.com/shiprocket-fronted/shiprocket_post_ship.js';

// Brand colors (change as you like). If you want a stronger blue than #7382bb, #2F54C9 is a good pick.
const BRAND_BTN_BG = '#2F54C9'; // button background
const BRAND_BTN_FG = '#ffffff'; // button text
const BOX_BG       = '#ECECEC';
const BOX_TEXT     = '#f5eeff';
const BOX_H1       = '#000000';

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
    // order item _id may exist but isn't required by this file
    _id?: string;
  }>;
  createdAt: string;
  trackingNumber?: string;
  // deliveredAt could exist on your API, but UI doesn’t require it (backend enforces window)
  deliveredAt?: string;
}

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const formatDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const statusPill = (status: string) => {
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

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'orders' |  'security' | 'notifications' | 'support' | 'faqs' | 'terms' | 'returns'
  >('profile');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [isUpdating, setIsUpdating] = useState(false);

  // NEW: open Return modal with the chosen order
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);

  const navigate = useNavigate();
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, statsRes] = await Promise.all([
        api.get('/auth/profile'),
        api.get('/user/stats').catch(() => ({ data: { totalOrders: 0, totalSpent: 0, pendingOrders: 0, completedOrders: 0 } })),
      ]);
      setUser(profileRes.data.user);
      setStats(statsRes.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load profile');
      if (err?.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const res = await api.get('/user/orders');
      setOrders(Array.isArray(res.data.orders) ? res.data.orders : []);
      setError(null);
    } catch (err) {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const updateUserProfile = async (data: Partial<User>) => {
    try {
      setIsUpdating(true);
      const res = await api.put('/user/profile', data);
      if (res.data.success) {
        setUser(res.data.user);
        alert('Profile updated successfully');
        return true;
      }
      return false;
    } catch (err: any) {
      alert('Failed to update profile: ' + (err?.response?.data?.message || err?.message));
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => { fetchProfileData(); }, [fetchProfileData]);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    if (activeTab === 'orders') {
      fetchOrders();
      id = setInterval(fetchOrders, 30000);
    }
    return () => { if (id) clearInterval(id); };
  }, [activeTab, fetchOrders]);

  useEffect(() => {
    if (!user?._id) return;
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, { withCredentials: true, transports: ['websocket'] });
    }
    const socket = socketRef.current;
    socket.emit('join', { userId: user._id });

    const handleStatus = (p: any) => {
      setOrders(prev => {
        const idx = prev.findIndex(o => o._id === p._id);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], ...p, status: p.orderStatus ?? prev[idx].status } as Order;
        const copy = [...prev]; copy[idx] = updated; return copy;
      });
    };
    const handleCreated = (p: any) => {
      if (p?.userId && String(p.userId) === String(user._id)) {
        setOrders(prev => (prev.some(o => o._id === p._id) ? prev : [{ ...p, status: p.orderStatus ?? p.status ?? 'pending' }, ...prev]));
      }
    };

    socket.on('orderStatusUpdated', handleStatus);
    socket.on('orderCreated', handleCreated);
    return () => {
      socket.off('orderStatusUpdated', handleStatus);
      socket.off('orderCreated', handleCreated);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id]);

  // ---- Shiprocket widget injector: run when Orders tab is active ----
  useEffect(() => {
    if (activeTab !== 'orders') return;

    const cssId = 'shiprocket-postship-css';
    const jsId  = 'shiprocket-postship-js';

    const applyStyles = () => {
      const btn = document.querySelector<HTMLElement>('.post-ship-btn');
      if (btn) {
        btn.style.backgroundColor = BRAND_BTN_BG;
        btn.style.color = BRAND_BTN_FG;
      }

      const wrap = document.querySelector<HTMLElement>('.post-ship-box-wrp');
      if (wrap) {
        wrap.style.backgroundColor = BOX_BG;

        const anyDiv = wrap.querySelector<HTMLElement>('div');
        if (anyDiv) anyDiv.style.color = BOX_TEXT;

        const h1 = wrap.querySelector<HTMLElement>('h1');
        if (h1) h1.style.color = BOX_H1;

        const innerBtn = wrap.querySelector<HTMLElement>('button');
        if (innerBtn) {
          innerBtn.style.backgroundColor = BRAND_BTN_BG;
          innerBtn.style.color = BRAND_BTN_FG;
        }
      }
    };

    // Retry because the widget may render after script onload
    const retryApplyStyles = () => {
      applyStyles();
      setTimeout(applyStyles, 300);
      setTimeout(applyStyles, 900);
    };

    // Add CSS (once)
    let cssEl = document.getElementById(cssId) as HTMLLinkElement | null;
    if (!cssEl) {
      cssEl = document.createElement('link');
      cssEl.id = cssId;
      cssEl.rel = 'stylesheet';
      cssEl.href = SHIPROCKET_CSS;
      document.body.appendChild(cssEl);
    }

    // Add JS (once)
    let jsEl = document.getElementById(jsId) as HTMLScriptElement | null;
    if (!jsEl) {
      jsEl = document.createElement('script');
      jsEl.id = jsId;
      jsEl.src = SHIPROCKET_JS;
      jsEl.async = true;
      jsEl.onload = retryApplyStyles;
      document.body.appendChild(jsEl);
    } else {
      // Already present → attempt styling immediately
      retryApplyStyles();
    }

    // Observe DOM changes to re-apply styles if widget re-renders
    const mo = new MutationObserver(() => applyStyles());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
    };
  }, [activeTab]);

  const filteredOrders = Array.isArray(orders)
    ? orders.filter(o => (orderFilter === 'pending'
        ? ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
        : orderFilter === 'completed'
        ? ['delivered', 'cancelled'].includes(o.status)
        : true))
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-56 h-56 bg-white rounded-3xl shadow flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-sm text-gray-600">Loading your profile…</div>
        </div>
      </div>
    );
  }
  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="font-medium mb-4">{error}</div>
          <button onClick={fetchProfileData} className="px-4 py-2 rounded-lg bg-gray-900 text-white">Try again</button>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header Card (white, subtle) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-gray-100 ring-1 ring-gray-200 overflow-hidden flex items-center justify-center">
                {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 text-gray-400" />}
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">{user.name}</h1>
                {user.isVerified && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
              </div>
              <div className="text-gray-600">{user.email}</div>
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                <span>Member since {formatDate(user.createdAt)}</span>
                <span className="select-none">•</span>
                <span className="uppercase tracking-wide">{user.role}</span>
              </div>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { label: 'Total Orders', value: stats.totalOrders },
                { label: 'Total Spent', value: `₹${stats.totalSpent.toFixed(2)}` },
                { label: 'Pending', value: stats.pendingOrders || 0 },
                { label: 'Completed', value: stats.completedOrders || 0 },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-center">
                  <div className="text-sm text-gray-500">{s.label}</div>
                  <div className="text-xl font-semibold text-gray-900">{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs (vertical, polished) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row">
            {/* Sidebar nav */}
            <aside className="md:w-64 border-b md:border-b-0 md:border-r border-gray-100">
              <nav className="p-2 md:p-4 space-y-1">
                {[
                  { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
                  { id: 'orders', label: 'Orders', icon: <ShoppingBagIcon className="w-4 h-4" /> },
                  { id: 'returns', label: 'Returns', icon: <ArrowPathIcon className="w-4 h-4" /> }, // NEW
                  { id: 'notifications', label: 'Notifications', icon: <BellIcon className="w-4 h-4" /> },
                  { id: 'support', label: 'Help & Support', icon: <LifebuoyIcon className="w-4 h-4" /> },
                  { id: 'faqs', label: 'FAQs', icon: <QuestionMarkCircleIcon className="w-4 h-4" /> },
                  { id: 'terms', label: 'Terms', icon: <DocumentTextIcon className="w-4 h-4" /> },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    aria-current={activeTab === (t.id as any) ? 'page' : undefined}
                    className={clsx(
                      'w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm md:text-[15px] font-medium transition',
                      activeTab === (t.id as any)
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span className="shrink-0">{t.icon}</span>
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            {/* Panels */}
            <section className="flex-1 p-6 md:p-8 min-h-[420px]">
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div key="profile" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <ProfileEditForm
                      user={user}
                      onUpdate={updateUserProfile}
                      isUpdating={isUpdating}
                      goSecurity={() => setActiveTab('security')}
                    />
                  </motion.div>
                )}

                {activeTab === 'orders' && (
                  <motion.div key="orders" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <OrdersTab
                      orders={filteredOrders}
                      ordersLoading={ordersLoading}
                      orderFilter={orderFilter}
                      setOrderFilter={setOrderFilter}
                      onRefresh={fetchOrders}
                      navigate={navigate}
                      // NEW
                      onOpenReturn={(o) => setReturnOrder(o)}
                    />
                  </motion.div>
                )}

                {activeTab === 'returns' && (
                  <motion.div key="returns" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <ReturnsTab />
                  </motion.div>
                )}

                {activeTab === 'notifications' && (
                  <motion.div key="notifications" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <NotificationCenter />
                  </motion.div>
                )}

                {activeTab === 'support' && (
                  <motion.div key="support" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <HelpSupport />
                  </motion.div>
                )}

                {activeTab === 'faqs' && (
                  <motion.div key="faqs" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <FAQs />
                  </motion.div>
                )}

                {activeTab === 'terms' && (
                  <motion.div key="terms" variants={fade} initial="hidden" animate="visible" exit="exit">
                    <Terms />
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        </div>
      </div>

      {/* NEW: Return request modal (opens from Orders tab) */}
      {returnOrder && (
        <ReturnRequestModal
          order={returnOrder}
          onClose={() => setReturnOrder(null)}
          onSuccess={() => setActiveTab('returns')}
        />
      )}
    </div>
  );
};

const ProfileEditForm: React.FC<{
  user: User;
  onUpdate: (data: Partial<User>) => Promise<boolean>;
  isUpdating: boolean;
  goSecurity: () => void;
}> = ({ user, onUpdate, isUpdating, goSecurity }) => {
  const [formData, setFormData] = useState({ name: user.name || '', email: user.email || '', phone: user.phone || '' });

  const submit = async (e: React.FormEvent) => { e.preventDefault(); await onUpdate(formData); };

  return (
    <form onSubmit={submit} className="grid gap-5 max-w-3xl">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          className="w-full rounded-lg border-gray-200 focus:ring-0 focus:border-gray-900"
          required
        />
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
          className="w-full rounded-lg border-gray-200 focus:ring-0 focus:border-gray-900"
          required
        />
        {user.isVerified && <div className="text-xs text-emerald-600 mt-1">Verified</div>}
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
          className="w-full rounded-lg border-gray-200 focus:ring-0 focus:border-gray-900"
          placeholder="Enter phone number"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={isUpdating}
          className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-xl font-semibold hover:bg-black transition disabled:opacity-50"
        >
          {isUpdating ? 'Updating…' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={goSecurity}
          className="flex-1 bg-white border border-gray-200 text-gray-900 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 transition"
        >
          Change Password
        </button>
      </div>
    </form>
  );
};

const OrdersTab: React.FC<{
  orders: Order[];
  ordersLoading: boolean;
  orderFilter: 'all' | 'pending' | 'completed';
  setOrderFilter: (f: 'all' | 'pending' | 'completed') => void;
  onRefresh: () => void;
  navigate: (p: string) => void;
  // NEW
  onOpenReturn: (order: Order) => void;
}> = ({ orders, ordersLoading, orderFilter, setOrderFilter, onRefresh, navigate, onOpenReturn }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Your Orders</h3>
          <p className="text-sm text-gray-500">Track and manage your orders</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Active' },
              { key: 'completed', label: 'Completed' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setOrderFilter(f.key as typeof orderFilter)}
                className={clsx(
                  'px-4 py-2 rounded-md text-sm font-medium transition',
                  orderFilter === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <motion.button
            onClick={onRefresh}
            disabled={ordersLoading}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
            animate={ordersLoading ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: ordersLoading ? Infinity : 0, ease: 'linear' }}
            aria-label="Refresh orders"
          >
            <ArrowPathIcon className="w-5 h-5 text-gray-700" />
          </motion.button>
        </div>
      </div>

      {ordersLoading && orders.length === 0 && (
        <div className="flex justify-center py-12">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            Loading orders…
          </div>
        </div>
      )}

      {!ordersLoading && orders.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBagIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-800 mb-1">No orders found</h4>
          <p className="text-gray-500 mb-6">
            {orderFilter === 'all' ? "You haven't placed any orders yet." : `No ${orderFilter} orders.`}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-black"
          >
            Start Shopping
          </button>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((o, i) => (
            <motion.div
              key={o._id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-white border border-gray-100 rounded-xl shadow-sm"
            >
              <div className="p-5 border-b border-gray-100">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-base font-semibold text-gray-900">#{o.orderNumber}</h5>
                      <div className={clsx('px-2.5 py-1 rounded-full text-xs inline-flex items-center gap-1', statusPill(o.status))}>
                        {statusIcon(o.status)}
                        <span className="font-medium capitalize">{o.status}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1"><ClockIcon className="w-4 h-4" />{formatDate(o.createdAt)}</span>
                      <span className="inline-flex items-center gap-1"><CreditCardIcon className="w-4 h-4" />{o.paymentMethod.toUpperCase()}</span>
                      <span className={clsx('px-2 py-0.5 rounded text-xs', statusPill(o.paymentStatus))}>
                        {o.paymentStatus.replace('_',' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-gray-900">₹{o.total.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{o.items.length} item{o.items.length > 1 ? 's' : ''}</div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {o.items.slice(0,3).map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
                      <div className="w-12 h-12 rounded-md bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                        {it.image ? <img src={it.image} alt={it.name} className="w-full h-full object-cover" /> : <ShoppingBagIcon className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                        <div className="text-xs text-gray-500">Qty {it.quantity} × ₹{it.price}</div>
                      </div>
                    </div>
                  ))}
                  {o.items.length > 3 && (
                    <div className="flex items-center justify-center bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-600">
                      +{o.items.length - 3} more
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate(`/order-details/${o._id}`)}
                    className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-900 font-medium inline-flex items-center gap-2"
                  >
                    <EyeIcon className="w-4 h-4" /> View Details
                  </button>

                  {o.trackingNumber && (
                    <button
                      onClick={() => navigate(`/track-order/${o.trackingNumber}`)}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-black inline-flex items-center gap-2"
                    >
                      <TruckIcon className="w-4 h-4" /> Track Order
                    </button>
                  )}

                  {/* NEW: Request Return (shown for delivered orders – backend still validates window) */}
                  {String(o.status).toLowerCase() === 'delivered' && (
                    <button
                      onClick={() => onOpenReturn(o)}
                      className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-900 font-medium inline-flex items-center gap-2"
                      title="Request a return for this order"
                    >
                      <ArrowPathIcon className="w-4 h-4" /> Request Return
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Profile;
