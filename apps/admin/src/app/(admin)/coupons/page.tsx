'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Ticket, Send, History, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { adminApi, unwrap, getErrorMessage } from '@/api';
import { cn } from '@/lib/utils';

interface Coupon {
  id: string;
  name: string;
  code: string | null;
  type: string; // fixed | percent
  amount: number | null;
  percent: number | null;
  minSpend: number;
  totalQuota: number | null;
  usedCount: number;
  perUserLimit: number;
  status: string; // active | disabled
  expireType: string; // date | days | never
  validFrom: string | null;
  validUntil: string | null;
  validDays: number | null;
  remark: string | null;
  createdAt: string;
  _count: { userCoupons: number; redemptions: number };
}

interface Redemption {
  id: string;
  userId: string;
  orderNo: string;
  amount: number;
  createdAt: string;
  refundedAt: string | null;
  user: { id: string; email: string; nickname: string };
  userCoupon: { id: string; source: string } | null;
}

interface GrantInstance {
  id: string;
  userId: string;
  status: string;
  source: string;
  grantedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  user: { id: string; email: string; nickname: string };
}

const EMPTY_FORM = {
  name: '',
  code: '',
  type: 'fixed',
  amount: '',
  percent: '',
  minSpend: '0',
  totalQuota: '',
  perUserLimit: '1',
  expireType: 'never',
  validFrom: '',
  validUntil: '',
  validDays: '',
  remark: '',
};

function fmtMoney(n: number | null | undefined): string {
  return Number(n ?? 0).toFixed(2);
}

function fmtTime(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}

/** 券有效期描述 */
function expiryText(c: Coupon): string {
  if (c.expireType === 'date') {
    const from = c.validFrom ? ` ${fmtTime(c.validFrom)} 起` : '';
    return `${from}至 ${fmtTime(c.validUntil)}`;
  }
  if (c.expireType === 'days') return `发放后 ${c.validDays} 天内有效`;
  return '永久有效';
}

/** 券面额描述 */
function valueText(c: Coupon): string {
  if (c.type === 'fixed') return `¥${fmtMoney(c.amount)}`;
  const off = 100 - Number(c.percent ?? 0);
  return `${off === Math.floor(off) ? off : off.toFixed(1)} 折扣`;
}

