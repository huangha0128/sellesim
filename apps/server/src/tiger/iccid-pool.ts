import { PrismaClient } from '@prisma/client';

/**
 * 本地 ICCID 卡片池。
 * 真实场景下，这些卡片（ICCID）是向 Tiger 采购的实体/虚拟卡，
 * 通过环境变量 TIGER_ICCIDS（逗号分隔）配置；每笔订单取一张未使用的卡绑定套餐。
 */
function pool(): string[] {
  const raw = process.env.TIGER_ICCIDS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** 卡片池中可用的卡片数量 */
export function iccidPoolCount(): number {
  return pool().length;
}

/** 取一张尚未在本地 esim 表中使用过的 ICCID；池子为空或无可用卡时返回 null */
export async function getAvailableIccid(prisma: PrismaClient): Promise<string | null> {
  const ids = pool();
  if (ids.length === 0) return null;
  const used = new Set((await prisma.esim.findMany({ select: { iccid: true } })).map((e) => e.iccid));
  return ids.find((i) => !used.has(i)) || null;
}
