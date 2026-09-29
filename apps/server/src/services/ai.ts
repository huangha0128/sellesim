import { PrismaClient } from '@prisma/client';
import {
  queryOrders,
  queryData,
  queryPackages,
  recommendPackages,
} from './aiTools';
import { retrieveKb } from './vector';

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

// ---- built-in knowledge base + RAG grounding + hallucination guard -----------
const DEFAULT_SYSTEM_PROMPT = `你是在线客服小 Y，服务于「YYeSim」eSIM 流量平台。你的任务是帮用户解决售前咨询与售后问题：根据你的工具查询到的【真实数据】和【知识库检索结果】来回答。回复要简洁、友好、准确，使用与用户提问相同的语言。不要暴露你是一个 AI 程序，始终保持专业客服的口吻。

## 产品知识（内置）
- 安装/激活：进入「我的 eSIM」点「查看激活码」，扫码或手动安装；建议到达目的地后再购买安装；激活码长期有效，套餐有效期自购买之日期。
- 退款规则：仅「待激活」（未安装、未激活）订单可申请退款，审核通过后原路退回；已激活 eSIM 平台有权不予退款。
- 上网/流量：到国外没网先确认已安装并开启「数据漫游」，仍不行可在系统设置手动选择当地运营商；套餐有效期自购买之日起算，续费时流量叠加、有效期顺延、激活码不变。
- 查看：订单在「我的 → 我的订单」，eSIM 及剩余流量在「我的 eSIM」页面。

## 你拥有的工具（按需调用，不要凭空编造）
- get_orders：查当前用户真实订单；get_data_usage：查用户真实 eSIM/流量；
- search_kb：从向量知识库检索产品知识（安装、退款、上网、购买等）；
- get_packages：查平台在售套餐目录（国家/流量/天数/价格）；
- recommend_package：按目的地推荐套餐（参数 region=国家）。
工具结果为空 = 平台没有该信息，绝不能编造缺省值来自圆其说。

## 输出要求（非常重要）
你必须只输出一个 JSON 对象，不要输出任何其它文字/围栏代码块。结构：
{"reply": "给用户阅读的回答文本", "need_human": true 或 false, "category": "order 或 refund 或 install 或 connection 或 plan 或 other"}

回答与转人工规则：
1. 不知道自己不知道：凡工具/知识库没有给出的数据（例如套餐具体价格、某订单、某张卡的流量），一律不要编造。缺数据就明确说「这个我暂时无法确认」，并建议用户到「我的订单 / 我的 eSIM / 首页」自助查看，或请人工客服协助。
2. need_human 只有在两种情况下才置 true：A) 用户用了「转人工」「人工客服」「真人」「找客服」等明确要求人工的表述；B) 涉及退款失败/支付纠纷/账号安全/实名/投诉等用户要求人工介入的敏感操作。除此之外一律置 false，即使在售套餐查不到、数据拿不到也只能如实说明，不能把普通问题升级成转人工。
3. 涉及「购买/下单」：用 get_packages / recommend_package 返回在售套餐，回复末尾引导用户到首页下单页自助购买（不要在对话里真正生成订单）。
4. category：order（订单）、refund（退款）、install（安装激活）、connection（上网连接）、plan（套餐/流量）、other（其它）。`;

// ---- cached config loader ---------------------------------------------------
let aiCache: { config: AiConfig | null; at: number } | null = null;
const AI_CACHE_TTL_MS = 10_000;

export function clearAiCache(): void {
  aiCache = null;
}

// Number of tool-call rounds allowed before forcing a final answer.
const MAX_TOOL_ROUNDS = 3;

// OpenAI-compatible function-calling tool schemas. The LLM decides which to call.
// Data comes from REAL queries (user orders / eSIM data / whitelist catalog) and
// the RAG vector knowledge base. The LLM never fabricates numbers it can't see.
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
      name: 'search_kb',
      description: '在平台的向量知识库中检索。当用户询问安装步骤、激活、退款规则、到国外无法上网、流量用完、如何购买等产品问题时调用，以获取准确的产品知识。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '用户的原始问题文本' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_packages',
      description: '查询当前平台在售的全部（白名单）eSIM 套餐目录（国家、流量、天数、价格）。当用户询问有哪些套餐、多少钱、怎么买、想了解可选套餐时调用。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_package',
      description: '根据用户提到的目的地/国家，推荐具体的在售套餐。当用户想去某地、需要多少流量、让我推荐套餐时调用。',
      parameters: {
        type: 'object',
        properties: { region: { type: 'string', description: '目的地国家名称或地区代码，如「日本」「日本 jp 」' } },
        required: ['region'],
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
      } else if (name === 'search_kb') {
        let arg: any = {};
        try { arg = JSON.parse(c.function.arguments || '{}'); } catch { /* ignore */ }
        const kb = await retrieveKb(prisma, arg.query || '');
        result = kb ? `【知识库】\n${kb}` : '';
      } else if (name === 'get_packages') {
        result = (await queryPackages(prisma)).reply;
      } else if (name === 'recommend_package') {
        let arg: any = {};
        try { arg = JSON.parse(c.function.arguments || '{}'); } catch { /* ignore */ }
        result = (await recommendPackages(prisma, arg.region || '')).reply;
        // guide the user to order on the site when nothing grounded is found
        if (!result) {
          result = '未检索到该目的地的在售套餐，建议用户在首页按目的地查找并下单，或咨询更具体的国家/地区。';
        }
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
  let reply = (parsed.reply || '').trim();
  const needHuman = parsed.need_human === true;
  const category = ['order', 'refund', 'install', 'connection', 'plan', 'other'].includes(parsed.category || '')
    ? (parsed.category as string)
    : 'other';

  // 模型偶发不按 JSON 输出、直接给散文时：不能因此判定转人工。把这段自然语言透传给用户，
  // 而不是丢弃成 FALLBACK。转人工仅当模型明确标记 need_human=true（见系统提示词收紧规则）。
  if (!reply && finalContent.trim() && !/^\s*\{/.test(finalContent)) {
    reply = finalContent
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
  }

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