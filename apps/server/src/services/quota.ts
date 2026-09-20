import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Open platform v3: quota accounting (B2B credit distribution).
 * See docs/open-platform-v3-design.md §1.2 / §1.3 / §3.
 *
 * The settle price used to debit/quota is a PLACEHOLDER implementation
 * (gross-profit split) pending the final settlement-model decision (§0).
 * It must be revisited with the user before going live.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export class QuotaError extends Error {
  /** HTTP status: 400 param, 403 suspended, 409 insufficient credit, 502 upstream */
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'QuotaError';
    this.status = status;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pkgKey(pkg: any): string {
  return String(pkg?.tigerPkgId ?? pkg?.tigerPid ?? pkg?.id ?? pkg?.pkgId ?? '');
}

/**
 * Pure settle-price computation (no DB). PLACEHOLDER (pending §0):
 * W = costPrice + (platformPrice - costPrice) * (1 - splitPercent/100)
 * when a package-level costPrice is provided; otherwise W = platformPrice.
 * splitPercent = the partner's share; platform keeps the complement.
 */
export function resolveSettlePriceFrom(
  platformPrice: number,
  costPrice: number | null | undefined,
  splitPercent: number | null | undefined,
): number {
  const price = Number(platformPrice || 0);
  const cost = costPrice != null ? Number(costPrice) : null;
  const split = splitPercent != null ? Number(splitPercent) : 0;
  if (cost != null && price > cost && split >= 0 && split < 100) {
    return round2(cost + (price - cost) * (1 - split / 100));
  }
  return round2(price);
}

/**
 * Resolve the settle price W (amount debited from the partner quota) for a single
 * package. PLACEHOLDER formula (pending §0), see resolveSettlePriceFrom.
 */
export async function resolveSettlePrice(
  prisma: PrismaClient,
  pkg: any,
  subject: { id: string; splitPercent?: number | null },
): Promise<number> {
  const platformPrice = Number(pkg?.price ?? pkg?.platformPrice ?? 0);
  const key = pkgKey(pkg);
  let cost: number | null = null;
  if (key) {
    const o = await prisma.subjectPackagePrice.findUnique({
      where: { subjectId_pkgId: { subjectId: subject.id, pkgId: key } },
      select: { costPrice: true },
    });
    cost = o?.costPrice != null ? Number(o.costPrice) : null;
  }
  return resolveSettlePriceFrom(platformPrice, cost, subject.splitPercent);
}

/**
 * Batch-enrich a package list with their settle prices (one override lookup).
 * Mutates nothing; returns a Map keyed by pkgKey -> settle price W.
 */
export async function resolveSettlePricesForList(
  prisma: PrismaClient,
  list: any[],
  subject: { id: string; splitPercent?: number | null },
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!Array.isArray(list) || list.length === 0) return map;
  const keys = Array.from(new Set(list.map(pkgKey).filter(Boolean)));
  const overrides = keys.length
    ? await prisma.subjectPackagePrice.findMany({
        where: { subjectId: subject.id, pkgId: { in: keys } },
        select: { pkgId: true, costPrice: true },
      })
    : [];
  const overrideMap = new Map(overrides.map((o) => [o.pkgId, o.costPrice]));
  for (const p of list) {
    const key = pkgKey(p);
    if (!key) continue;
    const price = Number(p?.price ?? p?.platformPrice ?? 0);
    map.set(key, resolveSettlePriceFrom(price, overrideMap.get(key), subject.splitPercent));
  }
  return map;
}

export interface QuotaView {
  quotaLimit: number | null;
  usedQuota: number;
  availableQuota: number | null; // null => unlimited (no quotaLimit set)
  balance: number; // prepaid wallet balance (CNY)
  allowed: boolean;
}

