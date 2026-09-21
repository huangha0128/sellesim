'use client';

import { useEffect, useState } from 'react';
import { Send, Loader2, Play, Terminal, Copy, Check, ChevronDown } from 'lucide-react';
import { ALL_ENDPOINTS, type EndpointSpec } from '@/lib/docs-data';
import { request, ApiError, getErrorMessage, API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  endpointId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildPath(spec: EndpointSpec, params: Record<string, string>): string {
  return spec.path.replace(/:([A-Za-z]+)/g, (_, key: string) => params[key] || `:${key}`);
}

function buildQuery(spec: EndpointSpec, query: Record<string, string>): string {
  const parts: string[] = [];
  (spec.query ?? []).forEach((f) => {
    const v = query[f.name];
    if (v !== undefined && v !== '') parts.push(`${encodeURIComponent(f.name)}=${encodeURIComponent(String(v))}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

export function ApiDebugger({ endpointId, open, onOpenChange }: Props) {
  const [spec, setSpec] = useState<EndpointSpec>(
    () => ALL_ENDPOINTS.find((e) => e.id === endpointId) ?? ALL_ENDPOINTS[0],
  );
  const [params, setParams] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    text: string;
    elapsed: number;
    realPath: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = ALL_ENDPOINTS.find((e) => e.id === endpointId) ?? ALL_ENDPOINTS[0];
    initFrom(s);
  }, [endpointId, open]);

  function initFrom(s: EndpointSpec) {
    setSpec(s);
    setParams({ ...(s.defaultPath ?? {}) });
    setQuery({ ...(s.defaultQuery ?? {}) });
    setBodyText(JSON.stringify(s.defaultBody ?? {}, null, 2));
    setResult(null);
    setCopied(false);
  }

  function changeEndpoint(id: string) {
    initFrom(ALL_ENDPOINTS.find((x) => x.id === id) ?? ALL_ENDPOINTS[0]);
  }

  const realPath = buildPath(spec, params) + buildQuery(spec, query);

  async function send() {
    setLoading(true);
    setResult(null);
    let parsedBody: unknown | undefined;
    if (spec.method === 'POST') {
      try {
        parsedBody = JSON.parse(bodyText || '{}');
      } catch {
        setResult({ ok: false, text: 'JSON 解析失败，请检查请求体格式。', elapsed: 0, realPath });
        setLoading(false);
        return;
      }
    }
    const start = performance.now();
    try {
      const data = await request<any>(
        realPath,
        spec.method === 'POST' ? { method: 'POST', body: parsedBody } : { method: 'GET' },
      );
      setResult({ ok: true, text: JSON.stringify(data, null, 2), elapsed: Math.round(performance.now() - start), realPath });
    } catch (e) {
      const msg = e instanceof ApiError ? `{ "code": ${e.code}, "message": "${e.message}" }` : JSON.stringify(getErrorMessage(e));
      setResult({ ok: false, text: msg, elapsed: Math.round(performance.now() - start), realPath });
    } finally {
      setLoading(false);
    }
  }

  async function copyRes() {
    if (result) {
      await copyText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const hasPathParams = Object.keys(params).length > 0;
  const hasQuery = (spec.query ?? []).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-5xl flex-col gap-0 p-0 sm:rounded-none">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="inline-flex items-center gap-2 text-[15px]">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Play className="h-3.5 w-3.5 text-primary" />
              </span>
              在线调试
            </DialogTitle>
            <DialogDescription>选择接口、填好参数后点击发送即可真实调用（复用当前登录态）。</DialogDescription>
          </DialogHeader>
        </div>

        {/* 主体：左请求 / 右响应，整体限高纵向滚动 */}
        <div className="grid flex-1 gap-0 lg:grid-cols-2">
          {/* 左：请求配置 */}
          <div className="space-y-4 overflow-y-auto p-5 lg:max-h-[70vh]">
            <div>
              <Label className="mb-1.5 block text-[12px] text-muted-foreground">选择接口</Label>
              <select
                value={spec.id}
                onChange={(e) => changeEndpoint(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] font-mono text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {ALL_ENDPOINTS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.method} {e.path}
                  </option>
                ))}
              </select>
            </div>

            {/* 请求行预览 */}
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 font-mono text-[12px]">
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold',
                  spec.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700',
                )}
              >
                {spec.method}
              </span>
              <code className="min-w-0 truncate text-ink">{API_BASE + realPath}</code>
            </div>

            {hasPathParams && (
              <div className="space-y-2">
                <Label className="text-[12px] text-muted-foreground">路径参数</Label>
                {Object.keys(params).map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <Label className="w-24 shrink-0 font-mono text-[12px] text-ink">:{k}</Label>
                    <Input value={params[k]} onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))} className="font-mono" />
                  </div>
                ))}
              </div>
            )}

            {hasQuery && (
              <div className="space-y-2">
                <Label className="text-[12px] text-muted-foreground">Query 参数</Label>
                {spec.query!.map((f) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <Label className={cn('w-24 shrink-0 truncate font-mono text-[12px]', f.required ? 'text-ink' : 'text-muted-foreground')}>
                      {f.name}
                      {!f.required && <span className="ml-0.5 text-[10px] text-muted-foreground/60">选填</span>}
                    </Label>
                    <Input value={query[f.name] ?? ''} onChange={(e) => setQuery((q) => ({ ...q, [f.name]: e.target.value }))} className="font-mono" />
                  </div>
                ))}
              </div>
            )}

            {spec.method === 'POST' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] text-muted-foreground">请求体（JSON）</Label>
                  <button
                    type="button"
                    onClick={() => setBodyText(JSON.stringify(spec.defaultBody ?? {}, null, 2))}
                    className="text-[11.5px] text-primary hover:underline"
                  >
                    重置为示例
                  </button>
                </div>
                <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={8} className="resize-y font-mono text-[12px]" />
              </div>
            )}

            <Button onClick={send} disabled={loading} className="w-full gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? '请求中…' : '发送请求'}
            </Button>
          </div>

          {/* 右：响应结果，限高内部滚动 */}
          <div className="flex min-h-0 flex-col border-t border-border/70 bg-muted/30 lg:max-h-[70vh] lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-border/70 bg-card px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                响应结果
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {result ? (result.ok ? '成功' : '失败') : '未发送'} · {spec.method}
                {result?.elapsed ? ` · ${result.elapsed}ms` : ''}
              </span>
            </div>
            {result ? (
              <div className="flex h-full min-h-0 flex-col">
                <pre
                  className={cn(
                    'min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[12px] leading-relaxed',
                    result.ok ? 'text-emerald-800' : 'text-red-600',
                  )}
                >
                  {result.text}
                </pre>
                <div className="flex items-center justify-between border-t border-border/70 bg-card px-4 py-2">
                  <code className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                    {result.ok ? API_BASE + result.realPath : ''}
                  </code>
                  <button
                    type="button"
                    onClick={copyRes}
                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground hover:text-ink"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <ChevronDown className="h-6 w-6 -rotate-90" />
                <p className="text-[12.5px]">发送请求后，响应将在此展示</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}