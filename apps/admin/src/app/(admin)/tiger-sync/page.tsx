'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Globe, Package, Database, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { adminApi, unwrap, getErrorMessage, type TigerStatus } from '@/api';

interface SyncResult {
  message?: string;
  regionsSynced?: number;
  packagesSynced?: number;
  packageTotal?: number;
}

export default function TigerSyncPage() {
  const [status, setStatus] = useState<TigerStatus>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await adminApi.getTigerStatus();
      setStatus(unwrap<TigerStatus>(res).data);
      setErrorMsg('');
    } catch (e) {
      setErrorMsg(getErrorMessage(e, '获取 Tiger 状态失败'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (key: 'all' | 'regions' | 'packages') => {
    setBusy(key);
    setErrorMsg('');
    try {
      const fn =
        key === 'all' ? adminApi.syncTigerAll : key === 'regions' ? adminApi.syncTigerRegions : adminApi.syncTigerPackages;
      const res = await fn();
      const body = unwrap<SyncResult>(res);
      if (body.code === 0) {
        setResult(body.data);
        toast.success('同步成功');
        load();
      } else {
        setErrorMsg(body.message || '同步失败');
      }
    } catch (e) {
      setErrorMsg(getErrorMessage(e, '同步失败'));
    } finally {
      setBusy(null);
    }
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'API 地址', value: status.baseUrl || '-' },
    { label: '连接模式', value: status.mode === 'tiger' ? 'Tiger 模式' : '模拟模式' },
    { label: '国家/地区', value: `${status.countryCount ?? 0} 个` },
    { label: '套餐总数', value: `${status.packageCount ?? 0} 个` },
    { label: 'ICCID 池', value: `${status.iccidPoolSize ?? 0} 个` },
    {
      label: '同步状态',
      value: status.configured ? (
        <Badge variant={status.synced ? 'success' : 'warning'}>{status.synced ? '已同步' : '未同步'}</Badge>
      ) : (
        <Badge variant="destructive">未连接</Badge>
      ),
    },
  ];

  const actions = [
    { key: 'all' as const, label: '全量同步所有数据', primary: true, icon: <RefreshCw size={16} /> },
    { key: 'regions' as const, label: '同步国家/地区', primary: false, icon: <Globe size={16} /> },
    { key: 'packages' as const, label: '同步套餐', primary: false, icon: <Package size={16} /> },
  ];

  return (
    <div className="animate-fade-up grid gap-5 lg:grid-cols-3">
      <Card className="border-transparent bg-white/70 backdrop-blur-sm lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9cc4bf]/25 text-[#47706b]">
              <Database size={16} />
            </span>
            <CardTitle className="text-[15px] text-ink">Tiger 同步状态</CardTitle>
          </div>
          {status.configured ? <Badge variant="success">已连接 Tiger</Badge> : <Badge variant="destructive">未连接</Badge>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between border-b border-dashed border-border/70 pb-2 text-[13.5px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-ink">{r.value}</span>
              </div>
            ))}
          </div>

          <Separator className="my-5" />

          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button
                key={a.key}
                variant={a.primary ? 'default' : 'outline'}
                onClick={() => run(a.key)}
                disabled={busy !== null}
              >
                <span className={busy === a.key ? 'animate-spin' : ''}>{a.icon}</span>
                {busy === a.key ? '同步中…' : a.label}
              </Button>
            ))}
          </div>

          {result && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniStat label="新增国家" value={result.regionsSynced ?? 0} />
              <MiniStat label="新增套餐" value={result.packagesSynced ?? 0} />
              <MiniStat label="套餐总数" value={result.packageTotal ?? 0} />
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
              <GitMerge size={15} /> {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit border-transparent bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] text-ink">说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>从 Tiger eSIM 合作伙伴平台同步国家/地区、套餐数据</li>
            <li>同步后会自动创建或更新本地数据库中的套餐信息</li>
            <li>套餐价格以 Tiger API 返回的 USD 价格为准</li>
            <li>全量同步会先同步国家，再同步套餐</li>
            <li>建议在套餐变动时手动触发同步</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-3 text-center">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}