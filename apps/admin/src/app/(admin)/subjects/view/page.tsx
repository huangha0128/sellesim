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
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { price: string; markup: string; enabled: boolean }>>({});
  const [priceSaving, setPriceSaving] = useState<string | null>(null);
  const [addPriceOpen, setAddPriceOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [chosen, setChosen] = useState<CatalogItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newMarkup, setNewMarkup] = useState('');
  const [addingPrice, setAddingPrice] = useState(false);

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
          remark: s.remark || '',
        });
        setPrices(s.prices || []);
        setPriceDrafts(
          (s.prices || []).reduce<Record<string, { price: string; markup: string; enabled: boolean }>>(
            (acc, p) => {
              acc[p.pkgId] = {
                price: p.price != null ? String(p.price) : '',
                markup: p.markupPercent != null ? String(p.markupPercent) : '',
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

  const saveInfo = async () => {
    if (!editForm.name.trim()) return toast.warning('请输入主体名称');
    setSaving(true);
    try {
      const res = await adminApi.updateSubject(id, {
        name: editForm.name.trim(),
        contactName: editForm.contactName.trim() || null,
        contactPhone: editForm.contactPhone.trim() || null,
        callbackUrl: editForm.callbackUrl.trim() || null,
        defaultMarkupPercent: editForm.defaultMarkupPercent.trim() === '' ? null : Number(editForm.defaultMarkupPercent),
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
    if (priceVal != null && (!Number.isFinite(priceVal) || priceVal < 0)) return toast.warning('价格不合法');
    if (markupVal != null && !Number.isFinite(markupVal)) return toast.warning('加价比例不合法');
    setPriceSaving(p.pkgId);
    try {
      const res = await adminApi.setSubjectPrices(id, [{ pkgId: p.pkgId, price: priceVal, markupPercent: markupVal, enabled: d.enabled }]);
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
    if (priceVal != null && (!Number.isFinite(priceVal) || priceVal < 0)) return toast.warning('价格不合法');
    if (markupVal != null && !Number.isFinite(markupVal)) return toast.warning('加价比例不合法');
    setAddingPrice(true);
    try {
      const res = await adminApi.setSubjectPrices(id, [{ pkgId, price: priceVal, markupPercent: markupVal, enabled: true }]);
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
                <Field label="备注">
                  <Input value={editForm.remark} onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })} />
                </Field>
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
                缺省回落平台价。设置「固定售价」优先生效；否则按「加价比例」（基于平台价）计算；关闭「启用」后该主体将看不到此套餐。
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
                      <TableHead>启用</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.map((p) => {
                      const d = priceDrafts[p.pkgId] || { price: '', markup: '', enabled: true };
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
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Field label="固定售价（留空用加价比例或平台价）">
              <NumberField value={newPrice === '' ? 0 : Number(newPrice)} onChange={(v) => setNewPrice(String(v))} min={0} precision={2} step={0.1} />
            </Field>
            <Field label="加价比例（%）">
              <NumberField value={newMarkup === '' ? 0 : Number(newMarkup)} onChange={(v) => setNewMarkup(String(v))} min={0} precision={2} step={0.5} />
            </Field>
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