'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Check, Play, Terminal } from 'lucide-react';
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
function CodeBlock({ label, code }: { label?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await copyText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/50 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
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
      <pre className="overflow-x-auto bg-card p-3 font-mono text-[12px] leading-relaxed text-ink">{code}</pre>
    </div>
  );
}

/* ---------- 字段表 ---------- */
function FieldTable({ list, title }: { list: ParamField[]; title: string }) {
  if (!list || list.length === 0) {
    return (
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
        {title}：无
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border/80">
      <div className="border-b border-border/80 bg-muted/40 px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <tbody className="divide-y divide-border/70">
            {list.map((f) => (
              <tr key={f.name}>
                <td className="w-1/4 whitespace-nowrap px-3 py-2 align-top font-mono text-ink">{f.name}</td>
                <td className="w-24 whitespace-nowrap px-3 py-2 align-top">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {f.type}
                  </span>
                </td>
                <td className="w-16 px-3 py-2 align-top">
                  {f.required ? (
                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">必填</Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">选填</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground">{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- 接口卡片 ---------- */
function EndpointCard({ spec, onDebug }: { spec: EndpointSpec; onDebug: () => void }) {
  return (
    <article
      id={spec.id}
      className="animate-fade-up scroll-mt-24 overflow-hidden rounded-xl border border-border/80 bg-card"
    >
      {/* 头 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border/80 px-4 py-3">
        <Method m={spec.method} />
        <code className="font-mono text-[13px] font-medium text-ink">{spec.path}</code>
        <span className="ml-auto flex items-center gap-2">
          <Badge variant={spec.auth === 'read' ? 'info' : 'warning'} className="px-2 py-0.5 text-[11px]">
            {spec.auth === 'read' ? '仅需 X-Api-Key' : '需 Key + 签名'}
          </Badge>
          <Button size="sm" variant="outline" onClick={onDebug} className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            调试
          </Button>
        </span>
      </div>

      {/* 描述 + 字段表格 + 示例 */}
      <div className="space-y-4 px-4 py-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">{spec.desc}</p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {spec.query && spec.query.length > 0 && (
              <FieldTable list={spec.query} title="Query 参数" />
            )}
            {spec.body && spec.body.length > 0 && (
              <FieldTable list={spec.body} title="Request Body" />
            )}
            {(!spec.body || spec.body.length === 0) && spec.method === 'GET' && (
              <FieldTable list={[]} title="Request Body" />
            )}
          </div>
          <FieldTable list={spec.response} title="响应 data 字段" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CodeBlock label="请求示例" code={spec.requestExample} />
          <CodeBlock label="响应示例 (data)" code={spec.responseExample} />
        </div>
      </div>
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
  // 调试器状态
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(READ_ENDPOINTS[0].id);

  const openDebug = (id: string) => {
    setCurrent(id);
    setOpen(true);
  };

  // 大纲结构：元章节 + 读写接口子项
  const outline = META_SECTIONS.map((m) => {
    const kids =
      m.id === 'read'
        ? READ_ENDPOINTS.map((e) => ({ id: e.id, label: `${e.method} ${e.path}` }))
        : m.id === 'write'
          ? WRITE_ENDPOINTS.map((e) => ({ id: e.id, label: `${e.method} ${e.path}` }))
          : undefined;
    return { id: m.id, label: m.label, children: kids };
  });

  return (
    <>
      <div className="animate-fade-up mx-auto max-w-6xl gap-10 lg:flex">
        {/* 左侧主内容 */}
        <div className="min-w-0 flex-1 space-y-2 text-[13.5px] leading-relaxed text-ink">
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-ink">
            YYeSim 开放平台 API
          </h1>
          <p className="text-muted-foreground">
            面向分销伙伴 / 个人主体的 REST API。以 <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">keyId + keySecret</code>{' '}
            调用，可查价、下单、退款、接收回调，数据按主体隔离。每个接口均提供入参出参说明、示例与在线调试入口。
          </p>

          <div className="my-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[13px]">
            基地址 <CodeInline>{API_BASE}</CodeInline>
            <br className="sm:hidden" />
            凭证由平台管理员后台开通发放，无自助注册。本文档为公开说明，实际调用需持有有效密钥。
          </div>

          <Section id="auth" title="一、鉴权与签名">
            <p>
              采用<b>双模鉴权</b>：读接口（GET）仅需{' '}
              <CodeInline>X-Api-Key</CodeInline>；写接口（POST）需额外携带{' '}
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
              code={'X-Sign = hex( HMAC-SHA256( keySecret, \\n  keyId + "\\n" + timestamp + "\\n" + nonce + "\\n" + rawBody ) )'}
            />
            <p>
              <CodeInline>rawBody</CodeInline> 为请求体原始字节（JSON 原文，不得重新序列化）；GET 等无请求体时为空串。
            </p>
          </Section>

          <Section id="envelope" title="二、响应结构">
            <p>
              所有接口统一返回{'\u00a0'}
              <CodeInline>{`{ code, message, data, requestId }`}</CodeInline>。执行成功时{' '}
              <CodeInline>code = 0</CodeInline>，业务数据位于 <CodeInline>data</CodeInline>；失败时 <CodeInline>message</CodeInline>{' '}
              描述具体原因。
            </p>
            <CodeBlock
              label="响应外壳示例"
              code={'{\n  "code": 0,\n  "message": "ok",\n  "data": { ... },\n  "requestId": "req_9f2c1a7b"\n}'}
            />
          </Section>

          <Section id="errors" title="三、错误码">
            <FieldTable
              title="code / HTTP"
              list={[
                { name: '400', type: 'http', required: true, desc: '参数错误（缺参、类型或取值非法）' },
                { name: '401', type: 'http', required: true, desc: '未鉴权 / 签名失败 / 时间戳越界 / nonce 重放' },
                { name: '403', type: 'http', required: true, desc: 'IP 不在白名单 / 主体停用' },
                { name: '404', type: 'http', required: true, desc: '资源不存在（套餐/订单/退款单）' },
                { name: '409', type: 'http', required: true, desc: '授信额度不足（透支后总欠款达到负债阈值）' },
                { name: '502', type: 'http', required: true, desc: '上游套餐源（Tiger）异常' },
              ]}
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
            <ul className="my-2 list-disc space-y-1.5 pl-5">
              <li>每笔订单按结算价 <CodeInline>costPrice</CodeInline> 结算，<b>优先从账户余额扣减</b>，余额不足部分<b>透支授信（欠款）</b>。</li>
              <li>可下单条件：透支后总欠款 ≤ 授信阈值 <CodeInline>quotaLimit</CodeInline>；达到阈值后不可继续下单（返回 409）。</li>
              <li>充值（支付宝）入账时<b>先抵扣欠款</b>，剩余进入余额；充值后如欠款归零，可继续下单。</li>
              <li>退款<b>优先冲抵欠款</b>，剩余回补余额；仅未激活的交付订单可退。</li>
            </ul>
          </Section>

          <Section id="webhook" title="七、Webhook 事件回调">
            <FieldTable
              title="事件"
              list={[
                { name: 'order.delivered', type: 'event', required: true, desc: '授信下单交付成功时推送' },
                { name: 'order.refunded', type: 'event', required: true, desc: '退款完成时推送' },
              ]}
            />
            <p>配置 callbackUrl 后推送签名事件，失败自动退避重试，也可通过「重发回调」接口手动补发。</p>
            <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
              提示：旧版 /api/external 已标记废弃，新接入统一使用 <CodeInline>{API_BASE}</CodeInline>。接口以实际服务端行为为准。
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
      {open && (
        <ApiDebugger endpointId={current} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

function CodeInline({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>;
}