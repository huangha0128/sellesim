'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { ledgerTypeInfo } from '@/components/common';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { api, getErrorMessage, type LedgerItem, type Quota } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/utils';

const PAGE_SIZE = 20;

function LedgerAmount({ item }: { item: LedgerItem }) {
  const info = ledgerTypeInfo(item.type);
  const abs = Math.abs(Number(item.amount || 0));
  const prefix = info.sign === 1 ? '+' : info.sign === -1 ? '-' : '';
  return (
    <span className={`font-semibold tabular-nums ${info.absClass}`}>
      {prefix}¥{fmtMoney(abs)}
    </span>
  );
}

export default function LedgerPage() {
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.quota(page, PAGE_SIZE);
      setLedger(data.ledger || []);
      setTotal(data.total || 0);
      if (data.quota) setQuota(data.quota);
    } catch (e) {
      toast.error(getErrorMessage(e, '流水加载失败'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="animate-fade-up space-y-5">
      {/* 额度概览 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatMini label="可用额度" value={`¥${fmtMoney(quota?.availableQuota)}`} color="text-emerald-600" />
        <StatMini label="已用额度" value={`¥${fmtMoney(quota?.usedQuota)}`} color="text-ink" />
        <StatMini label="额度上限" value={`¥${fmtMoney(quota?.quotaLimit)}`} color="text-muted-foreground" />
      </div>

      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px] text-ink">
              <Wallet className="h-4 w-4 text-primary" />
              记账流水
            </CardTitle>
            <p className="text-[12px] text-muted-foreground">共 {total} 条</p>
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 && !loading ? (
            <EmptyState title="暂无记账流水" />
          ) : (
            <>
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>关联订单号</TableHead>
                    <TableHead>退款单号</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((item) => {
                    const info = ledgerTypeInfo(item.type);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">{info.text}</Badge>
                        </TableCell>
                        <TableCell>
                          <LedgerAmount item={item} />
                        </TableCell>
                        <TableCell className="font-mono text-[12.5px]">{item.orderNo || '—'}</TableCell>
                        <TableCell className="font-mono text-[12.5px]">{item.refundNo || '—'}</TableCell>
                        <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={item.note}>
                          {item.note || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(item.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((n) => Math.abs(n - page) <= 2 || n === 1 || n === totalPages)
                        .map((n, idx, arr) => {
                          if (idx > 0 && n - arr[idx - 1] > 1) {
                            return (
                              <span key={`e-${n}`} className="px-1 text-muted-foreground">
                                …
                              </span>
                            );
                          }
                          return (
                            <PaginationItem key={n}>
                              <PaginationLink isActive={n === page} onClick={() => setPage(n)}>
                                {n}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="panel-card">
      <CardContent className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <div className={`truncate text-[22px] font-bold leading-none tracking-tight tabular-nums ${color}`}>
            {value}
          </div>
          <div className="mt-2 text-[12px] font-medium text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}