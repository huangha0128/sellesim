import { PrismaClient } from '@prisma/client';

// Shared Prisma singleton across routes, services and the package view layer.
// Centralizing it here prevents circular imports (index.ts <-> tiger/view.ts).
export const prisma = new PrismaClient();