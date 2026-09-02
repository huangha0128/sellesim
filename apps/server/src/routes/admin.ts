import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient, iccidPoolCount, getIccidPool } from '../tiger';
import { syncAllFromTiger, syncRegionsFromTiger, syncPackagesFromTiger } from '../tiger/sync';
import { refundOrder, rejectRefundRequest } from '../services/refund';
import { sendRefundEmail } from '../services/email';
import { alipay } from '../utils/alipay';

/** 从 Tiger 创建套餐的响应中抽取创建结果（兼容 {data:{...}} / 直接对象 / 嵌套 package/item） */
function extractTigerCreated(res: any): any {
  if (!res || typeof res !== 'object') return null;
  let box: any = res;
  if (box.data && typeof box.data === 'object' && !Array.isArray(box.data)) {
    box = box.data;
  }
  if (!box || typeof box !== 'object') return null;
  return box.package || box.item || box.system || (box.id !== undefined || box.pid !== undefined ? box : null);
}

export default (prisma: PrismaClient) => {
  const router = Router();

  router.get('/dashboard', async (req: Request, res: Response) => {
    const [countryCount, orderCount, esimCount] = await Promise.all([
      prisma.country.count(),
      prisma.order.count(),
      prisma.esim.count(),
    ]);
    let packageCount = 0;
    if (tigerClient.configured) {
      try {
        const { listAllPackagesView } = await import('../tiger/view');
        packageCount = (await listAllPackagesView()).length;
      } catch {
        packageCount = 0;
      }
    }
    const paidOrders = await prisma.order.count({ where: { status: 'paid' } });
    const totalRevenue = await prisma.order.aggregate({
      where: { status: 'paid' },
      _sum: { price: true },
    });
    res.json({
      code: 0,
      data: {
        stats: {
          countryCount,
          packageCount,
          orderCount,
          esimCount,
          paidOrders,
          totalRevenue: totalRevenue._sum.price || 0,
        },
      },
    });
  });

  router.get('/orders', async (req: Request, res: Response) => {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    res.json({ code: 0, data: { orders } });
  });

  /**
   * POST /api/admin/orders/:orderNo/refund 同意退款申请并执行退款
   * - 仅当存在用户已提交的退款申请（refundStatus=requested）时生效
   * - 调用支付宝退款（alipay.trade.refund，out_request_no 保证幂等）
   * - 退款成功后订单置为 refunded（refundStatus=approved），删除 eSIM 记录（ICCID 归还卡片池）
   * - 向用户邮箱发送退款成功通知
   */
  router.post('/orders/:orderNo/refund', async (req: Request, res: Response) => {
    const { reason } = req.body || {};
    try {
      const result = await refundOrder(
        {
          findOrder: (orderNo) => prisma.order.findUnique({ where: { orderNo } }),
          findUserOrder: (userId, orderNo) =>
            prisma.order.findFirst({ where: { orderNo, userId } }),
          updateOrder: (orderNo, data) => prisma.order.update({ where: { orderNo }, data }),
          findEsimByOrderId: (orderId) => prisma.esim.findUnique({ where: { orderId } }),
          deleteEsimByOrderId: async (orderId) => {
            await prisma.esim.delete({ where: { orderId } });
          },
          alipayRefund: async (params) => {
            // 只要订单有 alipayTradeNo，说明是真实支付宝支付过的，必须调用支付宝真实退款接口
            // outTradeNo 已经由 refundOrder 确保为商户单号 order.orderNo，直接使用即可
            const order = await prisma.order.findUnique({ where: { orderNo: req.params.orderNo } });
            if (!order?.alipayTradeNo) {
              return { code: '10000', tradeNo: `RF${Date.now()}` };
            }
            return alipay.refund(params.outTradeNo, params.refundAmount, params.outRequestNo, params.refundReason);
          },
        },
        req.params.orderNo,
        reason,
      );

      // 退款成功后向用户邮箱发送退款通知（发送失败不影响退款结果）
      const order = result?.order || (await prisma.order.findUnique({ where: { orderNo: req.params.orderNo } }));
      if (order?.email) {
        sendRefundEmail({
          to: order.email,
          orderNo: order.orderNo,
          amount: Number(order.price).toFixed(2),
        }).catch((e) => console.error(`[email] 订单 ${order.orderNo} 退款通知发送失败：`, e.message));
      }

      res.json({ code: 0, data: result });
    } catch (e: any) {
      console.error(`[refund] 订单 ${req.params.orderNo} 退款失败：`, e.message);
      res.json({ code: 1, message: e.message });
    }
  });

  /**
   * POST /api/admin/orders/:orderNo/refund/reject 拒绝退款申请
   * - 仅待审批（refundStatus=requested）的申请可拒绝
   * - 必填拒绝理由存入 refundRejectReason，用户端展示拒绝状态与理由
   */
  router.post('/orders/:orderNo/refund/reject', async (req: Request, res: Response) => {
    const { reason } = req.body || {};
    try {
      const result = await rejectRefundRequest(
        {
          findOrder: (orderNo) => prisma.order.findUnique({ where: { orderNo } }),
          findUserOrder: (userId, orderNo) =>
            prisma.order.findFirst({ where: { orderNo, userId } }),
          updateOrder: (orderNo, data) => prisma.order.update({ where: { orderNo }, data }),
          findEsimByOrderId: (orderId) => prisma.esim.findUnique({ where: { orderId } }),
          deleteEsimByOrderId: async (orderId) => {
            await prisma.esim.delete({ where: { orderId } });
          },
          alipayRefund: async () => ({ code: '10000' }),
        },
        req.params.orderNo,
        typeof reason === 'string' ? reason : '',
      );
      res.json({ code: 0, data: result });
    } catch (e: any) {
      console.error(`[refund] 订单 ${req.params.orderNo} 拒绝退款失败：`, e.message);
      res.json({ code: 1, message: e.message });
    }
  });

  router.get('/esims', async (req: Request, res: Response) => {
    const esims = await prisma.esim.findMany({
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });
    res.json({ code: 0, data: { esims } });
  });

  router.get('/countries', async (req: Request, res: Response) => {
    const keyword = String(req.query.keyword || '').trim();
    const countries = await prisma.country.findMany({
      where: keyword
        ? {
            OR: [
              { code: { contains: keyword } },
              { name: { contains: keyword } },
              { en: { contains: keyword } },
            ],
          }
        : undefined,
      orderBy: [{ hot: 'desc' }, { code: 'asc' }],
    });
    let pkgCountMap = new Map<string, number>();
    if (tigerClient.configured) {
      try {
        const { listAllPackagesView } = await import('../tiger/view');
        for (const p of await listAllPackagesView()) {
          pkgCountMap.set(p.countryCode, (pkgCountMap.get(p.countryCode) || 0) + 1);
        }
      } catch {
        /* 忽略实时套餐拉取失败，packageCount 保持 0 */
      }
    }
    const countriesWithCount = countries.map((c: any) => ({
      ...c,
      packageCount: pkgCountMap.get(c.code) || 0,
    }));
    res.json({ code: 0, data: { countries: countriesWithCount } });
  });

  router.post('/countries', async (req: Request, res: Response) => {
    const country = await prisma.country.create({ data: req.body });
    res.json({ code: 0, data: { country } });
  });

  router.put('/countries/:code', async (req: Request, res: Response) => {
    const country = await prisma.country.update({
      where: { code: req.params.code },
      data: req.body,
    });
    res.json({ code: 0, data: { country } });
  });

  router.delete('/countries/:code', async (req: Request, res: Response) => {
    await prisma.country.delete({ where: { code: req.params.code } });
    res.json({ code: 0, data: {} });
  });

  router.get('/packages/page', async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const countryCode = String(req.query.countryCode || '').trim();
    const onlyFeatured = req.query.featured === '1' || req.query.featured === 'true';

    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，套餐数据实时来自 TigerESIM，请先配置密钥' });
    }
    let list: any[];
    try {
      const { listAllPackagesView } = await import('../tiger/view');
      // refresh=1 时强制绕过 60s 缓存，从 Tiger 重新拉取
      list = await listAllPackagesView(req.query.refresh === '1');
    } catch (e: any) {
      return res.status(502).json({ code: 1, message: 'Tiger 套餐拉取失败：' + e.message });
    }
    if (countryCode) list = list.filter((p) => p.countryCode === countryCode);
    if (onlyFeatured) list = list.filter((p) => p.isFeatured);
    if (keyword) {
      list = list.filter((p) =>
        [p.name, p.countryCode, p.coverage, p.desc, String(p.gb) + 'GB', String(p.days)].some((v) =>
          String(v || '').toLowerCase().includes(keyword),
        ),
      );
    }
    list.sort((a, b) => String(a.countryCode).localeCompare(b.countryCode) || a.gb - b.gb || a.days - b.days);
    const total = list.length;
    const packages = list.slice((page - 1) * pageSize, page * pageSize);
    res.json({ code: 0, data: { packages, total, page, pageSize } });
  });

  // ===== 套餐新增/修改/删除（数据以 TigerESIM 为准，本地不存储套餐）=====

  router.post('/packages', async (req: Request, res: Response) => {
    try {
      if (!tigerClient.configured) {
        return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，新增套餐需直调 TigerESIM API，请先配置密钥' });
      }
      const data = req.body || {};
      let regionId = Number(data.region_id || 0);
      if (!regionId && data.countryCode) {
        const country = await prisma.country.findUnique({ where: { code: String(data.countryCode).toUpperCase() } });
        regionId = Number(country?.tigerRegionId || 0);
      }
      if (!regionId) {
        return res.json({ code: 1, message: '缺少 region_id，请选择所属国家/区域（TigerESIM 使用 region_id）' });
      }
      const amount = Math.round(Number(data.amount ?? data.gb ?? 0) * (data.amount ? 1 : 1024));
      const validDays = Number(data.valid_days ?? data.days ?? 1);
      const sales = Number(data.sales ?? data.price ?? 0);
      const tigerRes: any = await tigerClient.createPackage({
        name: data.name || `Region ${regionId} ${amount / 1024}GB/${validDays}天`,
        amount,
        valid_days: validDays,
        region_id: regionId,
        sales,
        package_type: data.package_type || 'data',
      });
      const created = extractTigerCreated(tigerRes);
      const tigerPkgId = Number(created?.id ?? created?.pid ?? 0);
      if (!tigerPkgId) {
        return res.json({ code: 2, message: `Tiger 创建套餐未返回有效 id/pid：${JSON.stringify(tigerRes).slice(0, 500)}` });
      }
      // 创建成功即失效套餐缓存，确保后续列表/下单拉到新套餐
      (await import('../tiger/view')).invalidatePackageCache();
      res.json({
        code: 0,
        data: {
          created,
          tigerPkgId,
          tigerPid: String(created?.pid || ''),
          message: '已通过 TigerESIM 创建真实套餐',
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/403|FORBIDDEN|not allowed|STATUS_403/.test(msg)) {
        return res.status(200).json({
          code: 403,
          message:
            '当前 TigerESIM 账号没有通过 API 创建套餐的权限（403：Your account is not allowed）。' +
            '请登录 TigerESIM 后台手动创建套餐；创建成功后套餐会实时出现在本列表/小程序中，无需在后台重复添加。',
        });
      }
      return res.status(400).json({ code: 1, message: `新增套餐失败：${msg}` });
    }
  });

  router.put('/packages/:id', async (req: Request, res: Response) => {
    res.json({
      code: 1,
      message: 'TigerESIM 未提供修改套餐接口，套餐数据以 TigerESIM 后台为准，请到 TigerESIM 后台修改后刷新',
    });
  });

  router.delete('/packages/:id', async (req: Request, res: Response) => {
    res.json({
      code: 1,
      message: 'TigerESIM 未提供删除套餐接口，套餐数据以 TigerESIM 后台为准，请到 TigerESIM 后台删除',
    });
  });

  // ===== Tiger 接入相关 =====

  /** GET /api/admin/tiger/status 查看 Tiger 接入状态 */
  router.get('/tiger/status', async (_req: Request, res: Response) => {
    const [countryCount, poolCount] = await Promise.all([
      prisma.country.count(),
      iccidPoolCount(prisma),
    ]);
    let packageCount = 0;
    if (tigerClient.configured) {
      try {
        const { listAllPackagesView } = await import('../tiger/view');
        packageCount = (await listAllPackagesView()).length;
      } catch {
        packageCount = 0;
      }
    }
    res.json({
      code: 0,
      data: {
        configured: tigerClient.configured,
        baseUrl: tigerClient.baseUrl,
        iccidPoolSize: poolCount,
        mode: tigerClient.configured ? 'tiger' : 'mock',
        countryCount,
        packageCount,
        synced: packageCount > 0,
      },
    });
  });

  // ===== 卡片（ICCID）池管理 =====

  /** GET /api/admin/cards 卡片列表与统计（已使用状态按 esim 表判断） */
  router.get('/cards', async (_req: Request, res: Response) => {
    const [cards, esims, envCards] = await Promise.all([
      prisma.card.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.esim.findMany({ select: { iccid: true } }),
      getIccidPool(prisma),
    ]);
    const usedSet = new Set(esims.map((e) => e.iccid));
    const list = cards.map((c) => ({ ...c, used: usedSet.has(c.iccid) }));
    const used = list.filter((c) => c.used).length;
    const available = list.length - used;
    res.json({
      code: 0,
      data: {
        cards: list,
        stats: {
          total: list.length,
          available,
          used,
          envOnly: Math.max(0, envCards.length - list.length),
        },
      },
    });
  });

  /** POST /api/admin/cards 批量新增卡片（跳过已存在的 ICCID，新增即时生效） */
  router.post('/cards', async (req: Request, res: Response) => {
    const { iccids, remark } = req.body || {};
    const list: string[] = (Array.isArray(iccids) ? iccids : []).map((s) => String(s).trim()).filter(Boolean);
    if (list.length === 0) {
      return res.json({ code: 1, message: '请至少提供一个 ICCID' });
    }
    const existing = new Set(
      (await prisma.card.findMany({ select: { iccid: true } })).map((c) => c.iccid),
    );
    const toAdd = Array.from(new Set(list)).filter((i) => !existing.has(i));
    for (const iccid of toAdd) {
      await prisma.card.create({ data: { iccid, remark: remark || '' } });
    }
    res.json({
      code: 0,
      data: { added: toAdd.length, skipped: list.length - toAdd.length },
    });
  });

  /** DELETE /api/admin/cards/:iccid 删除卡片（已使用的卡片删除后其 ICCID 不再参与取卡） */
  router.delete('/cards/:iccid', async (req: Request, res: Response) => {
    const iccid = String(req.params.iccid || '');
    const card = await prisma.card.findUnique({ where: { iccid } });
    if (!card) {
      return res.json({ code: 1, message: '卡片不存在' });
    }
    const used = await prisma.esim.findFirst({ where: { iccid }, select: { id: true } });
    await prisma.card.delete({ where: { iccid } });
    res.json({ code: 0, data: { deleted: iccid, wasUsed: Boolean(used) } });
  });

  /** POST /api/admin/tiger/sync-all 全量同步所有数据 */
  router.post('/tiger/sync-all', async (_req: Request, res: Response) => {
    try {
      const result = await syncAllFromTiger(prisma);
      (await import('../tiger/view')).invalidatePackageCache();
      res.json({ code: 0, data: result });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
    }
  });

  /** POST /api/admin/tiger/sync-regions 同步国家/地区 */
  router.post('/tiger/sync-regions', async (_req: Request, res: Response) => {
    try {
      const result = await syncRegionsFromTiger(prisma);
      res.json({ code: 0, data: result });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
    }
  });

  /** POST /api/admin/tiger/sync-packages 从 Tiger 实时拉取套餐统计（套餐内容不落本地库） */
  router.post('/tiger/sync-packages', async (_req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET' });
    }
    try {
      const packages = await tigerClient.listAllPackages({ category: 'esim', package_type: 'data', is_active: true });
      const unique = new Map<string, any>();
      for (const p of packages) {
        const rc = String((p.region || p)?.code || (p.region || p)?.name_en || '');
        unique.set(rc + ':' + (p.id || p.pid), p);
      }
      (await import('../tiger/view')).invalidatePackageCache();
      res.json({ code: 0, data: { tigerTotal: unique.size, items: Array.from(unique.values()) } });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
    }
  });

  return router;
};
