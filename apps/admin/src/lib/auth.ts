// 管理后台登录态：token 存 localStorage（后台为 output:export 纯静态站，只能客户端鉴权）
const TOKEN_KEY = 'yyesim_admin_token';
const ADMIN_KEY = 'yyesim_admin_info';

/** 登录页地址。basePath 为 /backend 且 trailingSlash=true，故以斜杠结尾 */
export const LOGIN_PATH = '/backend/login/';
/** 登录成功后的落地页 */
export const HOME_PATH = '/backend/dashboard/';

export interface AdminInfo {
  id: string;
  username: string;
  name: string | null;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getAdmin(): AdminInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminInfo;
  } catch {
    return null;
  }
}

export function setAdmin(admin: AdminInfo): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

/** 退出登录：清空本地凭据并跳转登录页 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_KEY);
}
