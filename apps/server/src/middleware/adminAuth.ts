import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

/**
 * 管理后台鉴权。
 *
 * 与小程序用户鉴权（middleware/auth.ts）共用同一个 JWT 密钥，因此**必须**靠 payload 里的
 * type='admin' 区分身份，否则任何一个小程序用户的 token 都能访问后台接口。
 * 这里对 type 做严格校验，非 admin 的 token 一律拒绝。
 */

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    name: string | null;
  };
}

/** 管理员 token 有效期 */
const ADMIN_TOKEN_EXPIRES_IN = '12h';

/** 签发管理员 JWT（payload 带 type=admin 作为身份标识） */
export function signAdminToken(admin: { id: string; username: string }): string {
  return jwt.sign({ userId: admin.id, username: admin.username, type: 'admin' }, config.jwt.secret, {
    expiresIn: ADMIN_TOKEN_EXPIRES_IN,
  });
}

// ================= 口令哈希（scrypt，无第三方依赖） =================

const SCRYPT_KEYLEN = 64;

/** 生成随机盐（hex） */
export function genSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** 计算口令哈希：hex(scrypt(password, salt)) */
export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
}

/** 校验口令（timingSafeEqual 防时序攻击） */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHash, 'hex');
  // 长度不一致时 timingSafeEqual 会抛错，先挡掉
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// ================= 中间件 =================

export const adminAuth = (prisma: PrismaClient) => async (
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ code: 401, message: '未登录' });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
    }

    // 关键：必须是管理员 token，小程序用户 token 不得越权
    if (payload?.type !== 'admin' || !payload?.userId) {
      return res.status(403).json({ code: 403, message: '无权访问管理后台' });
    }

    // 账号可能已被删除或改名，每次校验一下存在性
    const admin = await prisma.adminUser.findUnique({ where: { id: payload.userId } });
    if (!admin) {
      return res.status(401).json({ code: 401, message: '账号不存在或已被删除' });
    }

    req.admin = { id: admin.id, username: admin.username, name: admin.name };
    next();
  } catch (e: any) {
    console.error('[adminAuth] 鉴权异常：', e.message);
    res.status(500).json({ code: 500, message: '鉴权服务异常' });
  }
};
