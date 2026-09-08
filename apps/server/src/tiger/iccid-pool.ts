import { PrismaClient } from '@prisma/client';

/**
 * 本地 ICCID 卡片池。
 * 卡片来源分两部分：
 * 1. 数据库 card 表（推荐）——后台「卡片管理」页面维护，新增卡片即时生效、无需重启；
 * 2. 环境变量 TIGER_ICCIDS（兼容旧配置）——逗号分隔，作为兜底。
 * 每笔订单取一张未使用的卡绑定套餐；esim 表记录即「已使用」标记，
 * 退款删除 esim 后对应 ICCID 自动回归可用。
 */

/** 从环境变量 TIGER_ICCIDS 读取的卡片列表（旧配置兜底） */
function envPool(): string[] {
  const raw = process.env.TIGER_ICCIDS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** 合并环境变量与数据库卡片并去重 */
export function cardPool(envIds: string[], dbIccids: string[]): string[] {
  return Array.from(new Set([...envIds, ...dbIccids]));
}

/** Tiger 卡片拉取函数签名（由调用方注入，避免本模块依赖 tigerClient 而影响单测） */
export type IccidFetcher = () => Promise<string[]>;

/**
 * 解析完整卡片池（去重）：优先使用调用方注入的 Tiger 拉取函数（有值时以其为准），
 * 否则回退到环境变量 + 数据库本地卡片池。
 */
async function resolvePool(prisma: PrismaClient, fetcher?: IccidFetcher): Promise<string[]> {
  if (fetcher) {
    const ids = await fetcher();
    if (ids.length) return ids; // Tiger 有卡则以其为准
    // Tiger 未返回卡片时回退本地兜底
  }
  const dbCards = await prisma.card.findMany({ select: { iccid: true } });
  return cardPool(envPool(), dbCards.map((c) => c.iccid));
}

/** 从数据库与环境变量获取完整卡片池（去重） */
export async function getIccidPool(prisma: PrismaClient, fetcher?: IccidFetcher): Promise<string[]> {
  return resolvePool(prisma, fetcher);
}

/** 卡片池中的卡片总数（去重） */
export async function iccidPoolCount(prisma: PrismaClient, fetcher?: IccidFetcher): Promise<number> {
  return (await resolvePool(prisma, fetcher)).length;
}

/** 取一张尚未在本地 esim 表中使用过的 ICCID；池子为空或无可用卡时返回 null */
export async function getAvailableIccid(prisma: PrismaClient, fetcher?: IccidFetcher): Promise<string | null> {
  const ids = await resolvePool(prisma, fetcher);
  if (ids.length === 0) return null;
  const used = new Set((await prisma.esim.findMany({ select: { iccid: true } })).map((e) => e.iccid));
  return ids.find((i) => !used.has(i)) || null;
}
