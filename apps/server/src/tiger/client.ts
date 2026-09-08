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

  /**
   * 拉取全部套餐（分页并合并去重）。
   * 优化：先请求第 1 页拿到 total，再用 Promise.all 并行拉取剩余页，
   * 把原来最多 20 次串行请求降为「1 次 + 并行一次」，极大缩短全量拉取耗时。
   */
  async listAllPackages(params: { category?: string; package_type?: string; is_active?: boolean } = {}): Promise<any[]> {
    const pageSize = 500;
    const maxPages = 20;
    // 第 1 页：先拿到 total，决定后续并发拉几页
    const first = await this.listPackages({ ...params, index: 1, limit: pageSize });
    const firstData = first?.data || first || {};
    const items: any[] = [...(firstData.items || [])];
    const total = Number(firstData.total ?? items.length);
    const totalPages = Math.min(Math.max(1, Math.ceil(total / pageSize)), maxPages);
    if (totalPages > 1) {
      const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const results = await Promise.all(restPages.map((i) => this.listPackages({ ...params, index: i, limit: pageSize })));
      for (const r of results) {
        const data = r?.data || r || {};
        const list: any[] = data.items || [];
        if (list.length) items.push(...list);
      }
    }
    return items;
  }

  /** POST /api/package 创建套餐（TigerESIM 仅提供新增能力，无修改/删除接口） */
  async createPackage(params: {
    name: string;
    amount: number; // MB
    valid_days: number;
    region_id: number;
    sales: number;
    package_type?: string;
    description?: string;
  }) {
    const body: Record<string, unknown> = {
      name: params.name,
      amount: Number(params.amount || 0),
      valid_days: Number(params.valid_days || 1),
      region_id: Number(params.region_id || 0),
      sales: Number(params.sales || 0),
      package_type: params.package_type || 'data',
    };
    if (params.description) body.description = params.description;
    return this.authed('/api/package', { method: 'POST', body: JSON.stringify(body) });
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

  /** 分页拉取全部卡片并按 ICCID 去重（官方 limit 最小值为 5，此处用 500） */
  async listAllCards(params: { category?: string; iccid?: string } = {}): Promise<any[]> {
    const all: any[] = [];
    const seen = new Set<string>();
    let index = 1;
    while (index <= 20) {
      const res = await this.listCards({ ...params, index, limit: 500 });
      const data = res?.data || res || {};
      const items: any[] = data.items || [];
      if (!items.length) break;
      let added = 0;
      for (const it of items) {
        const id = String(it.iccid || it.iccid_number || it.id);
        if (!seen.has(id)) {
          seen.add(id);
          all.push(it);
          added += 1;
        }
      }
      const total = Number(data.total ?? all.length);
      if (all.length >= total) break;
      if (added === 0) break;
      index += 1;
    }
    return all;
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

  /**
   * 通过 GET /api/card 查询卡片，返回该卡激活信息（含官方新版 installation 二维码）。
   * 官方已把激活码/二维码迁移到卡片查询接口（installation.qrcode），
   * 绑定套餐后若绑定响应未返回激活码，应使用本接口兜底获取。
   * 注意：官方接口 limit 最小值为 5，传更小值会返回 422。
   */
  async getCardActivation(iccid: string) {
    const res = await this.listCards({ iccid, limit: 5 });
    const data = res?.data || res || {};
    const items: any[] = data.items || [];
    const card = items.find((it) => String(it.iccid || it.iccid_number) === String(iccid));
    if (!card) return null;
    return extractEsimInfo(card, this.config.smdpAddress);
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

/** 从 Tiger 绑定/卡片查询返回中提取 eSIM 激活信息（支持官方新版 installation 嵌套结构） */
export function extractEsimInfo(data: any, smdpAddress = ''): { iccid: string; smdp: string; activationCode: string } | null {
  if (!data || typeof data !== 'object') return null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return String(data[k]);
    }
    return undefined;
  };

  const iccid = pick('iccid', 'iccid_number', 'iccidNumber', 'card_iccid');
  let smdp = pick('smdp_address', 'smdpAddress', 'smdp', 'sm_dp_plus') || smdpAddress || 'smdp.tigeresims.com';
  let code = pick('activation_code', 'activationCode', 'lpa', 'lpa_code', 'lpaCode', 'qr_code', 'qrCode', 'match_code', 'confirmation_code');

  // 官方新版结构（卡片查询接口）：installation: { qrcode, address, key, apple }
  const inst = data.installation;
  if (inst && typeof inst === 'object') {
    if (inst.address) smdp = String(inst.address);
    if (!code) {
      code = String(inst.qrcode || inst.qr_code || inst.activation_code || inst.key || '') || undefined;
    }
  }

  if (!code) return null;
  if (!code.startsWith('LPA:')) {
    code = `LPA:1$${smdp}$${code}`;
  }
  return { iccid: iccid || '', smdp, activationCode: code };
}

// 全局单例（供路由复用）
export const tigerClient = new TigerClient();
