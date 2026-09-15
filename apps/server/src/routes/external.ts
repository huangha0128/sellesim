import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { externalAuth, ExternalAuthRequest } from '../middleware/externalAuth';
import { createOrder, OrderCreateError } from '../services/order';
import { createWapPaymentUrl } from '../services/payment';
import { resendWebhook } from '../services/webhook';
import { tigerClient } from '../tiger';
import { resolveEsimActivation } from '../tiger/activation';
import { config } from '../config';

/**
 * 外部开放支付 API（统一前缀 /api/external，全部走 HMAC 签名鉴权）。
 *
 * 响应约定（对外文档同步）：
 *   成功    HTTP 200  { code: 0, data: {...} }
 *   鉴权失败 HTTP 401  { code: 401, message }
 *   业务失败 HTTP 400/404 { code: 400|404, message }
 *
 * eSIM 敏感信息（激活码/ICCID/SMDP）仅在订单 paid 后返回，pending 一律省略。
 */

/** 将订单归一化为对外响应结构（paid 才含激活码等敏感信息） */
function toExternalOrderView(order: any): any {
  const base: any = {
    orderNo: order.orderNo,
    extOrderNo: order.extOrderNo || null,
    status: order.status,
    orderType: order.orderType,
    pkgId: order.pkgId,
    countryCode: order.countryCode || null,
    pkgName: order.pkgName || null,
    pkgNameEn: order.pkgNameEn || null,
    gb: order.gb ?? null,
    days: order.days ?? null,
    isUnlimited: !!order.isUnlimited,
    price: order.price,
    paidAmount: order.paidAmount ?? null,
    paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
    createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
    webhookStatus: order.webhookStatus || 'none',
    // 退款相关：外部项目据此感知退款进度并对账；未发生退款时均为 null
    refundStatus: order.refundStatus || null,
    refundAmount: order.refundAmount ?? null,
    refundReason: order.refundReason || null,
    refundRejectReason: order.refundRejectReason || null,
    refundRequestedAt: order.refundRequestedAt ? new Date(order.refundRequestedAt).toISOString() : null,
    refundedAt: order.refundedAt ? new Date(order.refundedAt).toISOString() : null,
  };
  if (order.esim) {
    base.esim = {
      status: order.esim.status,
      activatedAt: order.esim.activatedAt ? new Date(order.esim.activatedAt).toISOString() : null,
      expireAt: order.esim.expireAt ? new Date(order.esim.expireAt).toISOString() : null,
      used: order.esim.used ?? 0,
      // 仅已支付订单返回激活码等敏感信息
      ...(order.status === 'paid'
        ? {
            activationCode: order.esim.activationCode,
            iccid: order.esim.iccid,
            smdp: order.esim.smdp,
          }
        : {}),
    };
  } else {
    base.esim = null;
  }
  return base;
}

