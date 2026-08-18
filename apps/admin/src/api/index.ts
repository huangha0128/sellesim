import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export default http;

export const adminApi = {

  getTigerStatus: () => http.get('/admin/tiger/status'),
  syncTigerRegions: () => http.post('/admin/tiger/sync-regions'),
  syncTigerPackages: () => http.post('/admin/tiger/sync-packages'),
  syncTigerAll: () => http.post('/admin/tiger/sync-all'),
  getDashboard: () => http.get('/admin/dashboard'),
  getOrders: () => http.get('/admin/orders'),
  refundOrder: (orderNo: string, reason?: string) =>
    http.post(`/admin/orders/${orderNo}/refund`, { reason }),
  getEsims: () => http.get('/admin/esims'),
  getCards: () => http.get('/admin/cards'),
  addCards: (iccids: string[], remark?: string) => http.post('/admin/cards', { iccids, remark }),
  deleteCard: (iccid: string) => http.delete(`/admin/cards/${iccid}`),
  getCountries: (params?: any) => http.get('/admin/countries', { params }),
  getPackagesPage: (params?: any) => http.get('/admin/packages/page', { params }),
  createCountry: (data: any) => http.post('/admin/countries', data),
  updateCountry: (code: string, data: any) => http.put(`/admin/countries/${code}`, data),
  deleteCountry: (code: string) => http.delete(`/admin/countries/${code}`),
  createPackage: (data: any) => http.post('/admin/packages', data),
  updatePackage: (id: string, data: any) => http.put(`/admin/packages/${id}`, data),
  deletePackage: (id: string) => http.delete(`/admin/packages/${id}`),
};
