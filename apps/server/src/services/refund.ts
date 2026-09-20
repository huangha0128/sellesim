/**
 * 订单退款服务：三段式流程
 *  1. applyRefundRequest  用户申请退款（待激活订单）
 *  2. refundOrder         后台同意后执行退款（调用支付宝 → 更新订单 → 释放 eSIM）
 *  3. rejectRefundRequest 后台拒绝退款（填写拒绝理由）
 * 依赖通过参数注入，便于单测与复用。
 * 被拒绝后可重复申请，但受后台配置的拒绝次数上限（Setting.maxRefundRejectCount）约束。
 */

import { prisma } from '../db';

export interface AlipayRefundResult {
  code?: string;
  msg?: string;
  subMsg?: string;
  tradeNo?: string;
}

export interface RefundDeps {
  findOrder(orderNo: string): Promise<any | null>;
  findUserOrder(userId: string, orderNo: string): Promise<any | null>;
  updateOrder(orderNo: string, data: Record<string, any>): Promise<any>;
  findEsimByOrderId(orderId: string): Promise<any | null>;
  deleteEsimByOrderId(orderId: string): Promise<void>;
  alipayRefund(params: {
    outTradeNo: string;
    refundAmount: string;
    outRequestNo: string;
    refundReason?: string;
  }): Promise<AlipayRefundResult>;
  /** 退款申请被拒绝次数上限（后台可配置），缺省读取 Setting.maxRefundRejectCount */
  getMaxRejectCount?(): Promise<number>;
}

export const DEFAULT_MAX_REFUND_REJECT_COUNT = 3;

// In-process cache of the reject-limit setting (short TTL, invalidated on admin write).
let maxRejectCache: { value: number; at: number } | null = null;
const MAX_REJECT_TTL_MS = 60_000;

/** 读取后台配置的退款申请被拒绝次数上限（Setting 表，带缓存），非法值回落默认 3。 */
export async function readMaxRefundRejectCount(): Promise<number> {
  if (maxRejectCache && Date.now() - maxRejectCache.at < MAX_REJECT_TTL_MS) {
    return maxRejectCache.value;
  }
  const row = await prisma.setting.findUnique({ where: { key: 'maxRefundRejectCount' } });
  const raw = row ? Number(row.value) : NaN;
  const value =
    Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_MAX_REFUND_REJECT_COUNT;
  maxRejectCache = { value, at: Date.now() };
  return value;
}

/** 配置变更后调用，失效拒绝次数上限缓存。 */
export function clearMaxRefundRejectCache(): void {
  maxRejectCache = null;
}

/**
 * 用户申请退款：仅待激活（status=paid 且未激活）订单可申请。
 * 被拒绝后可再次申请，但同一订单累计拒绝次数 >= 后台配置上限时禁止再次发起。
 */
export async function applyRefundRequest(
  deps: RefundDeps,
  userId: string,
  orderNo: string,
  reason?: string,
) {
  const order = await deps.findUserOrder(userId, orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }
  if (order.status === 'refunded' || order.refundedAt) {
    throw new Error('订单已退款，无需重复申请');
  }
  if (order.status !== 'paid') {
    throw new Error('仅待激活订单可申请退款');
  }
  if (order.refundStatus === 'requested') {
    throw new Error('退款申请已提交，请耐心等待处理');
  }
  if (order.refundStatus === 'approved') {
    throw new Error('退款正在处理中');
  }
  if (order.refundStatus === 'rejected') {
    const maxCount = deps.getMaxRejectCount
      ? await deps.getMaxRejectCount()
      : await readMaxRefundRejectCount();
    if ((order.refundRejectCount ?? 0) >= maxCount) {
      throw new Error(`退款申请被拒绝次数已达上限（${maxCount} 次），无法再次申请`);
    }
  }

  const updated = await deps.updateOrder(order.orderNo, {
    refundStatus: 'requested',
    refundRequestedAt: new Date(),
    // 重新申请时清空上一轮拒绝信息，避免混淆
    ...(order.refundStatus === 'rejected'
      ? { refundRejectReason: null, refundRejectedAt: null }
      : {}),
    ...(reason ? { refundReason: reason } : {}),
  });
  return { order: updated, requested: true };
}

/**
 * 后台同意退款并执行：校验 → 调用支付宝退款 → 更新订单状态 → 释放 eSIM（ICCID 归还卡片池）。
 * out_request_no 传订单号保证支付宝侧幂等，重复调用同一订单可安全返回。
 */
