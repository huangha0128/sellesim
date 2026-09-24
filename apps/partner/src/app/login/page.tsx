'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getErrorMessage } from '@/lib/api';
import { HOME_PATH, getToken, setSubject, setToken } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 已登录则直接进入门户，避免重复登录
  useEffect(() => {
    if (getToken()) window.location.href = HOME_PATH;
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名与密码');
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      setToken(data.token);
      if (data.subject) setSubject(data.subject);
      window.location.href = HOME_PATH;
    } catch (e) {
      setError(getErrorMessage(e, '登录失败，请检查账号密码或网络'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-canvas flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm panel-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">YYeSim 伙伴门户</CardTitle>
          <CardDescription>请使用平台分配的用户名与密码登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </Button>
            <p className="text-[11.5px] text-muted-foreground">
              初始账号由平台在后台分配，登录后可在个人中心修改密码；忘记密码请联系平台重置。
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
