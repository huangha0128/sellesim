import { PrismaClient } from '@prisma/client';
import { tigerClient, extractEsimInfo, getAvailableIccid } from '../tiger';

export interface ProvisionResult {
  orderId: string;
  pkgId: string;
  activationCode: string;
  iccid: string;
  smdp: string;
  status: string;
  expireAt: Date;
}

/**
 * 支付成功后下发 eSIM：
 * - 已配置 Tiger 凭据 → 从卡片池取 ICCID，调用 Tiger 绑定套餐，保存真实激活信息
 * - 未配置 → 回退到本地模拟生成（演示用）
 */
export async function provisionEsim(prisma: PrismaClient, order: any, pkg: any): Promise<ProvisionResult> {
  const expireAt = new Date(Date.now() + (pkg?.days || 7) * 86400000);

  if (tigerClient.configured) {
    const iccid = await getAvailableIccid(prisma);
    if (!iccid) {
      throw new Error('Tiger 卡片池已用完或未配置 TIGER_ICCIDS，请补充卡片库存');
    }
    let tigerPkgId: number | null = pkg?.tigerPkgId ?? null;
    if (!tigerPkgId) {
      const listRes = await tigerClient.listPackages({ package_type: 'data', is_active: true, limit: 500 });
      const items: any[] = listRes?.data?.items || listRes?.items || [];
      const matched = items.find(
        (it) => Number(it.amount) === (pkg?.gb || 0) * 1024 && Number(it.valid_days) === (pkg?.days || 0),
      );
      if (!matched) {
        throw new Error(`未找到与套餐「${pkg?.countryCode} ${pkg?.gb}GB/${pkg?.days}天」匹配的 Tiger 套餐，请先在后台同步套餐映射`);
      }
      tigerPkgId = Number(matched.pid || matched.id);
    }
    const bindRes = await tigerClient.bindPackage(iccid, tigerPkgId);
    const info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    if (!info || !info.activationCode) {
      console.error('[tiger] 绑定成功但未能解析激活信息：', JSON.stringify(bindRes?.data));
      throw new Error('Tiger 绑定套餐成功，但返回数据缺少激活码，请检查响应结构');
    }
    return {
      orderId: order.id,
      pkgId: order.pkgId,
      activationCode: info.activationCode,
      iccid: info.iccid || iccid,
      smdp: info.smdp,
      status: 'pending',
      expireAt,
    };
  }

  // ===== 模拟回退（未配置 Tiger）=====
  const rand = () =>
    Array.from({ length: 4 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31))
    ).join('');
  const smdp = 'smdp.yyesim.net';
  const iccid = '89' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return {
    orderId: order.id,
    pkgId: order.pkgId,
    activationCode: `LPA:1$${smdp}$${rand()}-${rand()}-${rand()}`,
    iccid,
    smdp,
    status: 'pending',
    expireAt,
  };
}
