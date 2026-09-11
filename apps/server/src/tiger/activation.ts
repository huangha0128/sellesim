import { tigerClient } from './client';

/**
 * Resolve the card package state from Tiger in real time.
 * A pooled ICCID may contain several bindings for the same package, so prefer
 * the binding that Tiger currently reports as activated instead of the first match.
 */
const PENDING_LIKE = new Set([
  'pending',
  'not_activated',
  'notactivated',
  'inactive',
  'unused',
  'never_activated',
]);

function statusOf(item: any): string {
  return String(item?.status ?? '').trim().toLowerCase();
}

function isPendingLike(item: any): boolean {
  const status = statusOf(item);
  return !status || PENDING_LIKE.has(status);
}

function toDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bindingPriority(item: any): number {
  const status = statusOf(item);
  if (status === 'activated') return 3;
  if (status === 'used') return 2;
  if (status === 'expired') return 1;
  return 0;
}

function collectPkgIds(item: any): string[] {
  const ids = new Set<string>();
  const push = (...values: any[]) => {
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      ids.add(String(value));
    }
  };
  const pkg = item?.package && typeof item.package === 'object' ? item.package : item;
  push(pkg?.id, pkg?.pid, pkg?.package_id, pkg?.tiger_pkg_id, item?.package_id, item?.id);
  return [...ids];
}

export interface ActivationSource {
  iccid: string;
  status: string;
  expireAt?: Date | string | null;
  tigerPkgId?: number | null;
  tigerPid?: string | null;
  tigerBindingId?: number | null;
}

export interface ResolvedEsimActivation {
  status: string;
  activatedAt: Date | null;
  expireAt: Date;
  used: number;
}

export async function resolveEsimActivation(
  esim: ActivationSource,
): Promise<ResolvedEsimActivation | null> {
  if (!tigerClient.configured) return null;

  const targetIds = new Set<string>();
  if (esim.tigerPkgId) targetIds.add(String(esim.tigerPkgId));
  if (esim.tigerPid) targetIds.add(String(esim.tigerPid));
  if (targetIds.size === 0) return null;

  try {
    const res = await tigerClient.listCardPackages(esim.iccid, { limit: 500 });
    const data = res?.data || res || {};
    const items: any[] = data.items || [];
    const matching = esim.tigerBindingId
      ? items.filter((item) => Number(item?.id) === Number(esim.tigerBindingId))
      : items.filter((item) =>
          collectPkgIds(item).some((id) => targetIds.has(id)),
        );

    const best = matching
      .slice()
      .sort((left, right) => {
        const byStatus = bindingPriority(right) - bindingPriority(left);
        if (byStatus !== 0) return byStatus;
        const leftAt = toDate(left?.updated_at || left?.activated_at)?.getTime() || 0;
        const rightAt = toDate(right?.updated_at || right?.activated_at)?.getTime() || 0;
        return rightAt - leftAt;
      })
      .at(0);
    if (!best) return null;

    const usageMb = Number(best.usage || 0);
    return {
      status: isPendingLike(best) ? 'pending' : 'activated',
      activatedAt: toDate(best.activated_at || best.activatedAt),
      expireAt: toDate(best.expired_at || best.expiredAt) || new Date(esim.expireAt ?? Date.now()),
      used: Number.isFinite(usageMb) ? usageMb / 1024 : 0,
    };
  } catch {
    return null;
  }
}

export async function resolveEsimActivationStatus(esim: ActivationSource): Promise<string> {
  return (await resolveEsimActivation(esim))?.status || esim.status;
}
