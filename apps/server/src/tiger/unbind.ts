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