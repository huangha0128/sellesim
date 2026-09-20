'use client';

import { useEffect } from 'react';
import { getToken, HOME_PATH, LOGIN_PATH } from '@/lib/auth';

/** 门户首页：无 token 跳登录页，有 token 跳总览 */
export default function IndexPage() {
  useEffect(() => {
    if (getToken()) {
      window.location.href = HOME_PATH;
    } else {
      window.location.href = LOGIN_PATH;
    }
  }, []);

  return null;
}