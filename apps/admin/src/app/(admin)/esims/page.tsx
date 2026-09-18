'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi, unwrap, getErrorMessage, type Esim } from '@/api';

function fmtDate(dt?: string) {
  if (!dt) return '-';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}

function statusBadge(status?: string) {
  const s = String(status ?? '').toLowerCase();
  if (s === 'activated') return <Badge variant="success">已激活</Badge>;
  if (s === 'expired') return <Badge variant="outline">已过期</Badge>;
  if (s === 'used') return <Badge variant="info">已用尽</Badge>;
  return <Badge variant="info">待激活</Badge>;
}

function fmtGb(n?: number, unlimited = false) {
  if (unlimited) return '无限';
  if (n === undefined || n === null || !Number.isFinite(n)) return '0';
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

// 已用流量 / 总流量 → 进度条 + 百分比，悬停显示详细用量
function usageCell(e: Esim) {
  if (e.isUnlimited) {
    return <span className="whitespace-nowrap text-[12.5px]">无限流量</span>;
  }
  const total = e.gb ?? 0;
  const used = e.used ?? 0;
  const hasTotal = total > 0;
  const pct = hasTotal ? Math.min(100, (used / total) * 100) : 0;
  const pctText = hasTotal ? ((used / total) * 100).toFixed(1) : '0';
  const remaining = Math.max(0, total - used);

  return (
    <div className="group relative cursor-help whitespace-nowrap py-0.5">
      <div className="flex items-center gap-2">
        <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-muted-foreground">{pctText}%</span>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        已用 {fmtGb(used)} / {fmtGb(total)} GB
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden whitespace-nowrap -translate-x-1/2 rounded-md border bg-card px-2.5 py-1.5 text-[11px] text-ink shadow-lg group-hover:block">
        <div>已用：{fmtGb(used)} GB</div>
        <div>总流量：{fmtGb(total)} GB</div>
        <div>剩余：{fmtGb(remaining)} GB</div>
        <div>已用：{pctText}%</div>
      </div>
    </div>
  );
}

export default function EsimsPage() {
  const [esims, setEsims] = useState<Esim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getEsims();
        setEsims(unwrap<{ esims: Esim[] }>(res).data.esims);
      } catch (e) {
        toast.error(getErrorMessage(e, 'eSIM 列表加载失败'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="animate-fade-up">
      <Card className="panel-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] text-ink">eSIM 列表</CardTitle>
          <p className="text-[12px] font-normal text-muted-foreground">共 {esims.length} 张 eSIM（usage/status 实时取自 Tiger）</p>
        </CardHeader>
        <CardContent>
          {esims.length === 0 && !loading ? (
            <EmptyState title="暂无 eSIM" hint="订单成交后会自动下发 eSIM" />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>国家/地区</TableHead>
                    <TableHead>套餐</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>ICCID</TableHead>
                    <TableHead>激活码</TableHead>
                    <TableHead>SM-DP+</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>用量</TableHead>
                    <TableHead>天数</TableHead>
                    <TableHead>激活时间</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>来源</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {esims.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium text-ink">{e.pkgName || e.countryCode || e.order?.countryCode || '—'}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">{e.countryCode || e.order?.countryCode}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-[12.5px]">
                          <div>{e.pkgName || e.order?.pkgName || '—'}</div>
                          {e.pkgNameEn && <div className="text-[11px] text-muted-foreground">{e.pkgNameEn}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">{e.order?.orderNo || e.orderId || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[12.5px]">{e.iccid}</TableCell>
                      <TableCell className="max-w-48 truncate font-mono text-[12.5px] text-muted-foreground" title={e.activationCode}>
                        {e.activationCode || '—'}
                      </TableCell>
                      <TableCell className="max-w-40 truncate font-mono text-[12.5px] text-muted-foreground" title={e.smdp}>
                        {e.smdp || '—'}
                      </TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell>{usageCell(e)}</TableCell>
                      <TableCell>{e.days ?? 0}天</TableCell>
                      <TableCell className="whitespace-nowrap text-[12.5px]">{fmtDate(e.activatedAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-[12.5px]">{fmtDate(e.expireAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-[12.5px]">{fmtDate(e.createdAt)}</TableCell>
                      <TableCell>{e.source === 'tiger' ? <Badge variant="info">Tiger</Badge> : <Badge variant="outline">本地</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}