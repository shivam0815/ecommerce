// src/services/referralService.ts
import api from '../config/api';

export const getReferralSummary = async () => {
  const res = await api.get('/api/referral/summary'); // ← added /api
  return res.data;
};

export const getReferralHistory = async () => {
  const res = await api.get('/api/referral/history'); // ← added /api
  return res.data;
};

export const requestReferralPayout = async (monthKey: string) => {
  const res = await api.post('/api/referral/request-payout', { monthKey }); // ← added /api
  return res.data;
};
