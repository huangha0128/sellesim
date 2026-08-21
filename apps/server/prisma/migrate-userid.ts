/**
 * 历史数据迁移：为 userId 为空的订单和 eSIM 补充归属用户
 * 匹配策略：按邮箱匹配 → 若只有一位用户则全部归给该用户
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email, u.id]));

  // 1. 处理 Order
  const orphanOrders = await prisma.order.findMany({ where: { userId: null } });
  console.log(`[migrate] 待处理订单数: ${orphanOrders.length}`);

  let matched = 0;
  let fallback = 0;

  for (const order of orphanOrders) {
    let targetUserId: string | null = null;

    // 优先按邮箱匹配
    if (order.email && userByEmail.has(order.email)) {
      targetUserId = userByEmail.get(order.email)!;
    }

    // 若未匹配上且只有一位用户，兜底归给唯一用户
    if (!targetUserId && users.length === 1) {
      targetUserId = users[0].id;
    }

    if (targetUserId) {
      await prisma.order.update({
        where: { id: order.id },
        data: { userId: targetUserId },
      });
      // 同步更新关联的 esim
      await prisma.esim.updateMany({
        where: { orderId: order.id, userId: null },
        data: { userId: targetUserId },
      });
      matched++;
    } else {
      fallback++;
    }
  }

  // 2. 处理有 orderId 但 userId 仍为空的 esim（可能订单已有关联但 esim 漏了）
  const orphanEsims = await prisma.esim.findMany({
    where: { userId: null },
    include: { order: true },
  });
  for (const esim of orphanEsims) {
    if (esim.order?.userId) {
      await prisma.esim.update({
        where: { id: esim.id },
        data: { userId: esim.order.userId },
      });
    }
  }

  console.log(`[migrate] 完成！匹配更新: ${matched}，未能匹配(无用户): ${fallback}，补充esim: ${orphanEsims.length}`);
}

main()
  .catch((e) => {
    console.error('[migrate] 失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());