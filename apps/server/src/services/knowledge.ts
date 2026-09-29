import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// AI knowledge base: grounded FAQ entries. Seeded idempotently at boot, and
// editable from the admin panel (/api/admin/kb). `matchKb` picks the most
// relevant enabled entries so the LLM has grounded product knowledge.
// ---------------------------------------------------------------------------

export interface KbSeed {
  category: string;
  question: string;
  answer: string;
}

const SEED_KB: KbSeed[] = [
  {
    category: 'install',
    question: '如何安装 eSIM？',
    answer:
      '安装步骤：1) 进入「我的 eSIM」页面，在对应卡片点击「查看激活码」；2) 选择「扫码安装」或用二维码下方的激活码手动安装；3) 在系统设置中添加 eSIM 蜂窝网络，完成下载；4) 到达目的地后打开「数据漫游」即可上网。',
  },
  {
    category: 'plan',
    question: '套餐有效期从什么时候开始计算？',
    answer:
      '套餐有效天数自购买之日起算。建议到达目的地后再购买并安装，以免提前占用有效期；激活码长期有效，不会因不安装而过期。',
  },
  {
    category: 'plan',
    question: '流量用完了怎么办？',
    answer:
      '若套餐已到期，可在下单时选择「加购到已到期的 eSIM」，流量叠加、有效期顺延、激活码不变；也可以直接购买一张新的 eSIM。',
  },
  {
    category: 'connection',
    question: '到了国外没有网络怎么办？',
    answer:
      '先确认 eSIM 已安装并开启「数据漫游」开关；仍无法上网可在手机系统设置中手动选择当地运营商网络；大部分套餐支持开启个人热点共享流量。',
  },
  {
    category: 'connection',
    question: '网速由什么决定？',
    answer:
      '套餐提供高速 4G/5G 网络，实际网速取决于当地运营商覆盖与信号环境。'},
  {
    category: 'refund',
    question: '退款规则是什么？',
    answer:
      '仅「待激活」（未安装、未激活）的订单可申请退款；已激活的 eSIM 平台有权不予退款。进入「我的 → 我的订单」找到对应订单，点击「申请退款」，审核通过后款项原路退回支付账户，实际到账以支付平台处理为准。',
  },
  {
    category: 'order',
    question: '如何查看我的订单状态？',
    answer:
      '进入「我的 → 我的订单」可查看全部订单，订单状态标注为「待付款 / 待激活 / 已完成 / 已退款」。',
  },
  {
    category: 'plan',
    question: '如何查看剩余流量？',
    answer:
      '进入「我的 eSIM」，在已购套餐卡片上可查看剩余流量与有效期；到期前可加购叠加。',
  },
];

const DEFAULT_CATEGORIES = ['install', 'refund', 'connection', 'plan', 'order', 'other'];

/** Idempotently seed default KB entries (only inserts the canned questions that are still missing). */
export async function seedKb(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.kbEntry.findMany({ select: { question: true } });
  const existingSet = new Set(existing.map((e) => e.question.trim()));
  for (const item of SEED_KB) {
    if (existingSet.has(item.question.trim())) continue;
    await prisma.kbEntry.create({
      data: {
        category: item.category,
        question: item.question,
        answer: item.answer,
        enabled: true,
      },
    });
  }
}

export async function getEnabledKb(prisma: PrismaClient) {
  return prisma.kbEntry.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

function normalize(s: string): string {
  return (s || '').toLowerCase();
}

/** Score how relevant a KB entry is to a user query, as the number of matched keyword units. */
function kbScore(entry: { question: string; answer: string }, q: string): number {
  const qn = normalize(entry.question);
  const an = normalize(entry.answer);
  let score = 0;
  // 2-char bigram overlap between query and question.
  for (let i = 0; i < qn.length - 1; i++) {
    const tok = qn.slice(i, i + 2);
    if (q.includes(tok)) score += 1;
  }
  // Boost when a domain keyword appears in both question/answer and query.
  for (const kw of ['安装', '激活', '退款', '流量', '有效期', '剩余', '订单', '漫游', '网速', '到期', '数据']) {
    if (q.includes(kw) || an.includes(kw)) score += 1;
  }
  return score;
}

/** Return the strongest-enough matching KB entries as readable grounding text (max N). */
export async function matchKb(prisma: PrismaClient, query: string, max = 5): Promise<string> {
  const q = normalize(query);
  if (!q) return '';
  const kb = await getEnabledKb(prisma);
  const ranked = kb
    .map((e) => ({ e, score: kbScore(e, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  if (!ranked.length) return '';
  return `- ${ranked[0].e.question}：${ranked[0].e.answer}`;
}