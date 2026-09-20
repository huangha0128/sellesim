import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

/**
 * Open platform v3: partner portal login.
 * A partner signs in with the keyId + keySecret issued by the platform and
 * receives a portal session JWT (type=partner). This token lets the partner
 * portal authenticate against /api/open/v1 (reads and writes), independently
 * of the API-key HMAC signing path. See docs/open-platform-v3-design.md §5.
 */
export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/auth/login', async (req: Request, res: Response) => {
    const { keyId, keySecret } = req.body || {};
    if (!keyId || !keySecret) {
      return res.status(400).json({ code: 400, message: '缺少 keyId / keySecret' });
    }
    const key = await prisma.apiKey.findUnique({
      where: { keyId: String(keyId) },
      include: { subject: true },
    });
    if (!key || !key.enabled || key.keySecret !== String(keySecret)) {
      return res.status(401).json({ code: 401, message: '密钥无效' });
    }
    if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ code: 401, message: '密钥已过期' });
    }
    const subject = key.subject;
    if (!subject || subject.status !== 'active') {
      return res.status(403).json({ code: 403, message: '主体已被停用' });
    }

    const token = jwt.sign(
      { type: 'partner', subjectId: subject.id, keyId: key.keyId },
      config.jwt.secret,
      { expiresIn: '7d' },
    );
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {
      /* fire and forget */
    });

    return res.json({
      code: 0,
      message: 'ok',
      data: {
        token,
        subject: { id: subject.id, name: subject.name, status: subject.status },
      },
    });
  });

  return router;
};