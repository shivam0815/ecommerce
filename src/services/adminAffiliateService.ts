import api from '../config/api';


export const adminListAffiliates = (params?: any) =>
  api.get('/admin/affiliates', { params }).then(r => r.data);

export const adminGetAffiliate = (id: string) =>
  api.get(`/admin/affiliates/${id}`).then(r => r.data);

export const adminListAttributions = (params?: any) =>
  api.get('/admin/attributions', { params }).then(r => r.data);

export const adminListPayouts = (params?: any) =>
  api.get('/admin/payouts', { params }).then(r => r.data);

export const adminApprovePayout = (id: string, payload: { txnId: string; method?: string; note?: string }) =>
  api.post(`/admin/payouts/${id}/approve`, payload).then(r => r.data);

export const adminRejectPayout = (id: string, reason?: string) =>
  api.post(`/admin/payouts/${id}/reject`, { reason }).then(r => r.data);

export const adminUpdateRules = (id: string, tiers: { min: number; rate: number }[]) =>
  api.post(`/admin/affiliates/${id}/rules`, { tiers }).then(r => r.data);

export const adminAdjustCommission = (id: string, amount: number, note?: string, monthKey?: string) =>
  api.post(`/admin/affiliates/${id}/adjust`, { amount, note, monthKey }).then(r => r.data);
