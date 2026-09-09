'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw, Tags, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NumberField } from '@/components/NumberField';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
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
import { adminApi, unwrap, getErrorMessage, type PackageItem, type CatalogItem, type Settings } from '@/api';

/** 存储货币符号：USD 用 $，其余（含缺省）用 ¥ */
function curSym(currency?: string): string {
  return currency === 'USD' ? '$' : '¥';
}

export default function PackagesPage() {
  // 白名单套餐列表（仅已添加、有价格的套餐）
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 筛选条件状态
  const [filter, setFilter] = useState({ keyword: '', countryCode: '', onlyFeatured: false });

  // 价格草稿 / 行内保存中 / 多选
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // 批量定价弹窗
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPriceMode, setBatchPriceMode] = useState<'keep' | 'set' | 'remove'>('keep');
  const [batchPrice, setBatchPrice] = useState('');
  const [batchSaleMode, setBatchSaleMode] = useState<'keep' | 'on' | 'off'>('keep');
  const [batchSaving, setBatchSaving] = useState(false);

  // 添加套餐（从 Tiger 全量挑选绑定）
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogFilter, setCatalogFilter] = useState({ keyword: '', countryCode: '' });
  const [chosen, setChosen] = useState<CatalogItem | null>(null);
  const [addPrice, setAddPrice] = useState('');
  const [addCurrency, setAddCurrency] = useState<'CNY' | 'USD'>('CNY');
  const [addSaving, setAddSaving] = useState(false);

  // 移出白名单确认
  const [removeTarget, setRemoveTarget] = useState<PackageItem | null>(null);
  const [removeSaving, setRemoveSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const isOffSale = (p: PackageItem) => p.onSale === false;

  // 单行改价（白名单内套餐，失焦触发）
  const saveRowPrice = async (p: PackageItem) => {
    if (!p.tigerPkgId) return;
    const raw = priceDrafts[String(p.tigerPkgId)] ?? String(p.price ?? '');
    const val = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(val)) {
      toast.warning('请输入有效价格');
      setPriceDrafts((d) => ({ ...d, [String(p.tigerPkgId)]: String(p.price ?? '') }));
      return;
    }
    if (val < 0) {
      toast.warning('价格不能为负数');
      setPriceDrafts((d) => ({ ...d, [String(p.tigerPkgId)]: String(p.price ?? '') }));
      return;
    }
    if (Math.abs(val - (p.price || 0)) < 1e-9) return; // 未变更
    setPriceSaving(p.tigerPkgId);
    try {
      const res = await adminApi.updatePackagePrice(p.tigerPkgId, { price: val });
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        toast.success(`已更新「${p.country?.name || p.countryCode} ${p.gb}GB/${p.days}天」售价 ${curSym(p.currency)}${val}`);
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

  // 单行切换上下架
  const toggleRowSale = async (p: PackageItem, onSale: boolean) => {
    if (!p.tigerPkgId) return;
    setPriceSaving(p.tigerPkgId);
    try {
      const res = await adminApi.updatePackagePrice(p.tigerPkgId, { onSale });
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        toast.success(onSale ? `已上架「${p.country?.name || p.countryCode} ${p.gb}GB/${p.days}天」` : `已停售「${p.country?.name || p.countryCode} ${p.gb}GB/${p.days}天」`);
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

  // 移出白名单
  const confirmRemove = async () => {
    if (!removeTarget?.tigerPkgId) return;
    setRemoveSaving(true);
    try {
      const res = await adminApi.clearPackagePrice(removeTarget.tigerPkgId);
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        toast.success(`「${removeTarget.country?.name || removeTarget.countryCode} ${removeTarget.gb}GB/${removeTarget.days}天」已从白名单移除，将不再展示`);
        setRemoveTarget(null);
        load();
      } else {
        toast.error(body.message || '操作失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '操作失败'));
    } finally {
      setRemoveSaving(false);
    }
  };

  // 批量定价提交
  const submitBatch = async () => {
    const ids = Array.from(selected).filter((id) => id > 0);
    if (ids.length === 0) return toast.warning('请先勾选套餐');
    let setPrice: number | null = null;
    if (batchPriceMode === 'set') {
      setPrice = Number(batchPrice);
      if (!Number.isFinite(setPrice) || setPrice < 0) return toast.warning('请输入有效的统一售价');
    }
    if (batchPriceMode === 'remove') setPrice = null; // price=null 移出白名单
    const items = ids.map((tigerPkgId) => ({
      tigerPkgId,
      price: batchPriceMode === 'keep' ? undefined : setPrice,
      onSale: batchSaleMode === 'on' ? true : batchSaleMode === 'off' ? false : undefined,
    }));
    setBatchSaving(true);
    try {
      const res = await adminApi.batchUpdatePackagePrices(items);
      const body = unwrap<{ updated: number }>(res);
      if (body.code === 0) {
        toast.success(`已更新 ${body.data.updated} 个套餐`);
        setBatchOpen(false);
        setSelected(new Set());
        load();
      } else {
        toast.error(body.message || '批量更新失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '批量更新失败'));
    } finally {
      setBatchSaving(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const params: Record<string, unknown> = { page, pageSize };
    if (filter.keyword) params.keyword = filter.keyword;
    if (filter.countryCode) params.countryCode = filter.countryCode;
    if (filter.onlyFeatured) params.featured = '1';
    try {
      const res = await adminApi.getPackagesPage(params);
      const data = unwrap<{ packages: PackageItem[]; total: number }>(res).data;
      setPackages(data.packages || []);
      setTotal(data.total || 0);
      setPriceDrafts({});
    } catch (e) {
      toast.error(getErrorMessage(e, '套餐列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // 读取全局设置，用于「添加套餐」默认货币单位（跟随后台展示货币）
  useEffect(() => {
    adminApi
      .getSettings()
      .then((res) => {
        const data = unwrap<{ settings?: Settings }>(res).data?.settings;
        if (data) setAddCurrency(data.displayCurrency);
      })
      .catch(() => {
        /* 读取设置失败时保持默认 CNY */
      });
  }, []);

  const applyFilter = () => {
    setPage(1);
    load();
  };

  // 打开「添加套餐」弹窗并加载 Tiger 全量目录
  const openAdd = async () => {
    setAddOpen(true);
    setChosen(null);
    setAddPrice('');
    setCatalogFilter({ keyword: '', countryCode: '' });
    await loadCatalog();
  };

  const loadCatalog = async (filters?: { keyword?: string; countryCode?: string }) => {
    setAddLoading(true);
    const params: Record<string, unknown> = {};
    if (filters?.keyword) params.keyword = filters.keyword;
    if (filters?.countryCode) params.countryCode = filters.countryCode;
    try {
      const res = await adminApi.getPackageCatalog(params);
      const body = unwrap<{ catalog: CatalogItem[] }>(res);
      if (body.code === 0) setCatalog(body.data.catalog || []);
      else toast.error(body.message || '加载套餐目录失败');
    } catch (e) {
      toast.error(getErrorMessage(e, '加载套餐目录失败'));
    } finally {
      setAddLoading(false);
    }
  };

  const applyCatalogFilter = () => {
    loadCatalog({
      keyword: catalogFilter.keyword.trim(),
      countryCode: catalogFilter.countryCode.trim(),
    });
  };

  // 强制刷新 Tiger 套餐目录缓存后重载
  const refreshCatalog = async () => {
    setAddLoading(true);
    try {
      const res = await adminApi.refreshPackageCatalog();
      const body = unwrap<{ catalog: CatalogItem[] }>(res);
      if (body.code === 0) {
        setCatalog(body.data.catalog || []);
        toast.success(`已从 Tiger 刷新目录缓存，共 ${body.data.catalog?.length ?? 0} 条`);
      } else {
        toast.error(body.message || '刷新目录缓存失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '刷新目录缓存失败'));
    } finally {
      setAddLoading(false);
    }
  };

  // 提交添加：将选中的套餐写入白名单并设价
  const submitAdd = async () => {
    if (!chosen?.tigerPkgId) return toast.warning('请先从 Tiger 套餐中选择一个');
    const val = Number(addPrice);
    if (addPrice.trim() === '' || !Number.isFinite(val) || val < 0) {
      return toast.warning('请输入有效价格');
    }
    setAddSaving(true);
    try {
      const res = await adminApi.updatePackagePrice(chosen.tigerPkgId, { price: val, onSale: true, currency: addCurrency });
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        toast.success(`已添加「${chosen.country?.name || chosen.countryCode} ${chosen.gb}GB/${chosen.days}天」并设价 ${curSym(addCurrency)}${val}`);
        setAddOpen(false);
        load();
      } else {
        toast.error(body.message || '添加失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '添加失败'));
    } finally {
      setAddSaving(false);
    }
  };

  const syncFromTiger = async () => {
    setAddLoading(true);
    try {
      const res = await adminApi.syncTigerPackages();
      const body = unwrap<{ tigerTotal: number }>(res);
      if (body.code === 0) {
        toast.success(`同步成功：Tiger 共 ${body.data.tigerTotal} 个套餐`);
        load();
      } else {
        toast.error(body.message || '同步失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '同步失败'));
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      {/* 筛选条件卡片 */}
      <Card className="panel-card">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <Field label="关键词">
            <Input
              value={filter.keyword}
              onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
              placeholder="关键词 / 国家 / 描述"
              className="w-56"
            />
          </Field>
          <Field label="国家代码">
            <Input
              value={filter.countryCode}
              onChange={(e) => setFilter({ ...filter, countryCode: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
              placeholder="如 JP"
              className="w-36"
            />
          </Field>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="onlyFeatured"
              checked={filter.onlyFeatured}
              onCheckedChange={(v) => setFilter({ ...filter, onlyFeatured: v })}
            />
            <Label htmlFor="onlyFeatured">仅显示精选</Label>
          </div>
          <Button size="sm" onClick={applyFilter}>
            <Search className="h-4 w-4" /> 搜索
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selected.size === 0}
              onClick={() => setBatchOpen(true)}
            >
              <Tags className="h-4 w-4" />
              批量定价{selected.size > 0 ? `（${selected.size}）` : ''}
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> 添加套餐
            </Button>
            <Button size="sm" variant="secondary" onClick={syncFromTiger} disabled={addLoading}>
              <RefreshCw className={addLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> 从 Tiger 刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="panel-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-baseline justify-between text-[15px] text-ink">
            <span>套餐列表（仅展示已添加的套餐）</span>
            <span className="text-[12px] font-normal text-muted-foreground">共 {total} 条</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {packages.length === 0 && !loading ? (
            <EmptyState title="暂无套餐" hint="通过右上角「添加套餐」从 Tiger 套餐中挑选并定价" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-emerald-700"
                        checked={packages.length > 0 && packages.every((p) => p.tigerPkgId && selected.has(p.tigerPkgId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const next = new Set(selected);
                            packages.forEach((p) => p.tigerPkgId && next.add(p.tigerPkgId));
                            setSelected(next);
                          } else {
                            const next = new Set(selected);
                            packages.forEach((p) => p.tigerPkgId && next.delete(p.tigerPkgId));
                            setSelected(next);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>国家</TableHead>
                    <TableHead>流量</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>售价</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>Tiger ID</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => {
                    const tigerId = Number(p.tigerPkgId || 0);
                    const offSale = isOffSale(p);
                    const key = String(tigerId || p.id);
                    const draft = priceDrafts[key] ?? String(p.price ?? '');
                    return (
                      <TableRow key={key} className={offSale ? 'opacity-60' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-emerald-700"
                            checked={!!tigerId && selected.has(tigerId)}
                            disabled={!tigerId}
                            onChange={(e) => {
                              if (!tigerId) return;
                              const next = new Set(selected);
                              if (e.target.checked) next.add(tigerId);
                              else next.delete(tigerId);
                              setSelected(next);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {p.country?.flag && (
                              <img src={p.country.flag} alt={p.country?.name} className="h-4 w-6 rounded-sm object-cover" />
                            )}
                            <span className="font-medium text-ink">{p.country?.name || p.countryCode}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span>{p.gb}GB</span>
                            {p.isUnlimited && (
                              <span
                                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700"
                                style={{ background: 'rgba(217, 119, 6, 0.12)' }}
                                title="不限量套餐：高速流量用完后限速，仍可继续使用"
                              >
                                不限量
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{p.days}天</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-[12.5px] font-medium text-emerald-700">{curSym(p.currency)}</span>
                            <Input
                              className="h-7 w-20 px-1.5 text-[12.5px]"
                              value={draft}
                              disabled={!tigerId || priceSaving === tigerId}
                              onChange={(e) =>
                                setPriceDrafts((d) => ({ ...d, [key]: e.target.value }))
                              }
                              onBlur={() => saveRowPrice(p)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            />
                          </div>
                          <span className="mt-0.5 text-[11px] text-muted-foreground">{curSym(p.currency)} 存储</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Switch
                              checked={!offSale}
                              disabled={!tigerId || priceSaving === tigerId}
                              onCheckedChange={(v) => toggleRowSale(p, v)}
                            />
                            <span className={`text-[11px] ${offSale ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {offSale ? '已停售' : '在售'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.type}</TableCell>
                        <TableCell>
                          {p.tag ? (
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ background: p.tagColor || 'hsl(var(--primary))' }}
                            >
                              {p.tag}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[12.5px]">{p.tigerPkgId}</span>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRemoveTarget(p)}
                          >
                            移出
                          </Button>
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
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 20, 50, 100].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  条
                </div>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* 批量定价弹窗 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量定价（{selected.size} 个套餐）</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
            价格保存在本地 PackagePrice 表，不会修改 TigerESIM 原始数据；保存后对小程序 / H5 即时生效。停售的套餐仍保留在白名单但前端隐藏。
          </div>

          <Section title="售价设置" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="价格策略">
              <Select
                value={batchPriceMode}
                onValueChange={(v) => setBatchPriceMode(v as 'keep' | 'set' | 'remove')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">保持不变</SelectItem>
                  <SelectItem value="set">统一设置为指定价格</SelectItem>
                  <SelectItem value="remove">移出白名单（不再展示）</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {batchPriceMode === 'set' && (
              <Field label="统一售价 (¥)">
                <NumberField value={batchPrice === '' ? 0 : Number(batchPrice)} onChange={(v) => setBatchPrice(String(v))} min={0} precision={2} step={0.1} />
              </Field>
            )}
          </div>

          <Section title="上架状态" />
          <Field label="上下架">
            <Select
              value={batchSaleMode}
              onValueChange={(v) => setBatchSaleMode(v as 'keep' | 'on' | 'off')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">保持不变</SelectItem>
                <SelectItem value="on">全部上架</SelectItem>
                <SelectItem value="off">全部停售</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button onClick={submitBatch} disabled={batchSaving}>
              {batchSaving ? '保存中…' : '确认批量设置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加套餐弹窗：从 Tiger 全量挑选并定价 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加套餐（从 TigerESIM 套餐中挑选）</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
            套餐内容实时来自 TigerESIM，此处仅需为其设定自定义价格即可加入白名单；只有添加后的套餐才会在小程序与后台展示。
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="关键词">
              <Input
                value={catalogFilter.keyword}
                onChange={(e) => setCatalogFilter({ ...catalogFilter, keyword: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && applyCatalogFilter()}
                placeholder="关键词 / 套餐ID / 描述"
                className="w-48"
              />
            </Field>
            <Field label="国家代码">
              <Input
                value={catalogFilter.countryCode}
                onChange={(e) => setCatalogFilter({ ...catalogFilter, countryCode: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && applyCatalogFilter()}
                placeholder="如 JP"
                className="w-32"
              />
            </Field>
            <Button size="sm" onClick={applyCatalogFilter} disabled={addLoading}>
              <Search className="h-4 w-4" /> 搜索
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshCatalog}
              disabled={addLoading}
            >
              <RefreshCw className={`h-4 w-4 ${addLoading ? 'animate-spin' : ''}`} /> 刷新缓存
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {addLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在拉取 Tiger 套餐…
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
                    <TableHead>类型</TableHead>
                    <TableHead>Tiger ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog.map((c) => {
                    const selectedThis = chosen?.tigerPkgId === Number(c.tigerPkgId);
                    const alreadyAdded = c.added;
                    return (
                      <TableRow
                        key={String(c.tigerPkgId || c.id)}
                        className={alreadyAdded ? 'opacity-50' : selectedThis ? 'bg-emerald-50' : 'cursor-pointer'}
                        onClick={() => !alreadyAdded && !addSaving && setChosen(c)}
                      >
                        <TableCell>
                          {alreadyAdded ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Check className="h-3 w-3" /> 已添加
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
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span>{c.gb}GB</span>
                            {c.isUnlimited && (
                              <span
                                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700"
                                style={{ background: 'rgba(217, 119, 6, 0.12)' }}
                                title="不限量套餐：高速流量用完后限速，仍可继续使用"
                              >
                                不限量
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{c.days}天</TableCell>
                        <TableCell className="text-muted-foreground">{c.type}</TableCell>
                        <TableCell>
                          <div className="flex flex-col font-mono text-[12.5px]">
                            <span>ID: {c.tigerPkgId}</span>
                            {c.tigerPid && c.tigerPid !== String(c.tigerPkgId) && (
                              <span className="text-muted-foreground">PID: {c.tigerPid}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <Section title="为所选套餐设定售价" />
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
            <Field label="货币单位">
              <Select value={addCurrency} onValueChange={(v) => setAddCurrency(v as 'CNY' | 'USD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">人民币（¥）</SelectItem>
                  <SelectItem value="USD">美元（$）</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={`售价 (${curSym(addCurrency)})`}>
              <NumberField value={addPrice === '' ? 0 : Number(addPrice)} onChange={(v) => setAddPrice(String(v))} min={0} precision={2} step={0.1} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>
              取消
            </Button>
            <Button onClick={submitAdd} disabled={addSaving || !chosen}>
              {addSaving ? '添加中…' : '添加并定价'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移出白名单确认 */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认将该套餐移出白名单？</AlertDialogTitle>
            <AlertDialogDescription>
              将移除「{removeTarget?.country?.name || removeTarget?.countryCode} {removeTarget?.gb}GB / {removeTarget?.days}天」。移出后该套餐将不再在小程序与后台展示（TigerESIM 中的原始套餐不受影响），此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmRemove} disabled={removeSaving}>
              {removeSaving ? '移除中…' : '确认移出'}
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

function Section({ title }: { title: string }) {
  return (
    <div className="mt-1 flex items-center gap-3">
      <span className="text-[13px] font-semibold text-ink">{title}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}