import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { provisionEsim } from './provision';
import { renewEsim } from './topup';
import { sendEsimEmail, sendRenewEmail } from './email';
import { readDisplayConfig, DEFAULT_DISPLAY_CONFIG } from '../pricing/priceOverride';
import { readMaxRefundRejectCount } from './refund';
import { config } from '../config';
import { blacklistIccid, unbindTigerPackages } from '../tiger';
import { resolveEsimActivation } from '../tiger/activation';
import type { RefundDeps } from './refund';

/**
 * 公共支付接口：把支付相关的业务逻辑（支付下单、支付成功履约、退款依赖装配）收敛到一处，
 * 路由层只负责鉴权与参数透传。支付渠道通过统一的 PaymentProvider 抽象隔离，
 * 当前默认实现为支付宝（alipayProvider），后续接入微信支付等渠道只需新增并切换 Provider。
 */

// ================= 支付渠道抽象 =================

export interface PaymentRefundResult {
  code?: string;
  msg?: string;
  subMsg?: string;
  tradeNo?: string;
}

export interface PaymentProvider {
  /** 创建支付预下单，返回渠道交易号（支付宝返回 trade_no，前端据此拉起收银台） */
  createOrder(opts: {
    outTradeNo: string;
    subject: string;
    totalAmount: string;
    notifyUrl: string;
    buyerOpenId?: string;
    buyerId?: string;
  }): Promise<{ tradeNo?: string }>;
  /** 创建 H5 网页支付，返回浏览器可跳转的收银台链接 */
  createWapPayUrl(opts: {
    outTradeNo: string;
    subject: string;
    totalAmount: string;
    notifyUrl: string;
    returnUrl: string;
  }): Promise<{ payUrl: string }>;
  /** 执行原路退款 */
  refund(opts: {
    outTradeNo: string;
    refundAmount: string;
    outRequestNo: string;
    refundReason?: string;
  }): Promise<PaymentRefundResult>;
}

/** 支付宝支付渠道（包装 utils/alipay 的低层网关调用） */
export const alipayProvider: PaymentProvider = {
  async createOrder({ outTradeNo, subject, totalAmount, notifyUrl, buyerOpenId, buyerId }) {
    const tradeNo = await alipay.createTradeNo(outTradeNo, subject, totalAmount, notifyUrl, buyerOpenId, buyerId);
    return { tradeNo };
  },
  async createWapPayUrl({ outTradeNo, subject, totalAmount, notifyUrl, returnUrl }) {
    const payUrl = await alipay.wapPay(outTradeNo, subject, totalAmount, notifyUrl, returnUrl);
    return { payUrl };
  },
  async refund(params) {
    return alipay.refund(params.outTradeNo, params.refundAmount, params.outRequestNo, params.refundReason);
  },
};

// ================= 金额换算 =================

/**
 * 订单价格按展示货币存储（CNY 或 USD），支付宝仅支持人民币，
 * 展示货币为 USD 时需按汇率换算成 CNY，四舍五入到分。
 */
async function toCnyAmount(price: number): Promise<string> {
  const displayCfg = await readDisplayConfig();
  let cny = price;
  if (displayCfg.displayCurrency === 'USD') {
    const rate = displayCfg.usdCnyRate > 0 ? displayCfg.usdCnyRate : DEFAULT_DISPLAY_CONFIG.usdCnyRate;
    cny = price * rate;
  }
  return (Math.round(cny * 100) / 100).toFixed(2);
}

/** 商品名用纯 ASCII，避免中文编码导致支付宝"加签结果验证不通过" */
function buildSubject(order: any): string {
  return `eSIM ${order.isUnlimited ? 'Unlimited' : `${order.gb || 0}GB`} ${order.days || 0}Days`;
}

// ================= 支付下单 =================

export interface CreatePaymentIntentOptions {
  buyerOpenId?: string;
  buyerId?: string;
}

export interface CreatePaymentIntentResult {
  orderNo: string;
  /** 应付金额（CNY，两位小数） */
  totalAmount: string;
  /** 渠道预下单交易号（支付宝 trade_no）；paid=true 时为 undefined */
  tradeNo?: string;
  /** 订单是否已经是已支付状态（前端可直接刷新） */
  paid: boolean;
  /** 支付方式标识 */
  payMethod: 'alipay';
}

