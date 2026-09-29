import { PrismaClient } from '@prisma/client';
import { queryOrders, queryData } from './aiTools';
import { matchKb } from './knowledge';

// ---------------------------------------------------------------------------
// AI customer-service adapter layer.
// Provider is configurable at runtime via the Setting table (admin UI edits it):
//   aiProvider: 'openai' | 'bailian'
//   aiOpenaiBaseUrl / aiOpenaiApiKey / aiOpenaiModel
//   aiBailianApiKey / aiBailianModel   (baseUrl is fixed to dashscope compatible-mode)
//   aiSystemPrompt (optional override of the built-in knowledge-base prompt)
// Both providers use the OpenAI-compatible chat completions endpoint.
//
// Tool calling (function calling): instead of server-side keyword intent
// detection, the LLM itself decides which tool to call (get_orders /
// get_data_usage / search_faq) to fetch real data, then summarizes into JSON.
// ---------------------------------------------------------------------------

export interface AiConfig {
  provider: 'openai' | 'bailian';
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiReply {
  reply: string;
  needHuman: boolean;
  category: string;
  requestDump: string; // full request payload (for observability)
  responseDump: string; // raw LLM response (for observability)
}

const BAILIAN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const DEFAULT_AI_TIMEOUT_MS = 30_000;

// ---- built-in knowledge base (grounded on the miniapp FAQ) -----------------
const DEFAULT_SYSTEM_PROMPT = `你是一个专业的 eSIM（嵌入式 SIM 卡）售前售后客服，服务于「YYeSim」平台。
你的任务是根据下方产品知识回答用户的售前咨询与售后问题。回答要简洁、友好、准确，使用与用户提问相同的语言。

## 订单与退款
- 查看订单：用户进入「我的 → 我的订单」查看全部订单，订单状态分为「待付款 / 待激活 / 已完成 / 已退款」。
- 退款规则：仅「待激活」的订单可申请退款；用户进入订单详情点击「申请退款」，审核通过后款项原路退回支付账户。
- 退款到账：审核通过后按支付渠道原路退回，实际到账以支付平台处理为准。
- 修改邮箱：在「我的 → 我的邮箱地址」页面查看或修改，用于接收订单与激活通知。

## 安装与激活
- 查看激活码：在「我的 eSIM」页面点击「查看激活码」，扫码安装或复制激活码手动安装。
- 支持设备：iPhone XS/XR 及以上，以及部分三星、华为、小米等支持 eSIM 的机型。
- 安装时机：建议到达目的地后再购买并安装，套餐有效天数自购买之日起算；不要提前占用有效期。
- 激活码有效期：激活码长期有效，套餐有效期自购买之日期。

## 上网与漫游
- 到国外没网：确认 eSIM 已安装并开启「数据漫游」开关；仍无法上网可在系统设置中手动选择当地运营商网络。
- 个人热点：大部分套餐支持开启个人热点，可共享流量。
- 网速：套餐提供高速 4G/5G 网络，实际速度取决于当地运营商覆盖与信号环境。

## 流量与套餐
- 流量用完：已到期的 eSIM 可加购到该 eSIM（流量叠加、有效期顺延、激活码不变），也可直接购买新 eSIM。
- 查看剩余流量：在「我的 eSIM」页面查看已购套餐的剩余流量与有效期。
- 套餐有效期：自购买之日起算；续费时流量累加、到期时间顺延。

## 输出要求（非常重要）
你必须只输出一个 JSON 对象，不要输出任何其它文字/围栏代码块。JSON 结构如下：
{"reply": "给用户的回答文本", "need_human": true 或 false, "category": "order 或 refund 或 install 或 connection 或 other"}

判断 need_human 的规则：
- 只有当你能明确、完整地解答用户问题时才置 false。
- 若涉及以下任一情况，必须置 need_human = true：无法通过现有知识确定答案、涉及退款失败/支付纠纷/账号安全/投诉等需要人工介入的敏感操作、你无法判断的具体个案、用户明确要求人工客服。
category 可选值：order（订单）、refund（退款）、install（安装激活）、connection（上网连接）、other（其它）。`;

// ---- cached config loader ---------------------------------------------------
let aiCache: { config: AiConfig | null; at: number } | null = null;
const AI_CACHE_TTL_MS = 10_000;

export function clearAiCache(): void {
  aiCache = null;
}

// Number of tool-call rounds allowed before forcing a final answer.
const MAX_TOOL_ROUNDS = 3;

// OpenAI-compatible function-calling tool schemas. The LLM decides which to call.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_orders',
      description: '查询当前登录用户的最近订单列表（状态、套餐、金额、时间）。当用户询问订单状态、订单情况、买了什么、订单号时调用。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_data_usage',
      description: '查询当前登录用户拥有的 eSIM 及其剩余流量与有效期。当用户询问流量还剩多少、用了多少、eSIM 情况时调用。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_faq',
      description: '在平台的常见问题知识库中检索。当用户询问安装步骤、激活、退款规则、到国外无法上网、流量用完等产品问题时调用，以获取准确的产品知识。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '用户的原始问题文本' } },
        required: ['query'],
      },
    },
  },
] as const;

