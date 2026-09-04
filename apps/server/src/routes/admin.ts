import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { tigerClient, iccidPoolCount, getIccidPool } from '../tiger';
import { syncAllFromTiger, syncRegionsFromTiger, syncPackagesFromTiger } from '../tiger/sync';
import { refundOrder, rejectRefundRequest } from '../services/refund';
import { sendRefundEmail } from '../services/email';
import { alipay } from '../utils/alipay';
import { clearWhitelistCache, clearSettingsCache } from '../pricing/priceOverride';

/** 白名单/汇率（添加/移出/改价/停售/设置）变更后的即时生效：清缓存 → 失效套餐缓存 → 同步重拉一次（等待完成） */
async function refreshAfterOverride() {
  clearWhitelistCache();
  clearSettingsCache();
  (await import('../tiger/view')).invalidatePackageCache();
  try {
    const { listAllPackagesView } = await import('../tiger/view');
    await listAllPackagesView(true, { includeOffSale: true, convertDisplayCurrency: false });
  } catch {
    // 失败由后台定时刷新兜底，不影响本次写操作返回
  }
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
      // refresh=1 时强制绕过缓存，从 Tiger 重新拉取；后台需看到停售套餐（includeOffSale）
      // convertDisplayCurrency=false：后台回显存储价格 + 存储货币单位，便于编辑
      list = await listAllPackagesView(req.query.refresh === '1', { includeOffSale: true, convertDisplayCurrency: false });
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

  // ===== 套餐白名单（本地 PackagePrice 表：只有「已添加、有价格」的套餐才在小程序/后台展示）=====

  /**
   * GET /api/admin/packages/catalog 返回 Tiger 全量套餐（未加白名单过滤），每项标注 added。
   * 供后台「添加套餐」从 Tiger 全量中挑选并绑定；已 added 的套餐标注并禁用。
   */
  router.get('/packages/catalog', async (req: Request, res: Response) => {
    if (!tigerClient.configured) {
      return res.json({ code: 1, message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，无法获取 Tiger 套餐目录' });
    }
    try {
      const { fetchAndNormalize } = await import('../tiger/view');
      const keyword = String(req.query.keyword || '').trim().toLowerCase();
      const countryCode = String(req.query.countryCode || '').trim();
      let all = await fetchAndNormalize();
      const addedRows = await prisma.packagePrice.findMany({ where: { price: { not: null } }, select: { tigerPkgId: true } });
      const addedSet = new Set(addedRows.map((r) => r.tigerPkgId));
      if (countryCode) all = all.filter((p) => p.countryCode === countryCode);
      if (keyword) {
        all = all.filter((p) =>
          [p.name, p.countryCode, p.desc, String(p.gb) + 'GB', String(p.days)].some((v) =>
            String(v || '').toLowerCase().includes(keyword),
          ),
        );
      }
      all.sort((a, b) => String(a.countryCode).localeCompare(b.countryCode) || a.gb - b.gb || a.days - b.days);
      res.json({
        code: 0,
        data: { catalog: all.map((p) => ({ ...p, added: addedSet.has(Number(p.tigerPkgId)) })), total: all.length },
      });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐目录拉取失败：' + e.message });
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

  // ===== 套餐白名单维护（本地覆盖：添加即设价格；移出即删除记录；停售 onSale=false）=====

  /**
   * PUT /api/admin/packages/:tigerPkgId/price 添加/改价/上下架某个白名单套餐
   * body: { price?: number | null, onSale?: boolean }
   * - 传具体数字 price → 添加进白名单并设为自定价
   * - price 传 null → 从白名单移出（彻底不再展示）
   * - onSale 传 false → 停售（仍在白名单但前端隐藏）；传 true → 上架
   */
  router.put('/packages/:tigerPkgId/price', async (req: Request, res: Response) => {
    try {
      const tigerPkgId = Number(req.params.tigerPkgId);
      if (!Number.isInteger(tigerPkgId) || tigerPkgId <= 0) {
        return res.json({ code: 1, message: '非法套餐 ID' });
      }
      const { price, onSale, currency } = req.body || {};
      const data: { price?: number | null; onSale?: boolean; currency?: string } = {};
      if (price !== undefined && price !== null && price !== '') {
        const p = Number(price);
        if (!Number.isFinite(p) || p < 0) return res.json({ code: 1, message: '价格必须是大于等于 0 的数字' });
        data.price = p;
      } else if (price !== undefined) {
        data.price = null; // 置空即移出白名单
      }
      if (onSale !== undefined) data.onSale = !!onSale;
      if (currency === 'CNY' || currency === 'USD') data.currency = currency;
      const row = await prisma.packagePrice.upsert({
        where: { tigerPkgId },
        update: data,
        create: { tigerPkgId, ...data },
      });
      await refreshAfterOverride();
      res.json({ code: 0, data: { override: row } });
    } catch (e: any) {
      console.error('[pricing] 设置套餐价格失败：', e.message);
      res.status(400).json({ code: 1, message: '设置失败：' + e.message });
    }
  });

  /** DELETE /api/admin/packages/:tigerPkgId/price 移出白名单（删除本地记录，彻底不再展示） */
  router.delete('/packages/:tigerPkgId/price', async (req: Request, res: Response) => {
    try {
      const tigerPkgId = Number(req.params.tigerPkgId);
      if (!Number.isInteger(tigerPkgId) || tigerPkgId <= 0) {
        return res.json({ code: 1, message: '非法套餐 ID' });
      }
      await prisma.packagePrice.deleteMany({ where: { tigerPkgId } });
      await refreshAfterOverride();
      res.json({ code: 0, data: {} });
    } catch (e: any) {
      console.error('[pricing] 移出白名单失败：', e.message);
      res.status(400).json({ code: 1, message: '操作失败：' + e.message });
    }
  });

  /**
   * POST /api/admin/packages/prices/batch 批量添加/改价/上下架白名单套餐
   * body: { items: [{ tigerPkgId, price?: number | null, onSale?: boolean }] }
   */
  router.post('/packages/prices/batch', async (req: Request, res: Response) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ code: 1, message: 'items 不能为空' });
      }
      await prisma.$transaction(
        items.map((it: any) => {
          const tigerPkgId = Number(it?.tigerPkgId);
          if (!Number.isInteger(tigerPkgId) || tigerPkgId <= 0) {
            throw new Error('存在非法套餐 ID：' + String(it?.tigerPkgId));
          }
          const data: { price?: number | null; onSale?: boolean; currency?: string } = {};
          if (it.price !== undefined && it.price !== null && it.price !== '') {
            const p = Number(it.price);
            if (!Number.isFinite(p) || p < 0) throw new Error(`套餐 ${tigerPkgId} 价格非法：${it.price}`);
            data.price = p;
          } else if (it.price !== undefined) {
            data.price = null;
          }
          if (it.onSale !== undefined) data.onSale = !!it.onSale;
          if (it.currency === 'CNY' || it.currency === 'USD') data.currency = it.currency;
          return prisma.packagePrice.upsert({
            where: { tigerPkgId },
            update: data,
            create: { tigerPkgId, ...data },
          });
        }),
      );
      await refreshAfterOverride();
      res.json({ code: 0, data: { updated: items.length } });
    } catch (e: any) {
      console.error('[pricing] 批量设置失败：', e.message);
      res.status(400).json({ code: 1, message: '批量设置失败：' + e.message });
    }
  });

  /** POST /api/admin/packages/prices/clear 批量移出白名单（删除本地记录，彻底不再展示） */
  router.post('/packages/prices/clear', async (req: Request, res: Response) => {
    try {
      const tigerPkgIds = Array.isArray(req.body?.tigerPkgIds)
        ? (req.body.tigerPkgIds as any[]).map(Number)
        : [];
      if (tigerPkgIds.length === 0) {
        return res.json({ code: 1, message: 'tigerPkgIds 不能为空' });
      }
      const invalid = tigerPkgIds.some((id) => !Number.isInteger(id) || id <= 0);
      if (invalid) return res.json({ code: 1, message: '存在非法套餐 ID' });
      await prisma.packagePrice.deleteMany({ where: { tigerPkgId: { in: tigerPkgIds } } });
      await refreshAfterOverride();
      res.json({ code: 0, data: { cleared: tigerPkgIds.length } });
    } catch (e: any) {
      console.error('[pricing] 批量移出失败：', e.message);
      res.status(400).json({ code: 1, message: '批量移出失败：' + e.message });
    }
  });

  // ===== 汇率与展示货币设置（全局）=====

  /** GET /api/admin/settings 读取全局设置：展示货币 + USD⇄CNY 汇率 */
  router.get('/settings', async (_req: Request, res: Response) => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['displayCurrency', 'usdCnyRate'] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    res.json({
      code: 0,
      data: {
        settings: {
          displayCurrency: map.get('displayCurrency') === 'USD' ? 'USD' : 'CNY',
          usdCnyRate: Number(map.get('usdCnyRate') || 7),
        },
      },
    });
  });

  /**
   * PUT /api/admin/settings 设置展示货币与汇率
   * body: { displayCurrency?: 'CNY'|'USD', usdCnyRate?: number }
   * 写完后清 settings 白名单缓存 + 失效套餐缓存并同步重拉，保证前台即时重新换算。
   */
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const { displayCurrency, usdCnyRate } = req.body || {};
      const writes = [];
      if (displayCurrency === 'USD' || displayCurrency === 'CNY') {
        writes.push(
          prisma.setting.upsert({
            where: { key: 'displayCurrency' },
            update: { value: displayCurrency },
            create: { key: 'displayCurrency', value: displayCurrency },
          }),
        );
      }
      if (usdCnyRate !== undefined && usdCnyRate !== null && usdCnyRate !== '') {
        const r = Number(usdCnyRate);
        if (!Number.isFinite(r) || r <= 0) {
          return res.json({ code: 1, message: '汇率必须是大于 0 的数字' });
        }
        writes.push(
          prisma.setting.upsert({
            where: { key: 'usdCnyRate' },
            update: { value: String(r) },
            create: { key: 'usdCnyRate', value: String(r) },
          }),
        );
      }
      if (writes.length === 0) {
        return res.json({ code: 1, message: '请至少提供 displayCurrency 或 usdCnyRate' });
      }
      await prisma.$transaction(writes);
      await refreshAfterOverride();
      res.json({ code: 0, data: { saved: true } });
    } catch (e: any) {
      console.error('[settings] 保存设置失败：', e.message);
      res.status(400).json({ code: 1, message: '保存失败：' + e.message });
    }
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
