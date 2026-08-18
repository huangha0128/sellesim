/**
 * 订单退款服务：校验订单 → 调用支付宝退款 → 更新订单状态 → 释放 eSIM（ICCID 归还卡片池）
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