/**
 * 创建支付预下单：
 * 1. 已支付订单直接返回 paid；
 * 2. 换算人民币金额、构造商品标题与通知地址；
 * 3. 调用支付宝 alipay.trade.create 获取 trade_no 返回给小程序，
 *    前端再调用 my.tradePay({ tradeNO }) 调起收银台。
 */
export async function createPaymentIntent(
  prisma: PrismaClient,
  order: any,
  opts: CreatePaymentIntentOptions = {},
): Promise<CreatePaymentIntentResult> {
  if (order.status === 'paid') {
    return { orderNo: order.orderNo, totalAmount: '0.00', paid: true, payMethod: 'alipay' };
  }
  const totalAmount = await toCnyAmount(order.price);
  const subject = buildSubject(order);
  const notifyUrl = `${config.alipay.notifyHost}/api/alipay/notify`;

  const { tradeNo } = await alipayProvider.createOrder({
    outTradeNo: order.orderNo,
    subject,
    totalAmount,
    notifyUrl,
    buyerOpenId: opts.buyerOpenId,
    buyerId: opts.buyerId,
  });

  return { orderNo: order.orderNo, totalAmount, tradeNo, paid: false, payMethod: 'alipay' };
}

// ================= H5 网页支付 =================

export interface CreateWapPaymentUrlOptions {
  /** 支付完成后浏览器回跳地址（外部项目自己的结果页） */
  returnUrl: string;
}

export interface CreateWapPaymentUrlResult {
  orderNo: string;
  /** 应付金额（CNY，两位小数） */
  totalAmount: string;
  /** H5 收银台跳转链接；paid=true 时为 undefined */
  payUrl?: string;
  /** 订单是否已经是已支付状态 */
  paid: boolean;
  payMethod: 'alipay';
}

/**
 * 创建 H5 网页支付链接（alipay.trade.wap.pay）：
 * 已支付订单直接返回 paid；否则换算人民币金额、构造商品名与通知/回跳地址，
 * 返回浏览器可直接打开的收银台链接。支付结果由 /api/alipay/notify 异步履约。
 */
export async function createWapPaymentUrl(
  prisma: PrismaClient,
  order: any,
  opts: CreateWapPaymentUrlOptions,
): Promise<CreateWapPaymentUrlResult> {
  if (order.status === 'paid') {
    return { orderNo: order.orderNo, totalAmount: '0.00', paid: true, payMethod: 'alipay' };
  }
  const totalAmount = await toCnyAmount(order.price);
  const subject = buildSubject(order);
  const notifyUrl = `${config.alipay.notifyHost}/api/alipay/notify`;

  const { payUrl } = await alipayProvider.createWapPayUrl({
    outTradeNo: order.orderNo,
    subject,
    totalAmount,
    notifyUrl,
    returnUrl: opts.returnUrl,
  });

  return { orderNo: order.orderNo, totalAmount, payUrl, paid: false, payMethod: 'alipay' };
}

// ================= 支付成功履约 =================

export interface FulfillMeta {
  alipayTradeNo?: string;
  paidAmount?: number;
}

/**
 * 支付成功后的统一履约：置订单为已支付 → 下发新 eSIM（或续费）→ 发送邮件。
 * 支付宝异步通知、模拟支付接口共用此入口，保证逻辑一致。
 * eSIM 下发/续费失败时抛出异常，由调用方决定处理方式（通知接口兜底置为已支付，接口返回失败）。
 */
