'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Check, Play, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/utils';
import {
  META_SECTIONS,
  API_BASE,
  READ_ENDPOINTS,
  WRITE_ENDPOINTS,
  type EndpointSpec,
  type ParamField,
} from '@/lib/docs-data';
import { DocsOutline } from '@/components/docs/DocsOutline';
import { ApiDebugger } from '@/components/docs/ApiDebugger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function CodeInline({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>;
}

/* ---------- 方法徽标 ---------- */
function Method({ m }: { m: 'GET' | 'POST' }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-1 font-mono text-[11px] font-bold',
        m === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700',
      )}
    >
      {m}
    </span>
  );
}

/* ---------- 可复制代码块 ---------- */
function CodeBlock({ label, code, accent }: { label?: string; code: string; accent?: 'request' | 'response' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await copyText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          {accent === 'request' ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">REQ</span>
          ) : accent === 'response' ? (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-700">RES</span>
          ) : (
            <Terminal className="h-3.5 w-3.5" />
          )}
          {label ?? '示例'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-ink"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-ink">{code}</pre>
    </div>
  );
}

/* ---------- 字段表 ---------- */
function FieldTable({
  title,
  list,
  showType = true,
  showRequired = true,
}: {
  title: string;
  list: ParamField[];
  showType?: boolean;
  showRequired?: boolean;
}) {
  if (!list || list.length === 0) {
    return <div className="rounded-lg bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">{title}：无</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-muted/40 px-3 py-2">
        <span className="text-[11.5px] font-semibold text-muted-foreground">{title}</span>
        <span className="ml-auto text-[10.5px] text-muted-foreground/50">{list.length} 项</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">字段</th>
              {showType && <th className="w-20 px-3 py-2 font-medium">类型</th>}
              {showRequired && <th className="w-16 px-3 py-2 font-medium">必填</th>}
              <th className="px-3 py-2 font-medium">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {list.map((f) => (
              <tr key={f.name} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono font-medium text-ink">{f.name}</td>
                {showType && (
                  <td className="px-3 py-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {f.type}
                    </span>
                  </td>
                )}
                {showRequired && (
                  <td className="px-3 py-2">
                    {f.required ? (
                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">必填</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">选填</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 leading-relaxed text-muted-foreground">{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- 接口卡片（可折叠） ---------- */
function EndpointCard({ spec, onDebug }: { spec: EndpointSpec; onDebug: () => void }) {
  const [open, setOpen] = useState(true);
  const queryFields = spec.query ?? [];
  const bodyFields = spec.body ?? [];

  return (
    <article id={spec.id} className="animate-fade-up scroll-mt-24 overflow-hidden rounded-xl border border-border/80 bg-card">
      {/* 头部（点击整行折叠） */}
      <div
        className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label={open ? '收起' : '展开'}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Method m={spec.method} />
        <div className="min-w-0">
          <code className="block truncate font-mono text-[13.5px] font-semibold text-ink">{spec.path}</code>
          <span className="block truncate text-[11.5px] text-muted-foreground">{spec.title}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant={spec.auth === 'read' ? 'info' : 'warning'} className="hidden px-2 py-0.5 text-[11px] sm:inline-flex">
            {spec.auth === 'read' ? '仅需 X-Api-Key' : '需 Key + 签名'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              onDebug();
            }}
          >
            <Play className="h-3.5 w-3.5" />
            调试
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border/80 px-4 py-4">
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
            {spec.desc}
          </p>

          {/* 入参 / 出参 两栏 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {queryFields.length > 0 && <FieldTable title="Query 参数" list={queryFields} />}
              {bodyFields.length > 0 && <FieldTable title="Request Body" list={bodyFields} />}
              {spec.method === 'GET' && queryFields.length === 0 && (
                <FieldTable title="入参" list={[]} />
              )}
            </div>
            <FieldTable title="响应 data 字段" list={spec.response} />
          </div>

          {/* 示例两栏 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CodeBlock label="请求示例" code={spec.requestExample} accent="request" />
            <CodeBlock label="响应示例 (data)" code={spec.responseExample} accent="response" />
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------- 章节标题 ---------- */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mt-8 flex items-center gap-2 border-b border-border/70 pb-2 text-[18px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  const [debugOpen, setDebugOpen] = useState(false);
  const [current, setCurrent] = useState<string>(READ_ENDPOINTS[0].id);

  const openDebug = (id: string) => {
    setCurrent(id);
    setDebugOpen(true);
  };

  // 大纲：元章节 + 读写接口（子项使用人性化功能名）
  const outline = META_SECTIONS.map((m) => {
    const kids =
      m.id === 'read'
        ? READ_ENDPOINTS.map((e) => ({ id: e.id, label: e.title, method: e.method }))
        : m.id === 'write'
          ? WRITE_ENDPOINTS.map((e) => ({ id: e.id, label: e.title, method: e.method }))
          : undefined;
    return { id: m.id, label: m.label, children: kids };
  });

  return (
    <>
      <div className="animate-fade-up mx-auto max-w-6xl gap-10 lg:flex">
        {/* 左侧主内容 */}
        <div className="min-w-0 flex-1 space-y-2 text-[13.5px] leading-relaxed text-ink">
          <header className="space-y-1.5">
            <h1 className="flex items-center gap-2 text-[24px] font-bold leading-none tracking-tight text-ink">
              YYeSim 开放平台 API
            </h1>
            <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              面向分销伙伴 / 个人主体的 REST API。以 <CodeInline>keyId + keySecret</CodeInline>{' '}
              调用，可查价、下单、退款、接收回调，数据按主体隔离。每个接口均提供入参出参说明、示例与在线调试入口。
            </p>
          </header>

          <div className="my-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-[13px]">
            <span className="text-muted-foreground">基地址</span>
            <CodeInline>{API_BASE}</CodeInline>
            <span className="mx-1 hidden text-muted-foreground/60 sm:inline">·</span>
            <span className="text-[12px] text-muted-foreground">凭证由平台管理员后台开通发放，实际调用需持有有效密钥。</span>
          </div>

          <Section id="auth" title="一、鉴权与签名">
            <p className="text-muted-foreground">
              采用<b className="text-ink">双模鉴权</b>：读接口（GET）仅需 <CodeInline>X-Api-Key</CodeInline>；写接口（POST）需额外携带{' '}
              <CodeInline>X-Timestamp</CodeInline>、<CodeInline>X-Nonce</CodeInline>、<CodeInline>X-Sign</CodeInline> 签名。
            </p>
            <FieldTable
              title="请求头"
              list={[
                { name: 'X-Api-Key', type: 'string', required: true, desc: '公开密钥 ID，如 ak_live_7f3a9c21（读+写）' },
                { name: 'X-Timestamp', type: 'number', required: true, desc: '毫秒时间戳，与服务器时间差 ≤ ±5 分钟（写）' },
                { name: 'X-Nonce', type: 'string', required: true, desc: '随机串，5 分钟内不可重复，防重放（写）' },
                { name: 'X-Sign', type: 'string', required: true, desc: 'HMAC 签名串，见下方算法（写）' },
              ]}
            />
            <CodeBlock
              label="签名算法"
              code={'X-Sign = hex( HMAC-SHA256( keySecret,\n  keyId + "\\n" + timestamp + "\\n" + nonce + "\\n" + rawBody ) )'}
            />
            <p className="text-muted-foreground">
              <CodeInline>rawBody</CodeInline> 为请求体原始字节（JSON 原文，不得重新序列化）；GET 等无请求体时为空串。
            </p>
          </Section>

          <Section id="envelope" title="二、响应结构">
            <p className="text-muted-foreground">
              所有接口统一返回 <CodeInline>{`{ code, message, data, requestId }`}</CodeInline>。执行成功时{' '}
              <CodeInline>code = 0</CodeInline>，业务数据位于 <CodeInline>data</CodeInline>；失败时{' '}
              <CodeInline>message</CodeInline> 描述具体原因。
            </p>
            <CodeBlock
              label="响应外壳示例"
              code={'{\n  "code": 0,\n  "message": "ok",\n  "data": { ... },\n  "requestId": "req_9f2c1a7b"\n}'}
            />
          </Section>

          <Section id="errors" title="三、错误码">
            <FieldTable
              title="错误码对照"
              list={[
                { name: '400', type: 'http', required: false, desc: '参数错误（缺参、类型或取值非法）' },
                { name: '401', type: 'http', required: false, desc: '未鉴权 / 签名失败 / 时间戳越界 / nonce 重放' },
                { name: '403', type: 'http', required: false, desc: 'IP 不在白名单 / 主体停用' },
                { name: '404', type: 'http', required: false, desc: '资源不存在（套餐/订单/退款单）' },
                { name: '409', type: 'http', required: false, desc: '授信额度不足（透支后总欠款达到负债阈值）' },
                { name: '502', type: 'http', required: false, desc: '上游套餐源（Tiger）异常' },
              ]}
              showRequired={false}
            />
          </Section>

          <Section id="read" title="四、读接口（仅需 X-Api-Key）">
            {READ_ENDPOINTS.map((e) => (
              <EndpointCard key={e.id} spec={e} onDebug={() => openDebug(e.id)} />
            ))}
          </Section>

          <Section id="write" title="五、写接口（需 Key + 签名）">
            {WRITE_ENDPOINTS.map((e) => (
              <EndpointCard key={e.id} spec={e} onDebug={() => openDebug(e.id)} />
            ))}
          </Section>

          <Section id="wallet" title="六、余额与结算规则">
            <ul className="my-1 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>每笔订单按结算价 <CodeInline>costPrice</CodeInline> 结算，<b className="text-ink">优先从账户余额扣减</b>，余额不足部分<b className="text-ink">透支授信（欠款）</b>。</li>
              <li>可下单条件：透支后总欠款 ≤ 授信阈值 <CodeInline>quotaLimit</CodeInline>；达到阈值后不可继续下单（返回 409）。</li>
              <li>充值（支付宝）入账时<b className="text-ink">先抵扣欠款</b>，剩余进入余额；充值后如欠款归零，可继续下单。</li>
              <li>退款<b className="text-ink">优先冲抵欠款</b>，剩余回补余额；仅未激活的交付订单可退。</li>
            </ul>
          </Section>

          <Section id="webhook" title="七、Webhook 事件回调">
            <FieldTable
              title="推送事件"
              list={[
                { name: 'order.delivered', type: 'event', required: false, desc: '授信下单交付成功时推送' },
                { name: 'order.refunded', type: 'event', required: false, desc: '退款完成时推送' },
              ]}
              showRequired={false}
            />
            <p className="text-muted-foreground">
              配置 callbackUrl 后推送签名事件，失败自动退避重试，也可通过「重发回调」接口手动补发。
            </p>
            <div className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
              提示：旧版 <CodeInline>/api/external</CodeInline> 已标记废弃，新接入统一使用 <CodeInline>{API_BASE}</CodeInline>。接口以实际服务端行为为准。
            </div>
          </Section>
        </div>

        {/* 右侧大纲 */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8">
            <DocsOutline items={outline} />
          </div>
        </aside>
      </div>

      {/* 在线调试器 */}
      <ApiDebugger endpointId={current} open={debugOpen} onOpenChange={setDebugOpen} />
    </>
  );
}