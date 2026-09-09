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

/**
 * 续费（当前套餐到期后，为同一张卡继续购买新套餐）：
 * - 仅允许目标 eSIM 的当前套餐已过期（expireAt < now）时执行
 * - Tiger 场景：对同一 ICCID 调用 bindPackage 绑定新套餐
 * - 本地展示：同一张 eSIM 替换为新套餐信息（流量/天数/到期时间重置、已用量清零），
 *   若绑定返回新激活码/ICCID 则一并更新（同卡一般保持不变，无需重新扫码）
 */
export async function renewEsim(
  prisma: PrismaClient,
  order: any,
  targetEsim: any,
): Promise<any> {
  const now = Date.now();
  if (!targetEsim?.expireAt || new Date(targetEsim.expireAt).getTime() > now) {
    throw new Error('当前套餐尚未到期，到期后才能为该卡续费购买新套餐');
  }
  const expireAt = new Date(now + (order?.days || 7) * 86400000);

  if (tigerClient.configured) {
    const tigerPkgId = await resolveTigerPkgId(order);
    const bindRes = await tigerClient.bindPackage(targetEsim.iccid, tigerPkgId);
    const info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    const activationCode = info?.activationCode || targetEsim.activationCode;

    return prisma.esim.update({
      where: { id: targetEsim.id },
      data: {
        gb: order?.gb || 0,
        days: order?.days || 0,
        isUnlimited: !!order?.isUnlimited,
        expireAt,
        used: 0,
        activationCode,
        smdp: info?.smdp || targetEsim.smdp,
        iccid: info?.iccid || targetEsim.iccid,
        countryCode: order?.countryCode || targetEsim.countryCode,
        pkgName: order?.pkgName || targetEsim.pkgName,
        pkgNameEn: order?.pkgNameEn || targetEsim.pkgNameEn,
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
      isUnlimited: !!order?.isUnlimited,
      expireAt,
      used: 0,
      countryCode: order?.countryCode || targetEsim.countryCode,
      pkgName: order?.pkgName || targetEsim.pkgName,
      pkgNameEn: order?.pkgNameEn || targetEsim.pkgNameEn,
      tigerPkgId: Number(order?.tigerPkgId || 0) || targetEsim.tigerPkgId,
      tigerPid: order?.tigerPid || targetEsim.tigerPid,
    },
  });
}