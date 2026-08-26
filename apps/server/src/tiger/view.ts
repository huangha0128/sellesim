import { tigerClient } from './client';

/**
 * 实时套餐视图层：把 TigerESIM（/api/package）原包数据归一化为前端所需结构。
 * 本地后端不再存储套餐内容，所有套餐展示都实时来源于此。
 */
export const MULTI_REGION_CODE: Record<string, string> = {
  '全球 (180+)': 'GLOBAL',
  Asia: 'ASIA',
  Caribbean: 'CARIBBEAN',
  'North America': 'NAMERICA',
  Oceania: 'OCEANIA',
  'Latin America': 'LAMERICA',
  European: 'EUROPE',
  African: 'AFRICA',
};
export const MULTI_REGION_CODES = new Set(Object.values(MULTI_REGION_CODE));

const FEATURED_GB = [1, 3, 5, 10, 15, 20, 30];
const FEATURED_DAYS = [7, 15, 30];

function isFeatured(gb: number, days: number): boolean {
  return FEATURED_GB.includes(gb) && FEATURED_DAYS.includes(days);
}

export function normalizeRegionCode(t: any): string {
  const rawCode = String(t.code || t.region_code || '').trim().toUpperCase();
  const en = String(t.name_en || '').trim();
  const cn = String(t.name_cn || '').trim();
  if (rawCode) return rawCode;
  if (MULTI_REGION_CODE[en]) return MULTI_REGION_CODE[en];
  if (MULTI_REGION_CODE[cn]) return MULTI_REGION_CODE[cn];
  return en ? en.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNKNOWN' : 'UNKNOWN';
}

/** 将一条 Tiger 套餐原包数据归一化为前端视图（键与旧本地套餐一致，id 用 Tiger id） */
export function tigerToView(t: any): any {
  const region = t.region || t;
  const code = normalizeRegionCode(region);
  const isMulti = MULTI_REGION_CODES.has(code);
  const amountMb = Number(t.amount || 0);
  const gb = Math.max(1, Math.round(amountMb / 1024));
  const days = Math.max(1, Number(t.valid_days) || 1);
  const price = Number(t.sales ?? t.nets ?? 0);
  const regionName = region.name_cn || region.name_en || code;
  const name = t.name || regionName + ' ' + gb + 'GB/' + days + '天';
  const desc = Array.isArray(t.description)
    ? t.description.join('、')
    : t.description
      ? String(t.description)
      : gb + 'GB 流量，' + days + ' 天有效';
  const coverage = isMulti ? regionName + '多国通用' : regionName + '覆盖';
  const type = isMulti ? '多国通用' : '本地套餐';
  const tag = isFeatured(gb, days) ? '热门' : '';
  return {
    id: String(t.id ?? t.pid ?? ''),
    countryCode: code,
    gb,
    days,
    price,
    name,
    type,
    network: '4G/5G',
    speed: '高速',
    coverage,
    desc,
    tag,
    tagColor: tag ? '#FF7A59' : '',
    isFeatured: isFeatured(gb, days),
    tigerPkgId: Number(t.id ?? t.pid ?? 0),
    tigerPid: String(t.pid || ''),
    features: '["即买即用，扫码秒激活","全程高速 4G/5G 网络","可开热点，多人共享","无需实名，无需换卡"]',
    installSteps: '["购买后复制二维码下方的激活码","手机设置 → 蜂窝网络 → 添加 eSIM","扫码或输入激活码完成安装","到达目的地后开启数据漫游即用"]',
  };
}

/** 拉取全部真实套餐（去重）并归一化 */
// ---------- 缓存：避免每次请求都把 Tiger 全部套餐逐页重拉（慢/超时的根因） ----------
const CACHE_TTL_MS = 60_000; // 商品目录 60s 内为时效可接受，仍视为“实时”
let cacheView: any[] | null = null;
let cacheAt = 0;
let inflight: Promise<any[]> | null = null;

/** 手动失效套餐缓存（如刚在 Tiger 创建套餐后，或手动重新同步时） */
export function invalidatePackageCache(): void {
  cacheView = null;
  cacheAt = 0;
}

export async function listAllPackagesView(force = false): Promise<any[]> {
  if (!tigerClient.configured) return [];
  if (!force && cacheView && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cacheView;
  }
  // 并发合并：多个请求同时到达时共用同一次 Tiger 拉取
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const packages = await tigerClient.listAllPackages({ category: 'esim', package_type: 'data', is_active: true });
      const unique = new Map<string, any>();
      for (const p of packages) {
        const rc = normalizeRegionCode(p.region || p);
        unique.set(rc + ':' + (p.id || p.pid), p);
      }
      const view = Array.from(unique.values()).map(tigerToView);
      cacheView = view;
      cacheAt = Date.now();
      return view;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 按区域（即国家 code）取套餐视图 */
export async function listPackagesByRegion(code: string, onlyFeatured = false): Promise<any[]> {
  const all = await listAllPackagesView();
  const filtered = all.filter((p) => p.countryCode === code);
  return onlyFeatured ? filtered.filter((p) => p.isFeatured) : filtered;
}

/** 按 Tiger id / pid 查单套餐视图 */
export async function getPackageView(tigerPkgId: number | string): Promise<any | null> {
  const all = await listAllPackagesView();
  const target = String(tigerPkgId);
  return (
    all.find((p) => String(p.tigerPkgId) === target || p.tigerPid === target) ||
    all.find((p) => p.id === target) ||
    null
  );
}