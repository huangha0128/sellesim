import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminAuth } from '../middleware/adminAuth';
import { computeUserCouponExpiry } from '../services/coupon';

// Admin coupon management. Mounted at /api/admin/coupons, admin auth required.
// Coupon lifecycle: create template -> grant to users (UserCoupon instances)
// or expose a redemption code -> users redeem at checkout -> refund returns it.
// Expire types: date (validFrom/validUntil) | days (validDays after grant) | never.

interface CouponInput {
  name?: string;
  code?: string | null;
  type?: string;
  amount?: number | null;
  percent?: number | null;
  minSpend?: number | null;
  totalQuota?: number | null;
  perUserLimit?: number | null;
  expireType?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  validDays?: number | null;
  remark?: string | null;
  status?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Validate + normalize coupon payload; returns { data } or { error } */
function parseCouponInput(body: CouponInput, existingId?: string): { data?: any; error?: string } {
  const name = String(body.name || '').trim();
  if (!name) return { error: '请输入优惠券名称' };

  const type = String(body.type || '');
  if (!['fixed', 'percent'].includes(type)) return { error: '无效的优惠券类型' };

  let amount: number | null = null;
  let percent: number | null = null;
  if (type === 'fixed') {
    amount = round2(Number(body.amount));
    if (!(amount > 0)) return { error: '请输入大于 0 的满减金额（元）' };
  } else {
    percent = Number(body.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return { error: '折扣比例需在 1-100 之间（如 20 表示 8 折）' };
    }
    percent = round2(percent);
  }

  const minSpend = round2(Math.max(0, Number(body.minSpend ?? 0) || 0));

  let totalQuota: number | null = null;
  if (body.totalQuota != null && body.totalQuota !== ('' as any)) {
    const q = Math.floor(Number(body.totalQuota));
    if (!(q >= 1)) return { error: '发放总量需为正整数，留空表示不限量' };
    totalQuota = q;
  }

  const perUserLimit = Math.max(1, Math.floor(Number(body.perUserLimit ?? 1) || 1));

  const expireType = String(body.expireType || 'never');
  if (!['date', 'days', 'never'].includes(expireType)) return { error: '无效的过期方式' };
  let validFrom: Date | null = null;
  let validUntil: Date | null = null;
  let validDays: number | null = null;
  if (expireType === 'date') {
    if (!body.validUntil) return { error: '请选择过期日期' };
    validUntil = new Date(String(body.validUntil));
    if (isNaN(validUntil.getTime())) return { error: '过期日期格式不正确' };
    if (body.validFrom) {
      validFrom = new Date(String(body.validFrom));
      if (isNaN(validFrom.getTime())) return { error: '生效日期格式不正确' };
    }
    if (validFrom && validFrom >= validUntil) return { error: '生效日期必须早于过期日期' };
  } else if (expireType === 'days') {
    const d = Math.floor(Number(body.validDays));
    if (!(d >= 1)) return { error: '有效天数需为正整数' };
    validDays = d;
  }

  let code: string | null = null;
  if (body.code != null && String(body.code).trim()) {
    code = String(body.code).trim();
    if (code.length > 64) return { error: '兑换码最长 64 个字符' };
  }

  return {
    data: {
      name,
      code,
      type,
      amount,
      percent,
      minSpend,
      totalQuota,
      perUserLimit,
      status: body.status === 'disabled' ? 'disabled' : 'active',
      expireType,
      validFrom,
      validUntil,
      validDays,
      remark: body.remark != null && String(body.remark).trim() ? String(body.remark).trim() : null,
      ...(existingId ? {} : {}),
    },
  };
}

export default (prisma: PrismaClient) => {
  const router = Router();
  router.use(adminAuth(prisma));

  // GET /api/admin/coupons?keyword=&status=&page=&pageSize=
  router.get('/', async (req: Request, res: Response) => {
    const { keyword, status, page: pageRaw, pageSize: sizeRaw } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(sizeRaw || '50', 10) || 50));

    const where: any = {};
    if (keyword) where.OR = [{ name: { contains: String(keyword) } }, { code: { contains: String(keyword) } }];
    if (status === 'active' || status === 'disabled') where.status = status;

    const [list, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { userCoupons: true, redemptions: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);

    res.json({ code: 0, data: { list, total, page, pageSize } });
  });

