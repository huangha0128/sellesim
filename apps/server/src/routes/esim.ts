import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { tigerClient } from '../tiger';
import { enrichEsims, localDisplayEsim } from '../tiger/esim-enrich';

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

    const displayEsims = await enrichEsims(esims);
    console.log(`[esims] db=${t1 - t0}ms enrich=${Date.now() - t1}ms total=${Date.now() - t0}ms esims=${esims.length}`);
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