export function quotaView(subject: {
  quotaLimit?: number | null;
  usedQuota?: number | null;
  balance?: number | null;
}): QuotaView {
  const limit = subject.quotaLimit != null ? Number(subject.quotaLimit) : null;
  const used = Number(subject.usedQuota ?? 0);
  const balance = Number(subject.balance ?? 0);
  const available = limit == null ? null : round2(limit - used);
  const allowed = limit == null || available! >= 0;
  return { quotaLimit: limit, usedQuota: round2(used), availableQuota: available, balance: round2(balance), allowed };
}

/**
 * Debit quota for an order inside the same transaction that creates the order.
 * Locks the Subject row (SELECT ... FOR UPDATE) to prevent concurrent overdraw.
 */
export async function lockSubject(db: Db, subjectId: string): Promise<any> {
  // Raw SELECT * returns DB column names (used_quota / quota_limit), which would
  // NOT match the Prisma camelCase field names the wallet helpers read (usedQuota /
  // quotaLimit). Alias the columns explicitly so locked rows expose the same shape
  // as the ORM Subject model.
  const rows: any[] = await db.$queryRaw`
    SELECT id, name, status, balance,
           quota_limit AS quotaLimit,
           used_quota  AS usedQuota
    FROM Subject WHERE id = ${subjectId} FOR UPDATE`;
  if (!rows.length) throw new QuotaError('主体不存在', 404);
  return rows[0];
}

/** Admin settle: partner pays off => usedQuota -= amount + settle_credit entry. */
export async function settleQuota(
  prisma: PrismaClient,
  subjectId: string,
  amount: number,
  operatorId?: string,
  note?: string,
): Promise<void> {
  if (!(amount > 0)) throw new QuotaError('结清金额必须大于 0');
  await prisma.$transaction([
    prisma.subject.update({
      where: { id: subjectId },
      data: { usedQuota: { decrement: amount } },
    }),
    prisma.subjectLedger.create({
      data: {
        subjectId,
        type: 'settle_credit',
        amount: round2(amount),
        note: note || null,
        operatorId: operatorId || null,
      },
    }),
  ]);
}

// ==================== Wallet (balance + debt) ====================
// v3 settlement is "balance first, then credit (debt)":
//   - order debit: take from BALANCE up to the settle price, overdraw the rest into DEBT.
//   - order refund / compensate: pay off DEBT first, then put leftover into BALANCE.
//   - recharge/top-up deposit: offset DEBT first, leftover into BALANCE.
// All helpers require the caller to already hold the Subject lock (see lockSubject).

export interface WalletLedgerSplit {
  balanceUsed: number; // amount actually taken from BALANCE (0 when none)
  creditUsed: number;  // amount added to DEBT (usedQuota)
}

/** Order debit: deduct BALANCE first, overdraw the remainder into DEBT. Caller wraps in tx. */
export async function debitWallet(
  db: Db,
  subject: { id: string; balance?: number; usedQuota?: number },
  amount: number,
  orderNo: string,
  note?: string,
): Promise<WalletLedgerSplit> {
  const amt = round2(amount);
  const balance = round2(Number(subject.balance ?? 0));
  const balanceUsed = round2(Math.min(balance, amt));
  const creditUsed = round2(amt - balanceUsed);

  if (balanceUsed > 0) {
    await db.subject.update({ where: { id: subject.id }, data: { balance: { decrement: balanceUsed } } });
    await db.subjectLedger.create({
      data: { subjectId: subject.id, type: 'balance_debit', orderNo, amount: balanceUsed, note: note || null },
    });
  }
  if (creditUsed > 0) {
    await db.subject.update({ where: { id: subject.id }, data: { usedQuota: { increment: creditUsed } } });
    await db.subjectLedger.create({
      data: { subjectId: subject.id, type: 'order_debit', orderNo, amount: creditUsed, note: note || null },
    });
  }
  return { balanceUsed, creditUsed };
}