  // POST /api/admin/coupons  create template
  router.post('/', async (req: Request, res: Response) => {
    const parsed = parseCouponInput(req.body || {});
    if (parsed.error) return res.json({ code: 1, message: parsed.error });
    if (parsed.data!.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: parsed.data!.code } });
      if (dup) return res.json({ code: 1, message: '兑换码已存在' });
    }
    const coupon = await prisma.coupon.create({ data: parsed.data! });
    res.json({ code: 0, data: { coupon } });
  });

  // PUT /api/admin/coupons/:id  update template
  router.put('/:id', async (req: Request, res: Response) => {
    const exists = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.json({ code: 1, message: '优惠券不存在' });
    const parsed = parseCouponInput(req.body || {}, exists.id);
    if (parsed.error) return res.json({ code: 1, message: parsed.error });
    if (parsed.data!.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: parsed.data!.code } });
      if (dup && dup.id !== exists.id) return res.json({ code: 1, message: '兑换码已存在' });
    }
    const coupon = await prisma.coupon.update({ where: { id: exists.id }, data: parsed.data! });
    res.json({ code: 0, data: { coupon } });
  });

  // POST /api/admin/coupons/:id/toggle  enable/disable
  router.post('/:id/toggle', async (req: Request, res: Response) => {
    const exists = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.json({ code: 1, message: '优惠券不存在' });
    const coupon = await prisma.coupon.update({
      where: { id: exists.id },
      data: { status: exists.status === 'active' ? 'disabled' : 'active' },
    });
    res.json({ code: 0, data: { coupon } });
  });

  // DELETE /api/admin/coupons/:id  only when never used / granted
  router.delete('/:id', async (req: Request, res: Response) => {
    const exists = await prisma.coupon.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { userCoupons: true, redemptions: true } } },
    });
    if (!exists) return res.json({ code: 1, message: '优惠券不存在' });
    if (exists.usedCount > 0 || exists._count.userCoupons > 0 || exists._count.redemptions > 0) {
      return res.json({ code: 1, message: '该优惠券已被领取/使用，只能停用不能删除' });
    }
    await prisma.coupon.delete({ where: { id: exists.id } });
    res.json({ code: 0, message: '已删除' });
  });

  // POST /api/admin/coupons/:id/grant  body { userIds?: string[], emails?: string[] }
  // Grants one UserCoupon per user, capped by coupon.perUserLimit (unused+used instances counted).
  router.post('/:id/grant', async (req: Request, res: Response) => {
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) return res.json({ code: 1, message: '优惠券不存在' });
    const { userIds, emails } = req.body || {};
    const idList: string[] = Array.isArray(userIds) ? userIds.map((v: any) => String(v).trim()).filter(Boolean) : [];
    const emailList: string[] = Array.isArray(emails) ? emails.map((v: any) => String(v).trim()).filter(Boolean) : [];
    if (!idList.length && !emailList.length) {
      return res.json({ code: 1, message: '请填写要发放的用户（ID 或邮箱）' });
    }

    const users = await prisma.user.findMany({
      where: { OR: [...(idList.length ? [{ id: { in: idList } }] : []), ...(emailList.length ? [{ email: { in: emailList } }] : [])] },
      select: { id: true, email: true, nickname: true },
    });
    const foundIds = new Set(users.map((u) => u.id));
    const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
    const notFound: string[] = [
      ...idList.filter((id) => !foundIds.has(id)),
      ...emailList.filter((e) => !foundEmails.has(e.toLowerCase())),
    ];

    const now = new Date();
    const expiresAt = computeUserCouponExpiry(coupon, now);
    const granted: any[] = [];
    const skipped: { user: string; reason: string }[] = [];

    for (const u of users) {
      const held = await prisma.userCoupon.count({
        where: { couponId: coupon.id, userId: u.id, status: { in: ['unused', 'used'] } },
      });
      if (held >= coupon.perUserLimit) {
        skipped.push({ user: u.email || u.nickname || u.id, reason: `已达每人限领 ${coupon.perUserLimit} 张` });
        continue;
      }
      granted.push(
        await prisma.userCoupon.create({
          data: {
            couponId: coupon.id,
            userId: u.id,
            status: 'unused',
            source: 'grant',
            grantedAt: now,
            expiresAt,
          },
        }),
      );
    }

    res.json({
      code: 0,
      data: {
        grantedCount: granted.length,
        skipped,
        notFound,
        expiresAt,
      },
    });
  });

  // GET /api/admin/coupons/:id/redemptions?page=&pageSize=  usage records
  router.get('/:id/redemptions', async (req: Request, res: Response) => {
    const exists = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.json({ code: 1, message: '优惠券不存在' });
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) || '50', 10) || 50));

    const [list, total] = await Promise.all([
      prisma.couponRedemption.findMany({
        where: { couponId: exists.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true, nickname: true } },
          userCoupon: { select: { id: true, source: true } },
        },
      }),
      prisma.couponRedemption.count({ where: { couponId: exists.id } }),
    ]);
    res.json({ code: 0, data: { list, total, page, pageSize } });
  });

  // GET /api/admin/coupons/:id/grants?page=&pageSize=  granted instances (who holds what)
  router.get('/:id/grants', async (req: Request, res: Response) => {
    const exists = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.json({ code: 1, message: '优惠券不存在' });
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) || '50', 10) || 50));

    const [list, total] = await Promise.all([
      prisma.userCoupon.findMany({
        where: { couponId: exists.id },
        orderBy: { grantedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, email: true, nickname: true } } },
      }),
      prisma.userCoupon.count({ where: { couponId: exists.id } }),
    ]);
    res.json({ code: 0, data: { list, total, page, pageSize } });
  });

  return router;
};
