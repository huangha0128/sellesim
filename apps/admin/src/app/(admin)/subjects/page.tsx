'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, KeyRound, Eye, Power } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { adminApi, unwrap, getErrorMessage, type Subject } from '@/api';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // 创建主体弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    contactPhone: '',
    callbackUrl: '',
    defaultMarkupPercent: '',
    quotaLimit: '',
    splitPercent: '',
    remark: '',
  });
  const [creating, setCreating] = useState(false);

  // 创建成功：一次性展示 keySecret
  const [createdSecret, setCreatedSecret] = useState<{
    name: string;
    keyId: string;
    keySecret: string;
    mode: string;
  } | null>(null);

  // 停用确认
  const [suspendTarget, setSuspendTarget] = useState<Subject | null>(null);
  const [suspendSaving, setSuspendSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSubjects();
      const data = unwrap<{ subjects: Subject[] }>(res).data;
      setSubjects(data.subjects || []);
    } catch (e) {
      toast.error(getErrorMessage(e, '主体列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ name: '', contactName: '', contactPhone: '', callbackUrl: '', defaultMarkupPercent: '', quotaLimit: '', splitPercent: '', remark: '' });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return toast.warning('请输入主体名称');
    setCreating(true);
    try {
      const res = await adminApi.createSubject({
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        callbackUrl: form.callbackUrl.trim() || undefined,
        defaultMarkupPercent:
          form.defaultMarkupPercent.trim() === '' ? undefined : Number(form.defaultMarkupPercent),
        quotaLimit: form.quotaLimit.trim() === '' ? null : Number(form.quotaLimit),
        splitPercent: form.splitPercent.trim() === '' ? undefined : Number(form.splitPercent),
        remark: form.remark.trim() || undefined,
      });
      const body = unwrap<{ id: string; name: string; status: string; key: { keyId: string; keySecret: string; mode: string } }>(res);
      if (body.code === 0) {
        setCreateOpen(false);
        setCreatedSecret({
          name: body.data.name,
          keyId: body.data.key.keyId,
          keySecret: body.data.key.keySecret,
          mode: body.data.key.mode,
        });
        load();
        toast.success(`主体「${body.data.name}」已创建`);
      } else {
        toast.error(body.message || '创建失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '创建失败'));
    } finally {
      setCreating(false);
    }
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    setSuspendSaving(true);
    try {
      const res = await adminApi.suspendSubject(suspendTarget.id);
      const body = unwrap<unknown>(res);
      if (body.code === 0) {
        toast.success(`主体「${suspendTarget.name}」已停用，其密钥立即失效`);
        setSuspendTarget(null);
        load();
      } else {
        toast.error(body.message || '停用失败');
      }
    } catch (e) {
      toast.error(getErrorMessage(e, '停用失败'));
    } finally {
      setSuspendSaving(false);
    }
  };

  return (
    <div className="animate-fade-up space-y-5">
      <Card className="panel-card">
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <div className="text-[12.5px] text-muted-foreground">
            接入开放平台 /api/open/v1 的个人主体。主体与密钥只由平台创建；创建后仅一次展示 keySecret，需管理员立即复制保存。
          </div>
          <div className="ml-auto">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> 创建主体
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="panel-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-baseline justify-between text-[15px] text-ink">
            <span>主体列表</span>
            <span className="text-[12px] font-normal text-muted-foreground">
              共 {subjects.length} 个
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 && !loading ? (
            <EmptyState title="暂无主体" hint="点击右上角「创建主体」接入第一位客户" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>密钥</TableHead>
                  <TableHead>订单</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>联系电话</TableHead>
                  <TableHead>默认加价</TableHead>
                  <TableHead>余额</TableHead>
                  <TableHead>授信额度</TableHead>
                  <TableHead>已用额度</TableHead>
                  <TableHead>可用额度</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/subjects/view?id=${s.id}`} className="font-medium text-ink hover:text-primary">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {s.status === 'active' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-700">
                          启用
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11.5px] font-medium text-rose-600">
                          已停用
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-[12.5px]">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {s._count?.keys ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>{s._count?.orders ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{s.contactName || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.contactPhone || '—'}</TableCell>
                    <TableCell>
                      {s.defaultMarkupPercent != null ? `${s.defaultMarkupPercent}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-emerald-600">
                        {s.balance != null ? `¥${Number(s.balance).toLocaleString()}` : '¥0'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.quotaLimit != null ? `¥${Number(s.quotaLimit).toLocaleString()}` : <span className="text-muted-foreground">无限</span>}
                    </TableCell>
                    <TableCell>
                      {s.usedQuota != null ? `¥${Number(s.usedQuota).toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell>
                      {s.quotaLimit != null
                        ? `¥${Math.max(0, Number(s.quotaLimit) - (Number(s.usedQuota) || 0)).toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/subjects/view?id=${s.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" /> 详情
                          </Button>
                        </Link>
                        {s.status === 'active' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setSuspendTarget(s)}
                          >
                            <Power className="h-4 w-4" /> 停用
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建主体弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>创建主体</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
            创建后系统将自动生成内部用户与一把 <code className="font-mono">live</code> 密钥，keySecret 仅在此时展示一次。
          </div>
          <div className="grid gap-4">
            <Field label="主体名称 *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 张三数码"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="联系人">
                <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="选填" />
              </Field>
              <Field label="联系电话">
                <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="选填" />
              </Field>
            </div>
            <Field label="Webhook 回调地址">
              <Input
                value={form.callbackUrl}
                onChange={(e) => setForm({ ...form, callbackUrl: e.target.value })}
                placeholder="https://agent-a.com/api/yyesim/webhook"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="默认加价比例（%）">
                <NumberField
                  value={form.defaultMarkupPercent === '' ? 0 : Number(form.defaultMarkupPercent)}
                  onChange={(v) => setForm({ ...form, defaultMarkupPercent: String(v) })}
                  min={0}
                  precision={2}
                  step={0.5}
                />
              </Field>
              <Field label="备注">
                <Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} placeholder="选填" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="授信额度上限（留空=不限，元）">
                <Input
                  type="number"
                  min={0}
                  value={form.quotaLimit}
                  onChange={(e) => setForm({ ...form, quotaLimit: e.target.value })}
                  placeholder="留空表示不限"
                />
              </Field>
              <Field label="分成比例 %（临时方案，未定案）">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.splitPercent}
                  onChange={(e) => setForm({ ...form, splitPercent: e.target.value })}
                  placeholder="0-100，选填"
                />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button onClick={submitCreate} disabled={creating}>
              {creating ? '创建中…' : '创建并生成密钥'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建成功：一次性密钥 */}
      <Dialog open={!!createdSecret} onOpenChange={(o) => !o && setCreatedSecret(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>主体已创建，请保存密钥</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
            这是唯一一次展示 <code className="font-mono">keySecret</code> 的机会，关闭后不再显示。请立即把以下凭证复制并安全交付给主体，丢失只能走密钥轮换。
          </div>
          <div className="space-y-3">
            <Field label="主体名称">
              <Input value={createdSecret?.name || ''} readOnly />
            </Field>
            <Field label="keyId（公开）">
              <Input value={createdSecret?.keyId || ''} readOnly className="font-mono" />
            </Field>
            <Field label="keySecret（签名密钥，仅供本次）">
              <Input value={createdSecret?.keySecret || ''} readOnly className="font-mono" />
            </Field>
            <Field label="模式">
              <Input value={createdSecret?.mode || ''} readOnly />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedSecret(null)}>我已保存，关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 停用确认 */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停用主体「{suspendTarget?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              停用后该主体全部密钥立即失效，无法再调用 /api/open/v1，历史订单保留。需要恢复请在详情页改回启用状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmSuspend} disabled={suspendSaving}>
              {suspendSaving ? '停用中…' : '确认停用'}
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