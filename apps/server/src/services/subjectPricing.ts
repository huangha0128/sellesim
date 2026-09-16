import { PrismaClient } from '@prisma/client';

/**
 * Open platform v2: per-subject price resolution.
 *
 * A subject can override the platform price for a package (SubjectPackagePrice)
 * or provide a default markup percent (Subject.defaultMarkupPercent). When there
 * is no override the platform price (Posting after whitelist + display-currency
 * conversion, i.e. what getPackageView() returns) is used as-is.
 *
 * Resolution order (see docs/open-api-design.md §5):
 *   1. SubjectPackagePrice(subjectId, pkgId) matched, enabled=false   -> hidden
 *   2. matched, price != null        -> fixed price
 *   3. matched, markupPercent != null-> platform price x (1 + markup/100)
 *   4. no match, subject.defaultMarkupPercent != null
 *                                     -> platform price x (1 + default/100)
 *   5. otherwise                     -> platform price
 *   6. round to 2 decimals
 */

export interface SubjectPriceResult {
  /** Whether the package is visible to the subject */
  visible: boolean;
  /** The subject's selling price (display currency, 2 decimals) */
  price: number;
  /** Platform price before any subject markup */
  platformPrice: number;
  /** Applied markup percent, or null when none applied */
  markupPercent: number | null;
}

/** Pure logic (no DB): pick the key a subject price row is stored under. */
function pkgKey(pkg: any): string {
  // pkgId on SubjectPackagePrice is the Tiger package id (tigerPkgId), matching
  // the existing PackagePrice whitelist which keys on tigerPkgId.
  if (pkg.tigerPkgId != null) return String(pkg.tigerPkgId);
  if (pkg.tigerPid) return String(pkg.tigerPid);
  return String(pkg.id ?? pkg.pkgId ?? '');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pure logic (no DB): resolve price/visibility against one override entry. */
export function resolvePriceFrom(
  pkg: any,
  override: {
    enabled?: boolean;
    price?: number | null;
    markupPercent?: number | null;
  } | null,
  defaultMarkupPercent?: number | null,
): SubjectPriceResult {
  const platformPrice = Number(pkg.price ?? 0);

  if (override && override.enabled === false) {
    return { visible: false, price: 0, platformPrice, markupPercent: null };
  }

  if (override && override.price != null) {
    return { visible: true, price: round2(Number(override.price)), platformPrice, markupPercent: null };
  }

  let markup: number | null = null;
  if (override && override.markupPercent != null) markup = Number(override.markupPercent);
  else if (defaultMarkupPercent != null) markup = Number(defaultMarkupPercent);

  const price = markup != null ? round2(platformPrice * (1 + markup / 100)) : platformPrice;
  return { visible: true, price, platformPrice, markupPercent: markup };
}

/** Resolve a single package's price for a subject (DB load). */
export async function resolveSubjectPrice(
  prisma: PrismaClient,
  pkg: any,
  subject: { id: string; defaultMarkupPercent?: number | null },
): Promise<SubjectPriceResult> {
  const key = pkgKey(pkg);
  if (!key) return { visible: true, price: Number(pkg.price ?? 0), platformPrice: Number(pkg.price ?? 0), markupPercent: null };
  const override = await prisma.subjectPackagePrice.findUnique({
    where: { subjectId_pkgId: { subjectId: subject.id, pkgId: key } },
  });
  return resolvePriceFrom(pkg, override, subject.defaultMarkupPercent);
}

/**
 * Apply subject pricing to a package list in one DB lookup:
 * - drops packages hidden from the subject (enabled=false)
 * - overrides price with the subject's selling price
 * - keeps the platform display currency on each item
 */
export async function applySubjectPrices(
  prisma: PrismaClient,
  list: any[],
  subject: { id: string; defaultMarkupPercent?: number | null },
): Promise<any[]> {
  if (!Array.isArray(list) || list.length === 0) return [];

  const keys = Array.from(new Set(list.map(pkgKey).filter(Boolean)));
  const overrides = keys.length
    ? await prisma.subjectPackagePrice.findMany({ where: { subjectId: subject.id, pkgId: { in: keys } } })
    : [];
  const overrideMap = new Map(overrides.map((o) => [o.pkgId, o]));

  const out: any[] = [];
  for (const pkg of list) {
    const override = overrideMap.get(pkgKey(pkg)) || null;
    const r = resolvePriceFrom(pkg, override, subject.defaultMarkupPercent);
    if (!r.visible) continue;
    out.push({ ...pkg, price: r.price, platformPrice: r.platformPrice, markupPercent: r.markupPercent });
  }
  return out;
}