import { describe, it, expect, vi } from 'vitest';
import { refundOrder, RefundDeps } from './refund';

function makeOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    orderNo: 'DPH1234567890',
    pkgId: 'pkg-1',
    email: 'test@example.com',
    status: 'paid',
    price: 29.9,
    alipayTradeNo: '2026081722001111',
    refundStatus: null,
    refundedAt: null,
    refundAmount: null,
    refundTradeNo: null,
    refundReason: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<RefundDeps> = {}): RefundDeps {
  const calls: any = { refund: [], update: [], deleteEsim: [] };
  const deps: RefundDeps = {
    findOrder: vi.fn().mockResolvedValue(makeOrder()),
    updateOrder: vi.fn(async (orderNo, data) => ({ ...makeOrder(), ...data })),
    findEsimByOrderId: vi.fn().mockResolvedValue({ id: 'esim-1', orderId: 'order-1' }),
    deleteEsimByOrderId: vi.fn(async () => {}),
    alipayRefund: vi.fn(async (params) => ({ code: '10000', tradeNo: '20260817220011119999' })),
  };
  // 记录调用参数，便于断言
  deps.alipayRefund = vi.fn(async (params: any) => {
    calls.refund.push(params);
    return { code: '10000', tradeNo: '20260817220011119999' };
  });
  deps.updateOrder = vi.fn(async (orderNo: string, data: any) => {
    calls.update.push({ orderNo, data });
    return { ...makeOrder(), ...data };
  });
  deps.deleteEsimByOrderId = vi.fn(async (orderId: string) => {
    calls.deleteEsim.push(orderId);
  });
  return { ...deps, ...overrides };
}

describe('refundOrder 退款服务', () => {
  it('订单不存在时抛出「订单不存在」', async () => {
    const deps = makeDeps({ findOrder: vi.fn().mockResolvedValue(null) });
    await expect(refundOrder(deps, 'DPH-UNKNOWN')).rejects.toThrow('订单不存在');
  });

  it('未支付订单不可退款', async () => {
    const deps = makeDeps({
      findOrder: vi.fn().mockResolvedValue(makeOrder({ status: 'pending' })),
    });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('仅已支付订单可退款');
  });

  it('已退款订单不可重复退款', async () => {
    const deps = makeDeps({
      findOrder: vi.fn().mockResolvedValue(
        makeOrder({ status: 'refunded', refundedAt: new Date(), refundStatus: 'refunded' }),
      ),
    });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('订单已退款');
  });

  it('支付宝退款失败时抛出错误，且不修改订单、不删除 eSIM', async () => {
    const deps = makeDeps({
      alipayRefund: vi.fn(async () => ({ code: '40004', subMsg: '余额不足', msg: 'Business Failed' })),
    });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('退款失败');
    expect(deps.updateOrder).not.toHaveBeenCalled();
    expect(deps.deleteEsimByOrderId).not.toHaveBeenCalled();
  });

  it('退款成功时按订单原价发起支付宝退款并更新订单状态、删除 eSIM', async () => {
    const deps = makeDeps();
    const result = await refundOrder(deps, 'DPH1234567890', '用户申请退款');

    const refundArgs = (deps.alipayRefund as any).mock.calls[0][0];
    expect(refundArgs).toMatchObject({
      outTradeNo: '2026081722001111',
      refundAmount: '29.90',
      outRequestNo: 'DPH1234567890',
      refundReason: '用户申请退款',
    });

    const updateArgs = (deps.updateOrder as any).mock.calls[0][0];
    expect(updateArgs).toBe('DPH1234567890');
    const updateData = (deps.updateOrder as any).mock.calls[0][1];
    expect(updateData).toMatchObject({
      status: 'refunded',
      refundAmount: 29.9,
      refundTradeNo: '20260817220011119999',
      refundReason: '用户申请退款',
    });
    expect(updateData.refundedAt).toBeInstanceOf(Date);

    expect(deps.deleteEsimByOrderId).toHaveBeenCalledWith('order-1');
    expect(result).toMatchObject({ refunded: true });
  });

  it('无 eSIM 记录时退款流程仍正常完成', async () => {
    const deps = makeDeps({ findEsimByOrderId: vi.fn().mockResolvedValue(null) });
    const result = await refundOrder(deps, 'DPH1234567890');
    expect(result.refunded).toBe(true);
    expect(deps.deleteEsimByOrderId).not.toHaveBeenCalled();
  });
});
