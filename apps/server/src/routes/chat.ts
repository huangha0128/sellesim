import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateAiReply } from '../services/ai';

// User-facing AI + human customer support chat.
// Mounted at /api/chat. All endpoints require miniapp user auth and are scoped by userId.

export default (prisma: PrismaClient) => {
  const router = Router();

  // Helper: load a session owned by the current user, else 404.
  async function ownedSession(userId: string | undefined, id: string, res: Response) {
    if (!id) return null;
    const session = await prisma.chatSession.findFirst({ where: { id, userId } });
    if (!session) {
      res.json({ code: 1, message: '会话不存在' });
      return null;
    }
    return session;
  }

  // Helpers to update the session quick fields.
  function lastInfo(sender: string, content: string) {
    return { lastSender: sender, lastMessage: content.slice(0, 200) };
  }

  // POST /api/chat/sessions  create (or reuse the open one)
  router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
    const existing = await prisma.chatSession.findFirst({
      where: { userId: req.userId, status: { not: 'closed' } },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return res.json({ code: 0, data: { session: existing } });

    const session = await prisma.chatSession.create({ data: { userId: req.userId as string } });
    res.json({ code: 0, data: { session } });
  });

  // GET /api/chat/sessions/:id  session + recent messages
  router.get('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json({ code: 0, data: { session, messages } });
  });

  // POST /api/chat/sessions/:id/messages  body { content }
  router.post('/sessions/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    const content = String((req.body || {}).content || '').trim();
    if (!content) return res.json({ code: 1, message: '请输入内容' });
    if (session.status === 'closed') return res.json({ code: 1, message: '会话已结束' });

    // Persist the user message.
    const userMsg = await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'user', content, readByAdmin: false },
    });

    let aiMsg: any = null;

    if (session.status === 'ai') {
      // Gather recent conversation (ignore system/admin bubbles for the LLM).
      const recent = await prisma.chatMessage.findMany({
        where: { sessionId: session.id, role: { in: ['user', 'ai'] } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });
      const history: { role: 'user' | 'assistant'; content: string }[] = recent
        .slice()
        .reverse()
        .map((m) => ({
          role: m.role === 'ai' ? ('assistant' as const) : ('user' as const),
          content: m.content,
        }));

      const result = await generateAiReply(prisma, history);

      aiMsg = await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'ai',
          content: result.reply,
          needHuman: result.needHuman,
          category: result.category,
          userContent: content,
          aiRequest: result.requestDump,
          aiResponse: result.responseDump,
        },
      });

      // Auto-escalation when the AI judges human help is needed.
      if (result.needHuman) {
        await prisma.chatSession.update({
          where: { id: session.id },
          data: { status: 'human', needHuman: true },
        });
        await prisma.chatMessage.create({
          data: { sessionId: session.id, role: 'system', content: '已为您转接人工客服，请稍候。' },
        });
      }
    }

    const sender = session.status === 'ai' && !aiMsg?.needHuman ? 'ai' : 'user';
    const final = await prisma.chatSession.update({
      where: { id: session.id },
      data: { unreadAdmin: { increment: 1 }, ...lastInfo(sender, content) },
    });

    res.json({ code: 0, data: { session: final, messages: aiMsg ? [userMsg, aiMsg] : [userMsg] } });
  });

  // POST /api/chat/sessions/:id/transfer  manual request for a human
  router.post('/sessions/:id/transfer', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    if (session.status !== 'ai') {
      return res.json({ code: 0, data: { session: { ...session } } });
    }

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { status: 'human', needHuman: true, unreadAdmin: { increment: 1 }, lastSender: 'system', lastMessage: '转人工' },
    });
    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'system', content: '已为您转接人工客服，请稍候。' },
    });

    const updated = await prisma.chatSession.findUnique({ where: { id: session.id } });
    res.json({ code: 0, data: { session: updated } });
  });

  // POST /api/chat/sessions/:id/close
  router.post('/sessions/:id/close', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    const updated = await prisma.chatSession.update({
      where: { id: session.id },
      data: { status: 'closed', closedAt: new Date() },
    });
    res.json({ code: 0, data: { session: updated } });
  });

  // GET /api/chat/sessions/:id/messages?afterId=<id>  polling
  router.get('/sessions/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id, id: { gt: String(req.query.afterId || '') } },
      orderBy: { createdAt: 'asc' },
    });

    // Mark admin/system messages as read by the user once pulled.
    if (messages.some((m) => m.role === 'admin')) {
      await prisma.chatMessage.updateMany({
        where: { sessionId: session.id, role: 'admin', readByUser: false },
        data: { readByUser: true },
      });
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { unreadUser: 0 },
      });
    }

    res.json({ code: 0, data: { session: { status: session.status }, messages } });
  });

  return router;
};