/** Wallet restore (refund / provision-failure compensate): pay off DEBT first, leftover into BALANCE. */
export async function restoreWallet(
  db: Db,
  subject: { id: string; usedQuota?: number },
  amount: number,
  orderNo: string,
  refundNo?: string,
  note?: string,
): Promise<WalletLedgerSplit> {
  const amt = round2(amount);
  const debt = round2(Number(subject.usedQuota ?? 0));
  const debtOffset = round2(Math.min(debt, amt));
  const balanceBack = round2(amt - debtOffset);

  if (debtOffset > 0) {
    await db.subject.update({ where: { id: subject.id }, data: { usedQuota: { decrement: debtOffset } } });
    await db.subjectLedger.create({
      data: {
        subjectId: subject.id,
        type: 'refund_credit',
        orderNo,
        refundNo: refundNo || null,
        amount: debtOffset,
        note: note || null,
      },
    });
  }
  if (balanceBack > 0) {
    await db.subject.update({ where: { id: subject.id }, data: { balance: { increment: balanceBack } } });
    await db.subjectLedger.create({
      data: {
        subjectId: subject.id,
        type: 'balance_refund',
        orderNo,
        refundNo: refundNo || null,
        amount: balanceBack,
        note: note || null,
      },
    });
  }
  return { balanceUsed: balanceBack, creditUsed: debtOffset };
}

/**
 * Apply a recharge/deposit: offset DEBT first (usedQuota -), leftover into BALANCE (+).
 * Writes a single deposit_credit ledger entry for the full deposit amount.
 * Caller wraps in tx; subject must be the locked row.
 */
export async function applyDeposit(
  db: Db,
  subject: { id: string; usedQuota?: number },
  rechargeNo: string,
  amount: number,
  note?: string,
): Promise<WalletLedgerSplit> {
  const amt = round2(amount);
  const debt = round2(Number(subject.usedQuota ?? 0));
  const debtOffset = round2(Math.min(debt, amt));
  const balanceBack = round2(amt - debtOffset);

  if (debtOffset > 0) {
    await db.subject.update({ where: { id: subject.id }, data: { usedQuota: { decrement: debtOffset } } });
  }
  if (balanceBack > 0) {
    await db.subject.update({ where: { id: subject.id }, data: { balance: { increment: balanceBack } } });
  }
  await db.subjectLedger.create({
    data: { subjectId: subject.id, type: 'deposit_credit', rechargeNo: rechargeNo || null, amount: amt, note: note || null },
  });
  return { balanceUsed: balanceBack, creditUsed: debtOffset };
}

/**
 * Whether the subject may place an order of settle price W under the current wallet
 * state. After taking BALANCE first, the resulting DEBT must not exceed quotaLimit.
 * quotaLimit == null means unlimited debt is allowed.
 */
export function canPlaceOrder(
  subject: { quotaLimit?: number | null; usedQuota?: number | null; balance?: number | null },
  amount: number,
): boolean {
  const limit = subject.quotaLimit != null ? Number(subject.quotaLimit) : null;
  const used = round2(Number(subject.usedQuota ?? 0));
  const balance = round2(Number(subject.balance ?? 0));
  const newDebt = round2(used + Math.max(0, round2(amount) - balance));
  return limit == null || newDebt <= round2(limit);
}

/** Admin manual adjustment: signed amount (+/-) applied to usedQuota + adjust entry (abs). */
export async function adjustQuota(
  prisma: PrismaClient,
  subjectId: string,
  signedAmount: number,
  operatorId?: string,
  reason?: string,
): Promise<void> {
  if (!signedAmount || !Number.isFinite(signedAmount)) throw new QuotaError('调整金额无效');
  await prisma.$transaction([
    prisma.subject.update({
      where: { id: subjectId },
      data: { usedQuota: { increment: signedAmount } },
    }),
    prisma.subjectLedger.create({
      data: {
        subjectId,
        type: 'adjust',
        amount: round2(Math.abs(signedAmount)),
        note: `${reason ? reason + '；' : ''}增减:${round2(signedAmount)}`,
        operatorId: operatorId || null,
      },
    }),
  ]);
}