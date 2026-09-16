import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { openAuth, OpenAuthRequest } from '../middleware/openAuth';
import { listAllPackagesView, getPackageView } from '../tiger/view';
import { resolveSubjectPrice, applySubjectPrices } from '../services/subjectPricing';
import { createSubjectOrder, OrderCreateError } from '../services/order';
import { createWapPaymentUrl, alipayProvider } from '../services/payment';
import { refundOrderSelfService, SelfServiceRefundError } from '../services/refund';
import { enqueueSubjectWebhook, resendSubjectWebhook } from '../services/webhook';
import { resolveEsimActivation } from '../tiger/activation';
import { tigerClient } from '../tiger';
import { config } from '../config';

/**
 * Open platform v2 API (统一前缀 /api/open/v1).
 * Dual-mode auth: read requests need only X-Api-Key; write requests (order,
 * refund, webhook retry) additionally require X-Timestamp/X-Nonce/X-Sign.
 *
 * Response envelope: { code: 0, message: 'ok', data, requestId }.
 * eSIM sensitive info (activation code / ICCID / SMDP) is returned only when
 * the order is paid.
 */

function genRequestId(): string {
  return 'req_' + crypto.randomBytes(8).toString('hex');
}
function ok(res: Response, data: any): void {
  res.json({ code: 0, message: 'ok', data, requestId: genRequestId() });
}
function err(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ code, message, requestId: genRequestId() });
}

