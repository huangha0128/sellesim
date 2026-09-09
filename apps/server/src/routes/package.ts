import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';
import { listAllPackagesView, listPackagesByRegion, getPackageView, invalidatePackageCache, refreshPackageCache } from '../tiger/view';

/** 按 tigerPkgId 统计已售数量（status='paid' 的订单数），并挂到套餐视图上 */
async function attachSoldCounts(packages: any[], prisma: PrismaClient): Promise<any[]> {
  if (!packages.length) return packages;
  const ids = Array.from(new Set(packages.map((p) => p.tigerPkgId).filter((n) => n != null))) as number[];
  if (!ids.length) return packages;
  // 统计每个套餐的已支付订单数（status='paid'），退款单 status='refunded' 不计数
  const rows = await prisma.order.groupBy({
    by: ['tigerPkgId'],
    where: { tigerPkgId: { in: ids }, status: 'paid' },
    _count: { _all: true },
  });
  const countMap = new Map<number, number>();
  for (const r of rows) countMap.set(r.tigerPkgId as number, r._count._all);
  return packages.map((p) => ({ ...p, soldCount: countMap.get(p.tigerPkgId) || 0 }));
}

export default (prisma: PrismaClient) => {
  const router = Router();

  /** 某国家/区域的套餐列表（实时来源 TigerESIM，不落本地库） */
  router.get('/', async (req: Request, res: Response) => {
    const countryCode = req.query.countryCode as string;
    if (!countryCode) {
      return res.json({ code: 1, message: '缺少 countryCode 参数' });
    }
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，无法获取真实套餐，请在后台配置' });
    }
    const onlyFeatured = req.query.all !== '1';
    try {
      let packages = await listPackagesByRegion(countryCode, onlyFeatured);
      packages.sort((a, b) => a.gb - b.gb || a.days - b.days);
      packages = await attachSoldCounts(packages, prisma);
      res.json({ code: 0, data: { packages } });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐拉取失败：' + e.message });
    }
  });

  /** 各国最低起售价（实时来源 TigerESIM） */
  router.get('/min-prices', async (req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 0, data: { minPrices: [] } });
    }
    try {
      const all = await listAllPackagesView();
      const byRegion = new Map<string, number>();
      let currency = 'CNY';
      for (const p of all) {
        // 取全部套餐中的最低价，保证首页「起价」与详情页可选价格一致（详情页 all=1 展示所有套餐）
        const cur = byRegion.get(p.countryCode);
        if (cur === undefined || p.price < cur) byRegion.set(p.countryCode, p.price);
        currency = p.currency || currency; // 展示货币全量一致，取第一个非空即可
      }
      const countries = await prisma.country.findMany({ select: { code: true } });
      const minPrices = countries.map((c) => ({ code: c.code, currency, minPrice: byRegion.get(c.code) || 0 }));
      res.json({ code: 0, data: { minPrices } });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐拉取失败：' + e.message });
    }
  });

  /** 全量套餐列表（用于抽屉选择器，含全部国家/地区）——必须放在 /:id 之前 */
  router.get('/catalog/all', async (_req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET' });
    }
    try {
      // 强制刷新缓存以确保使用最新的 tigerToView 逻辑
      invalidatePackageCache();
      await refreshPackageCache();
      const all = await listAllPackagesView();
      res.json({ code: 0, data: { packages: all } });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐拉取失败：' + e.message });
    }
  });

  /** 按关键词搜索套餐（国家/套餐名/流量/天数/覆盖地区）——必须放在 /:id 之前 */
  router.get('/search', async (req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET' });
    }
    try {
      const all = await listAllPackagesView();
      const kw = String(req.query.keyword || '').trim().toLowerCase();
      const matched = kw
        ? all.filter((p) =>
            String(p.countryName || '').includes(kw) ||
            String(p.countryNameEn || '').toLowerCase().includes(kw) ||
            String(p.name || '').includes(kw) ||
            String(p.nameEn || '').toLowerCase().includes(kw) ||
            String(p.countryCode || '').toLowerCase().includes(kw) ||
            String(p.gb || '').includes(kw) ||
            String(p.days || '').includes(kw) ||
            JSON.stringify(p.coverageParams || '').toLowerCase().includes(kw)
          )
        : all;
      // 同一套餐组（countryCode）的各流量/天数组合只展示一张卡片：
      // 每组取最低价套餐作代表，按价格升序（与首页热销卡片、详情页抽屉的分组逻辑一致）
      const byRegion = new Map<string, any>();
      for (const p of matched) {
        const key = p.countryCode || p.countryName || 'OTHER';
        const cur = byRegion.get(key);
        if (!cur || p.price < cur.price) byRegion.set(key, p);
      }
      const packages = Array.from(byRegion.values()).sort((a: any, b: any) => a.price - b.price);
      res.json({ code: 0, data: { packages: await attachSoldCounts(packages, prisma) } });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐拉取失败：' + e.message });
    }
  });

  /** 套餐详情（实时来源 TigerESIM，按 Tiger id/pid 查询） */
  router.get('/:id', async (req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，无法获取真实套餐' });
    }
    try {
      const pkg = await getPackageView(req.params.id);
      if (!pkg) {
        return res.json({ code: 1, message: '套餐不存在' });
      }
      res.json({ code: 0, data: { pkg } });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐拉取失败：' + e.message });
    }
  });

  return router;
};