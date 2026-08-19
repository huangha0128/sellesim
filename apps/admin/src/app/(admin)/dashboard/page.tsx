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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const ACCENT = ['#6f8f8b', '#c58f6a', '#7a95a8'];

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
    { label: '国家/地区', value: stats.countryCount, icon: <Globe size={22} />, color: ACCENT[0], delay: 0 },
    { label: '套餐数量', value: stats.packageCount, icon: <PackageIcon size={22} />, color: '#c58f6a', delay: 40 },
    { label: '总订单', value: stats.orderCount, icon: <ReceiptText size={22} />, color: '#7a95a8', delay: 80 },
    { label: '已支付', value: stats.paidOrders, icon: <CircleCheck size={22} />, color: '#5f8f76', delay: 120 },
    { label: 'eSIM 总数', value: stats.esimCount, icon: <Smartphone size={22} />, color: '#a68bb8', delay: 160 },
    { label: '总收入', value: `¥${Number(stats.totalRevenue || 0).toFixed(1)}`, icon: <Wallet size={22} />, color: '#d4a05f', delay: 200 },
  ];

  return (
    <div className="animate-fade-up space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cardDefs.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-transparent bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] text-ink">最近订单</CardTitle>
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
                        {o.package?.country?.flag} {o.package?.country?.name} {o.package?.gb}GB
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

        <Card className="border-transparent bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] text-ink">最近 eSIM</CardTitle>
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
                        {e.order?.package?.country?.flag} {e.order?.package?.country?.name}
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