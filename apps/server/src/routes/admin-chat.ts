import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuth, AdminAuthRequest } from '../middleware/adminAuth';

// Admin-side customer support endpoints. Mounted at /api/admin/chat, admin auth required.

export default (prisma: PrismaClient) => {
  const router = Router();
  router.use(adminAuth(prisma));

  // GET /api/admin/chat/sessions?status=&unread=1&page=&pageSize=
  router.get('/sessions', async (req: Request, res: Response) => {
    const { status, unread, page: pageRaw, pageSize: sizeRaw } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(sizeRaw || '20', 10) || 20));

    const where: any = {};
    if (status && ['ai', 'human', 'closed'].includes(status)) where.status = status;
    if (unread === '1') where.unreadAdmin = { gt: 0 };

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        include: { user: { select: { nickname: true, avatar: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.chatSession.count({ where }),
    ]);

    res.json({ code: 0, data: { sessions, total, page, pageSize } });
  });

  // GET /api/admin/chat/sessions/:id  session + all messages + user info
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { nickname: true, avatar: true, email: true } } },
    });
    if (!session) return res.json({ code: 1, message: '会话不存在' });

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });

    // Mark all user messages as read by admin (this session is now being handled).
    await prisma.chatMessage.updateMany({
      where: { sessionId: session.id, role: 'user', readByAdmin: false },
      data: { readByAdmin: true },
    });
    await prisma.chatSession.update({ where: { id: session.id }, data: { unreadAdmin: 0 } });

    res.json({ code: 0, data: { session, messages, user: session.user } });
  });

  // POST /api/admin/chat/sessions/:id/messages  body { content }
  router.post('/sessions/:id/messages', async (req: AdminAuthRequest, res: Response) => {
    const session = await prisma.chatSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.json({ code: 1, message: '会话不存在' });
    if (session.status === 'closed') return res.json({ code: 1, message: '会话已结束' });

    const content = String((req.body || {}).content || '').trim();
    if (!content) return res.json({ code: 1, message: '请输入回复内容' });

    const msg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'admin',
        content,
        adminId: req.admin!.id,
        adminName: req.admin!.username,
        readByUser: false,
      },
    });

    // Admin replying implies the session is being handled by a human.
    const status = session.status === 'ai' ? 'human' : session.status;
    const updated = await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        status,
        needHuman: status === 'human' ? true : session.needHuman,
        unreadUser: { increment: 1 },
        lastSender: 'admin',
        lastMessage: content.slice(0, 200),
      },
    });

    res.json({ code: 0, data: { session: updated, messages: [msg] } });
  });

  // POST /api/admin/chat/sessions/:id/close
  router.post('/sessions/:id/close', async (req: Request, res: Response) => {
    const session = await prisma.chatSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.json({ code: 1, message: '会话不存在' });

    const updated = await prisma.chatSession.update({
      where: { id: session.id },
      data: { status: 'closed', closedAt: new Date() },
    });
    res.json({ code: 0, data: { session: updated } });
  });

  return router;
};