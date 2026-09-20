'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  KeyRound,
  Plus,
  Save,
  Search,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberField } from '@/components/NumberField';
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
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  adminApi,
  unwrap,
  getErrorMessage,
  type Subject,
  type SubjectKey,
  type SubjectPackagePrice,
  type SubjectLedgerEntry,
  type CatalogItem,
} from '@/api';

/** 脱敏 keyId 在详情返回中已处理，用于展示开关 */
export default function SubjectDetailPage() {
  const [id, setId] = useState<string>('');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);

  // 静态导出下动态路由无法用 [id]，改为查询参数 ?id=xxx 客户端读取
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('id') || '';
    setId(sid);
  }, []);

  // 信息编辑
  const [editForm, setEditForm] = useState({
    name: '',
    contactName: '',
    contactPhone: '',
    callbackUrl: '',
    defaultMarkupPercent: '',
    quotaLimit: '',
    splitPercent: '',
    remark: '',
  });
  const [saving, setSaving] = useState(false);

  // 密钥
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [keyMode, setKeyMode] = useState<'live' | 'test'>('live');
  const [keyName, setKeyName] = useState('');
  const [keyCreating, setKeyCreating] = useState(false);
  const [secretDisplay, setSecretDisplay] = useState<{ keyId: string; keySecret: string; mode: string; act: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<SubjectKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SubjectKey | null>(null);
  const [keySaving, setKeySaving] = useState(false);

  // 定价
  const [prices, setPrices] = useState<SubjectPackagePrice[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<
    Record<string, { price: string; markup: string; cost: string; enabled: boolean }>
  >({});
  const [priceSaving, setPriceSaving] = useState<string | null>(null);
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [chosen, setChosen] = useState<CatalogItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newMarkup, setNewMarkup] = useState('');
  const [newCost, setNewCost] = useState('');
  const [addingPrice, setAddingPrice] = useState(false);

  // 记账流水（Open Platform v3）
  const [ledger, setLedger] = useState<SubjectLedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(20);
  const [ledgerType, setLedgerType] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // 授信额度操作（结清 / 调整）
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settleSaving, setSettleSaving] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSubject(id);
      const body = unwrap<{ subject: Subject }>(res);
      if (body.code === 0) {
        const s = body.data.subject;
        setSubject(s);
        setEditForm({
          name: s.name,
          contactName: s.contactName || '',
          contactPhone: s.contactPhone || '',
          callbackUrl: s.callbackUrl || '',
          defaultMarkupPercent: s.defaultMarkupPercent != null ? String(s.defaultMarkupPercent) : '',
          quotaLimit: s.quotaLimit != null ? String(s.quotaLimit) : '',
          splitPercent: s.splitPercent != null ? String(s.splitPercent) : '',
          remark: s.remark || '',
        });
        setPrices(s.prices || []);
        setPriceDrafts(
          (s.prices || []).reduce<Record<string, { price: string; markup: string; cost: string; enabled: boolean }>>(
            (acc, p) => {
              acc[p.pkgId] = {
                price: p.price != null ? String(p.price) : '',
                markup: p.markupPercent != null ? String(p.markupPercent) : '',
                cost: p.costPrice != null ? String(p.costPrice) : '',
                enabled: p.enabled !== false,
              };
              return acc;
            },
            {},
          ),
        );
      } else {
        toast.error(body.message || '加载失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 加载记账流水
  const loadLedger = async () => {
    if (!id) return;
    setLedgerLoading(true);
    try {
      const res = await adminApi.getSubjectLedger(id, {
        page: ledgerPage,
        pageSize: ledgerPageSize,
        type: ledgerType || undefined,
      });
      const body = unwrap<{ ledger: SubjectLedgerEntry[]; total: number; page: number; pageSize: number }>(res);
      if (body.code === 0) {
        setLedger(body.data.ledger || []);
        setLedgerTotal(body.data.total || 0);
      } else {
        toast.error(body.message || '流水加载失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '流水加载失败'));
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ledgerPage, ledgerPageSize, ledgerType]);

  const submitSettle = async () => {
    const amount = Number(settleAmount);
    if (!amount || amount <= 0 || !Number.isFinite(amount)) return toast.warning('请输入有效的结清金额');
    setSettleSaving(true);
    try {
      const res = await adminApi.settleSubject(id, { amount, note: settleNote.trim() || undefined });
      const body = unwrap<{ usedQuota: number }>(res);
      if (body.code === 0) {
        toast.success('已结清记账');
        setSettleOpen(false);
        setSettleAmount('');
        setSettleNote('');
        load();
        if (ledgerPage === 1) loadLedger();
        else setLedgerPage(1);
      } else {
        toast.error(body.message || '结清失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '结清失败'));
    } finally {
      setSettleSaving(false);
    }
  };

  const submitAdj = async () => {
    const amount = Number(adjAmount);
    if (!amount || !Number.isFinite(amount)) return toast.warning('请输入有效的调整金额（带符号）');
    setAdjSaving(true);
    try {
      const res = await adminApi.adjustSubjectQuota(id, { amount, reason: adjReason.trim() || undefined });
      const body = unwrap<{ usedQuota: number }>(res);
      if (body.code === 0) {
        toast.success('已完成额度调整');
        setAdjOpen(false);
        setAdjAmount('');
        setAdjReason('');
        load();
        if (ledgerPage === 1) loadLedger();
        else setLedgerPage(1);
      } else {
        toast.error(body.message || '调整失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '调整失败'));
    } finally {
      setAdjSaving(false);
    }
  };

  const saveInfo = async () => {
    if (!editForm.name.trim()) return toast.warning('请输入主体名称');
    setSaving(true);
    try {
      const quotaLimitVal = editForm.quotaLimit.trim() === '' ? null : Number(editForm.quotaLimit);
      const splitVal = editForm.splitPercent.trim() === '' ? null : Number(editForm.splitPercent);
      if (quotaLimitVal != null && (!Number.isFinite(quotaLimitVal) || quotaLimitVal < 0)) return toast.warning('授信额度不合法');
      if (splitVal != null && (!Number.isFinite(splitVal) || splitVal < 0 || splitVal > 100)) return toast.warning('分成比例需在 0-100 之间');
      const res = await adminApi.updateSubject(id, {
        name: editForm.name.trim(),
        contactName: editForm.contactName.trim() || null,
        contactPhone: editForm.contactPhone.trim() || null,
        callbackUrl: editForm.callbackUrl.trim() || null,
        defaultMarkupPercent: editForm.defaultMarkupPercent.trim() === '' ? null : Number(editForm.defaultMarkupPercent),
        quotaLimit: quotaLimitVal,
        splitPercent: splitVal,
        remark: editForm.remark.trim() || null,
      });
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        toast.success('已保存主体信息');
        load();
      } else {
        toast.error(body.message || '保存失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!subject) return;
    const res = await adminApi.updateSubject(id, { status: subject.status === 'active' ? 'suspended' : 'active' });
    const body = unwrap<unknown>(res);
    if (body.code === 0) {
      toast.success(subject.status === 'active' ? '已停用主体' : '已启用主体');
      load();
    } else {
      toast.error(body.message || '操作失败');
    }
  };

  // ---- 密钥 ----
  const submitAddKey = async () => {
    setKeyCreating(true);
    try {
      const res = await adminApi.addSubjectKey(id, { mode: keyMode, name: keyName.trim() || 'default' });
      const body = unwrap<{ keyId: string; keySecret: string; mode: string }>(res);
      if (body.code === 0) {
        setAddKeyOpen(false);
        setKeyName('');
        setSecretDisplay({ keyId: body.data.keyId, keySecret: body.data.keySecret, mode: body.data.mode, act: '新增' });
        load();
        toast.success('已追加密钥');
      } else {
        toast.error(body.message || '失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '失败'));
    } finally {
      setKeyCreating(false);
    }
  };

  const confirmRotate = async () => {
    if (!rotateTarget) return;
    setKeySaving(true);
    try {
      const res = await adminApi.rotateSubjectKey(id, rotateTarget.keyId);
      const body = unwrap<{ keyId: string; keySecret: string }>(res);
      if (body.code === 0) {
        setRotateTarget(null);
        setSecretDisplay({ keyId: body.data.keyId, keySecret: body.data.keySecret, mode: rotateTarget.mode || 'live', act: '轮换' });
        load();
        toast.success('已轮换密钥，旧 secret 即时失效');
      } else {
        toast.error(body.message || '轮换失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '轮换失败'));
    } finally {
      setKeySaving(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setKeySaving(true);
    try {
      const res = await adminApi.revokeSubjectKey(id, revokeTarget.keyId);
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        setRevokeTarget(null);
        load();
        toast.success('已吊销密钥，立即失效');
      } else {
        toast.error(body.message || '吊销失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '吊销失败'));
    } finally {
      setKeySaving(false);
    }
  };

  // ---- 定价 ----
  const openAddPrice = async () => {
    setAddPriceOpen(true);
    setChosen(null);
    setNewPrice('');
    setNewMarkup('');
    setNewCost('');
    setCatFilter('');
    await loadCatalog();
  };

  const loadCatalog = async (keyword?: string) => {
    setCatLoading(true);
    try {
      const res = await adminApi.getPackageCatalog(keyword ? { keyword } : undefined);
      const body = unwrap<{ catalog: CatalogItem[] }>(res);
      if (body.code === 0) setCatalog(body.data.catalog || []);
      else toast.error(body.message || '加载套餐目录失败');
    } catch (e) {
      toast.error(getErrorMessage(e, '加载套餐目录失败'));
    } finally {
      setCatLoading(false);
    }
  };

  const removePrice = async (pkgId: string) => {
    const items = prices.filter((p) => p.pkgId !== pkgId).map((p) => ({
      pkgId: p.pkgId,
      price: p.price,
      markupPercent: p.markupPercent,
      costPrice: p.costPrice,
      enabled: p.enabled,
    }));
    setPriceSaving(pkgId);
    try {
      const res = await adminApi.setSubjectPrices(id, items);
      const body = unwrap<{ updated: number }>(res);
      if (body.code === 0) {
        toast.success('已移除该套餐定价，将回落平台价');
        load();
      } else {
        toast.error(body.message || '操作失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '操作失败'));
    } finally {
      setPriceSaving(null);
    }
  };

  const savePriceRow = async (p: SubjectPackagePrice) => {
    const d = priceDrafts[p.pkgId];
    if (!d) return;
    const priceVal = d.price.trim() === '' ? null : Number(d.price);
    const markupVal = d.markup.trim() === '' ? null : Number(d.markup);
    const costVal = d.cost.trim() === '' ? null : Number(d.cost);
    if (priceVal != null && (!Number.isFinite(priceVal) || priceVal < 0)) return toast.warning('价格不合法');
    if (markupVal != null && !Number.isFinite(markupVal)) return toast.warning('加价比例不合法');
    if (costVal != null && (!Number.isFinite(costVal) || costVal < 0)) return toast.warning('成本价不合法');
    setPriceSaving(p.pkgId);
    try {
      const res = await adminApi.setSubjectPrices(id, [
        { pkgId: p.pkgId, price: priceVal, markupPercent: markupVal, costPrice: costVal, enabled: d.enabled },
      ]);
      const body = unwrap<{ updated: number }>(res);
      if (body.code === 0) {
        toast.success(`已更新套餐 ${p.pkgId} 定价`);
        load();
      } else {
        toast.error(body.message || '保存失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '保存失败'));
    } finally {
      setPriceSaving(null);
    }
  };

  const submitAddPrice = async () => {
    if (!chosen) return toast.warning('请先选择套餐');
    const pkgId = String(chosen.tigerPkgId ?? chosen.id);
    const priceVal = newPrice.trim() === '' ? null : Number(newPrice);
    const markupVal = newMarkup.trim() === '' ? null : Number(newMarkup);
    const costVal = newCost.trim() === '' ? null : Number(newCost);
    if (priceVal != null && (!Number.isFinite(priceVal) || priceVal < 0)) return toast.warning('价格不合法');
    if (markupVal != null && !Number.isFinite(markupVal)) return toast.warning('加价比例不合法');
    if (costVal != null && (!Number.isFinite(costVal) || costVal < 0)) return toast.warning('成本价不合法');
    setAddingPrice(true);
    try {
      const res = await adminApi.setSubjectPrices(id, [
        { pkgId, price: priceVal, markupPercent: markupVal, costPrice: costVal, enabled: true },
      ]);
      const body = unwrap<{ updated: number }>(res);
      if (body.code === 0) {
        toast.success(`已为该主体添加套餐 ${pkgId} 的定价`);
        setAddPriceOpen(false);
        load();
      } else {
        toast.error(body.message || '添加失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '添加失败'));
    } finally {
      setAddingPrice(false);
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/subjects">
          <Button size="sm" variant="outline">
            <ArrowLeft className="h-4 w-4" /> 返回
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-ink">{subject?.name || '主体详情'}</h1>
          {subject && (
            subject.status === 'active' ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-700">
                启用
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11.5px] font-medium text-rose-600">
                已停用
              </span>
            )
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
        </div>
      ) : subject ? (
        <>
          {/* 基础信息 */}
          <Card className="panel-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-[15px] text-ink">
                <span>基础信息</span>
                <Button size="sm" variant="outline" onClick={toggleStatus}>
                  {subject.status === 'active' ? '停用主体' : '启用主体'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="主体名称">
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </Field>
                <Field label="状态">
                  <Input value={subject.status === 'active' ? 'active（启用）' : 'suspended（停用）'} readOnly />
                </Field>
                <Field label="联系人">
                  <Input value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })} />
                </Field>
                <Field label="联系电话">
                  <Input value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} />
                </Field>
              </div>
              <Field label="Webhook 回调地址">
                <Input
                  value={editForm.callbackUrl}
                  onChange={(e) => setEditForm({ ...editForm, callbackUrl: e.target.value })}
                  placeholder="https://agent-a.com/api/yyesim/webhook"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="默认加价比例（%）">
                  <NumberField
                    value={editForm.defaultMarkupPercent === '' ? 0 : Number(editForm.defaultMarkupPercent)}
                    onChange={(v) => setEditForm({ ...editForm, defaultMarkupPercent: String(v) })}
                    min={0}
                    precision={2}
                    step={0.5}
                  />
                </Field>
                <Field label="分成比例 %（临时方案，未定案）">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.splitPercent}
                    onChange={(e) => setEditForm({ ...editForm, splitPercent: e.target.value })}
                    placeholder="0-100，选填"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="授信额度上限（留空=不限，元）">
                  <Input
                    type="number"
                    min={0}
                    value={editForm.quotaLimit}
                    onChange={(e) => setEditForm({ ...editForm, quotaLimit: e.target.value })}
                    placeholder="留空表示不限"
                  />
                </Field>
                <Field label="备注">
                  <Input value={editForm.remark} onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })} />
                </Field>
              </div>
              {/* 授信额度概览 */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-5">
                <Stat label="账户余额" value={`¥${Number(subject.balance ?? 0).toLocaleString()}`} />
                <Stat label="授信额度" value={subject.quotaLimit != null ? `¥${Number(subject.quotaLimit).toLocaleString()}` : '无限'} />
                <Stat label="已用额度" value={`¥${Number(subject.usedQuota ?? 0).toLocaleString()}`} />
                <Stat
                  label="可透支"
                  value={
                    subject.quotaLimit != null
                      ? `¥${Math.max(0, Number(subject.quotaLimit) - Number(subject.usedQuota ?? 0)).toLocaleString()}`
                      : '—'
                  }
                />
                <Stat label="分成比例" value={subject.splitPercent != null ? `${subject.splitPercent}%` : '—'} />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={saveInfo} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 密钥管理 */}
          <Card className="panel-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-[15px] text-ink">
                <span>API 密钥（{subject.keys?.length ?? 0}）</span>
                <Button size="sm" onClick={() => setAddKeyOpen(true)}>
                  <Plus className="h-4 w-4" /> 追加密钥
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>keyId</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>模式</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subject.keys || []).map((k) => (
                    <TableRow key={k.id} className={k.enabled === false ? 'opacity-60' : ''}>
                      <TableCell className="font-mono text-[12.5px]">{k.keyId}</TableCell>
                      <TableCell>{k.name || 'default'}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[11.5px] text-muted-foreground">
                          <KeyRound className="h-3 w-3" /> {k.mode}
                        </span>
                      </TableCell>
                      <TableCell>
                        {k.enabled === false ? (
                          <span className="text-[12px] text-destructive">已吊销</span>
                        ) : (
                          <span className="text-[12px] text-emerald-700">有效</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {k.createdAt ? new Date(k.createdAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-1">
                          {k.enabled !== false && (
                            <Button size="sm" variant="ghost" onClick={() => setRotateTarget(k)}>
                              <RefreshCw className="h-4 w-4" /> 轮换
                            </Button>
                          )}
                          {k.enabled !== false && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setRevokeTarget(k)}
                            >
                              <Trash2 className="h-4 w-4" /> 吊销
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 授信额度操作 */}
          <Card className="panel-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] text-ink">授信额度操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
                绑定账号余额与授信额度关联；「结清记账」将已用额度清零（允许超额冲正），「额度调整」直接增减已用额度（正数为增加扣减，负数为冲回）。操作均记入下方流水。
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { setSettleAmount(''); setSettleNote(''); setSettleOpen(true); }}>
                  <RefreshCw className="h-4 w-4" /> 结清记账
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAdjAmount(''); setAdjReason(''); setAdjOpen(true); }}>
                  <Edit3 className="h-4 w-4" /> 额度调整
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 记账流水 */}
          <Card className="panel-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-[15px] text-ink">
                <span>记账流水（{ledgerTotal}）</span>
                <div className="w-40">
                  <Select
                    value={ledgerType || '__all'}
                    onValueChange={(v) => {
                      setLedgerPage(1);
                      setLedgerType(v === '__all' ? '' : v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">全部类型</SelectItem>
                      <SelectItem value="order_debit">授信透支</SelectItem>
                      <SelectItem value="balance_debit">余额扣款</SelectItem>
                      <SelectItem value="refund_credit">退款冲回</SelectItem>
                      <SelectItem value="balance_refund">退款回补</SelectItem>
                      <SelectItem value="deposit_credit">充值入账</SelectItem>
                      <SelectItem value="settle_credit">结清</SelectItem>
                      <SelectItem value="adjust">调整</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledgerLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
                </div>
              ) : ledger.length === 0 ? (
                <div className="py-10 text-center text-[12.5px] text-muted-foreground">暂无记账流水</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>类型</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>单号</TableHead>
                        <TableHead>备注</TableHead>
                        <TableHead>操作人</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((l) => {
                        const meta = LEDGER_META[l.type] || { label: l.type || '—', credit: false };
                        const signed = l.type === 'adjust' ? parseAdjSign(l.note) : meta.credit;
                        const display = signed ? `+¥${Number(l.amount).toLocaleString()}` : `-¥${Number(l.amount).toLocaleString()}`;
                        return (
                          <TableRow key={l.id}>
                            <TableCell>
                              <span
                                className={
                                  meta.credit
                                    ? 'text-[12.5px] font-medium text-emerald-700'
                                    : 'text-[12.5px] font-medium text-rose-600'
                                }
                              >
                                {meta.label}
                              </span>
                            </TableCell>
                            <TableCell className={signed ? 'font-medium text-emerald-700' : 'font-medium text-rose-600'}>
                              {display}
                            </TableCell>
                            <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                              {l.orderNo || l.refundNo || '—'}
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate text-muted-foreground">{l.note || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{l.operatorName || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      每页
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-[12px]"
                        value={ledgerPageSize}
                        onChange={(e) => {
                          setLedgerPageSize(Number(e.target.value));
                          setLedgerPage(1);
                        }}
                      >
                        {[10, 20, 50].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      条
                    </div>
                    {ledgerTotal > ledgerPageSize && (
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                              className={ledgerPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                            />
                          </PaginationItem>
                          <PaginationItem>
                            <span className="px-3 text-[12.5px] text-muted-foreground">
                              {ledgerPage} / {Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize))}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationNext
                              onClick={() =>
                                setLedgerPage((p) => Math.min(Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize)), p + 1))
                              }
                              className={
                                ledgerPage >= Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize))
                                  ? 'pointer-events-none opacity-50'
                                  : ''
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 套餐定价 */}
          <Card className="panel-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-[15px] text-ink">
                <span>套餐定价（{prices.length}）</span>
                <Button size="sm" onClick={openAddPrice}>
                  <Plus className="h-4 w-4" /> 添加定价
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
                缺省回落平台价。设置「固定售价」优先生效；否则按「加价比例」（基于平台价）计算；「成本价」作为结算基准参考。「启用」关闭后该主体将看不到此套餐。
              </div>
              {prices.length === 0 ? (
                <div className="py-8 text-center text-[12.5px] text-muted-foreground">
                  尚未为该主体配置任何套餐定价，将全部使用平台价。
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>套餐 ID</TableHead>
                      <TableHead>固定售价</TableHead>
                      <TableHead>加价比例（%）</TableHead>
                      <TableHead>成本价</TableHead>
                      <TableHead>启用</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.map((p) => {
                      const d = priceDrafts[p.pkgId] || { price: '', markup: '', cost: '', enabled: true };
                      return (
                        <TableRow key={p.pkgId}>
                          <TableCell className="font-mono text-[12.5px]">{p.pkgId}</TableCell>
                          <TableCell>
                            <Input
                              className="h-7 w-24 px-1.5 text-[12.5px]"
                              value={d.price}
                              disabled={priceSaving === p.pkgId}
                              onChange={(e) =>
                                setPriceDrafts((prev) => ({ ...prev, [p.pkgId]: { ...d, price: e.target.value } }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-7 w-24 px-1.5 text-[12.5px]"
                              value={d.markup}
                              disabled={priceSaving === p.pkgId}
                              onChange={(e) =>
                                setPriceDrafts((prev) => ({ ...prev, [p.pkgId]: { ...d, markup: e.target.value } }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-7 w-24 px-1.5 text-[12.5px]"
                              value={d.cost}
                              placeholder="留空"
                              disabled={priceSaving === p.pkgId}
                              onChange={(e) =>
                                setPriceDrafts((prev) => ({ ...prev, [p.pkgId]: { ...d, cost: e.target.value } }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={d.enabled}
                              disabled={priceSaving === p.pkgId}
                              onCheckedChange={(v) =>
                                setPriceDrafts((prev) => ({ ...prev, [p.pkgId]: { ...d, enabled: v } }))
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" disabled={priceSaving === p.pkgId} onClick={() => savePriceRow(p)}>
                                <Save className="h-4 w-4" /> 保存
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                disabled={priceSaving === p.pkgId}
                                onClick={() => removePrice(p.pkgId)}
                              >
                                <Trash2 className="h-4 w-4" /> 移除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="py-16 text-center text-muted-foreground">主体不存在</div>
      )}

      {/* 追加密钥弹窗 */}
      <Dialog open={addKeyOpen} onOpenChange={setAddKeyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>追加密钥</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="模式">
              <Select value={keyMode} onValueChange={(v) => setKeyMode(v as 'live' | 'test')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">live（生产）</SelectItem>
                  <SelectItem value="test">test（测试）</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="名称">
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="如 移动端 / 渠道A" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddKeyOpen(false)} disabled={keyCreating}>
              取消
            </Button>
            <Button onClick={submitAddKey} disabled={keyCreating}>
              {keyCreating ? '创建中…' : '生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 设定定价弹窗 */}
      <Dialog open={addPriceOpen} onOpenChange={setAddPriceOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>为该主体添加套餐定价</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="关键词">
              <Input
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCatalog(catFilter.trim())}
                placeholder="关键词 / 套餐ID / 描述"
                className="w-52"
              />
            </Field>
            <Button size="sm" onClick={() => loadCatalog(catFilter.trim())} disabled={catLoading}>
              <Search className="h-4 w-4" /> 搜索
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {catLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在拉取套餐…
              </div>
            ) : catalog.length === 0 ? (
              <div className="py-8 text-center text-[12.5px] text-muted-foreground">未找到套餐</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">选择</TableHead>
                    <TableHead>国家</TableHead>
                    <TableHead>套餐名称</TableHead>
                    <TableHead>流量</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>Tiger ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.map((c) => {
                    const pkgId = String(c.tigerPkgId ?? c.id);
                    const alreadySet = prices.some((p) => p.pkgId === pkgId);
                    const selectedThis = chosen?.tigerPkgId === c.tigerPkgId;
                    return (
                      <TableRow
                        key={pkgId}
                        className={alreadySet ? 'opacity-50' : selectedThis ? 'bg-emerald-50' : 'cursor-pointer'}
                        onClick={() => !alreadySet && !addingPrice && setChosen(c)}
                      >
                        <TableCell>
                          {alreadySet ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Check className="h-3 w-3" /> 已配置
                            </span>
                          ) : (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-emerald-700">
                              {selectedThis && <span className="h-2 w-2 rounded-sm bg-emerald-700" />}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.country?.flag && (
                              <img src={c.country.flag} alt={c.country?.name} className="h-4 w-6 rounded-sm object-cover" />
                            )}
                            <span className="font-medium text-ink">{c.country?.name || c.countryCode}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="max-w-[13rem] truncate text-ink">{c.name}</span>
                        </TableCell>
                        <TableCell>{c.gb}GB</TableCell>
                        <TableCell>{c.days}天</TableCell>
                        <TableCell className="font-mono text-[12.5px]">{c.tigerPkgId}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="已选套餐">
              <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-[13px] text-ink">
                {chosen ? (
                  <span className="truncate">
                    [{chosen.tigerPkgId}] {chosen.country?.name || chosen.countryCode} {chosen.name} · {chosen.gb}GB / {chosen.days}天
                  </span>
                ) : (
                  <span className="text-muted-foreground">未选择</span>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="固定售价">
                <NumberField value={newPrice === '' ? 0 : Number(newPrice)} onChange={(v) => setNewPrice(String(v))} min={0} precision={2} step={0.1} />
              </Field>
              <Field label="加价比例（%）">
                <NumberField value={newMarkup === '' ? 0 : Number(newMarkup)} onChange={(v) => setNewMarkup(String(v))} min={0} precision={2} step={0.5} />
              </Field>
              <Field label="成本价">
                <NumberField value={newCost === '' ? 0 : Number(newCost)} onChange={(v) => setNewCost(String(v))} min={0} precision={2} step={0.1} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPriceOpen(false)} disabled={addingPrice}>
              取消
            </Button>
            <Button onClick={submitAddPrice} disabled={addingPrice || !chosen}>
              {addingPrice ? '添加中…' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 一次性密钥展示（新增/轮换） */}
      <Dialog open={!!secretDisplay} onOpenChange={(o) => !o && setSecretDisplay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>密钥已{secretDisplay?.act === '轮换' ? '轮换' : '新增'}，仅展示一次</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
            该 keySecret 仅本次可见，关闭后不再显示。请立即复制保存，丢失只能再次轮换。
          </div>
          <div className="space-y-3">
            <Field label="keyId">
              <Input value={secretDisplay?.keyId || ''} readOnly className="font-mono" />
            </Field>
            <Field label="keySecret">
              <Input value={secretDisplay?.keySecret || ''} readOnly className="font-mono" />
            </Field>
            <Field label="模式">
              <Input value={secretDisplay?.mode || ''} readOnly />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecretDisplay(null)}>我已保存，关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 轮换确认 */}
      <AlertDialog open={!!rotateTarget} onOpenChange={(o) => !o && setRotateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认轮换密钥 {rotateTarget?.keyId}？</AlertDialogTitle>
            <AlertDialogDescription>
              轮换后旧 keySecret 立即失效，新 secret 仅展示一次。正在使用该密钥的接入方需切换到新密钥。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRotate} disabled={keySaving}>
              {keySaving ? '轮换中…' : '确认轮换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 吊销确认 */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认吊销密钥 {revokeTarget?.keyId}？</AlertDialogTitle>
            <AlertDialogDescription>
              吊销后该密钥立即失效，调用会返回 401。历史订单不受影响，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmRevoke} disabled={keySaving}>
              {keySaving ? '吊销中…' : '确认吊销'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 结清记账弹窗 */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>结清记账</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="结清金额（元）*">
              <Input
                type="number"
                min={0}
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="结清后已用额度清零"
              />
            </Field>
            <Field label="备注">
              <Input value={settleNote} onChange={(e) => setSettleNote(e.target.value)} placeholder="选填" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)} disabled={settleSaving}>
              取消
            </Button>
            <Button onClick={submitSettle} disabled={settleSaving}>
              {settleSaving ? '提交中…' : '确认结清'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 额度调整弹窗 */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>额度调整</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="调整金额（元，带符号）*">
              <Input
                type="number"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="正数增加扣减，负数冲回"
              />
            </Field>
            <Field label="原因">
              <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="选填" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)} disabled={adjSaving}>
              取消
            </Button>
            <Button onClick={submitAdj} disabled={adjSaving}>
              {adjSaving ? '提交中…' : '确认调整'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}

// 记账流水类型 → 中文标签，credit=true 表示冲回/结清（绿色+），否则为扣额（红色-）
const LEDGER_META: Record<string, { label: string; credit: boolean }> = {
  order_debit: { label: '授信透支', credit: false },
  balance_debit: { label: '余额扣款', credit: false },
  refund_credit: { label: '退款冲回', credit: true },
  balance_refund: { label: '退款回补', credit: true },
  deposit_credit: { label: '充值入账', credit: true },
  settle_credit: { label: '结清', credit: true },
  adjust: { label: '调整', credit: false },
};

// 调整流水的正负号记录在备注「增减:X」中，据此还原符号
function parseAdjSign(note?: string | null): boolean {
  if (!note) return false;
  const m = note.match(/增减:([+-]?\d+(?:\.\d+)?)/);
  if (!m) return false;
  return Number(m[1]) >= 0;
}