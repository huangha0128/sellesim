import axios from 'axios';
import { clearAuth, getToken, LOGIN_PATH } from '@/lib/auth';

export const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 请求拦截：为管理端接口附上管理员 JWT
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：401 说明未登录或登录已过期，清掉本地凭据并跳登录页
http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      clearAuth();
      if (!window.location.pathname.startsWith('/backend/login')) {
        window.location.href = LOGIN_PATH;
      }
    }
    return Promise.reject(error);
  },
);

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
  priority?: number;
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
  isUnlimited?: boolean;
  currency?: 'CNY' | 'USD';
  onSale?: boolean;
  name?: string;
  countryName?: string;
  countryOverride?: string; // 套餐组的自定义显示名（国家/地区维度覆盖）
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
  isUnlimited?: boolean;
  package?: PackageItem;
  user?: { id: string; nickname?: string; alipayUserId?: string } | null;
}

export interface Esim {
  id: string;
  localEsimId?: string;
  orderId?: string;
  iccid: string;
  activationCode?: string;
  smdp?: string;
  status?: string;
  activatedAt?: string;
  expireAt?: string;
  used?: number;
  gb?: number | null;
  days?: number | null;
  isUnlimited?: boolean;
  // 套餐快照（不再嵌套 package）
  countryCode?: string | null;
  pkgName?: string | null;
  pkgNameEn?: string | null;
  tigerPkgId?: number | null;
  tigerPid?: string | null;
  tigerBindingId?: number | null;
  source?: string;
  createdAt?: string;
  order?: {
    orderNo?: string;
    countryCode?: string | null;
    pkgName?: string | null;
    gb?: number | null;
    days?: number | null;
    email?: string;
    userId?: string | null;
  } | null;
}

export interface Card {
  iccid: string;
  remark?: string;
  used?: boolean;
  createdAt?: string;
}

export interface CardListResult {
  mode: 'tiger' | 'mock';
  cards: Card[];
  stats: { total: number; available: number; used: number; envOnly: number };
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

// ---- Open API v2：主体 / 密钥 / 定价 ----
export interface SubjectKey {
  id: string;
  keyId: string; // 已脱敏（ak_live_7f3a…9c21）
  name?: string;
  mode?: string;
  ipWhitelist?: string | null;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  enabled?: boolean;
  createdAt?: string;
}

export interface SubjectPackagePrice {
  id: string;
  pkgId: string;
  price?: number | null;
  markupPercent?: number | null;
  enabled?: boolean;
  createdAt?: string;
}

export interface Subject {
  id: string;
  name: string;
  status: string;
  callbackUrl?: string | null;
  defaultMarkupPercent?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
  createdAt?: string;
  keys?: SubjectKey[];
  prices?: SubjectPackagePrice[];
  _count?: { keys?: number; orders?: number };
}

// ---------- 接口 ----------
export const adminApi = {
  // 登录与账号（/login 免鉴权，其余需 Bearer token）
  login: (username: string, password: string) =>
    http.post('/admin/login', { username, password }),
  me: () => http.get('/admin/me'),
  changePassword: (oldPassword: string, newPassword: string) =>
    http.post('/admin/change-password', { oldPassword, newPassword }),

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
  refreshPackageCatalog: () => http.post('/admin/packages/catalog/refresh'),
  updatePackage: (id: string, data: any) => http.put(`/admin/packages/${id}`, data),

  // 套餐白名单（本地 PackagePrice：只有添加并设价的套餐才在小程序/后台展示）
  updatePackagePrice: (
    tigerPkgId: number,
    data: { price?: number | null; onSale?: boolean; currency?: 'CNY' | 'USD' },
  ) => http.put(`/admin/packages/${tigerPkgId}/price`, data),
  clearPackagePrice: (tigerPkgId: number) => http.delete(`/admin/packages/${tigerPkgId}/price`),
  // 设置/还原某套餐组（国家/地区）的显示名，空字符串还原默认
  updatePackageGroupName: (code: string, displayName: string) =>
    http.put(`/admin/package-groups/${encodeURIComponent(code)}`, { displayName }),
  batchUpdatePackagePrices: (
    items: { tigerPkgId: number; price?: number | null; onSale?: boolean; currency?: 'CNY' | 'USD' }[],
  ) => http.post('/admin/packages/prices/batch', { items }),
  batchClearPackagePrices: (tigerPkgIds: number[]) =>
    http.post('/admin/packages/prices/clear', { tigerPkgIds }),

  // 汇率与展示货币设置
  getSettings: () => http.get('/admin/settings'),
  updateSettings: (data: { displayCurrency?: 'CNY' | 'USD'; usdCnyRate?: number }) =>
    http.put('/admin/settings', data),

  // ---- Open API v2：主体 / 密钥 / 定价 ----
  getSubjects: () => http.get('/admin/subjects'),
  createSubject: (data: {
    name: string;
    contactName?: string;
    contactPhone?: string;
    callbackUrl?: string;
    defaultMarkupPercent?: number;
    remark?: string;
  }) => http.post('/admin/subjects', data),
  getSubject: (id: string) => http.get(`/admin/subjects/${id}`),
  updateSubject: (
    id: string,
    data: {
      name?: string;
      contactName?: string | null;
      contactPhone?: string | null;
      callbackUrl?: string | null;
      defaultMarkupPercent?: number | null;
      remark?: string | null;
      status?: string;
    },
  ) => http.put(`/admin/subjects/${id}`, data),
  suspendSubject: (id: string) => http.delete(`/admin/subjects/${id}`),

  getSubjectKeys: (id: string) => http.get(`/admin/subjects/${id}/keys`),
  addSubjectKey: (id: string, data: { mode?: string; name?: string }) =>
    http.post(`/admin/subjects/${id}/keys`, data),
  revokeSubjectKey: (id: string, keyId: string) =>
    http.post(`/admin/subjects/${id}/keys/${keyId}/revoke`),
  rotateSubjectKey: (id: string, keyId: string) =>
    http.post(`/admin/subjects/${id}/keys/${keyId}/rotate`),

  getSubjectPrices: (id: string) => http.get(`/admin/subjects/${id}/prices`),
  setSubjectPrices: (
    id: string,
    items: { pkgId: string; price?: number | null; markupPercent?: number | null; enabled?: boolean }[],
  ) => http.put(`/admin/subjects/${id}/prices`, { items }),
};
