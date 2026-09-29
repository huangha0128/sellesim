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
    `${i + 1}. ${o.pkgName || (o.gb + 'GB' + (o.days ? '/' + o.days + '天' : ''))}｜${ORDER_STATUS_TEXT[o.status] || o.status}｜${fmtDate(o.createdAt)}`,
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