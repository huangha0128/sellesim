import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const countryCode = req.query.countryCode as string;
    if (!countryCode) {
      return res.json({ code: 1, message: '缺少 countryCode 参数' });
    }
    const onlyFeatured = req.query.all !== '1';
    const packages = await prisma.package.findMany({
      where: { countryCode, ...(onlyFeatured ? { isFeatured: true } : {}) },
      include: { country: true },
      orderBy: [{ gb: 'asc' }, { days: 'asc' }],
    });
    res.json({ code: 0, data: { packages } });
  });

  router.get('/min-prices', async (req: Request, res: Response) => {
    const countries = await prisma.country.findMany();
    const minPrices = [];
    for (const c of countries) {
      const pkg = await prisma.package.findFirst({
        where: { countryCode: c.code, isFeatured: true },
        orderBy: { price: 'asc' },
      });
      minPrices.push({ code: c.code, minPrice: pkg ? pkg.price : 0 });
    }
    res.json({ code: 0, data: { minPrices } });
  });

  router.get('/:id', async (req: Request, res: Response) => {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: { country: true },
    });
    if (!pkg) {
      return res.json({ code: 1, message: '套餐不存在' });
    }
    res.json({ code: 0, data: { pkg } });
  });

  return router;
};
