import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { broadcastToSession } from './chatHub';

// 会话空闲上限：超过该时长无新内容则归档（closed）。与用户端 chat.ts 共用同一常量，避免两处漂移。
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
// 检查周期：每 1 小时扫描一次
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
// 分布式锁键：多实例/负载均衡/微服务部署时，保证同一周期只有一个实例真正执行清理
const LOCK_KEY = 'sellsim:chat:sweeper:lock';

// ---- Redis 连接（未配置 REDIS_URL 时退化为「无锁」，清理逻辑本身幂等，依然安全）----
const redisUrl = process.env.REDIS_URL || '';
let redis: Redis | null = null;
if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => {
    /* Redis 不可用时静默：退化为无锁执行（幂等，不会出错） */
  });
}

/**
 * 归档所有「非 closed 且空闲超过 SESSION_IDLE_MS」的会话。
 * 使用带条件的批量更新，天然幂等：即便多实例并发执行，也只是重复写相同结果，不会产生错误数据。
 */
export async function sweepIdleSessions(prisma: PrismaClient): Promise<string[]> {
  const cutoff = new Date(Date.now() - SESSION_IDLE_MS);
  const stale = await prisma.chatSession.findMany({
    where: { status: { not: 'closed' }, updatedAt: { lt: cutoff } },
    select: { id: true },
    take: 1000,
  });
  const ids = stale.map((s) => s.id);
  if (!ids.length) return [];

  await prisma.chatSession.updateMany({
    where: { id: { in: ids }, status: { not: 'closed' } },
    data: {
      status: 'closed',
      closedAt: new Date(),
      lastSender: 'system',
      lastMessage: '会话超时已归档',
    },
  });

  // 尽力而为地广播状态：只能覆盖连到本实例的客户端，其它实例上的客户端由其自身轮询兜底。
  for (const id of ids) {
    broadcastToSession(id, { type: 'status', session: { id, status: 'closed' } });
  }
  return ids;
}

/** 抢分布式锁：抢到（或未配置 Redis）返回 true，表示本实例本周期可执行清理 */
async function acquireLock(): Promise<boolean> {
  if (!redis || redis.status !== 'ready') return true;
  try {
    // 锁 TTL 略小于检查周期：保证「每个周期集群内至多执行一次」
    const ok = await redis.set(LOCK_KEY, String(process.pid), 'PX', SWEEP_INTERVAL_MS - 30_000, 'NX');
    return ok === 'OK';
  } catch {
    return true;
  }
}

/** 启动定时清理：启动 30s 后先跑一次，之后每 1 小时一次 */
export function startSessionSweeper(prisma: PrismaClient): void {
  const run = async () => {
    try {
      if (!(await acquireLock())) {
        // 本周期已由其它实例负责，直接跳过
        return;
      }
      const ids = await sweepIdleSessions(prisma);
      if (ids.length) console.log(`[sweeper] 已归档 ${ids.length} 个空闲超时会话`);
    } catch (e: any) {
      console.error('[sweeper] 会话清理失败：', e?.message || e);
    }
  };

  setTimeout(run, 30_000);
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.log(`[sweeper] 会话空闲清理已启动（每 ${SWEEP_INTERVAL_MS / 60000} 分钟检查一次，空闲上限 ${SESSION_IDLE_MS / 60000} 分钟）`);
}