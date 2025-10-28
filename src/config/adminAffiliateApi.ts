import api from './api';

export const listAffiliates = (params: { page?: number; limit?: number; q?: string } = {}) =>
  api.get('/admin/affiliates/affiliates', { params }).then(r => r.data);

export const getAffiliate = (id: string) =>
  api.get(`/admin/affiliates/affiliates/${id}`).then(r => r.data);

export const listAttributions = (params: { affiliateId?: string; monthKey?: string; status?: string; limit?: number } = {}) =>
  api.get('/admin/affiliates/attributions', { params }).then(r => r.data);

export const exportAttributionsCsv = (params: { affiliateId?: string; monthKey?: string }) =>
  api.get('/admin/affiliates/attributions/export/csv', { params, responseType: 'blob' }).then(r => r.data);

export const listPayouts = (params: { status?: string; monthKey?: string; limit?: number } = {}) =>
  api.get('/admin/affiliates/payouts', { params }).then(r => r.data);

export const approvePayout = (id: string, body: { txnId: string; method?: string; note?: string }) =>
  api.post(`/admin/affiliates/payouts/${id}/approve`, body).then(r => r.data);

export const rejectPayout = (id: string, body: { reason?: string }) =>
  api.post(`/admin/affiliates/payouts/${id}/reject`, body).then(r => r.data);

export const updateAffiliateRules = (id: string, tiers: Array<{ min: number; rate: number }>) =>
  api.post(`/admin/affiliates/affiliates/${id}/rules`, { tiers }).then(r => r.data);

export const adjustAffiliate = (id: string, body: { amount: number; note?: string; monthKey?: string }) =>
  api.post(`/admin/affiliates/affiliates/${id}/adjust`, body).then(r => r.data);
