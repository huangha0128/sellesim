import { Prisma, PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';
import { getPackageView } from '../tiger/view';
import { resolveSubjectPrice } from './subjectPricing';
import { resolveSettlePrice, debitWallet, restoreWallet, canPlaceOrder, lockSubject, QuotaError } from './quota';
import { provisionEsim } from './provision';
import { enqueueSubjectWebhook } from './webhook';
import { sendEsimEmail } from './email';

/**
 * 订单创建公共逻辑：内部（小程序/管理端）与外部开放 API 共用的下单入口。
 * 校验参数、续费资格、Tiger 配置与套餐存在性，创建 pending 订单并返回。
 * 校验失败抛 OrderCreateError（message 为中文，可安全返回给前端）。
 */

export class OrderCreateError extends Error {
  /** HTTP 状态码（默认 200，与既有内部接口"业务失败返回 code:1"的约定一致） */
  status: number;
  constructor(message: string, status = 200) {
    super(message);
    this.name = 'OrderCreateError';
    this.status = status;
  }
}

export interface CreateOrderParams {
  pkgId: string;
  email: string;
  /** 订单归属用户（内部为登录用户，外部为应用关联的合成用户） */
  userId: string;
  payMethod?: string;
  orderType?: 'new' | 'renew';
  /** 续费目标 eSIM（仅 orderType=renew 必填，且必须属于 userId） */
  targetEsimId?: string;
  /** 外部项目自己的订单号（仅外部开放 API 使用，用于对账与按单反查） */
  extOrderNo?: string;
}

export async function createOrder(prisma: PrismaClient, params: CreateOrderParams): Promise<any> {
  const { pkgId, email, userId, payMethod = 'alipay', orderType = 'new', targetEsimId, extOrderNo } = params;

  if (!pkgId || !email) {
    throw new OrderCreateError('缺少必要参数');
  }
  if (orderType !== 'new' && orderType !== 'renew') {
    throw new OrderCreateError('非法订单类型');
  }
  // 续费必须指定属于当前用户的目标 eSIM，且其当前套餐必须已到期
  if (orderType === 'renew') {
    if (!targetEsimId) {
      throw new OrderCreateError('缺少目标 eSIM');
    }
    const target = await prisma.esim.findFirst({
      where: { id: targetEsimId, userId },
    });
    if (!target) {
      throw new OrderCreateError('目标 eSIM 不存在');
    }
    if (target.expireAt && new Date(target.expireAt).getTime() > Date.now()) {
      throw new OrderCreateError('当前套餐尚未到期，到期后才能为该卡续费购买新套餐');
    }
  }
  if (!tigerClient.configured) {
    throw new OrderCreateError(
      '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，套餐实时来自 TigerESIM，请先在后台配置密钥',
    );
  }
  let pkg: any;
  try {
    pkg = await getPackageView(String(pkgId));
  } catch (e: any) {
    throw new OrderCreateError('Tiger 套餐获取失败：' + e.message, 502);
  }
  if (!pkg) {
    throw new OrderCreateError('套餐不存在（TigerESIM 未找到该套餐）');
  }

  const orderNo = `DPH${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
  return prisma.order.create({
    data: {
      orderNo,
      pkgId: String(pkg.tigerPkgId || pkg.id || pkgId),
      email,
      payMethod,
      price: pkg.price,
      status: 'pending',
      userId,
      countryCode: pkg.countryCode,
      pkgName: pkg.name || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days}天`,
      pkgNameEn: pkg.nameEn || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days} Days`,
      gb: pkg.gb,
      days: pkg.days,
      isUnlimited: !!pkg.isUnlimited,
      tigerPkgId: pkg.tigerPkgId,
      tigerPid: pkg.tigerPid,
      orderType,
      targetEsimId: targetEsimId || null,
      ...(extOrderNo ? { extOrderNo } : {}),
    },
  });
}

/**
 * Open platform v2: create an order for a subject (placing a new order).
 * - resoles the Tiger package and the subject's own selling price (visibility)
 * - attaches the order to the subject (subjectId) and to its synthetic user
 *   (userId) for admin aggregation, records the calling key (apiKeyId)
 * - throws OrderCreateError with the proper status on hidden/unknown packages
 */
export async function createSubjectOrder(
  prisma: PrismaClient,
  params: {
    pkgId: string;
    email: string;
    subject: { id: string; userId?: string | null; defaultMarkupPercent?: number | null };
    apiKeyId: string;
    extOrderNo?: string;
  },
): Promise<any> {
  const { pkgId, email, subject, apiKeyId, extOrderNo } = params;

  if (!pkgId || !email) {
    throw new OrderCreateError('缺少必要参数');
  }
  if (!tigerClient.configured) {
    throw new OrderCreateError(
      '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，套餐实时来自 TigerESIM，请先在后台配置密钥',
    );
  }
  let pkg: any;
  try {
    pkg = await getPackageView(String(pkgId));
  } catch (e: any) {
    throw new OrderCreateError('Tiger 套餐获取失败：' + e.message, 502);
  }
  if (!pkg) {
    throw new OrderCreateError('套餐不存在（TigerESIM 未找到该套餐）');
  }

  // subject visibility + selling price
  const resolved = await resolveSubjectPrice(prisma, pkg, subject);
  if (!resolved.visible) {
    throw new OrderCreateError('该套餐对本主体不可用', 404);
  }

  const orderNo = `DPH${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
  return prisma.order.create({
    data: {
      orderNo,
      pkgId: String(pkg.tigerPkgId || pkg.id || pkgId),
      email,
      payMethod: 'alipay',
      price: resolved.price,
      status: 'pending',
      userId: subject.userId || null,
      subjectId: subject.id,
      apiKeyId,
      countryCode: pkg.countryCode,
      pkgName: pkg.name || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days}天`,
      pkgNameEn: pkg.nameEn || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days} Days`,
      gb: pkg.gb,
      days: pkg.days,
      isUnlimited: !!pkg.isUnlimited,
      tigerPkgId: pkg.tigerPkgId,
      tigerPid: pkg.tigerPid,
      orderType: 'new',
      ...(extOrderNo ? { extOrderNo } : {}),
    },
  });
}

