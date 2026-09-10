import { tigerClient } from './client';

/**
 * 实时解析 eSIM 的「套餐激活状态」。
 *
 * 本地 esim.status 在下发时固定为 pending，只有手点「标记已激活」才会翻转为 activated，
 * 并不反映真实激活情况。这里改为从 Tiger `GET /api/card/package?iccid=` 查询该 ICCID
 * 已绑定的套餐列表，按 tigerPkgId / tigerPid 匹配出当前套餐，读取其激活状态：
 *   - 找到匹配套餐且未被激活（status 为 pending/未激活/空）→ 'pending'（待激活）
 *   - 找到匹配套餐且已激活（有激活时间/使用记录等非 pending 状态）→ 'activated'
 *   - 未匹配到套餐、Tiger 未配置、或查询失败 → 静默回退本地 esim.status，不改变现有行为
 */
const PENDING_LIKE = new Set(['pending', 'not_activated', 'notactivated', 'inactive', 'unused', 'never_activated']);

function isPendingLike(raw: any): boolean {
  const s = String(raw?.status ?? '').trim().toLowerCase();
  if (!s) return true;
  return PENDING_LIKE.has(s);
}

/** 从一条卡套餐记录中收集可能与 tigerPkgId / tigerPid 匹配的套餐 id 集合 */
function collectPkgIds(item: any): string[] {
  const ids = new Set<string>();
  const push = (...vals: any[]) => {
    for (const v of vals) {
      if (v === undefined || v === null || v === '') continue;
      ids.add(String(v));
    }
  };
  const p = item?.package && typeof item.package === 'object' ? item.package : item;
  push(p?.id, p?.pid, p?.package_id, p?.tiger_pkg_id, item?.package_id, item?.id);
  return Array.from(ids);
}

export interface ActivationSource {
  iccid: string;
  status: string;
  tigerPkgId?: number | null;
  tigerPid?: string | null;
}

export async function resolveEsimActivationStatus(esim: ActivationSource): Promise<string> {
  if (!tigerClient.configured) return esim.status;
  const targetIds = new Set<string>();
  if (esim.tigerPkgId) targetIds.add(String(esim.tigerPkgId));
  if (esim.tigerPid) targetIds.add(String(esim.tigerPid));
  if (targetIds.size === 0) return esim.status;

  try {
    const res = await tigerClient.listCardPackages(esim.iccid);
    const data = res?.data || res || {};
    const items: any[] = data.items || [];
    // 卡片上已存在该套餐绑定：以状态判定激活与否
    const best = items.find((it) =>
      collectPkgIds(it).some((id) => targetIds.has(id)),
    );
    if (best) {
      return isPendingLike(best) ? 'pending' : 'activated';
    }
    // 老数据可能没有记录 id 匹配；若该卡只有一条在绑套餐，则直接看它状态
    if (items.length === 1) {
      return isPendingLike(items[0]) ? 'pending' : 'activated';
    }
    return esim.status;
  } catch {
    // Tiger 查询失败静默降级为本地状态
    return esim.status;
  }
}