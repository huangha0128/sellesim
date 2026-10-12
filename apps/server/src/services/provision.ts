import { PrismaClient } from '@prisma/client';
import { tigerClient, extractEsimInfo, getAvailableIccid, fetchTigerIccids, rollbackTigerBinding } from '../tiger';

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

/** Tiger 的 eSIM profile 为异步生成，绑定后轮询卡片查询接口取激活码：最多 5 次，退避 0/2/4/6/8s */
const ACTIVATION_POLL_ATTEMPTS = 5;
const POLL_BASE_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 复用卡片前检查 Tiger 侧是否已有套餐绑定（历史残留会让新订单双重绑定同一张卡） */
async function checkResidualBinding(iccid: string): Promise<boolean> {
  const res = await tigerClient.listCardPackages(iccid, { limit: 500 });
  const data = res?.data || res || {};
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  return items.length > 0;
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
    const availableIccid = await getAvailableIccid(prisma, () => fetchTigerIccids(), checkResidualBinding);
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

    // Tiger 官方已把激活码/二维码迁移到卡片查询接口（installation.qrcode），绑定响应
    // 通常不含激活码，需以卡片查询兜底；且 profile 异步生成，qrcode 可能延迟数秒才就绪
    // （线上曾因此产生两笔「已支付无卡」订单），这里按退避轮询取码：0s/2s/4s/6s/8s。
    let info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    for (let attempt = 1; attempt <= ACTIVATION_POLL_ATTEMPTS && (!info || !info.activationCode); attempt++) {
      if (attempt > 1) await sleep(POLL_BASE_DELAY_MS * (attempt - 1));
      try {
        info = await tigerClient.getCardActivation(iccid);
      } catch (e: any) {
        console.warn(
          `[tiger] 第 ${attempt}/${ACTIVATION_POLL_ATTEMPTS} 次查询激活信息失败（iccid=${iccid}）：${e?.message || e}`,
        );
      }
    }
    if (!info || !info.activationCode) {
      // 取码最终失败：回滚刚创建的绑定，避免卡片残留绑定被复用/双重绑定；订单由补偿任务重试
      await rollbackTigerBinding(bindingId, iccid);
      console.error('[tiger] 绑定成功但多次重试后仍无法获取激活信息，已回滚绑定：', JSON.stringify(bindRes?.data));
      throw new Error('Tiger 绑定套餐成功，但多次重试后仍无法获取激活码（绑定已回滚），等待补偿任务重试下发');
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
