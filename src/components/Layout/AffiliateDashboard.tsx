import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import {
  getReferralSummary,
  getReferralHistory,
  requestReferralPayoutSimple
} from '../../services/referralService';

type Summary = {
  code: string;
  monthKey: string;
  monthOrders: number;
  monthSales: number;
  monthCommissionAccrued: number;
  lifetimeSales: number;
  lifetimeCommission: number;
  effectiveMinPayout?: number;
  rules: { minMonthlySales: number; percent: number }[];
  payouts: { monthKey: string; amount: number; status: string }[];
} | null;

type Row = {
  _id: string;
  orderId: string;
  orderNumber: string;
  monthKey: string;
  baseAmount: number;
  commissionAmount: number;
  status: 'open' | 'locked' | 'reversed';
  createdAt: string;
};

const formatDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function AffiliateDashboard({ referralCode }: { referralCode?: string }) {
  const [aff, setAff] = useState<Summary>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  type FormData = {
    accountHolder: string;
    bankAccount: string;
    ifsc: string;
    bankName: string;
    city: string;
    upiId: string;
    aadharNumber: string; // ← full 12-digit Aadhaar
    pan: string;
    [key: string]: string;
  };

  const [form, setForm] = useState<FormData>({
    accountHolder: '',
    bankAccount: '',
    ifsc: '',
    bankName: '',
    city: '',
    upiId: '',
    aadharNumber: '', // ← 12 digits
    pan: ''
  });

  const refLink = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const code = referralCode || aff?.code || '';
    return code ? `${base}?aff=${code}` : '';
  }, [referralCode, aff?.code]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, h] = await Promise.all([getReferralSummary(), getReferralHistory()]);
        setAff(s?.active === false ? null : s);
        setRows(h?.data || []);
        setErr(null);
      } catch (e: any) {
        setErr(e?.response?.data?.error || 'Failed to load affiliate data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const alreadyRequestedThisMonth =
    !!aff?.payouts?.some(
      (p) =>
        p.monthKey === aff?.monthKey &&
        ['requested', 'approved', 'paid'].includes(p.status)
    );

  const validateForm = (): string | null => {
    const aadhaar = (form.aadharNumber || '').replace(/\D/g, '');
    if (aadhaar.length !== 12) return 'Aadhaar must be exactly 12 digits.';
    const ifsc = (form.ifsc || '').trim().toUpperCase();
    // Basic IFSC format: 4 letters + 7 alphanumerics (usually digits)
    if (!/^[A-Z]{4}[A-Z0-9]{7}$/.test(ifsc)) return 'IFSC format looks invalid.';
    if (!form.accountHolder || !form.bankAccount || !form.bankName || !form.city)
      return 'Please fill all bank & address fields.';
    // UPI is allowed empty by backend (it accepts empty or valid), but if provided, validate shape:
    if (form.upiId && !/^[a-z0-9._-]+@[a-z]{3,}$/i.test(form.upiId)) return 'UPI ID format looks invalid.';
    return null;
  };

  const submitPayout = async () => {
    const v = validateForm();
    if (v) {
      alert(v);
      return;
    }
    try {
      setBusy(true);
      // Map payload to backend (expects aadharNumber field and monthKey)
      await requestReferralPayoutSimple({ ...form,aadharLast4: form.aadharNumber,monthKey: aff?.monthKey });
      alert('✅ Payout request submitted successfully');
      setShowForm(false);
    } catch (e: any) {
      const data = e?.response?.data || {};
      const meta = data.meta;
      alert(
        `${data.error || 'Failed to submit payout'}${
          meta ? ` | eligible ₹${meta.eligible ?? 0}` : ''
        }`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Affiliate Earnings</h3>
          <p className="text-sm text-gray-500">B2B referrals only</p>
        </div>
        {aff?.monthKey && (
          <button
            onClick={() => setShowForm(true)}
            disabled={alreadyRequestedThisMonth || busy}
            className={clsx(
              'px-4 py-2 rounded-lg text-white',
              alreadyRequestedThisMonth
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-black hover:bg-gray-800'
            )}
            title={
              alreadyRequestedThisMonth
                ? 'Payout already requested this month.'
                : 'Request your payout for this month.'
            }
          >
            Request Payout
          </button>
        )}
      </div>

      {/* Referral Link */}
      {(referralCode || aff?.code) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-600 mb-2">Your referral link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={refLink}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"
            />
            <button
              onClick={() => refLink && navigator.clipboard.writeText(refLink)}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white"
            >
              Copy
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(refLink)}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg border border-green-600 text-green-700"
            >
              WhatsApp
            </a>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Code: <span className="font-mono">{referralCode || aff?.code}</span>
          </div>
        </div>
      )}

      {/* KPI Section */}
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : err ? (
        <div className="text-sm text-rose-600">{err}</div>
      ) : aff ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Kpi label="This Month Orders" value={aff?.monthOrders ?? 0} />
            <Kpi label="This Month Sales" value={`₹${Number(aff?.monthSales ?? 0).toFixed(2)}`} />
            <Kpi
              label="Commission Accrued"
              value={`₹${Number(aff?.monthCommissionAccrued ?? 0).toFixed(2)}`}
            />
            <Kpi
              label="Lifetime Commission"
              value={`₹${Number(aff?.lifetimeCommission ?? 0).toFixed(2)}`}
            />
          </div>

          {/* Referral History */}
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Order</th>
                  <th className="text-right px-4 py-2">Base</th>
                  <th className="text-right px-4 py-2">Commission</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-2">#{r.orderNumber}</td>
                    <td className="px-4 py-2 text-right">
                      ₹{Number(r.baseAmount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      ₹{Number(r.commissionAmount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs',
                          r.status === 'open'
                            ? 'bg-amber-100 text-amber-700'
                            : r.status === 'locked'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-gray-500" colSpan={5}>
                      No referral orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Payouts */}
          {aff.payouts?.length ? (
            <div className="mt-6">
              <div className="text-sm text-gray-600 mb-2">Recent payouts</div>
              <div className="grid md:grid-cols-2 gap-3">
                {aff.payouts.map((p, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.monthKey}</div>
                      <div className="text-xs text-gray-500">{p.status}</div>
                    </div>
                    <div className="text-base font-semibold">
                      ₹{Number(p?.amount ?? 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-sm text-gray-600">
          Affiliate program not active for your account.
        </div>
      )}

      {/* Payout Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w/full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Payout Request</h3>

            {/* Aadhaar shows as number-only input; IFSC uppercase */}
            <input
              placeholder="accountHolder"
              value={form.accountHolder}
              onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
              className="block w-full border mb-2 p-2 rounded"
            />
            <input
              placeholder="bankAccount"
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              className="block w-full border mb-2 p-2 rounded"
            />
            <input
              placeholder="ifsc (e.g. HDFC0001452)"
              value={form.ifsc}
              onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
              className="block w-full border mb-2 p-2 rounded"
              maxLength={11}
            />
            <input
              placeholder="bankName"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="block w-full border mb-2 p-2 rounded"
            />
            <input
              placeholder="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="block w/full border mb-2 p-2 rounded"
            />
            <input
              placeholder="upiId (optional)"
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              className="block w/full border mb-2 p-2 rounded"
            />
            <input
              placeholder="aadharNumber (12 digits)"
              value={form.aadharNumber}
              onChange={(e) =>
                setForm({ ...form, aadharNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })
              }
              className="block w/full border mb-2 p-2 rounded"
              inputMode="numeric"
              maxLength={12}
            />
            <input
              placeholder="pan"
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
              className="block w/full border mb-2 p-2 rounded"
              maxLength={10}
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={submitPayout}
                disabled={busy || alreadyRequestedThisMonth}
                className={clsx(
                  'px-4 py-2 rounded text-white',
                  busy || alreadyRequestedThisMonth
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-black hover:bg-gray-800'
                )}
              >
                {busy
                  ? 'Submitting…'
                  : alreadyRequestedThisMonth
                  ? 'Already Requested'
                  : 'Submit'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="border px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
