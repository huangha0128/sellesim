import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';
import { resolveEsimActivation } from '../tiger/activation';
import { applyRefundRequest, readMaxRefundRejectCount } from '../services/refund';
import { createOrder, OrderCreateError } from '../services/order';
import { createPaymentIntent, fulfillPaidOrder, buildRefundDeps } from '../services/payment';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const order = await createOrder(prisma, {
        pkgId: req.body.pkgId,
        email: req.body.email,
        userId: req.userId!,
        payMethod: req.body.payMethod || 'alipay',
        orderType: req.body.orderType || 'new',
        targetEsimId: req.body.targetEsimId,
      });
      res.json({ code: 0, data: { order } });
    } catch (e: any) {
      if (e instanceof OrderCreateError) {
        return res.status(e.status).json({ code: 1, message: e.message });
      }
      console.error('[order] 创建订单失败：', e.message);
      res.status(500).json({ code: 1, message: '创建订单失败，请稍后重试' });
    }
  });

  router.post('/:orderNo/create-payment', authMiddleware, async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, userId: req.userId },
    });
    if (!order) {
      return res.json({ code: 1, message: '订单不存在' });
    }

    try {
      // 公共支付接口：换算金额、构造商品名、调用支付宝预下单获取 trade_no，
      // 前端再调用 my.tradePay({ tradeNO }) 调起收银台。
      const result = await createPaymentIntent(prisma, order, {
        buyerOpenId: req.body?.buyerOpenId as string | undefined,
        buyerId: req.body?.buyerId as string | undefined,
      });

      if (result.paid) {
        return res.json({ code: 0, data: { order, paid: true } });
      }
      res.json({
        code: 0,
        data: {
          tradeNo: result.tradeNo,
          orderNo: result.orderNo,
          totalAmount: result.totalAmount,
        },
      });
    } catch (e: any) {
      console.error('[alipay] 创建支付失败：', e.message);
      const receivedBuyerOpenId = (req.body?.buyerOpenId as string | undefined) || '';
      res.json({ code: 1, message: `创建支付失败：${e.message} || buyerOpenId='${receivedBuyerOpenId}'` });
    }
  });

  router.post('/:orderNo/pay', authMiddleware, async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, userId: req.userId },
    });
    if (!order) {
      return res.json({ code: 1, message: '订单不存在' });
    }
    if (order.status === 'paid') {
      return res.json({ code: 0, data: { order } });
    }
    try {
      // 模拟/测试支付：直接置为已支付并走统一履约（置已支付 + 下发 eSIM/续费 + 邮件）
      const { order: updated, esim } = await fulfillPaidOrder(prisma, order);
      res.json({ code: 0, data: { order: updated, esim } });
    } catch (e: any) {
      console.error('[tiger] eSIM 操作失败：', e.message);
      res.json({ code: 2, message: `eSIM 操作失败：${e.message}`, data: { order } });
    }
  });

  router.get('/:orderNo', authMiddleware, async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findUnique({
      where: { orderNo: req.params.orderNo },
      include: { esim: true },
    });
    if (!order) {
      return res.json({ code: 1, message: '订单不存在' });
    }
    // 激活状态改为 Tiger 实时套餐状态
    if (order.esim && tigerClient.configured) {
      const resolved = await resolveEsimActivation(order.esim);
      if (resolved) Object.assign(order.esim, resolved);
    }
    // 附带退款申请被拒绝次数上限，供小程序端判断是否还能再次申请退款
    const maxRefundRejectCount = await readMaxRefundRejectCount();
    res.json({ code: 0, data: { order, maxRefundRejectCount } });
  });

  /**
   * DELETE /api/orders/:orderNo 删除订单
   * - 仅待付款（status=pending）且属于当前用户的订单可删除
   * - 已支付、退款中的订单不可删除
   */
  router.delete('/:orderNo', authMiddleware, async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, userId: req.userId },
    });
    if (!order) {
      return res.json({ code: 1, message: '订单不存在' });
    }
    if (order.status !== 'pending') {
      return res.json({ code: 1, message: '仅待付款订单可删除' });
    }
    try {
      await prisma.order.delete({ where: { id: order.id } });
      res.json({ code: 0, data: { orderNo: order.orderNo } });
    } catch (e: any) {
      console.error(`[order] 删除订单 ${req.params.orderNo} 失败：`, e.message);
      res.json({ code: 1, message: '删除订单失败，请稍后重试' });
    }
  });

  /**
   * POST /api/orders/:orderNo/refund-request 用户申请退款
   * - 仅待激活（status=paid 且 eSIM 未激活）订单可申请
   * - 提交后进入后台审批流程（refundStatus=requested）
   */
  router.post('/:orderNo/refund-request', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
      return res.json({ code: 401, message: '未登录' });
    }
    const { reason } = req.body || {};
    try {
      const result = await applyRefundRequest(
        buildRefundDeps(prisma, req.params.orderNo),
        req.userId,
        req.params.orderNo,
        typeof reason === 'string' ? reason : undefined,
      );
      res.json({ code: 0, data: result });
    } catch (e: any) {
      console.error(`[refund] 订单 ${req.params.orderNo} 申请退款失败：`, e.message);
      res.json({ code: 1, message: e.message });
    }
  });

  router.get('/:orderNo/return', async (req: Request, res: Response) => {
    res.redirect(`/h5/pages/payment/payment?orderNo=${req.params.orderNo}`);
  });

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        esim: {
          select: {
            status: true,
            activatedAt: true,
            expireAt: true,
            used: true,
            iccid: true,
            tigerPkgId: true,
            tigerPid: true,
          },
        },
      },
    });
    if (tigerClient.configured) {
      await Promise.all(
        orders.map(async (o) => {
          if (o.esim) {
            const resolved = await resolveEsimActivation(o.esim);
            if (resolved) Object.assign(o.esim, resolved);
          }
        }),
      );
    }
    res.json({ code: 0, data: { orders } });
  });

  return router;
};
