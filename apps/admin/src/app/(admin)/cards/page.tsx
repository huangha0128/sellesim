'use client';

import { useEffect, useState } from 'react';
import { Plus, Layers, CircleCheckBig, Clock3, ServerCog } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { adminApi, unwrap, getErrorMessage, type Card as CardType } from '@/api';

interface CardStats {
  total: number;
  available: number;
  used: number;
  envOnly: number;
}

function fmt(dt?: string) {
  if (!dt) return '-';
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN', { hour12: false });
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [stats, setStats] = useState<CardStats>({ total: 0, available: 0, used: 0, envOnly: 0 });
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addRemark, setAddRemark] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CardType | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCards();
      const data = unwrap<{ cards: CardType[]; stats: CardStats }>(res).data;
      setCards(data.cards);
      setStats(data.stats);
    } catch (e) {
      toast.error(getErrorMessage(e, '卡片列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    const iccids = addInput
      .split(/[\n,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (iccids.length === 0) return toast.warning('请至少输入一个 ICCID');
    setAdding(true);
    try {
      const res = await adminApi.addCards(iccids, addRemark.trim() || undefined);
      const data = unwrap<{ added: number; skipped: number }>(res).data;
      toast.success(`添加成功：${data.added} 张，跳过 ${data.skipped} 张重复`);
      setAddOpen(false);
      setAddInput('');
      setAddRemark('');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '添加失败'));
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteCard(deleteTarget.iccid);
      toast.success('删除成功');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '删除失败'));
    }
  };

  const statDefs = [
    { label: '卡片总数', value: stats.total, icon: <Layers size={22} />, color: '#6f8f8b' },
    { label: '可用', value: stats.available, icon: <CircleCheckBig size={22} />, color: '#5f8f76' },
    { label: '已使用', value: stats.used, icon: <Clock3 size={22} />, color: '#c58f6a' },
    { label: '仅环境变量', value: stats.envOnly, icon: <ServerCog size={22} />, color: '#7a95a8' },
  ];

  return (
    <div className="animate-fade-up space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statDefs.map((s, i) => (
          <Card key={s.label} className="border-transparent bg-white/70 backdrop-blur-sm animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: s.color }}>
                {s.icon}
              </div>
              <div>
                <div className="text-[26px] font-bold leading-none tracking-tight text-ink">{s.value}</div>
                <div className="mt-1.5 text-[13px] text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-transparent bg-white/70 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] text-ink">卡片池管理</CardTitle>
            <p className="text-[12px] text-muted-foreground">ICCID 卡片池，新增即时生效</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> 批量添加卡片
          </Button>
        </CardHeader>
        <CardContent>
          {cards.length === 0 && !loading ? (
            <EmptyState title="卡片池为空" hint="点击右上角「批量添加卡片」导入 ICCID" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-72">ICCID</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>添加时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((c) => (
                  <TableRow key={c.iccid}>
                    <TableCell className="font-mono text-[12.5px]">{c.iccid}</TableCell>
                    <TableCell className="text-muted-foreground">{c.remark || '—'}</TableCell>
                    <TableCell>{c.used ? <Badge variant="warning">已使用</Badge> : <Badge variant="success">可用</Badge>}</TableCell>
                    <TableCell>{fmt(c.createdAt)}</TableCell>
                    <TableCell align="right">
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

      {/* 批量添加 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>批量添加卡片</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-muted-foreground">ICCID 列表</Label>
              <Textarea
                value={addInput}
                rows={8}
                onChange={(e) => setAddInput(e.target.value)}
                placeholder="每行一个 ICCID，或逗号分隔"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-muted-foreground">备注（可选）</Label>
              <Input value={addRemark} onChange={(e) => setAddRemark(e.target.value)} placeholder="如：第一批采购" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? '添加中…' : '确认添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除卡片？</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 ICCID：<span className="font-mono font-medium text-ink">{deleteTarget?.iccid}</span>
              {deleteTarget?.used ? '该卡片已使用，删除后不影响已有 eSIM 业务。' : ''}
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