'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { adminApi, unwrap, getErrorMessage, type Country } from '@/api';

interface FormState {
  code: string;
  name: string;
  en: string;
  flag: string;
  pinyin: string;
  cat: string;
  hot: number;
  tier: number;
  intro: string;
}

const emptyForm: FormState = {
  code: '',
  name: '',
  en: '',
  flag: '',
  pinyin: '',
  cat: '',
  hot: 0,
  tier: 1,
  intro: '',
};

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Country | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (kw = keyword) => {
    try {
      const res = await adminApi.getCountries(kw ? { keyword: kw } : undefined);
      setCountries(unwrap<{ countries: Country[] }>(res).data.countries);
    } catch (e) {
      toast.error(getErrorMessage(e, '国家列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => {
    setLoading(true);
    load(keyword);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Country) => {
    setEditing(c);
    setForm({
      code: c.code || '',
      name: c.name || '',
      en: c.en || '',
      flag: c.flag || '',
      pinyin: c.pinyin || '',
      cat: c.cat || '',
      hot: c.hot || 0,
      tier: c.tier || 1,
      intro: c.intro || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.code) return toast.warning('请输入国家代码');
    setSaving(true);
    try {
      const data = { ...form };
      if (editing) {
        await adminApi.updateCountry(editing.code, data);
      } else {
        await adminApi.createCountry(data);
      }
      toast.success('保存成功');
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
      await adminApi.deleteCountry(deleteTarget.code);
      toast.success('已删除');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '删除失败'));
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      <Card className="border-transparent bg-white/70 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] text-ink">国家/地区列表</CardTitle>
            <p className="text-[12px] text-muted-foreground">共 {countries.length} 个国家/地区</p>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" /> 添加国家
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex max-w-sm items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="搜索国家名称 / 代码"
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={onSearch}>
              搜索
            </Button>
          </div>

          {countries.length === 0 && !loading ? (
            <EmptyState title="暂未配置国家" hint="点击右上角「添加国家」开始创建" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">国旗</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>英文</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>热度</TableHead>
                  <TableHead>价格等级</TableHead>
                  <TableHead>套餐数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell>{c.flag ? <img src={c.flag} alt={c.name} className="h-4 w-6 rounded-sm object-cover" /> : '—'}</TableCell>
                    <TableCell className="font-medium text-ink">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.en || '—'}</TableCell>
                    <TableCell>{c.cat || '—'}</TableCell>
                    <TableCell>{c.hot ?? 0}</TableCell>
                    <TableCell>T{c.tier ?? 1}</TableCell>
                    <TableCell>{c._count?.packages ?? c.packages?.length ?? 0}</TableCell>
                    <TableCell align="right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        编辑
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 添加 / 编辑弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑国家' : '添加国家'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="代码">
              <Input value={form.code} disabled={!!editing} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 JP" />
            </Field>
            <Field label="名称">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="英文">
              <Input value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} />
            </Field>
            <Field label="国旗 URL">
              <Input value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} />
            </Field>
            <Field label="拼音">
              <Input value={form.pinyin} onChange={(e) => setForm({ ...form, pinyin: e.target.value })} />
            </Field>
            <Field label="分类">
              <Input value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} />
            </Field>
            <Field label="热度">
              <NumberField value={form.hot} onChange={(v) => setForm({ ...form, hot: v })} min={0} max={100} />
            </Field>
            <Field label="价格等级">
              <NumberField value={form.tier} onChange={(v) => setForm({ ...form, tier: v })} min={1} max={4} />
            </Field>
            <div className="col-span-2">
              <Field label="简介">
                <Textarea value={form.intro} rows={2} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除国家？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name}」及其关联的所有套餐，此操作不可撤销。
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