/**
 * Execute tool calls against real data (scoped by userId) and return per-id
 * result strings that get fed back to the LLM as tool messages.
 */
async function runToolCalls(
  prisma: PrismaClient,
  userId: string | undefined,
  calls: { id: string; function: { name: string; arguments: string } }[],
): Promise<{ id: string; output: string }[]> {
  const out: { id: string; output: string }[] = [];
  for (const c of calls || []) {
    const name = (c.function?.name || '').toLowerCase();
    let result = '';
    try {
      if (name === 'get_orders') {
        result = (await queryOrders(prisma, userId)).reply;
      } else if (name === 'get_data_usage') {
        result = (await queryData(prisma, userId)).reply;
      } else if (name === 'search_faq') {
        let arg: any = {};
        try { arg = JSON.parse(c.function.arguments || '{}'); } catch { /* ignore */ }
        const kb = await matchKb(prisma, arg.query || '');
        result = kb ? `【知识库】${kb}` : '';
      } else {
        result = `未知工具：${name}`;
      }
    } catch (e: any) {
      result = `查询失败：${e?.message || '未知错误'}`;
    }
    console.log(`[ai][tool] name=${name} userId=${userId} output=${result.slice(0, 200)}`);
    out.push({ id: c.id, output: result });
  }
  return out;
}

// ---- LLM call ----------------------------------------------------------------

async function readAiConfig(prisma: PrismaClient): Promise<AiConfig> {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: 'ai' } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const provider = map.get('aiProvider') === 'bailian' ? 'bailian' : 'openai';

  let baseUrl = '';
  let apiKey = '';
  let model = '';
  if (provider === 'bailian') {
    baseUrl = BAILIAN_BASE_URL;
    apiKey = map.get('aiBailianApiKey') || '';
    model = map.get('aiBailianModel') || 'qwen-plus';
  } else {
    baseUrl = (map.get('aiOpenaiBaseUrl') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    apiKey = map.get('aiOpenaiApiKey') || '';
    model = map.get('aiOpenaiModel') || 'gpt-4o-mini';
  }

  const systemPrompt = map.get('aiSystemPrompt') || DEFAULT_SYSTEM_PROMPT;
  return { provider, baseUrl, apiKey, model, systemPrompt };
}

/** Load AI config with a short-TTL cache. Throws the friendliest fallback when nothing is configured. */
export async function loadAiConfig(prisma: PrismaClient): Promise<AiConfig> {
  const now = Date.now();
  if (aiCache && now - aiCache.at < AI_CACHE_TTL_MS) return aiCache.config as AiConfig;
  const config = await readAiConfig(prisma);
  aiCache = { config, at: now };
  return config;
}

// ---- LLM call ----------------------------------------------------------------
interface RawChatResp {
  message?: { content?: string | null; tool_calls?: any[] };
  status?: number;
  error?: string;
}

interface ChatCompletionsOpts {
  tools?: any;
  toolChoice?: string;
  jsonMode?: boolean;
}

