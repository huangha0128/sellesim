import { prisma } from '../db';

/**
 * 白名单：一行记录 = 一个「已添加」的套餐。
 * - price 非空 = 已添加进白名单（保留展示，用自定价）
 * - onSale = false = 停售（仍在白名单但前端隐藏）
 * - 无记录 / price 为空 = 未添加，直接剔除（Tiger 全量中的其它套餐不可见）
 * - currency = 后台定价时的货币单位（'CNY' | 'USD'），用于按汇率换算成展示货币
 */
export interface WhitelistEntry {
  price: number;
  onSale: boolean;
  currency: string;
}

/** 全局展示配置：展示货币 + USD⇄CNY 汇率 */
export interface DisplayConfig {
  displayCurrency: 'CNY' | 'USD';
  usdCnyRate: number;
}

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  displayCurrency: 'CNY',
  usdCnyRate: 7,
};

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
    map.set(r.tigerPkgId, { price: r.price, onSale: r.onSale, currency: r.currency || 'CNY' });
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
    out.push({ ...p, price: entry.price, onSale: entry.onSale, currency: entry.currency, originalPrice: undefined });
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

// ---------------------------------------------------------------------------
// 展示货币换算
// ---------------------------------------------------------------------------

// In-process cache of the global display config (short TTL, invalidated on write).
let settingsCache: { cfg: DisplayConfig; at: number } | null = null;
const SETTINGS_TTL_MS = 60_000;

/** Read the global display config from the Setting table (cached). */
export async function readDisplayConfig(): Promise<DisplayConfig> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.cfg;
  }
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['displayCurrency', 'usdCnyRate'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const cfg: DisplayConfig = {
    displayCurrency: map.get('displayCurrency') === 'USD' ? 'USD' : 'CNY',
    usdCnyRate: Number(map.get('usdCnyRate') || DEFAULT_DISPLAY_CONFIG.usdCnyRate),
  };
  if (!(cfg.usdCnyRate > 0)) cfg.usdCnyRate = DEFAULT_DISPLAY_CONFIG.usdCnyRate;
  settingsCache = { cfg, at: Date.now() };
  return settingsCache.cfg;
}

/** Invalidate the in-process display config cache (call after any admin write). */
export function clearSettingsCache(): void {
  settingsCache = null;
}

/**
 * Pure currency conversion onto view items.
 * - item.currency is the currency the price *was stored* in.
 * - If item.currency === displayCurrency -> price unchanged.
 * - Else displayCurrency 'USD' -> price / rate ; 'CNY' -> price * rate.
 * - Always sets item.currency = displayCurrency so the frontend renders the right symbol.
 * No DB access - testable in isolation.
 */
export function applyDisplayCurrencyToItems(items: any[], cfg: DisplayConfig): any[] {
  if (!Array.isArray(items)) return [];
  const { displayCurrency, usdCnyRate } = cfg;
  const rate = usdCnyRate > 0 ? usdCnyRate : DEFAULT_DISPLAY_CONFIG.usdCnyRate;
  return items.map((p) => {
    const stored = (p.currency || 'CNY') === 'USD' ? 'USD' : 'CNY';
    let price = Number(p.price);
    if (stored !== displayCurrency) {
      price = displayCurrency === 'USD' ? price / rate : price * rate;
    }
    const rounded = Math.round(price * 100) / 100;
    return { ...p, price: rounded, currency: displayCurrency };
  });
}

/** Read config + convert a list of view items in one call. */
export async function applyDisplayCurrency(items: any[]): Promise<any[]> {
  if (!Array.isArray(items) || items.length === 0) return items;
  const cfg = await readDisplayConfig();
  return applyDisplayCurrencyToItems(items, cfg);
}