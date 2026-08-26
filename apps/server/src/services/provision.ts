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
  gb?: number;
  days?: number;
  countryCode?: string;
  pkgName?: string;
  tigerPkgId?: number;
  tigerPid?: string;
}

/**
 * 支付成功后下发 eSIM。
 * 套餐数据不落本地库，全部来自订单快照（order 上的 countryCode/gb/days/tigerPkgId/tigerPid）：
 * - 已配置 Tiger 凭据 → 从卡片池取 ICCID，调用 Tiger 绑定套餐，保存真实激活信息
 * - 未配置 → 回退到本地模拟生成（演示用）
 */
export async function provisionEsim(prisma: PrismaClient, order: any): Promise<ProvisionResult> {
  const days = Number(order?.days || 7);
  const expireAt = new Date(Date.now() + days * 86400000);
  const snap = {
    gb: Number(order?.gb || 0),
    days,
    countryCode: order?.countryCode || '',
    pkgName: order?.pkgName || '',
    tigerPkgId: Number(order?.tigerPkgId || 0) || undefined,
    tigerPid: order?.tigerPid || '',
  };
  const pkgId = String(order?.pkgId || '');

  if (tigerClient.configured) {
    const iccid = await getAvailableIccid(prisma);
    if (!iccid) {
      throw new Error('Tiger 卡片池已用完或未配置 TIGER_ICCIDS，请补充卡片库存');
    }
    let tigerPkgId: number | null = snap.tigerPkgId || null;
    if (!tigerPkgId) {
      const listRes = await tigerClient.listPackages({ package_type: 'data', is_active: true, limit: 500 });
      const items: any[] = listRes?.data?.items || listRes?.items || [];
      const matched = items.find(
        (it) => Number(it.amount) === snap.gb * 1024 && Number(it.valid_days) === snap.days,
      );
      if (!matched) {
        throw new Error(`未找到与套餐「${snap.countryCode} ${snap.gb}GB/${snap.days}天」匹配的 Tiger 套餐，请先在后台同步套餐映射`);
      }
      tigerPkgId = Number(matched.pid || matched.id);
    }
    const bindRes = await tigerClient.bindPackage(iccid, tigerPkgId);
    let info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    if (!info || !info.activationCode) {
      // 官方新版：绑定响应可能不含激活码，回退从卡片查询接口（GET /api/card）获取 installation 二维码
      console.warn('[tiger] 绑定响应未含激活码，回退查询 GET /api/card 获取激活信息...');
      info = await tigerClient.getCardActivation(iccid);
    }
    if (!info || !info.activationCode) {
      console.error('[tiger] 绑定成功但无法获取激活信息：', JSON.stringify(bindRes?.data));
      throw new Error('Tiger 绑定套餐成功，但无法获取激活码（绑定响应与卡片查询均无返回），请检查响应结构');
    }
    return {
      orderId: order.id,
      pkgId,
      activationCode: info.activationCode,
      iccid: info.iccid || iccid,
      smdp: info.smdp,
      status: 'pending',
      expireAt,
      ...snap,
      tigerPkgId,
    };
  }

  // ===== 模拟回退（未配置 Tiger）=====
  const rand = () =>
    Array.from({ length: 4 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31)),
    ).join('');
  const smdp = 'smdp.yyesim.net';
  const iccid = '89' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return {
    orderId: order.id,
    pkgId,
    activationCode: `LPA:1$${smdp}$${rand()}-${rand()}-${rand()}`,
    iccid,
    smdp,
    status: 'pending',
    expireAt,
    ...snap,
  };
}