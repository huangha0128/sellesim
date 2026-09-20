'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, ShoppingBag, CheckCircle2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import { Field, CopyField } from '@/components/common';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, getErrorMessage, type PackageItem, type Region, type CreateOrderResult } from '@/lib/api';
import { fmtMoney } from '@/lib/utils';

const PAGE_SIZE = 20;

function PkgSpec({ p }: { p: PackageItem }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{p.isUnlimited ? '不限量' : `${p.gb ?? 0}GB`}</span>
      <span className="text-muted-foreground">/</span>
      <span>{p.days ?? 0}天</span>
      {p.isUnlimited && (
        <span
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700"
          style={{ background: 'rgba(217, 119, 6, 0.12)' }}
        >
          不限量
        </span>
      )}
    </div>
  );
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [countryCode, setCountryCode] = useState('');

  // 下单弹窗
  const [orderTarget, setOrderTarget] = useState<PackageItem | null>(null);
  const [email, setEmail] = useState('');
  const [extOrderNo, setExtOrderNo] = useState('');
  const [placing, setPlacing] = useState(false);
  // 下单成功后的 eSIM 信息
  const [placed, setPlaced] = useState<{ order: CreateOrderResult; pkg: PackageItem } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.packages({
        keyword: keyword.trim() || undefined,
        countryCode: countryCode || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setPackages(data.packages || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(getErrorMessage(e, '套餐加载失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword, countryCode, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .regions()
      .then((data) => setRegions(data.regions || []))
      .catch(() => {
        /* 地区加载失败时忽略，仍可浏览套餐 */
      });
  }, []);

  function openOrderFor(p: PackageItem) {
    setOrderTarget(p);
    setEmail('');
    setExtOrderNo('');
    setPlaced(null);
  }

  function resetOrder() {
    setOrderTarget(null);
    setPlaced(null);
  }

  async function placeOrder() {
    if (!orderTarget) return;
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.warning('请输入有效的接收邮箱');
      return;
    }
    setPlacing(true);
    try {
      const data = await api.createOrder({
        pkgId: orderTarget.id || String(orderTarget.tigerPkgId ?? ''),
        email: email.trim(),
        extOrderNo: extOrderNo.trim() || undefined,
      });
      setPlaced({ order: data, pkg: orderTarget });
      toast.success('下单成功，eSIM 已生成');
    } catch (e) {
      toast.error(getErrorMessage(e, '下单失败'));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* 筛选 */}
      <Card className="panel-card">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <Field label="关键词">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  load();
                }
              }}
              placeholder="套餐名 / 国家"
              className="w-56"
            />
          </Field>
          <Field label="国家 / 地区">
            <select
              className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setPage(1);
              }}
            >
              <option value="">全部</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.flag ? `${r.name} ${r.flag}` : r.name}
                </option>
              ))}
            </select>
          </Field>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            <Search className="h-4 w-4" /> 搜索
          </Button>
        </CardContent>
      </Card>

      {/* 套餐列表 */}
      <Card className="panel-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-baseline justify-between text-[15px] text-ink">
            <span>套餐列表</span>
            <span className="text-[12px] font-normal text-muted-foreground">共 {total} 条</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {packages.length === 0 && !loading ? (
            <EmptyState title="暂无套餐" hint="调整筛选条件后再试" />
          ) : (
            <>
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>国家 / 地区</TableHead>
                    <TableHead>套餐名称</TableHead>
                    <TableHead>流量 / 有效期</TableHead>
                    <TableHead>售价</TableHead>
                    <TableHead>结算价</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => (
                    <TableRow key={p.id || String(p.tigerPkgId)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.flag && (
                            <img src={p.flag} alt={p.countryName || p.countryCode} className="h-4 w-6 rounded-sm object-cover" />
                          )}
                          <span className="font-medium text-ink">{p.countryName || p.countryCode}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[15rem] truncate text-ink">{p.name || p.nameEn || '—'}</div>
                        {p.nameEn && p.name !== p.nameEn ? (
                          <div className="text-[11px] text-muted-foreground">{p.nameEn}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <PkgSpec p={p} />
                      </TableCell>
                      <TableCell className="font-medium text-ink">¥{fmtMoney(p.price)}</TableCell>
                      <TableCell className="text-muted-foreground">¥{fmtMoney(p.costPrice)}</TableCell>
                      <TableCell align="right">
                        <Button size="sm" onClick={() => openOrderFor(p)}>
                          <ShoppingBag className="h-4 w-4" /> 下单
                        </Button>
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

      {/* 下单弹窗 */}
      <Dialog open={!!orderTarget} onOpenChange={(o) => !o && resetOrder()}>
        <DialogContent className="max-w-md">
          {placed ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <DialogTitle>下单成功</DialogTitle>
                </div>
                <DialogDescription>
                  订单 {placed.order.orderNo} 已生成，eSIM 已即时交付。请在此妥善保存以下激活信息。
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  {placed.pkg.countryName || placed.pkg.countryCode} · {placed.pkg.name}
                </div>
                <CopyField label="ICCID" value={placed.order.esim?.iccid || ''} />
                <CopyField label="激活码 (Activation Code)" value={placed.order.esim?.activationCode || ''} />
                <CopyField label="SM-DP+ 地址" value={placed.order.esim?.smdp || ''} />
                {placed.order.esim?.expireAt && (
                  <CopyField
                    label="有效期至"
                    value={new Date(placed.order.esim.expireAt).toLocaleString('zh-CN', { hour12: false })}
                    mono={false}
                  />
                )}
                <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                  本单结算金额 ¥{fmtMoney(placed.order.cost)}，已从账户额度中扣除。
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => resetOrder()}>完成</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>确认下单</DialogTitle>
                <DialogDescription>
                  {orderTarget ? (
                    <>
                      {orderTarget.countryName || orderTarget.countryCode} · {orderTarget.name || orderTarget.nameEn} ·{' '}
                      {orderTarget.isUnlimited ? '不限量' : `${orderTarget.gb ?? 0}GB`}/{orderTarget.days ?? 0}天
                    </>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Field label="接收邮箱（必填）">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="用于接收 eSIM 激活信息"
                    autoComplete="email"
                  />
                </Field>
                <Field label="外部订单号（可选）">
                  <Input
                    value={extOrderNo}
                    onChange={(e) => setExtOrderNo(e.target.value)}
                    placeholder="用于与您的系统对账"
                  />
                </Field>
                <div className="rounded-lg bg-muted/60 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  下单将即时扣除结算价 ¥{fmtMoney(orderTarget?.costPrice)} 并于成功后直接交付 eSIM；可退款订单支持自助退款。
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => resetOrder()} disabled={placing}>
                  取消
                </Button>
                <Button onClick={placeOrder} disabled={placing}>
                  {placing ? '下单中…' : '确认下单'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}