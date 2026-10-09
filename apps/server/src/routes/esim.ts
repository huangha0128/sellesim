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

  // eSIM 记录不允许用户删除：直接删除会造成已支付订单失去卡信息、Tiger 侧绑定残留、
  // ICCID 回流卡片池后被重复发放。保留该路由仅为兜底旧版小程序，一律拒绝且不做任何删除。
  router.delete('/:id', authMiddleware, async (_req: AuthRequest, res: Response) => {
    res.json({ code: 1, message: 'eSIM 记录不支持删除' });
  });

  return router;
};
