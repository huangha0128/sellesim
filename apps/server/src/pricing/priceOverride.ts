import { prisma } from '../db';

export interface PriceOverride {
  price?: number | null;
  onSale: boolean;
}

export type OverrideMap = Map<number, PriceOverride>;

// In-process cache of the override table with a short TTL.
// Invalidation (clearOverrideCache) is triggered right after any admin write,
// so price changes take effect on the very next view read.
let overrideCache: { map: OverrideMap; at: number } | null = null;
const OVERRIDE_TTL_MS = 60_000;

async function loadOverrideMap(): Promise<OverrideMap> {
  if (overrideCache && Date.now() - overrideCache.at < OVERRIDE_TTL_MS) {
    return overrideCache.map;
  }
  const rows = await prisma.packagePrice.findMany();
  const map: OverrideMap = new Map();
  for (const r of rows) {
    map.set(r.tigerPkgId, { price: r.price, onSale: r.onSale });
  }
  overrideCache = { map, at: Date.now() };
  return overrideCache.map;
}

/** Invalidate the in-process override cache (call after any admin write). */
export function clearOverrideCache(): void {
  overrideCache = null;
}

/**
 * Pure mapping of local pricing overrides onto tiger package views.
 * No DB access - testable in isolation.
 * - price: replaced by the local price when the row has a non-null price
 * - originalPrice: always set to the tiger price before any override
 * - onSale: false hides the package from public endpoints
 */
export function applyOverridesToItems(list: any[], map: OverrideMap): any[] {
  if (!Array.isArray(list) || list.length === 0) return list;
  return list.map((p) => {
    // Overrides only apply to tiger-linked packages; local-only packages are untouched.
    const id = p.tigerPkgId != null ? Number(p.tigerPkgId) : NaN;
    const ov = map.get(id);
    const originalPrice = p.price;
    const price = ov && ov.price != null ? ov.price : p.price;
    const onSale = ov ? ov.onSale : true;
    return { ...p, originalPrice, price, onSale };
  });
}

/**
 * Merge local pricing overrides into tiger package views.
 * - price: replaced by the local price when the row has a non-null price
 * - originalPrice: always set to the tiger price before any override
 * - onSale: false hides the package from public endpoints
 */
export async function applyOverrides(list: any[]): Promise<any[]> {
  if (!Array.isArray(list) || list.length === 0) return list;
  const map = await loadOverrideMap();
  return applyOverridesToItems(list, map);
}