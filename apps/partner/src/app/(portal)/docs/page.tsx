import type { ReactNode } from 'react';

const BASE = 'https://<你的域名>/api/open/v1';

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>;
}

function Method({ m }: { m: 'GET' | 'POST' }) {
  const cls = m === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700';
  return (
    <span className={`rounded-md px-2 py-1 font-mono text-[11.5px] font-bold ${cls}`}>{m}</span>
  );
}

function Endpoint({
  m,
  path,
  desc,
  auth,
  children,
}: {
  m: 'GET' | 'POST';
  path: string;
  desc: string;
  auth: string;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/80 px-4 py-3">
        <Method m={m} />
        <code className="font-mono text-[13px] text-ink">{path}</code>
        <span className="ml-auto text-[12px] text-muted-foreground">
          鉴权：<b className="font-semibold text-ink">{auth}</b>
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-[13px] text-muted-foreground">{desc}</p>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-8 scroll-mt-20 border-b border-border/70 pb-2 text-[18px] font-semibold tracking-tight text-ink"
    >
      {children}
    </h2>
  );
}

function T({ h, children }: { h: string[]; children: ReactNode }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border/80">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-muted/50 text-left text-muted-foreground">
            {h.map((x) => (
              <th key={x} className="px-4 py-2.5 font-medium">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">{children}</tbody>
      </table>
    </div>
  );
}
function TD({ children }: { children: ReactNode }) {
  return <td className="px-4 py-2.5 align-top text-ink">{children}</td>;
}

export default function DocsPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-4xl space-y-2 text-[13.5px] leading-relaxed text-ink">
      <h1 className="text-[26px] font-bold leading-none tracking-tight text-ink">
        YYeSim 开放平台 API
      </h1>
      <p className="text-muted-foreground">
        面向分销伙伴 / 个人主体的 REST API。以 <Code>keyId + keySecret</Code> 调用，可查价、下单、退款、接收回调，数据按主体隔离。
      </p>

      <div className="my-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[13px]">
        基地址 <Code>{BASE}</Code>。凭证由平台管理员后台开通发放，无自助注册。本文档为公开说明，实际调用需持有有效密钥。
      </div>

      <SectionTitle id="auth">一、鉴权与签名</SectionTitle>
      <p>
        采用双模鉴权：<b>读接口</b>（GET）仅需 <Code>X-Api-Key</Code>；<b>写接口</b>（POST）需额外携带{' '}
        <Code>X-Timestamp</Code>、<Code>X-Nonce</Code>、<Code>X-Sign</Code> 签名。
      </p>
      <T h={['请求头', '必填', '说明']}>
        <tr>
          <TD><Code>X-Api-Key</Code></TD><TD>读+写</TD><TD>公开密钥 ID，如 ak_live_7f3a9c21</TD>
        </tr>
        <tr>
          <TD><Code>X-Timestamp</Code></TD><TD>写</TD><TD>毫秒时间戳，与服务器时间差 ≤ ±5 分钟</TD>
        </tr>
        <tr>
          <TD><Code>X-Nonce</Code></TD><TD>写</TD><TD>随机串，5 分钟内不可重复（防重放）</TD>
        </tr>
        <tr>
          <TD><Code>X-Sign</Code></TD><TD>写</TD><TD>HMAC 签名，见下</TD>
        </tr>
      </T>
      <div className="rounded-lg bg-muted/60 px-4 py-3 font-mono text-[12px]">
        X-Sign = hex(HMAC-SHA256(keySecret, keyId &quot;\n&quot; + timestamp + &quot;\n&quot; + nonce + &quot;\n&quot; + rawBody))
      </div>
      <p><Code>rawBody</Code> 为请求体原始字节（JSON 原文，不得重新序列化）；GET 等无请求体时为空串。</p>

      <SectionTitle id="envelope">二、响应结构</SectionTitle>
      <p>所有接口统一返回 {`{ code, message, data, requestId }`}。code 为 0 表示成功。</p>

      <SectionTitle id="errors">三、错误码</SectionTitle>
      <T h={['code / HTTP', '含义']}>
        <tr><TD><Code>400</Code></TD><TD>参数错误</TD></tr>
        <tr><TD><Code>401</Code></TD><TD>未鉴权/签名失败/时间戳越界/nonce 重放</TD></tr>
        <tr><TD><Code>403</Code></TD><TD>IP 不在白名单 / 主体停用</TD></tr>
        <tr><TD><Code>404</Code></TD><TD>资源不存在</TD></tr>
        <tr><TD><Code>409</Code></TD><TD>授信额度不足（达到负债阈值）</TD></tr>
        <tr><TD><Code>502</Code></TD><TD>上游套餐源（Tiger）异常</TD></tr>
      </T>

      <SectionTitle id="read">四、读接口（仅需 X-Api-Key）</SectionTitle>
      <div className="space-y-3">
        <Endpoint m="GET" path="/me" desc="获取当前主体信息、密钥与钱包额度。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/quota" desc="额度总览与记账流水（含余额/欠款/充值入账）。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/wallet" desc="钱包总览：余额、欠款、授信阈值与充值记录。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/packages" desc="套餐列表（含当前主体结算价 costPrice 与售价 price）。参数 countryCode / keyword / page / pageSize。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/packages/:pkgId" desc="套餐详情。主体不可见的套餐返回 404。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/regions" desc="可用国家/地区列表。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/orders" desc="订单列表（不含 eSIM 敏感信息）。参数 status / extOrderNo / page / pageSize。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/orders/:orderNo" desc="订单详情，已交付/已退款时含激活码。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/orders/ext/:extOrderNo" desc="按接入方订单号反查订单。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/orders/:orderNo/esim" desc="查询 eSIM 用量与状态。" auth="X-Api-Key" />
        <Endpoint m="GET" path="/refunds/:refundNo" desc="退款单查询。" auth="X-Api-Key" />
      </div>

      <SectionTitle id="write">五、写接口（需 X-Api-Key + 签名）</SectionTitle>
      <div className="space-y-3">
        <Endpoint m="POST" path="/orders" desc="按授信下单（扣费+开卡）。body：{ pkgId, email, extOrderNo? }。余额充足则扣余额，不足透支授信；超出负债阈值返回 409。" auth="Key + 签名" />
        <Endpoint m="POST" path="/orders/:orderNo/refunds" desc="退款冲回。仅未激活的交付订单可退；退款优先冲抵欠款，剩余回补余额。body：{ extRefundNo?, amount?, reason? }。" auth="Key + 签名" />
        <Endpoint m="POST" path="/wallet/topups" desc="充值下单。body：{ amount, returnUrl? }。返回支付宝 H5 支付链接；支付成功后账单先抵扣欠款，剩余进入余额。" auth="Key + 签名" />
        <Endpoint m="POST" path="/orders/:orderNo/webhook/retry" desc="手动重发交付回调。" auth="Key + 签名" />
      </div>

      <SectionTitle id="wallet">六、余额与结算规则</SectionTitle>
      <ul className="my-2 list-disc space-y-1.5 pl-5">
        <li>每笔订单按结算价 <Code>costPrice</Code> 结算，<b>优先从账户余额扣减</b>，余额不足部分<b>透支授信（欠款）</b>。</li>
        <li>可下单条件：透支后总欠款 ≤ 授信阈值 <Code>quotaLimit</Code>；达到阈值后不可继续下单。</li>
        <li>充值（支付宝）入账时<b>先抵扣欠款</b>，剩余进入余额；充值后如欠款归零，可继续下单。</li>
        <li>退款<b>优先冲抵欠款</b>，剩余回补余额。</li>
      </ul>

      <SectionTitle id="webhook">七、Webhook 事件回调</SectionTitle>
      <T h={['事件', '触发时机']}>
        <tr><TD><Code>order.delivered</Code></TD><TD>授信下单交付成功</TD></tr>
        <tr><TD><Code>order.refunded</Code></TD><TD>退款完成</TD></tr>
      </T>
      <p>配置 callbackUrl 后推送签名事件，失败自动退避重试，也可手动补发。</p>

      <div className="mt-8 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-[12px] text-muted-foreground">
        提示：旧版 /api/external 已标记废弃，新接入统一使用 {BASE}。接口以实际服务端行为为准。
      </div>
    </div>
  );
}