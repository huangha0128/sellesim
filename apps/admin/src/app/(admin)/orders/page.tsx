'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Undo2, XCircle } from 'lucide-react';
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

type BadgeVariant = 'success' | 'warning' | 'info' | 'destructive';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 同意退款（执行退款）
  const [approveTarget, setApproveTarget] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [approving, setApproving] = useState(false);

  // 拒绝退款（填写拒绝理由）
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

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

  const statusInfo = (o: Order): { text: string; variant: BadgeVariant; hint?: string } => {
    if (o.refundStatus === 'requested')
      return { text: '退款申请中', variant: 'warning', hint: o.refundReason || '等待审核' };
    if (o.refundStatus === 'rejected')
      return { text: '退款已拒绝', variant: 'destructive', hint: o.refundRejectReason || '' };
    if (o.status === 'refunded' || o.refundedAt || o.refundStatus === 'approved')
      return { text: '已退款', variant: 'info' };
    if (o.status === 'paid') return { text: '已支付', variant: 'success' };
    return { text: '待支付', variant: 'warning' };
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const res = await adminApi.approveRefund(approveTarget.orderNo, reason.trim() || undefined);
      const body = unwrap<any>(res);
      if (body.code !== 0) {
        toast.error(body.message || '退款失败，请重试');
        return;
      }
      toast.success('已同意退款，退款完成');
      setApproveTarget(null);
      setReason('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '退款失败，请重试'));
    } finally {
      setApproving(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error('请填写拒绝理由');
      return;
    }
    setRejecting(true);
    try {
      const res = await adminApi.rejectRefund(rejectTarget.orderNo, rejectReason.trim());
      const body = unwrap<any>(res);
      if (body.code !== 0) {
        toast.error(body.message || '拒绝失败，请重试');
        return;
      }
      toast.success('已拒绝退款申请');
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '拒绝失败，请重试'));
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <Card className="panel-card">
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
                  <TableHead className="w-32">状态</TableHead>
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
                          <span>
                            {o.pkgName || o.countryCode || '—'} {o.gb ? `${o.gb}GB/` : ''}{o.days ? `${o.days}天` : ''}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{o.user?.nickname || o.user?.id || '未登录/未归属'}</TableCell>
                      <TableCell className="text-muted-foreground">{o.email || '—'}</TableCell>
                      <TableCell>{o.payMethod === 'alipay' ? '支付宝' : '微信'}</TableCell>
                      <TableCell className="font-medium text-ink">¥{o.price}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={st.variant}>{st.text}</Badge>
                          {st.hint ? (
                            <span className="max-w-[200px] truncate text-[11px] text-muted-foreground" title={st.hint}>
                              {st.hint}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{fmt(o.refundedAt as string | undefined)}</TableCell>
                      <TableCell>{fmt(o.createdAt)}</TableCell>
                      <TableCell align="right">
                        {o.refundStatus === 'requested' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Button size="sm" variant="outline" className="text-emerald-700 hover:text-emerald-700" onClick={() => setApproveTarget(o)}>
                              <Undo2 className="h-4 w-4" /> 同意
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRejectTarget(o)}>
                              <XCircle className="h-4 w-4" /> 拒绝
                            </Button>
                          </span>
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

      {/* 同意退款 */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>同意退款</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-4 text-[13px] leading-relaxed text-muted-foreground">
            确认对订单 <span className="font-mono font-medium text-ink">{approveTarget?.orderNo}</span>（¥
            {approveTarget?.price}）同意退款？退款将按原支付渠道原路退回，成功后该订单的 eSIM 将失效并归还卡片。
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">备注原因（可选）</Label>
            <Textarea value={reason} rows={2} onChange={(e) => setReason(e.target.value)} placeholder="请输入备注原因" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmApprove} disabled={approving}>
              {approving ? '处理中…' : '同意退款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝退款 */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>拒绝退款</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-4 text-[13px] leading-relaxed text-muted-foreground">
            确认拒绝订单 <span className="font-mono font-medium text-ink">{rejectTarget?.orderNo}</span>（¥
            {rejectTarget?.price}）的退款申请？拒绝后用户端将显示拒绝理由。
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">拒绝理由（必填）</Label>
            <Textarea value={rejectReason} rows={3} onChange={(e) => setRejectReason(e.target.value)} placeholder="请输入拒绝理由" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={rejecting}>
              {rejecting ? '处理中…' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}