/**
 * Open platform v3: place an order on partner credit (no payment).
 * - Only packages visible to the subject can be ordered.
 * - The settle price W (deducted from quota) is computed by resolveSettlePrice
 *   (placeholder formula, pending design decision - docs/open-platform-v3-design.md §0/§1.3).
 * - A single tx locks the Subject row, validates status + available quota,
 *   debits usedQuota (+ledger), and creates the order as status='delivered',
 *   payMethod='quota'.
 * - Provisioning (external Tiger call) runs AFTER the tx commits; if it fails
 *   the quota debit is compensated back and the order is marked 'failed'.
 *
 * Throws OrderCreateError / QuotaError with the proper HTTP status.
 */
export async function createSubjectCreditOrder(
  prisma: PrismaClient,
  params: {
    pkgId: string;
    email: string;
    subject: { id: string; userId?: string | null; splitPercent?: number | null };
    apiKeyId: string;
    extOrderNo?: string;
  },
): Promise<{ order: any; esim?: any; cost: number }> {
  const { pkgId, email, subject, apiKeyId, extOrderNo } = params;

  if (!pkgId || !email) throw new OrderCreateError('缺少必要参数');
  if (!tigerClient.configured) {
    throw new OrderCreateError('未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，套餐实时来自 TigerESIM，请先在后台配置密钥');
  }
  let pkg: any;
  try {
    pkg = await getPackageView(String(pkgId));
  } catch (e: any) {
    throw new OrderCreateError('Tiger 套餐获取失败：' + e.message, 502);
  }
  if (!pkg) throw new OrderCreateError('套餐不存在（TigerESIM 未找到该套餐）');

  // visibility (hides the package) + subject selling price
  const resolved = await resolveSubjectPrice(prisma, pkg, subject);
  if (!resolved.visible) throw new OrderCreateError('该套餐对本主体不可用', 404);

  // settle price W (placeholder formula, pending §0)
  const cost = await resolveSettlePrice(prisma, pkg, subject);

  const orderNo = `DPH${Date.now()}${Math.floor(Math.random() * 90) + 10}`;

  // Step 1: atomic quota debit + order creation (locks Subject row against concurrency)
  const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const fresh = await lockSubject(tx, subject.id);
    if (fresh.status !== 'active') throw new QuotaError('主体已被停用', 403);
    if (!canPlaceOrder(fresh, cost)) {
      throw new QuotaError('可用授信额度不足，请联系平台结清后再下单', 409);
    }

    const o = await tx.order.create({
      data: {
        orderNo,
        pkgId: String(pkg.tigerPkgId || pkg.id || pkgId),
        email,
        payMethod: 'quota',
        price: cost,
        status: 'delivered',
        userId: subject.userId || null,
        subjectId: subject.id,
        apiKeyId,
        countryCode: pkg.countryCode,
        pkgName: pkg.name || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days}天`,
        pkgNameEn: pkg.nameEn || `${pkg.countryCode} ${pkg.gb}GB/${pkg.days} Days`,
        gb: pkg.gb,
        days: pkg.days,
        isUnlimited: !!pkg.isUnlimited,
        tigerPkgId: pkg.tigerPkgId,
        tigerPid: pkg.tigerPid,
        orderType: 'new',
        paidAt: new Date(), // credit order is settled immediately in quota terms
        ...(extOrderNo ? { extOrderNo } : {}),
      },
    });

    // wallet-first settlement: balance up to W, overdraw the rest into debt
    await debitWallet(tx, fresh, cost, orderNo, '钱包优先/授信透支扣款');
    return o;
  });

  // Step 2: provision the eSIM (external Tiger call, outside the tx)
  try {
    const esimData = await provisionEsim(prisma, order);
    const esim = await prisma.esim.create({ data: { ...esimData, userId: order.userId } });

    // fire-and-forget email
    if (order.email) {
      sendEsimEmail({
        to: order.email,
        orderNo,
        countryName: order.pkgName || order.countryCode || '',
        gb: order.gb || 0,
        days: order.days || 0,
        activationCode: esimData.activationCode,
        iccid: esimData.iccid,
        expireAt: esimData.expireAt,
      }).catch((e: any) => console.error(`[email] 订单 ${orderNo} 激活码邮件发送失败：`, e.message));
    }

    enqueueSubjectWebhook(
      prisma,
      subject.id,
      'order.delivered',
      {
        event: 'order.delivered',
        orderNo,
        extOrderNo: order.extOrderNo || null,
        status: 'delivered',
        paidAt: new Date().toISOString(),
        totalAmount: Number(order.price),
        esim: { iccid: esimData.iccid, expireAt: new Date(esimData.expireAt).toISOString() },
      },
    ).catch((e: any) => console.error(`[webhook] 订单 ${orderNo} 入队失败：`, e.message));

    return { order, esim, cost };
  } catch (e: any) {
    // Provisioning failed -> compensate the quota debit and mark the order failed.
    console.error(`[order] 订单 ${orderNo} 开卡失败，回滚额度：`, e.message);
    try {
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } }),
      ]);
      const fresh = await prisma.subject.findUnique({ where: { id: subject.id } });
      await restoreWallet(prisma, fresh ?? { id: subject.id }, cost, orderNo, undefined, '开卡失败额度冲回');
    } catch (compErr: any) {
      console.error(`[order] 订单 ${orderNo} 额度回滚失败，需人工处理：`, compErr.message);
    }
    throw new OrderCreateError('开卡失败，请稍后重试或联系平台', 502);
  }
}
