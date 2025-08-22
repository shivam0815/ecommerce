// src/components/profile/SecurityTab.tsx
import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import clsx from 'clsx';
import {
  KeyIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  DevicePhoneMobileIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon,
  QrCodeIcon,
} from '@heroicons/react/24/solid';

type Session = {
  _id: string;
  ip?: string;
  userAgent?: string;
  createdAt?: string;
  lastSeenAt?: string;
  current?: boolean;
};

const SecurityTab: React.FC = () => {
  // Change password
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changing, setChanging] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // 2FA (optional backend)
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [toggling2fa, setToggling2fa] = useState(false);

  // Load sessions (if supported)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/sessions');
        setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []);
      } catch {
        setSessions(null); // hide section if backend not available
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, []);

  // Load 2FA status (if supported)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/auth/2fa/status');
        setTwoFAEnabled(!!res.data?.enabled);
      } catch {
        setTwoFAEnabled(null); // hide section if backend not available
      }
    })();
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPwd || !newPwd || !confirmPwd) return alert('Fill all fields');
    if (newPwd !== confirmPwd) return alert('New password and confirm do not match');

    try {
      setChanging(true);
      const res = await api.post('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd });
      alert(res.data?.message || 'Password changed successfully ✅');
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  const revokeSession = async (id: string) => {
    try {
      setRevoking(id);
      await api.post('/auth/sessions/revoke', { sessionId: id });
      setSessions((prev) => (prev ? prev.filter((s) => s._id !== id) : prev));
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    try {
      setRevokingAll(true);
      await api.post('/auth/sessions/revoke-all');
      // keep current session, drop others (if API returns that behavior)
      setSessions((prev) => (prev ? prev.filter((s) => s.current) : prev));
      alert('All other sessions revoked ✅');
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to revoke all');
    } finally {
      setRevokingAll(false);
    }
  };

  const startEnroll2FA = async () => {
    try {
      setEnrolling(true);
      const res = await api.post('/auth/2fa/init');
      setQr(res.data?.qr || null);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to start 2FA setup');
    } finally {
      setEnrolling(false);
    }
  };

  const enable2FA = async () => {
    if (!otp) return alert('Enter the code from your authenticator app');
    try {
      setToggling2fa(true);
      await api.post('/auth/2fa/enable', { otp });
      setTwoFAEnabled(true);
      setQr(null); setOtp('');
      alert('Two-factor authentication enabled ✅');
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to enable 2FA');
    } finally {
      setToggling2fa(false);
    }
  };

  const disable2FA = async () => {
    try {
      setToggling2fa(true);
      await api.post('/auth/2fa/disable');
      setTwoFAEnabled(false);
      setQr(null); setOtp('');
      alert('Two-factor authentication disabled');
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to disable 2FA');
    } finally {
      setToggling2fa(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Change password */}
      <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">Use a strong, unique password.</p>
        </div>
        <form onSubmit={changePassword} className="p-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
              required
              minLength={8}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={changing}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 transition disabled:opacity-50"
            >
              {changing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <CheckCircleIcon className="w-5 h-5" />}
              {changing ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Sessions (optional) */}
      {sessions !== null && (
        <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center gap-2">
              <DevicePhoneMobileIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">Active Sessions</h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">Manage devices that are logged into your account.</p>
          </div>

          <div className="p-6 space-y-3">
            {loadingSessions && <div className="text-gray-600">Loading sessions…</div>}
            {!loadingSessions && sessions?.length === 0 && <div className="text-gray-600">No other sessions.</div>}
            {sessions?.map((s) => (
              <div key={s._id} className="p-4 border rounded-xl flex items-center justify-between bg-gray-50">
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">{s.userAgent || 'Device'}</div>
                  <div className="text-gray-600">
                    IP: {s.ip || '—'} • Last seen: {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.current && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Current</span>
                  )}
                  {!s.current && (
                    <button
                      onClick={() => revokeSession(s._id)}
                      disabled={revoking === s._id}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      {revoking === s._id ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <XMarkIcon className="w-4 h-4" />}
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sessions && sessions.some((s) => !s.current) && (
              <div className="flex justify-end">
                <button
                  onClick={revokeAll}
                  disabled={revokingAll}
                  className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {revokingAll ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <LockClosedIcon className="w-4 h-4" />}
                  Revoke All Other Sessions
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Two-factor auth (optional) */}
      {twoFAEnabled !== null && (
        <section className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-gray-900">Two-Factor Authentication (2FA)</h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Add an extra layer of security using an authenticator app.
            </p>
          </div>

          <div className="p-6 space-y-4">
            {twoFAEnabled ? (
              <div className="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                <div>
                  <div className="font-semibold text-gray-900">2FA is enabled</div>
                  <div className="text-sm text-gray-600">You’ll be asked for a code on login.</div>
                </div>
                <button
                  onClick={disable2FA}
                  disabled={toggling2fa}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  {toggling2fa ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <XMarkIcon className="w-4 h-4" />}
                  Disable
                </button>
              </div>
            ) : (
              <>
                {!qr ? (
                  <button
                    onClick={startEnroll2FA}
                    disabled={enrolling}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {enrolling ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <QrCodeIcon className="w-4 h-4" />}
                    Start Setup
                  </button>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-gray-50">
                      <div className="font-semibold mb-2">Scan QR in your authenticator app</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt="2FA QR" className="w-56 h-56 object-contain rounded-lg border bg-white" />
                    </div>
                    <div className="p-4 border rounded-xl bg-gray-50">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-digit code</label>
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="w-full border-2 rounded-xl px-4 py-3 bg-white hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={enable2FA}
                          disabled={toggling2fa || otp.length < 6}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {toggling2fa ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                          Verify & Enable
                        </button>
                        <button
                          onClick={() => { setQr(null); setOtp(''); }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default SecurityTab;
