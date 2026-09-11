import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { tigerClient } from '../tiger';
import { getPackageView } from '../tiger/view';
import { provisionEsim } from '../services/provision';
import { renewEsim } from '../services/topup';
import { resolveEsimActivation } from '../tiger/activation';
import { sendEsimEmail, sendRenewEmail } from '../services/email';
import { applyRefundRequest } from '../services/refund';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { readDisplayConfig, DEFAULT_DISPLAY_CONFIG } from '../pricing/priceOverride';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { pkgId, email, payMethod = 'alipay', orderType = 'new', targetEsimId } = req.body;
    if (!pkgId || !email) {
      return res.json({ code: 1, message: '缺少必要参数' });
    }
    if (orderType !== 'new' && orderType !== 'renew') {
      return res.json({ code: 1, message: '非法订单类型' });
    }
    // 续费必须指定属于当前用户的目标 eSIM，且其当前套餐必须已到期
    if (orderType === 'renew') {
      if (!targetEsimId) {
        return res.json({ code: 1, message: '缺少目标 eSIM' });
      }
      const target = await prisma.esim.findFirst({
        where: { id: targetEsimId, userId: req.userId },
      });
      if (!target) {
        return res.json({ code: 1, message: '目标 eSIM 不存在' });
      }
      if (target.expireAt && new Date(target.expireAt).getTime() > Date.now()) {
        return res.json({ code: 1, message: '当前套餐尚未到期，到期后才能为该卡续费购买新套餐' });
      }
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
        pkgNameEn: pkg.nameEn || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days} Days`,
        gb: pkg.gb,
        days: pkg.days,
        isUnlimited: !!pkg.isUnlimited,
        tigerPkgId: pkg.tigerPkgId,
        tigerPid: pkg.tigerPid,
        orderType,
        targetEsimId: targetEsimId || null,
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

    // 商品名用纯 ASCII，避免中文编码导致支付宝"加签结果验证不通过"
    const subject = `eSIM ${order.isUnlimited ? 'Unlimited' : `${order.gb || 0}GB`} ${order.days || 0}Days`;
    // 付款金额改为订单实价。订单价格按展示货币存储（CNY 或 USD），支付宝仅支持人民币，
    // 展示货币为 USD 时需按汇率换算成 CNY。
    const displayCfg = await readDisplayConfig();
    let cnyAmount = order.price;
    if (displayCfg.displayCurrency === 'USD') {
      const rate = displayCfg.usdCnyRate > 0 ? displayCfg.usdCnyRate : DEFAULT_DISPLAY_CONFIG.usdCnyRate;
      cnyAmount = order.price * rate;
    }
    cnyAmount = Math.round(cnyAmount * 100) / 100;
    const totalAmount = cnyAmount.toFixed(2);

    const host = config.alipay.notifyHost;
    const notifyUrl = `${host}/api/alipay/notify`;

    try {
      // JSAPI 支付：后端调 alipay.trade.create 创建预下单，获取 trade_no 返回给小程序，
      // 前端再调用 my.tradePay({ tradeNO }) 调起收银台。
      const tradeNo = await alipay.createTradeNo(
        order.orderNo,
        subject,
        totalAmount,
        notifyUrl,
        req.body?.buyerOpenId as string | undefined,
        req.body?.buyerId as string | undefined,
      );

      res.json({
        code: 0,
        data: {
          tradeNo,
          orderNo: order.orderNo,
          totalAmount,
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
    const updated = await prisma.order.update({
      where: { orderNo: req.params.orderNo },
      data: { status: 'paid', paidAt: new Date() },
    });
    try {
      if (updated.orderType === 'renew') {
        const target = await prisma.esim.findFirst({
          where: { id: updated.targetEsimId || '', userId: req.userId },
        });
        if (!target) {
          throw new Error('目标 eSIM 不存在');
        }
        // renewEsim 内部会再次校验该卡当前套餐已到期
        const esimData = await renewEsim(prisma, updated, target);
        const esim = await prisma.esim.create({ data: { ...esimData, userId: req.userId } });

        sendRenewEmailSafe(updated, target, esim).catch((e) =>
          console.error(`[email] 订单 ${updated.orderNo} 续费通知发送失败：`, e.message),
        );
        res.json({ code: 0, data: { order: updated, esim } });
      } else {
        const esimData = await provisionEsim(prisma, updated);
        const esim = await prisma.esim.create({ data: { ...esimData, userId: req.userId } });
        // 发送激活码邮件（非阻塞，失败不影响下单结果）
        sendEsimEmailSafe(updated, esimData).catch((e) =>
          console.error(`[email] 订单 ${updated.orderNo} 激活码邮件发送失败：`, e.message),
        );
        res.json({ code: 0, data: { order: updated, esim } });
      }
    } catch (e: any) {
      console.error('[tiger] eSIM 操作失败：', e.message);
      res.json({ code: 2, message: `eSIM 操作失败：${e.message}`, data: { order: updated } });
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
    res.json({ code: 0, data: { order } });
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
        {
          findOrder: (orderNo) => prisma.order.findUnique({ where: { orderNo } }),
          findUserOrder: (userId, orderNo) =>
            prisma.order.findFirst({ where: { orderNo, userId } }),
          updateOrder: (orderNo, data) => prisma.order.update({ where: { orderNo }, data }),
          findEsimByOrderId: (orderId) => prisma.esim.findUnique({ where: { orderId } }),
          deleteEsimByOrderId: async (orderId) => {
            await prisma.esim.delete({ where: { orderId } });
          },
          alipayRefund: async () => ({ code: '10000' }),
        },
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

/** 发送激活码邮件（安全包装，失败只打日志） */
async function sendEsimEmailSafe(order: any, esimData: any) {
  if (!order.email) return;
  await sendEsimEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: order.pkgName || order.countryCode || '',
    gb: order.gb || 0,
    days: order.days || 0,
    activationCode: esimData.activationCode,
    iccid: esimData.iccid,
    expireAt: esimData.expireAt,
  });
}

/** 发送续费成功通知邮件（安全包装，失败只打日志） */
async function sendRenewEmailSafe(order: any, targetEsim: any, updatedEsim: any) {
  if (!order.email) return;
  await sendRenewEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: order.pkgName || order.countryCode || '',
    gb: updatedEsim.gb ?? order.gb ?? 0,
    days: updatedEsim.days ?? order.days ?? 0,
    expireAt: updatedEsim.expireAt,
  });
}
