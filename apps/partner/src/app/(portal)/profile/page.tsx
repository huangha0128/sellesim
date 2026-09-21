'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wallet, Plus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, getErrorMessage, type MeResult, type WalletResult, type Recharge } from '@/lib/api';
import { fmtDate, fmtMoney, copyText } from '@/lib/utils';

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

function TopupRow({ r }: { r: Recharge }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-[12.5px]">{r.rechargeNo}</TableCell>
      <TableCell className="font-semibold tabular-nums text-emerald-600">
        +¥{fmtMoney(r.amount)}
      </TableCell>
      <TableCell>
        <Badge variant={r.status === 'paid' ? 'success' : 'outline'}>
          {r.status === 'paid' ? '已到账' : '支付中'}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
    </TableRow>
  );
}

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
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  // 回调地址（自助配置）
  const [callback, setCallback] = useState('');
  const [callbackSaving, setCallbackSaving] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  async function handleTopup() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('请输入正确的充值金额');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api.createTopup({ amount: amt, returnUrl: window.location.href });
      toast.success('已生成支付订单，正在跳转支付宝…');
      window.location.href = r.payUrl;
    } catch (e) {
      toast.error(getErrorMessage(e, '充值下单失败'));
    } finally {
      setSubmitting(false);
    }
  }

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
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              API 密钥（{me?.keys?.length || 0}）
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
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> 充值
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatMini label="账户余额" value={`¥${fmtMoney(w?.balance)}`} color="text-emerald-600" />
          <StatMini label="当前欠款" value={`¥${fmtMoney(w?.usedQuota)}`} color="text-red-600" />
          <StatMini label="可透支额度" value={`¥${fmtMoney(w?.availableDebt)}`} color="text-ink" />
          <StatMini label="授信阈值" value={`¥${fmtMoney(w?.maxDebt)}`} color="text-muted-foreground" />
        </CardContent>
      </Card>

      {/* 充值记录 */}
      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[15px] text-ink">充值记录</CardTitle>
            <p className="text-[12px] text-muted-foreground">共 {wallet?.total || 0} 条</p>
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
        </CardHeader>
        <CardContent>
          {!wallet?.recharges?.length && !loading ? (
            <EmptyState title="暂无充值记录" />
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>充值单号</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet?.recharges.map((r) => <TopupRow key={r.rechargeNo} r={r} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>余额充值</DialogTitle>
            <DialogDescription>
              充值金额将先抵扣欠款，剩余进入账户余额。通过支付宝完成支付。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] text-muted-foreground">充值金额（¥）</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant={amount === a ? 'default' : 'outline'}
                  onClick={() => setAmount(a)}
                >
                  ¥{a}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleTopup} disabled={submitting}>
              {submitting ? '处理中…' : '去支付'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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