/** order -> open view (esim sensitive only when paid) */
function toOpenOrderView(order: any, includeEsimSensitive = true): any {
  const base: any = {
    orderNo: order.orderNo,
    extOrderNo: order.extOrderNo || null,
    status: order.status,
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
    refundAmount: order.refundAmount ?? null,
    refundedAt: order.refundedAt ? new Date(order.refundedAt).toISOString() : null,
  };
  if (order.esim) {
    const eSIM = order.esim;
    base.esim = {
      status: eSIM.status,
      activatedAt: eSIM.activatedAt ? new Date(eSIM.activatedAt).toISOString() : null,
      expireAt: new Date(eSIM.expireAt).toISOString(),
      used: eSIM.used ?? 0,
      ...(order.status === 'paid' && includeEsimSensitive
        ? { activationCode: eSIM.activationCode, iccid: eSIM.iccid, smdp: eSIM.smdp }
        : {}),
    };
  } else {
    base.esim = null;
  }
  return base;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
function defaultReturnUrl(orderNo: string): string {
  return `${config.alipay.notifyHost}/h5/pages/payment/payment?orderNo=${orderNo}`;
}

export default (prisma: PrismaClient) => {
  const router = Router();
  router.use(openAuth(prisma));

  // ==================== 读接口 ====================

  /** GET /me 当前主体信息与密钥信息 */
  router.get('/me', (req: OpenAuthRequest, res: Response) => {
    const s = req.subject!;
    ok(res, {
      subject: {
        id: s.id,
        name: s.name,
        status: s.status,
        callbackUrl: s.callbackUrl,
        defaultMarkupPercent: s.defaultMarkupPercent,
      },
      key: { keyId: req.apiKey!.keyId, mode: req.apiKey!.mode },
    });
  });

  /** GET /packages 套餐列表（返回主体售价）。参数 countryCode/keyword/page/pageSize */
  router.get('/packages', async (req: OpenAuthRequest, res: Response) => {
    try {
      const all = await listAllPackagesView();
      let list = await applySubjectPrices(prisma, all, req.subject!);

      const countryCode = String(req.query.countryCode || '').trim();
      const keyword = String(req.query.keyword || '').trim().toLowerCase();
      if (countryCode) list = list.filter((p) => p.countryCode === countryCode);
      if (keyword) {
        list = list.filter((p) =>
          String(p.name || '').toLowerCase().includes(keyword) ||
          String(p.nameEn || '').toLowerCase().includes(keyword) ||
          String(p.countryName || '').toLowerCase().includes(keyword) ||
          String(p.countryNameEn || '').toLowerCase().includes(keyword),
        );
      }
      list.sort((a, b) => (a.gb - b.gb) || (a.days - b.days));

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const total = list.length;
      const paged = list.slice((page - 1) * pageSize, page * pageSize);
      ok(res, { packages: paged, total, page, pageSize });
    } catch (e: any) {
      console.error('[open] 套餐列表失败：', e.message);
      err(res, 502, 502, '上游 Tiger 异常或套餐获取失败');
    }
  });

  /** GET /packages/:pkgId 套餐详情（含主体售价与可见性） */
  router.get('/packages/:pkgId', async (req: OpenAuthRequest, res: Response) => {
    if (!tigerClient.configured) return err(res, 502, 502, '上游 Tiger 未配置');
    try {
      const pkg = await getPackageView(req.params.pkgId);
      if (!pkg) return err(res, 404, 404, '套餐不存在');
      const r = await resolveSubjectPrice(prisma, pkg, req.subject!);
      if (!r.visible) return err(res, 404, 404, '套餐不存在');
      ok(res, { pkg: { ...pkg, price: r.price } });
    } catch (e: any) {
      err(res, 502, 502, '上游 Tiger 异常：' + e.message);
    }
  });

  /** GET /regions 可用国家/地区列表（仅主体可见套餐覆盖的地区） */
  router.get('/regions', async (req: OpenAuthRequest, res: Response) => {
    try {
      const all = await listAllPackagesView();
      const visible = await applySubjectPrices(prisma, all, req.subject!);
      const codes = Array.from(new Set(visible.map((p) => p.countryCode).filter(Boolean)));
      const countries = await prisma.country.findMany({ where: { code: { in: codes } } });
      const map = new Map(countries.map((c) => [c.code, c]));
      const regions = codes.map((code) => {
        const c = map.get(code);
        return {
          code,
          name: c?.name || code,
          en: c?.en || code,
          flag: c?.flag || '',
          hot: c?.hot ?? 0,
          priority: c?.priority ?? 0,
        };
      });
      regions.sort((a, b) => b.priority - a.priority || b.hot - a.hot);
      ok(res, { regions });
    } catch (e: any) {
      err(res, 502, 502, '获取地区列表失败');
    }
  });

  /** GET /orders 主体订单列表（分页，按 status/extOrderNo 过滤） */
  router.get('/orders', async (req: OpenAuthRequest, res: Response) => {
    const where: any = { subjectId: req.subject!.id };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.extOrderNo) where.extOrderNo = String(req.query.extOrderNo);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    try {
      const [total, rows] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      ok(res, { orders: rows.map((o) => toOpenOrderView(o, false)), total, page, pageSize });
    } catch (e: any) {
      err(res, 500, 500, '订单查询失败');
    }
  });

  /** GET /orders/:orderNo 订单详情（paid 才含激活码） */
  router.get('/orders/:orderNo', async (req: OpenAuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, subjectId: req.subject!.id },
      include: { esim: true },
    });
    if (!order) return err(res, 404, 404, '订单不存在');
    if (order.esim && tigerClient.configured) {
      const resolved = await resolveEsimActivation(order.esim);
      if (resolved) Object.assign(order.esim, resolved);
    }
    ok(res, { order: toOpenOrderView(order, true) });
  });

  /** GET /orders/ext/:extOrderNo 按主体订单号反查 */
  router.get('/orders/ext/:extOrderNo', async (req: OpenAuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { extOrderNo: req.params.extOrderNo, subjectId: req.subject!.id },
      include: { esim: true },
    });
    if (!order) return err(res, 404, 404, '订单不存在');
    if (order.esim && tigerClient.configured) {
      const resolved = await resolveEsimActivation(order.esim);
      if (resolved) Object.assign(order.esim, resolved);
    }
    ok(res, { order: toOpenOrderView(order, true) });
  });

  /** GET /orders/:orderNo/esim eSIM 详情与用量 */
  router.get('/orders/:orderNo/esim', async (req: OpenAuthRequest, res: Response) => {
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, subjectId: req.subject!.id },
      include: { esim: true },
    });
    if (!order) return err(res, 404, 404, '订单不存在');
    if (!order.esim) return err(res, 404, 404, '订单暂无 eSIM');
    let esim = order.esim;
    if (tigerClient.configured) {
      const resolved = await resolveEsimActivation(esim);
      if (resolved) esim = { ...esim, ...resolved };
    }
    ok(res, {
      esim: {
        iccid: esim.iccid,
        status: esim.status,
        activatedAt: esim.activatedAt ? new Date(esim.activatedAt).toISOString() : null,
        expireAt: new Date(esim.expireAt).toISOString(),
        gb: esim.gb ?? 0,
        days: esim.days ?? 0,
        used: esim.used ?? 0,
        isUnlimited: !!esim.isUnlimited,
      },
    });
  });

  /** GET /refunds/:refundNo 退款单查询 */
  router.get('/refunds/:refundNo', async (req: OpenAuthRequest, res: Response) => {
    const refund = await prisma.refund.findFirst({
      where: { refundNo: req.params.refundNo, subjectId: req.subject!.id },
      include: { order: { select: { orderNo: true, extOrderNo: true } } },
    });
    if (!refund) return err(res, 404, 404, '退款单不存在');
    ok(res, {
      refund: {
        refundNo: refund.refundNo,
        extRefundNo: refund.extRefundNo || null,
        orderNo: refund.order.orderNo,
        orderExtOrderNo: refund.order.extOrderNo || null,
        amount: refund.amount,
        status: refund.status,
        reason: refund.reason || null,
        failReason: refund.failReason || null,
        createdAt: new Date(refund.createdAt).toISOString(),
      },
    });
  });

  // ==================== 写接口 ====================

  /** POST /orders 下单：body { pkgId, email, extOrderNo?, returnUrl? } */
  router.post('/orders', async (req: OpenAuthRequest, res: Response) => {
    const { pkgId, email, extOrderNo, returnUrl } = req.body || {};
    if (!pkgId || !email) return err(res, 400, 400, '缺少必要参数 pkgId / email');
    if (!EMAIL_RE.test(String(email))) return err(res, 400, 400, 'email 格式不正确');
    if (returnUrl != null && String(returnUrl) !== '' && !isHttpUrl(String(returnUrl))) {
      return err(res, 400, 400, 'returnUrl 必须是 http(s):// 开头的合法地址');
    }

    try {
      // 幂等：主体内同一 extOrderNo 已存在则直接复用
      if (extOrderNo) {
        const existing = await prisma.order.findFirst({
          where: { subjectId: req.subject!.id, extOrderNo: String(extOrderNo) },
        });
        if (existing) {
          const result = await createWapPaymentUrl(prisma, existing, {
            returnUrl: returnUrl || defaultReturnUrl(existing.orderNo),
          });
          return ok(res, {
            orderNo: existing.orderNo,
            extOrderNo: existing.extOrderNo || null,
            payUrl: result.payUrl,
            price: existing.price,
            totalAmount: result.totalAmount,
            paid: result.paid,
          });
        }
      }

      const order = await createSubjectOrder(prisma, {
        pkgId: String(pkgId),
        email: String(email),
        subject: req.subject!,
        apiKeyId: req.apiKey!.id,
        extOrderNo: extOrderNo ? String(extOrderNo) : undefined,
      });

      const result = await createWapPaymentUrl(prisma, order, {
        returnUrl: returnUrl || defaultReturnUrl(order.orderNo),
      });

      ok(res, {
        orderNo: order.orderNo,
        extOrderNo: order.extOrderNo || null,
        payUrl: result.payUrl,
        price: order.price,
        totalAmount: result.totalAmount,
        paid: result.paid,
      });
    } catch (e: any) {
      if (e instanceof OrderCreateError) return err(res, e.status, e.status, e.message);
      console.error('[open] 下单失败：', e.message);
      err(res, 500, 500, '创建订单失败，请稍后重试');
    }
  });

  /** POST /orders/:orderNo/refunds 主体自助退款：body { extRefundNo?, amount?, reason? } */
  router.post('/orders/:orderNo/refunds', async (req: OpenAuthRequest, res: Response) => {
    const orderNo = req.params.orderNo;
    const subject = req.subject!;
    const { extRefundNo, amount, reason } = req.body || {};
    const deps = {
      findOrderByNo: (no: string) => prisma.order.findUnique({ where: { orderNo: no } }),
      findEsimByOrderId: (orderId: string) => prisma.esim.findUnique({ where: { orderId } }),
      deleteEsimByOrderId: async (orderId: string) => {
        await prisma.esim.delete({ where: { orderId } });
      },
      updateOrder: (no: string, data: Record<string, any>) => prisma.order.update({ where: { orderNo: no }, data }),
      listRefundsByOrder: (orderId: string) =>
        prisma.refund.findMany({ where: { orderId }, select: { status: true, amount: true } }),
      findRefundByExtNo: (sid: string, extNo: string) =>
        prisma.refund.findFirst({ where: { subjectId: sid, extRefundNo: extNo } }),
      createRefund: (data: any) => prisma.refund.create({ data }),
      alipayRefund: async (p: { outTradeNo: string }) => {
        const o = await prisma.order.findUnique({ where: { orderNo: p.outTradeNo } });
        if (!o?.alipayTradeNo) return { code: '10000', tradeNo: `RF${Date.now()}` };
        return alipayProvider.refund(p as any);
      },
      onRefunded: async (d: { order: any; refund: any; full: boolean }) => {
        await enqueueSubjectWebhook(prisma, subject.id, 'order.refunded', {
          event: 'order.refunded',
          orderNo: d.order.orderNo,
          extOrderNo: d.order.extOrderNo || null,
          status: d.full ? 'refunded' : 'paid',
          paidAt: d.order.paidAt ? new Date(d.order.paidAt).toISOString() : null,
          totalAmount: Number(d.order.paidAmount ?? d.order.price ?? 0),
          refundNo: d.refund.refundNo,
          extRefundNo: d.refund.extRefundNo || null,
          amount: d.refund.amount,
          refundedAt: new Date(d.refund.createdAt).toISOString(),
        });
      },
    };

    try {
      const result = await refundOrderSelfService(deps, subject.id, orderNo, {
        extRefundNo: extRefundNo ? String(extRefundNo) : undefined,
        amount: amount != null ? Number(amount) : undefined,
        reason: reason ? String(reason) : undefined,
      });
      ok(res, {
        refundNo: result.refund.refundNo,
        extRefundNo: result.refund.extRefundNo || null,
        orderNo,
        amount: result.refund.amount,
        status: result.refund.status,
        refundedAmount: result.refundedAmount,
        created: result.created,
      });
    } catch (e: any) {
      if (e instanceof SelfServiceRefundError) return err(res, e.status, e.status, e.message);
      console.error('[open] 退款失败：', e.message);
      err(res, 500, 500, '退款处理失败，请稍后重试');
    }
  });

  /** POST /orders/:orderNo/webhook/retry 手动重发支付成功回调（立即发送一次） */
  router.post('/orders/:orderNo/webhook/retry', async (req: OpenAuthRequest, res: Response) => {
    const subject = req.subject!;
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, subjectId: subject.id },
    });
    if (!order) return err(res, 404, 404, '订单不存在');
    if (order.status !== 'paid') return err(res, 400, 400, '订单尚未支付成功，无需回调');
    const result = await resendSubjectWebhook(prisma, subject as any, order, 'order.paid');
    if (!result.sent) return err(res, 400, 400, result.message || '回调发送失败，请检查主体回调地址');
    ok(res, { orderNo: order.orderNo, sent: true });
  });

  return router;
};

// re-export types used by callers
export type { OpenAuthRequest };