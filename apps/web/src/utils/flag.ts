/** 国旗图片的可靠解析与降级（优先 API 提供的有效图标，其次 ISO flagcdn，最后品牌色占位） */

/** 品牌色占位国旗（非 ISO2 码或无图标的区域，如 GLOBAL/ASIA） */
export function flagPlaceholder(code: string): string {
  const text = (code || '?').slice(0, 4).toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><rect width="96" height="72" ` +
    `fill="#f0f3ff" rx="8"/><text x="48" y="46" font-family="sans-serif" font-size="26" ` +
    `font-weight="700" fill="#4050c0" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 是否为可用 flagcdn 的 ISO2 小写码 */
export function isoFlagUrl(code: string): string | null {
  const c = (code || '').toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? `https://flagcdn.com/${c.toLowerCase()}.png` : null;
}

/** 计算国旗最佳展示地址 */
export function resolveFlag(code: string, flag: string): string {
  if (/^https?:\/\//i.test(flag)) return flag;
  return isoFlagUrl(code) || flagPlaceholder(code);
}

/** img 加载失败时逐级降级：ISO flagcdn → 品牌占位 */
export function onFlagError(code: string, event: Event): void {
  const target = event.currentTarget as HTMLImageElement;
  if (!target || target.src.startsWith('data:')) return; // 已是占位，停止
  const iso = isoFlagUrl(code);
  if (iso) {
    target.src = iso;
    return;
  }
  target.src = flagPlaceholder(code);
}