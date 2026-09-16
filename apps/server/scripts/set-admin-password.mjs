/**
 * 设置/重置管理后台账号密码（幂等，可重复执行）。
 *
 * 用法:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 node scripts/set-admin-password.mjs
 * 未传环境变量时默认 admin / admin123。
 * 传入的环境变量需已在容器内可见（compose 透传）或显式设置。
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123';

// 与 src/middleware/adminAuth.ts 保持一致：salt=16 字节 hex，hash=hex(scrypt(password,salt,64))
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

const existing = await prisma.adminUser.findUnique({ where: { username } });
if (existing) {
  await prisma.adminUser.update({ where: { id: existing.id }, data: { salt, passwordHash } });
  console.log(`[admin] 已重置账号 ${username} 的密码（${password}）`);
} else {
  await prisma.adminUser.create({ data: { username, salt, passwordHash, name: '管理员' } });
  console.log(`[admin] 已创建账号 ${username}（密码 ${password}）`);
}

await prisma.$disconnect();