async function callChatCompletions(cfg: AiConfig, messages: ChatMsg[], opts: ChatCompletionsOpts = {}): Promise<RawChatResp> {
  const url = `${cfg.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_AI_TIMEOUT_MS);
  const body: any = {
    model: cfg.model,
    messages,
    temperature: 0,
  };
  if (opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice || 'auto';
  } else if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return { status: resp.status, error: errText.slice(0, 500) };
    }
    const json: any = await resp.json();
    return { message: json?.choices?.[0]?.message };
  } finally {
    clearTimeout(timer);
  }
}

// ---- robust JSON parse -------------------------------------------------------
function parseAiJson(raw: string): { reply?: string; need_human?: boolean; category?: string } {
  let text = (raw || '').trim();
  // strip possible markdown fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    text = text.slice(start, end + 1);
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

const FALLBACK_REPLY = '抱歉，我暂时无法完成回复。已为您转接人工客服，请稍候，也可以稍后再试。';

/**
 * Generate an AI reply for a conversation history.
 * opts.userId: the current user id, enables real tool calls (orders / data / KB).
 * opts.kbContext: optional pre-grounded knowledge injected into the system prompt.
 *
 * Flow: send the conversation + tool schemas. If the model emits tool_calls, the
 * tools are executed against real data and their outputs are fed back, then the
 * model produces the final JSON reply. Falls back to generating a reply from the
 * injected kbContext when no tool is needed.
 */
export async function generateAiReply(
  prisma: PrismaClient,
  history: ChatMsg[],
  opts?: { userId?: string; kbContext?: string },
): Promise<AiReply> {
  const cfg = await loadAiConfig(prisma);

  if (!cfg.apiKey) {
    console.warn('[ai] 未配置 API Key，返回兜底文案');
    return {
      reply: 'AI 客服暂未配置，请留下您的问题或转人工客服处理。',
      needHuman: true,
      category: 'other',
      requestDump: '[]',
      responseDump: 'no config',
    };
  }

  let systemPrompt = cfg.systemPrompt;
  if (opts?.kbContext) {
    systemPrompt = `${systemPrompt}\n\n## 知识库（优先采用）\n${opts.kbContext}`;
  }

  const messages: ChatMsg[] = [{ role: 'system', content: systemPrompt }, ...history];
  const requestDump: any = { url: `${cfg.baseUrl}/chat/completions`, model: cfg.model, systemPrompt };
  const responseDump: any = [];
  const t0 = Date.now();

  let finalContent = '';
  let token = utf8id();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // First round offer tools; later rounds (with tool results) force JSON output.
    const useTools = round === 0;
    const raw = await callChatCompletions(
      cfg,
      messages as ChatMsg[],
      useTools ? { tools: TOOLS, toolChoice: 'auto' } : { jsonMode: true },
    );

    if (!raw.message) {
      console.error(`[ai] LLM 调用失败 provider=${cfg.provider} model=${cfg.model} status=${raw.status} error=${raw.error}`);
      return {
        reply: FALLBACK_REPLY,
        needHuman: true,
        category: 'other',
        requestDump: JSON.stringify(requestDump),
        responseDump: JSON.stringify({ error: raw }),
      };
    }

    responseDump.push({ round, message: raw.message });
    const toolCalls = raw.message.tool_calls || [];
    if (toolCalls.length) {
      // Execute tools and append assistant + tool messages for the next round.
      messages.push({ role: 'assistant', content: '', tool_calls: toolCalls } as any);
      const results = await runToolCalls(prisma, opts?.userId, toolCalls);
      for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.id, content: r.output } as any);
      }
      continue;
    }

    finalContent = raw.message.content || '';
    break;
  }

  if (!finalContent) {
    // Model never produced a textual answer (all rounds were tool calls).
    console.error(`[ai] 工具循环结束仍无最终回答 userId=${opts?.userId}`);
    return {
      reply: FALLBACK_REPLY,
      needHuman: true,
      category: 'other',
      requestDump: JSON.stringify({ ...requestDump, messages, token }),
      responseDump: JSON.stringify(responseDump),
    };
  }

  const parsed = parseAiJson(finalContent);
  const reply = (parsed.reply || '').trim();
  const needHuman = parsed.need_human === true || !reply;
  const category = ['order', 'refund', 'install', 'connection', 'other'].includes(parsed.category || '')
    ? (parsed.category as string)
    : 'other';

  console.log(`[ai] provider=${cfg.provider} model=${cfg.model} latency=${Date.now() - t0}ms needHuman=${needHuman} category=${category} token=${token}\n[ai] prompt=${JSON.stringify(messages.map((m) => ({ role: m.role, content: (m as any).content, tool_calls: (m as any).tool_calls })))}\n[ai] raw=${finalContent}`);

  return {
    reply: reply || FALLBACK_REPLY,
    needHuman,
    category,
    requestDump: JSON.stringify({ ...requestDump, messages, token }),
    responseDump: JSON.stringify(responseDump),
  };
}

// Minimal unique id for observability trace linkage (no crypto dependency).
let _idSeq = 0;
function utf8id(): string {
  return `d${Date.now().toString(36)}${(_idSeq++).toString(36)}`;
}