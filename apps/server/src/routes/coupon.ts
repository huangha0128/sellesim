import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getPackageView } from '../tiger/view';
import { CouponError, orderPriceToCny, quoteCoupon, listMyCoupons } from '../services/coupon';

// 用户端优惠券接口（小程序，均需登录）：
//  POST /api/coupons/validate  校验兑换码/我的券对指定套餐的可用性与抵扣金额
//  GET  /api/coupons/mine      我的可用优惠券（未使用且券模板启用）
export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/validate', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { code, userCouponId, pkgId } = req.body || {};
    if (!pkgId) {
      return res.json({ code: 1, message: '缺少套餐参数' });
    }
    try {
      const pkg: any = await getPackageView(String(pkgId));
      if (!pkg) {
        return res.json({ code: 1, message: '套餐不存在' });
      }
      const cnyPrice = await orderPriceToCny(Number(pkg.price));
      const quote = await quoteCoupon(prisma, {
        userId: req.userId!,
        cnyPrice,
        couponCode: code ? String(code) : undefined,
        userCouponId: userCouponId ? String(userCouponId) : undefined,
      });
      res.json({ code: 0, data: { quote, cnyPrice } });
    } catch (e: any) {
      if (e instanceof CouponError) {
        return res.json({ code: 1, message: e.message });
      }
      console.error('[coupon] 校验优惠券失败：', e.message);
      res.json({ code: 1, message: '优惠券校验失败，请稍后重试' });
    }
  });

  router.get('/mine', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const coupons = await listMyCoupons(prisma, req.userId!);
      res.json({ code: 0, data: { coupons } });
    } catch (e: any) {
      console.error('[coupon] 查询我的优惠券失败：', e.message);
      res.json({ code: 1, message: '查询失败，请稍后重试' });
    }
  });

  return router;
};
