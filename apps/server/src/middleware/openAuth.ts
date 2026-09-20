import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { signContent, hmacVerify } from '../utils/hmac';
import { config } from '../config';

/**
 * Open platform v2 dual-mode auth middleware.
 *
 * Every request must carry `X-Api-Key` (ak_live_xxx) identifying subject + key.
 * Read requests (GET) need only the Key. Write requests (POST/PUT/PATCH/DELETE)
 * additionally require `X-Timestamp`, `X-Nonce` and `X-Sign` so that a leaked
 * keyId cannot be used to place orders or refund.
 *
 * Signing (identical to /api/external):
 *   X-Sign = hex(HMAC-SHA256(keySecret, keyId\ntimestamp\nnonce\nrawBody))
 *
 * Validation order (docs/open-api-design.md §3.4):
 *   1. X-Api-Key present          -> 401
 *   2. ApiKey exists/enabled/life -> 401
 *   3. Subject status=active      -> 401
 *   4. IP whitelist (if set)      -> 403
 *   5. write: timestamp/nonce/sign-> 401
 *   6. rate limit                 -> 429
 *   7. inject req.subject / req.apiKey
 */
export interface OpenAuthRequest extends Request {
  subject?: {
    id: string;
    name: string;
    status: string;
    callbackUrl?: string | null;
    defaultMarkupPercent?: number | null;
    splitPercent?: number | null;
    userId?: string | null;
  };
  apiKey?: {
    id: string;
    keyId: string;
    mode: string | null;
  };
  /** True when authenticated via the partner portal JWT (not an HMAC key). */
  partnerPortal?: boolean;
  /** raw body set by express.json() verify for signature checks */
  rawBody?: string;
}

const TS_WINDOW_MS = 5 * 60_000;
const NONCE_TTL_MS = 5 * 60_000;

/** Methods that require request signing */
function isWriteMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

// ================= nonce replay (Redis > process memory) =================
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
    /* Redis unavailable -> process memory fallback */
  });
}

const memNonce = new Map<string, number>();
if (!redis) {
  setInterval(() => {
    const now = Date.now();
    for (const [nonce, expireAt] of memNonce) if (expireAt <= now) memNonce.delete(nonce);
  }, 60_000).unref();
}

async function nonceReplay(nonce: string): Promise<boolean> {
  if (redis) {
    try {
      const ok = await redis.set(`yyesim:open:nonce:${nonce}`, '1', 'EX', NONCE_TTL_MS / 1000, 'NX');
      return ok !== 'OK';
    } catch {
      /* fall through to memory */
    }
  }
  const now = Date.now();
  if (memNonce.has(nonce)) return true;
  memNonce.set(nonce, now + NONCE_TTL_MS);
  return false;
}

// ================= rate limit (Redis counter > process memory) =================
/** 1-minute sliding window counters per subject key */
const READ_LIMIT = 120;
const WRITE_LIMIT = 30;
const WINDOW_MS = 60_000;

// memory fallback: key -> array of timestamps
const memBuckets = new Map<string, number[]>();

