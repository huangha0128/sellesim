import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const JWT_SECRET = config.jwt.secret;

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; iat?: number; exp?: number };
    req.userId = decoded.userId;

    // 滑动续期：剩余有效期不足整个寿命一半时下发新 token（X-New-Token 响应头），
    // 前端无感替换。活跃用户只要 30 天内有任意请求即可持续续期，无需重新登录。
    if (decoded.exp && decoded.iat) {
      const remainingMs = decoded.exp * 1000 - Date.now();
      const totalMs = (decoded.exp - decoded.iat) * 1000;
      if (totalMs > 0 && remainingMs < totalMs / 2) {
        const renewed = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
          expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
        });
        res.setHeader('X-New-Token', renewed);
      }
    }
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
};
