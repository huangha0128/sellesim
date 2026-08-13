import { PrismaClient } from '@prisma/client';
import { syncAllFromTiger } from './sync';

/** ????????? Tiger ??????? seed mock ???*/
const prisma = new PrismaClient();
(async () => {
  try {
    const result = await syncAllFromTiger(prisma);
    console.log('[bootstrap-sync]', result.message);
  } catch (e: any) {
    console.error('[bootstrap-sync] ???????????:', e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
})();
