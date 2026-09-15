import { PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';
import { getPackageView } from '../tiger/view';

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
