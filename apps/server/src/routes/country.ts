import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';

/** 实时统计每个国家/区域的 Tiger 可售套餐数（套餐不落本地库） */
async function buildPkgCountMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!tigerClient.configured) return map;
  try {
    const { listAllPackagesView } = await import('../tiger/view');
    for (const p of await listAllPackagesView()) {
      map.set(p.countryCode, (map.get(p.countryCode) || 0) + 1);
    }
  } catch {
    /* 拉取失败保持 0 */
  }
  return map;
}

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 0;
    const countries = await prisma.country.findMany({ orderBy: { code: 'asc' } });
    const pkgCountMap = await buildPkgCountMap();
    const enriched = countries
      .map((c: any) => {
        const packageCount = pkgCountMap.get(c.code) || 0;
        const hot = Number(c.hot) || packageCount;
        return { ...c, hot: Number(hot) || 0, packageCount };
      })
      .sort(
        (a: any, b: any) =>
          b.priority - a.priority || b.hot - a.hot || a.code.localeCompare(b.code),
      );
    res.json({ code: 0, data: { countries: limit ? enriched.slice(0, limit) : enriched } });
  });

  router.get('/hot', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const countries = await prisma.country.findMany({ where: { cat: { not: '全球' } } });
    const pkgCountMap = await buildPkgCountMap();
    const enriched = countries
      .map((c: any) => {
        const packageCount = pkgCountMap.get(c.code) || 0;
        return { ...c, hot: Number(c.hot || 0) || packageCount, packageCount };
      })
      .filter((c: any) => c.packageCount > 0)
      .sort(
        (a: any, b: any) =>
          b.priority - a.priority ||
          b.packageCount - a.packageCount ||
          b.hot - a.hot,
      )
      .slice(0, limit);
    res.json({ code: 0, data: { countries: enriched } });
  });

router.get('/search', async (req: Request, res: Response) => {
    const keyword = (req.query.keyword as string || '').trim().toLowerCase();
    if (!keyword) {
      const countries = await prisma.country.findMany();
      return res.json({ code: 0, data: { countries } });
    }
    const countries = await prisma.country.findMany({
      where: {
        OR: [
          { name: { contains: keyword } },
          { en: { contains: keyword } },
          { pinyin: { contains: keyword } },
          { code: { equals: keyword.toUpperCase() } },
        ],
      },
    });
    res.json({ code: 0, data: { countries } });
  });

  router.get('/:code', async (req: Request, res: Response) => {
    const country = await prisma.country.findUnique({
      where: { code: req.params.code.toUpperCase() },
    });
    if (!country) {
      return res.status(404).json({ code: 1, message: '国家/区域不存在' });
    }
    res.json({ code: 0, data: { country } });
  });

  return router;
};
