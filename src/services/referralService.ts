// src/services/referralService.ts
import api from '../config/api';

export const getReferralSummary = async () => {
  const res = await api.get('/referral/summary'); // ← added /api
  return res.data;
};

export const getReferralHistory = async () => {
  const res = await api.get('/referral/history'); // ← added /api
  return res.data;
};



// src/services/referralService.ts
export const requestReferralPayoutSimple = (data: any) =>
  api.post('/referral/payout/simple', data);