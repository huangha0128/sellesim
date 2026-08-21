import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { provisionEsim } from '../services/provision';
import { sendEsimEmail } from '../services/email';

export default (prisma: PrismaClient) => {
  const router = Router();

  /**
   * 支付宝异步通知回调
   * 支付成功后支付宝会 POST 表单数据到此地址
   * 必须返回 "success"（全部小写）表示接收成功，否则支付宝会重复通知
   */
  router.post('/notify', async (req: Request, res: Response) => {
    const params = req.body as Record<string, string>;
    const sign = params.sign || '';
    const signType = params.sign_type || '';

    const notifyParams: Record<string, string> = {};
    for (const key of Object.keys(params)) {
      if (key !== 'sign' && key !== 'sign_type') {
        notifyParams[key] = params[key];
      }
    }

    const isValid = alipay.verifySign(notifyParams, sign);
    if (!isValid) {
      console.error('[alipay] 通知签名验证失败');
      return res.status(200).send('failure');
    }

    const tradeStatus = params.trade_status;
    const outTradeNo = params.out_trade_no;

    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return res.status(200).send('success');
    }

    try {
      const order = await prisma.order.findUnique({
        where: { orderNo: outTradeNo },
      });

      if (!order) {
        console.error(`[alipay] 通知中的订单不存在: ${outTradeNo}`);
        return res.status(200).send('success');
      }

      if (order.status === 'paid') {
        return res.status(200).send('success');
      }

      const updated = await prisma.order.update({
        where: { orderNo: outTradeNo },
        data: {
          status: 'paid',
          paidAt: new Date(),
          alipayTradeNo: params.trade_no || '',
        },
      });

      const pkg = await prisma.package.findUnique({ where: { id: order.pkgId } });
      try {
        const esimData = await provisionEsim(prisma, order, pkg);
        await prisma.esim.create({ data: { ...esimData, userId: order.userId } });
        console.log(`[alipay] 订单 ${outTradeNo} 支付成功，eSIM 已下发`);

        // 发送激活码邮件（非阻塞，失败不影响下单结果）
        sendEsimEmailSafe(prisma, order, pkg, esimData).catch((e) =>
          console.error(`[email] 订单 ${outTradeNo} 邮件发送失败：`, e.message),
        );
      } catch (e: any) {
        console.error(`[alipay] 订单 ${outTradeNo} 支付成功但 eSIM 下发失败：`, e.message);
      }

      res.status(200).send('success');
    } catch (e: any) {
      console.error('[alipay] 通知处理失败：', e.message);
      res.status(200).send('failure');
    }
  });

  return router;
};

/** 发送激活码邮件（安全包装，失败只打日志） */
async function sendEsimEmailSafe(prisma: PrismaClient, order: any, pkg: any, esimData: any) {
  if (!order.email) return;
  const country = pkg?.country?.name_cn || pkg?.countryCode || '';
  await sendEsimEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: country,
    gb: pkg?.gb || 0,
    days: pkg?.days || 0,
    activationCode: esimData.activationCode,
    iccid: esimData.iccid,
    expireAt: esimData.expireAt,
  });
}
