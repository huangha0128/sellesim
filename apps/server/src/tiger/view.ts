import Redis from 'ioredis';
import { tigerClient } from './client';
import { applyWhitelist, applyDisplayCurrency } from '../pricing/priceOverride';

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

/**
 * 多国组合区域 -> 组成国家（中文/英文），用作搜索别名：
 * 例如「新马泰」是新加坡/马来西亚/泰国的缩写，搜索任一国家名都应命中该区域套餐。
 * 洲际区域（GLOBAL/ASIA/EUROPE 等）覆盖面太广，不在此列，仍按区域名搜索。
 */
const REGION_COUNTRY_ALIASES: Record<string, { zh: string[]; en: string[] }> = {
  SINGAPOREMALAYSIATHAILAND: { zh: ['新加坡', '马来西亚', '泰国'], en: ['Singapore', 'Malaysia', 'Thailand'] },
  JAPANKOREA: { zh: ['日本', '韩国'], en: ['Japan', 'Korea'] },
  CHINAMAINLANDHONGKONGMACAO: { zh: ['中国大陆', '中国香港', '中国澳门', '香港', '澳门'], en: ['China Mainland', 'Hong Kong', 'Macao'] },
};

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
  // Tiger API does not expose an explicit "unlimited" flag; the only reliable marker
  // is the package name containing "Unlimited" (matches TigerESIM admin "是否不限量").
  // amount >= 9999GB is kept as a fallback marker for huge-quota packages.
  const isUnlimited = /unlimited/i.test(String(t.name || '')) || amountMb >= 9999 * 1024;
  // 中文名称（默认）
  const regionNameCn = region.name_cn || region.name_en || code;
  // 英文名称
  const regionNameEn = region.name_en || region.name_cn || code;
  // 多国组合区域的搜索别名：如「新马泰」可被「新加坡/马来西亚/泰国」搜到
  const regionAlias = REGION_COUNTRY_ALIASES[code];
  const countryAliases = regionAlias
    ? Array.from(new Set([...regionAlias.zh, ...regionAlias.en, regionNameCn, regionNameEn]))
    : [regionNameCn, regionNameEn];
  // 套餐名称：中文和英文版本
  const nameCn = t.name || `${regionNameCn} ${gb}GB ${days}天`;
  const nameEn = t.name || `${regionNameEn} ${gb}GB ${days} Days`;
  // 描述：中文和英文版本（处理数组、JSON 字符串、普通字符串）
  const descCn = formatDescription(t.description, '、', `${gb}GB 流量，${days} 天有效`);
  const descEn = formatDescription(t.description, ', ', `${gb}GB Data, ${days} Days Valid`);
  // coverage/type/tag 使用 i18n key，由前端翻译
  const coverageKey = isMulti ? 'package.coverageMulti' : 'package.coverageLocal';
  const typeKey = isMulti ? 'package.typeMulti' : 'package.typeLocal';
  const tagKey = isFeatured(gb, days) ? 'package.tagHot' : '';
  return {
    id: String(t.id ?? t.pid ?? ''),
    countryCode: code,
    countryName: regionNameCn,
    countryNameEn: regionNameEn,
    countryAliases,
    gb,
    days,
    price,
    isUnlimited,
    name: nameCn,
    nameEn: nameEn,
    type: typeKey,
    network: '4G/5G',
    speed: '高速',
    speedEn: 'High Speed',
    coverage: coverageKey,
    coverageParams: { region: regionNameCn },
    coverageParamsEn: { region: regionNameEn },
    desc: descCn,
    descEn: descEn,
    tag: tagKey,
    tagColor: tagKey ? '#FF7A59' : '',
    isFeatured: isFeatured(gb, days),
    tigerPkgId: Number(t.id ?? t.pid ?? 0),
    tigerPid: String(t.pid || ''),
    // features 使用 i18n key 数组，由前端翻译
    features: ['package.feature1', 'package.feature2', 'package.feature3', 'package.feature4'],
    // installSteps 使用 i18n key 数组，由前端翻译
    installSteps: ['package.step1', 'package.step2', 'package.step3', 'package.step4'],
  };
}

// Tiger API description 数字代码映射
const DESC_CODE_MAP: Record<number, string> = {
  1: '3G/4G/5G',
  2: 'pure traffic eSIM',
  3: 'support Google/WhatsApp/ChatGPT',
  4: 'no voice call',
  5: 'no SMS',
  6: 'data only',
  7: 'instant activation'
};

