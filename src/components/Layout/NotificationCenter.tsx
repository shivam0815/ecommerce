import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import { io } from 'socket.io-client';
import {
  BellIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import clsx from 'clsx';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  createdAt: string;          // ISO string
  isRead?: boolean;
  type?: 'order' | 'promo' | 'system' | 'product' | 'announcement';
  cta?: { label: string; href: string }; // optional deep link
  meta?: Record<string, any>;
}

// Derive socket URL similar to your Profile.tsx logic
const { VITE_API_URL } = (import.meta as any).env as { VITE_API_URL?: string };
const SOCKET_URL =
  (VITE_API_URL?.replace(/\/+$/, '')) ||
  ((api as any).defaults?.baseURL?.replace(/\/+$/, '')) ||
  window.location.origin;

const typeDot = (t?: AppNotification['type']) =>
  t === 'order'
    ? 'bg-indigo-600'
    : t === 'promo'
    ? 'bg-emerald-600'
    : t === 'product'
    ? 'bg-blue-600'
    : t === 'announcement'
    ? 'bg-fuchsia-600'
    : 'bg-gray-600';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const NotificationCenter: React.FC = () => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | AppNotification['type']>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const didWire = useRef(false);

  // ---------- data fetch ----------
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/notifications');
      const data: AppNotification[] = res?.data?.notifications ?? [];
      // sort newest first
      data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setItems(data);
    } catch (err) {
      // Keep silent UI; if API not available, show empty state
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // ---------- socket live updates ----------
  useEffect(() => {
    if (didWire.current) return;
    didWire.current = true;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket'],
    });
    socketRef.current = socket;

    // Generic server-pushed notification
    const onNew = (n: AppNotification) => {
      setItems(prev => {
        // avoid duplicates
        if (prev.some(p => p._id === n._id)) return prev;
        const next = [n, ...prev];
        // reasonable cap to avoid unbounded growth
        return next.slice(0, 200);
      });
    };

    // Example product events -> transform to AppNotification
    const onProductCreated = (p: any) => {
      const n: AppNotification = {
        _id: `sock-product-${p._id}-${p.createdAt || Date.now()}`,
        title: `New product: ${p?.name ?? 'Latest arrival'}`,
        message: p?.shortDescription || 'A new product just landed. Check it out!',
        createdAt: new Date().toISOString(),
        isRead: false,
        type: 'product',
        cta: { label: 'View product', href: `/products/${p?._id || ''}` },
        meta: { productId: p?._id },
      };
      onNew(n);
    };

    const onLaunchingSoon = (p: any) => {
      const n: AppNotification = {
        _id: `sock-launch-${p._id}-${p.createdAt || Date.now()}`,
        title: `Launching soon: ${p?.name ?? 'New launch'}`,
        message: p?.teaser || 'Get ready! Something exciting is coming.',
        createdAt: new Date().toISOString(),
        isRead: false,
        type: 'announcement',
        cta: { label: 'Preview', href: `/products/${p?._id || ''}` },
        meta: { productId: p?._id },
      };
      onNew(n);
    };

    socket.on('notification:new', onNew);
    socket.on('product:created', onProductCreated);
    socket.on('product:launchingSoon', onLaunchingSoon);

    return () => {
      socket.off('notification:new', onNew);
      socket.off('product:created', onProductCreated);
      socket.off('product:launchingSoon', onLaunchingSoon);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ---------- actions ----------
  const markOne = async (id: string) => {
    // optimistic
    setItems(prev => prev.map(n => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await api.patch(`/user/notifications/${id}/read`);
    } catch {
      // rollback on error
      setItems(prev => prev.map(n => (n._id === id ? { ...n, isRead: false } : n)));
    }
  };

  const markAll = async () => {
    const anyUnread = items.some(n => !n.isRead);
    if (!anyUnread) return;
    // optimistic
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await api.patch('/user/notifications/mark-all-read');
    } catch {
      // refetch to be safe
      fetchNotifications();
    }
  };

  const remove = async (id: string) => {
    // optimistic
    const stash = items;
    setItems(prev => prev.filter(n => n._id !== id));
    try {
      await api.delete(`/user/notifications/${id}`);
    } catch {
      // rollback if delete fails
      setItems(stash);
    }
  };

  // ---------- filters ----------
  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'all') list = list.filter(n => n.type === typeFilter);
    if (showUnreadOnly) list = list.filter(n => !n.isRead);
    return list;
  }, [items, typeFilter, showUnreadOnly]);

  const unreadCount = useMemo(() => items.filter(n => !n.isRead).length, [items]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2">
          <div className="relative">
            <BellIcon className="w-5 h-5 text-gray-900" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-rose-600 text-white text-[10px]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Notification Center</h3>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="rounded-lg border border-gray-200 bg-white text-sm text-gray-700 px-2.5 py-1.5"
          >
            <option value="all">All types</option>
            <option value="product">Products</option>
            <option value="announcement">Announcements</option>
            <option value="order">Orders</option>
            <option value="promo">Promos</option>
            <option value="system">System</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-gray-900"
              checked={showUnreadOnly}
              onChange={e => setShowUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>

          {unreadCount > 0 && (
            <button
              onClick={markAll}
              className="text-sm text-gray-700 hover:text-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
          <BellIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="text-gray-700">No notifications{showUnreadOnly ? ' (unread)' : ''}.</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(n => (
            <li
              key={n._id}
              className={clsx(
                'p-4 rounded-xl border flex items-start gap-3 transition',
                n.isRead ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200'
              )}
            >
              <span className={clsx('mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0', typeDot(n.type))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 truncate">{n.title}</h4>
                  {!n.isRead && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">new</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{n.message}</p>
                <div className="text-xs text-gray-400 mt-1">{formatDate(n.createdAt)}</div>

                {n.cta?.href && (
                  <a
                    href={n.cta.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 mt-2 hover:underline"
                  >
                    {n.cta.label}
                  </a>
                )}
              </div>

              {!n.isRead ? (
                <button
                  onClick={() => markOne(n._id)}
                  title="Mark as read"
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <CheckCircleIcon className="w-5 h-5 text-gray-700" />
                </button>
              ) : (
                <button
                  onClick={() => remove(n._id)}
                  title="Dismiss"
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-700" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationCenter;
