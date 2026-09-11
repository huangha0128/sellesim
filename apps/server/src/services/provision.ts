import { PrismaClient } from '@prisma/client';
import { tigerClient, extractEsimInfo, getAvailableIccid, fetchTigerIccids } from '../tiger';

export interface ProvisionResult {
  orderId: string;
  activationCode: string;
  iccid: string;
  smdp: string;
  status: string;
  expireAt: Date;
  gb?: number;
  days?: number;
  isUnlimited?: boolean;
  countryCode?: string;
  pkgName?: string;
  pkgNameEn?: string;
  tigerPkgId?: number;
  tigerPid?: string;
  tigerBindingId?: number;
}

function tigerBindingId(res: any): number | undefined {
  const raw = res?.data?.id ?? res?.id;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Provision a new-purchase package. Every new purchase gets an unused ICCID.
 * Renewals reuse the target ICCID and are handled by renewEsim.
 */
export async function provisionEsim(prisma: PrismaClient, order: any): Promise<ProvisionResult> {
  const days = Number(order?.days || 7);
  const expireAt = new Date(Date.now() + days * 86400000);
  const snap = {
    gb: Number(order?.gb || 0),
    days,
    isUnlimited: !!order?.isUnlimited,
    countryCode: order?.countryCode || '',
    pkgName: order?.pkgName || '',
    pkgNameEn: order?.pkgNameEn || '',
    tigerPkgId: Number(order?.tigerPkgId || 0) || undefined,
    tigerPid: order?.tigerPid || '',
  };

  if (tigerClient.configured) {
    const availableIccid = await getAvailableIccid(prisma, () => fetchTigerIccids());
    if (!availableIccid) {
      throw new Error('Tiger 卡片池已用完，请到 TigerESIM 后台补充卡片库存');
    }
    const iccid = availableIccid;
    const smdp = process.env.TIGER_SMDP_ADDRESS || 'smdp.tigeresims.com';

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
    const bindingId = tigerBindingId(bindRes);

    let info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    if (!info || !info.activationCode) {
      console.warn('[tiger] 绑定响应未含激活码，回退查询 GET /api/card 获取激活信息...');
      info = await tigerClient.getCardActivation(iccid);
    }
    if (!info || !info.activationCode) {
      console.error('[tiger] 绑定成功但无法获取激活信息：', JSON.stringify(bindRes?.data));
      throw new Error('Tiger 绑定套餐成功，但无法获取激活码（绑定响应与卡片查询均无返回），请检查响应结构');
    }

    return {
      orderId: order.id,
      activationCode: info.activationCode,
      iccid: info.iccid || iccid,
      smdp: info.smdp,
      status: 'pending',
      expireAt,
      ...snap,
      tigerPkgId,
      ...(bindingId ? { tigerBindingId: bindingId } : {}),
    };
  }

  // ===== Simulated fallback =====
  const rand = () =>
    Array.from({ length: 4 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31)),
    ).join('');
  const smdp = 'smdp.yyesim.net';
  const iccid = '89' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return {
    orderId: order.id,
    activationCode: `LPA:1$${smdp}$${rand()}-${rand()}-${rand()}`,
    iccid,
    smdp,
    status: 'pending',
    expireAt,
    ...snap,
  };
}
