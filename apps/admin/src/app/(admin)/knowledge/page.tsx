'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
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

interface KbEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
}

const CATEGORY_META: Record<string, { label: string; className: string }> = {
  install: { label: '安装激活', className: 'bg-teal-50 text-teal-600' },
  refund: { label: '退款', className: 'bg-amber-50 text-amber-600' },
  connection: { label: '上网连接', className: 'bg-blue-50 text-blue-600' },
  plan: { label: '流量套餐', className: 'bg-purple-50 text-purple-600' },
  order: { label: '订单', className: 'bg-sky-50 text-sky-600' },
  other: { label: '其它', className: 'bg-muted text-muted-foreground' },
};

const EMPTY_FORM = { category: 'other', question: '', answer: '', enabled: true, sortOrder: 0 };

export default function KnowledgePage() {
  const [list, setList] = useState<KbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [enabled, setEnabled] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminApi.getKbEntries({
        keyword: keyword || undefined,
        category: category === 'all' ? undefined : category,
        enabled: enabled === 'all' ? undefined : enabled,
      });
      const body = unwrap<{ list: KbEntry[] }>(res);
      setList(body.data.list || []);
    } catch (e) {
      if (!silent) toast.error(getErrorMessage(e, '加载知识库失败'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [keyword, category, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (e: KbEntry) => {
    setEditingId(e.id);
    setForm({ category: e.category, question: e.question, answer: e.answer, enabled: e.enabled, sortOrder: e.sortOrder });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.question.trim()) return toast.error('请输入问题');
    if (!form.answer.trim()) return toast.error('请输入答案');
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateKbEntry(editingId, form);
        toast.success('已保存');
      } else {
        await adminApi.createKbEntry(form);
        toast.success('已新增');
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (e: KbEntry, val: boolean) => {
    try {
      await adminApi.updateKbEntry(e.id, { enabled: val });
      setList((prev) => prev.map((x) => (x.id === e.id ? { ...x, enabled: val } : x)));
    } catch (err) {
      toast.error(getErrorMessage(err, '操作失败'));
    }
  };

  const remove = async (e: KbEntry) => {
    try {
      await adminApi.deleteKbEntry(e.id);
      toast.success('已删除');
      setList((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err) {
      toast.error(getErrorMessage(err, '删除失败'));
    }
  };

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">AI 知识库管理</h2>
        <span className="text-sm text-muted-foreground">
          AI 客服会检索这些词条作答；分类与快捷入口问题可在管理中维护。
        </span>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus size={14} className="mr-1" />新增词条
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
                placeholder="搜索关键词"
                className="w-52 pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {Object.entries(CATEGORY_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={enabled} onValueChange={setEnabled}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="true">启用</SelectItem>
                <SelectItem value="false">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无词条，点击右上角「新增词条」添加</p>
          ) : (
            <ul className="divide-y">
              {list.map((e) => {
                const cat = CATEGORY_META[e.category] || CATEGORY_META.other;
                return (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink truncate">{e.question}</span>
                        <Badge className={cn('shrink-0', cat.className)}>{cat.label}</Badge>
                        {!e.enabled && <Badge className="shrink-0 bg-muted text-muted-foreground">停用</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.answer}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch checked={e.enabled} onCheckedChange={(v) => toggle(e, !!v)} />
                      <Button variant="outline" size="icon" onClick={() => openEdit(e)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="outline" size="icon" className="text-destructive" onClick={() => remove(e)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑词条' : '新增词条'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-ink">分类</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">问题</label>
              <Input
                value={form.question}
                onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                placeholder="例如：如何安装 eSIM？"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink">答案</label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                placeholder="回答内容…"
                rows={5}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">启用</span>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: !!v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}