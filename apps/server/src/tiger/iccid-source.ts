import { tigerClient, type TigerClient } from './client';

/** 从 Tiger 卡片对象中规范化出其 ICCID */
export function iccidOf(card: any): string {
  return String(card?.iccid || card?.iccid_number || '').trim();
}

/** 从 Tiger `GET /api/card` 实时拉取全部可用卡片 ICCID（去重）；未配置 Tiger 时返回空数组 */
export async function fetchTigerIccids(client: TigerClient = tigerClient): Promise<string[]> {
  if (!client.configured) return [];
  const cards = await client.listAllCards();
  const seen = new Set<string>();
  for (const c of cards) {
    const i = iccidOf(c);
    if (i) seen.add(i);
  }
  return Array.from(seen);
}