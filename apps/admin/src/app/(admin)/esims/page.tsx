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
                    <TableHead>流量</TableHead>
                    <TableHead>已用</TableHead>
                    <TableHead>天数</TableHead>
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
                      <TableCell className="whitespace-nowrap">
                        {e.isUnlimited ? '无限' : `${e.gb ?? 0}GB`}
                        <span className="ml-1 text-[11px] text-muted-foreground">(Tiger id:{e.tigerPkgId ?? e.tigerPid ?? '—'})</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{e.used ?? 0}GB</TableCell>
                      <TableCell>{e.days ?? 0}天</TableCell>
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