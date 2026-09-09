'use client';

import { useEffect, useState } from 'react';
import {
  Globe,
  Package as PackageIcon,
  ReceiptText,
  CircleCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { adminApi, unwrap, getErrorMessage, type DashboardStats, type Order, type Esim } from '@/api';

// 低饱和品牌点缀色板（与浅色高级感主题一致）
const ACCENT = ['#5a53e0', '#7c6ff0', '#4f8fd9', '#2f9e7f', '#6f75d6', '#d98944'];

function StatBadge({ status }: { status: string }) {
  if (status === 'paid') return <Badge variant="success">已支付</Badge>;
  if (status === 'refunded') return <Badge variant="info">已退款</Badge>;
  return <Badge variant="warning">待支付</Badge>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    countryCount: 0,
    packageCount: 0,
    orderCount: 0,
    paidOrders: 0,
    esimCount: 0,
    totalRevenue: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [esims, setEsims] = useState<Esim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, o, e] = await Promise.all([
          adminApi.getDashboard(),
          adminApi.getOrders(),
          adminApi.getEsims(),
        ]);
        setStats(unwrap<DashboardStats>(s).data);
        setOrders(unwrap<{ orders: Order[] }>(o).data.orders.slice(0, 5));
        setEsims(unwrap<{ esims: Esim[] }>(e).data.esims.slice(0, 5));
      } catch (err) {
        toast.error(getErrorMessage(err, '仪表盘数据加载失败'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cardDefs = [
    { label: '国家 / 地区', value: stats.countryCount, icon: <Globe size={20} strokeWidth={2.2} />, color: ACCENT[0], delay: 0 },
    { label: '在售套餐', value: stats.packageCount, icon: <PackageIcon size={20} strokeWidth={2.2} />, color: ACCENT[1], delay: 40 },
    { label: '订单总数', value: stats.orderCount, icon: <ReceiptText size={20} strokeWidth={2.2} />, color: ACCENT[2], delay: 80 },
    { label: '已支付订单', value: stats.paidOrders, icon: <CircleCheck size={20} strokeWidth={2.2} />, color: ACCENT[3], delay: 120 },
    { label: 'eSIM 总数', value: stats.esimCount, icon: <Smartphone size={20} strokeWidth={2.2} />, color: ACCENT[4], delay: 160 },
    { label: '累计收入', value: `¥${Number(stats.totalRevenue || 0).toFixed(1)}`, icon: <Wallet size={20} strokeWidth={2.2} />, color: ACCENT[5], delay: 200 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Overview
          </div>
          <h1 className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-ink">
            运营概览
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            核心经营指标与最新动态一览
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-600 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          数据实时
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cardDefs.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="panel-card">
          <CardHeader className="px-6 pb-4 pt-6">
            <CardTitle className="text-[14px] font-semibold tracking-tight text-ink">
              最近订单
            </CardTitle>
            <CardDescription>最近 5 笔订单动态</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 && !loading ? (
              <EmptyState title="暂无订单" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>套餐</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-[12.5px]">{o.orderNo}</TableCell>
                      <TableCell>
                        {o.pkgName || o.countryCode || '—'} {o.gb ? `${o.gb}GB` : ''}
                      </TableCell>
                      <TableCell>¥{o.price}</TableCell>
                      <TableCell>
                        <StatBadge status={o.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader className="px-6 pb-4 pt-6">
            <CardTitle className="text-[14px] font-semibold tracking-tight text-ink">
              最近 eSIM
            </CardTitle>
            <CardDescription>最近 5 张 eSIM 激活情况</CardDescription>
          </CardHeader>
          <CardContent>
            {esims.length === 0 && !loading ? (
              <EmptyState title="暂无 eSIM" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>国家</TableHead>
                    <TableHead>ICCID</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {esims.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {e.pkgName || e.countryCode || e.order?.countryCode || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-[12.5px]">{e.iccid}</TableCell>
                      <TableCell>
                        {e.status === 'activated' ? (
                          <Badge variant="success">已激活</Badge>
                        ) : (
                          <Badge variant="info">待激活</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}