export default function CouponsPage() {
  const [list, setList] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');

  // 新建/编辑
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // 发放
  const [grantFor, setGrantFor] = useState<Coupon | null>(null);
  const [grantText, setGrantText] = useState('');
  const [granting, setGranting] = useState(false);

  // 记录查看：usage | grants
  const [recordFor, setRecordFor] = useState<Coupon | null>(null);
  const [recordTab, setRecordTab] = useState<'usage' | 'grants'>('usage');
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [grants, setGrants] = useState<GrantInstance[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCoupons({
        keyword: keyword || undefined,
        status: status === 'all' ? undefined : status,
      });
      const body = unwrap<{ list: Coupon[] }>(res);
      setList(body.data.list || []);
    } catch (e) {
      toast.error(getErrorMessage(e, '加载优惠券失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code || '',
      type: c.type,
      amount: c.amount != null ? String(c.amount) : '',
      percent: c.percent != null ? String(c.percent) : '',
      minSpend: String(c.minSpend ?? 0),
      totalQuota: c.totalQuota != null ? String(c.totalQuota) : '',
      perUserLimit: String(c.perUserLimit ?? 1),
      expireType: c.expireType,
      // datetime-local 需要本地格式 YYYY-MM-DDTHH:mm
      validFrom: c.validFrom ? new Date(c.validFrom).toLocaleString('sv-SE', { hour12: false }).slice(0, 16) : '',
      validUntil: c.validUntil ? new Date(c.validUntil).toLocaleString('sv-SE', { hour12: false }).slice(0, 16) : '',
      validDays: c.validDays != null ? String(c.validDays) : '',
      remark: c.remark || '',
    });
    setDialogOpen(true);
  };

  const buildPayload = () => {
    const p: Record<string, unknown> = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      type: form.type,
      minSpend: Number(form.minSpend) || 0,
      totalQuota: form.totalQuota.trim() ? Number(form.totalQuota) : null,
      perUserLimit: Number(form.perUserLimit) || 1,
      expireType: form.expireType,
      remark: form.remark.trim() || null,
      status: 'active',
    };
    if (form.type === 'fixed') p.amount = Number(form.amount);
    else p.percent = Number(form.percent);
    if (form.expireType === 'date') {
      p.validFrom = form.validFrom || null;
      p.validUntil = form.validUntil;
    } else if (form.expireType === 'days') {
      p.validDays = Number(form.validDays);
    }
    return p;
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('请输入优惠券名称');
    if (form.type === 'fixed' && !(Number(form.amount) > 0)) return toast.error('请输入大于 0 的满减金额');
    if (form.type === 'percent' && !(Number(form.percent) > 0 && Number(form.percent) <= 100)) {
      return toast.error('折扣比例需在 1-100 之间');
    }
    if (form.expireType === 'date' && !form.validUntil) return toast.error('请选择过期日期');
    if (form.expireType === 'days' && !(Number(form.validDays) >= 1)) return toast.error('请输入有效天数');
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await adminApi.updateCoupon(editingId, payload);
        toast.success('已保存');
      } else {
        await adminApi.createCoupon(payload);
        toast.success('已创建');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Coupon) => {
    try {
      await adminApi.toggleCoupon(c.id);
      setList((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: x.status === 'active' ? 'disabled' : 'active' } : x)));
    } catch (e) {
      toast.error(getErrorMessage(e, '操作失败'));
    }
  };

  const remove = async (c: Coupon) => {
    if (!window.confirm(`确认删除优惠券「${c.name}」？仅未被领取/使用的券可删除`)) return;
    try {
      await adminApi.deleteCoupon(c.id);
      toast.success('已删除');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '删除失败'));
    }
  };

  const grant = async () => {
    if (!grantFor) return;
    const tokens = grantText
      .split(/[\n,，;；\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!tokens.length) return toast.error('请填写用户邮箱或 ID');
    const emails = tokens.filter((t) => t.includes('@'));
    const ids = tokens.filter((t) => !t.includes('@'));
    setGranting(true);
    try {
      const res = await adminApi.grantCoupon(grantFor.id, { emails, userIds: ids });
      const body = unwrap<{
        grantedCount: number;
        skipped: { user: string; reason: string }[];
        notFound: string[];
      }>(res);
      const parts = [`成功发放 ${body.data.grantedCount} 张`];
      if (body.data.notFound.length) parts.push(`未找到：${body.data.notFound.join('、')}`);
      if (body.data.skipped.length) {
        parts.push(`跳过：${body.data.skipped.map((s) => `${s.user}（${s.reason}）`).join('、')}`);
      }
      toast.success(parts.join('；'), { duration: 6000 });
      setGrantFor(null);
      setGrantText('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '发放失败'));
    } finally {
      setGranting(false);
    }
  };

  const openRecords = async (c: Coupon, tab: 'usage' | 'grants') => {
    setRecordFor(c);
    setRecordTab(tab);
    setRecordsLoading(true);
    try {
      if (tab === 'usage') {
        const res = await adminApi.getCouponRedemptions(c.id, { pageSize: 200 });
        const body = unwrap<{ list: Redemption[] }>(res);
        setRedemptions(body.data.list || []);
      } else {
        const res = await adminApi.getCouponGrants(c.id, { pageSize: 200 });
        const body = unwrap<{ list: GrantInstance[] }>(res);
        setGrants(body.data.list || []);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '加载记录失败'));
    } finally {
      setRecordsLoading(false);
    }
  };

  const grantStatusBadge = (s: string) => {
    if (s === 'unused') return <Badge className="bg-emerald-50 text-emerald-600">未使用</Badge>;
    if (s === 'used') return <Badge className="bg-blue-50 text-blue-600">已使用</Badge>;
    return <Badge className="bg-muted text-muted-foreground">已过期</Badge>;
  };

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">优惠券管理</h2>
        <span className="text-sm text-muted-foreground">
          满减/折扣券；支持兑换码与定向发放；退款后券自动返还用户账户。
        </span>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus size={14} className="mr-1" />新建优惠券
        </Button>
      </div>

      <Card className="panel-card">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索名称 / 兑换码"
                className="w-52 pl-8"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="disabled">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无优惠券，点击右上角「新建优惠券」创建</p>
          ) : (
            <ul className="divide-y">
              {list.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Ticket size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{c.name}</span>
                        <Badge className="bg-primary/10 text-primary">{valueText(c)}</Badge>
                        {c.status === 'disabled' && (
                          <Badge className="bg-muted text-muted-foreground">已停用</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.code ? (
                          <>
                            兑换码 <span className="font-mono font-medium text-ink">{c.code}</span> ·{' '}
                          </>
                        ) : (
                          '仅发放 · '
                        )}
                        {expiryText(c)} · 满 ¥{fmtMoney(c.minSpend)} 可用 · 每人限 {c.perUserLimit} 张 ·
                        已用 {c.usedCount}
                        {c.totalQuota != null ? `/${c.totalQuota}` : '（不限量）'} · 已发放 {c._count.userCoupons} 张
                      </p>
                      {c.remark && <p className="mt-0.5 truncate text-xs text-muted-foreground">备注：{c.remark}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch checked={c.status === 'active'} onCheckedChange={() => toggle(c)} />
                      <Button variant="outline" size="sm" onClick={() => { setGrantFor(c); setGrantText(''); }}>
                        <Send size={13} className="mr-1" />发放
                      </Button>
                      <Button variant="outline" size="icon" title="使用记录" onClick={() => openRecords(c, 'usage')}>
                        <History size={14} />
                      </Button>
                      <Button variant="outline" size="icon" title="领取记录" onClick={() => openRecords(c, 'grants')}>
                        <UsersRound size={14} />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openEdit(c)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="outline" size="icon" className="text-destructive" onClick={() => remove(c)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑优惠券' : '新建优惠券'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-ink">名称</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="例如：新客立减 10 元" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">兑换码（可选）</label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="留空则仅通过后台发放；填写后用户可在下单页输入使用"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-ink">类型</label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">满减券（元）</SelectItem>
                    <SelectItem value="percent">折扣券（%）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-ink">{form.type === 'fixed' ? '面额（元）' : '折扣比例（%）'}</label>
                <Input
                  type="number"
                  value={form.type === 'fixed' ? form.amount : form.percent}
                  onChange={(e) =>
                    setForm((f) => (form.type === 'fixed' ? { ...f, amount: e.target.value } : { ...f, percent: e.target.value }))
                  }
                  placeholder={form.type === 'fixed' ? '10' : '20 表示 8 折'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-ink">使用门槛（元，0 不限）</label>
                <Input type="number" value={form.minSpend} onChange={(e) => setForm((f) => ({ ...f, minSpend: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-ink">每人限领/限用（次）</label>
                <Input type="number" value={form.perUserLimit} onChange={(e) => setForm((f) => ({ ...f, perUserLimit: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-ink">发放总量（留空不限）</label>
                <Input type="number" value={form.totalQuota} onChange={(e) => setForm((f) => ({ ...f, totalQuota: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-ink">过期方式</label>
                <Select value={form.expireType} onValueChange={(v) => setForm((f) => ({ ...f, expireType: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">永久有效</SelectItem>
                    <SelectItem value="date">指定过期日期</SelectItem>
                    <SelectItem value="days">发放 N 天后过期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.expireType === 'date' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-ink">生效时间（可选）</label>
                  <Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-ink">过期时间</label>
                  <Input type="datetime-local" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
                </div>
              </div>
            )}
            {form.expireType === 'days' && (
              <div>
                <label className="mb-1 block text-sm text-ink">发放后有效天数</label>
                <Input type="number" value={form.validDays} onChange={(e) => setForm((f) => ({ ...f, validDays: e.target.value }))} placeholder="例如 30" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-ink">备注（可选）</label>
              <Input value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 发放弹窗 */}
      <Dialog open={!!grantFor} onOpenChange={(v) => !v && setGrantFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>发放「{grantFor?.name}」</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              每行一个用户邮箱或用户 ID，也支持逗号/空格分隔。超出每人限领数量的用户将被跳过。
              {grantFor && (
                <>
                  {' '}有效期：{expiryText(grantFor)}
                </>
              )}
            </p>
            <Textarea
              rows={6}
              value={grantText}
              onChange={(e) => setGrantText(e.target.value)}
              placeholder={'user@example.com\nuser2@example.com'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantFor(null)}>取消</Button>
            <Button onClick={grant} disabled={granting}>{granting ? '发放中…' : '确认发放'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 使用/领取记录弹窗 */}
      <Dialog open={!!recordFor} onOpenChange={(v) => !v && setRecordFor(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>{recordFor?.name}</DialogTitle>
              <Select value={recordTab} onValueChange={(v) => recordFor && openRecords(recordFor, v as 'usage' | 'grants')}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usage">使用记录</SelectItem>
                  <SelectItem value="grants">领取记录</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>
          {recordsLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          ) : recordTab === 'usage' ? (
            redemptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无使用记录</p>
            ) : (
              <ul className="divide-y text-sm">
                {redemptions.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="min-w-0 flex-1 truncate text-ink">{r.user?.email || r.user?.nickname || r.userId}</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.orderNo}</span>
                    <Badge variant="outline" className="text-primary">-¥{fmtMoney(r.amount)}</Badge>
                    {r.refundedAt ? (
                      <Badge className="bg-muted text-muted-foreground">已退回</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{fmtTime(r.createdAt)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : grants.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无领取记录</p>
          ) : (
            <ul className="divide-y text-sm">
              {grants.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 flex-1 truncate text-ink">{g.user?.email || g.user?.nickname || g.userId}</span>
                  <span className="text-xs text-muted-foreground">{g.source === 'code' ? '兑换码退回' : '后台发放'}</span>
                  {grantStatusBadge(g.status)}
                  <span className="text-xs text-muted-foreground">到期：{fmtTime(g.expiresAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
