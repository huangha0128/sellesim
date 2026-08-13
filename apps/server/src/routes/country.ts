import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 0;
    const countries = await prisma.country.findMany({
      include: { _count: { select: { packages: true } } },
      orderBy: { code: 'asc' },
    });
    const enriched = countries
      .map((c: any) => {
        const hot = (c as any).hot || (c as any)._count.packages;
        const { _count, ...rest } = c;
        return { ...rest, hot: Number(hot) || 0, packageCount: _count.packages };
      })
      .sort((a: any, b: any) => b.hot - a.hot || a.code.localeCompare(b.code));
    res.json({ code: 0, data: { countries: limit ? enriched.slice(0, limit) : enriched } });
  });

  router.get('/hot', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const countries = await prisma.country.findMany({
      where: { cat: { not: '全球' } },
      include: { _count: { select: { packages: true } } },
    });
    const enriched = countries
      .filter((c: any) => (c as any)._count.packages > 0)
      .map((c: any) => {
        const { _count, ...rest } = c;
        return { ...rest, hot: (c as any).hot || _count.packages, packageCount: _count.packages };
      })
      .sort((a: any, b: any) => b.packageCount - a.packageCount || b.hot - a.hot)
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
