'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
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
import { adminApi, unwrap, getErrorMessage, type PackageItem } from '@/api';

// 套餐表单字段与 TigerESIM 创建套餐接口对齐：name / amount(GB) / valid_days / region_id / sales / package_type
interface PackageForm {
  name: string;
  countryCode: string;
  gb: number; // amount，单位 GB
  days: number; // valid_days
  price: number; // sales
}

const defaultForm: PackageForm = {
  name: '',
  countryCode: '',
  gb: 1,
  days: 7,
  price: 0,
};

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 筛选条件状态
  const [filter, setFilter] = useState({ keyword: '', countryCode: '', onlyFeatured: false });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const [form, setForm] = useState<PackageForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PackageItem | null>(null);
  // 关联了 TigerESIM 的套餐，编辑/删除时提示前往 Tiger 后台操作
  const [tigerReminder, setTigerReminder] = useState<{ name: string; action: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  const applyFilter = () => {
    setPage(1);
    load();
  };

  const openAdd = () => {
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (p: PackageItem) => {
    // 所有套餐均实时来自 TigerESIM，本地不支持修改，统一引导前往 Tiger 后台
    setTigerReminder({ name: `${p.country?.name || p.countryCode} ${p.gb}GB/${p.days}天`, action: '编辑' });
  };

  const save = async () => {
    if (!form.countryCode) return toast.warning('请输入国家/区域代码');
    if (form.gb < 1) return toast.warning('流量必须大于 0');
    if (form.days < 1) return toast.warning('有效期必须大于 0');
    if (form.price < 0) return toast.warning('价格不能为负数');

    setSaving(true);
    // 直调 TigerESIM 创建套餐（字段与 createPackage 接口一致）
    const data = {
      name: form.name || `${form.countryCode} ${form.gb}GB/${form.days}天`,
      countryCode: form.countryCode.toUpperCase(),
      gb: form.gb,
      days: form.days,
      price: form.price,
      package_type: 'data',
    };
    try {
      const res = await adminApi.createPackage(data);
      const body = unwrap<{ tigerPkgId: number }>(res);
      toast.success(`已通过 TigerESIM 创建真实套餐（Tiger ID: ${body.data.tigerPkgId}）`);
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deletePackage(deleteTarget.id);
      toast.success('已删除');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '删除失败'));
    }
  };

  const syncFromTiger = async () => {
    setSyncing(true);
    try {
      const res = await adminApi.syncTigerPackages();
      const body = unwrap<{ matched: number; total: number; tigerTotal: number }>(res);
      if (body.code === 0) {
        toast.success(`同步成功：Tiger 共 ${body.data.tigerTotal} 个套餐，本地匹配 ${body.data.matched} 个，总计 ${body.data.total} 个`);
        load();
      } else {
        toast.error(body.message || '同步失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '同步失败'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      {/* 筛选条件卡片 —— 中文文案均以 UTF-8 硬编码 */}
      <Card className="border-transparent bg-white/70 backdrop-blur-sm">
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
            <Button size="sm" variant="outline" onClick={openAdd}>
              <Plus className="h-4 w-4" /> 添加套餐
            </Button>
            <Button size="sm" variant="secondary" onClick={syncFromTiger} disabled={syncing}>
              <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> 从 Tiger 导入
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-transparent bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-baseline justify-between text-[15px] text-ink">
            <span>套餐列表</span>
            <span className="text-[12px] font-normal text-muted-foreground">共 {total} 条</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {packages.length === 0 && !loading ? (
            <EmptyState title="暂无套餐" hint="可通过「从 Tiger 导入」或手动添加" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>国家</TableHead>
                    <TableHead>流量</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>价格</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>网络</TableHead>
                    <TableHead>Tiger ID</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.country?.flag && (
                            <img src={p.country.flag} alt={p.country?.name} className="h-4 w-6 rounded-sm object-cover" />
                          )}
                          <span className="font-medium text-ink">{p.country?.name || p.countryCode}</span>
                        </div>
                      </TableCell>
                      <TableCell>{p.gb}GB</TableCell>
                      <TableCell>{p.days}天</TableCell>
                      <TableCell className="font-medium text-emerald-700">¥{p.price}</TableCell>
                      <TableCell className="text-muted-foreground">{p.type}</TableCell>
                      <TableCell>
                        {p.tag ? (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                            style={{ background: p.tagColor || '#6f8f8b' }}
                          >
                            {p.tag}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell>{p.network}</TableCell>
                      <TableCell>
                        {p.tigerPkgId ? (
                          <span className="font-mono text-[12.5px]">{p.tigerPkgId}</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">未关联</span>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            p.tigerPkgId
                              ? setTigerReminder({ name: `${p.country?.name || p.countryCode} ${p.gb}GB/${p.days}天`, action: '删除' })
                              : setDeleteTarget(p)
                          }
                        >
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* 添加 / 编辑弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加套餐（直调 TigerESIM 创建）</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
            套餐数据以 TigerESIM 为准，创建后将实时生效，本地不存储套餐数据。
          </div>

          <Section title="Tiger 套餐信息" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="套餐名称">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 Japan 1GB 30Days" />
            </Field>
            <Field label="所属国家/区域代码">
              <Input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} placeholder="如 JP、US、GLOBAL" />
            </Field>
            <Field label="容量 (GB)">
              <NumberField value={form.gb} onChange={(v) => setForm({ ...form, gb: v })} min={1} max={1000} />
            </Field>
            <Field label="有效期 (天)">
              <NumberField value={form.days} onChange={(v) => setForm({ ...form, days: v })} min={1} max={365} />
            </Field>
            <Field label="售价 (¥)">
              <NumberField value={form.price} onChange={(v) => setForm({ ...form, price: v })} min={0} precision={2} step={0.1} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? '创建中…' : '创建套餐'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该套餐？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.country?.name || deleteTarget?.countryCode} {deleteTarget?.gb}GB / {deleteTarget?.days}天」，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tiger 关联套餐：编辑/删除提醒，需前往 TigerESIM 后台操作 */}
      <AlertDialog open={!!tigerReminder} onOpenChange={(o) => !o && setTigerReminder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>无法在本地上{tigerReminder?.action === '编辑' ? '修改' : '删除'}该套餐</AlertDialogTitle>
            <AlertDialogDescription>
              「{tigerReminder?.name}」来自 TigerESIM，套餐数据以 TigerESIM 后台为准。
              <br />
              <br />
              由于 TigerESIM 仅提供新增套餐接口，不提供本地{tigerReminder?.action === '编辑' ? '修改/删除' : '删除'}能力，请前往{' '}
              <span className="font-medium text-ink">TigerESIM 管理后台</span> 完成{tigerReminder?.action === '编辑' ? '修改' : '删除'}操作，
              再回到本页点击「从 Tiger 导入」同步数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>知道了</AlertDialogAction>
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