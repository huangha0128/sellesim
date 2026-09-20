import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 复制文本到剪贴板，返回是否成功 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 兼容非安全上下文
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

/** 格式化金额：保留两位小数 */
export function fmtMoney(n?: number | string | null): string {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

/** 通用日期格式化 */
export function fmtDate(dt?: string | null): string {
  if (!dt) return '-';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}