/** 邮箱格式校验（激活码要发往该邮箱，格式错误会导致邮件无法送达） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 仅允许 http(s) 地址，防 returnUrl 被注入 javascript:/data: 等协议造成开放重定向 */
function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default (prisma: PrismaClient) => {
  const router = Router();
  router.use(externalAuth(prisma));

  /**
   * POST /api/external/orders 创建订单并返回 H5 支付链接
   * body: { pkgId, email, extOrderNo?, returnUrl? }
   * - extOrderNo：外部项目自己的订单号，用于对账与反查；同一应用重复提交相同 extOrderNo 时幂等返回已有订单
   * - returnUrl：支付完成后浏览器回跳地址，缺省回跳到本系统支付结果页
   */
  router.post('/orders', async (req: ExternalAuthRequest, res: Response) => {
    const { pkgId, email, extOrderNo, returnUrl } = req.body || {};
    if (!req.externalUserId) {
      return res.status(401).json({ code: 401, message: '未鉴权' });
    }

    // 参数校验：提前返回明确错误，避免非法邮箱导致激活码邮件无法送达
    if (!pkgId || !email) {
      return res.status(400).json({ code: 400, message: '缺少必要参数 pkgId / email' });
    }
    if (!EMAIL_RE.test(String(email))) {
      return res.status(400).json({ code: 400, message: 'email 格式不正确' });
    }
    if (returnUrl !== undefined && returnUrl !== null && String(returnUrl) !== '' && !isHttpUrl(String(returnUrl))) {
      return res.status(400).json({ code: 400, message: 'returnUrl 必须是 http(s):// 开头的合法地址' });
    }

    try {
      // 幂等：同一外部订单号已存在则直接复用，避免客户端重试产生重复订单
      if (extOrderNo) {
        const existing = await prisma.order.findFirst({
          where: { userId: req.externalUserId, extOrderNo: String(extOrderNo) },
        });
        if (existing) {
          const result = await createWapPaymentUrl(prisma, existing, {
            returnUrl: returnUrl || defaultReturnUrl(existing.orderNo),
          });
          return res.json({
            code: 0,
            data: {
              orderNo: existing.orderNo,
              extOrderNo: existing.extOrderNo || null,
              payUrl: result.payUrl,
              totalAmount: result.totalAmount,
              paid: result.paid,
            },
          });
        }
      }

      const order = await createOrder(prisma, {
        pkgId,
        email,
        userId: req.externalUserId,
        payMethod: 'alipay',
        orderType: 'new',
        extOrderNo: extOrderNo ? String(extOrderNo) : undefined,
      });

      const result = await createWapPaymentUrl(prisma, order, {
        returnUrl: returnUrl || defaultReturnUrl(order.orderNo),
      });

      res.json({
        code: 0,
        data: {
          orderNo: order.orderNo,
          extOrderNo: order.extOrderNo || null,
          payUrl: result.payUrl,
          totalAmount: result.totalAmount,
          paid: result.paid,
        },
      });
    } catch (e: any) {
      if (e instanceof OrderCreateError) {
        const status = e.status >= 400 ? e.status : 400;
        return res.status(status).json({ code: status, message: e.message });
      }
      console.error('[external] 创建订单失败：', e.message);
      res.status(500).json({ code: 500, message: '创建订单失败，请稍后重试' });
    }
  });

  /** GET /api/external/orders/:orderNo 查询订单详情（仅 paid 返回激活码/ICCID/SMDP） */
  router.get('/orders/:orderNo', async (req: ExternalAuthRequest, res: Response) => {
    if (!req.externalUserId) {
      return res.status(401).json({ code: 401, message: '未鉴权' });
    }
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, userId: req.externalUserId },
      include: { esim: true },
    });
    if (!order) {
      return res.status(404).json({ code: 404, message: '订单不存在' });
    }
    // 激活状态富化为 Tiger 实时套餐状态（仅当配置了 Tiger）
    if (order.esim && tigerClient.configured) {
      const resolved = await resolveEsimActivation(order.esim);
      if (resolved) Object.assign(order.esim, resolved);
    }
    res.json({ code: 0, data: { order: toExternalOrderView(order) } });
  });

  /** GET /api/external/orders?extOrderNo=xxx 按外部订单号反查 */
  router.get('/orders', async (req: ExternalAuthRequest, res: Response) => {
    if (!req.externalUserId) {
      return res.status(401).json({ code: 401, message: '未鉴权' });
    }
    const extOrderNo = String(req.query.extOrderNo || '');
    if (!extOrderNo) {
      return res.status(400).json({ code: 400, message: '缺少查询参数 extOrderNo' });
    }
    const order = await prisma.order.findFirst({
      where: { userId: req.externalUserId, extOrderNo },
      include: { esim: true },
    });
    if (!order) {
      return res.status(404).json({ code: 404, message: '订单不存在' });
    }
    if (order.esim && tigerClient.configured) {
      const resolved = await resolveEsimActivation(order.esim);
      if (resolved) Object.assign(order.esim, resolved);
    }
    res.json({ code: 0, data: { order: toExternalOrderView(order) } });
  });

  /** POST /api/external/orders/:orderNo/webhook/retry 手动重发支付成功回调（立即发送一次） */
  router.post('/orders/:orderNo/webhook/retry', async (req: ExternalAuthRequest, res: Response) => {
    if (!req.externalUserId) {
      return res.status(401).json({ code: 401, message: '未鉴权' });
    }
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, userId: req.externalUserId },
    });
    if (!order) {
      return res.status(404).json({ code: 404, message: '订单不存在' });
    }
    if (order.status !== 'paid') {
      return res.status(400).json({ code: 400, message: '订单尚未支付成功，无需回调' });
    }
    const result = await resendWebhook(prisma, order);
    if (!result.sent) {
      return res.status(400).json({ code: 400, message: result.message || '回调发送失败' });
    }
    res.json({ code: 0, data: { orderNo: order.orderNo, sent: true } });
  });

  /** GET /api/external/orders/:orderNo/return H5 支付后浏览器回跳（302 到本系统支付结果页） */
  router.get('/orders/:orderNo/return', (req: Request, res: Response) => {
    res.redirect(defaultReturnUrl(req.params.orderNo));
  });

  return router;
};

/** 缺省回跳地址：本系统 H5 支付结果页 */
function defaultReturnUrl(orderNo: string): string {
  return `${config.alipay.notifyHost}/h5/pages/payment/payment?orderNo=${orderNo}`;
}
