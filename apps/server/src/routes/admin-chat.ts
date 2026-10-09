import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { adminAuth, AdminAuthRequest } from '../middleware/adminAuth';
import { broadcastToSession } from '../services/chatHub';
import { storeUpload } from './upload';

// Admin-side customer support endpoints. Mounted at /api/admin/chat, admin auth required.

// Override the profile email shown under a user in the session list with the
// email recorded on that user's most recent order (fallback: profile email),
// so the displayed email reflects what the user actually used at checkout.
async function attachLatestOrderEmail(
  prisma: PrismaClient,
  sessions: Array<{ userId: string | null; user: { email: string } | null | undefined }>
): Promise<void> {
  const userIds = [...new Set(sessions.map((s) => s.userId).filter(Boolean) as string[])];
  if (!userIds.length) return;

  // Newest-first; the first order seen per user is the latest one.
  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, email: true },
  });
  const latestByUser = new Map<string, string>();
  for (const o of orders) {
    if (o.userId && !latestByUser.has(o.userId)) latestByUser.set(o.userId, o.email);
  }

  for (const s of sessions) {
    const email = s.userId ? latestByUser.get(s.userId) : undefined;
    if (email && s.user) s.user.email = email;
  }
}

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
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.chatSession.count({ where }),
    ]);

    await attachLatestOrderEmail(prisma, sessions);
    res.json({ code: 0, data: { sessions, total, page, pageSize } });
  });

  // GET /api/admin/chat/notifications
  // 后台通知中心：待人工处理的会话（转人工事件 + 转人工后用户发来的新消息）。
  // 只统计 status=human 且 unreadAdmin>0 的会话：
  //   - 刚转人工（最后一条为系统「转人工」）→ kind=transfer
  //   - 转人工后用户又发言 → kind=message
  router.get('/notifications', async (_req: Request, res: Response) => {
    const sessions = await prisma.chatSession.findMany({
      where: { status: 'human', unreadAdmin: { gt: 0 } },
      include: { user: { select: { nickname: true, avatar: true, email: true } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });

    await attachLatestOrderEmail(prisma, sessions);
    const items = sessions.map((s) => ({
      sessionId: s.id,
      nickname: s.user?.nickname || '用户',
      email: s.user?.email || '',
      lastMessage: s.lastMessage || '',
      lastSender: s.lastSender || '',
      unreadAdmin: s.unreadAdmin || 0,
      updatedAt: s.updatedAt,
      lastMessageAt: s.lastMessageAt,
      kind: s.lastSender === 'user' ? 'message' : 'transfer',
    }));

    res.json({
      code: 0,
      data: {
        items,
        unreadTotal: items.reduce((n, i) => n + i.unreadAdmin, 0),
        pendingHuman: items.length,
      },
    });
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
    const imagesBody = (req.body || {}).images;
    const images = Array.isArray(imagesBody) ? imagesBody.filter((x) => typeof x === 'string') : [];
    if (!content && !images.length) return res.json({ code: 1, message: '请输入回复内容或选择图片' });

    const msg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'admin',
        content,
        images: images.length ? JSON.stringify(images) : null,
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
        lastMessage: (content || '[图片]').slice(0, 200),
        lastMessageAt: msg.createdAt,
      },
    });

    // 实时推送给用户端（以及订阅该会话的其它后台连接）
    broadcastToSession(session.id, { type: 'messages', session: updated, messages: [msg] });

    res.json({ code: 0, data: { session: updated, messages: [msg] } });
  });

  // POST /api/admin/chat/close
  router.post('/sessions/:id/close', async (req: Request, res: Response) => {
    const session = await prisma.chatSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.json({ code: 1, message: '会话不存在' });

    const updated = await prisma.chatSession.update({
      where: { id: session.id },
      data: { status: 'closed', closedAt: new Date() },
    });

    broadcastToSession(session.id, { type: 'status', session: updated });
    res.json({ code: 0, data: { session: updated } });
  });

  // 客服端图片上传：POST /api/admin/chat/upload/image（form-data 字段名 file），
  // 复用 /api/uploads/image 的存储与校验，仅鉴权换成 admin 登录态。
  const adminImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
      cb(new Error('仅支持 JPG / PNG / WEBP 图片'));
    },
  });
  router.post('/upload/image', (req: Request, res: Response) => {
    adminImageUpload.single('file')(req, res, async (err: any) => {
      if (err) {
        const msg =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? '图片不能超过 5MB'
            : err.message || '图片上传失败';
        // multer 中途终止后请求体尚未读完，直接响应会让上游代理因连接重置拿到 502；
        // 先排空剩余请求体再返回业务错误，客户端才能看到具体提示。
        const finish = () => res.json({ code: 1, message: msg });
        if (req.readableEnded) return finish();
        req.resume();
        req.on('end', finish);
        return;
      }
      const file = (req as any).file;
      if (!file) return res.json({ code: 1, message: '请选择要上传的图片' });
      try {
        const { url } = await storeUpload(prisma, file);
        res.json({ code: 0, data: { url } });
      } catch (e: any) {
        console.error('[admin-chat] 图片上传失败：', e.message);
        res.json({ code: 1, message: '图片上传失败，请稍后重试' });
      }
    });
  });

  return router;
};