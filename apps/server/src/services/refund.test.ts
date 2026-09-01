import { describe, it, expect, vi } from 'vitest';
import {
  applyRefundRequest,
  refundOrder,
  rejectRefundRequest,
  RefundDeps,
} from './refund';

function makeOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    orderNo: 'DPH1234567890',
    pkgId: 'pkg-1',
    userId: 'user-1',
    email: 'test@example.com',
    status: 'paid',
    price: 29.9,
    alipayTradeNo: '2026081722001111',
    refundStatus: 'requested',
    refundedAt: null,
    refundAmount: null,
    refundTradeNo: null,
    refundReason: null,
    refundRequestedAt: null,
    refundRejectReason: null,
    refundRejectedAt: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<RefundDeps> = {}): RefundDeps {
  const order = makeOrder();
  const deps: RefundDeps = {
    findOrder: vi.fn().mockResolvedValue(order),
    findUserOrder: vi.fn().mockResolvedValue(order),
    updateOrder: vi.fn(async (orderNo, data) => ({ ...order, ...data })),
    findEsimByOrderId: vi.fn().mockResolvedValue({ id: 'esim-1', orderId: 'order-1' }),
    deleteEsimByOrderId: vi.fn(async () => {}),
    alipayRefund: vi.fn(async () => ({ code: '10000', tradeNo: '20260817220011119999' })),
  };
  return { ...deps, ...overrides };
}

describe('applyRefundRequest 用户申请退款', () => {
  it('订单不属于当前用户时抛出「订单不存在」', async () => {
    const deps = makeDeps({ findUserOrder: vi.fn().mockResolvedValue(null) });
    await expect(applyRefundRequest(deps, 'user-9', 'DPH1234567890')).rejects.toThrow('订单不存在');
  });

  it('未支付（非待激活）订单不可申请', async () => {
    const deps = makeDeps({ findUserOrder: vi.fn().mockResolvedValue(makeOrder({ status: 'pending' })) });
    await expect(applyRefundRequest(deps, 'user-1', 'DPH1234567890')).rejects.toThrow('仅待激活订单可申请退款');
  });

  it('已退款订单不可申请', async () => {
    const deps = makeDeps({
      findUserOrder: vi
        .fn()
        .mockResolvedValue(makeOrder({ status: 'refunded', refundedAt: new Date() })),
    });
    await expect(applyRefundRequest(deps, 'user-1', 'DPH1234567890')).rejects.toThrow('订单已退款');
  });

  it('已有待处理申请时不可重复申请', async () => {
    const deps = makeDeps({
      findUserOrder: vi.fn().mockResolvedValue(makeOrder({ refundStatus: 'requested' })),
    });
    await expect(applyRefundRequest(deps, 'user-1', 'DPH1234567890')).rejects.toThrow('退款申请已提交');
  });

  it('申请被拒绝后不可再次申请', async () => {
    const deps = makeDeps({
      findUserOrder: vi.fn().mockResolvedValue(makeOrder({ refundStatus: 'rejected' })),
    });
    await expect(applyRefundRequest(deps, 'user-1', 'DPH1234567890')).rejects.toThrow('已被拒绝');
  });

  it('申请成功时写入 refundStatus=requested 并记录申请时间与原因', async () => {
    const deps = makeDeps({ findUserOrder: vi.fn().mockResolvedValue(makeOrder({ refundStatus: null })) });
    const result = await applyRefundRequest(deps, 'user-1', 'DPH1234567890', '买了多余的套餐');

    const data = (deps.updateOrder as any).mock.calls[0][1];
    expect(data).toMatchObject({
      refundStatus: 'requested',
      refundReason: '买了多余的套餐',
    });
    expect(data.refundRequestedAt).toBeInstanceOf(Date);
    expect(result.requested).toBe(true);
  });
});

