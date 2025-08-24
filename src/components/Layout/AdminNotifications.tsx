import React, { useEffect, useMemo, useState } from 'react';
import {
  adminListNotifications,
  adminCreateNotification,
  adminDeleteNotification,
} from '../../config/adminApi';

type Props = {
  showNotification: (msg: string, type: 'success' | 'error') => void;
  checkNetworkStatus: () => boolean;
};

type NotifType = 'order' | 'promo' | 'system' | 'product' | 'announcement';

type Row = {
  _id: string;
  userId?: string;
  title: string;
  message: string;
  type: NotifType;
  isRead?: boolean;
  createdAt: string;
  cta?: { label?: string; href?: string };
};

const AdminNotifications: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'product' as NotifType,
    audience: 'all' as 'all' | 'user',
    targetUserId: '',
    ctaLabel: '',
    ctaHref: '',
  });

  const canSend = useMemo(() => {
    if (!form.title.trim() || !form.message.trim()) return false;
    if (form.audience === 'user' && !form.targetUserId.trim()) return false;
    return true;
  }, [form]);

  const load = async () => {
    if (!checkNetworkStatus()) return;
    setLoading(true);
    try {
      const res = await adminListNotifications({ limit: 200 });
      setList(res.notifications || []);
    } catch (e: any) {
      showNotification(e?.response?.data?.message || 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // initial load

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) {
      showNotification('Please fill all required fields', 'error');
      return;
    }
    if (!checkNetworkStatus()) return;

    setSending(true);
    try {
      await adminCreateNotification({
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        audience: form.audience,
        targetUserId: form.audience === 'user' ? form.targetUserId.trim() : undefined,
        cta: form.ctaHref ? { label: form.ctaLabel || 'View', href: form.ctaHref } : undefined,
      });

      setForm({
        title: '',
        message: '',
        type: form.type,
        audience: 'all',
        targetUserId: '',
        ctaLabel: '',
        ctaHref: '',
      });
      showNotification('✅ Notification sent', 'success');
      await load();
    } catch (e: any) {
      showNotification(e?.response?.data?.message || 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!checkNetworkStatus()) return;
    if (!confirm('Delete this notification record?')) return;
    try {
      await adminDeleteNotification(id);
      setList(prev => prev.filter(n => n._id !== id));
      showNotification('Deleted', 'success');
    } catch (e: any) {
      showNotification(e?.response?.data?.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="admin-notifications" style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ background: '#fff', borderRadius: 14, border: '1px solid #eee', padding: 16 }}>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>🔔 Send Notification</h2>
        <p style={{ color: '#666', marginTop: 6 }}>
          Create a broadcast or target a specific user. Users connected via sockets will receive it in real time.
        </p>

        <form onSubmit={send} style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 12 }}>
            <div>
              <label className="label">Title *</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="New product launch"
                required
              />
            </div>

            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as NotifType }))}
              >
                <option value="product">Product</option>
                <option value="announcement">Announcement</option>
                <option value="promo">Promo</option>
                <option value="order">Order</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label className="label">Audience</label>
              <select
                className="input"
                value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value as 'all' | 'user' }))}
              >
                <option value="all">All users</option>
                <option value="user">Single user</option>
              </select>
            </div>
          </div>

          {form.audience === 'user' && (
            <div>
              <label className="label">Target User ID *</label>
              <input
                className="input"
                value={form.targetUserId}
                onChange={e => setForm(f => ({ ...f, targetUserId: e.target.value }))}
                placeholder="MongoDB _id"
                required
              />
            </div>
          )}

          <div>
            <label className="label">Message *</label>
            <textarea
              className="input"
              rows={3}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="We’re launching HyperBass Pro this Friday! Tap to get notified."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label className="label">CTA Label</label>
              <input
                className="input"
                value={form.ctaLabel}
                onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))}
                placeholder="View product"
              />
            </div>
            <div>
              <label className="label">CTA URL</label>
              <input
                className="input"
                value={form.ctaHref}
                onChange={e => setForm(f => ({ ...f, ctaHref: e.target.value }))}
                placeholder="/products/abc123"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!canSend || sending}
              className="btn"
              style={{
                background: '#111827',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: 10,
                border: 0,
                fontWeight: 600,
                opacity: !canSend || sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Sending…' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ background: '#fff', borderRadius: 14, border: '1px solid #eee', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>📜 Recent Notifications</h2>
          <button onClick={load} className="btn" style={{ border: '1px solid #ddd', padding: '6px 10px', borderRadius: 8 }}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#666', padding: 16 }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ color: '#666', padding: 16 }}>No notifications yet.</div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="table" style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th style={{ padding: '8px 8px' }}>Title</th>
                  <th style={{ padding: '8px 8px' }}>Type</th>
                  <th style={{ padding: '8px 8px' }}>User</th>
                  <th style={{ padding: '8px 8px' }}>Created</th>
                  <th style={{ padding: '8px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {list.map(n => (
                  <tr key={n._id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                    <td style={{ padding: '8px 8px' }}>
                      <div style={{ fontWeight: 600 }}>{n.title}</div>
                      <div style={{ color: '#666' }}>{n.message}</div>
                      {n.cta?.href && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 12, color: '#0ea5e9' }}>
                            CTA: {n.cta.label || 'View'} → {n.cta.href}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 8px' }}>{n.type.toUpperCase()}</td>
                    <td style={{ padding: '8px 8px' }}>{n.userId || '—'}</td>
                    <td style={{ padding: '8px 8px' }}>{new Date(n.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                      <button
                        onClick={() => remove(n._id)}
                        className="btn"
                        style={{ color: '#dc2626', background: 'transparent', border: 0, fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* light styles to blend with your AdminDashboard.css */}
      <style>{`
        .label { display:block; font-size:12px; color:#6b7280; margin-bottom:6px }
        .input { width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; outline:none }
        .input:focus { border-color:#111827 }
        .btn:hover { filter: brightness(0.95) }
      `}</style>
    </div>
  );
};

export default AdminNotifications;
