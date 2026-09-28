'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MessagesSquare, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { adminApi, unwrap, getErrorMessage, type SupportSession } from '@/api';

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'ai', label: 'AI 客服' },
  { value: 'human', label: '人工' },
  { value: 'closed', label: '已结束' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ai: { label: 'AI', className: 'bg-blue-50 text-blue-600' },
  human: { label: '人工', className: 'bg-amber-50 text-amber-600' },
  closed: { label: '已结束', className: 'bg-muted text-muted-foreground' },
};

function SenderLabel(sender?: string | null) {
  if (sender === 'user') return '用户';
  if (sender === 'admin') return '客服';
  if (sender === 'ai') return 'AI';
  return '系统';
}

function timeStr(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function SupportPage() {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params: any = { status: status || undefined, unread: unreadOnly ? 1 : 0, page, pageSize };
      if (filter) params.keyword = filter;
      const res = await adminApi.getSupportSessions(params);
      const body = unwrap<{ sessions: SupportSession[]; total: number }>(res);
      setSessions(body.data.sessions || []);
      setTotal(body.data.total || 0);
    } catch (e) {
      setErrorMsg(getErrorMessage(e, '加载客服会话失败'));
    } finally {
      setLoading(false);
    }
  }, [status, unreadOnly, page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up space-y-4">
      <Card className="panel-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessagesSquare size={16} />
            </span>
            <CardTitle className="text-[15px] text-ink">在线客服会话</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </Button>
        </CardHeader>

        <CardContent>
          {/* 筛选栏 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={unreadOnly}
                onCheckedChange={(v) => { setUnreadOnly(v); setPage(1); }}
              />
              <span>仅看有用户新消息</span>
            </div>

            <form
              className="ml-auto flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setFilter(keyword.trim());
                setPage(1);
              }}
            >
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索会话 / 用户"
                className="w-52"
              />
              <Button type="submit" variant="secondary" size="sm">
                搜索
              </Button>
            </form>
          </div>

          {errorMsg && <p className="mb-3 text-sm text-destructive">{errorMsg}</p>}

          {!loading && sessions.length === 0 ? (
            <EmptyState title="暂无会话" hint="用户发起咨询后，会话将显示在这里" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>未读</TableHead>
                  <TableHead className="max-w-[300px]">最后消息</TableHead>
                  <TableHead>最后更新</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const badge = STATUS_BADGE[s.status] || STATUS_BADGE.ai;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium text-ink">{s.user?.nickname || '用户'}</div>
                        <div className="text-xs text-muted-foreground">{s.user?.email || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={badge.className}>{badge.label}</Badge>
                          {s.needHuman && <Badge className="bg-red-50 text-red-600">需人工</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.unreadAdmin ? (
                          <Badge className="bg-red-500 text-white">{s.unreadAdmin}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="truncate text-sm">
                          <span className="mr-1 text-xs text-muted-foreground">
                            {SenderLabel(s.lastSender)}
                          </span>
                          {s.lastMessage || ''}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {timeStr(s.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/support/view?id=${s.id}`}>
                          <Button variant="outline" size="sm">
                            进入会话
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">共 {total} 条</span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-disabled={page <= 1}
                    />
                  </PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-disabled={page >= totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}