'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getErrorMessage } from '@/lib/api';
import { HOME_PATH, getToken, setSubject, setToken } from '@/lib/auth';

export default function LoginPage() {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 已登录则直接进入门户，避免重复登录
  useEffect(() => {
    if (getToken()) window.location.href = HOME_PATH;
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!keyId.trim() || !keySecret.trim()) {
      setError('请输入 Key ID 与 Key Secret');
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(keyId.trim(), keySecret.trim());
      setToken(data.token);
      if (data.subject) setSubject(data.subject);
      window.location.href = HOME_PATH;
    } catch (e) {
      setError(getErrorMessage(e, '登录失败，请检查凭据或网络'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-canvas flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm panel-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">YYeSim 伙伴门户</CardTitle>
          <CardDescription>请使用开放平台的 Key ID 与 Key Secret 登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyId">Key ID</Label>
              <Input
                id="keyId"
                value={keyId}
                autoComplete="username"
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="请输入 Key ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keySecret">Key Secret</Label>
              <Input
                id="keySecret"
                type="password"
                value={keySecret}
                autoComplete="current-password"
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder="请输入 Key Secret"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}