describe('refundOrder 后台同意退款并执行', () => {
  it('订单不存在时抛出「订单不存在」', async () => {
    const deps = makeDeps({ findOrder: vi.fn().mockResolvedValue(null) });
    await expect(refundOrder(deps, 'DPH-UNKNOWN')).rejects.toThrow('订单不存在');
  });

  it('未支付订单不可退款', async () => {
    const deps = makeDeps({ findOrder: vi.fn().mockResolvedValue(makeOrder({ status: 'pending' })) });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('仅已支付订单可退款');
  });

  it('无退款申请时不可直接退款', async () => {
    const deps = makeDeps({ findOrder: vi.fn().mockResolvedValue(makeOrder({ refundStatus: null })) });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('暂无退款申请');
  });

  it('已同意处理过时不可重复退款', async () => {
    const deps = makeDeps({
      findOrder: vi
        .fn()
        .mockResolvedValue(makeOrder({ status: 'refunded', refundedAt: new Date(), refundStatus: 'approved' })),
    });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('订单已退款');
  });

  it('支付宝退款失败时不修改订单、不删除 eSIM', async () => {
    const deps = makeDeps({
      alipayRefund: vi.fn(async () => ({ code: '40004', subMsg: '余额不足', msg: 'Business Failed' })),
    });
    await expect(refundOrder(deps, 'DPH1234567890')).rejects.toThrow('退款失败');
    expect(deps.updateOrder).not.toHaveBeenCalled();
    expect(deps.deleteEsimByOrderId).not.toHaveBeenCalled();
  });

  it('同意退款成功时按原价发起支付宝退款并置为已退款、删除 eSIM', async () => {
    const deps = makeDeps();
    const result = await refundOrder(deps, 'DPH1234567890');

    const refundArgs = (deps.alipayRefund as any).mock.calls[0][0];
    expect(refundArgs).toMatchObject({
      outTradeNo: '2026081722001111',
      refundAmount: '29.90',
      outRequestNo: 'DPH1234567890',
    });

    const updateData = (deps.updateOrder as any).mock.calls[0][1];
    expect(updateData).toMatchObject({
      status: 'refunded',
      refundStatus: 'approved',
      refundAmount: 29.9,
      refundTradeNo: '20260817220011119999',
    });
    expect(updateData.refundedAt).toBeInstanceOf(Date);
    expect(deps.deleteEsimByOrderId).toHaveBeenCalledWith('order-1');
    expect(result.refunded).toBe(true);
  });

  it('无 eSIM 记录时退款流程仍正常完成', async () => {
    const deps = makeDeps({ findEsimByOrderId: vi.fn().mockResolvedValue(null) });
    const result = await refundOrder(deps, 'DPH1234567890');
    expect(result.refunded).toBe(true);
    expect(deps.deleteEsimByOrderId).not.toHaveBeenCalled();
  });
});

describe('rejectRefundRequest 后台拒绝退款', () => {
  it('订单不存在时抛出「订单不存在」', async () => {
    const deps = makeDeps({ findOrder: vi.fn().mockResolvedValue(null) });
    await expect(rejectRefundRequest(deps, 'DPH-UNKNOWN', '不符合规则')).rejects.toThrow('订单不存在');
  });

  it('没有待处理申请时不可拒绝', async () => {
    const deps = makeDeps({ findOrder: vi.fn().mockResolvedValue(makeOrder({ refundStatus: null })) });
    await expect(rejectRefundRequest(deps, 'DPH1234567890', '不符合规则')).rejects.toThrow('没有待处理');
  });

  it('未填写拒绝理由时抛错', async () => {
    const deps = makeDeps();
    await expect(rejectRefundRequest(deps, 'DPH1234567890', '   ')).rejects.toThrow('请填写拒绝理由');
  });

  it('拒绝成功时写入 rejected 与拒绝理由', async () => {
    const deps = makeDeps();
    const result = await rejectRefundRequest(deps, 'DPH1234567890', '套餐已激活不可退款');
    const data = (deps.updateOrder as any).mock.calls[0][1];
    expect(data).toMatchObject({
      refundStatus: 'rejected',
      refundRejectReason: '套餐已激活不可退款',
    });
    expect(data.refundRejectedAt).toBeInstanceOf(Date);
    expect(result.rejected).toBe(true);
  });
});