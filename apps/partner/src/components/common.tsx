import * as React from 'react';
import { useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { copyText } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'info' | 'destructive' | 'default';

/** 订单状态 → 中文 + Badge 色 */
export function orderStatus(status?: string): { text: string; variant: BadgeVariant } {
  switch (status) {
    case 'delivered':
      return { text: '已交付', variant: 'success' };
    case 'refunded':
      return { text: '已退款', variant: 'info' };
    case 'failed':
      return { text: '失败', variant: 'destructive' };
    default:
      return { text: status || '未知', variant: 'default' };
  }
}

/** eSIM 状态 → 中文 + Badge 色 */
export function esimStatus(status?: string): { text: string; variant: BadgeVariant } {
  switch (status) {
    case 'activated':
      return { text: '已激活', variant: 'success' };
    case 'active':
      return { text: '使用中', variant: 'success' };
    case 'expired':
      return { text: '已过期', variant: 'default' };
    case 'refunded':
      return { text: '已退款', variant: 'info' };
    default:
      return { text: status || '未知', variant: 'default' };
  }
}

/** 记账流水类型 → 中文 + 金额颜色 */
export function ledgerTypeInfo(type: string): { text: string; absClass: string; sign: 0 | 1 | -1 } {
  switch (type) {
    case 'order_debit':
      return { text: '授信透支', absClass: 'text-red-600', sign: -1 };
    case 'balance_debit':
      return { text: '余额扣款', absClass: 'text-red-600', sign: -1 };
    case 'refund_credit':
      return { text: '退款入账', absClass: 'text-emerald-600', sign: 1 };
    case 'balance_refund':
      return { text: '退款回补', absClass: 'text-emerald-600', sign: 1 };
    case 'deposit_credit':
      return { text: '充值入账', absClass: 'text-emerald-600', sign: 1 };
    case 'settle_credit':
      return { text: '结算入账', absClass: 'text-emerald-600', sign: 1 };
    case 'adjust':
      return { text: '人工调整', absClass: 'text-sky-600', sign: 0 };
    default:
      return { text: type || '未知', absClass: 'text-muted-foreground', sign: 0 };
  }
}

/** 订单 Badge（复用 orderStatus 定义） */
export function OrderStatusBadge({ status }: { status?: string }) {
  const s = orderStatus(status);
  return <Badge variant={s.variant}>{s.text}</Badge>;
}

/** 表单字段容器（与后台一致的字段样式） */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** 标题分段分隔线 */
export function Section({ title }: { title: string }) {
  return (
    <div className="mt-1 flex items-center gap-3">
      <span className="text-[13px] font-semibold text-ink">{title}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** 一个带「复制」按钮的只读键值展示 */
export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = useCallback(async () => {
    if (await copyText(value)) {
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 select-all truncate rounded-lg bg-muted/70 px-3 py-2 text-[12.5px] text-ink ${
            mono ? 'font-mono' : ''
          }`}
          title={value}
        >
          {value}
        </div>
        <Button variant="outline" size="sm" className="h-8 px-2" onClick={onCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}