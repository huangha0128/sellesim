'use client';

import { useCallback, useEffect, useState } from 'react';
import { IdCard, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { api, getErrorMessage, type IccidPoolResult } from '@/lib/api';

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="panel-card">
      <CardContent className="pt-5">
        <div className="text-[12px] text-muted-foreground">{label}</div>
        <div className={`mt-1 text-[22px] font-bold leading-none tabular-nums ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

async function copyIccid(iccid: string) {
  try {
    await navigator.clipboard.writeText(iccid);
    toast.success('ICCID 已复制');
  } catch {
    toast.error('复制失败，请手动复制');
  }
}

export default function IccidPoolPage() {
  const [data, setData] = useState<IccidPoolResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.iccidPool());
    } catch (e) {
      toast.error(getErrorMessage(e, '卡号池加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pool = data?.pool || [];
  const stats = data?.stats;

  return (
    <div className="animate-fade-up space-y-5">
      <Card className="panel-card">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-muted-foreground">
            <span>
              仅展示<strong className="text-ink">未激活</strong>的可用 ICCID 卡号，已激活卡号对伙伴不可见。
            </span>
            {data?.mode === 'tiger' && <Badge variant="outline">Tiger 实时</Badge>}
            {data?.mode === 'mock' && <Badge variant="outline">本地卡池</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatMini label="卡池总数" value={String(stats?.total ?? 0)} color="text-muted-foreground" />
        <StatMini label="可用（未激活）" value={String(stats?.available ?? 0)} color="text-emerald-600" />
        <StatMini label="已激活" value={String(stats?.used ?? 0)} color="text-ink" />
      </div>

      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px] text-ink">
              <IdCard className="h-4 w-4 text-primary" />
              可用卡号池
            </CardTitle>
            <p className="text-[12px] text-muted-foreground">共 {pool.length} 张可用卡号</p>
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </CardHeader>
        <CardContent>
          {pool.length === 0 && !loading ? (
            <EmptyState title="暂无可用卡号" hint="当前所有 ICCID 均已激活或卡池为空" />
          ) : (
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>ICCID</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pool.map((item, idx) => (
                  <TableRow key={item.iccid}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-[12.5px]">{item.iccid}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {item.remark || '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="sm" variant="ghost" onClick={() => copyIccid(item.iccid)}>
                        <Copy className="h-3.5 w-3.5" /> 复制
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}