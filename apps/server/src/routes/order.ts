import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { tigerClient } from '../tiger';
import { getPackageView } from '../tiger/view';
import { provisionEsim } from '../services/provision';
import { renewEsim, changeEsim } from '../services/topup';
import { sendEsimEmail, sendRenewEmail, sendChangeEmail } from '../services/email';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { pkgId, email, payMethod = 'alipay', orderType = 'new', targetEsimId } = req.body;
    if (!pkgId || !email) {
      return res.json({ code: 1, message: '缺少必要参数' });
    }
    if (orderType !== 'new' && orderType !== 'renew' && orderType !== 'change') {
      return res.json({ code: 1, message: '非法订单类型' });
    }
    // 续费/变更必须指定属于当前用户的目标 eSIM
    if (orderType !== 'new') {
      if (!targetEsimId) {
        return res.json({ code: 1, message: '缺少目标 eSIM' });
      }
      const target = await prisma.esim.findFirst({
        where: { id: targetEsimId, userId: req.userId },
      });
      if (!target) {
        return res.json({ code: 1, message: '目标 eSIM 不存在' });
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
        gb: pkg.gb,
        days: pkg.days,
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
    const subject = `eSIM ${order.gb || 0}GB ${order.days || 0}Days`;
    // TODO(测试): 测试期间付款金额写死为 0.01 元，测试完成后需改回订单实价
    const totalAmount = '0.01';

    const host = process.env.ALIPAY_NOTIFY_HOST || `http://localhost:${process.env.PORT || 6660}`;
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
      if (updated.orderType === 'renew' || updated.orderType === 'change') {
        const target = await prisma.esim.findFirst({
          where: { id: updated.targetEsimId || '', userId: req.userId },
        });
        if (!target) {
          throw new Error('目标 eSIM 不存在');
        }
        const esim =
          updated.orderType === 'renew'
            ? await renewEsim(prisma, updated, target)
            : await changeEsim(prisma, updated, target);

        if (updated.orderType === 'renew') {
          sendRenewEmailSafe(updated, target, esim).catch((e) =>
            console.error(`[email] 订单 ${updated.orderNo} 续费通知发送失败：`, e.message),
          );
        } else {
          sendChangeEmailSafe(updated, target, esim).catch((e) =>
            console.error(`[email] 订单 ${updated.orderNo} 变更通知发送失败：`, e.message),
          );
        }
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
    res.json({ code: 0, data: { order } });
  });

  router.get('/:orderNo/return', async (req: Request, res: Response) => {
    res.redirect(`/h5/pages/payment/payment?orderNo=${req.params.orderNo}`);
  });

  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { esim: { select: { status: true } } },
    });
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
    addedGb: order.gb || 0,
    addedDays: order.days || 0,
    totalGb: updatedEsim.gb ?? targetEsim.gb ?? order.gb ?? 0,
    totalDays: updatedEsim.days ?? targetEsim.days ?? order.days ?? 0,
    expireAt: updatedEsim.expireAt,
  });
}

/** 发送套餐变更成功通知邮件（安全包装，失败只打日志） */
async function sendChangeEmailSafe(order: any, targetEsim: any, updatedEsim: any) {
  if (!order.email) return;
  await sendChangeEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: order.pkgName || order.countryCode || '',
    gb: updatedEsim.gb ?? order.gb ?? 0,
    days: updatedEsim.days ?? order.days ?? 0,
    expireAt: updatedEsim.expireAt,
    activationCode: updatedEsim.activationCode || targetEsim.activationCode,
    iccid: updatedEsim.iccid || targetEsim.iccid,
  });
}