async function rateLimit(subjectId: string, method: string): Promise<number> {
  const limit = isWriteMethod(method) ? WRITE_LIMIT : READ_LIMIT;
  const bucketKey = `yyesim:open:rl:${subjectId}:${isWriteMethod(method) ? 'w' : 'r'}`;
  const now = Date.now();

  if (redis) {
    try {
      const key = `${bucketKey}:${Math.floor(now / WINDOW_MS)}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, Math.ceil(WINDOW_MS / 1000));
      return count;
    } catch {
      /* fall through to memory */
    }
  }

  let ts = memBuckets.get(bucketKey) || [];
  ts = ts.filter((t) => now - t < WINDOW_MS);
  ts.push(now);
  memBuckets.set(bucketKey, ts);
  return ts.length;
}

// ================= middleware =================
export const openAuth = (prisma: PrismaClient) => async (
  req: OpenAuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Portal session: Bearer token (type=partner) authenticates the logged-in
    // partner directly. This is distinct from the API key HMAC path and lets the
    // partner portal perform both reads and writes under its own identity.
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (bearer) {
      let decoded: any;
      try {
        decoded = jwt.verify(bearer, config.jwt.secret) as any;
      } catch {
        return res.status(401).json({ code: 401, message: '门户登录已过期' });
      }
      if (!decoded || decoded.type !== 'partner' || !decoded.subjectId) {
        return res.status(401).json({ code: 401, message: '无效的门户凭证' });
      }
      const subject = await prisma.subject.findUnique({ where: { id: decoded.subjectId } });
      if (!subject || subject.status !== 'active') {
        return res.status(401).json({ code: 401, message: '主体不存在或已停用' });
      }
      const used = await rateLimit(subject.id, req.method);
      if (used > (isWriteMethod(req.method) ? WRITE_LIMIT : READ_LIMIT)) {
        return res.status(429).json({ code: 429, message: '请求过于频繁，请稍后重试' });
      }
      req.subject = {
        id: subject.id,
        name: subject.name,
        status: subject.status,
        callbackUrl: subject.callbackUrl,
        defaultMarkupPercent: subject.defaultMarkupPercent,
        splitPercent: subject.splitPercent,
        userId: subject.userId,
      };
      req.apiKey = { id: 'portal_' + decoded.subjectId, keyId: decoded.keyId || 'portal', mode: 'portal' };
      req.partnerPortal = true;
      return next();
    }

    const keyId = String(req.headers['x-api-key'] || '');
    if (!keyId) {
      return res.status(401).json({ code: 401, message: '缺少鉴权头 X-Api-Key' });
    }

    // 2. ApiKey lookup (enabled + expiresAt)
    const apiKey = await prisma.apiKey.findUnique({ where: { keyId }, include: { subject: true } });
    if (!apiKey || !apiKey.enabled) {
      return res.status(401).json({ code: 401, message: '密钥不存在或已被禁用' });
    }
    if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ code: 401, message: '密钥已过期' });
    }

    // 3. Subject must be active
    const subject = apiKey.subject;
    if (!subject || subject.status !== 'active') {
      return res.status(401).json({ code: 401, message: '主体已停用' });
    }

    // 4. IP whitelist
    if (apiKey.ipWhitelist) {
      const allowed = String(apiKey.ipWhitelist).split(',').map((s) => s.trim()).filter(Boolean);
      const ip = req.ip || req.socket?.remoteAddress || '';
      if (allowed.length && !allowed.includes(ip)) {
        return res.status(403).json({ code: 403, message: 'IP 不在白名单内' });
      }
    }

    // 5. write: strong auth (timestamp / nonce / signature)
    if (isWriteMethod(req.method)) {
      const timestamp = String(req.headers['x-timestamp'] || '');
      const nonce = String(req.headers['x-nonce'] || '');
      const signature = String(req.headers['x-sign'] || '');
      if (!timestamp || !nonce || !signature) {
        return res.status(401).json({ code: 401, message: '写操作需要 X-Timestamp/X-Nonce/X-Sign' });
      }
      const ts = Number(timestamp);
      if (!Number.isFinite(ts) || String(ts) !== timestamp || Math.abs(Date.now() - ts) > TS_WINDOW_MS) {
        return res.status(401).json({ code: 401, message: '时间戳无效或已超出允许范围（±5 分钟）' });
      }
      const content = signContent(keyId, timestamp, nonce, req.rawBody || '');
      if (!hmacVerify(apiKey.keySecret, content, signature)) {
        return res.status(401).json({ code: 401, message: '签名校验失败' });
      }
      if (await nonceReplay(nonce)) {
        return res.status(401).json({ code: 401, message: '重复的请求（nonce 已被使用）' });
      }
    }

    // 6. rate limit
    const used = await rateLimit(subject.id, req.method);
    if (used > (isWriteMethod(req.method) ? WRITE_LIMIT : READ_LIMIT)) {
      return res.status(429).json({ code: 429, message: '请求过于频繁，请稍后重试' });
    }

    // 7. inject + async lastUsedAt
    req.subject = { id: subject.id, name: subject.name, status: subject.status, callbackUrl: subject.callbackUrl, defaultMarkupPercent: subject.defaultMarkupPercent, splitPercent: subject.splitPercent, userId: subject.userId };
    req.apiKey = { id: apiKey.id, keyId: apiKey.keyId, mode: apiKey.mode };
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {
      /* fire and forget */
    });
    next();
  } catch (e: any) {
    console.error('[openAuth] 鉴权异常：', e.message);
    res.status(500).json({ code: 500, message: '鉴权服务异常' });
  }
};