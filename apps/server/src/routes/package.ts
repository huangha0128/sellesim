import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';
import { listAllPackagesView, listPackagesByRegion, getPackageView } from '../tiger/view';

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
      const packages = await listPackagesByRegion(countryCode, onlyFeatured);
      packages.sort((a, b) => a.gb - b.gb || a.days - b.days);
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