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
  return !status || PENDING_LIKE.has(status) ? 'pending' : 'activated';
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

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const esims = await prisma.esim.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });

    if (!tigerClient.configured || !esims.length) {
      return res.json({ code: 0, data: { esims: esims.map(localDisplayEsim) } });
    }

    const iccids = [...new Set(esims.map((esim) => esim.iccid).filter(Boolean))];
    const tigerItemsByIccid = new Map<string, any[] | null>();
    await Promise.all(
      iccids.map(async (iccid) => {
        try {
          const response = await tigerClient.listCardPackages(iccid, { limit: 500 });
          const data = response?.data || response || {};
          tigerItemsByIccid.set(iccid, Array.isArray(data.items) ? data.items : []);
        } catch {
          tigerItemsByIccid.set(iccid, null);
        }
      }),
    );

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
