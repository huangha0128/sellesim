import { PrismaClient } from '@prisma/client';
import { tigerClient } from '../tiger';
import type { ProvisionResult } from './provision';

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
      `未找到与套餐「${order?.countryCode} ${order?.gb || 0}GB/${order?.days || 0}天」匹配的 Tiger 套餐，请先在后台同步套餐映射`,
    );
  }
  return Number(matched.pid || matched.id);
}
function tigerBindingId(res: any): number | undefined {
  const raw = res?.data?.id ?? res?.id;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/**
 * Bind another package to the user's existing ICCID and return a new package record.
 * The old Esim row is kept so purchased-package history and Tiger binding states stay separate.
 */
export async function renewEsim(
  prisma: PrismaClient,
  order: any,
  targetEsim: any,
): Promise<ProvisionResult> {
  const now = Date.now();
  if (!targetEsim?.expireAt || new Date(targetEsim.expireAt).getTime() > now) {
    throw new Error('当前套餐尚未到期，到期后才能为该卡续费购买新套餐');
  }
  const expireAt = new Date(now + (order?.days || 7) * 86400000);
  const base = {
    orderId: order.id,
    activationCode: '',
    iccid: targetEsim.iccid,
    smdp: targetEsim.smdp,
    status: 'pending',
    expireAt,
    gb: Number(order?.gb || 0),
    days: Number(order?.days || 7),
    isUnlimited: !!order?.isUnlimited,
    countryCode: order?.countryCode || targetEsim.countryCode,
    pkgName: order?.pkgName || targetEsim.pkgName,
    pkgNameEn: order?.pkgNameEn || targetEsim.pkgNameEn,
    tigerPkgId: Number(order?.tigerPkgId || 0) || targetEsim.tigerPkgId,
    tigerPid: order?.tigerPid || targetEsim.tigerPid,
  };

  if (!tigerClient.configured) return base;

  const tigerPkgId = await resolveTigerPkgId(order);
  const bindRes = await tigerClient.bindPackage(targetEsim.iccid, tigerPkgId);
  const bindingId = tigerBindingId(bindRes);
  return {
    ...base,
    tigerPkgId,
    ...(bindingId ? { tigerBindingId: bindingId } : {}),
  };
}
