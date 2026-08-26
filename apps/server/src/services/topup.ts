import { PrismaClient } from '@prisma/client';
import { tigerClient, extractEsimInfo } from '../tiger';

/**
 * 解析订单快照对应的 Tiger 套餐 id
 * - 优先取 order.tigerPkgId（下单时已从 Tiger 实时套餐快照）
 * - 否则按 (amount=gb*1024, valid_days=days) 动态匹配
 */
async function resolveTigerPkgId(order: any): Promise<number> {
  if (order?.tigerPkgId) return Number(order.tigerPkgId);
  const listRes = await tigerClient.listPackages({ package_type: 'data', is_active: true, limit: 500 });
  const items: any[] = listRes?.data?.items || listRes?.items || [];
  const matched = items.find(
    (it) =>
      Number(it.amount) === (order?.gb || 0) * 1024 &&
      Number(it.valid_days) === (order?.days || 0),
  );
  if (!matched) {
    throw new Error(
      `未找到与套餐「${order?.countryCode} ${order?.gb}GB/${order?.days}天」匹配的 Tiger 套餐，请先在后台同步套餐映射`,
    );
  }
  return Number(matched.pid || matched.id);
}

/** 续费叠加后的到期时间：未过期则顺延，已过期则从当前起算 */
function expireAfterRenew(currentExpireAt: Date, days: number): Date {
  const now = Date.now();
  const base = currentExpireAt && currentExpireAt.getTime() > now ? currentExpireAt.getTime() : now;
  return new Date(base + days * 86400000);
}

/**
 * 续费（同卡叠加新套餐）：
 * - Tiger 场景：对同一 ICCID 调用 bindPackage 叠加新套餐
 * - 本地展示：目标 eSIM 的流量累加、到期时间顺延，激活码保持不变（同卡无需重新扫码）
 */
export async function renewEsim(
  prisma: PrismaClient,
  order: any,
  targetEsim: any,
): Promise<any> {
  const curGb = targetEsim?.gb ?? 0;
  const curDays = targetEsim?.days ?? 0;
  const gbAfter = curGb + (order?.gb || 0);
  const daysAfter = curDays + (order?.days || 0);
  const expireAt = expireAfterRenew(targetEsim?.expireAt, order?.days || 7);

  if (tigerClient.configured) {
    const tigerPkgId = await resolveTigerPkgId(order);
    const bindRes = await tigerClient.bindPackage(targetEsim.iccid, tigerPkgId);
    // 同卡续费一般不会返回新激活码，绑定成功即可，无需重新扫码
    extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
  }

  return prisma.esim.update({
    where: { id: targetEsim.id },
    data: {
      gb: gbAfter,
      days: daysAfter,
      expireAt,
    },
  });
}

/**
 * 变更（替换为新的套餐）：
 * - 先删除旧套餐在卡上的绑定（listCardPackages 定位 pk 后 deleteCardPackage），失败仅告警不回滚
 * - 再绑定新套餐
 * - 本地展示：目标 eSIM 替换为新套餐信息（流量/天数/到期时间重置为新的）
 */
export async function changeEsim(
  prisma: PrismaClient,
  order: any,
  targetEsim: any,
): Promise<any> {
  const expireAt = new Date(Date.now() + (order?.days || 7) * 86400000);

  if (tigerClient.configured) {
    // 先通过 listCardPackages 定位旧套餐绑定记录，删除旧绑定（宽容处理失败）
    try {
      const oldPkgIds: number[] = [];
      const oldTigerPkgId = targetEsim?.tigerPkgId ?? order?.tigerPkgId;
      if (oldTigerPkgId) oldPkgIds.push(Number(oldTigerPkgId));
      const all = await tigerClient.listCardPackages(targetEsim.iccid, { limit: 500 });
      const binds: any[] = all?.data?.items || all?.items || all || [];
      const targetBind = binds.find((b: any) => {
        const bid = Number(b.package_id ?? b.packageId ?? b.pkg_id ?? b.id);
        return oldPkgIds.includes(bid) || (oldPkgIds.length === 0 && !b?.current);
      });
      if (targetBind && (targetBind.pk || targetBind.id)) {
        await tigerClient.deleteCardPackage(Number(targetBind.pk || targetBind.id));
      }
    } catch (e: any) {
      console.error(`[change] 删除旧套餐绑定失败（继续绑定新套餐）：${e.message}`);
    }

    const tigerPkgId = await resolveTigerPkgId(order);
    const bindRes = await tigerClient.bindPackage(targetEsim.iccid, tigerPkgId);
    const info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    const activationCode = info?.activationCode || targetEsim.activationCode;

    return prisma.esim.update({
      where: { id: targetEsim.id },
      data: {
        gb: order?.gb || 0,
        days: order?.days || 0,
        expireAt,
        used: 0,
        activationCode,
        smdp: info?.smdp || targetEsim.smdp,
        iccid: info?.iccid || targetEsim.iccid,
        countryCode: order?.countryCode || targetEsim.countryCode,
        pkgName: order?.pkgName || targetEsim.pkgName,
        tigerPkgId: Number(order?.tigerPkgId || 0) || targetEsim.tigerPkgId,
        tigerPid: order?.tigerPid || targetEsim.tigerPid,
      },
    });
  }

  // ===== 模拟回退（未配置 Tiger）=====
  return prisma.esim.update({
    where: { id: targetEsim.id },
    data: {
      gb: order?.gb || 0,
      days: order?.days || 0,
      expireAt,
      used: 0,
      countryCode: order?.countryCode || targetEsim.countryCode,
      pkgName: order?.pkgName || targetEsim.pkgName,
      tigerPkgId: Number(order?.tigerPkgId || 0) || targetEsim.tigerPkgId,
      tigerPid: order?.tigerPid || targetEsim.tigerPid,
    },
  });
}