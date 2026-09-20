'use client';

import { useEffect, useState } from 'react';
import {
  ReceiptText,
  Wallet,
  Database,
  CircleDollarSign,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getErrorMessage, type MeResult, type QuotaResult, type OrdersResult, type LedgerItem } from '@/lib/api';
import { getSubject } from '@/lib/auth';
import { fmtDate, fmtMoney } from '@/lib/utils';
import { ledgerTypeInfo } from '@/components/common';

const ACCENT = ['#5a53e0', '#2f9e7f', '#4f8fd9', '#d98944'];

function maxQuotaPct(used: number, limit: number): number {
  const ratio = limit > 0 ? used / limit : used > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, ratio * 100));
}

function LedgerAmount({ item }: { item: LedgerItem }) {
  const info = ledgerTypeInfo(item.type);
  const abs = Math.abs(Number(item.amount || 0));
  const prefix = info.sign === 1 ? '+' : info.sign === -1 ? '-' : '';
  return (
    <span className={`font-medium tabular-nums ${info.absClass}`}>
      {prefix}¥{fmtMoney(abs)}
    </span>
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeResult | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const subject = me?.subject || getSubject();

  useEffect(() => {
    (async () => {
      try {
        const [meRes, quotaRes, ordersRes] = await Promise.all([
          api.me(),
          api.quota(1, 6),
          api.orders({ page: 1, pageSize: 1 }),
        ]);
        setMe(meRes);
        setLedger((quotaRes as QuotaResult).ledger || []);
        setOrderTotal((ordersRes as OrdersResult).total || 0);
      } catch (err) {
        toast.error(getErrorMessage(err, '总览数据加载失败'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const quota = me?.quota;
  const usedPct = quota ? maxQuotaPct(quota.usedQuota, quota.quotaLimit) : 0;

  const stats = [
    { label: '订单总数', value: orderTotal, icon: <ReceiptText size={20} strokeWidth={2.2} />, color: ACCENT[0] },
    { label: '已用额度', value: `¥${fmtMoney(quota?.usedQuota)}`, icon: <CircleDollarSign size={20} strokeWidth={2.2} />, color: ACCENT[1], delay: 40 },
    { label: '可用额度', value: `¥${fmtMoney(quota?.availableQuota)}`, icon: <Wallet size={20} strokeWidth={2.2} />, color: ACCENT[2], delay: 80 },
    { label: '额度上限', value: `¥${fmtMoney(quota?.quotaLimit)}`, icon: <Database size={20} strokeWidth={2.2} />, color: ACCENT[3], delay: 120 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Overview
          </div>
          <h1 className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-ink">
            {subject?.name ? `你好，${subject.name}` : '伙伴总览'}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            账户额度与最新交易动态一览
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* 额度使用 */}
      <Card className="panel-card">
        <CardHeader className="px-6 pb-3 pt-6">
          <CardTitle className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink">
            <TrendingUp className="h-4 w-4 text-primary" />
            额度使用
          </CardTitle>
          <CardDescription>
            已用 ¥{fmtMoney(quota?.usedQuota)} / 上限 ¥{fmtMoney(quota?.quotaLimit)}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#5a53e0] to-[#7c6ff0] transition-all duration-700"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[12px] text-muted-foreground">
            <span>已用 {usedPct.toFixed(1)}%</span>
            <span>可用 ¥{fmtMoney(quota?.availableQuota)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 最近记账流水 */}
      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 pb-3 pt-6">
          <div>
            <CardTitle className="text-[14px] font-semibold tracking-tight text-ink">最近记账流水</CardTitle>
            <CardDescription>最新 {ledger.length} 条额度变动</CardDescription>
          </div>
          <Link
            href="/ledger"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
          >
            全部流水 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="px-3 pb-4 pt-0">
          {ledger.length === 0 && !loading ? (
            <EmptyState title="暂无记账流水" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>关联单号</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline">{ledgerTypeInfo(item.type).text}</Badge>
                    </TableCell>
                    <TableCell>
                      <LedgerAmount item={item} />
                    </TableCell>
                    <TableCell className="font-mono text-[12.5px]">
                      {item.orderNo || item.refundNo || '—'}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {item.note || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(item.createdAt)}</TableCell>
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