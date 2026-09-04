import { prisma } from '../db';

/**
 * 白名单：一行记录 = 一个「已添加」的套餐。
 * - price 非空 = 已添加进白名单（保留展示，用自定价）
 * - onSale = false = 停售（仍在白名单但前端隐藏）
 * - 无记录 / price 为空 = 未添加，直接剔除（Tiger 全量中的其它套餐不可见）
 */
export interface WhitelistEntry {
  price: number;
  onSale: boolean;
}

export type WhitelistMap = Map<number, WhitelistEntry>;

// In-process cache of the whitelist table with a short TTL.
// Invalidation (clearWhitelistCache) is triggered right after any admin write,
// so price changes take effect on the very next view read.
let whitelistCache: { map: WhitelistMap; at: number } | null = null;
const WHITELIST_TTL_MS = 60_000;

async function loadWhitelistMap(): Promise<WhitelistMap> {
  if (whitelistCache && Date.now() - whitelistCache.at < WHITELIST_TTL_MS) {
    return whitelistCache.map;
  }
  const rows = await prisma.packagePrice.findMany({ where: { price: { not: null } } });
  const map: WhitelistMap = new Map();
  for (const r of rows) {
    if (r.price == null) continue;
    map.set(r.tigerPkgId, { price: r.price, onSale: r.onSale });
  }
  whitelistCache = { map, at: Date.now() };
  return whitelistCache.map;
}

/** Invalidate the in-process whitelist cache (call after any admin write). */
export function clearWhitelistCache(): void {
  whitelistCache = null;
}

/**
 * Pure whitelist filtering onto tiger package views.
 * No DB access - testable in isolation.
 * - Returns only packages that are whitelisted (have a local price).
 * - price: replaced by the local whitelist price.
 * - onSale: kept from the whitelist entry (default true).
 */
export function applyWhitelistToItems(list: any[], map: WhitelistMap): any[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  const out: any[] = [];
  for (const p of list) {
    // Whitelist only applies to tiger-linked packages.
    const id = p.tigerPkgId != null ? Number(p.tigerPkgId) : NaN;
    const entry = map.get(id);
    if (!entry) continue; // not added -> hidden
    out.push({ ...p, price: entry.price, onSale: entry.onSale, originalPrice: undefined });
  }
  return out;
}

/**
 * Merge the local whitelist into tiger package views.
 * - returns only whitelisted packages
 * - price: replaced by the local whitelist price
 * - onSale: kept from the whitelist entry
 */
export async function applyWhitelist(list: any[]): Promise<any[]> {
  if (!Array.isArray(list) || list.length === 0) return [];
  const map = await loadWhitelistMap();
  return applyWhitelistToItems(list, map);
}