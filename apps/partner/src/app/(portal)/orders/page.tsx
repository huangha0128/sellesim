'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, Undo2, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { EmptyState } from '@/components/EmptyState';
import { Field, CopyField, OrderStatusBadge, esimStatus } from '@/components/common';
import { Badge } from '@/components/ui/badge';
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
import { api, getErrorMessage, type Order, type OrderDetail } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/utils';

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 详情弹窗
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 退款弹窗
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.orders({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(getErrorMessage(e, '订单加载失败'));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(orderNo: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api.order(orderNo);
      setDetail(data);
    } catch (e) {
      toast.error(getErrorMessage(e, '订单详情加载失败'));
    } finally {
      setDetailLoading(false);
    }
  }

  const canRefund = (o: Order) => o.status === 'delivered' && !o.refundedAt;

  async function submitRefund() {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      await api.createRefund(refundTarget.orderNo, {
        reason: refundReason.trim() || '合作伙伴自助退款',
      });
      toast.success('退款申请成功，额度已退回');
      setRefundTarget(null);
      setRefundReason('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '退款失败'));
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* 筛选 */}
      <Card className="panel-card">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <Field label="订单状态">
            <select
              className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">全部</option>
              <option value="delivered">已交付</option>
              <option value="refunded">已退款</option>
              <option value="failed">失败</option>
            </select>
          </Field>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card className="panel-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-baseline justify-between text-[15px] text-ink">
            <span>我的订单</span>
            <span className="text-[12px] font-normal text-muted-foreground">共 {total} 笔</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 && !loading ? (
            <EmptyState title="暂无订单" hint="前往「套餐」页面挑选并下单" />
          ) : (
            <>
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>套餐</TableHead>
                    <TableHead>结算金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.orderNo}>
                      <TableCell className="font-mono text-[12.5px]">{o.orderNo}</TableCell>
                      <TableCell>
                        <div className="max-w-[15rem] truncate text-ink">
                          {o.pkgName || o.countryCode || '—'}{' '}
                          {o.isUnlimited
                            ? '不限量'
                            : o.gb
                              ? `${o.gb}GB/${o.days}天`
                              : o.days
                                ? `${o.days}天`
                                : ''}
                        </div>
                        {o.extOrderNo ? (
                          <div className="text-[11px] text-muted-foreground">外部单号 {o.extOrderNo}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium text-ink">¥{fmtMoney(o.cost)}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(o.createdAt)}</TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openDetail(o.orderNo)}>
                            <Eye className="h-4 w-4" /> 详情
                          </Button>
                          {canRefund(o) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setRefundTarget(o);
                                setRefundReason('');
                              }}
                            >
                              <Undo2 className="h-4 w-4" /> 退款
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* 订单详情 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {(detailLoading || detail) && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <DialogDescription className="text-base font-semibold text-ink">
                    订单 {detail?.order?.orderNo}
                  </DialogDescription>
                </div>
              </DialogHeader>
              {detailLoading ? (
                <div className="py-10 text-center text-[12.5px] text-muted-foreground">加载中…</div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">状态</span>
                    <OrderStatusBadge status={detail.order.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">套餐</span>
                    <span className="text-[13px] font-medium text-ink">
                      {detail.order.pkgName || detail.order.countryCode || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">结算金额</span>
                    <span className="text-[13px] font-medium text-ink">¥{fmtMoney(detail.order.cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">创建时间</span>
                    <span className="text-[13px] text-ink">{fmtDate(detail.order.createdAt)}</span>
                  </div>

                  {detail.order.esim && (
                    <>
                      <div className="mt-1 flex items-center gap-3 text-[12px] font-semibold text-ink">
                        <Smartphone className="h-4 w-4 text-emerald-600" />
                        eSIM 激活信息
                        {detail.order.esim.status && (
                          <Badge variant={esimStatus(detail.order.esim.status).variant}>
                            {esimStatus(detail.order.esim.status).text}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                        {detail.order.esim.iccid && (
                          <CopyField label="ICCID" value={detail.order.esim.iccid} />
                        )}
                        {detail.order.esim.activationCode && (
                          <CopyField label="激活码 (Activation Code)" value={detail.order.esim.activationCode} />
                        )}
                        {detail.order.esim.smdp && (
                          <CopyField label="SM-DP+ 地址" value={detail.order.esim.smdp} />
                        )}
                        {detail.order.esim.expireAt && (
                          <CopyField
                            label="有效期至"
                            value={new Date(detail.order.esim.expireAt).toLocaleString('zh-CN', { hour12: false })}
                            mono={false}
                          />
                        )}
                        {detail.order.esim.used !== undefined && (
                          <div className="text-[11.5px] text-muted-foreground">
                            {detail.order.isUnlimited ? '不限量' : `已使用 ${detail.order.esim.used ?? 0}MB`} · 激活于{' '}
                            {fmtDate(detail.order.esim.activatedAt)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 退款弹窗 */}
      <Dialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogDescription className="text-base font-semibold text-ink">
              申请退款
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">订单</span>
            <span className="font-mono text-[12.5px]">{refundTarget?.orderNo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">可退回额度</span>
            <span className="text-[13px] font-medium text-ink">¥{fmtMoney(refundTarget?.cost)}</span>
          </div>
          <Field label="退款原因（可选）">
            <Textarea
              value={refundReason}
              rows={2}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="请输入退款原因"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={refunding}>
              取消
            </Button>
            <Button variant="destructive" onClick={submitRefund} disabled={refunding}>
              {refunding ? '处理中…' : '确认退款'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}