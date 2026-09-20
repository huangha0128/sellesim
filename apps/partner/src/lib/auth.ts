// 伙伴门户登录态：token 存 localStorage（output:export 纯静态站，只能客户端鉴权）
const TOKEN_KEY = 'partner_token';
const SUBJECT_KEY = 'partner_subject';

/** 登录页地址。basePath 为 /partner 且 trailingSlash=true，故以斜杠结尾 */
export const LOGIN_PATH = '/partner/login/';
/** 登录成功后的落地页 */
export const HOME_PATH = '/partner/dashboard/';

export interface SubjectInfo {
  id: string;
  name: string;
  status: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getSubject(): SubjectInfo | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SUBJECT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubjectInfo;
  } catch {
    return null;
  }
}

export function setSubject(sub: SubjectInfo): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUBJECT_KEY, JSON.stringify(sub));
}

/** 退出登录：清空本地凭据并跳转登录页 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SUBJECT_KEY);
}