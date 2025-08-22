import React, { useEffect, useRef, useState } from 'react';
import api from '../../config/api';
import { BellIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead?: boolean;
  type?: 'order' | 'promo' | 'system';
}

const NotificationCenter: React.FC = () => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return; // prevent double-fetch in StrictMode
    didFetch.current = true;

    (async () => {
      try {
        const res = await api.get('/user/notifications'); // baseURL already has /api
        const data: AppNotification[] = res?.data?.notifications ?? [];
        setItems(data);
      } catch (err: any) {
        // If your backend doesn't have this route yet, show a safe fallback instead of spamming console
        const status = err?.response?.status;
        if (status === 404) {
          setItems([
            { _id: 'demo-1', title: 'Order confirmed', message: 'Your order was confirmed 🎉', createdAt: new Date().toISOString(), type: 'order' },
            { _id: 'demo-2', title: 'Festival offer', message: 'Flat 10% off on select audio gear.', createdAt: new Date(Date.now() - 86400000).toISOString(), type: 'promo' },
          ]);
        } else {
          // For any other error, still show a minimal fallback
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markAll = () => setItems(prev => prev.map(n => ({ ...n, isRead: true })));
  const remove = (id: string) => setItems(prev => prev.filter(n => n._id !== id));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2">
          <BellIcon className="w-5 h-5 text-gray-900" />
          <h3 className="text-lg font-semibold text-gray-900">Notification Center</h3>
        </div>
        {items.some(n => !n.isRead) && (
          <button onClick={markAll} className="text-sm text-gray-600 hover:text-gray-900">
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <BellIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="text-gray-600">No notifications</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(n => (
            <li
              key={n._id}
              className={clsx(
                'p-4 rounded-xl border flex items-start gap-3',
                n.isRead ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200'
              )}
            >
              <span
                className={clsx(
                  'mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0',
                  n.type === 'order' ? 'bg-indigo-600' : n.type === 'promo' ? 'bg-emerald-600' : 'bg-gray-600'
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 truncate">{n.title}</h4>
                  {!n.isRead && <span className="text-[10px] uppercase tracking-wide text-gray-500">new</span>}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {!n.isRead ? (
                <button onClick={() => (n.isRead = true, setItems([...items]))} title="Mark as read" className="p-2 rounded hover:bg-gray-100">
                  <CheckCircleIcon className="w-5 h-5 text-gray-700" />
                </button>
              ) : (
                <button onClick={() => remove(n._id)} title="Dismiss" className="p-2 rounded hover:bg-gray-100">
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
