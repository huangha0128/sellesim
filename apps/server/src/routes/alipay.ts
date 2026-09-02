import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { provisionEsim } from '../services/provision';
import { renewEsim, changeEsim } from '../services/topup';
import { sendEsimEmail, sendRenewEmail, sendChangeEmail } from '../services/email';

/**
 * 支付宝异步通知专用的表单解析器。
 * 支付宝会以 `application/x-www-form-urlencoded;charset=GBK` 发送通知，
 * 而 Express 内置的 urlencoded 解析器不支持 GBK 字符集会抛 415，导致通知进不了处理器。
 * 这里直接读取原始 body 并按 urlencoded 解析（通知内字段均为 ASCII，UTF-8 解码即可）。
 */
function parseAlipayNotifyBody(req: Request, _res: Response, next: NextFunction) {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf-8');
    const params: Record<string, string> = {};
    try {
      for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
    } catch (e) {
      return next(e as Error);
    }
    (req as Request & { body: Record<string, string> }).body = params;
    next();
  });
  req.on('error', next);
}

export default (prisma: PrismaClient) => {
  const router = Router();

  /**
   * 支付宝异步通知回调
   * 支付成功后支付宝会 POST 表单数据到此地址
   * 必须返回 "success"（全部小写）表示接收成功，否则支付宝会重复通知
   */
  router.post('/notify', parseAlipayNotifyBody, async (req: Request, res: Response) => {
    const params = req.body as Record<string, string>;
    const sign = params.sign || '';
    const signType = params.sign_type || '';
    // 关键日志：一旦支付宝真正调用到此接口，这一行必然出现，可用于判断通知是否到达
    console.log(
      `[alipay] 收到支付宝通知 out_trade_no=${params.out_trade_no || '(空)'} trade_status=${params.trade_status || '(空)'} app_id=${params.app_id || '(空)'}`,
    );

    const notifyParams: Record<string, string> = {};
    for (const key of Object.keys(params)) {
      if (key !== 'sign' && key !== 'sign_type') {
        notifyParams[key] = params[key];
      }
    }

    const isValid = alipay.verifySign(notifyParams, sign);
    if (!isValid) {
      console.error(
        `[alipay] 通知签名验证失败 out_trade_no=${params.out_trade_no || '(空)'} sign_type=${signType || '(空)'} app_id=${params.app_id || '(空)'}`,
      );
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
          paidAmount: Number(params.buyer_pay_amount ?? params.total_amount ?? 0),
        },
      });

      try {
        if (updated.orderType === 'renew' || updated.orderType === 'change') {
          const target = await prisma.esim.findFirst({
            where: { id: updated.targetEsimId || '', userId: order.userId },
          });
          if (!target) {
            throw new Error('目标 eSIM 不存在');
          }
          const esim =
            updated.orderType === 'renew'
              ? await renewEsim(prisma, updated, target)
              : await changeEsim(prisma, updated, target);
          console.log(`[alipay] 订单 ${outTradeNo} 支付成功，${updated.orderType} 已执行`);

          if (updated.orderType === 'renew') {
            sendRenewEmailSafe(updated, target, esim).catch((e) =>
              console.error(`[email] 订单 ${outTradeNo} 续费通知发送失败：`, e.message),
            );
          } else {
            sendChangeEmailSafe(updated, target, esim).catch((e) =>
              console.error(`[email] 订单 ${outTradeNo} 变更通知发送失败：`, e.message),
            );
          }
        } else {
          const esimData = await provisionEsim(prisma, updated);
          await prisma.esim.create({ data: { ...esimData, userId: order.userId } });
          console.log(`[alipay] 订单 ${outTradeNo} 支付成功，eSIM 已下发`);

          // 发送激活码邮件（非阻塞，失败不影响下单结果）
          sendEsimEmailSafe(order, esimData).catch((e) =>
            console.error(`[email] 订单 ${outTradeNo} 邮件发送失败：`, e.message),
          );
        }
      } catch (e: any) {
        console.error(`[alipay] 订单 ${outTradeNo} 支付成功但 eSIM 操作失败：`, e.message);
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
async function sendEsimEmailSafe(order: any, esimData: any) {
  if (!order.email) return;
  const country = order.countryCode || '';
  await sendEsimEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: country,
    gb: order.gb || 0,
    days: order.days || 0,
    activationCode: esimData.activationCode,
    iccid: esimData.iccid,
    expireAt: esimData.expireAt,
  });
}

/** 发送续费成功通知邮件（安全包装，失败只打日志） */
async function sendRenewEmailSafe(order: any, targetEsim: any, updatedEsim: any) {
  if (!order.email) return;
  await sendRenewEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: order.pkgName || order.countryCode || '',
    addedGb: order.gb || 0,
    addedDays: order.days || 0,
    totalGb: updatedEsim.gb ?? targetEsim.gb ?? order.gb ?? 0,
    totalDays: updatedEsim.days ?? targetEsim.days ?? order.days ?? 0,
    expireAt: updatedEsim.expireAt,
  });
}

/** 发送套餐变更成功通知邮件（安全包装，失败只打日志） */
async function sendChangeEmailSafe(order: any, targetEsim: any, updatedEsim: any) {
  if (!order.email) return;
  await sendChangeEmail({
    to: order.email,
    orderNo: order.orderNo,
    countryName: order.pkgName || order.countryCode || '',
    gb: updatedEsim.gb ?? order.gb ?? 0,
    days: updatedEsim.days ?? order.days ?? 0,
    expireAt: updatedEsim.expireAt,
    activationCode: updatedEsim.activationCode || targetEsim.activationCode,
    iccid: updatedEsim.iccid || targetEsim.iccid,
  });
}
