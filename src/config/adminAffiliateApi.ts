import adminApi from './adminApi';

export const listAffiliates = (params:any) =>
  adminApi.get('/admin/affiliates', { params }).then(r => r.data);
export const getAffiliate = (id:string) =>
  adminApi.get(`/admin/affiliates/${id}`).then(r => r.data);
export const listAttributions = (p:any) =>
  adminApi.get('/admin/affiliates/attributions', { params: p }).then(r => r.data);
export const listPayouts = (p:any) =>
  adminApi.get('/admin/affiliates/payouts', { params: p }).then(r => r.data);
export const approvePayout = (id:string, body:any) =>
  adminApi.post(`/admin/affiliates/payouts/${id}/approve`, body).then(r => r.data);
export const rejectPayout = (id:string, body:any) =>
  adminApi.post(`/admin/affiliates/payouts/${id}/reject`, body).then(r => r.data);
export const updateAffiliateRules = (id:string, tiers:any[]) =>
  adminApi.put(`/admin/affiliates/${id}/rules`, { tiers }).then(r => r.data);
export const adjustAffiliate = (id:string, body:any) =>
  adminApi.post(`/admin/affiliates/${id}/adjust`, body).then(r => r.data);
export const exportAttributionsCsv = (p:any) =>
  adminApi.get('/admin/affiliates/attributions/export', { params: p, responseType: 'blob' })
          .then(r => r.data);
