import axios from 'axios';

export const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 统一响应解包：后端返回 { code, message, data }
export function unwrap<T>(res: { data: { code?: number; message?: string; data: T } }): { code: number; message: string; data: T } {
  const body = res.data;
  return {
    code: body.code ?? 0,
    message: body.message ?? '',
    data: body.data,
  };
}

export function getErrorMessage(e: any, fallback = '请求失败'): string {
  return e?.response?.data?.message || e?.message || fallback;
}

// ---------- 类型定义 ----------
export interface Country {
  code: string;
  name: string;
  en?: string;
  flag?: string;
  pinyin?: string;
  cat?: string;
  hot?: number;
  tier?: number;
  intro?: string;
  _count?: { packages?: number };
  packages?: unknown[];
}

export interface PackageItem {
  id: string;
  countryCode?: string;
  gb: number;
  days: number;
  price: number;
  name?: string;
  type?: string;
  network?: string;
  speed?: string;
  coverage?: string;
  desc?: string;
  tag?: string;
  tagColor?: string;
  isFeatured?: boolean;
  tigerPkgId?: number | null;
  tigerPid?: string;
  features?: string;
  installSteps?: string;
  country?: Country;
}

export interface Order {
  id: string;
  orderNo: string;
  email?: string;
  payMethod?: string;
  price: number;
  status: string;
  refundedAt?: string | null;
  createdAt?: string;
  package?: PackageItem;
}

export interface Esim {
  id: string;
  iccid: string;
  activationCode?: string;
  status?: string;
  expireAt?: string;
  used?: number;
  order?: { package?: PackageItem };
}

export interface Card {
  iccid: string;
  remark?: string;
  used?: boolean;
  createdAt?: string;
}

export interface DashboardStats {
  countryCount: number;
  packageCount: number;
  orderCount: number;
  paidOrders: number;
  esimCount: number;
  totalRevenue: number;
}

export interface TigerStatus {
  configured?: boolean;
  baseUrl?: string;
  mode?: string;
  countryCount?: number;
  packageCount?: number;
  iccidPoolSize?: number;
  synced?: boolean;
}

// ---------- 接口 ----------
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
  createCountry: (data: any) => http.post('/admin/countries', data),
  updateCountry: (code: string, data: any) => http.put(`/admin/countries/${code}`, data),
  deleteCountry: (code: string) => http.delete(`/admin/countries/${code}`),

  getPackagesPage: (params?: any) => http.get('/admin/packages/page', { params }),
  createPackage: (data: any) => http.post('/admin/packages', data),
  updatePackage: (id: string, data: any) => http.put(`/admin/packages/${id}`, data),
  deletePackage: (id: string) => http.delete(`/admin/packages/${id}`),
};