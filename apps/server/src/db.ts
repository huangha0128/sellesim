// 确保 DATABASE_URL（apps/server/.env）在 PrismaClient 实例化前已加载
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Shared Prisma singleton across routes, services and the package view layer.
// Centralizing it here prevents circular imports (index.ts <-> tiger/view.ts).
export const prisma = new PrismaClient();