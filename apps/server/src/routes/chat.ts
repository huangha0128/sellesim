import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateAiReply } from '../services/ai';
import { broadcastToSession } from '../services/chatHub';
import { SESSION_IDLE_MS } from '../services/sessionSweeper';

// ---------------------------------------------------------------------------
// Image attachments for chat messages.
// URLs are stored relative (/api/uploads/{id}); the Upload table in MySQL holds
// the bytes, so any backend instance can read them. For the AI turn the image
// bytes are embedded as base64 data URLs so a vision-capable model can read it.
// ---------------------------------------------------------------------------

// Parse the stored JSON array of image URLs (empty array when unset/invalid).
function parseImages(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Convert /api/uploads/{id} URLs into base64 data URLs for AI vision input.
async function toImageDataUrls(prisma: PrismaClient, urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls || []) {
    const m = /\/api\/uploads\/([^/?#]+)/.exec(u || '');
    if (!m) continue;
    const row = await prisma.upload.findUnique({ where: { id: decodeURIComponent(m[1]) } });
    if (row) out.push(`data:${row.mime};base64,${Buffer.from(row.data).toString('base64')}`);
  }
  return out;
}

// User-facing AI + human customer support chat.
// Mounted at /api/chat. All endpoints require miniapp user auth and are scoped by userId.

export default (prisma: PrismaClient) => {
  const router = Router();

  function isIdle(session: { updatedAt: Date }): boolean {
    return Date.now() - new Date(session.updatedAt).getTime() > SESSION_IDLE_MS;
  }

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

  // 联系邮箱快照：取该用户当前最新一笔订单的邮箱，无订单则回退注册邮箱。
  // 仅在会话创建时写入一次，后台显示的邮箱以此快照为准。
  async function snapshotContactEmail(userId: string): Promise<string | null> {
    const order = await prisma.order.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { email: true },
    });
    if (order?.email) return order.email;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email || null;
  }

  // POST /api/chat/sessions  create (or reuse the recent open one)
  router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
    const existing = await prisma.chatSession.findFirst({
      where: { userId: req.userId, status: { not: 'closed' } },
      orderBy: { updatedAt: 'desc' },
    });

    // 空闲超过 24h 的旧会话：归档（closed）并新建会话，避免把隔了很旧的对话捞回来。
    if (existing && isIdle(existing)) {
      await prisma.chatSession.update({
        where: { id: existing.id },
        data: { status: 'closed', closedAt: new Date(), lastSender: 'system', lastMessage: '会话超时已归档' },
      });
      broadcastToSession(existing.id, { type: 'status', session: { id: existing.id, status: 'closed' } });
    }
    if (existing && !isIdle(existing)) return res.json({ code: 0, data: { session: existing } });

    const contactEmail = await snapshotContactEmail(req.userId as string);
    const session = await prisma.chatSession.create({ data: { userId: req.userId as string, contactEmail } });
    res.json({ code: 0, data: { session } });
  });

  // GET /api/chat/sessions/:id  session + recent messages
  router.get('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' }, // 先取最新 50 条再反转为升序，避免顶掉/刷回旧消息
      take: 50,
    });
    messages.reverse();
    res.json({ code: 0, data: { session, messages } });
  });

  // POST /api/chat/sessions/:id/messages  body { content }
  router.post('/sessions/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
    let session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    // 旧会话空闲超时：归档并自动开启新会话，本次消息写入新会话（客户端据 rotated=true 切换）。
    let rotated = false;
    if (isIdle(session)) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { status: 'closed', closedAt: new Date(), lastSender: 'system', lastMessage: '会话超时已归档' },
      });
      broadcastToSession(session.id, { type: 'status', session: { id: session.id, status: 'closed' } });
      session = await prisma.chatSession.create({
        data: { userId: req.userId as string, contactEmail: await snapshotContactEmail(req.userId as string) },
      });
      rotated = true;
    }

    const content = String((req.body || {}).content || '').trim();
    const imagesBody = (req.body || {}).images;
    const images = Array.isArray(imagesBody) ? imagesBody.filter((x) => typeof x === 'string') : [];
    if (!content && !images.length) return res.json({ code: 1, message: '请输入内容或选择图片' });
    if (session.status === 'closed') return res.json({ code: 1, message: '会话已结束' });

    // Persist the user message.
    const userMsg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content,
        images: images.length ? JSON.stringify(images) : null,
        readByAdmin: false,
      },
    });

    let aiMsg: any = null;
    let sysMsg: any = null;

    if (session.status === 'ai') {
      // AI 阶段：交由 LLM 决定是否调用工具（get_orders / get_data_usage / search_faq）
      // 获取真实订单/流量/知识库数据，再汇总为最终回答。不再做服务器端关键词意图识别。
      const recent = await prisma.chatMessage.findMany({
        where: { sessionId: session.id, role: { in: ['user', 'ai'] } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });
      const history: { role: 'user' | 'assistant'; content: string; images?: string[] }[] = [];
      for (const m of recent.slice().reverse()) {
        const role = m.role === 'ai' ? ('assistant' as const) : ('user' as const);
        const item: { role: 'user' | 'assistant'; content: string; images?: string[] } = {
          role,
          content: m.content,
        };
        // 用户消息若带图，则取回图片字节作为 base64 数据 URL，供视觉模型识别截图内容
        if (role === 'user') {
          const urls = parseImages(m.images);
          if (urls.length) item.images = await toImageDataUrls(prisma, urls);
        }
        history.push(item);
      }
      const result = await generateAiReply(prisma, history as any, { userId: req.userId });
      console.log(`[ai] userId=${req.userId} needHuman=${result.needHuman} category=${result.category}`);

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
        sysMsg = await prisma.chatMessage.create({
          data: { sessionId: session.id, role: 'system', content: '已为您转接人工客服，请稍候。' },
        });
      }
    }

    const sender = session.status === 'ai' && !aiMsg?.needHuman ? 'ai' : 'user';
    const lastMsgTime = (aiMsg?.createdAt as Date | undefined) ?? (userMsg.createdAt as Date);
    const final = await prisma.chatSession.update({
      where: { id: session.id },
      data: { unreadAdmin: { increment: 1 }, ...lastInfo(sender, content || '[图片]'), lastMessageAt: lastMsgTime },
    });

    // 实时推送：新消息 + 最新会话状态（客户端按 id 去重，避免重连/并发导致的重复渲染）
    const newMessages = [userMsg, ...(aiMsg ? [aiMsg] : []), ...(sysMsg ? [sysMsg] : [])];
    broadcastToSession(session.id, { type: 'messages', session: final, messages: newMessages, rotated });

    res.json({ code: 0, data: { session: final, messages: newMessages, rotated } });
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
    const sysMsg = await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'system', content: '已为您转接人工客服，请稍候。' },
    });

    const updated = await prisma.chatSession.findUnique({ where: { id: session.id } });
    broadcastToSession(session.id, { type: 'messages', session: updated, messages: [sysMsg] });
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
    broadcastToSession(session.id, { type: 'status', session: updated });
    res.json({ code: 0, data: { session: updated } });
  });

  // GET /api/chat/sessions/:id/messages?since=<ms>  polling (time cursor)
  // since 为客户端已收到消息的最新 createdAt 毫秒时间戳；chatMessage.id 是随机 UUID，不能按 id 增量。
  // since 为空时返回最近若干条（desc+reverse 保持升序），供冷启动全量合并。
  router.get('/sessions/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
    const session = await ownedSession(req.userId, req.params.id, res);
    if (!session) return;

    const since = Number(req.query.since || '');
    const messages = since > 0
      ? await prisma.chatMessage.findMany({
          where: { sessionId: session.id, createdAt: { gt: new Date(since) } },
          orderBy: { createdAt: 'asc' },
        })
      : await prisma.chatMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }).then((rows) => rows.reverse());

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