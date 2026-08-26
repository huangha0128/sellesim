import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { provisionEsim } from '../services/provision';
import { alipay } from '../utils/alipay';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { pkgId, email, payMethod = 'alipay' } = req.body;
    if (!pkgId || !email) {
      return res.json({ code: 1, message: '缺少必要参数' });
    }
    const pkg = await prisma.package.findUnique({ where: { id: pkgId } });
    if (!pkg) {
      return res.json({ code: 1, message: '套餐不存在' });
    }
    const orderNo = `DPH${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
    const order = await prisma.order.create({
      data: {
        orderNo,
        pkgId,
        email,
        payMethod,
        price: pkg.price,
        status: 'pending',
        userId: req.userId,
      },
    });
    res.json({ code: 0, data: { order } });
  });

  /**
   * 创建支付宝支付（H5 手机网站支付）
   * 返回支付宝支付链接，前端跳转即可唤起支付宝收银台
   */
  router.post('/:orderNo/create-payment', authMiddleware, async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, userId: req.userId },
    });
    if (!order) {
      return res.json({ code: 1, message: '订单不存在' });
    }
    if (order.status === 'paid') {
      return res.json({ code: 0, data: { order, paid: true } });
    }

    const pkg = await prisma.package.findUnique({ where: { id: order.pkgId } });
    const subject = `${pkg?.countryCode || 'eSIM'} eSIM（${pkg?.gb}GB / ${pkg?.days}天）`;
    const totalAmount = Number(order.price).toFixed(2);

    const host = process.env.ALIPAY_NOTIFY_HOST || `http://localhost:${process.env.PORT || 6660}`;
    const notifyUrl = `${host}/api/alipay/notify`;
    const returnUrl = `${host.replace(/:\d+$/, '')}/api/orders/${order.orderNo}/return`;

    try {
      const paymentUrl = alipay.buildPaymentUrl(
        order.orderNo,
        subject,
        totalAmount,
        notifyUrl,
        returnUrl,
        order.id,
      );

      res.json({
        code: 0,
        data: {
          paymentUrl,
          orderNo: order.orderNo,
          totalAmount,
        },
      });
    } catch (e: any) {
      console.error('[alipay] 创建支付失败：', e.message);
      res.json({ code: 1, message: `创建支付失败：${e.message}` });
    }
  });

  /**
   * 模拟支付（开发/测试用）
   * 直接标记订单为已支付并下发 eSIM，不走真实支付宝
   */
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
    const updated = await prisma.order.update({
      where: { orderNo: req.params.orderNo },
      data: { status: 'paid', paidAt: new Date() },
    });
    const pkg = await prisma.package.findUnique({ where: { id: order.pkgId } });
    try {
      const esimData = await provisionEsim(prisma, order, pkg);
      const esim = await prisma.esim.create({ data: { ...esimData, userId: req.userId } });
      res.json({ code: 0, data: { order: updated, esim } });
    } catch (e: any) {
      console.error('[tiger] eSIM 下发失败：', e.message);
      res.json({ code: 2, message: `eSIM 下发失败：${e.message}`, data: { order: updated } });
    }
  });

  /**
   * 查询订单支付状态
   */
  router.get('/:orderNo', authMiddleware, async (req: AuthRequest, res: Response) => {
    const order = await prisma.order.findUnique({
      where: { orderNo: req.params.orderNo },
      include: { package: { include: { country: true } }, esim: true },
    });
    if (!order) {
      return res.json({ code: 1, message: '订单不存在' });
    }
    res.json({ code: 0, data: { order } });
  });

  /**
   * 支付宝支付成功后的同步回跳（H5 支付完成后跳转到此）
   */
  router.get('/:orderNo/return', async (req: Request, res: Response) => {
    res.redirect(`/h5/pages/payment/payment?orderNo=${req.params.orderNo}`);
  });

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { package: { include: { country: true } } },
    });
    res.json({ code: 0, data: { orders } });
  });

  return router;
};
