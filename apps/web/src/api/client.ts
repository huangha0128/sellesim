// 后端 API 封装：BASE 为空即同源（开发走 Vite proxy → :6660，生产经 Caddy /api 反代）
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}