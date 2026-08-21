import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient, iccidPoolCount, getIccidPool } from '../tiger';
import { syncAllFromTiger, syncRegionsFromTiger, syncPackagesFromTiger } from '../tiger/sync';
import { refundOrder } from '../services/refund';
import { sendRefundEmail } from '../services/email';
import { alipay } from '../utils/alipay';

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
      include: {
        package: { include: { country: true } },
        user: true,
      },
    });
    res.json({ code: 0, data: { orders } });
  });

  /**
   * POST /api/admin/orders/:orderNo/refund 订单退款
   * - 仅已支付订单可退款
   * - 调用支付宝退款（alipay.trade.refund，out_request_no 保证幂等）
   * - 退款成功后订单置为 refunded，删除 eSIM 记录（ICCID 归还卡片池）
   */
  router.post('/orders/:orderNo/refund', async (req: Request, res: Response) => {
    const { reason } = req.body || {};
    try {
      const result = await refundOrder(
        {
          findOrder: (orderNo) => prisma.order.findUnique({ where: { orderNo } }),
          updateOrder: (orderNo, data) => prisma.order.update({ where: { orderNo }, data }),
          findEsimByOrderId: (orderId) => prisma.esim.findUnique({ where: { orderId } }),
          deleteEsimByOrderId: async (orderId) => {
            await prisma.esim.delete({ where: { orderId } });
          },
          alipayRefund: async (params) => {
            // 演示/测试环境（订单由模拟支付产生、无真实支付宝交易号）直接记为退款成功
            const order = await prisma.order.findUnique({ where: { orderNo: params.outTradeNo } });
            if (!order?.alipayTradeNo) {
              return { code: '10000', tradeNo: `RF${Date.now()}` };
            }
            return alipay.refund(params.outTradeNo, params.refundAmount, params.outRequestNo, params.refundReason);
          },
        },
        req.params.orderNo,
        reason,
      );

      // 退款成功后向用户邮箱发送退款通知（发送失败不影响退款结果）
      const order = result?.order || (await prisma.order.findUnique({ where: { orderNo: req.params.orderNo } }));
      if (order?.email) {
        sendRefundEmail({
          to: order.email,
          orderNo: order.orderNo,
          amount: Number(order.price).toFixed(2),
        }).catch((e) => console.error(`[email] 订单 ${order.orderNo} 退款通知发送失败：`, e.message));
      }

      res.json({ code: 0, data: result });
    } catch (e: any) {
      console.error(`[refund] 订单 ${req.params.orderNo} 退款失败：`, e.message);
      res.json({ code: 1, message: e.message });
    }
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
    const [countryCount, packageCount, poolCount] = await Promise.all([
      prisma.country.count(),
      prisma.package.count(),
      iccidPoolCount(prisma),
    ]);
    res.json({
      code: 0,
      data: {
        configured: tigerClient.configured,
        baseUrl: tigerClient.baseUrl,
        iccidPoolSize: poolCount,
        mode: tigerClient.configured ? 'tiger' : 'mock',
        countryCount,
        packageCount,
        synced: packageCount > 0,
      },
    });
  });

  // ===== 卡片（ICCID）池管理 =====

  /** GET /api/admin/cards 卡片列表与统计（已使用状态按 esim 表判断） */
  router.get('/cards', async (_req: Request, res: Response) => {
    const [cards, esims, envCards] = await Promise.all([
      prisma.card.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.esim.findMany({ select: { iccid: true } }),
      getIccidPool(prisma),
    ]);
    const usedSet = new Set(esims.map((e) => e.iccid));
    const list = cards.map((c) => ({ ...c, used: usedSet.has(c.iccid) }));
    const used = list.filter((c) => c.used).length;
    const available = list.length - used;
    res.json({
      code: 0,
      data: {
        cards: list,
        stats: {
          total: list.length,
          available,
          used,
          envOnly: Math.max(0, envCards.length - list.length),
        },
      },
    });
  });

  /** POST /api/admin/cards 批量新增卡片（跳过已存在的 ICCID，新增即时生效） */
  router.post('/cards', async (req: Request, res: Response) => {
    const { iccids, remark } = req.body || {};
    const list: string[] = (Array.isArray(iccids) ? iccids : []).map((s) => String(s).trim()).filter(Boolean);
    if (list.length === 0) {
      return res.json({ code: 1, message: '请至少提供一个 ICCID' });
    }
    const existing = new Set(
      (await prisma.card.findMany({ select: { iccid: true } })).map((c) => c.iccid),
    );
    const toAdd = Array.from(new Set(list)).filter((i) => !existing.has(i));
    for (const iccid of toAdd) {
      await prisma.card.create({ data: { iccid, remark: remark || '' } });
    }
    res.json({
      code: 0,
      data: { added: toAdd.length, skipped: list.length - toAdd.length },
    });
  });

  /** DELETE /api/admin/cards/:iccid 删除卡片（已使用的卡片删除后其 ICCID 不再参与取卡） */
  router.delete('/cards/:iccid', async (req: Request, res: Response) => {
    const iccid = String(req.params.iccid || '');
    const card = await prisma.card.findUnique({ where: { iccid } });
    if (!card) {
      return res.json({ code: 1, message: '卡片不存在' });
    }
    const used = await prisma.esim.findFirst({ where: { iccid }, select: { id: true } });
    await prisma.card.delete({ where: { iccid } });
    res.json({ code: 0, data: { deleted: iccid, wasUsed: Boolean(used) } });
  });

  /** POST /api/admin/tiger/sync-all 全量同步所有数据 */
  router.post('/tiger/sync-all', async (_req: Request, res: Response) => {
    try {
      const result = await syncAllFromTiger(prisma);
      res.json({ code: 0, data: result });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
    }
  });

  /** POST /api/admin/tiger/sync-regions 同步国家/地区 */
  router.post('/tiger/sync-regions', async (_req: Request, res: Response) => {
    try {
      const result = await syncRegionsFromTiger(prisma);
      res.json({ code: 0, data: result });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
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