export async function fulfillPaidOrder(
  prisma: PrismaClient,
  order: any,
  meta: FulfillMeta = {},
): Promise<{ order: any; esim?: any }> {
  const updated = await prisma.order.update({
    where: { orderNo: order.orderNo },
    data: {
      status: 'paid',
      paidAt: new Date(),
      ...(meta.alipayTradeNo ? { alipayTradeNo: meta.alipayTradeNo } : {}),
      ...(meta.paidAmount ? { paidAmount: meta.paidAmount } : {}),
    },
  });

  // 续费：流量累加、到期顺延，激活码不变
  if (updated.orderType === 'renew') {
    const target = await prisma.esim.findFirst({
      where: { id: updated.targetEsimId || '', userId: order.userId },
    });
    if (!target) {
      throw new Error('目标 eSIM 不存在');
    }
    // renewEsim 内部会再次校验该卡当前套餐已到期
    const esimData = await renewEsim(prisma, updated, target);
    const esim = await prisma.esim.create({ data: { ...esimData, userId: order.userId } });

    sendRenewEmailSafe(updated, target, esim).catch((e) =>
      console.error(`[email] 订单 ${updated.orderNo} 续费通知发送失败：`, e.message),
    );
    return { order: updated, esim };
  }

  // 新购/变更：下发新 eSIM
  const esimData = await provisionEsim(prisma, updated);
  const esim = await prisma.esim.create({ data: { ...esimData, userId: order.userId } });

  sendEsimEmailSafe(updated, esimData).catch((e) =>
    console.error(`[email] 订单 ${updated.orderNo} 激活码邮件发送失败：`, e.message),
  );
  return { order: updated, esim };
}

// ================= 退款依赖装配 =================

/**
 * 装配退款服务依赖（RefundDeps），供用户端申请退款与后台审批退款复用。
 * alipayRefund 根据订单是否真实支付宝支付动态选择：带 alipayTradeNo 则调用真实退款，
 * 否则（模拟支付/历史数据）直接放行，避免调用支付宝报"交易不存在"。
 */
export function buildRefundDeps(prisma: PrismaClient, orderNo: string): RefundDeps {
  return {
    findOrder: (no) => prisma.order.findUnique({ where: { orderNo: no } }),
    findUserOrder: (userId, no) => prisma.order.findFirst({ where: { orderNo: no, userId } }),
    updateOrder: (no, data) => prisma.order.update({ where: { orderNo: no }, data }),
    findEsimByOrderId: (orderId) => prisma.esim.findUnique({ where: { orderId } }),
    // Tiger 实时激活状态为准；查询失败返回 null 时回落本地状态判断
    checkEsimActivated: async (esim) => {
      if (!esim?.iccid) return false;
      const resolved = await resolveEsimActivation(esim);
      return resolved?.status === 'activated';
    },
    deleteEsimByOrderId: async (orderId) => {
      const esim = await prisma.esim.findUnique({ where: { orderId } });
      if (!esim) return;
      // 退款先解绑 Tiger 该 ICCID 上的套餐，再删本地记录，随后 ICCID 列入黑名单，禁止再次绑定下单
      await unbindTigerPackages(esim);
      await prisma.esim.delete({ where: { orderId } });
      await blacklistIccid(prisma, esim.iccid, 'refund');
    },
    alipayRefund: async (params) => {
      const order = await prisma.order.findUnique({ where: { orderNo } });
      if (!order?.alipayTradeNo) {
        return { code: '10000', tradeNo: `RF${Date.now()}` };
      }
      // 创建交易时写入的商户单号 out_trade_no 就是 orderNo，退款必须用它作为 out_trade_no
      return alipayProvider.refund(params);
    },
    getMaxRejectCount: readMaxRefundRejectCount,
    createRefundRequest: async (orderId, reason) =>
      prisma.refundRequest.create({
        data: { orderId, status: 'requested', reason: reason || null },
      }),
    resolveRefundRequest: async (orderId, status, data) => {
      // 只结算该订单最新一条仍在「待处理」的申请记录，避免消费旧的申请
      await prisma.refundRequest.updateMany({
        where: { orderId, status: 'requested' },
        data: { status, ...data },
      });
    },
  };
}

// ================= 邮件发送（安全包装，失败只打日志） =================

/** 发送激活码邮件（安全包装，失败只打日志） */
async function sendEsimEmailSafe(order: any, esimData: any) {
  if (!order.email) {
    console.warn(`[email] 订单 ${order.orderNo} 未填写邮箱，跳过邮件发送`);
    return;
  }
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