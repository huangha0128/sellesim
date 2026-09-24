import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { syncAllFromTiger } from './dist/tiger/sync.js';

const prisma = new PrismaClient();

/** 门户账号默认初始用户名 / 密码（与后台创建主体保持一致） */
const DEFAULT_PORTAL_USERNAME = 'admin';
const DEFAULT_PORTAL_PASSWORD = 'admin123456';

/** scrypt 哈希（与 middleware/adminAuth.ts 同一方案，此处为纯 Node 启动脚本） */
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * 为没有门户账号的存量主体补齐初始账号（用户名默认 admin，冲突时加随机后缀；
 * 密码默认 admin123456）。幂等：已有 username 的主体跳过。
 * 分配结果会打印到日志，管理员可据此告知伙伴或到后台重置。
 */
async function initSubjectAccounts() {
  const subjects = await prisma.subject.findMany({
    where: { OR: [{ username: null }, { passwordHash: null }] },
    select: { id: true, name: true },
  });
  for (const s of subjects) {
    let username = DEFAULT_PORTAL_USERNAME;
    while (await prisma.subject.findUnique({ where: { username } })) {
      username = `${DEFAULT_PORTAL_USERNAME}_${crypto.randomBytes(3).toString('hex')}`;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    await prisma.subject.update({
      where: { id: s.id },
      data: { username, salt, passwordHash: hashPassword(DEFAULT_PORTAL_PASSWORD, salt) },
    });
    console.log(`[bootstrap] 主体「${s.name}」初始化门户账号：username=${username} password=${DEFAULT_PORTAL_PASSWORD}`);
  }
  if (subjects.length) {
    console.log(`[bootstrap] 共初始化 ${subjects.length} 个主体的门户账号`);
  }
}

async function main() {
  console.log('[bootstrap] checking Tiger config...');
  const result = await syncAllFromTiger(prisma);
  console.log('[bootstrap] sync result:', JSON.stringify(result));
  await initSubjectAccounts();
}

main()
  .catch((e) => {
    console.error('[bootstrap] sync failed (will start server anyway):', e?.message || e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
