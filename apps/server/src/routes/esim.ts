import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { tigerClient } from '../tiger';

const PENDING_LIKE = new Set([
  'pending',
  'not_activated',
  'notactivated',
  'inactive',
  'unused',
  'never_activated',
]);

function tigerStatus(item: any): string {
  const status = String(item?.status ?? '').trim().toLowerCase();
  if (!status || PENDING_LIKE.has(status)) return 'pending';
  if (status === 'activated' || status === 'used' || status === 'expired') return status;
  return 'activated';
}

function toNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

function tigerDisplayEsim(item: any, local: any, iccid: string): any {
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
    activatedAt: item?.activated_at || local?.activatedAt,
    expireAt: item?.expired_at || local?.expireAt,
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
    createdAt: local?.createdAt || item?.created_at,
    source: 'tiger',
  };
}

function localDisplayEsim(local: any): any {
  return {
    ...local,
    localEsimId: local.id,
    source: 'local',
  };
}

// ---------------------------------------------------------------------------
// Tiger eSIM 富化缓存（按 ICCID 的进程内 TTL 缓存）
// ---------------------------------------------------------------------------
// 以前：每次请求 GET /esims 都会对每个 ICCID 打一次外部 Tiger 网络请求
// （card/package），打开 eSIM 列表/详情页反复变慢的根因。
// 现在：把「按 ICCID 查 Tiger 套餐绑定」的结果缓存片刻，后续请求直接复用，
// 本地 DB 的 esims 仍每次实时读取，只有易变的 usage/status 短暂缓存，
// 短时间内的流量/状态稍有滞后对展示可接受。失败结果不缓存（留给下次重试）。
const TIGER_ENRICH_TTL_MS = 120_000; // 2 分钟
const TIGER_ENRICH_MAX_ENTRIES = 2000;
const tigerEnrichCache = new Map<string, { items: any[]; at: number }>();

/** 查某 ICCID 的 Tiger 套餐列表（带 TTL 内存缓存）；失败返回 null（不缓存） */
async function getTigerItems(iccid: string): Promise<any[] | null> {
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

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const t0 = Date.now();
    const esims = await prisma.esim.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });
    const t1 = Date.now();

    if (!tigerClient.configured || !esims.length) {
      console.log(`[esims] no-tiger/no-data db=${t1 - t0}ms total=${Date.now() - t0}ms esims=${esims.length}`);
      return res.json({ code: 0, data: { esims: esims.map(localDisplayEsim) } });
    }

    const iccids = [...new Set(esims.map((esim) => esim.iccid).filter(Boolean))];
    const tigerItemsByIccid = new Map<string, any[] | null>();
    await Promise.all(
      iccids.map(async (iccid) => {
        tigerItemsByIccid.set(iccid, await getTigerItems(iccid));
      }),
    );
    const t2 = Date.now();

    const localsByIccid = new Map<string, any[]>();
    for (const esim of esims) {
      if (!esim.iccid) continue;
      if (!localsByIccid.has(esim.iccid)) localsByIccid.set(esim.iccid, []);
      localsByIccid.get(esim.iccid)!.push(esim);
    }

    const displayEsims: any[] = [];
    const consumedLocals = new Set<string>();
    for (const [iccid, locals] of localsByIccid) {
      const items = tigerItemsByIccid.get(iccid);
      if (!items) {
        displayEsims.push(...locals.map(localDisplayEsim));
        continue;
      }

      for (const item of items) {
        const local = locals.find(
          (candidate) => !consumedLocals.has(candidate.id) && matchesLocalEsim(candidate, item),
        );
        if (local) consumedLocals.add(local.id);
        displayEsims.push(tigerDisplayEsim(item, local, iccid));
      }

      displayEsims.push(
        ...locals
          .filter((local) => !consumedLocals.has(local.id))
          .map(localDisplayEsim),
      );
    }

    const t3 = Date.now();
    console.log(
      `[esims] tiger db=${t1 - t0}ms tiger=${t2 - t1}ms merge=${t3 - t2}ms total=${t3 - t0}ms ` +
        `esims=${esims.length} iccids=${iccids.length}`,
    );
    res.json({ code: 0, data: { esims: displayEsims } });
  });

  router.post('/:id/activate', authMiddleware, async (req: AuthRequest, res: Response) => {
    const esim = await prisma.esim.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!esim) {
      return res.json({ code: 1, message: 'eSIM 不存在' });
    }
    const updated = await prisma.esim.update({
      where: { id: req.params.id },
      data: { status: 'activated', activatedAt: new Date() },
    });
    res.json({ code: 0, data: { esim: updated } });
  });

  router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const esim = await prisma.esim.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!esim) {
      return res.json({ code: 1, message: 'eSIM 不存在' });
    }
    await prisma.esim.delete({ where: { id: req.params.id } });
    res.json({ code: 0, data: {} });
  });

  return router;
};