function formatDescription(desc: any, separator: string, fallback: string): string {
  if (!desc) return fallback;
  
  // 如果是数组
  if (Array.isArray(desc)) {
    return desc.map((code: number) => DESC_CODE_MAP[code] || String(code)).join(separator);
  }
  
  // 如果是字符串
  if (typeof desc === 'string') {
    // JSON 数组字符串: "[1,2,3,4,5,6,7]"
    if (desc.startsWith('[') && desc.endsWith(']')) {
      try {
        const arr = JSON.parse(desc);
        if (Array.isArray(arr)) {
          return arr.map((code: number) => DESC_CODE_MAP[code] || String(code)).join(separator);
        }
      } catch (e) { /* ignore */ }
    }
    
    // 逗号分隔: "1,2,3,4,5,6,7" 或 "1、2、3、4、5、6、7"
    if (/^[\d、\s,]+$/.test(desc)) {
      const codes = desc.split(/[、,\s]+/).filter(Boolean).map(Number);
      return codes.map(code => DESC_CODE_MAP[code] || String(code)).join(separator);
    }
    
    // 已经是处理过的文本
    return desc;
  }
  
  return String(desc);
}

/** 拉取全部真实套餐（去重）并归一化 */
// ------------------------------------------------------------------
// 缓存：避免每次请求都把 Tiger 全部套餐逐页重拉（慢/超时的根因）。
// 采用「Redis 主存 + 进程内存降级 + stale-while-revalidate + 后台定时刷新」：
//  - 前端请求永远优先秒回缓存（即使过期也立即返回旧数据，异步后台刷新）；
//  - 多实例共享 Redis 中的同一份套餐目录（为集群部署准备）；
//  - Redis 不可用时自动降级为进程内存缓存，不影响可用性。
// ------------------------------------------------------------------
const CACHE_KEY = 'yyesim:packages:view';
// 新鲜窗口：窗口内直接读缓存，不触发刷新
const FRESH_TTL_MS = 5 * 60_000; // 5 分钟
// Redis 键绝对过期时间（兜底，防止后台刷新异常导致缓存永远不更新）
const REDIS_TTL_SEC = 15 * 60;
// 后台刷新间隔
export const PACKAGE_REFRESH_INTERVAL_MS = 5 * 60_000; // 5 分钟

// ---- 进程内存降级缓存 ----
let memView: any[] | null = null;
let memAt = 0;
// 并发合并：多个请求同时到达时共用同一次 Tiger 拉取
let inflight: Promise<any[]> | null = null;

// ---- Redis 连接（未配置 REDIS_URL 时禁用，退化为内存缓存）----
const redisUrl = process.env.REDIS_URL || '';
let redis: Redis | null = null;
if (redisUrl) {
  redis = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    retryStrategy: () => 5_000, // 断线后 5s 重连
  });
  redis.on('error', () => {
    /* Redis 不可用时静默，交由内存降级兜底 */
  });
}

/** 从 Tiger 拉取并归一化全部套餐（不含缓存、不含白名单过滤）——供后台「添加套餐」挑选全量套餐用 */
export async function fetchAndNormalize(): Promise<any[]> {
  const packages = await tigerClient.listAllPackages({ category: 'esim', package_type: 'data', is_active: true });
  const unique = new Map<string, any>();
  for (const p of packages) {
    const rc = normalizeRegionCode(p.region || p);
    unique.set(rc + ':' + (p.id || p.pid), p);
  }
  return Array.from(unique.values()).map(tigerToView);
}

/** 并发合并的 Tiger 全量拉取（多请求共享一次） */
function singleFlightFetch(): Promise<any[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      return await fetchAndNormalize();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 获取套餐视图；返回 null 表示无可用缓存（内存/Redis 均无数据） */
async function readCached(): Promise<{ data: any[]; fresh: boolean } | null> {
  // 1) Redis 优先
  if (redis) {
    try {
      const raw = await redis.get(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memView = parsed;
          memAt = Date.now();
          return { data: parsed, fresh: true };
        }
      }
    } catch {
      /* 解析/连接失败，退到内存 */
    }
  }
  // 2) 内存降级
  if (memView && Array.isArray(memView)) {
    return { data: memView, fresh: Date.now() - memAt < FRESH_TTL_MS };
  }
  return null;
}

/** 写入缓存（Redis + 内存双写） */
async function writeCached(data: any[]): Promise<void> {
  memView = data;
  memAt = Date.now();
  if (redis) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', REDIS_TTL_SEC);
    } catch {
      /* Redis 写失败忽略，内存已兜底 */
    }
  }
}

/** 手动失效套餐缓存（如刚在 Tiger 创建套餐后，或手动重新同步时） */
export function invalidatePackageCache(): void {
  memView = null;
  memAt = 0;
  if (redis) {
    redis.del(CACHE_KEY).catch(() => {
      /* ignore */
    });
  }
}

/**
 * 后台刷新套餐缓存（fire-and-forget，失败不阻塞调用方）。
 * 供启动预热、定时刷新、失效后补偿刷新使用。
 * 缓存内容 = 白名单套餐（仅已添加、有价格的套餐），未添加的 Tiger 套餐不可见。
 */
