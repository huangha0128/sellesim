import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient, iccidPoolCount } from '../tiger';
import { syncAllFromTiger, syncRegionsFromTiger, syncPackagesFromTiger } from '../tiger/sync';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/dashboard', async (req: Request, res: Response) => {
    const [countryCount, packageCount, orderCount, esimCount] = await Promise.all([
      prisma.country.count(),
      prisma.package.count(),
      prisma.order.count(),
      prisma.esim.count(),
    ]);
    const paidOrders = await prisma.order.count({ where: { status: 'paid' } });
    const totalRevenue = await prisma.order.aggregate({
      where: { status: 'paid' },
      _sum: { price: true },
    });
    res.json({
      code: 0,
      data: {
        stats: {
          countryCount,
          packageCount,
          orderCount,
          esimCount,
          paidOrders,
          totalRevenue: totalRevenue._sum.price || 0,
        },
      },
    });
  });

  router.get('/orders', async (req: Request, res: Response) => {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { package: { include: { country: true } } },
    });
    res.json({ code: 0, data: { orders } });
  });

  router.get('/esims', async (req: Request, res: Response) => {
    const esims = await prisma.esim.findMany({
      orderBy: { createdAt: 'desc' },
      include: { order: { include: { package: { include: { country: true } } } } },
    });
    res.json({ code: 0, data: { esims } });
  });

  router.get('/countries', async (req: Request, res: Response) => {
    const keyword = String(req.query.keyword || '').trim();
    const countries = await prisma.country.findMany({
      where: keyword
        ? {
            OR: [
              { code: { contains: keyword } },
              { name: { contains: keyword } },
              { en: { contains: keyword } },
            ],
          }
        : undefined,
      include: { _count: { select: { packages: true } } },
      orderBy: [{ hot: 'desc' }, { code: 'asc' }],
    });
    res.json({ code: 0, data: { countries } });
  });

  router.post('/countries', async (req: Request, res: Response) => {
    const country = await prisma.country.create({ data: req.body });
    res.json({ code: 0, data: { country } });
  });

  router.put('/countries/:code', async (req: Request, res: Response) => {
    const country = await prisma.country.update({
      where: { code: req.params.code },
      data: req.body,
    });
    res.json({ code: 0, data: { country } });
  });

  router.delete('/countries/:code', async (req: Request, res: Response) => {
    await prisma.country.delete({ where: { code: req.params.code } });
    res.json({ code: 0, data: {} });
  });

  router.get('/packages/page', async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const keyword = String(req.query.keyword || '').trim();
    const countryCode = String(req.query.countryCode || '').trim();
    const onlyFeatured = req.query.featured === '1' || req.query.featured === 'true';
    const where: any = {};
    if (countryCode) where.countryCode = countryCode;
    if (onlyFeatured) where.isFeatured = true;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { countryCode: { contains: keyword } },
        { coverage: { contains: keyword } },
        { desc: { contains: keyword } },
      ];
    }
    const [total, packages] = await Promise.all([
      prisma.package.count({ where }),
      prisma.package.findMany({
        where,
        include: { country: true },
        orderBy: [{ countryCode: 'asc' }, { gb: 'asc' }, { days: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ code: 0, data: { packages, total, page, pageSize } });
  });

  router.post('/packages', async (req: Request, res: Response) => {
    try {
      const pkg = await prisma.package.create({ data: req.body });
      res.json({ code: 0, data: { pkg } });
    } catch (e: any) {
      res.status(400).json({ code: 1, message: e.message });
    }
  });

  router.put('/packages/:id', async (req: Request, res: Response) => {
    try {
      const pkg = await prisma.package.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ code: 0, data: { pkg } });
    } catch (e: any) {
      res.status(400).json({ code: 1, message: e.message });
    }
  });

  router.delete('/packages/:id', async (req: Request, res: Response) => {
    try {
      await prisma.package.delete({ where: { id: req.params.id } });
      res.json({ code: 0, data: {} });
    } catch (e: any) {
      res.status(400).json({ code: 1, message: e.message });
    }
  });

  // ===== Tiger 接入相关 =====

  /** GET /api/admin/tiger/status 查看 Tiger 接入状态 */
  router.get('/tiger/status', async (_req: Request, res: Response) => {
    const [countryCount, packageCount] = await Promise.all([
      prisma.country.count(),
      prisma.package.count(),
    ]);
    res.json({
      code: 0,
      data: {
        configured: tigerClient.configured,
        baseUrl: tigerClient.baseUrl,
        iccidPoolSize: iccidPoolCount(),
        mode: tigerClient.configured ? 'tiger' : 'mock',
        countryCount,
        packageCount,
        synced: packageCount > 0,
      },
    });
  });

  /** POST /api/admin/tiger/sync-all ????????/?? + ?? */
  router.post('/tiger/sync-all', async (_req: Request, res: Response) => {
    try {
      const result = await syncAllFromTiger(prisma);
      res.json({ code: 0, data: result });
    } catch (e: any) {
      res.json({ code: 2, message: `???????${e.message}` });
    }
  });

  /** POST /api/admin/tiger/sync-regions ??????/?? */
  router.post('/tiger/sync-regions', async (_req: Request, res: Response) => {
    try {
      const result = await syncRegionsFromTiger(prisma);
      res.json({ code: 0, data: result });
    } catch (e: any) {
      res.json({ code: 2, message: `???????${e.message}` });
    }
  });

  /** POST /api/admin/tiger/sync-packages 从 Tiger 同步套餐并回填 tigerPkgId */
  router.post('/tiger/sync-packages', async (_req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET' });
    }
    try {
      const listRes = await tigerClient.listPackages({ package_type: 'data', is_active: true, limit: 500 });
      const items: any[] = listRes?.data?.items || listRes?.items || [];
      const localPackages = await prisma.package.findMany();
      let matched = 0;
      const unmatched: any[] = [];
      const results: any[] = [];
      for (const pkg of localPackages) {
        const hit = items.find(
          (it) => Number(it.amount) === pkg.gb * 1024 && Number(it.valid_days) === pkg.days,
        );
        if (hit) {
          const tigerPkgId = Number(hit.pid || hit.id);
          if (pkg.tigerPkgId !== tigerPkgId) {
            await prisma.package.update({ where: { id: pkg.id }, data: { tigerPkgId } });
          }
          matched += 1;
          results.push({
            id: pkg.id,
            countryCode: pkg.countryCode,
            gb: pkg.gb,
            days: pkg.days,
            tigerPkgId,
            tigerName: hit.name,
          });
        } else {
          unmatched.push({ id: pkg.id, countryCode: pkg.countryCode, gb: pkg.gb, days: pkg.days });
        }
      }
      res.json({
        code: 0,
        data: { matched, total: localPackages.length, tigerTotal: items.length, results, unmatched },
      });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
    }
  });

  return router;
};
