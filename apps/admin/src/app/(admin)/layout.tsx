'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { getToken, LOGIN_PATH } from '@/lib/auth';

/**
 * 后台路由守卫：所有后台页面共用此布局，未带 token 一律跳转登录页。
 * 后台是纯静态导出（output: 'export'），只能在客户端判断登录态。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = LOGIN_PATH;
      return;
    }
    setChecked(true);
  }, []);

  // 校验通过前不渲染，避免未授权内容闪现
  if (!checked) return null;

  return <AppShell>{children}</AppShell>;
}
