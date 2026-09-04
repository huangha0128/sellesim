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
  currency?: 'CNY' | 'USD';
  onSale?: boolean;
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

/** 后台「添加套餐」目录条目：来自 TigerESIM 全量套餐，added 表示是否已在白名单 */
export interface CatalogItem extends PackageItem {
  added: boolean;
}

export interface Order {
  id: string;
  orderNo: string;
  pkgId?: string;
  email?: string;
  payMethod?: string;
  price: number;
  status: string;
  userId?: string | null;
  refundedAt?: string | null;
  refundStatus?: string | null;
  refundReason?: string | null;
  refundRequestedAt?: string | null;
  refundRejectReason?: string | null;
  refundRejectedAt?: string | null;
  createdAt?: string;
  // 套餐快照（不再嵌套 package，实时来源 TigerESIM）
  countryCode?: string | null;
  pkgName?: string | null;
  gb?: number | null;
  days?: number | null;
  package?: PackageItem;
  user?: { id: string; nickname?: string; alipayUserId?: string } | null;
}

export interface Esim {
  id: string;
  iccid: string;
  activationCode?: string;
  status?: string;
  expireAt?: string;
  used?: number;
  // 套餐快照（不再嵌套 package）
  countryCode?: string | null;
  pkgName?: string | null;
  gb?: number | null;
  days?: number | null;
  order?: { countryCode?: string | null; pkgName?: string | null; gb?: number | null; days?: number | null };
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

export interface Settings {
  displayCurrency: 'CNY' | 'USD';
  usdCnyRate: number;
}

// ---------- 接口 ----------
export const adminApi = {
  getTigerStatus: () => http.get('/admin/tiger/status'),
  syncTigerRegions: () => http.post('/admin/tiger/sync-regions'),
  syncTigerPackages: () => http.post('/admin/tiger/sync-packages'),
  syncTigerAll: () => http.post('/admin/tiger/sync-all'),

  getDashboard: () => http.get('/admin/dashboard'),
  getOrders: () => http.get('/admin/orders'),
  approveRefund: (orderNo: string, reason?: string) =>
    http.post(`/admin/orders/${orderNo}/refund`, { reason }),
  rejectRefund: (orderNo: string, reason: string) =>
    http.post(`/admin/orders/${orderNo}/refund/reject`, { reason }),

  getEsims: () => http.get('/admin/esims'),
  getCards: () => http.get('/admin/cards'),
  addCards: (iccids: string[], remark?: string) => http.post('/admin/cards', { iccids, remark }),
  deleteCard: (iccid: string) => http.delete(`/admin/cards/${iccid}`),

  getCountries: (params?: any) => http.get('/admin/countries', { params }),
  createCountry: (data: any) => http.post('/admin/countries', data),
  updateCountry: (code: string, data: any) => http.put(`/admin/countries/${code}`, data),
  deleteCountry: (code: string) => http.delete(`/admin/countries/${code}`),

  getPackagesPage: (params?: any) => http.get('/admin/packages/page', { params }),
  getPackageCatalog: (params?: any) => http.get('/admin/packages/catalog', { params }),
  updatePackage: (id: string, data: any) => http.put(`/admin/packages/${id}`, data),

  // 套餐白名单（本地 PackagePrice：只有添加并设价的套餐才在小程序/后台展示）
  updatePackagePrice: (
    tigerPkgId: number,
    data: { price?: number | null; onSale?: boolean; currency?: 'CNY' | 'USD' },
  ) => http.put(`/admin/packages/${tigerPkgId}/price`, data),
  clearPackagePrice: (tigerPkgId: number) => http.delete(`/admin/packages/${tigerPkgId}/price`),
  batchUpdatePackagePrices: (
    items: { tigerPkgId: number; price?: number | null; onSale?: boolean; currency?: 'CNY' | 'USD' }[],
  ) => http.post('/admin/packages/prices/batch', { items }),
  batchClearPackagePrices: (tigerPkgIds: number[]) =>
    http.post('/admin/packages/prices/clear', { tigerPkgIds }),

  // 汇率与展示货币设置
  getSettings: () => http.get('/admin/settings'),
  updateSettings: (data: { displayCurrency?: 'CNY' | 'USD'; usdCnyRate?: number }) =>
    http.put('/admin/settings', data),
};