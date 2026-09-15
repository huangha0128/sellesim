import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { signContent, hmacVerify } from '../utils/hmac';

/**
 * 外部开放支付 API 鉴权中间件（HMAC-SHA256 签名认证）。
 *
 * 调用方需在 Header 携带：
 *   X-App-Id      外部应用 ID（ExternalApp.appId）
 *   X-Timestamp   毫秒时间戳，服务端校验与当前时间差 ≤ ±5 分钟
 *   X-Nonce       随机串（16 字节 hex 即可），5 分钟内不可重复（防重放）
 *   X-Sign        hex(HMAC-SHA256(appSecret, appId\ntimestamp\nnonce\nrawBody))
 *
 * 校验通过后挂载 req.externalApp / req.externalUserId，供下游路由使用。
 * 每个外部应用自动关联一个内部合成用户（alipayUserId='ext_<appId>'），
 * 应用首次调用时懒创建，其创建的订单挂在关联用户下便于后台按用户维度管理。
 */

export interface ExternalAuthRequest extends Request {
  externalApp?: {
    id: string;
    appId: string;
    appSecret: string;
    name: string;
    callbackUrl?: string | null;
    userId?: string | null;
    enabled: boolean;
  };
  externalUserId?: string;
  /** express.json() 的 verify 回调写入的原始请求体（签名校验用，GET 无 body 为空串） */
  rawBody?: string;
}

const TS_WINDOW_MS = 5 * 60_000; // 时间戳允许偏差 ±5 分钟
const NONCE_TTL_MS = 5 * 60_000; // nonce 防重放窗口与时间窗一致

// ================= nonce 防重放存储：Redis 优先，未配置降级进程内存 =================

const redisUrl = process.env.REDIS_URL || '';
let redis: Redis | null = null;
if (redisUrl) {
  redis = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    retryStrategy: () => 5_000,
  });
  redis.on('error', () => {
    /* Redis 不可用时静默，由进程内存降级兜底 */
  });
}

/** 进程内存降级：nonce -> 过期时间戳 */
const memNonce = new Map<string, number>();

/** 定期清理过期的内存 nonce（unref 保证不阻塞进程退出） */
if (!redis) {
  setInterval(() => {
    const now = Date.now();
    for (const [nonce, expireAt] of memNonce) {
      if (expireAt <= now) memNonce.delete(nonce);
    }
  }, 60_000).unref();
}

/**
 * nonce 判重并登记：已存在（5 分钟内使用过）返回 true。
 * Redis 用 SET NX EX 原子操作，多实例共享；未配置 Redis 时用进程内存。
 */
async function nonceReplay(nonce: string): Promise<boolean> {
  if (redis) {
    try {
      const ok = await redis.set(`yyesim:ext:nonce:${nonce}`, '1', 'EX', NONCE_TTL_MS / 1000, 'NX');
      return ok !== 'OK';
    } catch {
      /* Redis 异常降级进程内存 */
    }
  }
  const now = Date.now();
  if (memNonce.has(nonce)) return true;
  memNonce.set(nonce, now + NONCE_TTL_MS);
  return false;
}

// ================= 外部应用对应的合成用户（懒创建） =================

/** 确保外部应用已关联内部合成用户，返回其 userId（并发创建冲突时重查兜底） */
export async function ensureExternalAppUser(
  prisma: PrismaClient,
  app: { id: string; appId: string; userId?: string | null },
): Promise<string> {
  if (app.userId) return app.userId;
  const alipayUserId = `ext_${app.appId}`;
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { alipayUserId, nickname: `外部应用-${app.appId}` } });
      await tx.externalApp.update({ where: { id: app.id }, data: { userId: user.id } });
      return user.id;
    });
  } catch (e: any) {
    // 并发下已由其他请求创建：重查一次关联关系
    const fresh = await prisma.externalApp.findUnique({ where: { id: app.id }, include: { user: true } });
    if (fresh?.userId) return fresh.userId;
    throw e;
  }
}

// ================= 鉴权中间件 =================

export const externalAuth = (prisma: PrismaClient) => async (req: ExternalAuthRequest, res: Response, next: NextFunction) => {
  try {
    const appId = String(req.headers['x-app-id'] || '');
    const timestamp = String(req.headers['x-timestamp'] || '');
    const nonce = String(req.headers['x-nonce'] || '');
    const signature = String(req.headers['x-sign'] || '');

    if (!appId || !timestamp || !nonce || !signature) {
      return res.status(401).json({ code: 401, message: '缺少鉴权头（需要 X-App-Id/X-Timestamp/X-Nonce/X-Sign）' });
    }

    // 时间窗校验（±5 分钟）
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || String(ts) !== timestamp || Math.abs(Date.now() - ts) > TS_WINDOW_MS) {
      return res.status(401).json({ code: 401, message: '时间戳无效或已超出允许范围（±5 分钟）' });
    }

    const app = await prisma.externalApp.findUnique({ where: { appId } });
    if (!app || !app.enabled) {
      return res.status(401).json({ code: 401, message: '应用不存在或已被禁用' });
    }

    // 验签（rawBody 为空串时签名串以 nonce 后的换行结尾）
    const rawBody = req.rawBody || '';
    const content = signContent(appId, timestamp, nonce, rawBody);
    if (!hmacVerify(app.appSecret, content, signature)) {
      return res.status(401).json({ code: 401, message: '签名校验失败' });
    }

    // nonce 防重放（放在验签之后，避免未授权请求消耗 nonce 存储）
    if (await nonceReplay(nonce)) {
      return res.status(401).json({ code: 401, message: '重复的请求（nonce 已被使用）' });
    }

    const externalUserId = await ensureExternalAppUser(prisma, app);
    req.externalApp = app;
    req.externalUserId = externalUserId;
    next();
  } catch (e: any) {
    console.error('[externalAuth] 鉴权异常：', e.message);
    res.status(500).json({ code: 500, message: '鉴权服务异常' });
  }
};
