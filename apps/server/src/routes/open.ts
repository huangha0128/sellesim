import { Router, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { openAuth, OpenAuthRequest } from '../middleware/openAuth';
import { listAllPackagesView, getPackageView } from '../tiger/view';
import { resolveSubjectPrice, applySubjectPrices } from '../services/subjectPricing';
import { resolveSettlePricesForList, resolveSettlePrice, quotaView, restoreWallet, applyDeposit } from '../services/quota';
import { createSubjectCreditOrder, OrderCreateError } from '../services/order';
import { refundSubjectCreditOrder, SelfServiceRefundError } from '../services/refund';
import { enqueueSubjectWebhook, resendSubjectWebhook } from '../services/webhook';
import { resolveEsimActivation } from '../tiger/activation';
import { tigerClient, unbindTigerPackages } from '../tiger';

/**
 * Open platform v3 API (统一前缀 /api/open/v1). B2B credit distribution.
 * Paying is NOT exposed: orders are delivered on partner credit (quota), and
 * refunds restore quota. See docs/open-platform-v3-design.md.
 *
 * Authentication is dual-mode:
 *   - API integrators: read = X-Api-Key only; write adds X-Timestamp/X-Nonce/X-Sign.
 *   - Partner portal: a Bearer portal JWT (type=partner) authenticates reads and writes.
 *
 * Response envelope: { code: 0, message: 'ok', data, requestId }.
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

/** Sensitive when the order was already delivered (delivered = eSIM sent out). */
function isEsimDelivered(order: any): boolean {
  return order.status === 'delivered' || order.status === 'refunded';
}

/** order -> open view */
function toOpenOrderView(order: any, includeEsimSensitive = true): any {
  const base: any = {
    orderNo: order.orderNo,
    extOrderNo: order.extOrderNo || null,
    status: order.status,
    payMethod: order.payMethod || 'quota',
    pkgId: order.pkgId,
    countryCode: order.countryCode || null,
    pkgName: order.pkgName || null,
    pkgNameEn: order.pkgNameEn || null,
    gb: order.gb ?? null,
    days: order.days ?? null,
    isUnlimited: !!order.isUnlimited,
    cost: Number(order.price ?? 0), // settle price (amount debited from quota)
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
      ...(isEsimDelivered(order) && includeEsimSensitive
        ? { activationCode: eSIM.activationCode, iccid: eSIM.iccid, smdp: eSIM.smdp }
        : {}),
    };
  } else {
    base.esim = null;
  }
  return base;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default (prisma: PrismaClient) => {
  const router = Router();
  router.use(openAuth(prisma));

  // ==================== 读接口 ====================

  /** GET /me 当前主体信息与额度信息 */
  router.get('/me', async (req: OpenAuthRequest, res: Response) => {
    const s = await prisma.subject.findUnique({
      where: { id: req.subject!.id },
      include: { keys: { where: { enabled: true }, select: { keyId: true, mode: true } } },
    });
    if (!s) return err(res, 404, 404, '主体不存在');
    const q = quotaView(s);
    ok(res, {
      subject: {
        id: s.id,
        name: s.name,
        status: s.status,
        callbackUrl: s.callbackUrl,
        defaultMarkupPercent: s.defaultMarkupPercent,
        splitPercent: s.splitPercent ?? null,
      },
      quota: { quotaLimit: q.quotaLimit, usedQuota: q.usedQuota, availableQuota: q.availableQuota, balance: q.balance },
      keys: s.keys.map((k) => ({ keyId: k.keyId, mode: k.mode })),
    });
  });

  /** PUT /me 主体自改 Webhook 回调地址（无需后台，自助配置） */
  router.put('/me', async (req: OpenAuthRequest, res: Response) => {
    const { callbackUrl } = (req.body || {}) as { callbackUrl?: string | null };
    let next: string | null = null;
    if (callbackUrl !== undefined && callbackUrl !== null) {
      const trimmed = String(callbackUrl).trim();
      // 空串表示清除回调地址
      if (trimmed === '') {
        next = null;
      } else {
        if (!/^https?:\/\//.test(trimmed)) {
          return err(res, 400, 400, 'callbackUrl 必须以 http:// 或 https:// 开头');
        }
        next = trimmed;
      }
    }
    const subject = await prisma.subject.update({
      where: { id: req.subject!.id },
      data: { callbackUrl: next },
      select: { callbackUrl: true },
    });
    ok(res, { callbackUrl: subject.callbackUrl });
  });

  /** GET /quota 额度总览 + 记账流水 */
  router.get('/quota', async (req: OpenAuthRequest, res: Response) => {
    const s = await prisma.subject.findUnique({ where: { id: req.subject!.id } });
    if (!s) return err(res, 404, 404, '主体不存在');
    const q = quotaView(s);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const [total, ledger] = await Promise.all([
      prisma.subjectLedger.count({ where: { subjectId: s.id } }),
      prisma.subjectLedger.findMany({
        where: { subjectId: s.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    ok(res, {
      quota: q,
      ledger: ledger.map((l) => ({
        id: l.id,
        type: l.type,
        amount: l.amount,
        orderNo: l.orderNo || null,
        refundNo: l.refundNo || null,
        rechargeNo: l.rechargeNo || null,
        note: l.note || null,
        createdAt: new Date(l.createdAt).toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  });

  /** GET /wallet 钱包总览（余额/欠款/授信阈值） */
  router.get('/wallet', async (req: OpenAuthRequest, res: Response) => {
    const s = await prisma.subject.findUnique({ where: { id: req.subject!.id } });
    if (!s) return err(res, 404, 404, '主体不存在');
    const q = quotaView(s);
    ok(res, {
      wallet: {
        balance: q.balance,
        usedQuota: q.usedQuota,
        quotaLimit: q.quotaLimit,
        maxDebt: q.quotaLimit,
        availableDebt: q.availableQuota,
      },
    });
  });

  /**
   * GET /cards/:iccid 查询卡号详细信息：该 ICCID 是否绑定套餐、绑定了哪些套餐、
   * 每个套餐的状态（激活/生效/到期等）。用于伙伴核对卡片归属与套餐占用情况。
   */
  router.get('/cards/:iccid', async (req: OpenAuthRequest, res: Response) => {
    const iccid = String((req.params && req.params.iccid) || '').trim();
    if (!iccid) return err(res, 400, 400, 'iccid 不能为空');
    try {
      const [cardRes, pkgRes] = await Promise.all([
        tigerClient.listCards({ iccid, limit: 5 }),
        tigerClient.listCardPackages(iccid),
      ]);
      const cdata = cardRes?.data || cardRes || {};
      const items: any[] = Array.isArray(cdata.items) ? cdata.items : [];
      const card = items.find((it) => String(it.iccid || it.iccid_number) === iccid) || {};
      const pdata = pkgRes?.data || pkgRes || {};
      const pkgs: any[] = Array.isArray(pdata.items)
        ? pdata.items
        : Array.isArray(pdata.list)
          ? pdata.list
          : Array.isArray(pdata)
            ? pdata
            : [];
      ok(res, {
        iccid,
        card: {
          status: card.status || card.card_status || null,
          category: card.category || null,
          createdAt: card.created_at || card.createdAt || null,
        },
        packages: pkgs.map((p: any) => ({
          id: p.id ?? p.packageId ?? p.package_id ?? null,
          name: p.name ?? p.packageName ?? p.package_name ?? null,
          status: p.status ?? null,
          activatedAt: p.activated_at ?? p.start_time ?? p.startTime ?? null,
          expireAt: p.expired_at ?? p.end_time ?? p.endTime ?? null,
          days: p.valid_days ?? p.days ?? null,
        })),
      });
    } catch (e: any) {
      console.error('[open] 查询卡片详情失败：', e?.message);
      err(res, 502, 502, '查询卡片详情失败：' + (e?.message || '上游接口异常'));
    }
  });

  /** GET /packages 套餐列表（含结算价 costPrice 与售价 price）。参数 countryCode/keyword/page/pageSize */
  router.get('/packages', async (req: OpenAuthRequest, res: Response) => {
    try {
      const all = await listAllPackagesView();
      let list = await applySubjectPrices(prisma, all, req.subject!);
      const settle = await resolveSettlePricesForList(prisma, list, req.subject!);
      list = list.map((p) => {
        const key = String(p.tigerPkgId ?? p.tigerPid ?? p.id ?? p.pkgId ?? '');
        return { ...p, costPrice: settle.get(key) ?? Number(p.price ?? 0) };
      });

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
      ok(res, { packages: list.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize });
    } catch (e: any) {
      console.error('[open] 套餐列表失败：', e.message);
      err(res, 502, 502, '上游 Tiger 异常或套餐获取失败');
    }
  });

  /** GET /packages/:pkgId 套餐详情（含结算价与售价） */
  router.get('/packages/:pkgId', async (req: OpenAuthRequest, res: Response) => {
    if (!tigerClient.configured) return err(res, 502, 502, '上游 Tiger 未配置');
    try {
      const pkg = await getPackageView(req.params.pkgId);
      if (!pkg) return err(res, 404, 404, '套餐不存在');
      const r = await resolveSubjectPrice(prisma, pkg, req.subject!);
      if (!r.visible) return err(res, 404, 404, '套餐不存在');
      const costPrice = await resolveSettlePrice(prisma, pkg, req.subject!);
      ok(res, { pkg: { ...pkg, price: r.price, costPrice } });
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
        prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      ok(res, { orders: rows.map((o) => toOpenOrderView(o, false)), total, page, pageSize });
    } catch (e: any) {
      err(res, 500, 500, '订单查询失败');
    }
  });

  async function loadOrderByNo(req: OpenAuthRequest, orderNo: string): Promise<any | null> {
    return prisma.order.findFirst({ where: { orderNo, subjectId: req.subject!.id }, include: { esim: true } });
  }

  /** GET /orders/:orderNo 订单详情（delivered/refunded 才含激活码） */
  router.get('/orders/:orderNo', async (req: OpenAuthRequest, res: Response) => {
    const order = await loadOrderByNo(req, req.params.orderNo);
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
    const order = await loadOrderByNo(req, req.params.orderNo);
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
        questionCodes: esim.activationCode ? { activationCode: esim.activationCode, smdp: esim.smdp, iccid: esim.iccid } : null,
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

  /** POST /orders 下单（扣额 + 开卡，无支付）：body { pkgId, email, extOrderNo? } */
  router.post('/orders', async (req: OpenAuthRequest, res: Response) => {
    const { pkgId, email, extOrderNo } = req.body || {};
    if (!pkgId || !email) return err(res, 400, 400, '缺少必要参数 pkgId / email');
    if (!EMAIL_RE.test(String(email))) return err(res, 400, 400, 'email 格式不正确');

    try {
      // 幂等：主体内同一 extOrderNo 已存在则直接复用
      if (extOrderNo) {
        const existing = await prisma.order.findFirst({
          where: { subjectId: req.subject!.id, extOrderNo: String(extOrderNo) },
          include: { esim: true },
        });
        if (existing && existing.status !== 'failed') {
          return ok(res, { ...toOpenOrderView(existing, true), created: false });
        }
      }

      const { order, esim, cost } = await createSubjectCreditOrder(prisma, {
        pkgId: String(pkgId),
        email: String(email),
        subject: req.subject!,
        apiKeyId: req.apiKey!.id,
        extOrderNo: extOrderNo ? String(extOrderNo) : undefined,
      });
      ok(res, {
        orderNo: order.orderNo,
        extOrderNo: order.extOrderNo || null,
        status: order.status,
        cost,
        created: true,
        esim: esim
          ? {
              iccid: esim.iccid,
              activationCode: esim.activationCode,
              smdp: esim.smdp,
              expireAt: new Date(esim.expireAt).toISOString(),
            }
          : null,
      });
    } catch (e: any) {
      if (e instanceof OrderCreateError) return err(res, e.status, e.status, e.message);
      console.error('[open] 下单失败：', e.message);
      err(res, 500, 500, '创建订单失败，请稍后重试');
    }
  });

  /** POST /orders/:orderNo/refunds 额度冲回退款：body { extRefundNo?, amount?, reason? } */
  router.post('/orders/:orderNo/refunds', async (req: OpenAuthRequest, res: Response) => {
    const orderNo = req.params.orderNo;
    const subject = req.subject!;
    const { extRefundNo, amount, reason } = req.body || {};
    const deps = {
      findOrderByNo: (no: string) => prisma.order.findUnique({ where: { orderNo: no } }),
      findEsimByOrderId: (orderId: string) => prisma.esim.findUnique({ where: { orderId } }),
      deleteEsimByOrderId: async (orderId: string) => {
        const esim = await prisma.esim.findUnique({ where: { orderId } });
        if (!esim) return;
        // 退款先解绑 Tiger 该 ICCID 上的套餐，再删本地记录（ICCID 回卡池）
        await unbindTigerPackages(esim);
        await prisma.esim.delete({ where: { orderId } });
      },
      updateOrder: (no: string, data: Record<string, any>) => prisma.order.update({ where: { orderNo: no }, data }),
      findRefundByExtNo: (sid: string, extNo: string) =>
        prisma.refund.findFirst({ where: { subjectId: sid, extRefundNo: extNo } }),
      createRefund: (data: any) => prisma.refund.create({ data }),
      creditBack: async (sid: string, amt: number, ono: string, rno: string) => {
        const s = await prisma.subject.findUnique({ where: { id: sid } });
        await restoreWallet(prisma, s ?? { id: sid }, amt, ono, rno, '钱包冲回退款');
      },
      onRefunded: async (d: { order: any; refund: any }) => {
        await enqueueSubjectWebhook(prisma, subject.id, 'order.refunded', {
          event: 'order.refunded',
          orderNo: d.order.orderNo,
          extOrderNo: d.order.extOrderNo || null,
          status: 'refunded',
          paidAt: d.order.paidAt ? new Date(d.order.paidAt).toISOString() : null,
          totalAmount: Number(d.order.price ?? 0),
          refundNo: d.refund.refundNo,
          extRefundNo: d.refund.extRefundNo || null,
          amount: d.refund.amount,
          refundedAt: new Date(d.refund.createdAt).toISOString(),
        });
      },
    };

    try {
      const result = await refundSubjectCreditOrder(deps, subject.id, orderNo, {
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

  /** POST /orders/:orderNo/webhook/retry 手动重发交付回调（立即发送一次） */
  router.post('/orders/:orderNo/webhook/retry', async (req: OpenAuthRequest, res: Response) => {
    const subject = req.subject!;
    const order = await prisma.order.findFirst({
      where: { orderNo: req.params.orderNo, subjectId: subject.id },
    });
    if (!order) return err(res, 404, 404, '订单不存在');
    const event: 'order.delivered' | 'order.refunded' = order.status === 'refunded' ? 'order.refunded' : 'order.delivered';
    if (order.status !== 'delivered' && order.status !== 'refunded') return err(res, 400, 400, '订单尚未交付，无需回调');
    const result = await resendSubjectWebhook(prisma, subject as any, order, event);
    if (!result.sent) return err(res, 400, 400, result.message || '回调发送失败，请检查主体回调地址');
    ok(res, { orderNo: order.orderNo, event, sent: true });
  });

  return router;
};

// re-export types used by callers
export type { OpenAuthRequest };