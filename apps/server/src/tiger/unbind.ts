import { tigerClient } from './client';

/**
 * 退款释放 eSIM 前，将 ICCID 在 Tiger 侧已绑定的套餐逐个解绑。
 * 关键背景：若只删本地 esim 记录（ICCID 回到卡池），Tiger 端该卡仍保留旧套餐绑定，
 * 翻卡重绑时会残留旧套餐/旧到期状态。
 * 任何失败仅告警，不阻断退款主流程。
 */
export async function unbindTigerPackages(
  esim: { iccid?: string | null } | null | undefined,
): Promise<void> {
  if (!esim?.iccid || !tigerClient.configured) return;
  try {
    const res = await tigerClient.listCardPackages(esim.iccid, { limit: 500 });
    const data = res?.data || res || {};
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    for (const it of items) {
      const pk = Number(it.id ?? it.pk);
      if (!Number.isInteger(pk) || pk <= 0) continue;
      await tigerClient.deleteCardPackage(pk);
      console.log(`[tiger] 退款解绑套餐：iccid=${esim.iccid} pk=${pk}`);
    }
  } catch (e: any) {
    console.warn(`[tiger] 退款解绑套餐失败（iccid=${esim.iccid}）：${e?.message || e}`);
  }
}

/**
 * 按绑定 pk 精确回滚单条套餐绑定（下发取码失败后调用）。
 * 与 unbindTigerPackages（清空整卡）不同，这里只删本次下发生成的那条绑定，
 * 避免误删卡上其他套餐；pk 未知时仅告警，交由人工处理。
 */
export async function rollbackTigerBinding(
  bindingId: number | undefined,
  iccid: string,
): Promise<void> {
  if (!tigerClient.configured) return;
  if (!bindingId || bindingId <= 0) {
    console.warn(`[tiger] 绑定 pk 未知，无法自动回滚（iccid=${iccid}），请到 Tiger 后台人工检查残留套餐`);
    return;
  }
  try {
    await tigerClient.deleteCardPackage(bindingId);
    console.log(`[tiger] 已回滚下发绑定：iccid=${iccid} pk=${bindingId}`);
  } catch (e: any) {
    console.warn(`[tiger] 回滚下发绑定失败（iccid=${iccid} pk=${bindingId}）：${e?.message || e}`);
  }
}