import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { verifyPassword } from '../middleware/adminAuth';

/**
 * Open platform v3: partner portal login.
 * A partner signs in with the username + password issued by the platform admin
 * and receives a portal session JWT (type=partner). This token lets the partner
 * portal authenticate against /api/open/v1 (reads and writes), independently
 * of the API-key HMAC signing path. See docs/open-platform-v3-design.md §5.
 * Password hashing reuses the AdminUser scrypt scheme (middleware/adminAuth.ts).
 */
export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '缺少用户名或密码' });
    }
    const subject = await prisma.subject.findUnique({
      where: { username: String(username).trim() },
    });
    // 通用错误文案，避免账号枚举
    if (
      !subject ||
      !subject.salt ||
      !subject.passwordHash ||
      !verifyPassword(String(password), subject.salt, subject.passwordHash)
    ) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }
    if (subject.status !== 'active') {
      return res.status(403).json({ code: 403, message: '主体已被停用' });
    }

    const token = jwt.sign(
      { type: 'partner', subjectId: subject.id, username: subject.username },
      config.jwt.secret,
      { expiresIn: '7d' },
    );

    return res.json({
      code: 0,
      message: 'ok',
      data: {
        token,
        subject: { id: subject.id, name: subject.name, status: subject.status, username: subject.username },
      },
    });
  });

  return router;
};
