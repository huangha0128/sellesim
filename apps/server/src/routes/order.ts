import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { tigerClient, extractEsimInfo, getAvailableIccid } from '../tiger';
import { alipay } from '../utils/alipay';
import { authMiddleware, AuthRequest } from '../middleware/auth';

/**
 * 支付成功后下发 eSIM：
 * - 已配置 Tiger 凭据 → 从卡片池取 ICCID，调用 Tiger 绑定套餐，保存真实激活信息
 * - 未配置 → 回退到本地模拟生成（演示用）
 */
async function provisionEsim(prisma: PrismaClient, order: any, pkg: any) {
  const expireAt = new Date(Date.now() + (pkg?.days || 7) * 86400000);

  if (tigerClient.configured) {
    const iccid = await getAvailableIccid(prisma);
    if (!iccid) {
      throw new Error('Tiger 卡片池已用完或未配置 TIGER_ICCIDS，请补充卡片库存');
    }
    let tigerPkgId: number | null = pkg?.tigerPkgId ?? null;
    if (!tigerPkgId) {
      const listRes = await tigerClient.listPackages({ package_type: 'data', is_active: true, limit: 500 });
      const items: any[] = listRes?.data?.items || listRes?.items || [];
      const matched = items.find(
        (it) => Number(it.amount) === (pkg?.gb || 0) * 1024 && Number(it.valid_days) === (pkg?.days || 0),
      );
      if (!matched) {
        throw new Error(`未找到与套餐「${pkg?.countryCode} ${pkg?.gb}GB/${pkg?.days}天」匹配的 Tiger 套餐，请先在后台同步套餐映射`);
      }
      tigerPkgId = Number(matched.pid || matched.id);
    }
    const bindRes = await tigerClient.bindPackage(iccid, tigerPkgId);
    const info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    if (!info || !info.activationCode) {
      console.error('[tiger] 绑定成功但未能解析激活信息：', JSON.stringify(bindRes?.data));
      throw new Error('Tiger 绑定套餐成功，但返回数据缺少激活码，请检查响应结构');
    }
    return {
      orderId: order.id,
      pkgId: order.pkgId,
      activationCode: info.activationCode,
      iccid: info.iccid || iccid,
      smdp: info.smdp,
      status: 'pending',
      expireAt,
    };
  }

  // ===== 模拟回退（未配置 Tiger）=====
  const rand = () =>
    Array.from({ length: 4 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31))
    ).join('');
  const smdp = 'smdp.yyesim.net';
  const iccid = '89' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return {
    orderId: order.id,
    pkgId: order.pkgId,
    activationCode: `LPA:1$${smdp}$${rand()}-${rand()}-${rand()}`,
    iccid,
    smdp,
    status: 'pending',
    expireAt,
  };
}

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
