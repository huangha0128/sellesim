import { PrismaClient } from '@prisma/client';
import { genNonce, signContent, hmacSign } from '../utils/hmac';

/**
 * 外部开放支付 API 的支付成功回调（Webhook）服务。
 *
 * 支付成功后（/api/alipay/notify 履约完成）调用 enqueueWebhook 将订单置为待回调，
 * 后台定时器（见 index.ts）调用 retryPendingWebhooks 按退避策略重试；
 * 外部项目也可通过手动重发接口立即触发一次。
 *
 * 出站回调与入站请求共用同一套 HMAC-SHA256 签名约定：
 *   签名字符串 = appId + '\n' + timestamp + '\n' + nonce + '\n' + rawBody(payload 原串)
 *   X-Sign = hex(HMAC-SHA256(appSecret, 签名字符串))
 * 回调 payload 带 orderNo 供外部项目幂等去重。
 */

export interface WebhookPayload {
  event: 'order.paid';
  orderNo: string;
  extOrderNo: string | null;
  status: string;
  paidAt: string | null;
  /** 实付金额（无实付记录时回落订单价） */
  totalAmount: number;
}

/** 退避间隔（秒），下标 = 已尝试次数：首次立即发送，之后 1 分钟 → 5 分钟 → 30 分钟 → 2 小时 */
const WEBHOOK_BACKOFF = [0, 60, 300, 1800, 7200];
/** 最大发送尝试次数（含首次），达到后订单置 failed 不再自动重试 */
const MAX_RETRY = WEBHOOK_BACKOFF.length;

/** 支付成功后入队（幂等：已有成功记录或非外部订单时跳过） */
export async function enqueueWebhook(prisma: PrismaClient, order: any): Promise<void> {
  if (!order.extOrderNo || order.webhookStatus === 'success') return;
  await prisma.order.update({
    where: { orderNo: order.orderNo },
    data: { webhookStatus: 'pending' },
  });
}

/** 发送一次 webhook，仅 2xx 视为成功；异常（超时/网络/非 2xx）返回 false */
export async function sendWebhook(
  prisma: PrismaClient,
  app: { appId: string; appSecret: string; callbackUrl?: string | null },
  order: any,
): Promise<boolean> {
  if (!app.callbackUrl) {
    console.warn(`[webhook] 外部应用 ${app.appId} 未配置回调地址，跳过订单 ${order.orderNo}`);
    return false;
  }
  const payload: WebhookPayload = {
    event: 'order.paid',
    orderNo: order.orderNo,
    extOrderNo: order.extOrderNo || null,
    status: order.status,
    paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
    totalAmount: Number(order.paidAmount ?? order.price ?? 0),
  };
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const nonce = genNonce();
  const signature = hmacSign(app.appSecret, signContent(app.appId, timestamp, nonce, body));

  try {
    const res = await fetch(app.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': app.appId,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Sign': signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      console.log(`[webhook] 订单 ${order.orderNo} 回调成功 status=${res.status}`);
      return true;
    }
    console.error(`[webhook] 订单 ${order.orderNo} 回调非 2xx status=${res.status}`);
    return false;
  } catch (e: any) {
    console.error(`[webhook] 订单 ${order.orderNo} 回调异常：`, e.message);
    return false;
  }
}

/** 根据退避策略重试待回调订单（index.ts 定时器每秒/分钟调用） */
export async function retryPendingWebhooks(prisma: PrismaClient): Promise<void> {
  const pending = await prisma.order.findMany({
    where: { webhookStatus: 'pending' },
    orderBy: { updatedAt: 'asc' },
  });
  for (const order of pending) {
    try {
      const app = await prisma.externalApp.findFirst({ where: { userId: order.userId || '' } });
      if (!app || !app.callbackUrl) {
        // 应用已删除或无回调地址：无法送达，直接终态 failed，避免无限重试
        await prisma.order.update({
          where: { orderNo: order.orderNo },
          data: { webhookStatus: 'failed', webhookSentAt: new Date() },
        });
        continue;
      }

      const backoff = WEBHOOK_BACKOFF[order.webhookRetryCount] ?? WEBHOOK_BACKOFF[WEBHOOK_BACKOFF.length - 1];
      if (backoff > 0 && order.webhookSentAt && Date.now() - new Date(order.webhookSentAt).getTime() < backoff * 1000) {
        continue; // 尚未到下次重试时间
      }

      const ok = await sendWebhook(prisma, app, order);
      const newCount = order.webhookRetryCount + 1;
      if (ok) {
        await prisma.order.update({
          where: { orderNo: order.orderNo },
          data: { webhookStatus: 'success', webhookSentAt: new Date(), webhookRetryCount: newCount },
        });
      } else if (newCount >= MAX_RETRY) {
        console.error(`[webhook] 订单 ${order.orderNo} 已达最大重试次数，标记失败`);
        await prisma.order.update({
          where: { orderNo: order.orderNo },
          data: { webhookStatus: 'failed', webhookSentAt: new Date(), webhookRetryCount: newCount },
        });
      } else {
        await prisma.order.update({
          where: { orderNo: order.orderNo },
          data: { webhookSentAt: new Date(), webhookRetryCount: newCount },
        });
      }
    } catch (e: any) {
      console.error(`[webhook] 订单 ${order.orderNo} 重试处理异常：`, e.message);
    }
  }
}

/** 手动重发一次（retry 接口用）：置 pending 并立即发送，返回是否成功 */
export async function resendWebhook(prisma: PrismaClient, order: any): Promise<{ sent: boolean; message?: string }> {
  const app = await prisma.externalApp.findFirst({ where: { userId: order.userId || '' } });
  if (!app) {
    return { sent: false, message: '外部应用不存在' };
  }
  if (!app.callbackUrl) {
    return { sent: false, message: '外部应用未配置回调地址' };
  }
  await prisma.order.update({
    where: { orderNo: order.orderNo },
    data: { webhookStatus: 'pending', webhookSentAt: new Date() },
  });
  const ok = await sendWebhook(prisma, app, order);
  return { sent: ok, message: ok ? undefined : '回调失败，请检查回调地址后重试' };
}
