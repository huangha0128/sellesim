import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Local "tools" for the AI customer service. These query REAL data from the DB
// (scoped by userId) and build a deterministic reply WITHOUT calling the LLM.
// Reliable and fast; used for the quick actions (query order / data usage).
// ---------------------------------------------------------------------------

const ORDER_STATUS_TEXT: Record<string, string> = {
  pending: '待付款',
  paid: '待激活',
  refunded: '已退款',
};

const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', USD: '$' };

function priceText(p: any): string {
  const n = Number(p?.price);
  if (Number.isFinite(n)) {
    return `${CURRENCY_SYMBOL[p?.currency] || ''}${n}`;
  }
  return '';
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return '未知';
  return new Date(d).toLocaleString('zh-CN', { hour12: false, dateStyle: 'short', timeStyle: 'short' });
}

/** Latest orders summary for the user. */
export async function queryOrders(
  prisma: PrismaClient,
  userId: string | undefined,
): Promise<{ reply: string; category: string }> {
  if (!userId) {
    return { reply: '抱歉，暂时无法获取您的订单信息，请转人工客服协助。', category: 'order' };
  }
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (!orders.length) {
    return {
      reply: '您当前还没有订单。可以在首页选择国家和地区下单购买 eSIM 流量套餐，即买即用。',
      category: 'order',
    };
  }

  const lines = orders.map((o, i) =>
    `${i + 1}. ${o.pkgName || (o.gb + 'GB' + (o.days ? '/' + o.days + '天' : ''))}｜订单号 ${o.orderNo}｜${ORDER_STATUS_TEXT[o.status] || o.status}｜${fmtDate(o.createdAt)}`,
  );
  return {
    reply: `您共有 ${orders.length} 笔最近订单：\n${lines.join('\n')}\n\n如需退改请在「我的 → 我的订单」中操作。`,
    category: 'order',
  };
}

/** Remaining data & validity summary for the user's eSIMs. */
export async function queryData(
  prisma: PrismaClient,
  userId: string | undefined,
): Promise<{ reply: string; category: string }> {
  if (!userId) {
    return { reply: '抱歉，暂时无法获取您的流量信息，请转人工客服协助。', category: 'plan' };
  }
  const esims = await prisma.esim.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!esims.length) {
    return {
      reply: '您还没有购买任何 eSIM。在首页选择目的地即可购买，落地即用。',
      category: 'plan',
    };
  }

  const lines = esims.map((e, i) => {
    const label = e.pkgName || `${e.countryCode || ''} ${e.gb + 'GB'}`;
    if (new Date(e.expireAt).getTime() < Date.now()) {
      return `${i + 1}. ${label}｜已到期`;
    }
    const totalMb = (e.gb || 0) * 1024;
    const remainMb = Math.max(totalMb - (e.used || 0), 0);
    const remainTxt = e.isUnlimited
      ? '高速流量已用完(降速不限量)'
      : `剩余约 ${Math.round(remainMb)} MB`;
    return `${i + 1}. ${label}｜${remainTxt}｜有效期至 ${fmtDate(e.expireAt)}`;
  });
  return {
    reply: `您当前有 ${esims.length} 张 eSIM：\n${lines.join('\n')}`,
    category: 'plan',
  };
}

// ---- package catalog tools (grounded on the real Tiger whitelist) -----------

/**
 * Whitelisted (on-sale, priced) package catalog summary. Used by the AI to
 * recommend / guide ordering. Prices are display-currency formatted.
 */
