import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { getReferralSummary, getReferralHistory, requestReferralPayout } from '../../services/referralService';

type Summary = {
  code: string; monthKey: string;
  monthOrders: number; monthSales: number; monthCommissionAccrued: number;
  lifetimeSales: number; lifetimeCommission: number;
  rules: { minMonthlySales: number; percent: number }[];
  payouts: { monthKey: string; amount: number; status: string }[];
} | null;

type Row = {
  _id: string; orderId: string; orderNumber: string;
  monthKey: string; baseAmount: number; commissionAmount: number;
  status: 'open'|'locked'|'reversed'; createdAt: string;
};

const formatDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
};

export default function AffiliateDashboard({ referralCode }: { referralCode?: string }) {
  const [aff, setAff] = useState<Summary>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Affiliate Earnings</h3>
          <p className="text-sm text-gray-500">B2B referrals only</p>
        </div>
        {aff?.monthKey && (
          <button
            disabled={busy}
            onClick={async () => {
              try { setBusy(true); await requestReferralPayout(aff.monthKey); alert(`Payout requested for ${aff.monthKey}`); }
              catch (e: any) { alert(e?.response?.data?.error || 'Request failed'); }
              finally { setBusy(false); }
            }}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50"
          >
            Request Payout
          </button>
        )}
      </div>

      {/* Share */}
      {(referralCode || aff?.code) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-600 mb-2">Your referral link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={refLink} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900"/>
            <button onClick={() => refLink && navigator.clipboard.writeText(refLink)} className="px-4 py-2 rounded-lg bg-gray-900 text-white">Copy</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(refLink)}`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border border-green-600 text-green-700">WhatsApp</a>
          </div>
          <div className="mt-2 text-xs text-gray-500">Code: <span className="font-mono">{referralCode || aff?.code}</span></div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : err ? (
        <div className="text-sm text-rose-600">{err}</div>
      ) : aff ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <Kpi label="This Month Orders" value={aff?.monthOrders ?? 0} />
  <Kpi label="This Month Sales" value={`₹${Number(aff?.monthSales ?? 0).toFixed(2)}`} />
  <Kpi label="Commission Accrued" value={`₹${Number(aff?.monthCommissionAccrued ?? 0).toFixed(2)}`} />
  <Kpi label="Lifetime Commission" value={`₹${Number(aff?.lifetimeCommission ?? 0).toFixed(2)}`} />
</div>


          {/* History */}
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
                {rows.map(r=>(
                  <tr key={r._id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{formatDate(r.createdAt)}</td>
<td className="px-4 py-2">#{r.orderNumber}</td>
<td className="px-4 py-2 text-right">₹{Number(r.baseAmount ?? 0).toFixed(2)}</td>
<td className="px-4 py-2 text-right">₹{Number(r.commissionAmount ?? 0).toFixed(2)}</td>

                    <td className="px-4 py-2">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs',
                        r.status==='open' ? 'bg-amber-100 text-amber-700'
                        : r.status==='locked' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                      )}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                {rows.length===0 && <tr><td className="px-4 py-6 text-gray-500" colSpan={5}>No referral orders yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Payouts */}
          {aff.payouts?.length ? (
            <div className="mt-6">
              <div className="text-sm text-gray-600 mb-2">Recent payouts</div>
              <div className="grid md:grid-cols-2 gap-3">
                {aff.payouts.map((p,i)=>(
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.monthKey}</div>
                      <div className="text-xs text-gray-500">{p.status}</div>
                    </div>
                    <div className="text-base font-semibold"> ₹{Number(p?.amount ?? 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ):null}
        </>
      ) : (
        <div className="text-sm text-gray-600">Affiliate program not active for your account.</div>
      )}
    </motion.div>
  );
}

function Kpi({label,value}:{label:string;value:React.ReactNode}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
