'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Copy, Check, Plus, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api, getErrorMessage, type MeResult, type WalletResult, type CreateKeyResult } from '@/lib/api';
import { fmtMoney, copyText } from '@/lib/utils';

function KeyRow({ keyId }: { keyId: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(keyId)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 select-all truncate rounded-lg bg-muted/70 px-3 py-2 font-mono text-[12px] text-ink">
        {keyId}
      </code>
      <Button variant="outline" size="sm" className="h-8 px-2" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function ProfilePage() {
  const [me, setMe] = useState<MeResult | null>(null);
  const [wallet, setWallet] = useState<WalletResult | null>(null);
  const [loading, setLoading] = useState(true);
  // 回调地址（自助配置）
  const [callback, setCallback] = useState('');
  const [callbackSaving, setCallbackSaving] = useState(false);
  // 自助创建密钥
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyMode, setKeyMode] = useState<'live' | 'read'>('live');
  const [keySubmitting, setKeySubmitting] = useState(false);
  const [newKey, setNewKey] = useState<CreateKeyResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, walletRes] = await Promise.all([api.me(), api.wallet()]);
      setMe(meRes);
      setWallet(walletRes);
      setCallback(meRes.subject.callbackUrl || '');
    } catch (e) {
      toast.error(getErrorMessage(e, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveCallback() {
    const val = callback.trim();
    if (val !== '' && !/^https?:\/\//.test(val)) {
      toast.error('回调地址必须以 http:// 或 https:// 开头');
      return;
    }
    setCallbackSaving(true);
    try {
      await api.updateCallback(val);
      toast.success('回调地址已保存');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '保存失败'));
    } finally {
      setCallbackSaving(false);
    }
  }

  async function createKey() {
    setKeySubmitting(true);
    try {
      const r = await api.createKey({ name: keyName, mode: keyMode });
      setNewKey(r);
      setKeyOpen(false);
      setKeyName('');
      setKeyMode('live');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, '创建密钥失败'));
    } finally {
      setKeySubmitting(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  const subj = me?.subject;
  const w = wallet?.wallet;

  return (
    <div className="animate-fade-up space-y-5">
      {/* 主体信息 */}
      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] text-ink">{subj?.name || '个人中心'}</CardTitle>
            <CardDescription>账户基础信息与 API 密钥</CardDescription>
          </div>
          <Badge variant={subj?.status === 'active' ? 'success' : 'destructive'}>
            {subj?.status === 'active' ? '正常' : '停用'}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Webhook 回调地址
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={callback}
                onChange={(e) => setCallback(e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="min-w-[220px] flex-1 font-mono text-[12.5px]"
              />
              <Button
                size="sm"
                onClick={saveCallback}
                disabled={callbackSaving || callback.trim() === (subj?.callbackUrl || '')}
              >
                {callbackSaving ? '保存中…' : '保存'}
              </Button>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              交付（order.delivered）与退款（order.refunded）事件将通过此地址以签名形式回调；无需后台配置，自助填写即可，留空并保存可清除。
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">分成比例</div>
            <div className="rounded-lg bg-muted/70 px-3 py-2 text-[12.5px] text-ink">
              {subj?.splitPercent != null ? `${subj.splitPercent}%` : '—'}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                API 密钥（{me?.keys?.length || 0}）
              </div>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={() => setKeyOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> 新建密钥
              </Button>
            </div>
            <div className="space-y-2">
              {me && me.keys.map((k) => <KeyRow key={k.keyId} keyId={k.keyId} />)}
              {!me?.keys?.length && <div className="text-[12.5px] text-muted-foreground">暂无启用密钥</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 钱包 */}
      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px] text-ink">
              <Wallet className="h-4 w-4 text-primary" />
              余额与额度
            </CardTitle>
            <p className="text-[12px] text-muted-foreground">
              下单优先扣余额，余额不足则透支授信
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatMini label="账户余额" value={`¥${fmtMoney(w?.balance)}`} color="text-emerald-600" />
          <StatMini label="当前欠款" value={`¥${fmtMoney(w?.usedQuota)}`} color="text-red-600" />
          <StatMini label="可透支额度" value={`¥${fmtMoney(w?.availableDebt)}`} color="text-ink" />
          <StatMini label="授信阈值" value={`¥${fmtMoney(w?.maxDebt)}`} color="text-muted-foreground" />
        </CardContent>
      </Card>

      {/* 新建密钥 */}
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> 新建 API 密钥
            </DialogTitle>
            <DialogDescription>
              创建后 keySecret 将完整展示一次，请立即保存。只读密钥仅可查询，读写密钥可下单与退款。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[12.5px] text-muted-foreground">密钥用途（备注名）</label>
              <Input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="如：生产环境 / 测试环境"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12.5px] text-muted-foreground">密钥模式</label>
              <div className="flex gap-2">
                {(
                  [
                    { v: 'live' as const, label: '读写（下单/退款）' },
                    { v: 'read' as const, label: '只读（查询）' },
                  ]
                ).map((o) => (
                  <Button
                    key={o.v}
                    type="button"
                    size="sm"
                    variant={keyMode === o.v ? 'default' : 'outline'}
                    onClick={() => setKeyMode(o.v)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyOpen(false)} disabled={keySubmitting}>
              取消
            </Button>
            <Button onClick={createKey} disabled={keySubmitting}>
              {keySubmitting ? '创建中…' : '创建密钥'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建成功：展示 keySecret（仅一次） */}
      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-600" /> 密钥已创建
            </DialogTitle>
            <DialogDescription>
              请立即复制并妥善保存 keySecret，此内容仅展示一次，关闭后不可再查看。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 p-3">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Key ID</div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 font-mono text-[12.5px] text-ink">
                {newKey?.keyId}
                <CopyBtn text={newKey?.keyId || ''} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Key Secret（仅此一次）</div>
              <div className="break-all rounded-lg bg-card px-3 py-2 font-mono text-[12.5px] text-ink">
                {newKey?.keySecret}
                <div className="mt-2">
                  <CopyBtn text={newKey?.keySecret || ''} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-muted-foreground hover:bg-muted hover:text-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="panel-card">
      <CardContent className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <div className={`truncate text-[22px] font-bold leading-none tracking-tight tabular-nums ${color}`}>
            {value}
          </div>
          <div className="mt-2 text-[12px] font-medium text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}