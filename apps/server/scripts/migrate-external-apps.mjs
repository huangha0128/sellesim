/**
 * 迁移存量 ExternalApp → Subject + ApiKey（P5）。
 *
 * 背景：/api/external 是旧的"单应用支付外放"，Open API v2 引入主体(Subject)+密钥(ApiKey)。
 * 本脚本把每一条 ExternalApp 迁移为：
 *   - 一条 Subject（name 取 app.name，callbackUrl 复用，userId 复用同一合成用户）
 *   - 一把 live ApiKey（keyId = app.appId，keySecret = app.appSecret）
 *
 * 幂等：以「ApiKey.keyId === app.appId 已存在」作为"已迁移"标记，可重复执行。
 * 订单表无需改动（订单 userId 已指向合成用户，Subject.userId 复用同一 user 即可）。
 *
 * 用法:
 *   cd apps/server && node scripts/migrate-external-apps.mjs
 * 需要 apps/server/.env 配置 DATABASE_URL（指向本地/线上 MySQL）。
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 走与 externalAuth.ensureExternalAppUser 相同的逻辑：为外部应用懒创建合成用户 */
async function ensureUser(app) {
  if (app.userId) return app.userId;
  const alipayUserId = `ext_${app.appId}`;
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { alipayUserId, nickname: `外部应用-${app.appId}` } });
      await tx.externalApp.update({ where: { id: app.id }, data: { userId: user.id } });
      return user.id;
    });
  } catch (e) {
    const fresh = await prisma.user.findUnique({ where: { alipayUserId } });
    if (fresh) return fresh.id;
    throw e;
  }
}

async function main() {
  const apps = await prisma.externalApp.findMany();
  console.log(`共发现 ${apps.length} 条 ExternalApp`);

  let createdSubject = 0;
  let createdKey = 0;
  let skipped = 0;

  for (const app of apps) {
    // 幂等：keyId === appId 已存在则跳过
    const existing = await prisma.apiKey.findUnique({ where: { keyId: app.appId } });
    if (existing) {
      skipped++;
      console.log(`  [跳过] ${app.appId}: 密钥已存在`);
      continue;
    }

    const userId = await ensureUser(app);

    // 复用已存在且归属同一合成用户的 Subject；否则新建
    let subject = await prisma.subject.findFirst({ where: { userId } });
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          name: app.name || `ext_${app.appId}`,
          callbackUrl: app.callbackUrl || null,
          userId,
        },
      });
      createdSubject++;
      console.log(`  [主体] ${app.appId}: 创建 Subject "${subject.name}"`);
    } else {
      // 主体已存在但缺 callbackUrl 时补上
      if (!subject.callbackUrl && app.callbackUrl) {
        await prisma.subject.update({ where: { id: subject.id }, data: { callbackUrl: app.callbackUrl } });
      }
      console.log(`  [主体] ${app.appId}: 复用 Subject "${subject.name}" (${subject.id})`);
    }

    await prisma.apiKey.create({
      data: {
        subjectId: subject.id,
        keyId: app.appId,
        keySecret: app.appSecret,
        name: app.name || 'default',
        mode: 'live',
        enabled: true,
      },
    });
    createdKey++;
    console.log(`  [密钥] ${app.appId}: 创建 live ApiKey`);
  }

  console.log(`\n完成：新增 Subject ${createdSubject} 条，新增 ApiKey ${createdKey} 把，跳过 ${skipped} 条。`);
}

main()
  .catch((e) => {
    console.error('迁移失败：', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());