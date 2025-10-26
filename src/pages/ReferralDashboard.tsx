import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getReferralSummary } from '../services/referralService';
import { useReferralLink } from '../hooks/useReferralLink';

const ReferralDashboard: React.FC = () => {
  const { user } = useAuth();
  const [sum, setSum] = useState<any>(null);
  const link = useReferralLink(); // homepage link with ?ref=

  useEffect(() => { getReferralSummary().then(setSum).catch(() => {}); }, []);

  if (!user) return <div className="p-6">Login to view referrals.</div>;
  if (!user.referralCode) return <div className="p-6">Referral code not assigned.</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Referral Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Clicks" value={sum?.clicks ?? 0}/>
        <Card title="Pending ₹" value={sum?.pending ?? 0}/>
        <Card title="Approved ₹" value={sum?.approved ?? 0}/>
        <Card title="Paid ₹" value={sum?.paid ?? 0}/>
      </div>

      <div className="p-4 border rounded-lg bg-white">
        <div className="text-sm text-gray-500 mb-1">Your shareable link</div>
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="w-full px-3 py-2 border rounded"/>
          <button
            className="px-3 py-2 border rounded"
            onClick={() => navigator.clipboard.writeText(link)}
          >Copy</button>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, value }: { title: string; value: number }) => (
  <div className="p-4 border rounded-lg bg-white">
    <div className="text-sm text-gray-500">{title}</div>
    <div className="text-xl font-bold">₹{Number(value || 0).toLocaleString('en-IN')}</div>
  </div>
);

export default ReferralDashboard;
