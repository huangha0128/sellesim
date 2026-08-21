'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminApi, unwrap, getErrorMessage, type Order } from '@/api';

function fmt(dt?: string) {
  if (!dt) return '-';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getOrders();
      setOrders(unwrap<{ orders: Order[] }>(res).data.orders);
    } catch (e) {
      toast.error(getErrorMessage(e, '订单加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusInfo = (o: Order): { text: string; variant: 'success' | 'warning' | 'info' } => {
    if (o.status === 'refunded' || o.refundedAt) return { text: '已退款', variant: 'info' };
    if (o.status === 'paid') return { text: '已支付', variant: 'success' };
    return { text: '待支付', variant: 'warning' };
  };

  const confirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const res = await adminApi.refundOrder(refundTarget.orderNo, reason.trim() || undefined);
      const body = unwrap<any>(res);
      if (body.code !== 0) {
        toast.error(body.message || '退款失败，请重试');
        return;
      }
      toast.success('退款成功');
      setRefundTarget(null);
      setReason('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '退款失败，请重试'));
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <Card className="border-transparent bg-white/70 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] text-ink">订单列表</CardTitle>
            <p className="text-[12px] text-muted-foreground">共 {orders.length} 笔订单</p>
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </CardHeader>
        <CardContent>
          {orders.length === 0 && !loading ? (
            <EmptyState title="暂无订单" />
          ) : (
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow className="whitespace-nowrap">
                  <TableHead className="w-56">订单号</TableHead>
                  <TableHead className="w-52">套餐</TableHead>
                  <TableHead className="w-32">归属用户</TableHead>
                  <TableHead className="w-44">邮箱</TableHead>
                  <TableHead className="w-24">支付方式</TableHead>
                  <TableHead className="w-20">金额</TableHead>
                  <TableHead className="w-20">状态</TableHead>
                  <TableHead className="w-44">退款时间</TableHead>
                  <TableHead className="w-44">创建时间</TableHead>
                  <TableHead className="w-20 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const st = statusInfo(o);
                  return (
                    <TableRow key={o.id} className="whitespace-nowrap">
                      <TableCell className="font-mono text-[12.5px]">{o.orderNo}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          {o.package?.country?.flag && (
                            <img
                              src={o.package.country.flag}
                              alt=""
                              className="h-4 w-6 rounded-sm object-cover"
                            />
                          )}
                          <span>
                            {o.package?.country?.name} {o.package?.gb}GB/{o.package?.days}天
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{o.user?.nickname || o.user?.id || '未登录/未归属'}</TableCell>
                      <TableCell className="text-muted-foreground">{o.email || '—'}</TableCell>
                      <TableCell>{o.payMethod === 'alipay' ? '支付宝' : '微信'}</TableCell>
                      <TableCell className="font-medium text-ink">¥{o.price}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.text}</Badge>
                      </TableCell>
                      <TableCell>{fmt(o.refundedAt as string | undefined)}</TableCell>
                      <TableCell>{fmt(o.createdAt)}</TableCell>
                      <TableCell align="right">
                        {o.status === 'paid' && !o.refundedAt ? (
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRefundTarget(o)}>
                            <Undo2 className="h-4 w-4" /> 退款
                          </Button>
                        ) : (
                          <span className="text-[12px] text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>订单退款确认</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-4 text-[13px] leading-relaxed text-muted-foreground">
            确认对订单 <span className="font-mono font-medium text-ink">{refundTarget?.orderNo}</span>（¥
            {refundTarget?.price}）发起退款？退款成功后该订单的 eSIM 将失效并归还卡片。
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">退款原因（可选）</Label>
            <Textarea value={reason} rows={2} onChange={(e) => setReason(e.target.value)} placeholder="请输入退款原因" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmRefund} disabled={refunding}>
              {refunding ? '处理中…' : '确认退款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}