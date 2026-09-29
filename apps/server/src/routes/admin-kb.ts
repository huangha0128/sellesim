import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from '../middleware/adminAuth';
import { syncKbEntryVector, deleteKbEntryVector } from '../services/vector';

// Admin AI knowledge base management. Mounted at /api/admin/kb, admin auth required.
// Used by the admin "知识库管理" page to list / create / update / toggle / delete entries.

const CATEGORIES = ['install', 'refund', 'connection', 'plan', 'order', 'other'];

export default (prisma: PrismaClient) => {
  const router = Router();
  router.use(adminAuth(prisma));

  // GET /api/admin/kb?keyword=&category=&enabled=&page=&pageSize=
  router.get('/', async (req: Request, res: Response) => {
    const { keyword, category, enabled, page: pageRaw, pageSize: sizeRaw } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(sizeRaw || '50', 10) || 50));

    const where: any = {};
    if (keyword) where.question = { contains: String(keyword) };
    if (category && CATEGORIES.includes(category)) where.category = category;
    if (enabled === 'true' || enabled === 'false') where.enabled = enabled === 'true';

    const [list, total] = await Promise.all([
      prisma.kbEntry.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.kbEntry.count({ where }),
    ]);

    res.json({ code: 0, data: { list, total, page, pageSize, categories: CATEGORIES } });
  });

  // POST /api/admin/kb  body { category, question, answer, enabled?, sortOrder? }
  router.post('/', async (req: Request, res: Response) => {
    const { category, question, answer, enabled, sortOrder } = req.body || {};
    const cat = String(category || 'other');
    const q = String(question || '').trim();
    const a = String(answer || '').trim();
    if (!CATEGORIES.includes(cat)) return res.json({ code: 1, message: '无效的分类' });
    if (!q) return res.json({ code: 1, message: '请输入问题' });
    if (!a) return res.json({ code: 1, message: '请输入答案' });

    const entry = await prisma.kbEntry.create({
      data: {
        category: cat,
        question: q,
        answer: a,
        enabled: typeof enabled === 'boolean' ? enabled : true,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
    });
    await syncKbEntryVector(prisma, entry); // vectorize the new entry for RAG
    res.json({ code: 0, data: { entry } });
  });

  // PUT /api/admin/kb/:id
  router.put('/:id', async (req: Request, res: Response) => {
    const { category, question, answer, enabled, sortOrder } = req.body || {};
    const data: any = {};
    if (category !== undefined) {
      if (!CATEGORIES.includes(String(category))) return res.json({ code: 1, message: '无效的分类' });
      data.category = category;
    }
    if (question !== undefined) {
      const q = String(question).trim();
      if (!q) return res.json({ code: 1, message: '问题不能为空' });
      data.question = q;
    }
    if (answer !== undefined) {
      const a = String(answer).trim();
      if (!a) return res.json({ code: 1, message: '答案不能为空' });
      data.answer = a;
    }
    if (enabled !== undefined) data.enabled = !!enabled;
    if (sortOrder !== undefined) data.sortOrder = Math.trunc(Number(sortOrder) || 0);

    const exists = await prisma.kbEntry.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.json({ code: 1, message: '词条不存在' });

    const entry = await prisma.kbEntry.update({ where: { id: req.params.id }, data });
    await syncKbEntryVector(prisma, entry); // re-embed after update
    res.json({ code: 0, data: { entry } });
  });

  // DELETE /api/admin/kb/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    const exists = await prisma.kbEntry.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.json({ code: 1, message: '词条不存在' });
    await prisma.kbEntry.delete({ where: { id: req.params.id } });
    await deleteKbEntryVector(prisma, req.params.id); // remove its vectors
    res.json({ code: 0, message: '已删除' });
  });

  return router;
};