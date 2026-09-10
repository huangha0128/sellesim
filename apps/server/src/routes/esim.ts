import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { tigerClient } from '../tiger';
import { resolveEsimActivationStatus } from '../tiger/activation';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const esims = await prisma.esim.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });
    // 激活状态不再读本地写死的 pending/activated，改为按 Tiger 实时套餐状态覆盖
    if (tigerClient.configured && esims.length) {
      await Promise.all(
        esims.map(async (e) => {
          e.status = await resolveEsimActivationStatus(e);
        }),
      );
    }
    res.json({ code: 0, data: { esims } });
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
