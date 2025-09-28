// src/components/Layout/UsersTab.tsx — enhanced v2
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateResponsiveImageUrl } from '../../utils/cloudinaryBrowser';
import {
  getUsers,
  updateUser,
  deleteUser,
  getUserAnalytics,
  toggleUserStatus,
  sendPasswordResetEmail,
} from '../../config/adminApi';

/* ----------------------------------------------------------
 * UsersTab — Admin user management (enhanced)
 *
 * What's new vs your original:
 * 1) Robust fetching: debounced search, abortable requests, retry-once.
 * 2) Persisted UI state: remembers filters/sort/pagination in localStorage.
 * 3) Bulk actions: select rows, bulk activate/ban/delete, CSV export.
 * 4) Safer updates: optimistic UI with rollback on failure; clearer errors.
 * 5) Better reset email: per-user cooldown, progress state, rich errors.
 * 6) Quality-of-life: keyboard shortcuts, copy-to-clipboard, CSV export,
 *    total range indicator, improved skeletons/empty states, a11y labels.
 * 7) Small UX: inline name/phone edit, column sizing tweaks, tooltips.
 * ---------------------------------------------------------- */

type Props = {
  showNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
  checkNetworkStatus: () => boolean;
};

type UserRole = 'customer' | 'admin' | 'seller';
 type UserStatus = 'active' | 'inactive' | 'banned';

 type UserRow = {
  _id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  phone?: string;
  avatar?: string;
  role?: UserRole;        // may be missing from backend
  status?: UserStatus;    // may be missing from backend
  city?: string;
  country?: string;
  device?: string;
  createdAt: string;
  lastLoginAt?: string;
  ordersCount?: number;
  lifetimeValue?: number;
  sessions7d?: number[];
  avgSessionMins?: number;
  totalMins30d?: number;
  // Possible legacy flags
  isAdmin?: boolean;
  isActive?: boolean;
};

 type Analytics = {
  dau: number;
  wau: number;
  mau: number;
  avgSessionMins: number;
  returning7d: number;
  trend7?: number[];
};

 const rangeToLabel: Record<string, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

 // ---------- helpers ----------
 const upper = (v: unknown, fallback = '') => String(v ?? fallback).toUpperCase();
 const toINR = (n?: number) => `₹${(Number.isFinite(n as number) ? (n as number) : 0).toLocaleString('en-IN')}`;
 const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

 // Normalize backend variability into safe, typed UI shape
 const normalizeUser = (u: UserRow): Required<UserRow> => {
  // Derive status if missing
  const normStatus: UserStatus =
    (u.status as UserStatus) ??
    (u.isActive === false ? 'inactive' : 'active');

  // Derive role if missing or legacy
  let normRole: UserRole =
    (u.role as UserRole) ??
    (u.isAdmin ? 'admin' : 'customer');

  // Map any unexpected 'user' to 'customer'
  if ((normRole as string) === 'user') normRole = 'customer';

  const orders = Number.isFinite(u.ordersCount) ? (u.ordersCount as number) : 0;
  const ltv = Number.isFinite(u.lifetimeValue) ? (u.lifetimeValue as number) : 0;

  const sessions = Array.isArray(u.sessions7d)
    ? (u.sessions7d as number[]).map((n) => (Number.isFinite(n) ? Number(n) : 0))
    : [];

  return {
    ...u,
    role: normRole,
    status: normStatus,
    ordersCount: orders,
    lifetimeValue: ltv,
    sessions7d: sessions,
    emailVerified: !!u.emailVerified,
    name: u.name || '',
    email: u.email || '',
    phone: u.phone || '',
    avatar: u.avatar || '',
    city: u.city || '',
    country: u.country || '',
    device: u.device || '',
    lastLoginAt: u.lastLoginAt || '',
    avgSessionMins: Number.isFinite(u.avgSessionMins as number) ? (u.avgSessionMins as number) : 0,
    totalMins30d: Number.isFinite(u.totalMins30d as number) ? (u.totalMins30d as number) : 0,
    isAdmin: !!u.isAdmin,
    isActive: u.isActive ?? (normStatus !== 'inactive'),
  };
};

 // tiny inline sparkline
 const TinySpark: React.FC<{ vals?: number[] }> = ({ vals }) => {
  const data = vals && vals.length ? vals : [0, 2, 3, 2, 4, 3, 5];
  const w = 60, h = 18, pad = 2;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / (data.length - 1 || 1);
  const pts = data
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden>
      <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={pts} />
    </svg>
  );
};

 const useDebouncedValue = <T,>(value: T, delay = 350) => {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return deb;
};

 const STORAGE_KEY = 'usersTab:v2';

 const UsersTab: React.FC<Props> = ({ showNotification, checkNetworkStatus }) => {
  // ------- list state -------
  const [users, setUsers] = useState<Required<UserRow>[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const qDeb = useDebouncedValue(q, 400);
  const [role, setRole] = useState<'' | UserRole>('');
  const [status, setStatus] = useState<'' | UserStatus>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastLoginAt' | 'ordersCount' | 'lifetimeValue' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ------- analytics header -------
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');

  // ------- detail drawer -------
  const [detail, setDetail] = useState<Required<UserRow> | null>(null);
  const [updating, setUpdating] = useState(false);

  // ------- selection/bulk -------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = users.length > 0 && users.every((u) => selected.has(u._id));

  // ------- reset-email cooldown -------
  const [resetCooldown, setResetCooldown] = useState<Record<string, number>>({}); // userId -> epoch ms

  // ------- abortable fetch -------
  const usersAbortRef = useRef<AbortController | null>(null);

  // ------- keyboard shortcuts -------
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Focus search with '/'
      if (e.key === '/' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // quick refresh
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        fetchUsers();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ------- persistence -------
  useEffect(() => {
    // load once
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const json = JSON.parse(raw);
        setQ(json.q ?? '');
        setRole(json.role ?? '');
        setStatus(json.status ?? '');
        setPage(json.page ?? 1);
        setLimit(json.limit ?? 10);
        setSortBy(json.sortBy ?? 'createdAt');
        setSortOrder(json.sortOrder ?? 'desc');
        setRange(json.range ?? '7d');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ q, role, status, page, limit, sortBy, sortOrder, range })
      );
    } catch {}
  }, [q, role, status, page, limit, sortBy, sortOrder, range]);

  const fetchAnalytics = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    try {
      setAnalyticsLoading(true);
      const res = await getUserAnalytics({ range });
      if (res?.success) {
        setAnalytics(res.analytics);
      } else {
        showNotification(res?.message || 'Failed to load analytics', 'error');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Failed to load analytics', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [range, checkNetworkStatus, showNotification]);

  const fetchUsers = useCallback(async () => {
    if (!checkNetworkStatus()) return;
    // cancel previous in-flight
    usersAbortRef.current?.abort();
    const ac = new AbortController();
    usersAbortRef.current = ac;
    let attempt = 0;
    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        const res = await getUsers({ page, limit, q: qDeb, role, status, sortBy, sortOrder, signal: ac.signal } as any);
        if (res?.success) {
          const list: Required<UserRow>[] = (res.users || []).map(normalizeUser);
          setUsers(list);
          setTotalUsers(res.totalUsers || list.length || 0);
          setTotalPages(res.totalPages || Math.max(1, Math.ceil((res.totalUsers || list.length || 0) / limit)));
          // clear selection on new data
          setSelected(new Set());
        } else {
          throw new Error(res?.message || 'Failed to load users');
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // ignore
        if (attempt === 0) {
          attempt = 1; // retry once
          await new Promise((r) => setTimeout(r, 250));
          return run();
        }
        showNotification(e?.message || 'Failed to load users', 'error');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [page, limit, qDeb, role, status, sortBy, sortOrder, checkNetworkStatus, showNotification]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // reset to page 1 when filters/search change (debounced for q)
  useEffect(() => {
    setPage(1);
  }, [qDeb, role, status, limit, sortBy, sortOrder]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const editField = async (user: Required<UserRow>, patch: Partial<UserRow>) => {
    if (!checkNetworkStatus()) return;
    const prev = user;
    const nextLocal = normalizeUser({ ...user, ...patch } as UserRow);
    try {
      setUpdating(true);
      // optimistic UI
      setUsers((prevList) => prevList.map((u) => (u._id === user._id ? nextLocal : u)));
      if (detail && detail._id === user._id) setDetail(nextLocal);

      const res = await updateUser(user._id, patch);
      if (res?.success) {
        showNotification('User updated', 'success');
      } else {
        throw new Error(res?.message || 'Update failed');
      }
    } catch (e: any) {
      // rollback
      setUsers((prevList) => prevList.map((u) => (u._id === user._id ? prev : u)));
      if (detail && detail._id === user._id) setDetail(prev);
      showNotification(e?.message || 'Update failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const performStatusToggle = async (u: Required<UserRow>, next: UserStatus) => {
    if (!checkNetworkStatus()) return;
    const prevStatus = u.status;
    try {
      setUpdating(true);
      // optimistic
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, status: next } : x)));
      if (detail && detail._id === u._id) setDetail({ ...u, status: next });

      const res = await toggleUserStatus(u._id, next);
      if (res?.success) {
        showNotification(`User ${next}`, 'success');
      } else {
        throw new Error(res?.message || 'Action failed');
      }
    } catch (e: any) {
      // rollback
      setUsers((prev) => prev.map((x) => (x._id === u._id ? { ...x, status: prevStatus } : x)));
      if (detail && detail._id === u._id) setDetail({ ...u, status: prevStatus });
      showNotification(e?.message || 'Action failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const removeUser = async (u: Required<UserRow>) => {
    if (!window.confirm(`Delete ${u.name || u.email}? This cannot be undone.`)) return;
    if (!checkNetworkStatus()) return;
    try {
      setUpdating(true);
      const res = await deleteUser(u._id);
      if (res?.success) {
        setUsers((prev) => prev.filter((x) => x._id !== u._id));
        setDetail((d) => (d && d._id === u._id ? null : d));
        setSelected((sel) => {
          const n = new Set(sel);
          n.delete(u._id);
          return n;
        });
        showNotification('User deleted', 'success');
      } else {
        throw new Error(res?.message || 'Delete failed');
      }
    } catch (e: any) {
      showNotification(e?.message || 'Delete failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const nowMs = () => Date.now();
  const cooldownMs = 60_000; // 60s per user to avoid accidental spamming
  const resetTimeLeft = (userId: string) => Math.max(0, (resetCooldown[userId] || 0) - nowMs());

  const resetPassword = async (u: Required<UserRow>) => {
    if (!checkNetworkStatus()) return;
    const left = resetTimeLeft(u._id);
    if (left > 0) {
      showNotification(`Please wait ${Math.ceil(left / 1000)}s before resending.`, 'info');
      return;
    }
    try {
      setUpdating(true);
      setResetCooldown((m) => ({ ...m, [u._id]: nowMs() + cooldownMs }));
      const res = await sendPasswordResetEmail(u._id);
      if (res?.success) showNotification('Password reset email sent', 'success');
      else throw new Error(res?.message || 'Failed to send reset email');
    } catch (e: any) {
      // clear cooldown on explicit failure so user can retry
      setResetCooldown((m) => {
        const n = { ...m };
        delete n[u._id];
        return n;
      });
      showNotification(e?.message || 'Failed to send reset email', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const verifiedBadge = (ok?: boolean) => (
    <span className={`badge ${ok ? 'verified' : 'unverified'}`}>{ok ? 'Verified' : 'Unverified'}</span>
  );

  // --------- BULK ACTIONS ---------
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u._id)));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const withSelectionGuard = (fn: () => void) => {
    if (selected.size === 0) {
      showNotification('Select at least one user first', 'info');
      return;
    }
    fn();
  };

  const bulkBan = () =>
    withSelectionGuard(async () => {
      if (!checkNetworkStatus()) return;
      setUpdating(true);
      const ids = Array.from(selected);
      // optimistic
      setUsers((prev) => prev.map((u) => (selected.has(u._id) ? { ...u, status: 'banned' } : u)));
      try {
        await Promise.all(ids.map((id) => toggleUserStatus(id, 'banned')));
        showNotification('Selected users banned', 'success');
      } catch (e: any) {
        showNotification('Some actions failed. Refresh to verify.', 'error');
      } finally {
        setUpdating(false);
      }
    });

  const bulkActivate = () =>
    withSelectionGuard(async () => {
      if (!checkNetworkStatus()) return;
      setUpdating(true);
      const ids = Array.from(selected);
      setUsers((prev) => prev.map((u) => (selected.has(u._id) ? { ...u, status: 'active' } : u)));
      try {
        await Promise.all(ids.map((id) => toggleUserStatus(id, 'active')));
        showNotification('Selected users activated', 'success');
      } catch (e: any) {
        showNotification('Some actions failed. Refresh to verify.', 'error');
      } finally {
        setUpdating(false);
      }
    });

  const bulkDelete = () =>
    withSelectionGuard(async () => {
      if (!window.confirm(`Delete ${selected.size} users? This cannot be undone.`)) return;
      if (!checkNetworkStatus()) return;
      setUpdating(true);
      const ids = Array.from(selected);
      try {
        await Promise.all(ids.map((id) => deleteUser(id)));
        setUsers((prev) => prev.filter((u) => !selected.has(u._id)));
        setSelected(new Set());
        showNotification('Selected users deleted', 'success');
      } catch (e: any) {
        showNotification('Some deletions failed. Refresh to verify.', 'error');
      } finally {
        setUpdating(false);
      }
    });

  const exportCSV = () => {
    const header = [
      'id','name','email','emailVerified','phone','role','status','city','country','device','createdAt','lastLoginAt','orders','lifetimeValue','avgSessionMins','totalMins30d'
    ];
    const rows = (users.filter((u) => selected.size ? selected.has(u._id) : true)).map((u) => [
      u._id,
      u.name,
      u.email,
      String(!!u.emailVerified),
      u.phone || '',
      u.role,
      u.status,
      u.city || '',
      u.country || '',
      u.device || '',
      u.createdAt,
      u.lastLoginAt || '',
      String(u.ordersCount ?? 0),
      String(u.lifetimeValue ?? 0),
      String(u.avgSessionMins ?? 0),
      String(u.totalMins30d ?? 0),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => showNotification('Copied', 'info'),
      () => showNotification('Failed to copy', 'error')
    );
  };

  // client-side computed label values to avoid crashes
  const rowsView = users;

  const showingFrom = Math.min((page - 1) * limit + 1, totalUsers || 0);
  const showingTo = Math.min(page * limit, totalUsers || 0);

  return (
    <div className="users-admin" aria-live="polite">
      {/* Analytics Header */}
      <div className="users-analytics" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>👤 Users</h2>
          <select value={range} onChange={(e) => setRange(e.target.value as any)} aria-label="Analytics range">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <small style={{ color: '#666' }}>{rangeToLabel[range]}</small>
        </div>

        {analyticsLoading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading analytics…</p></div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-title">DAU</div>
              <div className="stat-number">{analytics?.dau ?? '—'}</div>
              {analytics?.trend7 && (
                <div className="stat-spark"><TinySpark vals={analytics.trend7} /></div>
              )}
            </div>
            <div className="stat-card">
              <div className="stat-title">WAU</div>
              <div className="stat-number">{analytics?.wau ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">MAU</div>
              <div className="stat-number">{analytics?.mau ?? '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Avg Session</div>
              <div className="stat-number">{analytics?.avgSessionMins ? `${analytics.avgSessionMins}m` : '—'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Returning (7d)</div>
              <div className="stat-number">{analytics?.returning7d ?? '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="users-header" role="region" aria-label="User filters">
        <input
          ref={searchRef}
          placeholder="Search name/email/phone… (Press / to focus)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
          aria-label="Search users"
        />
        <div className="filters-row">
          <select value={role} onChange={(e) => setRole(e.target.value as any)} aria-label="Role filter">
            <option value="">All roles</option>
            <option value="customer">Customer</option>
            <option value="seller">Seller</option>
            <option value="admin">Admin</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="Status filter">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="banned">Banned</option>
          </select>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} aria-label="Rows per page">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button onClick={fetchUsers} className="refresh-btn" title="Refresh (Ctrl/Cmd+R)">🔄 Refresh</button>
        </div>

        {/* Bulk toolbar */}
        <div className="bulk-toolbar">
          <span className="muted small">{selected.size ? `${selected.size} selected` : `${totalUsers} total`}</span>
          <div className="bulk-actions">
            <button onClick={exportCSV} className="chip-btn" title="Export CSV of (selected or all)">⬇️ Export CSV</button>
            <button onClick={bulkActivate} className="chip-btn" disabled={!selected.size}>✅ Activate</button>
            <button onClick={bulkBan} className="chip-btn danger" disabled={!selected.size}>🚫 Ban</button>
            <button onClick={bulkDelete} className="chip-btn danger" disabled={!selected.size}>🗑️ Delete</button>
          </div>
        </div>
      </div>

      {/* Table / Cards */}
      <div className="users-table-wrap">
        {loading ? (
          <div className="loading-state"><div className="spinner">⏳</div><p>Loading users…</p></div>
        ) : rowsView.length === 0 ? (
          <div className="empty-state">
            <p>🗒 No users found</p>
            {(q || role || status) && (
              <button className="chip-btn" onClick={() => { setQ(''); setRole(''); setStatus(''); }}>Clear filters</button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop/Tablet Table */}
            <div className="inventory-table-container table-scroll">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th style={{ width: 26 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all"/>
                    </th>
                    <th>User</th>
                    <th onClick={() => handleSort('name')} className="sortable" aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th onClick={() => handleSort('ordersCount')} className="sortable" aria-sort={sortBy === 'ordersCount' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      Orders {sortBy === 'ordersCount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => handleSort('lifetimeValue')} className="sortable" aria-sort={sortBy === 'lifetimeValue' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      LTV {sortBy === 'lifetimeValue' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>7d Activity</th>
                    <th onClick={() => handleSort('lastLoginAt')} className="sortable" aria-sort={sortBy === 'lastLoginAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      Last Login {sortBy === 'lastLoginAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsView.map((u) => {
                    const safeStatus: UserStatus = (u.status as UserStatus) ?? 'active';
                    const safeRole: UserRole = (u.role as UserRole) ?? 'customer';
                    const left = resetTimeLeft(u._id);
                    return (
                      <tr key={u._id} className={selected.has(u._id) ? 'row-selected' : ''}>
                        <td>
                          <input type="checkbox" checked={selected.has(u._id)} onChange={() => toggleRow(u._id)} aria-label={`Select ${u.email}`}/>
                        </td>
                        <td>
                          <div className="user-cell">
                            {u.avatar ? (
                              <img
                                src={generateResponsiveImageUrl(u.avatar, { width: 44, height: 44, crop: 'fill' })}
                                alt={u.name || u.email}
                                className="user-avatar"
                                onError={(e) => ((e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22><rect width=%2244%22 height=%2244%22 fill=%22%23eee%22/></svg>')}
                              />
                            ) : (
                              <div className="no-image avatar-fallback" title="No avatar">👤</div>
                            )}
                            <div>
                              <div className="user-name">{u.name || '—'}</div>
                              <small className="muted">
                                {u.city ? `${u.city}${u.country ? ', ' + u.country : ''}` : (u.country || '—')}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {/* Inline editable name */}
                          <InlineEdit
                            text={u.name || '—'}
                            placeholder="Name"
                            onSave={(val) => {
                              if (val !== u.name) return editField(u, { name: val });
                            }}
                          />
                        </td>
                        <td>
                          <div className="email-cell">
                            <span className="mono" title="Click to copy" onClick={() => copy(u.email)}>{u.email}</span>{verifiedBadge(u.emailVerified)}
                          </div>
                          <InlineEdit
                            text={u.phone || '—'}
                            placeholder="Phone"
                            pattern={/^\+?\d[\d\s-]{6,}$/}
                            onSave={async (val: string) => {
                              if (val !== u.phone) await editField(u, { phone: val });
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={safeRole}
                            onChange={(e) => editField(u, { role: e.target.value as UserRole })}
                            disabled={updating}
                          >
                            <option value="customer">Customer</option>
                            <option value="seller">Seller</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>{u.ordersCount ?? 0}</td>
                        <td>{toINR(u.lifetimeValue)}</td>
                        <td>
                          <div className="spark-wrap">
                            <TinySpark vals={u.sessions7d} />
                            <small className="muted">{u.avgSessionMins ? `${u.avgSessionMins}m avg` : '—'}</small>
                          </div>
                        </td>
                        <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                        <td>
                          <span className={`status ${safeStatus}`}>{upper(safeStatus)}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="edit-btn" title="View details" onClick={() => setDetail(u)}>👁️</button>
                            {safeStatus !== 'banned' ? (
                              <button className="delete-btn" title="Ban user" onClick={() => performStatusToggle(u, 'banned')}>🚫</button>
                            ) : (
                              <button className="edit-btn" title="Unban user" onClick={() => performStatusToggle(u, 'active')}>♻️</button>
                            )}
                            <button
                              className="edit-btn"
                              title={left ? `Wait ${Math.ceil(left / 1000)}s` : 'Send password reset'}
                              onClick={() => resetPassword(u)}
                              disabled={updating || !!left}
                            >
                              🔑
                            </button>
                            <button className="delete-btn" title="Delete user" onClick={() => removeUser(u)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards (very small screens) */}
            <div className="users-cards">
              {rowsView.map((u) => {
                const safeStatus: UserStatus = (u.status as UserStatus) ?? 'active';
                const safeRole: UserRole = (u.role as UserRole) ?? 'customer';
                const left = resetTimeLeft(u._id);
                return (
                  <div key={u._id} className={`user-card ${selected.has(u._id) ? 'row-selected' : ''}`}>
                    <div className="user-card-head">
                      <input type="checkbox" checked={selected.has(u._id)} onChange={() => toggleRow(u._id)} aria-label={`Select ${u.email}`}/>
                      {u.avatar ? (
                        <img
                          src={generateResponsiveImageUrl(u.avatar, { width: 56, height: 56, crop: 'fill' })}
                          alt={u.name || u.email}
                          className="user-avatar-lg"
                        />
                      ) : (
                        <div className="no-image avatar-lg-fallback">👤</div>
                      )}
                      <div className="user-card-id">
                        <div className="user-name-lg">{u.name || '—'}</div>
                        <div className="muted small">
                          <span className="mono" onClick={() => copy(u.email)} title="Copy email">{u.email}</span> {verifiedBadge(u.emailVerified)}
                        </div>
                      </div>
                      <span className={`status chip ${safeStatus}`}>{upper(safeStatus)}</span>
                    </div>

                    <div className="user-card-body">
                      <div><strong>Phone:</strong> {u.phone || '—'}</div>
                      <div><strong>Role:</strong>{' '}
                        <select
                          value={safeRole}
                          onChange={(e) => editField(u, { role: e.target.value as UserRole })}
                          disabled={updating}
                        >
                          <option value="customer">Customer</option>
                          <option value="seller">Seller</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div><strong>Orders:</strong> {u.ordersCount ?? 0}</div>
                      <div><strong>LTV:</strong> {toINR(u.lifetimeValue)}</div>
                      <div><strong>Last Login:</strong> {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</div>
                      <div className="spark-wrap mt8">
                        <TinySpark vals={u.sessions7d} />
                        <small className="muted">{u.avgSessionMins ? `${u.avgSessionMins}m avg` : '—'}</small>
                      </div>
                    </div>

                    <div className="user-card-actions">
                      {safeStatus !== 'banned' ? (
                        <button className="chip-btn danger" onClick={() => performStatusToggle(u, 'banned')}>🚫 Ban</button>
                      ) : (
                        <button className="chip-btn" onClick={() => performStatusToggle(u, 'active')}>♻️ Unban</button>
                      )}
                      <button className="chip-btn" onClick={() => setDetail(u)}>👁️ View</button>
                      <button className="chip-btn" onClick={() => resetPassword(u)} disabled={!!left} title={left ? `Wait ${Math.ceil(left / 1000)}s` : 'Send reset'}>🔑 Reset</button>
                      <button className="chip-btn danger" onClick={() => removeUser(u)}>🗑️ Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-controls">
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(1)}>⏮️ First</button>
            <button className="pagination-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>⬅️ Prev</button>
            <span className="page-indicator">
              Page {page} / {totalPages}
              <span className="muted"> — showing {showingFrom}-{showingTo} of {totalUsers}</span>
            </span>
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next ➡️</button>
            <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last ⏭️</button>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      {detail && (
        <div className="drawer-backdrop" onClick={() => setDetail(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="drawer-header">
              <h3>👤 User Details</h3>
              <button onClick={() => setDetail(null)} aria-label="Close">✕</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-id">
                {detail.avatar ? (
                  <img
                    src={generateResponsiveImageUrl(detail.avatar, { width: 72, height: 72, crop: 'fill' })}
                    alt={detail.name || detail.email}
                    className="user-avatar-xl"
                  />
                ) : (
                  <div className="no-image avatar-xl-fallback">👤</div>
                )}
                <div>
                  <div className="drawer-name">{detail.name || '—'}</div>
                  <div className="muted">
                    <span className="mono" onClick={() => copy(detail.email)} title="Copy email">{detail.email}</span> {verifiedBadge(detail.emailVerified)}
                  </div>
                </div>
              </div>

              <div className="detail-grid">
                <div><strong>Phone:</strong> {detail.phone || '—'}</div>
                <div><strong>Role:</strong> {detail.role}</div>
                <div><strong>Status:</strong> {detail.status}</div>
                <div><strong>Location:</strong> {detail.city || '—'}{detail.country ? `, ${detail.country}` : ''}</div>
                <div><strong>Device:</strong> {detail.device || '—'}</div>
                <div><strong>Joined:</strong> {new Date(detail.createdAt).toLocaleString()}</div>
                <div><strong>Last Login:</strong> {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : '—'}</div>
                <div><strong>Orders:</strong> {detail.ordersCount ?? 0}</div>
                <div><strong>Lifetime Value:</strong> {toINR(detail.lifetimeValue)}</div>
                <div><strong>Avg Session:</strong> {detail.avgSessionMins ? `${detail.avgSessionMins}m` : '—'}</div>
                <div><strong>Total Time (30d):</strong> {detail.totalMins30d ? `${detail.totalMins30d}m` : '—'}</div>
              </div>

              <div className="mt12">
                <div className="strong mb6">Last 7 days activity</div>
                <TinySpark vals={detail.sessions7d} />
              </div>
            </div>

            <div className="drawer-footer">
              <select
                value={detail.role}
                onChange={(e) => editField(detail, { role: e.target.value as UserRole })}
                disabled={updating}
              >
                <option value="customer">Customer</option>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={detail.status}
                onChange={(e) => performStatusToggle(detail, e.target.value as UserStatus)}
                disabled={updating}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="banned">Banned</option>
              </select>
              <button className="edit-btn" onClick={() => resetPassword(detail)} disabled={updating || !!resetTimeLeft(detail._id)} title="Send password reset">🔑 Reset Password</button>
              <button className="delete-btn" onClick={() => removeUser(detail)} disabled={updating}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; cursor: pointer; }
        .muted { color: #666; }
        .small { font-size: 12px; }
        .strong { font-weight: 600; }
        .mb6 { margin-bottom: 6px; }
        .mt8 { margin-top: 8px; }
        .mt12 { margin-top: 12px; }

        .users-admin .badge { font-size: 11px; padding: 2px 6px; border-radius: 999px; border: 1px solid #ddd; }
        .users-admin .badge.verified { color: #065f46; background: #d1fae5; border-color: #a7f3d0; }
        .users-admin .badge.unverified { color: #92400e; background: #fef3c7; border-color: #fde68a; }

        .stats-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 520px) { .stats-grid { grid-template-columns: 1fr; } }

        .users-admin .stat-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 12px; }
        .users-admin .stat-title { color: #666; font-size: 12px; }
        .users-admin .stat-number { font-weight: 700; font-size: 20px; }

        .users-header { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 12px; }
        .users-header input { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; }
        .filters-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .filters-row select, .filters-row .refresh-btn { padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; background: white; }

        .bulk-toolbar { display: flex; justify-content: space-between; align-items: center; }
        .bulk-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip-btn { border: 1px solid #ddd; background: #fafafa; padding: 6px 10px; border-radius: 999px; cursor: pointer; }
        .chip-btn.danger { background: #fee2e2; border-color: #fecaca; }

        .table-scroll { overflow-x: auto; }
        .inventory-table { min-width: 1100px; border-collapse: separate; border-spacing: 0 6px; }
        .inventory-table thead th { text-align: left; font-weight: 600; color: #333; }
        .inventory-table .sortable { cursor: pointer; }
        .inventory-table tbody tr { background: #fff; border: 1px solid #eee; }
        .inventory-table tbody tr.row-selected { outline: 2px solid #bfdbfe; }

        .user-cell { display: flex; align-items: center; gap: 8px; }
        .user-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
        .avatar-fallback { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: #f5f5f5; }

        .email-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .spark-wrap { display: flex; flex-direction: column; gap: 2px; }

        .status { padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #ddd; }
        .status.active { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
        .status.inactive { color: #92400e; background: #fffbeb; border-color: #fde68a; }
        .status.banned { color: #991b1b; background: #fee2e2; border-color: #fecaca; }

        .action-buttons { display: flex; gap: 6px; }
        .edit-btn, .delete-btn { border: none; background: #f5f5f5; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
        .delete-btn { background: #fee2e2; }

        .pagination { margin-top: 12px; display: flex; justify-content: center; }
        .pagination-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pagination-btn { padding: 6px 10px; border: 1px solid #ddd; background: white; border-radius: 6px; }
        .page-indicator { padding: 6px 10px; }

        /* Drawer */
        .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; justify-content: flex-end; z-index: 1000; }
        .drawer { width: 520px; max-width: 100%; height: 100%; background: #fff; display: flex; flex-direction: column; }
        .drawer-header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
        .drawer-body { padding: 14px; overflow: auto; flex: 1; }
        .drawer-footer { padding: 12px 14px; border-top: 1px solid #eee; display: flex; gap: 8px; flex-wrap: wrap; }
        .drawer-id { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
        .drawer-name { font-weight: 700; font-size: 18px; }
        .user-avatar-xl { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; }
        .avatar-xl-fallback { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; background: #f5f5f5; }

        .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        @media (max-width: 520px) { .detail-grid { grid-template-columns: 1fr; } }

        /* Mobile Cards (shown under 720px) */
        .users-cards { display: none; }
        @media (max-width: 720px) {
          .inventory-table-container { display: none; }
          .users-cards { display: grid; gap: 10px; }
          .user-card { background: #fff; border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
          .user-card-head { display: grid; grid-template-columns: auto auto 1fr auto; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid #f2f2f2; }
          .user-avatar-lg { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
          .avatar-lg-fallback { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: #f5f5f5; }
          .user-card-id { min-width: 0; }
          .user-name-lg { font-weight: 700; }
          .chip { padding: 4px 10px; font-size: 12px; }
          .user-card-body { padding: 12px; display: grid; gap: 6px; }
          .user-card-actions { padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; border-top: 1px solid #f2f2f2; }
          .chip-btn { border: 1px solid #ddd; background: #fafafa; padding: 6px 10px; border-radius: 999px; cursor: pointer; }
          .chip-btn.danger { background: #fee2e2; border-color: #fecaca; }
        }
      `}</style>
    </div>
  );
};

// ---------- small reusable inline edit control ----------
const InlineEdit: React.FC<{
  text: string;
  placeholder?: string;
  onSave: (val: string) => void | Promise<void>;
  pattern?: RegExp; // optional validation
}> = ({ text, placeholder = '', onSave, pattern }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setVal(text); }, [text]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const v = val.trim();
    if (!v) { setErr('Required'); return; }
    if (pattern && !pattern.test(v)) { setErr('Invalid format'); return; }
    setErr('');
    await onSave(v);
    setEditing(false);
  };

  return (
    <div className="inline-edit">
      {editing ? (
        <span>
          <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key==='Enter'?commit():e.key==='Escape'?setEditing(false):null} placeholder={placeholder} />
          <button className="chip-btn" onClick={commit} title="Save">💾</button>
          <button className="chip-btn" onClick={() => setEditing(false)} title="Cancel">✖</button>
          {err && <small className="err">{err}</small>}
        </span>
      ) : (
        <span>
          <span className="inline-text" title="Click to edit" onClick={() => setEditing(true)}>{text}</span>
        </span>
      )}
      <style>{`
        .inline-text { border-bottom: 1px dashed transparent; cursor: pointer; }
        .inline-text:hover { border-bottom-color: #ddd; }
        .inline-edit input { padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; }
        .inline-edit .err { color: #b91c1c; margin-left: 6px; }
      `}</style>
    </div>
  );
};

export default UsersTab;