export async function refundOrder(deps: RefundDeps, orderNo: string, reason?: string) {
  const order = await deps.findOrder(orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }
  if (order.status === 'refunded' || order.refundedAt) {
    throw new Error('订单已退款，请勿重复操作');
  }
  if (order.status !== 'paid') {
    throw new Error('仅已支付订单可退款');
  }
  if (order.refundStatus === 'approved') {
    throw new Error('该退款申请已处理，请勿重复操作');
  }
  if (order.refundStatus === 'rejected') {
    throw new Error('该退款申请已被拒绝，无法退款');
  }
  if (order.refundStatus !== 'requested') {
    throw new Error('该订单暂无退款申请，请先由用户发起申请');
  }

  // 必须按实际支付金额退款（支付宝要求退款金额不能超过已付金额），优先级：paidAmount > price
  const actualPaid = order.paidAmount ?? order.price;
  console.log(
    `[refund] 订单 ${orderNo} 实际支付金额=${order.paidAmount} 退款请求金额=${Number(actualPaid).toFixed(2)}`,
  );

  const res = await deps.alipayRefund({
    // 创建交易时写入的商户单号 out_trade_no 就是 order.orderNo，退款必须用这个作为 out_trade_no，
    // 不能传支付宝互单号（trade_no）
    outTradeNo: order.orderNo,
    refundAmount: Number(actualPaid).toFixed(2),
    outRequestNo: order.orderNo,
    ...(reason ? { refundReason: reason } : {}),
  });

  if (res.code !== '10000') {
    throw new Error(`支付宝退款失败：${res.subMsg || res.msg || '未知错误'}`);
  }

  const updated = await deps.updateOrder(order.orderNo, {
    status: 'refunded',
    refundStatus: 'approved',
    refundAmount: actualPaid,
    refundTradeNo: res.tradeNo || '',
    refundedAt: new Date(),
    ...(reason ? { refundReason: reason } : {}),
  });

  // 释放 eSIM 记录（ICCID 归还卡片池，可再次使用）
  const esim = await deps.findEsimByOrderId(order.id);
  if (esim) {
    await deps.deleteEsimByOrderId(order.id);
  }

  return { order: updated, refunded: true };
}

/**
 * 后台拒绝退款：需填写拒绝理由，前端展示拒绝状态与理由。
 * 每次拒绝累计 refundRejectCount，用户端据此判断是否还能再次申请。
 */
export async function rejectRefundRequest(deps: RefundDeps, orderNo: string, rejectReason?: string) {
  const order = await deps.findOrder(orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }
  if (order.refundStatus !== 'requested') {
    throw new Error('当前没有待处理的退款申请');
  }
  if (!rejectReason || !String(rejectReason).trim()) {
    throw new Error('请填写拒绝理由');
  }

  const updated = await deps.updateOrder(order.orderNo, {
    refundStatus: 'rejected',
    refundRejectReason: String(rejectReason).trim(),
    refundRejectedAt: new Date(),
    refundRejectCount: (order.refundRejectCount ?? 0) + 1,
  });
  return { order: updated, rejected: true };
}

// =========================================================================
// Open platform v2: subject self-service refund (no admin approval).
// Reuses RefundDeps but links a Refund record. Only un-activated paid orders
// are refundable; supports full/partial and repeats via a per-subject
// unique extRefundNo idempotency key. See docs/open-api-design.md §7.
// =========================================================================

export interface SelfServiceRefundDeps {
  findOrderByNo(orderNo: string): Promise<any | null>;
  findEsimByOrderId(orderId: string): Promise<any | null>;
  deleteEsimByOrderId(orderId: string): Promise<void>;
  updateOrder(orderNo: string, data: Record<string, any>): Promise<any>;
  listRefundsByOrder(orderId: string): Promise<{ status: string; amount: number }[]>;
  findRefundByExtNo(subjectId: string, extRefundNo: string): Promise<any | null>;
  createRefund(data: {
    refundNo: string;
    extRefundNo?: string | null;
    orderId: string;
    subjectId: string;
    amount: number;
    status: 'processing' | 'success' | 'failed';
    reason?: string | null;
    channelTradeNo?: string | null;
    failReason?: string | null;
  }): Promise<any>;
  alipayRefund(params: {
    outTradeNo: string;
    refundAmount: string;
    outRequestNo: string;
    refundReason?: string;
  }): Promise<AlipayRefundResult>;
  /** called after a successful refund so the caller can fire order.refunded */
  onRefunded?(data: { order: any; refund: any; full: boolean }): Promise<void>;
}

