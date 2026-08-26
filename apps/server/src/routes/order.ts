import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { tigerClient } from '../tiger';
import { getPackageView } from '../tiger/view';
import { provisionEsim } from '../services/provision';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { pkgId, email, payMethod = 'alipay' } = req.body;
    if (!pkgId || !email) {
      return res.json({ code: 1, message: '缺少必要参数' });
    }
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，套餐实时来自 TigerESIM，请先在后台配置密钥' });
    }
    let pkg: any;
    try {
      pkg = await getPackageView(String(pkgId));
    } catch (e: any) {
      return res.status(502).json({ code: 1, message: 'Tiger 套餐获取失败：' + e.message });
    }
    if (!pkg) {
      return res.json({ code: 1, message: '套餐不存在（TigerESIM 未找到该套餐）' });
    }
    const orderNo = `DPH${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
    const order = await prisma.order.create({
      data: {
        orderNo,
        pkgId: String(pkg.tigerPkgId || pkg.id || pkgId),
        email,
        payMethod,
        price: pkg.price,
        status: 'pending',
        userId: req.userId,
        countryCode: pkg.countryCode,
        pkgName: pkg.name || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days}天`,
        gb: pkg.gb,
        days: pkg.days,
        tigerPkgId: pkg.tigerPkgId,
        tigerPid: pkg.tigerPid,
      },
    });
    res.json({ code: 0, data: { order } });
  });

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

    const subject = `${order.countryCode || 'eSIM'} eSIM（${order.gb || 0}GB / ${order.days || 0}天）`;
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
    try {
      const esimData = await provisionEsim(prisma, updated);
      const esim = await prisma.esim.create({ data: { ...esimData, userId: req.userId } });
      res.json({ code: 0, data: { order: updated, esim } });
    } catch (e: any) {
      console.error('[tiger] eSIM 下发失败：', e.message);
      res.json({ code: 2, message: `eSIM 下发失败：${e.message}`, data: { order: updated } });
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
    res.json({ code: 0, data: { order } });
  });

  router.get('/:orderNo/return', async (req: Request, res: Response) => {
    res.redirect(`/h5/pages/payment/payment?orderNo=${req.params.orderNo}`);
  });

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ code: 0, data: { orders } });
  });

  return router;
};