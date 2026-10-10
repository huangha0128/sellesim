import { Prisma, PrismaClient } from '@prisma/client';
import { readDisplayConfig, DEFAULT_DISPLAY_CONFIG } from '../pricing/priceOverride';

/**
 * 优惠券服务（仅小程序内部订单使用，开放平台不接入）。
 *  - 券模板 Coupon：满减（fixed，CNY 面额）/ 折扣（percent，1-100）
 *    过期方式：指定日期（date）/ 发放后 N 天（days）/ 永久（never）
 *  - 券的获取：
 *    1. 个人中心输入兑换码 → 兑换为账户 UserCoupon（source=code，占用 totalQuota 名额）
 *    2. 后台定向发放 UserCoupon 实例（source=grant）
 *  - 使用：下单时选择「我的优惠券」核销（unused → used，原子防并发重复使用）
 *  - 退款完成后券自动返还：UserCoupon 复位为未使用（已过有效期则置过期），可再次使用
 *  - 抵扣金额一律按 CNY 计算，封顶至最低支付 0.01，不找零不折现
 */

const MIN_PAYABLE_CNY = 0.01;
const DAY_MS = 86_400_000;

export class CouponError extends Error {
  status: number;
  constructor(message: string, status = 200) {
    super(message);
    this.name = 'CouponError';
    this.status = status;
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 订单价格（展示货币）→ CNY，与 payment.toCnyAmount 换算规则保持一致 */
export async function orderPriceToCny(price: number): Promise<number> {
  const cfg = await readDisplayConfig();
  let cny = price;
  if (cfg.displayCurrency === 'USD') {
    const rate = cfg.usdCnyRate > 0 ? cfg.usdCnyRate : DEFAULT_DISPLAY_CONFIG.usdCnyRate;
    cny = price * rate;
  }
  return round2(cny);
}

/** 按券的过期规则计算 UserCoupon 实例的过期时间（from 为发放/返还基准时间） */
export function computeUserCouponExpiry(
  coupon: { expireType: string; validUntil?: Date | null; validDays?: number | null },
  from: Date,
): Date | null {
  if (coupon.expireType === 'date') return coupon.validUntil ? new Date(coupon.validUntil) : null;
  if (coupon.expireType === 'days') {
    const days = Math.max(1, Math.floor(coupon.validDays || 0));
    return new Date(from.getTime() + days * DAY_MS);
  }
  return null;
}

/** 计算抵扣金额（CNY）：封顶至订单 CNY 价 - 0.01，保证最低支付 0.01 */
export function computeDiscountCny(
  coupon: { type: string; amount?: number | null; percent?: number | null },
  cnyPrice: number,
): number {
  let d: number;
  if (coupon.type === 'fixed') {
    d = Math.max(0, Number(coupon.amount || 0));
  } else {
    const p = Math.min(100, Math.max(0, Number(coupon.percent || 0)));
    d = round2((cnyPrice * p) / 100);
  }
  return round2(Math.min(d, Math.max(0, cnyPrice - MIN_PAYABLE_CNY)));
}

export interface CouponQuote {
  couponId: string;
  userCouponId: string;
  name: string;
  type: string;
  amount: number | null;
  percent: number | null;
  minSpend: number;
  /** CNY 抵扣金额快照 */
  discountCny: number;
  /** CNY 应付 = cnyPrice - discountCny（最低 0.01） */
  payableCny: number;
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * 校验并计算优惠券抵扣（只读，不核销）。
 * 仅支持「我的优惠券」实例：校验归属/未使用/未过期/券模板状态/门槛。
 * 供 /coupons/validate 预览与 createOrder 事务内复用，错误抛 CouponError（中文文案）。
 */
export async function quoteCoupon(
  prisma: Db,
  opts: { userId: string; cnyPrice: number; userCouponId?: string },
): Promise<CouponQuote> {
  const now = new Date();
  const { userId, cnyPrice } = opts;
  if (!(cnyPrice > 0)) {
    throw new CouponError('订单价格异常，无法使用优惠券');
  }
  if (!opts.userCouponId) {
    throw new CouponError('请选择要使用的优惠券');
  }

  const uc = await prisma.userCoupon.findUnique({
    where: { id: opts.userCouponId },
    include: { coupon: true },
  });
  if (!uc || uc.userId !== userId) throw new CouponError('优惠券不存在');
  if (uc.status === 'used') throw new CouponError('该优惠券已被使用');
  if (uc.status === 'expired' || (uc.expiresAt && now > new Date(uc.expiresAt))) {
    throw new CouponError('该优惠券已过期');
  }
  const c = uc.coupon;
  if (!c || c.status !== 'active') throw new CouponError('该优惠券已停用');
  if (cnyPrice < c.minSpend) throw new CouponError(`订单满 ${c.minSpend} 元可用`);

  const discountCny = computeDiscountCny(c, cnyPrice);
  return {
    couponId: c.id,
    userCouponId: uc.id,
    name: c.name,
    type: c.type,
    amount: c.amount,
    percent: c.percent,
    minSpend: c.minSpend,
    discountCny,
    payableCny: round2(Math.max(MIN_PAYABLE_CNY, cnyPrice - discountCny)),
  };
}

/**
 * 事务内核销优惠券（createOrder 内调用，与订单创建同事务，失败整体回滚）。
 * updateMany 仅允许 unused → used（原子，防并发重复使用）。
 */
export async function redeemInTx(
  tx: Prisma.TransactionClient,
  quote: CouponQuote,
  userId: string,
  orderId: string,
  orderNo: string,
): Promise<void> {
  const now = new Date();
  const r = await tx.userCoupon.updateMany({
    where: { id: quote.userCouponId, userId, status: 'unused' },
    data: { status: 'used', usedAt: now, usedOrderId: orderId },
  });
  if (r.count !== 1) throw new CouponError('优惠券已被使用，请更换后重试');
  await tx.couponRedemption.create({
    data: {
      couponId: quote.couponId,
      userCouponId: quote.userCouponId,
      userId,
      orderId,
      orderNo,
      amount: quote.discountCny,
    },
  });
}

/**
 * 个人中心输入兑换码 → 兑换为账户 UserCoupon（source=code）。
 * 校验：券启用 / date 型有效期窗口 / totalQuota 余量（usedCount 占位，事务内乐观锁防超发）
 * / perUserLimit（按用户名下 unused+used 实例数计）。days 型券过期时间从兑换时刻起算。
 */
export async function redeemCodeToUserCoupon(
  prisma: PrismaClient,
  userId: string,
  rawCode: string,
) {
  const now = new Date();
  const code = String(rawCode || '').trim();
  if (!code) throw new CouponError('请输入兑换码');
  const c = await prisma.coupon.findUnique({ where: { code } });
  if (!c) throw new CouponError('兑换码不存在');
  if (c.status !== 'active') throw new CouponError('该优惠券已停用');
  if (c.expireType === 'date') {
    if (c.validFrom && now < new Date(c.validFrom)) throw new CouponError('该优惠券尚未开始');
    if (c.validUntil && now > new Date(c.validUntil)) throw new CouponError('该优惠券已过期');
  }
  if (c.totalQuota != null && c.usedCount >= c.totalQuota) {
    throw new CouponError('该优惠券已被领完');
  }
  const owned = await prisma.userCoupon.count({
    where: { couponId: c.id, userId, status: { in: ['unused', 'used'] } },
  });
  if (owned >= c.perUserLimit) {
    throw new CouponError('该优惠券每个账号限领 ' + c.perUserLimit + ' 张');
  }
  const expiresAt = computeUserCouponExpiry(c, now);
  return prisma.$transaction(async (tx) => {
    if (c.totalQuota != null) {
      const fresh = await tx.coupon.findUnique({ where: { id: c.id } });
      if (!fresh || fresh.status !== 'active') throw new CouponError('该优惠券已停用');
      if (fresh.totalQuota != null && fresh.usedCount >= fresh.totalQuota) {
        throw new CouponError('该优惠券已被领完');
      }
      const r = await tx.coupon.updateMany({
        where: { id: c.id, usedCount: fresh.usedCount },
        data: { usedCount: { increment: 1 } },
      });
      if (r.count !== 1) throw new CouponError('领取冲突，请重试');
    }
    return tx.userCoupon.create({
      data: {
        couponId: c.id,
        userId,
        status: 'unused',
        source: 'code',
        grantedAt: now,
        expiresAt,
      },
      include: {
        coupon: {
          select: {
            id: true,
            name: true,
            type: true,
            amount: true,
            percent: true,
            minSpend: true,
            expireType: true,
            validUntil: true,
          },
        },
      },
    });
  });
}

/**
 * 订单退款完成后返还优惠券（refundOrder 成功后调用，非事务，失败由调用方兜底日志）：
 * UserCoupon 复位为未使用（已过有效期则置过期），可再次使用。
 * 打 refundedAt 标记（幂等：已返还直接跳过）。
 */
export async function releaseForRefund(prisma: PrismaClient, orderId: string): Promise<void> {
  const redemption = await prisma.couponRedemption.findUnique({ where: { orderId } });
  if (!redemption || redemption.refundedAt) return;
  const now = new Date();
  await prisma.couponRedemption.update({
    where: { id: redemption.id },
    data: { refundedAt: now },
  });
  if (!redemption.userCouponId) return;
  const uc = await prisma.userCoupon.findUnique({ where: { id: redemption.userCouponId } });
  if (!uc) return;
  const expired = !!uc.expiresAt && now > new Date(uc.expiresAt);
  await prisma.userCoupon.update({
    where: { id: uc.id },
    data: { status: expired ? 'expired' : 'unused', usedAt: null, usedOrderId: null },
  });
}

/**
 * 删除待支付订单时释放占用的券（在删除订单的事务内调用）：
 * 删除核销记录、复位 UserCoupon（订单未支付，券不产生任何消耗）。
 */
export async function releaseForPendingDelete(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const redemption = await tx.couponRedemption.findUnique({ where: { orderId } });
  if (!redemption) return;
  await tx.couponRedemption.delete({ where: { id: redemption.id } });
  if (!redemption.userCouponId) return;
  const uc = await tx.userCoupon.findUnique({ where: { id: redemption.userCouponId } });
  if (!uc) return;
  const expired = !!uc.expiresAt && new Date() > new Date(uc.expiresAt);
  await tx.userCoupon.update({
    where: { id: uc.id },
    data: { status: expired ? 'expired' : 'unused', usedAt: null, usedOrderId: null },
  });
}

/** 我的可用优惠券：先惰性把过期未用实例置 expired，再返回未使用且券模板仍启用的实例 */
export async function listMyCoupons(prisma: PrismaClient, userId: string) {
  const now = new Date();
  await prisma.userCoupon.updateMany({
    where: { userId, status: 'unused', expiresAt: { not: null, lte: now } },
    data: { status: 'expired' },
  });
  return prisma.userCoupon.findMany({
    where: { userId, status: 'unused', coupon: { status: 'active' } },
    orderBy: { grantedAt: 'desc' },
    include: {
      coupon: {
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          percent: true,
          minSpend: true,
          expireType: true,
          validUntil: true,
        },
      },
    },
  });
}
