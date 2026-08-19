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
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN', { hour12: false });
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
      <Card className="border-transparent bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] text-ink">eSIM 列表</CardTitle>
          <p className="text-[12px] font-normal text-muted-foreground">共 {esims.length} 张 eSIM</p>
        </CardHeader>
        <CardContent>
          {esims.length === 0 && !loading ? (
            <EmptyState title="暂无 eSIM" hint="订单成交后会自动下发 eSIM" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>国家</TableHead>
                  <TableHead>ICCID</TableHead>
                  <TableHead>激活码</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>有效期</TableHead>
                  <TableHead>已用流量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {esims.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {e.order?.package?.country?.flag && (
                          <img src={e.order.package.country.flag} alt={e.order.package.country.name} className="h-4 w-6 rounded-sm object-cover" />
                        )}
                        <span className="font-medium text-ink">{e.order?.package?.country?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[12.5px]">{e.iccid}</TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-[12.5px] text-muted-foreground" title={e.activationCode}>
                      {e.activationCode || '—'}
                    </TableCell>
                    <TableCell>
                      {e.status === 'activated' ? <Badge variant="success">已激活</Badge> : <Badge variant="info">待激活</Badge>}
                    </TableCell>
                    <TableCell>{fmtDate(e.expireAt)}</TableCell>
                    <TableCell>{e.used ?? 0}GB</TableCell>
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