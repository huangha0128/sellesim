'use client';

import { useState } from 'react';
import { Search, IdCard, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { api, getErrorMessage, type CardDetailResult } from '@/lib/api';
import { copyText } from '@/lib/utils';

/** eSIM 套餐状态的中文文案与配色映射 */
function statusMeta(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (s.includes('active') || s.includes('running') || s.includes('using') || s.includes('生效')) {
    return { text: '已激活/生效', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (s.includes('expired') || s.includes('到期') || s.includes('expire')) {
    return { text: '已到期', className: 'bg-muted text-muted-foreground' };
  }
  if (s.includes('inactive') || s.includes('未激活') || s.includes('pending')) {
    return { text: '未激活', className: 'bg-sky-100 text-sky-700' };
  }
  return { text: status || '—', className: 'text-muted-foreground' };
}

export default function CardPage() {
  const [iccid, setIccid] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState<CardDetailResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function search() {
    const val = iccid.trim();
    if (!val) {
      toast.error('请输入要查询的 ICCID 卡号');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.cardDetail(val);
      setDetail(res);
    } catch (e) {
      setDetail(null);
      toast.error(getErrorMessage(e, '查询失败'));
    } finally {
      setLoading(false);
    }
  }

  async function copyIccid() {
    if (detail && (await copyText(detail.iccid))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const cardSt = detail ? statusMeta(detail.card?.status) : null;

  return (
    <div className="animate-fade-up space-y-5">
      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px] text-ink">
              <IdCard className="h-4 w-4 text-primary" />
              卡状态查询
            </CardTitle>
            <CardDescription>
              输入 ICCID 查询该卡片是否绑定套餐、绑定了哪些套餐，以及各套餐当前状态。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only">ICCID</Label>
            <Input
              value={iccid}
              onChange={(e) => setIccid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="输入 ICCID 卡号，如 898603324505"
              className="min-w-[260px] flex-1 font-mono text-[13px]"
            />
            <Button onClick={search} disabled={loading} className="gap-1.5">
              <Search className="h-4 w-4" />
              {loading ? '查询中…' : '查询'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!searched && !loading && (
        <Card className="panel-card">
          <CardContent className="py-10">
            <EmptyState title="输入卡号开始查询" hint="可查看卡片的绑定套餐与套餐状态" />
          </CardContent>
        </Card>
      )}

      {searched && !loading && detail && (
        <Card className="panel-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[15px] text-ink">
                <code className="font-mono text-[13.5px]">{detail.iccid}</code>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${cardSt?.className || ''}`}
                >
                  {cardSt?.text || '—'}
                </span>
              </CardTitle>
              <CardDescription>
                {detail.card?.category ? `卡片类型：${detail.card.category}` : '卡片状态'}
                {detail.card?.createdAt ? ` · 创建：${detail.card.createdAt}` : ''}
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={copyIccid}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1 text-[12px]">{copied ? '已复制' : '复制卡号'}</span>
            </Button>
          </CardHeader>
          <CardContent>
            {detail.packages && detail.packages.length > 0 ? (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>绑定套餐</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>天数</TableHead>
                    <TableHead>启用时间</TableHead>
                    <TableHead>到期时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.packages.map((p) => {
                    const st = statusMeta(p.status);
                    return (
                      <TableRow key={p.id ?? p.name}>
                        <TableCell className="font-medium text-ink">{p.name || `套餐 #${p.id ?? '—'}`}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${st.className}`}>
                            {st.text}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.days ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.activatedAt || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.expireAt || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="该卡未绑定任何套餐" hint="当前 ICCID 未占用，可正常使用" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}