export async function queryPackages(prisma: PrismaClient): Promise<{ reply: string; category: string }> {
  try {
    const { listAllPackagesView } = await import('../tiger/view');
    const list = await listAllPackagesView();
    if (!list.length) {
      return { reply: '当前暂无在售套餐，可稍后再试。', category: 'plan' };
    }
    // Group by country to keep the summary compact.
    const groups = new Map<string, any[]>();
    for (const p of list) {
      const key = String(p.countryName || p.countryCode || '其他');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const lines: string[] = [];
    for (const [country, pkgs] of groups) {
      const top = pkgs.slice(0, 3).map((p) => `${p.gb}GB/${p.days}天 ${priceText(p)}`).join('、');
      lines.push(`${country}：${top}`);
    }
    return {
      reply: `可选套餐（多国家、多价位，可在购买页筛选）：\n${lines
        .slice(0, 8)
        .map((l, i) => `${i + 1}. ${l}`)
        .join('\n')}\n\n更多地区与详情请在首页按目的地选择并下单。`,
      category: 'plan',
    };
  } catch (e: any) {
    return { reply: '', category: 'plan' };
  }
}

/** Recommend packages for a region/flow preference. Returns an empty reply when ungrounded. */
export async function recommendPackages(
  prisma: PrismaClient,
  region: string,
): Promise<{ reply: string; category: string }> {
  const { listAllPackagesView } = await import('../tiger/view');
  const list = await listAllPackagesView();
  const kw = String(region || '').trim().toLowerCase();
  if (!kw || !list.length) return { reply: '', category: 'plan' };
  const matched = list.filter(
    (p) =>
      (p.countryName || '').toLowerCase().includes(kw) ||
      (p.countryCode || '').toLowerCase().includes(kw),
  );
  if (!matched.length) return { reply: '', category: 'plan' };
  const top = matched.slice(0, 3);
  const lines = top.map(
    (p, i) => `${i + 1}. ${p.countryName || p.countryCode} ${p.gb}GB / ${p.days}天 — ${priceText(p)}（${p.pkgName || 'eSIM'}）`,
  );
  return {
    reply: `为您推荐以下套餐（可到首页对应地区直接下单）：\n${lines.join('\n')}`,
    category: 'plan',
  };
}

// ---- refund tool -----------------------------------------------------------

/** 该用户名下可退款（待激活）的订单列表，供 AI 向用户确认订单号。 */
async function listRefundableOrders(
  prisma: PrismaClient,
  userId: string,
): Promise<{ lines: string[]; count: number }> {
  const candidates = await prisma.order.findMany({
    where: { userId, status: 'paid' },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  return {
    count: candidates.length,
    lines: candidates.map(
      (o, i) => `${i + 1}. ${o.pkgName || o.gb + 'GB'}｜订单号 ${o.orderNo}｜${fmtDate(o.createdAt)}`,
    ),
  };
}

const NO_REFUNDABLE_ORDER_REPLY =
  '该用户名下没有可申请退款的订单（仅「待激活」订单支持退款，已激活套餐无法退款）。请如实告知用户。';

/**
 * Submit a user refund request on behalf of the AI customer service.
 * IMPORTANT: only call this AFTER the user has explicitly given a reason.
 * Reuses the same business logic as POST /api/orders/:orderNo/refund-request.
 */
export async function requestRefund(
  prisma: PrismaClient,
  userId: string | undefined,
  arg: { reason?: string; orderNo?: string },
): Promise<{ reply: string; category: string }> {
  if (!userId) {
    return { reply: '用户未登录，无法提交退款申请，请引导用户先登录后再试。', category: 'refund' };
  }
  // 顺序：先确认「退哪一笔订单」，再确认「退款原因」，两者齐全才提交。
  const orderNo = String(arg?.orderNo || '').trim();
  if (!orderNo) {
    const { lines, count } = await listRefundableOrders(prisma, userId);
    if (!count) return { reply: NO_REFUNDABLE_ORDER_REPLY, category: 'refund' };
    return {
      reply: `尚未确认要退哪一笔订单。请先把下列可退款（待激活）订单发给用户，询问「请问您要退哪一笔？」，用户选定后再询问退款原因，然后重新调用本工具并填上 orderNo 与 reason：\n${lines.join('\n')}`,
      category: 'refund',
    };
  }

  // 订单号必须真实属于该用户：查不到时直接回退到候选清单，让模型自纠错，
  // 避免把「订单不存在」抛给用户后仍反复用同一个错误订单号重试。
  const owned = await prisma.order.findFirst({ where: { orderNo, userId } });
  if (!owned) {
    const { lines, count } = await listRefundableOrders(prisma, userId);
    return {
      reply: `未找到订单号「${orderNo}」（不存在或不属于当前用户）。请勿再使用该订单号，也不要编造订单号；${
        count
          ? `请从下列可退款（待激活）订单中，与用户确认后重新调用本工具：\n${lines.join('\n')}`
          : NO_REFUNDABLE_ORDER_REPLY
      }`,
      category: 'refund',
    };
  }

  const reason = String(arg?.reason || '').trim();
  if (!reason) {
    // Tool schema marks reason as required; if the model still calls it empty, tell the model to ask first.
    return {
      reply: '订单已确认，但尚未获得退款原因：请询问用户「请问您退款的原因是？」，拿到用户明确说明的原因后再调用本工具。',
      category: 'refund',
    };
  }

  try {
    const { applyRefundRequest } = await import('./refund');
    const { buildRefundDeps } = await import('./payment');
    await applyRefundRequest(buildRefundDeps(prisma, orderNo), userId, orderNo, reason);
    return {
      reply: `退款申请已提交成功（订单 ${orderNo}）。请告知用户：平台审核通过后款项将原路退回，可在「我的订单」查看进度。`,
      category: 'refund',
    };
  } catch (e: any) {
    return { reply: `退款申请未成功：${e?.message || '未知错误'}。请如实告知用户失败原因，不要编造成功。`, category: 'refund' };
  }
}