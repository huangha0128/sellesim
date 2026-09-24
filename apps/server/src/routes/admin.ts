import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { tigerClient, iccidPoolCount, getIccidPool, fetchTigerIccids } from '../tiger';
import { syncAllFromTiger, syncRegionsFromTiger, syncPackagesFromTiger } from '../tiger/sync';
import { enrichEsims } from '../tiger/esim-enrich';
import {
  refundOrder,
  rejectRefundRequest,
  clearMaxRefundRejectCache,
  DEFAULT_MAX_REFUND_REJECT_COUNT,
} from '../services/refund';
import { sendRefundEmail } from '../services/email';
import { buildRefundDeps } from '../services/payment';
import { genAppSecret } from '../utils/hmac';
import { clearWhitelistCache, clearSettingsCache } from '../pricing/priceOverride';
import {
  adminAuth,
  AdminAuthRequest,
  signAdminToken,
  genSalt,
  hashPassword,
  verifyPassword,
} from '../middleware/adminAuth';

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

  // ================= 登录（免鉴权，必须放在 router.use(adminAuth) 之前）=================

  /**
   * POST /api/admin/login 管理后台登录
   * body: { username, password }
   * 成功返回 JWT（有效期 12 小时），前端需在下述请求的 Authorization 头带上 Bearer <token>。
   * 失败的通用文案不区分「用户不存在」与「口令错误」，避免账号枚举。
   */
  router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.json({ code: 1, message: '请输入用户名和密码' });
    }
    try {
      const admin = await prisma.adminUser.findUnique({ where: { username: String(username) } });
      if (!admin || !verifyPassword(String(password), admin.salt, admin.passwordHash)) {
        return res.json({ code: 1, message: '用户名或密码错误' });
      }
      const token = signAdminToken(admin);
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });
      res.json({
        code: 0,
        data: {
          token,
          admin: { id: admin.id, username: admin.username, name: admin.name },
        },
      });
    } catch (e: any) {
      console.error('[admin] 登录失败：', e.message);
      res.json({ code: 1, message: '登录失败，请稍后重试' });
    }
  });

  // ===== 以下所有接口均需管理员鉴权 =====
  router.use(adminAuth(prisma));

  /** GET /api/admin/me 当前登录管理员（前端用于校验 token 是否仍有效） */
  router.get('/me', (req: AdminAuthRequest, res: Response) => {
    res.json({ code: 0, data: { admin: req.admin } });
  });

  /** POST /api/admin/change-password 修改当前管理员密码 body: { oldPassword, newPassword } */
  router.post('/change-password', async (req: AdminAuthRequest, res: Response) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.json({ code: 1, message: '请填写原密码与新密码' });
    }
    if (String(newPassword).length < 8) {
      return res.json({ code: 1, message: '新密码至少 8 位' });
    }
    try {
      const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.id } });
      if (!admin || !verifyPassword(String(oldPassword), admin.salt, admin.passwordHash)) {
        return res.json({ code: 1, message: '原密码不正确' });
      }
      const salt = genSalt();
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { salt, passwordHash: hashPassword(String(newPassword), salt) },
      });
      res.json({ code: 0, data: { changed: true } });
    } catch (e: any) {
      console.error('[admin] 修改密码失败：', e.message);
      res.json({ code: 1, message: '修改失败，请稍后重试' });
    }
  });

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
      include: { user: true, refundRequests: { orderBy: { createdAt: 'asc' } } },
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
  router.post('/orders/:orderNo/refund', async (req: AdminAuthRequest, res: Response) => {
    const { reason } = req.body || {};
    const operator = req.admin?.username || req.admin?.name || 'admin';
    try {
      const result = await refundOrder(
        buildRefundDeps(prisma, req.params.orderNo),
        req.params.orderNo,
        reason,
        operator,
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
  router.post('/orders/:orderNo/refund/reject', async (req: AdminAuthRequest, res: Response) => {
    const { reason } = req.body || {};
    const operator = req.admin?.username || req.admin?.name || 'admin';
    try {
      const result = await rejectRefundRequest(
        buildRefundDeps(prisma, req.params.orderNo),
        req.params.orderNo,
        typeof reason === 'string' ? reason : '',
        operator,
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
    // 与小程序端一致：按 ICCID 实时向 Tiger 富化 usage/status（带 2 分钟 TTL 缓存）
    const displayEsims = await enrichEsims(esims);
    res.json({ code: 0, data: { esims: displayEsims } });
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
      orderBy: [{ priority: 'desc' }, { hot: 'desc' }, { code: 'asc' }],
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
      const { getCatalogView } = await import('../tiger/view');
      const keyword = String(req.query.keyword || '').trim().toLowerCase();
      const countryCode = String(req.query.countryCode || '').trim();
      // 优先读缓存（避免每次打开添加套餐对话框都请求 Tiger API）；refresh=1 强制重新拉取
      const all = await getCatalogView(req.query.refresh === '1');
      const addedRows = await prisma.packagePrice.findMany({ where: { price: { not: null } }, select: { tigerPkgId: true } });
      const addedSet = new Set(addedRows.map((r) => r.tigerPkgId));
      let filtered = all;
      if (countryCode) filtered = filtered.filter((p) => p.countryCode === countryCode);
      if (keyword) {
        filtered = filtered.filter((p) =>
          [
            p.name,
            p.countryCode,
            p.tigerPid,
            String(p.tigerPkgId),
            p.desc,
            String(p.gb) + 'GB',
            String(p.days),
          ].some((v) => String(v || '').toLowerCase().includes(keyword)),
        );
      }
      filtered.sort((a, b) => String(a.countryCode).localeCompare(b.countryCode) || a.gb - b.gb || a.days - b.days);
      res.json({
        code: 0,
        data: { catalog: filtered.map((p) => ({ ...p, added: addedSet.has(Number(p.tigerPkgId)) })), total: filtered.length },
      });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐目录拉取失败：' + e.message });
    }
  });

  /** POST /api/admin/packages/catalog/refresh 强制刷新 Tiger 套餐目录缓存（立即生效，无需等后台定时刷新） */
  router.post('/packages/catalog/refresh', async (_req: Request, res: Response) => {
    if (!tigerClient.configured) return res.json({ code: 1, message: '未配置 Tiger，无法刷新目录' });
    try {
      const { refreshCatalogCache, getCatalogView } = await import('../tiger/view');
      await refreshCatalogCache();
      const all = await getCatalogView(true);
      const addedRows = await prisma.packagePrice.findMany({ where: { price: { not: null } }, select: { tigerPkgId: true } });
      const addedSet = new Set(addedRows.map((r) => r.tigerPkgId));
      res.json({ code: 0, data: { total: all.length, catalog: all.map((p) => ({ ...p, added: addedSet.has(Number(p.tigerPkgId)) })) } });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: 'Tiger 套餐目录刷新失败：' + e.message });
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
   * PUT /api/admin/package-groups/:code 设置某套餐组（国家/地区）的显示名
   * body: { displayName: string } 值为空字符串则还原为默认国家名
   * 该覆盖会应用到该国家/地区下的所有套餐（小程序卡片标题 = countryName）
   */
  router.put('/package-groups/:code', async (req: Request, res: Response) => {
    try {
      const code = String(req.params.code || '').trim();
      if (!code) return res.json({ code: 1, message: '缺少国家/地区编码' });
      const raw = ((req.body && req.body.displayName) as unknown) ?? '';
      const displayName = typeof raw === 'string' ? raw.trim() : '';
      const existing = await prisma.country.findUnique({ where: { code } });
      if (!existing) {
        return res.json({ code: 1, message: '该国家/地区无对应记录，无法设置显示名' });
      }
      await prisma.country.update({
        where: { code },
        data: { displayName: displayName || null },
      });
      await refreshAfterOverride();
      res.json({ code: 0, data: { code, displayName: displayName || null } });
    } catch (e: any) {
      console.error('[pricing] 设置套餐组显示名失败：', e.message);
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

  /** GET /api/admin/settings 读取全局设置：展示货币 + USD⇄CNY 汇率 + 退款拒绝次数上限 */
  router.get('/settings', async (_req: Request, res: Response) => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['displayCurrency', 'usdCnyRate', 'maxRefundRejectCount'] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const maxReject = Number(map.get('maxRefundRejectCount'));
    res.json({
      code: 0,
      data: {
        settings: {
          displayCurrency: map.get('displayCurrency') === 'USD' ? 'USD' : 'CNY',
          usdCnyRate: Number(map.get('usdCnyRate') || 7),
          maxRefundRejectCount:
            Number.isFinite(maxReject) && maxReject >= 1
              ? Math.floor(maxReject)
              : DEFAULT_MAX_REFUND_REJECT_COUNT,
        },
      },
    });
  });

  /**
   * PUT /api/admin/settings 设置展示货币与汇率 / 退款拒绝次数上限
   * body: { displayCurrency?: 'CNY'|'USD', usdCnyRate?: number, maxRefundRejectCount?: number }
   * 写完后清 settings 白名单缓存 + 失效套餐缓存并同步重拉，保证前台即时重新换算。
   */
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const { displayCurrency, usdCnyRate, maxRefundRejectCount } = req.body || {};
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
      if (maxRefundRejectCount !== undefined && maxRefundRejectCount !== null && maxRefundRejectCount !== '') {
        const n = Number(maxRefundRejectCount);
        if (!Number.isInteger(n) || n < 1) {
          return res.json({ code: 1, message: '退款拒绝次数上限必须是大于等于 1 的整数' });
        }
        writes.push(
          prisma.setting.upsert({
            where: { key: 'maxRefundRejectCount' },
            update: { value: String(n) },
            create: { key: 'maxRefundRejectCount', value: String(n) },
          }),
        );
        clearMaxRefundRejectCache();
      }
      if (writes.length === 0) {
        return res.json({ code: 1, message: '请至少提供 displayCurrency、usdCnyRate 或 maxRefundRejectCount' });
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
      iccidPoolCount(prisma, tigerCardFetcher),
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
  // 卡片实时来自 TigerESIM /api/card（与套餐一致），本地 card 表仅在 mock/未配置 Tiger 时兜底

  /** Tiger 卡片池拉取函数（未配置 Tiger 时为 undefined，走本地兜底） */
  const tigerCardFetcher = tigerClient.configured ? () => fetchTigerIccids() : undefined;

  /** GET /api/admin/cards 卡片列表与统计（已使用状态按 esim 表判断） */
  router.get('/cards', async (_req: Request, res: Response) => {
    try {
      const [esims, envCards] = await Promise.all([
        prisma.esim.findMany({ select: { iccid: true } }),
        getIccidPool(prisma, tigerCardFetcher),
      ]);
      const usedSet = new Set(esims.map((e) => e.iccid));

      if (tigerClient.configured) {
        // Tiger 模式：卡片实时来自 Tiger /api/card
        const tigerIccids = await fetchTigerIccids();
        const list = tigerIccids.map((iccid) => ({ iccid, used: usedSet.has(iccid) }));
        const used = list.filter((c) => c.used).length;
        res.json({
          code: 0,
          data: {
            mode: 'tiger',
            cards: list,
            stats: { total: list.length, available: list.length - used, used, envOnly: 0 },
          },
        });
        return;
      }

      // mock/本地模式：列表与统计来自本地 card 表 + 环境变量
      const cards = await prisma.card.findMany({ orderBy: { createdAt: 'desc' } });
      const list = cards.map((c) => ({ ...c, used: usedSet.has(c.iccid) }));
      const used = list.filter((c) => c.used).length;
      res.json({
        code: 0,
        data: {
          mode: 'mock',
          cards: list,
          stats: {
            total: list.length,
            available: list.length - used,
            used,
            envOnly: Math.max(0, envCards.length - list.length),
          },
        },
      });
    } catch (e: any) {
      res.status(502).json({ code: 1, message: '卡片拉取失败：' + e.message });
    }
  });

  /** POST /api/admin/cards 批量新增卡片（仅本地/mock 模式；Tiger 模式由 TigerESIM 后台管理） */
  router.post('/cards', async (req: Request, res: Response) => {
    if (tigerClient.configured) {
      return res.json({ code: 1, message: 'Tiger 模式卡片由 TigerESIM 后台管理，请在合作伙伴后台维护卡片' });
    }
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

  /** DELETE /api/admin/cards/:iccid 删除卡片（仅本地/mock 模式；Tiger 模式由 TigerESIM 后台管理） */
  router.delete('/cards/:iccid', async (req: Request, res: Response) => {
    if (tigerClient.configured) {
      return res.json({ code: 1, message: 'Tiger 模式卡片由 TigerESIM 后台管理，请在合作伙伴后台维护卡片' });
    }
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
      const viewMod = await import('../tiger/view');
      viewMod.invalidatePackageCache();
      viewMod.invalidateCatalogCache();
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
      // 立即刷新套餐缓存 与 目录缓存（从 Tiger 重拉全量写入缓存，避免调用方再次等待 Tiger API）
      const viewMod = await import('../tiger/view');
      viewMod.invalidatePackageCache();
      viewMod.invalidateCatalogCache();
      await viewMod.refreshPackageCache();
      await viewMod.refreshCatalogCache();
      res.json({ code: 0, data: { tigerTotal: unique.size, items: Array.from(unique.values()) } });
    } catch (e: any) {
      res.json({ code: 2, message: `同步失败：${e.message}` });
    }
  });

  // ===== 外部开放支付 API：应用凭据管理 =====

  /** GET /api/admin/external-apps 外部应用列表（含各应用订单数） */
  router.get('/external-apps', async (_req: Request, res: Response) => {
    try {
      const apps = await prisma.externalApp.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              _count: { select: { orders: true } },
            },
          },
        },
      });
      res.json({
        code: 0,
        data: {
          apps: apps.map((a) => ({
            id: a.id,
            appId: a.appId,
            name: a.name,
            callbackUrl: a.callbackUrl,
            enabled: a.enabled,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
            orderCount: a.user?._count?.orders || 0,
          })),
        },
      });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '列表获取失败：' + e.message });
    }
  });

  /**
   * POST /api/admin/external-apps 创建外部应用（appSecret 仅此一次返回，请立即保存）
   * body: { name, callbackUrl? }
   * 事务内创建合成用户（alipayUserId='ext_<appId>'）并关联，其后续订单挂在合成用户下。
   */
  router.post('/external-apps', async (req: Request, res: Response) => {
    const { name, callbackUrl } = req.body || {};
    if (!name) {
      return res.json({ code: 1, message: '缺少应用名称' });
    }
    if (callbackUrl !== undefined && callbackUrl !== null && !/^https?:\/\//.test(String(callbackUrl))) {
      return res.json({ code: 1, message: '回调地址必须以 http(s):// 开头' });
    }
    const appId = crypto.randomBytes(12).toString('hex');
    const appSecret = genAppSecret();
    try {
      const app = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { alipayUserId: `ext_${appId}`, nickname: `外部应用-${name}` },
        });
        return tx.externalApp.create({
          data: {
            appId,
            appSecret,
            name: String(name),
            callbackUrl: callbackUrl ? String(callbackUrl) : null,
            userId: user.id,
          },
        });
      });
      res.json({
        code: 0,
        data: {
          id: app.id,
          appId: app.appId,
          appSecret: app.appSecret, // 仅创建时返回一次
          name: app.name,
          callbackUrl: app.callbackUrl,
        },
      });
    } catch (e: any) {
      console.error('[external-apps] 创建失败：', e.message);
      res.status(500).json({ code: 1, message: '创建失败：' + e.message });
    }
  });

  /** DELETE /api/admin/external-apps/:id 删除外部应用（软删：enabled=false 停止鉴权，保留订单历史与合成用户） */
  router.delete('/external-apps/:id', async (req: Request, res: Response) => {
    try {
      const app = await prisma.externalApp.findUnique({ where: { id: req.params.id } });
      if (!app) {
        return res.json({ code: 1, message: '应用不存在' });
      }
      await prisma.externalApp.update({
        where: { id: app.id },
        data: { enabled: false },
      });
      res.json({ code: 0, data: { id: app.id, disabled: true } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '删除失败：' + e.message });
    }
  });

  /** POST /api/admin/external-apps/:id/reset-secret 重置应用密钥（新 secret 仅此一次返回，请立即保存） */
  router.post('/external-apps/:id/reset-secret', async (req: Request, res: Response) => {
    try {
      const app = await prisma.externalApp.findUnique({ where: { id: req.params.id } });
      if (!app) {
        return res.json({ code: 1, message: '应用不存在' });
      }
      const appSecret = genAppSecret();
      await prisma.externalApp.update({ where: { id: app.id }, data: { appSecret } });
      res.json({
        code: 0,
        data: { id: app.id, appId: app.appId, appSecret }, // 新密钥仅返回一次
      });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '重置失败：' + e.message });
    }
  });

  // ================= 主体 / 密钥 / 定价 管理（Open API v2）=================
  // 主体与密钥生命周期完全由平台后台管理，无自助入口（docs/open-api-design.md §10）。

  /** 生成一把主体 API 密钥 */
  function genSubjectKey(mode: string) {
    const keyId = `ak_${mode}_${crypto.randomBytes(4).toString('hex')}`;
    const keySecret = genAppSecret(); // 32 字节 -> 64 位 hex
    return { keyId, keySecret };
  }
  /** 脱敏 keyId：ak_live_7f3a…9c21（保留前段 + 末尾 4 位） */
  function maskKeyId(keyId: string): string {
    if (keyId.length <= 14) return keyId.slice(0, 6) + '…' + keyId.slice(-4);
    return keyId.slice(0, 12) + '…' + keyId.slice(-4);
  }
  /** 门户账号默认初始用户名 / 密码 */
  const DEFAULT_PORTAL_USERNAME = 'admin';
  const DEFAULT_PORTAL_PASSWORD = 'admin123456';
  const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

  /** GET /api/admin/subjects 主体列表（含密钥数、订单数） */
  router.get('/subjects', async (req: Request, res: Response) => {
    try {
      const subjects = await prisma.subject.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { keys: true, orders: true } } },
      });
      // 脱敏：不下发口令哈希与盐
      const safe = subjects.map(({ passwordHash: _ph, salt: _salt, ...rest }) => rest);
      res.json({ code: 0, data: { subjects: safe } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '查询失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects 创建主体（自动生成合成用户 + 第一把 live 密钥 + 门户初始账号，密钥仅一次返回） */
  router.post('/subjects', async (req: Request, res: Response) => {
    const { name, username, password, contactName, contactPhone, callbackUrl, defaultMarkupPercent, quotaLimit, splitPercent, remark } = req.body || {};
    if (!name) return res.json({ code: 1, message: '请输入主体名称' });
    const portalUsername = String(username || DEFAULT_PORTAL_USERNAME).trim();
    if (!USERNAME_RE.test(portalUsername)) {
      return res.json({ code: 1, message: '门户用户名需为 3-32 位字母、数字、下划线或连字符' });
    }
    const portalPassword = String(password || DEFAULT_PORTAL_PASSWORD);
    if (portalPassword.length < 8) {
      return res.json({ code: 1, message: '门户密码至少 8 位' });
    }
    try {
      const exists = await prisma.subject.findUnique({ where: { username: portalUsername } });
      if (exists) return res.json({ code: 1, message: `门户用户名 ${portalUsername} 已被占用` });
      const salt = genSalt();
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { alipayUserId: `sub_${crypto.randomBytes(6).toString('hex')}`, nickname: `主体-${name}` },
        });
        const subject = await tx.subject.create({
          data: {
            name: String(name),
            username: portalUsername,
            salt,
            passwordHash: hashPassword(portalPassword, salt),
            status: 'active',
            contactName: contactName || null,
            contactPhone: contactPhone || null,
            callbackUrl: callbackUrl || null,
            defaultMarkupPercent: defaultMarkupPercent != null ? Number(defaultMarkupPercent) : null,
            quotaLimit: quotaLimit != null ? Number(quotaLimit) : null,
            splitPercent: splitPercent != null ? Number(splitPercent) : null,
            remark: remark || null,
            userId: user.id,
          },
        });
        const { keyId, keySecret } = genSubjectKey('live');
        const key = await tx.apiKey.create({
          data: { subjectId: subject.id, keyId, keySecret, name: 'default', mode: 'live' },
        });
        return { subject, key };
      });
      res.json({
        code: 0,
        data: {
          id: result.subject.id,
          name: result.subject.name,
          status: result.subject.status,
          account: { username: portalUsername, password: portalPassword },
          key: { keyId: result.key.keyId, keySecret: result.key.keySecret, mode: result.key.mode },
        },
      });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '创建主体失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects/:id/reset-password 后台重置伙伴门户密码（伙伴忘记密码时）body: { password? } */
  router.post('/subjects/:id/reset-password', async (req: Request, res: Response) => {
    const portalPassword = String((req.body || {}).password || DEFAULT_PORTAL_PASSWORD);
    if (portalPassword.length < 8) return res.json({ code: 1, message: '重置密码至少 8 位' });
    try {
      const subject = await prisma.subject.findUnique({ where: { id: req.params.id } });
      if (!subject) return res.json({ code: 1, message: '主体不存在' });
      const salt = genSalt();
      await prisma.subject.update({
        where: { id: subject.id },
        data: { salt, passwordHash: hashPassword(portalPassword, salt) },
      });
      res.json({ code: 0, data: { username: subject.username, password: portalPassword } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '重置密码失败：' + e.message });
    }
  });

  /** GET /api/admin/subjects/:id 主体详情（含脱敏密钥与定价） */
  router.get('/subjects/:id', async (req: Request, res: Response) => {
    try {
      const s = await prisma.subject.findUnique({
        where: { id: req.params.id },
        include: { keys: { orderBy: { createdAt: 'asc' } }, prices: true },
      });
      if (!s) return res.json({ code: 1, message: '主体不存在' });
      // 脱敏：密钥密文与口令哈希/盐均不下发
      const { passwordHash: _ph, salt: _salt, ...rest } = s;
      res.json({
        code: 0,
        data: { subject: { ...rest, keys: s.keys.map((k) => ({ ...k, keySecret: undefined, keyId: maskKeyId(k.keyId) })) } },
      });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '查询失败：' + e.message });
    }
  });

  /** PUT /api/admin/subjects/:id 改资料/状态/回调地址/默认加价/授信额度/分成比例/门户用户名 */
  router.put('/subjects/:id', async (req: Request, res: Response) => {
    const { name, username, contactName, contactPhone, callbackUrl, defaultMarkupPercent, quotaLimit, splitPercent, remark, status } = req.body || {};
    try {
      const data: any = {};
      if (name !== undefined) data.name = String(name);
      if (username !== undefined) {
        const uname = String(username).trim();
        if (!USERNAME_RE.test(uname)) {
          return res.json({ code: 1, message: '门户用户名需为 3-32 位字母、数字、下划线或连字符' });
        }
        const dup = await prisma.subject.findUnique({ where: { username: uname } });
        if (dup && dup.id !== req.params.id) return res.json({ code: 1, message: `门户用户名 ${uname} 已被占用` });
        data.username = uname;
      }
      if (contactName !== undefined) data.contactName = contactName || null;
      if (contactPhone !== undefined) data.contactPhone = contactPhone || null;
      if (callbackUrl !== undefined) data.callbackUrl = callbackUrl || null;
      if (remark !== undefined) data.remark = remark || null;
      if (defaultMarkupPercent !== undefined) data.defaultMarkupPercent = defaultMarkupPercent == null ? null : Number(defaultMarkupPercent);
      if (quotaLimit !== undefined) data.quotaLimit = quotaLimit == null ? null : Number(quotaLimit);
      if (splitPercent !== undefined) data.splitPercent = splitPercent == null ? null : Number(splitPercent);
      if (status !== undefined && ['active', 'suspended'].includes(status)) data.status = status;
      if (!Object.keys(data).length) return res.json({ code: 1, message: '没有需要更新的字段' });
      const updated = await prisma.subject.update({ where: { id: req.params.id }, data });
      const { passwordHash: _ph, salt: _salt, ...subject } = updated;
      res.json({ code: 0, data: { subject } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '更新失败：' + e.message });
    }
  });

  /** DELETE /api/admin/subjects/:id 停用主体（软删，保留订单） */
  router.delete('/subjects/:id', async (req: Request, res: Response) => {
    try {
      const subject = await prisma.subject.update({ where: { id: req.params.id }, data: { status: 'suspended' } });
      res.json({ code: 0, data: { subject } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '停用失败：' + e.message });
    }
  });

  /** GET /api/admin/subjects/:id/keys 密钥列表（secret 脱敏） */
  router.get('/subjects/:id/keys', async (req: Request, res: Response) => {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { subjectId: req.params.id },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ code: 0, data: { keys: keys.map((k) => ({ ...k, keySecret: undefined, keyId: maskKeyId(k.keyId) })) } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '查询失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects/:id/keys 追加密钥，secret 仅此一次返回。body { mode?, name? } */
  router.post('/subjects/:id/keys', async (req: Request, res: Response) => {
    const mode = req.body?.mode === 'test' ? 'test' : 'live';
    const name = req.body?.name || 'default';
    try {
      const { keyId, keySecret } = genSubjectKey(mode);
      const key = await prisma.apiKey.create({ data: { subjectId: req.params.id, keyId, keySecret, name, mode } });
      res.json({ code: 0, data: { keyId: key.keyId, keySecret: key.keySecret, mode: key.mode, name: key.name } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '追加密钥失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects/:id/keys/:keyId/revoke 吊销（立即失效） */
  router.post('/subjects/:id/keys/:keyId/revoke', async (req: Request, res: Response) => {
    try {
      const { count } = await prisma.apiKey.updateMany({
        where: { subjectId: req.params.id, keyId: req.params.keyId },
        data: { enabled: false },
      });
      if (!count) return res.json({ code: 1, message: '密钥不存在' });
      res.json({ code: 0, data: { keyId: req.params.keyId, enabled: false } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '吊销失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects/:id/keys/:keyId/rotate 轮换 secret，新 secret 仅此一次返回 */
  router.post('/subjects/:id/keys/:keyId/rotate', async (req: Request, res: Response) => {
    try {
      const key = await prisma.apiKey.findFirst({ where: { subjectId: req.params.id, keyId: req.params.keyId } });
      if (!key) return res.json({ code: 1, message: '密钥不存在' });
      const { keySecret } = genSubjectKey('live');
      await prisma.apiKey.update({ where: { id: key.id }, data: { keySecret } });
      res.json({ code: 0, data: { keyId: key.keyId, keySecret } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '轮换失败：' + e.message });
    }
  });

  /** GET /api/admin/subjects/:id/prices 查看该主体套餐定价 */
  router.get('/subjects/:id/prices', async (req: Request, res: Response) => {
    try {
      const prices = await prisma.subjectPackagePrice.findMany({ where: { subjectId: req.params.id } });
      res.json({ code: 0, data: { prices } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '查询失败：' + e.message });
    }
  });

  /** PUT /api/admin/subjects/:id/prices 批量设置/覆盖该主体套餐价。body { items: [{ pkgId, price?, markupPercent?, costPrice?, enabled? }] } */
  router.put('/subjects/:id/prices', async (req: Request, res: Response) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json({ code: 1, message: '缺少 items' });
    try {
      const results: any[] = [];
      for (const it of items) {
        if (!it?.pkgId) continue;
        results.push(
          await prisma.subjectPackagePrice.upsert({
            where: { subjectId_pkgId: { subjectId: req.params.id, pkgId: String(it.pkgId) } },
            create: {
              subjectId: req.params.id,
              pkgId: String(it.pkgId),
              price: it.price != null ? Number(it.price) : null,
              markupPercent: it.markupPercent != null ? Number(it.markupPercent) : null,
              costPrice: it.costPrice != null ? Number(it.costPrice) : null,
              enabled: it.enabled === undefined ? true : !!it.enabled,
            },
            update: {
              price: it.price !== undefined ? (it.price == null ? null : Number(it.price)) : undefined,
              markupPercent: it.markupPercent !== undefined ? (it.markupPercent == null ? null : Number(it.markupPercent)) : undefined,
              costPrice: it.costPrice !== undefined ? (it.costPrice == null ? null : Number(it.costPrice)) : undefined,
              enabled: it.enabled === undefined ? undefined : !!it.enabled,
            },
          }),
        );
      }
      res.json({ code: 0, data: { updated: results.length } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '设置失败：' + e.message });
    }
  });

  // ================= 授信额度（Open platform v3）=================

  /** GET /api/admin/subjects/:id/ledger 记账流水（分页，按 type 过滤） */
  router.get('/subjects/:id/ledger', async (req: Request, res: Response) => {
    const where: any = { subjectId: req.params.id };
    if (req.query.type) where.type = String(req.query.type);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    try {
      const [total, rows] = await Promise.all([
        prisma.subjectLedger.count({ where }),
        prisma.subjectLedger.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      const operatorIds = Array.from(new Set(rows.map((r) => r.operatorId).filter(Boolean))) as string[];
      const operators = operatorIds.length
        ? await prisma.adminUser.findMany({ where: { id: { in: operatorIds } }, select: { id: true, username: true } })
        : [];
      const opMap = new Map(operators.map((o) => [o.id, o.username]));
      res.json({
        code: 0,
        data: {
          ledger: rows.map((l) => ({ ...l, operatorName: l.operatorId ? opMap.get(l.operatorId) || null : null })),
          total,
          page,
          pageSize,
        },
      });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '查询失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects/:id/settle 结清记账：body { amount, note? } */
  router.post('/subjects/:id/settle', async (req: Request, res: Response) => {
    const amount = Number(req.body?.amount);
    const note = req.body?.note ? String(req.body.note) : undefined;
    if (!(amount > 0)) return res.json({ code: 1, message: '结清金额必须大于 0' });
    try {
      const subject = await prisma.subject.findUnique({ where: { id: req.params.id } });
      if (!subject) return res.json({ code: 1, message: '主体不存在' });
      // clamp to the amount already used, or allow credit (over-settle) if > used
      const newUsed = Math.max(0, Number(subject.usedQuota ?? 0) - amount);
      await prisma.$transaction([
        prisma.subject.update({ where: { id: req.params.id }, data: { usedQuota: newUsed } }),
        prisma.subjectLedger.create({
          data: {
            subjectId: req.params.id,
            type: 'settle_credit',
            amount,
            note: note ? `${note}（结清 ${amount}）` : `结清 ${amount}`,
            operatorId: (req as any).admin?.id || null,
          },
        }),
      ]);
      res.json({ code: 0, data: { usedQuota: newUsed } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '结清失败：' + e.message });
    }
  });

  /** POST /api/admin/subjects/:id/adjquota 额度调整：body { amount(带符号), reason? } */
  router.post('/subjects/:id/adjquota', async (req: Request, res: Response) => {
    const signed = Number(req.body?.amount);
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    if (!signed || !Number.isFinite(signed)) return res.json({ code: 1, message: '调整金额无效' });
    try {
      const subject = await prisma.subject.findUnique({ where: { id: req.params.id } });
      if (!subject) return res.json({ code: 1, message: '主体不存在' });
      const base = Number(subject.usedQuota ?? 0) + signed;
      const newUsed = Math.max(0, base);
      await prisma.$transaction([
        prisma.subject.update({ where: { id: req.params.id }, data: { usedQuota: newUsed } }),
        prisma.subjectLedger.create({
          data: {
            subjectId: req.params.id,
            type: 'adjust',
            amount: Math.abs(signed),
            note: `${reason ? reason + '；' : ''}增减:${signed}`,
            operatorId: (req as any).admin?.id || null,
          },
        }),
      ]);
      res.json({ code: 0, data: { usedQuota: newUsed } });
    } catch (e: any) {
      res.status(500).json({ code: 1, message: '调整失败：' + e.message });
    }
  });

  return router;
};
