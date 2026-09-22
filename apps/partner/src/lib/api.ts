import { clearAuth, getToken, LOGIN_PATH } from '@/lib/auth';

export const API_BASE = '/api/open/v1';

/** 统一业务错误，携带后端返回的 code 与 HTTP 状态 */
export class ApiError extends Error {
  code: number;
  status?: number;
  constructor(message: string, code = -1, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function isLoginPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/partner/login');
}

/** 带 Bearer token 的 fetch 封装：非零 code 抛错；401 清凭据并跳登录 */
export async function request<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('网络异常，请检查网络连接', -2);
  }

  if (res.status === 401) {
    clearAuth();
    if (!isLoginPath()) {
      window.location.href = LOGIN_PATH;
    }
    throw new ApiError('登录已过期，请重新登录', -401, 401);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`请求失败（HTTP ${res.status}）`, -1, res.status);
  }

  const code = body?.code;
  if (code !== undefined && code !== 0) {
    throw new ApiError(body?.message || '请求失败，请重试', code ?? -1, res.status);
  }
  if (!res.ok) {
    throw new ApiError(body?.message || `请求失败（HTTP ${res.status}）`, -1, res.status);
  }

  return body?.data as T;
}

export function getErrorMessage(e: any, fallback = '请求失败'): string {
  if (e instanceof ApiError) return e.message;
  return e?.message || fallback;
}

// ---------- 类型定义 ----------
export interface LoginSubject {
  id: string;
  name: string;
  status: string;
}
export interface LoginResult {
  token: string;
  subject: LoginSubject;
}

export interface SubjectInfo {
  id: string;
  name: string;
  status: string;
  callbackUrl?: string | null;
  defaultMarkupPercent?: number | null;
  splitPercent?: number | null;
}
export interface SubjectKey {
  keyId: string;
  mode: string;
}
export interface CreateKeyResult {
  keyId: string;
  keySecret: string;
  mode: string;
  name: string;
}
export interface Quota {
  quotaLimit: number;
  usedQuota: number;
  availableQuota: number;
  balance: number;
}
export interface MeResult {
  subject: SubjectInfo;
  quota: Quota;
  keys: SubjectKey[];
}

export type LedgerType = 'order_debit' | 'refund_credit' | 'settle_credit' | 'adjust' | 'balance_debit' | 'balance_refund' | 'deposit_credit';
export interface LedgerItem {
  id: string;
  type: LedgerType;
  amount: number;
  orderNo?: string;
  refundNo?: string;
  rechargeNo?: string;
  note?: string;
  createdAt: string;
}
export interface QuotaResult {
  quota: Quota;
  ledger: LedgerItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WalletResult {
  wallet: {
    balance: number;
    usedQuota: number;
    quotaLimit: number | null;
    maxDebt: number | null;
    availableDebt: number | null;
  };
}
export interface CardPkg {
  id: number | null;
  name: string | null;
  status: string | null;
  activatedAt?: string | null;
  expireAt?: string | null;
  days?: number | null;
}
export interface CardDetailResult {
  iccid: string;
  card: { status: string | null; category?: string | null; createdAt?: string | null };
  packages: CardPkg[];
}

export interface PackageItem {
  id: string;
  tigerPkgId?: number | null;
  name?: string;
  nameEn?: string;
  countryCode?: string;
  countryName?: string;
  flag?: string;
  gb?: number | null;
  days?: number | null;
  isUnlimited?: boolean;
  price: number;
  costPrice?: number | null;
  platformPrice?: number | null;
  markupPercent?: number | null;
}
export interface PackagesResult {
  packages: PackageItem[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PackageDetail {
  pkg: PackageItem;
}

export interface Region {
  code: string;
  name: string;
  en?: string;
  flag?: string;
}

export type OrderStatus = 'delivered' | 'refunded' | 'failed';
export interface OrderEsim {
  status?: string;
  activatedAt?: string;
  expireAt?: string;
  used?: number;
  activationCode?: string;
  iccid?: string;
  smdp?: string;
}
export interface Order {
  orderNo: string;
  extOrderNo?: string;
  status: OrderStatus;
  payMethod?: string;
  pkgId?: string;
  countryCode?: string;
  pkgName?: string;
  gb?: number | null;
  days?: number | null;
  isUnlimited?: boolean;
  cost: number;
  createdAt: string;
  refundedAt?: string | null;
  esim?: OrderEsim;
}
export interface OrdersResult {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}
export interface OrderDetail {
  order: Order & { esim?: OrderEsim };
}

export interface EsimResult {
  esim: OrderEsim;
}

export interface RefundResult {
  data: unknown;
}

export interface CreateOrderResult {
  orderNo: string;
  extOrderNo?: string;
  status: string;
  cost: number;
  created: string;
  esim: { iccid: string; activationCode: string; smdp: string; expireAt?: string };
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  Object.keys(params).forEach((k) => {
    const v = params[k];
    if (v !== undefined && v !== '') parts.push(`${k}=${encodeURIComponent(String(v))}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---------- 接口 ----------
export const api = {
  // 登录（/api/open/v1/auth/login 免鉴权）
  login: (keyId: string, keySecret: string) =>
    request<LoginResult>('/auth/login', { method: 'POST', body: { keyId, keySecret } }),

  me: () => request<MeResult>('/me'),

  /** 自助更新 Webhook 回调地址（需写接口签名） */
  updateCallback: (callbackUrl: string) =>
    request<{ callbackUrl: string }>('/me', { method: 'PUT', body: { callbackUrl } }),

  /** 自助创建 API 密钥（keySecret 仅返回一次） */
  createKey: (body: { name?: string; mode?: 'live' | 'read' } = {}) =>
    request<CreateKeyResult>('/keys', { method: 'POST', body }),

  quota: (page = 1, pageSize = 20) =>
    request<QuotaResult>(`/quota${qs({ page, pageSize })}`),

  packages: (p: { countryCode?: string; keyword?: string; page?: number; pageSize?: number } = {}) =>
    request<PackagesResult>(
      `/packages${qs({ countryCode: p.countryCode, keyword: p.keyword, page: p.page, pageSize: p.pageSize })}`,
    ),

  package: (pkgId: string) => request<PackageDetail>(`/packages/${encodeURIComponent(pkgId)}`),

  regions: () => request<{ regions: Region[] }>('/regions'),

  orders: (p: { status?: string; page?: number; pageSize?: number } = {}) =>
    request<OrdersResult>(`/orders${qs({ status: p.status, page: p.page, pageSize: p.pageSize })}`),

  order: (orderNo: string) => request<OrderDetail>(`/orders/${encodeURIComponent(orderNo)}`),

  orderEsim: (orderNo: string) =>
    request<EsimResult>(`/orders/${encodeURIComponent(orderNo)}/esim`),

  refund: (refundNo: string) => request<RefundResult>(`/refunds/${encodeURIComponent(refundNo)}`),

  createOrder: (body: { pkgId: string; email: string; extOrderNo?: string }) =>
    request<CreateOrderResult>('/orders', { method: 'POST', body }),

  createRefund: (orderNo: string, body: { extRefundNo?: string; amount?: number; reason?: string }) =>
    request<RefundResult>(`/orders/${encodeURIComponent(orderNo)}/refunds`, { method: 'POST', body }),

  wallet: () => request<WalletResult>('/wallet'),

  /** 查询卡号详情：是否绑定套餐、绑定哪些套餐及各套餐状态 */
  cardDetail: (iccid: string) =>
    request<CardDetailResult>(`/cards/${encodeURIComponent(iccid)}`),
};