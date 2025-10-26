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
