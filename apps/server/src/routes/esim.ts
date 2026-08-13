import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const esims = await prisma.esim.findMany({
      orderBy: { createdAt: 'desc' },
      include: { order: { include: { package: { include: { country: true } } } } },
    });
    res.json({ code: 0, data: { esims } });
  });

  router.post('/:id/activate', async (req: Request, res: Response) => {
    const esim = await prisma.esim.update({
      where: { id: req.params.id },
      data: { status: 'activated', activatedAt: new Date() },
    });
    res.json({ code: 0, data: { esim } });
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    await prisma.esim.delete({ where: { id: req.params.id } });
    res.json({ code: 0, data: {} });
  });

  return router;
};
