import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// dev 与 build 后 client 均位于 <server>/src/tiger 或 <server>/dist/tiger，
// 因此基于 __dirname 解析 <server>/.env，避免受进程 cwd 影响。
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

/** Tiger eSIM 合作伙伴 API 客户端（https://partner.tigeresims.com） */
export interface TigerConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  smdpAddress: string;
}

function loadConfig(): TigerConfig {
  return {
    clientId: process.env.TIGER_CLIENT_ID || '',
    clientSecret: process.env.TIGER_CLIENT_SECRET || '',
    baseUrl: (process.env.TIGER_BASE_URL || 'https://partner.tigeresims.com').replace(/\/+$/, ''),
    smdpAddress: process.env.TIGER_SMDP_ADDRESS || '',
  };
}

export class TigerApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'TigerApiError';
  }
}

export class TigerClient {
  private config: TigerConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config?: Partial<TigerConfig>) {
    this.config = { ...loadConfig(), ...config };
  }

  /** 是否已配置 client_id / client_secret（决定是否启用真实下发） */
  get configured(): boolean {
    return Boolean(this.config.clientId && this.config.clientSecret);
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  private async fetchJson(path: string, init: RequestInit = {}, retry = true): Promise<any> {
    const url = `${this.config.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch (e: any) {
      throw new TigerApiError(`无法连接 Tiger API：${e.message}`);
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    // 令牌过期时自动刷新重试一次
    if (res.status === 401 && retry && path !== '/api/token') {
      this.accessToken = null;
      this.tokenExpiresAt = 0;
      await this.getToken();
      return this.fetchJson(path, init, false);
    }

    if (!res.ok) {
      const name = body?.name || res.statusText;
      const message = body?.message || `HTTP ${res.status}`;
      throw new TigerApiError(`Tiger API 请求失败（${res.status} ${name}）：${message}`, res.status, body);
    }

    return body;
  }

  /** Step 1：OAuth2 client_credentials 换取 access_token */
  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new TigerApiError('未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET');
    }
    const data = await this.fetchJson('/api/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    const token = data?.access_token || data?.data?.access_token;
    if (!token) {
      throw new TigerApiError('Tiger API 未返回 access_token', 200, data);
    }
    const expiresIn = Number(data?.expires_in || data?.data?.expires_in || 3600);
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    return token;
  }

  private async authed(path: string, init: RequestInit = {}) {
    const token = await this.getToken();
    return this.fetchJson(path, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /** GET /api/balance 获取账户余额（USD） */
  async getBalance() {
    return this.authed('/api/balance');
  }

  /** GET /api/region 查询支持的国家与地区 */
  async listRegions(params: { index?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.index) qs.set('index', String(params.index));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.authed(`/api/region${qs.toString() ? `?${qs}` : ''}`);
  }

  /** GET /api/package 查询套餐列表 */
  /** ??????/?? */
  async listAllRegions(): Promise<any[]> {
    const all: any[] = [];
    let index = 1;
    while (index <= 20) {
      const res = await this.listRegions({ index, limit: 500 });
      const data = res?.data || res || {};
      const list: any[] = data.items || [];
      if (!list.length) break;
      all.push(...list);
      const total = Number(data.total ?? all.length);
      if (all.length >= total) break;
      index += 1;
    }
    return all;
  }

  async listPackages(params: { category?: string; package_type?: string; is_active?: boolean; index?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category); else qs.set('category', 'esim');
    if (params.package_type) qs.set('package_type', params.package_type);
    if (params.is_active !== undefined) qs.set('is_active', String(params.is_active));
    if (params.index) qs.set('index', String(params.index));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.authed(`/api/package${qs.toString() ? `?${qs}` : ''}`);
  }

  /** ????????? eSIM ???? */
  async listAllPackages(params: { category?: string; package_type?: string; is_active?: boolean } = {}): Promise<any[]> {
    const items: any[] = [];
    const pageSize = 500;
    let index = 1;
    let total = Infinity;
    while ((index - 1) * pageSize < total && index <= 20) {
      const res = await this.listPackages({ ...params, index, limit: pageSize });
      const data = res?.data || res || {};
      const list: any[] = data.items || [];
      if (!list.length) break;
      items.push(...list);
      total = Number(data.total ?? items.length);
      if (items.length >= total) break;
      index += 1;
    }
    return items;
  }

  /** GET /api/card 查询卡片列表 */
  async listCards(params: { category?: string; iccid?: string; index?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.iccid) qs.set('iccid', params.iccid);
    if (params.index) qs.set('index', String(params.index));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.authed(`/api/card${qs.toString() ? `?${qs}` : ''}`);
  }

  /** GET /api/card/usage 查询卡片流量历史 */
  async getCardUsage(iccid: string, params: { index?: number; limit?: number } = {}) {
    const qs = new URLSearchParams({ iccid });
    if (params.index) qs.set('index', String(params.index));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.authed(`/api/card/usage?${qs}`);
  }

  /** GET /api/card/package 查询卡片已绑套餐列表 */
  async listCardPackages(iccid: string, params: { id?: number; ids?: string; index?: number; limit?: number } = {}) {
    const qs = new URLSearchParams({ iccid });
    if (params.id !== undefined) qs.set('id', String(params.id));
    if (params.ids) qs.set('ids', params.ids);
    if (params.index) qs.set('index', String(params.index));
    if (params.limit) qs.set('limit', String(params.limit));
    return this.authed(`/api/card/package?${qs}`);
  }

  /** POST /api/card/package 为卡片绑定套餐（售卡核心） */
  async bindPackage(iccid: string, packageId: number) {
    return this.authed('/api/card/package', {
      method: 'POST',
      body: JSON.stringify({ iccid, package_id: packageId }),
    });
  }

  /** DELETE /api/card/package/{pk} 删除指定卡套餐 */
  async deleteCardPackage(pk: number) {
    return this.authed(`/api/card/package/${pk}`, { method: 'DELETE' });
  }

  /** POST /api/promotion/code 给用户分配一次性兑换码 */
  async assignPromotionCode(email: string, voucherCode: string, mobile?: string) {
    return this.authed('/api/promotion/code', {
      method: 'POST',
      body: JSON.stringify({ email, voucher_code: voucherCode, ...(mobile ? { mobile } : {}) }),
    });
  }
}

/** 从 Tiger 绑定套餐的返回 data 中提取 eSIM 激活信息 */
export function extractEsimInfo(data: any, smdpAddress = ''): { iccid: string; smdp: string; activationCode: string } | null {
  if (!data || typeof data !== 'object') return null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return String(data[k]);
    }
    return undefined;
  };

  const iccid = pick('iccid', 'iccid_number', 'iccidNumber', 'card_iccid');
  const smdp = pick('smdp_address', 'smdpAddress', 'smdp', 'sm_dp_plus') || smdpAddress || 'smdp.tigeresims.com';
  let code = pick('activation_code', 'activationCode', 'lpa', 'lpa_code', 'lpaCode', 'qr_code', 'qrCode', 'match_code', 'confirmation_code');
  if (!code) return null;
  if (!code.startsWith('LPA:')) {
    code = `LPA:1$${smdp}$${code}`;
  }
  return { iccid: iccid || '', smdp, activationCode: code };
}

// 全局单例（供路由复用）
export const tigerClient = new TigerClient();
