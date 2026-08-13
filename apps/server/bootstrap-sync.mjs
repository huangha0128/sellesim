import { PrismaClient } from '@prisma/client';
import { syncAllFromTiger } from './dist/tiger/sync.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[bootstrap] checking Tiger config...');
  const result = await syncAllFromTiger(prisma);
  console.log('[bootstrap] sync result:', JSON.stringify(result));
}

main()
  .catch((e) => {
    console.error('[bootstrap] sync failed (will start server anyway):', e?.message || e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
