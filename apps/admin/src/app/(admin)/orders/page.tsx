'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Undo2, XCircle, History, RotateCcw, Plus, Search, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { adminApi, unwrap, getErrorMessage, type Order, type PackageItem } from '@/api';

function fmt(dt?: string) {
  if (!dt) return '-';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}

type BadgeVariant = 'success' | 'warning' | 'info' | 'destructive';

const refundStepText: Record<string, { text: string; cls: string }> = {
  requested: { text: '申请', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  rejected: { text: '已拒绝', cls: 'text-destructive bg-destructive/5 border-destructive/20' },
  approved: { text: '已同意', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};

// 解析后端存储的凭证图片 JSON 字符串为地址数组
function parseImages(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((u) => typeof u === 'string' && u) : [];
  } catch {
    return [];
  }
}

// 用户上传的退款凭证缩略图（点击可在新窗口查看大图）
function RefundImages({ raw }: { raw?: string | null }) {
  const imgs = parseImages(raw);
  if (!imgs.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {imgs.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
          <img
            src={u}
            alt="退款凭证"
            className="h-20 w-20 rounded-md border object-cover"
          />
        </a>
      ))}
    </div>
  );
}

// 支付方式展示：manual=后台手动建单（免支付），quota=开放平台授信下单
const payMethodText: Record<string, string> = {
  alipay: '支付宝',
  manual: '后台代建',
  quota: '授信',
};

interface ManualUser {
  id: string;
  nickname?: string;
  email?: string;
  alipayUserId?: string;
}

interface ManualEsim {
  id: string;
  iccid?: string;
  pkgName?: string | null;
  gb?: number | null;
  days?: number | null;
  expireAt?: string | null;
  user?: { id?: string } | null;
}

