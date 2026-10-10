/**
 * 回填客服会话的联系邮箱快照（contact_email）。
 *
 * 快照语义：会话创建「当时」该用户最新一笔订单的邮箱；该时间点之前无订单则回退注册邮箱。
 * 幂等可重复执行：只处理 contact_email 为空的会话。
 *
 * 用法:
 *   node scripts/backfill-chat-contact-email.mjs
 * 数据库连接读取 apps/server/.env 的 DATABASE_URL。
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sessions = await prisma.chatSession.findMany({
  where: { contactEmail: null },
  select: { id: true, userId: true, createdAt: true },
});

// 按用户聚合订单，避免逐会话查订单（N+1）。
const userIds = [...new Set(sessions.map((s) => s.userId))];
const orders = await prisma.order.findMany({
  where: { userId: { in: userIds } },
  orderBy: { createdAt: 'desc' },
  select: { userId: true, email: true, createdAt: true },
});
const users = await prisma.user.findMany({
  where: { id: { in: userIds } },
  select: { id: true, email: true },
});
const profileEmailByUser = new Map(users.map((u) => [u.id, u.email]));

// 每个用户的订单按时间升序排列，便于找「会话创建前最近一笔」。
const ordersByUser = new Map();
for (const o of orders) {
  if (!o.userId) continue;
  if (!ordersByUser.has(o.userId)) ordersByUser.set(o.userId, []);
  ordersByUser.get(o.userId).push(o); // desc 遍历后仍为 desc
}
for (const list of ordersByUser.values()) list.reverse(); // 升序

let fromOrder = 0;
let fromProfile = 0;
let skipped = 0;

for (const s of sessions) {
  if (!s.userId) {
    skipped++;
    continue;
  }
  // 快照语义：会话创建时间之前（含）该用户最近一笔订单的邮箱。
  const list = ordersByUser.get(s.userId) || [];
  let email = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (new Date(list[i].createdAt) <= new Date(s.createdAt)) {
      email = list[i].email;
      break;
    }
  }
  if (email) {
    fromOrder++;
  } else {
    email = profileEmailByUser.get(s.userId) || null;
    if (email) fromProfile++;
  }
  if (!email) {
    skipped++;
    continue;
  }
  await prisma.chatSession.update({ where: { id: s.id }, data: { contactEmail: email } });
}

console.log(
  `[backfill] 待回填会话 ${sessions.length}：订单邮箱 ${fromOrder}，注册邮箱回退 ${fromProfile}，跳过 ${skipped}`
);
await prisma.$disconnect();
