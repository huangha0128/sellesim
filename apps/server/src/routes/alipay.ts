import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { fulfillPaidOrder } from '../services/payment';
import { enqueueSubjectWebhook, enqueueWebhook } from '../services/webhook';

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

      try {
        // 统一履约：置已支付 + 记录支付宝交易号/实付金额 + 下发 eSIM（或续费）+ 发送邮件。
        // 这里只保证订单标记为已支付，eSIM 下发失败可后续通过后台/订单查询兜底，故吞掉异常仍返回 success。
        const fulfilled = await fulfillPaidOrder(prisma, order, {
          alipayTradeNo: params.trade_no || '',
          paidAmount: Number(params.buyer_pay_amount ?? params.total_amount ?? 0),
        });
        // 外部订单：入队支付成功 webhook 回调（失败不影响 success 返回，由后台定时器重试）
        if (fulfilled.order.extOrderNo) {
          enqueueWebhook(prisma, fulfilled.order).catch((e) =>
            console.error(`[webhook] 订单 ${outTradeNo} 入队失败：`, e.message),
          );
        }
        // open platform v2 主体订单：入队 order.paid 投递（同样由后台定时器投递/退避重试）
        if (fulfilled.order.subjectId) {
          enqueueSubjectWebhook(prisma, fulfilled.order.subjectId, 'order.paid', {
            event: 'order.paid',
            orderNo: fulfilled.order.orderNo,
            extOrderNo: fulfilled.order.extOrderNo || null,
            status: fulfilled.order.status,
            paidAt: fulfilled.order.paidAt ? new Date(fulfilled.order.paidAt).toISOString() : null,
            totalAmount: Number(fulfilled.order.paidAmount ?? fulfilled.order.price ?? 0),
          }).catch((e) =>
            console.error(`[webhook] 主体订单 ${outTradeNo} 入队失败：`, e.message),
          );
        }
        console.log(`[alipay] 订单 ${outTradeNo} 支付成功，eSIM 已下发`);
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