interface ManualResult {
  order: {
    orderNo: string;
    pkgName?: string | null;
    gb?: number | null;
    days?: number | null;
    isUnlimited?: boolean;
  };
  esim?: { iccid?: string; activationCode?: string } | null;
}

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

  // 后台主动退款（无需用户申请）
  const [manualTarget, setManualTarget] = useState<Order | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [manualRefunding, setManualRefunding] = useState(false);

  // 查看退款记录
  const [historyTarget, setHistoryTarget] = useState<Order | null>(null);

  // ===== 手动建单（免支付）=====
  const [createOpen, setCreateOpen] = useState(false);
  const [userKeyword, setUserKeyword] = useState('');
  const [userOptions, setUserOptions] = useState<ManualUser[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManualUser | null>(null);
  const [email, setEmail] = useState('');
  const [orderType, setOrderType] = useState<'new' | 'renew'>('new');
  const [pkgKeyword, setPkgKeyword] = useState('');
  const [pkgOptions, setPkgOptions] = useState<PackageItem[]>([]);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [pkgLoaded, setPkgLoaded] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PackageItem | null>(null);
  const [esimOptions, setEsimOptions] = useState<ManualEsim[]>([]);
  const [esimLoading, setEsimLoading] = useState(false);
  const [selectedEsim, setSelectedEsim] = useState<ManualEsim | null>(null);
  const [creating, setCreating] = useState(false);
  const [createWarn, setCreateWarn] = useState('');
  const [createResult, setCreateResult] = useState<ManualResult | null>(null);

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

  // ===== 手动建单：用户防抖搜索 =====
  useEffect(() => {
    if (!createOpen) return;
    const kw = userKeyword.trim();
    const t = setTimeout(async () => {
      setUserSearching(true);
      try {
        const res = await adminApi.searchUsers(kw || undefined);
        const body = unwrap<{ users: ManualUser[] }>(res);
        setUserOptions(body.code === 0 ? body.data.users || [] : []);
      } catch {
        setUserOptions([]);
      } finally {
        setUserSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userKeyword, createOpen]);

  // ===== 手动建单：对话框打开时加载白名单套餐 =====
  useEffect(() => {
    if (!createOpen || pkgLoaded) return;
    setPkgLoading(true);
    adminApi
      .getPackagesPage({ page: 1, pageSize: 100 })
      .then((res) => {
        const body = unwrap<{ packages: PackageItem[] }>(res);
        if (body.code === 0) setPkgOptions(body.data.packages || []);
      })
      .catch(() => toast.error('套餐加载失败，请重试'))
      .finally(() => {
        setPkgLoading(false);
        setPkgLoaded(true);
      });
  }, [createOpen, pkgLoaded]);

  // ===== 手动建单：选择续费类型且已选用户时，加载该用户可续费（已到期）的 eSIM =====
  useEffect(() => {
    if (!createOpen || orderType !== 'renew' || !selectedUser) return;
    setSelectedEsim(null);
    setEsimLoading(true);
    adminApi
      .getEsims()
      .then((res) => {
        const body = unwrap<{ esims: ManualEsim[] }>(res);
        const list = body.code === 0 ? body.data.esims || [] : [];
        // 与后端续费校验一致：仅已到期（或无到期时间）的卡可续费
        const renewable = list.filter(
          (e) => e.user?.id === selectedUser.id && (!e.expireAt || new Date(e.expireAt).getTime() <= Date.now()),
        );
        setEsimOptions(renewable);
      })
      .catch(() => toast.error('eSIM 加载失败，请重试'))
      .finally(() => setEsimLoading(false));
  }, [createOpen, orderType, selectedUser]);

  const resetCreate = () => {
    setCreateOpen(false);
    setUserKeyword('');
    setUserOptions([]);
    setSelectedUser(null);
    setEmail('');
    setOrderType('new');
    setPkgKeyword('');
    setSelectedPkg(null);
    setEsimOptions([]);
    setSelectedEsim(null);
    setCreating(false);
    setCreateWarn('');
    setCreateResult(null);
    // 套餐缓存保留，避免反复打开重复拉取；关闭后下次直接复用
  };

  const pickUser = (u: ManualUser) => {
    setSelectedUser(u);
    // 自动带出用户注册邮箱（可手动修改）
    if (u.email) setEmail(u.email);
  };

  const filteredPkgs = pkgOptions.filter((p) => {
    const kw = pkgKeyword.trim().toLowerCase();
    if (!kw) return true;
    return [p.name, p.countryName, p.countryCode, `${p.gb}GB`, `${p.days}天`].some((v) =>
      String(v || '').toLowerCase().includes(kw),
    );
  });

  const submitCreate = async () => {
    if (!selectedUser) {
      toast.error('请先选择归属用户');
      return;
    }
    if (!selectedPkg) {
      toast.error('请选择套餐');
      return;
    }
    const em = email.trim();
    if (!em || !em.includes('@')) {
      toast.error('请填写有效的收款邮箱');
      return;
    }
    if (orderType === 'renew' && !selectedEsim) {
      toast.error('请选择续费目标 eSIM');
      return;
    }
    setCreating(true);
    setCreateWarn('');
    try {
      const res = await adminApi.createManualOrder({
        userId: selectedUser.id,
        pkgId: String((selectedPkg as any).tigerPkgId ?? selectedPkg.id),
        email: em,
        orderType,
        targetEsimId: orderType === 'renew' ? selectedEsim?.id : undefined,
      });
      const body = unwrap<{ order: ManualResult['order']; esim: ManualResult['esim'] }>(res);
      if (body.code === 0) {
        setCreateResult({ order: body.data.order, esim: body.data.esim });
        load();
      } else if (body.code === 2) {
        // 订单已建但 eSIM 下发失败：展示警告并刷新列表（订单已在列表中）
        setCreateWarn(body.message || '订单已创建，但 eSIM 下发失败');
        load();
      } else {
        toast.error(body.message || '创建失败，请重试');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '创建失败，请重试'));
    } finally {
      setCreating(false);
    }
  };

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

  // 后台主动退款条件：订单已支付（未退款）且套餐尚未激活
  const canManualRefund = (o: Order) => o.status === 'paid' && (!o.esim || o.esim.status === 'pending');

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

  const confirmManualRefund = async () => {
    if (!manualTarget) return;
    setManualRefunding(true);
    try {
      const res = await adminApi.manualRefund(manualTarget.orderNo, manualReason.trim() || undefined);
      const body = unwrap<any>(res);
      if (body.code !== 0) {
        toast.error(body.message || '退款失败，请重试');
        return;
      }
      toast.success('退款已完成');
      setManualTarget(null);
      setManualReason('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '退款失败，请重试'));
    } finally {
      setManualRefunding(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <Card className="panel-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] text-ink">订单列表</CardTitle>
            <p className="text-[12px] text-muted-foreground">共 {orders.length} 笔订单</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> 手动建单
            </Button>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" /> 刷新
            </Button>
          </div>
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
                  <TableHead className="w-24">退款记录</TableHead>
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
                            {o.pkgName || o.countryCode || '—'} {o.isUnlimited ? `不限量/${o.days ? `${o.days}天` : ''}` : `${o.gb ? `${o.gb}GB/` : ''}${o.days ? `${o.days}天` : ''}`}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{o.user?.nickname || o.user?.id || '未登录/未归属'}</TableCell>
                      <TableCell className="text-muted-foreground">{o.email || '—'}</TableCell>
                      <TableCell>{payMethodText[o.payMethod || ''] || '微信'}</TableCell>
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
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[12px] text-muted-foreground hover:text-ink"
                          onClick={() => setHistoryTarget(o)}
                        >
                          <History className="h-3.5 w-3.5" /> {(o.refundRequests || []).length} 条
                        </Button>
                      </TableCell>
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
                        ) : canManualRefund(o) ? (
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setManualTarget(o)}>
                            <RotateCcw className="h-4 w-4" /> 退款
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

      {/* 手动建单（免支付） */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && resetCreate()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>手动建单（免支付）</DialogTitle>
          </DialogHeader>

          {createResult ? (
            // 成功结果
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-relaxed text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-medium">订单已创建并完成履约</div>
                  <div className="mt-1 text-emerald-700">
                    eSIM 已下发到该用户账户，激活码邮件将发送至 {email.trim() || '用户邮箱'}。
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-4 text-[13px] leading-relaxed">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">订单号</span>
                  <span className="font-mono font-medium text-ink">{createResult.order.orderNo}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">套餐</span>
                  <span className="text-ink">
                    {createResult.order.pkgName || '—'}
                    {createResult.order.isUnlimited
                      ? ` 不限量/${createResult.order.days ?? 0}天`
                      : ` ${createResult.order.gb ?? 0}GB/${createResult.order.days ?? 0}天`}
                  </span>
                </div>
                {createResult.esim?.iccid ? (
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-muted-foreground">ICCID</span>
                    <span className="font-mono text-ink">{createResult.esim.iccid}</span>
                  </div>
                ) : null}
                {createResult.esim?.activationCode ? (
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-muted-foreground">激活码</span>
                    <span className="font-mono text-ink">{createResult.esim.activationCode}</span>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button onClick={resetCreate}>完成</Button>
              </DialogFooter>
            </div>
          ) : (
            // 表单
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/60 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
                为指定用户代建订单：与小程序下单完全一致（同校验、同 eSIM 下发与邮件通知），但无需支付，创建后立即生效。
              </div>

              {createWarn ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{createWarn}</span>
                </div>
              ) : null}

              {/* 归属用户 */}
              <div className="space-y-1.5">
                <Label className="text-[12.5px] text-muted-foreground">归属用户（必选）</Label>
                {selectedUser ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="min-w-0 text-[13px]">
                      <span className="font-medium text-ink">{selectedUser.nickname || '未设置昵称'}</span>
                      <span className="ml-2 text-[12px] text-muted-foreground">
                        {selectedUser.email || '无邮箱'} · {selectedUser.id.slice(0, 8)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[12px] text-muted-foreground"
                      onClick={() => {
                        setSelectedUser(null);
                        setEmail('');
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> 更换
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={userKeyword}
                        onChange={(e) => setUserKeyword(e.target.value)}
                        placeholder="输入昵称 / 邮箱 / 用户 ID 搜索"
                        className="pl-8"
                      />
                    </div>
                    {userKeyword.trim() || userOptions.length > 0 ? (
                      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border">
                        {userSearching ? (
                          <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">搜索中…</div>
                        ) : userOptions.length === 0 ? (
                          <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
                            {userKeyword.trim() ? '未找到匹配用户' : '输入关键词搜索用户'}
                          </div>
                        ) : (
                          userOptions.map((u) => (
                            <button
                              key={u.id}
                              className="flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-[13px] transition-colors last:border-b-0 hover:bg-muted"
                              onClick={() => pickUser(u)}
                            >
                              <span className="min-w-0">
                                <span className="font-medium text-ink">{u.nickname || '未设置昵称'}</span>
                                <span className="ml-2 text-[12px] text-muted-foreground">{u.email || '无邮箱'}</span>
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                {u.id.slice(0, 8)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 收款邮箱 */}
              <div className="space-y-1.5">
                <Label className="text-[12.5px] text-muted-foreground">收款邮箱（激活码邮件发送地址）</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>

              {/* 订单类型 */}
              <div className="space-y-1.5">
                <Label className="text-[12.5px] text-muted-foreground">订单类型</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={orderType === 'new' ? 'default' : 'outline'}
                    onClick={() => setOrderType('new')}
                  >
                    新购
                  </Button>
                  <Button
                    size="sm"
                    variant={orderType === 'renew' ? 'default' : 'outline'}
                    onClick={() => setOrderType('renew')}
                  >
                    续费
                  </Button>
                </div>
              </div>

              {/* 续费目标 eSIM */}
              {orderType === 'renew' ? (
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] text-muted-foreground">
                    续费目标 eSIM{selectedUser ? '（仅列出已到期的卡）' : '（请先选择归属用户）'}
                  </Label>
                  {!selectedUser ? (
                    <div className="rounded-lg border border-dashed px-3 py-3 text-center text-[12px] text-muted-foreground">
                      请先选择归属用户
                    </div>
                  ) : esimLoading ? (
                    <div className="rounded-lg border px-3 py-3 text-center text-[12px] text-muted-foreground">
                      加载中…
                    </div>
                  ) : esimOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-3 text-center text-[12px] text-muted-foreground">
                      该用户暂无可续费的已到期 eSIM
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto rounded-lg border">
                      {esimOptions.map((e) => (
                        <button
                          key={e.id}
                          className={`flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-[13px] transition-colors last:border-b-0 hover:bg-muted ${
                            selectedEsim?.id === e.id ? 'bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedEsim(e)}
                        >
                          <span className="min-w-0">
                            <span className="font-mono text-[12.5px] text-ink">{e.iccid || e.id}</span>
                            <span className="ml-2 text-[12px] text-muted-foreground">
                              {e.pkgName || '—'} {e.gb ? `${e.gb}GB/` : ''}{e.days ? `${e.days}天` : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11.5px] text-muted-foreground">
                            已到期 {e.expireAt ? `(${fmt(e.expireAt)})` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* 套餐 */}
              <div className="space-y-1.5">
                <Label className="text-[12.5px] text-muted-foreground">套餐（必选）</Label>
                {selectedPkg ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="min-w-0 text-[13px]">
                      <span className="font-medium text-ink">
                        {selectedPkg.countryName || selectedPkg.countryCode || selectedPkg.name || '套餐'}
                      </span>
                      <span className="ml-2 text-[12px] text-muted-foreground">
                        {selectedPkg.name ? `${selectedPkg.name} · ` : ''}
                        {selectedPkg.isUnlimited
                          ? `不限量/${selectedPkg.days}天`
                          : `${selectedPkg.gb}GB/${selectedPkg.days}天`}{' '}
                        · {selectedPkg.currency === 'USD' ? '$' : '¥'}
                        {selectedPkg.price}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[12px] text-muted-foreground"
                      onClick={() => setSelectedPkg(null)}
                    >
                      <X className="h-3.5 w-3.5" /> 更换
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={pkgKeyword}
                        onChange={(e) => setPkgKeyword(e.target.value)}
                        placeholder="搜索套餐（名称 / 国家 / 规格）"
                        className="pl-8"
                      />
                    </div>
                    <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border">
                      {pkgLoading ? (
                        <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">套餐加载中…</div>
                      ) : filteredPkgs.length === 0 ? (
                        <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
                          {pkgKeyword.trim() ? '未找到匹配套餐' : '暂无可售套餐'}
                        </div>
                      ) : (
                        filteredPkgs.map((p) => (
                          <button
                            key={p.tigerPkgId || p.id}
                            className="flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-[13px] transition-colors last:border-b-0 hover:bg-muted"
                            onClick={() => setSelectedPkg(p)}
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-ink">
                                {p.countryName || p.countryCode || '—'}
                              </span>
                              <span className="ml-2 text-[12px] text-muted-foreground">
                                {p.name ? `${p.name} · ` : ''}
                                {p.isUnlimited ? `不限量/${p.days}天` : `${p.gb}GB/${p.days}天`}
                              </span>
                            </span>
                            <span className="shrink-0 font-medium text-ink">
                              {p.currency === 'USD' ? '$' : '¥'}
                              {p.price}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetCreate}>
                  取消
                </Button>
                <Button onClick={submitCreate} disabled={creating}>
                  {creating ? '创建中…' : '确认建单'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
          {approveTarget?.payMethod === 'manual' ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-medium">注意：该订单为后台建单（免支付订单）。</span>
                退款不会产生真实资金退回，且 ICCID 会被永久列入黑名单。确定需要退款吗？
              </span>
            </div>
          ) : null}
          <div className="rounded-lg border p-3 text-[13px] leading-relaxed">
            <div className="text-muted-foreground">用户申请原因</div>
            <div className="mt-1 text-ink">{approveTarget?.refundReason || '—'}</div>
            <RefundImages raw={approveTarget?.refundImages} />
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
          <div className="rounded-lg border p-3 text-[13px] leading-relaxed">
            <div className="text-muted-foreground">用户申请原因</div>
            <div className="mt-1 text-ink">{rejectTarget?.refundReason || '—'}</div>
            <RefundImages raw={rejectTarget?.refundImages} />
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

      {/* 后台主动退款 */}
      <Dialog open={!!manualTarget} onOpenChange={(o) => !o && setManualTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>主动退款</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-4 text-[13px] leading-relaxed text-muted-foreground">
            确认对订单 <span className="font-mono font-medium text-ink">{manualTarget?.orderNo}</span>（¥
            {manualTarget?.price}）主动退款？退款将按原支付渠道原路退回；成功后该订单的 eSIM 将失效，ICCID 会被列入黑名单。
          </div>
          {manualTarget?.payMethod === 'manual' ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-medium">注意：该订单为后台建单（免支付订单）。</span>
                退款不会产生真实资金退回，且 ICCID 会被永久列入黑名单。确定需要退款吗？
              </span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] text-muted-foreground">备注原因（可选）</Label>
            <Textarea value={manualReason} rows={2} onChange={(e) => setManualReason(e.target.value)} placeholder="请输入备注原因" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmManualRefund} disabled={manualRefunding}>
              {manualRefunding ? '处理中…' : '确认退款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退款记录 */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>退款记录</DialogTitle>
          </DialogHeader>
          <div className="mb-2 text-[13px] text-muted-foreground">
            订单 <span className="font-mono font-medium text-ink">{historyTarget?.orderNo}</span>
            {historyTarget && (historyTarget.refundRequests || []).length === 0 && ' 暂无退款申请记录'}
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {(historyTarget?.refundRequests || []).map((r) => {
              const step = refundStepText[r.status] || refundStepText.requested;
              return (
                <div key={r.id} className="rounded-lg border p-3 text-[13px] leading-relaxed">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11.5px] font-medium ${step.cls}`}>
                      {step.text}
                    </span>
                    <span className="text-[12px] text-muted-foreground">{fmt(r.createdAt)}</span>
                  </div>
                  {r.reason ? (
                    <div className="mt-2">
                      <span className="text-muted-foreground">申请原因：</span>
                      <span className="text-ink">{r.reason}</span>
                    </div>
                  ) : null}
                  <RefundImages raw={r.images} />
                  {r.rejectReason ? (
                    <div className="mt-1">
                      <span className="text-muted-foreground">拒绝理由：</span>
                      <span className="text-ink">{r.rejectReason}</span>
                    </div>
                  ) : null}
                  {r.operator ? (
                    <div className="mt-1 text-[12px] text-muted-foreground">操作人：{r.operator}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}