import { tigerClient } from '../tiger';

const PENDING_LIKE = new Set([
  'pending',
  'not_activated',
  'notactivated',
  'inactive',
  'unused',
  'never_activated',
]);

export function tigerStatus(item: any): string {
  const status = String(item?.status ?? '').trim().toLowerCase();
  if (!status || PENDING_LIKE.has(status)) return 'pending';
  if (status === 'activated' || status === 'used' || status === 'expired') return status;
  return 'activated';
}

export function toNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Tiger 返回的时间字段（activated_at / expired_at / created_at）是「无时区、按 UTC
 * 墙钟」的字符串。前端以 '创建时间'（本地库，UTC ISO + 前端转东八区）为准，
 * 因此这里把 Tiger 的无时区值当作 UTC 解析并归一化为带 Z 的 ISO，保证与
 * createdAt 使用同一套时区口径显示，避免出现「激活时间早于创建时间 8 小时」的倒挂。
 * 若值本身已带时区或不是合法时间，则原样返回（由本地值兜底）。
 */
export function normalizeTigerTime(value: any): string | null {
  if (value === undefined || value === null) return null;
  let s = String(value).trim();
  if (!s) return null;
  const hasTz = /(Z|[+-]\d{2}:?\d{2})\s*$/i.test(s);
  if (!hasTz) {
    // 无时区值统一按 UTC 补充后缀，避免 JS 把空格格式当成本地时间
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function matchesLocalEsim(local: any, item: any): boolean {
  if (local.tigerBindingId) {
    return toNumber(local.tigerBindingId, -1) === toNumber(item?.id, -2);
  }

  const pkg = item?.package || {};
  const itemIds = new Set(
    [pkg.id, pkg.pid, item.package_id, item.id]
      .filter((value: any) => value !== undefined && value !== null && value !== '')
      .map(String),
  );
  return [local.tigerPkgId, local.tigerPid]
    .filter((value: any) => value !== undefined && value !== null && value !== '')
    .some((value: any) => itemIds.has(String(value)));
}

export function tigerDisplayEsim(item: any, local: any, iccid: string): any {
  const pkg = item?.package || {};
  const region = pkg.region || {};
  const usageMb = toNumber(item?.usage);
  return {
    id: local?.id || `tiger-${item.id}`,
    localEsimId: local?.id,
    orderId: local?.orderId,
    activationCode: local?.activationCode || '',
    iccid: local?.iccid || iccid,
    smdp: local?.smdp || '',
    status: tigerStatus(item),
    activatedAt: normalizeTigerTime(item?.activated_at) || local?.activatedAt,
    expireAt: normalizeTigerTime(item?.expired_at) || local?.expireAt,
    used: usageMb / 1024,
    gb: local?.gb ?? Math.round(toNumber(pkg.amount) / 1024),
    days: local?.days ?? toNumber(pkg.valid_days),
    isUnlimited: !!local?.isUnlimited,
    pkgName: local?.pkgName || pkg.name,
    pkgNameEn: local?.pkgNameEn || pkg.name_en || pkg.name,
    countryCode: local?.countryCode || region.code,
    tigerPkgId: local?.tigerPkgId ?? toNumber(pkg.id),
    tigerPid: local?.tigerPid || pkg.pid,
    tigerBindingId: toNumber(item?.id),
    order: local?.order,
    createdAt: local?.createdAt || normalizeTigerTime(item?.created_at),
    source: 'tiger',
  };
}

export function localDisplayEsim(local: any): any {
  return {
    ...local,
    localEsimId: local.id,
    source: 'local',
  };
}

// ---------------------------------------------------------------------------
// Tiger eSIM 富化缓存（按 ICCID 的进程内 TTL 缓存）
// ---------------------------------------------------------------------------
// 以前：每次请求都会对每个 ICCID 打一次外部 Tiger 网络请求
// （card/package），打开 eSIM 列表/详情页反复变慢的根因。
// 现在：把「按 ICCID 查 Tiger 套餐绑定」的结果缓存片刻，后续请求直接复用，
// 本地 DB 的 esims 仍每次实时读取，只有易变的 usage/status 短暂缓存，
// 短时间内的流量/状态稍有滞后对展示可接受。失败结果不缓存（留给下次重试）。
const TIGER_ENRICH_TTL_MS = 120_000; // 2 分钟
const TIGER_ENRICH_MAX_ENTRIES = 2000;
const tigerEnrichCache = new Map<string, { items: any[]; at: number }>();

/** 查某 ICCID 的 Tiger 套餐列表（带 TTL 内存缓存）；失败返回 null（不缓存） */
export async function getTigerItems(iccid: string): Promise<any[] | null> {
  const cached = tigerEnrichCache.get(iccid);
  if (cached && Date.now() - cached.at < TIGER_ENRICH_TTL_MS) {
    return cached.items;
  }
  try {
    const response = await tigerClient.listCardPackages(iccid, { limit: 500 });
    const data = response?.data || response || {};
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    // 轻量防止无限膨胀：超过上限时先清掉过期项，仍超就整体重置
    if (tigerEnrichCache.size >= TIGER_ENRICH_MAX_ENTRIES) {
      const now = Date.now();
      for (const [k, v] of tigerEnrichCache) {
        if (now - v.at >= TIGER_ENRICH_TTL_MS) tigerEnrichCache.delete(k);
      }
      if (tigerEnrichCache.size >= TIGER_ENRICH_MAX_ENTRIES) tigerEnrichCache.clear();
    }
    tigerEnrichCache.set(iccid, { items, at: Date.now() });
    return items;
  } catch {
    return null;
  }
}

/**
 * 将本地 esim 记录与 Tiger 实时套餐绑定合并，得到展示用 eSIM 列表。
 * 支持传显式 iccids（如后台）或默认从 locals 收集 ICCID。
 * 返回 [{...}, ...] 展示对象，usage/status 来自 Tiger，其余以本地为兜底。
 */
export async function enrichEsims(
  locals: any[],
  options: { iccids?: string[] } = {},
): Promise<any[]> {
  if (!tigerClient.configured || !locals.length) {
    return locals.map(localDisplayEsim);
  }

  const iccids = [...new Set((options.iccids ?? locals.map((esim) => esim.iccid)).filter(Boolean))];
  if (!iccids.length) return locals.map(localDisplayEsim);

  const tigerItemsByIccid = new Map<string, any[] | null>();
  await Promise.all(
    iccids.map(async (iccid) => {
      tigerItemsByIccid.set(iccid, await getTigerItems(iccid));
    }),
  );

  const localsByIccid = new Map<string, any[]>();
  for (const esim of locals) {
    if (!esim.iccid) continue;
    if (!localsByIccid.has(esim.iccid)) localsByIccid.set(esim.iccid, []);
    localsByIccid.get(esim.iccid)!.push(esim);
  }

  const displayEsims: any[] = [];
  const consumedLocals = new Set<string>();
  for (const [iccid, localList] of localsByIccid) {
    const items = tigerItemsByIccid.get(iccid);
    if (!items) {
      displayEsims.push(...localList.map(localDisplayEsim));
      continue;
    }

    for (const item of items) {
      const local = localList.find(
        (candidate) => !consumedLocals.has(candidate.id) && matchesLocalEsim(candidate, item),
      );
      if (local) consumedLocals.add(local.id);
      displayEsims.push(tigerDisplayEsim(item, local, iccid));
    }

    displayEsims.push(
      ...localList
        .filter((local) => !consumedLocals.has(local.id))
        .map(localDisplayEsim),
    );
  }

  return displayEsims;
}