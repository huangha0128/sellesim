import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateAiReply, AiReply } from '../services/ai';
import { matchKb } from '../services/knowledge';
import { queryOrders, queryData } from '../services/aiTools';
import { broadcastToSession } from '../services/chatHub';

// User-facing AI + human customer support chat.
// Mounted at /api/chat. All endpoints require miniapp user auth and are scoped by userId.

export default (prisma: PrismaClient) => {
  const router = Router();

  // 会话空闲上限：超过该时长无新对话则归档旧会话并开启新会话（后台保留存档）。
  const SESSION_IDLE_MS = 30 * 60 * 1000;

  // Local tool intent detection for the quick actions (reliable, no LLM needed).
  function detectToolIntent(text: string): 'order' | 'data' | 'install' | 'faq' | null {
    const c = (text || '').toLowerCase();
    const has = (...kws: string[]) => kws.some((k) => c.includes(k.toLowerCase()));
    if (has('我的订单', '订单状态', '订单情况', '查订单', '看看我的订单')) return 'order';
    if (has('剩余流量', '流量还有', '还剩多少', '流量还剩', '用多少', '用量', '余量', '查询流量')) return 'data';
    if (has('安装步骤', '如何安装', '怎么安装', '怎么装', '激活码', '如何激活', '步骤')) return 'install';
    if (has('常见问题', '有什么功能', '你能做什么', 'faq')) return 'faq';
    return null;
  }

  /** Build a fully-local AI reply from a KB match (no LLM dependency). */
  function localKbReply(kbText: string, category: string, query: string): AiReply {
    return {
      reply: kbText,
      needHuman: false,
      category,
      requestDump: JSON.stringify({ type: 'kb', query }),
      responseDump: kbText,
    };
  }

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

  // POST /api/chat/sessions  create (or reuse the recent open one)
  router.post('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
    const existing = await prisma.chatSession.findFirst({
      where: { userId: req.userId, status: { not: 'closed' } },
      orderBy: { updatedAt: 'desc' },
    });

    // 空闲超过 30min 的旧会话：归档（closed）并新建会话，避免把隔了很旧的对话捞回来。
    if (existing && isIdle(existing)) {
      await prisma.chatSession.update({
        where: { id: existing.id },
        data: { status: 'closed', closedAt: new Date(), lastSender: 'system', lastMessage: '会话超时已归档' },
      });
      broadcastToSession(existing.id, { type: 'status', session: { id: existing.id, status: 'closed' } });
    }
    if (existing && !isIdle(existing)) return res.json({ code: 0, data: { session: existing } });

    const session = await prisma.chatSession.create({ data: { userId: req.userId as string } });
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
      session = await prisma.chatSession.create({ data: { userId: req.userId as string } });
      rotated = true;
    }

    const content = String((req.body || {}).content || '').trim();
    if (!content) return res.json({ code: 1, message: '请输入内容' });
    if (session.status === 'closed') return res.json({ code: 1, message: '会话已结束' });

    // Persist the user message.
    const userMsg = await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'user', content, readByAdmin: false },
    });

    let aiMsg: any = null;
    let sysMsg: any = null;

    if (session.status === 'ai') {
      let result: AiReply;
      const intent = detectToolIntent(content);

      if (intent === 'order' || intent === 'data') {
        // 本地工具：查真实订单/流量数据，稳定不依赖大模型。
        const tool = intent === 'order' ? await queryOrders(prisma, req.userId) : await queryData(prisma, req.userId);
        result = {
          reply: tool.reply,
          needHuman: tool.reply.includes('转人工') || tool.reply.includes('人工客服'),
          category: tool.category,
          requestDump: JSON.stringify({ type: 'tool', intent, query: content }),
          responseDump: tool.reply,
        };
        console.log(`[ai][tool] intent=${intent} userId=${req.userId}\n[ai][tool] reply=${tool.reply}`);
      } else {
        // 安装步骤 / 常见问题：优先直接采用知识库，命中即本地作答。
        const kbText = await matchKb(prisma, content);
        if (kbText && (intent === 'install' || intent === 'faq')) {
          result = localKbReply(kbText, intent === 'install' ? 'install' : 'other', content);
          console.log(`[ai][tool] kb intent=${intent} userId=${req.userId}`);
        } else {
          // 一般问题：把相关知识库作为落地上下文交给大模型。
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
          result = await generateAiReply(prisma, history, { kbContext: kbText || undefined });
        }
      }

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
    const final = await prisma.chatSession.update({
      where: { id: session.id },
      data: { unreadAdmin: { increment: 1 }, ...lastInfo(sender, content) },
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