export class SelfServiceRefundError extends Error {
  /** HTTP status: 400 param, 404 not found, 409 state conflict, 502 upstream */
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SelfServiceRefundError';
    this.status = status;
  }
}

export interface SelfServiceRefundResult {
  refund: any;
  refundedAmount: number;
  full: boolean;
  created: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Execute a self-service refund for a subject.
 * 1. idempotency: same (subject, extRefundNo) returns the existing refund
 * 2. conditions: order paid + esim not activated + remaining amount > 0
 * 3. default full refund; provided amount must be <= remaining
 * 4. call alipay原路退款 (against paidAmount, never over-remit)
 * 5. success -> write Refund(success), update order, release esim, fire event
 * 6. failure -> write Refund(failed) with reason, throw explicit error
 */
export async function refundOrderSelfService(
  deps: SelfServiceRefundDeps,
  subjectId: string,
  orderNo: string,
  params: { extRefundNo?: string; amount?: number; reason?: string },
): Promise<SelfServiceRefundResult> {
  const { extRefundNo, amount, reason } = params;

  // 1. idempotency
  const existing = await (extRefundNo
    ? deps.findRefundByExtNo(subjectId, String(extRefundNo))
    : Promise.resolve(null));
  if (existing) {
    return { refund: existing, refundedAmount: existing.amount, full: false, created: false };
  }

  // 2. ownership + refundability
  const order = await deps.findOrderByNo(orderNo);
  if (!order || order.subjectId !== subjectId) {
    throw new SelfServiceRefundError('订单不存在', 404);
  }
  if (order.status !== 'paid') {
    throw new SelfServiceRefundError('仅已支付订单可退款', 409);
  }
  const esim = await deps.findEsimByOrderId(order.id);
  if (esim && esim.status !== 'pending') {
    throw new SelfServiceRefundError('eSIM 已激活，无法退款', 409);
  }

  // remaining amount against actual payment
  const paid = Number(order.paidAmount ?? order.price ?? 0);
  const refunds = await deps.listRefundsByOrder(order.id);
  const refunded = refunds.reduce((s, r) => s + (r.status === 'success' ? Number(r.amount) : 0), 0);
  const remaining = round2(paid - refunded);
  if (remaining <= 0) {
    throw new SelfServiceRefundError('订单已全额退款', 409);
  }

  const isFull = amount == null;
  const refundAmount = round2(isFull ? remaining : Number(amount));
  if (!(refundAmount > 0) || refundAmount > remaining + 0.01) {
    throw new SelfServiceRefundError('退款金额超出可退金额', 400);
  }

  const outRequestNo = `RF${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
  let res: AlipayRefundResult;
  try {
    res = await deps.alipayRefund({
      outTradeNo: order.orderNo,
      refundAmount: refundAmount.toFixed(2),
      outRequestNo,
      ...(reason ? { refundReason: String(reason) } : {}),
    });
  } catch (e: any) {
    await deps.createRefund({
      refundNo: outRequestNo,
      extRefundNo: extRefundNo ? String(extRefundNo) : null,
      orderId: order.id,
      subjectId,
      amount: refundAmount,
      status: 'failed',
      reason: reason || null,
      failReason: e.message || '退款调用异常',
    });
    throw new SelfServiceRefundError('退款调用异常，请稍后重试', 502);
  }

  if (res.code !== '10000') {
    await deps.createRefund({
      refundNo: outRequestNo,
      extRefundNo: extRefundNo ? String(extRefundNo) : null,
      orderId: order.id,
      subjectId,
      amount: refundAmount,
      status: 'failed',
      reason: reason || null,
      failReason: res.subMsg || res.msg || '未知错误',
      channelTradeNo: res.tradeNo || null,
    });
    throw new SelfServiceRefundError(`支付宝退款失败：${res.subMsg || res.msg || '未知错误'}`, 502);
  }

  // success
  const refund = await deps.createRefund({
    refundNo: outRequestNo,
    extRefundNo: extRefundNo ? String(extRefundNo) : null,
    orderId: order.id,
    subjectId,
    amount: refundAmount,
    status: 'success',
    reason: reason || null,
    channelTradeNo: res.tradeNo || null,
  });

  const full = isFull || refundAmount >= remaining - 0.01;
  const newRefunded = round2(refunded + refundAmount);

  if (full) {
    await deps.updateOrder(order.orderNo, {
      status: 'refunded',
      refundStatus: 'approved',
      refundAmount: newRefunded,
      refundTradeNo: res.tradeNo || '',
      refundedAt: new Date(),
    });
    // release eSIM (ICCID returns to pool)
    if (esim) await deps.deleteEsimByOrderId(order.id);
  } else {
    await deps.updateOrder(order.orderNo, {
      refundAmount: newRefunded,
    });
  }

  if (deps.onRefunded) {
    await deps.onRefunded({ order, refund, full }).catch(() => {
      /* fire event must not break the refund response */
    });
  }

  return { refund, refundedAmount: newRefunded, full, created: true };
}

// =========================================================================
// Open platform v3: credit-quota refund (B2B, no payment involved).
// Refunding a delivered-on-credit order restores the partner quota instead of
// calling Alipay. See docs/open-platform-v3-design.md §3/§4.
// =========================================================================

export interface CreditRefundDeps {
  findOrderByNo(orderNo: string): Promise<any | null>;
  findEsimByOrderId(orderId: string): Promise<any | null>;
  deleteEsimByOrderId(orderId: string): Promise<void>;
  updateOrder(orderNo: string, data: Record<string, any>): Promise<any>;
  findRefundByExtNo(subjectId: string, extRefundNo: string): Promise<any | null>;
  createRefund(data: {
    refundNo: string;
    extRefundNo?: string | null;
    orderId: string;
    subjectId: string;
    amount: number;
    status: 'processing' | 'success' | 'failed';
    reason?: string | null;
    channelTradeNo?: string | null;
    failReason?: string | null;
  }): Promise<any>;
  /** restore quota + write refund_credit ledger (must reject/throw if it fails) */
  creditBack(subjectId: string, amount: number, orderNo: string, refundNo: string): Promise<void>;
  onRefunded?(data: { order: any; refund: any }): Promise<void>;
}

/**
 * Refund a quota-delivered order: restores the partner credit (usedQuota -= W)
 * and marks the order refunded, releasing the eSIM/ICCID. Only delivered orders
 * that were paid by quota (payMethod='quota') and whose eSIM is not yet activated
 * can be refunded. Idempotent per (subject, extRefundNo).
 */
export async function refundSubjectCreditOrder(
  deps: CreditRefundDeps,
  subjectId: string,
  orderNo: string,
  params: { extRefundNo?: string; amount?: number; reason?: string },
): Promise<{ refund: any; refundedAmount: number; created: boolean }> {
  const { extRefundNo, amount, reason } = params;

  const existing = await (extRefundNo
    ? deps.findRefundByExtNo(subjectId, String(extRefundNo))
    : Promise.resolve(null));
  if (existing) {
    return { refund: existing, refundedAmount: existing.amount, created: false };
  }

  const order = await deps.findOrderByNo(orderNo);
  if (!order || order.subjectId !== subjectId) throw new SelfServiceRefundError('订单不存在', 404);
  if (order.status !== 'delivered') throw new SelfServiceRefundError('仅已交付（未退款）订单可退款', 409);
  if (order.payMethod !== 'quota') throw new SelfServiceRefundError('仅授信下单的订单支持额度冲回退款', 409);
  const esim = await deps.findEsimByOrderId(order.id);
  if (esim && esim.status !== 'pending') throw new SelfServiceRefundError('eSIM 已激活，无法退款', 409);

  const settles = Number(order.price ?? 0);
  if (settles <= 0) throw new SelfServiceRefundError('订单无扣款金额，无法退款', 400);

  const isFull = amount == null;
  const refundAmount = round2(isFull ? settles : Number(amount));
  if (!(refundAmount > 0) || refundAmount > settles + 0.01) {
    throw new SelfServiceRefundError('退款金额超出可退金额', 400);
  }

  const refundNo = `RF${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
  const refund = await deps.createRefund({
    refundNo,
    extRefundNo: extRefundNo ? String(extRefundNo) : null,
    orderId: order.id,
    subjectId,
    amount: refundAmount,
    status: 'success',
    reason: reason || null,
  });

  // restore quota (throws on failure -> caller surfaces 409/500 and the Refund row above is left as best-effort)
  await deps.creditBack(subjectId, refundAmount, orderNo, refundNo);

  const full = isFull || refundAmount >= settles - 0.01;
  await deps.updateOrder(order.orderNo, {
    ...(full
      ? {
          status: 'refunded',
          refundStatus: 'approved',
          refundAmount,
          refundedAt: new Date(),
        }
      : { refundAmount }),
  });

  if (full && esim) await deps.deleteEsimByOrderId(order.id);

  if (deps.onRefunded) {
    await deps.onRefunded({ order, refund }).catch(() => {
      /* fire event must not break the refund response */
    });
  }

  return { refund, refundedAmount: refundAmount, created: true };
}