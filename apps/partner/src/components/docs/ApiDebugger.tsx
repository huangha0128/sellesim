'use client';

import { useEffect, useState } from 'react';
import { Send, Loader2, Play, Terminal } from 'lucide-react';
import { ALL_ENDPOINTS, type EndpointSpec } from '@/lib/docs-data';
import { request, ApiError, getErrorMessage } from '@/lib/api';
import { API_BASE } from '@/lib/api';
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
  /** 打开时预选的接口 id */
  endpointId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 构造真实请求路径：将 `:param` 替换为用户输入值 */
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
    method: 'GET' | 'POST';
  } | null>(null);

  // 每次打开或切换接口时，用默认值初始化输入区
  useEffect(() => {
    const s = ALL_ENDPOINTS.find((e) => e.id === endpointId) ?? ALL_ENDPOINTS[0];
    setSpec(s);
    setParams({ ...(s.defaultPath ?? {}) });
    setQuery({ ...(s.defaultQuery ?? {}) });
    setBodyText(JSON.stringify(s.defaultBody ?? {}, null, 2));
    setResult(null);
  }, [endpointId, open]);

  function changeEndpoint(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const s = ALL_ENDPOINTS.find((x) => x.id === id) ?? ALL_ENDPOINTS[0];
    setSpec(s);
    setParams({ ...(s.defaultPath ?? {}) });
    setQuery({ ...(s.defaultQuery ?? {}) });
    setBodyText(JSON.stringify(s.defaultBody ?? {}, null, 2));
    setResult(null);
  }

  async function send() {
    setLoading(true);
    setResult(null);
    const realPathBase = buildPath(spec, params);
    const realPath = realPathBase + buildQuery(spec, query);
    let parsedBody: unknown | undefined;
    if (spec.method === 'POST') {
      try {
        parsedBody = JSON.parse(bodyText || '{}');
      } catch {
        setResult({
          ok: false,
          text: 'JSON 解析失败：请检查请求体格式是否正确。',
          elapsed: 0,
          realPath,
          method: spec.method,
        });
        setLoading(false);
        return;
      }
    }
    const start = performance.now();
    try {
      // 复用登录态 JWT 真调后端（读+写均可）
      const data = await request<any>(
        realPath,
        spec.method === 'POST' ? { method: 'POST', body: parsedBody } : { method: 'GET' },
      );
      const elapsed = Math.round(performance.now() - start);
      setResult({ ok: true, text: JSON.stringify(data, null, 2), elapsed, realPath, method: spec.method });
    } catch (e) {
      const elapsed = Math.round(performance.now() - start);
      const msg = e instanceof ApiError ? `{ "code": ${e.code}, "message": "${e.message}" }` : JSON.stringify(getErrorMessage(e));
      setResult({ ok: false, text: msg, elapsed, realPath, method: spec.method });
    } finally {
      setLoading(false);
    }
  }

  async function copyRes() {
    if (result) await copyText(result.text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[12px] font-bold">
              <Play className="h-3.5 w-3.5" />
              在线调试器
            </span>
          </DialogTitle>
          <DialogDescription>选择接口、填好参数后点击发送即可真实调用（复用当前登录态）。</DialogDescription>
        </DialogHeader>

        {/* 接口选择 */}
        <div className="flex items-center gap-2">
          <label className="text-[12.5px] text-muted-foreground">接口：</label>
          <select
            value={spec.id}
            onChange={changeEndpoint}
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-[13px] font-mono text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ALL_ENDPOINTS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.method} {e.path}
              </option>
            ))}
          </select>
        </div>

        {/* 请求行 */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 font-mono text-[12.5px]">
          <span
            className={cn(
              'rounded px-2 py-0.5 text-[11px] font-bold',
              spec.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700',
            )}
          >
            {spec.method}
          </span>
          <code className="text-ink">
            {API_BASE.replace('https://<你的域名>', '')}
            {buildPath(spec, params)}
            {buildQuery(spec, query)}
          </code>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 路径参数 */}
          {(Object.keys(spec.defaultPath ?? {}).length > 0 ||
            (params && Object.keys(params).length > 0)) && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-muted-foreground">路径参数</div>
              {Object.keys(params).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Label className="w-20 shrink-0 font-mono text-[12px] text-ink">:{k}</Label>
                  <Input
                    value={params[k]}
                    onChange={(ev) => setParams((p) => ({ ...p, [k]: ev.target.value }))}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {/* query 参数 */}
          {(spec.query ?? []).length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-muted-foreground">Query 参数</div>
              {spec.query!.map((f) => (
                <div key={f.name} className="flex items-center gap-2">
                  <Label className={cn('w-24 shrink-0 font-mono text-[12px]', f.required ? 'text-ink' : 'text-muted-foreground')}>
                    {f.name}
                    {!f.required && <span className="ml-0.5 text-[10px] text-muted-foreground/70">选填</span>}
                  </Label>
                  <Input
                    value={query[f.name] ?? ''}
                    onChange={(ev) => setQuery((q) => ({ ...q, [f.name]: ev.target.value }))}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* body */}
        {spec.method === 'POST' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium text-muted-foreground">请求体（JSON）</div>
              <button
                type="button"
                onClick={() => setBodyText(JSON.stringify(spec.defaultBody ?? {}, null, 2))}
                className="text-[11.5px] text-primary hover:underline"
              >
                重置为示例
              </button>
            </div>
            <Textarea
              value={bodyText}
              onChange={(ev) => setBodyText(ev.target.value)}
              rows={5}
              className="resize-y font-mono text-[12.5px]"
            />
          </div>
        )}

        {/* 发送 */}
        <div className="flex items-center gap-2">
          <Button onClick={send} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? '请求中…' : '发送请求'}
          </Button>
        </div>

        {/* 响应 */}
        {result && (
          <div className="overflow-hidden rounded-lg border">
            <div
              className={cn(
                'flex items-center justify-between border-b px-3 py-2 text-[12px]',
                result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600',
              )}
            >
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Terminal className="h-3.5 w-3.5" />
                {result.ok ? '请求成功' : '请求失败'} · {result.method} {result.realPath}
                {result.elapsed > 0 && <span className="text-muted-foreground">· {result.elapsed}ms</span>}
              </span>
              <button type="button" onClick={copyRes} className="text-[11.5px] hover:underline">
                复制
              </button>
            </div>
            <pre className="max-h-72 overflow-auto bg-card p-3 font-mono text-[12px] leading-relaxed text-ink">
              {result.text}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}