export async function refreshPackageCache(): Promise<void> {
  if (!tigerClient.configured) return;
  try {
    const data = await singleFlightFetch();
    await writeCached(await applyWhitelist(data));
  } catch (e: any) {
    console.error('[package-cache] 后台刷新失败：' + (e?.message || e));
  }
}

// ---------------------------------------------------------------------------
// Tiger 套餐目录缓存（添加套餐对话框使用，含全部套餐，未经白名单过滤）
// ---------------------------------------------------------------------------
const CATALOG_KEY = 'yyesim:packages:catalog';
let memCatalog: any[] | null = null;
let memCatalogAt = 0;

/** 手动失效目录缓存（保持与套餐缓存一致，供 Tiger 同步后调用） */
export function invalidateCatalogCache(): void {
  memCatalog = null;
  memCatalogAt = 0;
  if (redis) {
    redis.del(CATALOG_KEY).catch(() => {
      /* ignore */
    });
  }
}

async function readCachedCatalog(): Promise<{ data: any[]; fresh: boolean } | null> {
  if (redis) {
    try {
      const raw = await redis.get(CATALOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memCatalog = parsed;
          memCatalogAt = Date.now();
          return { data: parsed, fresh: true };
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (memCatalog && Array.isArray(memCatalog)) {
    return { data: memCatalog, fresh: Date.now() - memCatalogAt < FRESH_TTL_MS };
  }
  return null;
}

async function writeCachedCatalog(data: any[]): Promise<void> {
  memCatalog = data;
  memCatalogAt = Date.now();
  if (redis) {
    try {
      await redis.set(CATALOG_KEY, JSON.stringify(data), 'EX', REDIS_TTL_SEC);
    } catch {
      /* ignore */
    }
  }
}

/** 后台刷新目录缓存：重新从 Tiger 拉全量并写入内存/Redis */
export async function refreshCatalogCache(): Promise<void> {
  if (!tigerClient.configured) return;
  try {
    await writeCachedCatalog(await singleFlightFetch());
  } catch (e: any) {
    console.error('[package-catalog] 刷新失败：' + (e?.message || e));
  }
}

/**
 * 惰性获取 Tiger 全量目录（添加套餐对话框使用）。
 * - 命中内存/Redis 目录缓存则直接返回（不用每次请求 Tiger API）
 * - 目录数据过期时返回旧数据并在后台异步刷新（stale-while-revalidate）
 * - force=true 强制绕过缓存重新拉取并写入缓存（供「刷新」按钮使用）
 */
export async function getCatalogView(force = false): Promise<any[]> {
  if (!tigerClient.configured) return [];
  if (force) {
    const data = await singleFlightFetch();
    await writeCachedCatalog(data);
    return data;
  }
  const cached = await readCachedCatalog();
  if (cached) {
    if (!cached.fresh) refreshCatalogCache(); // fire-and-forget
    return cached.data;
  }
  const data = await singleFlightFetch();
  await writeCachedCatalog(data);
  return data;
}

/**
 * 惰性刷新并等待完成（仅当确实需要调用）：
 * 若本地内存/Redis 已有数据则立即返回现有数据并触发后台刷新（stale-while-revalidate）；
 * 若完全没有缓存，则等待一次 Tiger 拉取（首冷启动必经）。
 * 仅返回白名单套餐（已添加、有价格）。公开接口剔除停售（onSale=false），后台传 includeOffSale=true 查看全部白名单。
 * 默认把白名单价格换算成展示货币（displayCurrency）；后台传 convertDisplayCurrency=false 拿到存储价格+货币单位用于回显编辑。
 */
export async function listAllPackagesView(
  force = false,
  opts: { includeOffSale?: boolean; convertDisplayCurrency?: boolean } = {},
): Promise<any[]> {
  const convert = opts.convertDisplayCurrency !== false;
  const finalize = (list: any[]): Promise<any[]> => {
    const filtered = opts.includeOffSale ? list : list.filter((p) => p.onSale !== false);
    return convert ? applyDisplayCurrency(filtered) : Promise.resolve(filtered);
  };
  if (!tigerClient.configured) return [];
  if (force) {
    const data = await applyWhitelist(await singleFlightFetch());
    await writeCached(data);
    return finalize(data);
  }
  const cached = await readCached();
  if (cached) {
    // 已有数据（即使过期）：立即返回旧数据，后台异步刷新
    if (!cached.fresh) {
      refreshPackageCache(); // fire-and-forget
    }
    return finalize(cached.data);
  }
  // 完全没有缓存：等待一次真实拉取
  const data = await applyWhitelist(await singleFlightFetch());
  await writeCached(data);
  return finalize(data);
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