/**
 * 订单退款服务：三段式流程
 *  1. applyRefundRequest  用户申请退款（待激活订单）
 *  2. refundOrder         后台同意后执行退款（调用支付宝 → 更新订单 → 释放 eSIM）
 *  3. rejectRefundRequest 后台拒绝退款（填写拒绝理由）
 * 依赖通过参数注入，便于单测与复用。
 */

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
}

/**
 * 用户申请退款：仅待激活（status=paid 且未激活）订单可申请，单订单同时只能存在一条申请。
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
    throw new Error('退款申请已被拒绝，无法再次申请');
  }

  const updated = await deps.updateOrder(order.orderNo, {
    refundStatus: 'requested',
    refundRequestedAt: new Date(),
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

  const res = await deps.alipayRefund({
    outTradeNo: order.alipayTradeNo || order.orderNo,
    refundAmount: Number(order.price).toFixed(2),
    outRequestNo: order.orderNo,
    ...(reason ? { refundReason: reason } : {}),
  });

  if (res.code && res.code !== '10000') {
    throw new Error(`支付宝退款失败：${res.subMsg || res.msg || '未知错误'}`);
  }

  const updated = await deps.updateOrder(order.orderNo, {
    status: 'refunded',
    refundStatus: 'approved',
    refundAmount: order.price,
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
  });
  return { order: updated, rejected: true };
}