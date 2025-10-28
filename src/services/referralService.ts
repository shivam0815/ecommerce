// src/services/referralService.ts
import api from '../config/api';

export const getReferralSummary = async () => {
  const res = await api.get('/referral/summary');
  return res.data;
};

export const getReferralHistory = async () => {
  const res = await api.get('/referral/history');
  return res.data;
};
export const requestReferralPayout = async (monthKey: string) => {
  const res = await api.post('/referral/request-payout', { monthKey });
  return res.data;
};
