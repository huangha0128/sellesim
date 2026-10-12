import { PrismaClient } from '@prisma/client';
import { provisionNewOrderEsim } from './payment';

/**
 * 已支付但无 eSIM 的订单补偿下发（对账任务）。
 * 背景：支付履约先置订单为已支付再下发 eSIM，下发失败时通知接口会吞掉异常照常返回
 * success（支付宝不再重试），若无补偿机制，订单将永久停留「已支付无卡」（线上已出现
 * 两笔此类订单）。本任务与实时下发（取码轮询重试 + 绑定回滚）形成两级兜底。
 *
 * 幂等：只处理 orderType='new' 且无 esim 记录的订单；续费卡死场景较复杂，暂由人工处理。
 * 只处理近 48 小时内的订单：更早的订单大概率已被人工处理（如手动取码救场），补发反而
 * 会造成客户重复收货。
 */
const RECONCILE_INTERVAL_MS = 5 * 60_000; // 每 5 分钟扫描一次
const MIN_AGE_MS = 10 * 60_000; // 支付满 10 分钟仍无 eSIM 才介入，给实时下发（含重试）留足时间
const MAX_AGE_MS = 48 * 3600_000;

export function startProvisionReconciler(prisma: PrismaClient): void {
  const tick = async () => {
    try {
      const orders = await prisma.order.findMany({
        where: {
          status: 'paid',
          orderType: 'new',
          paidAt: {
            lte: new Date(Date.now() - MIN_AGE_MS),
            gte: new Date(Date.now() - MAX_AGE_MS),
          },
        },
        include: { esim: true },
      });
      const targets = orders.filter((o) => !o.esim);
      if (targets.length > 0) {
        console.warn(`[reconcile] 发现 ${targets.length} 笔已支付但无 eSIM 的订单，开始补偿下发`);
      }
      for (const order of targets) {
        try {
          await provisionNewOrderEsim(prisma, order);
          console.log(`[reconcile] 订单 ${order.orderNo} 补偿下发成功`);
        } catch (e: any) {
          console.error(`[reconcile] 订单 ${order.orderNo} 补偿下发失败：${e?.message || e}`);
        }
      }
    } catch (e: any) {
      console.error(`[reconcile] 补偿任务执行失败：${e?.message || e}`);
    }
  };
  setInterval(tick, RECONCILE_INTERVAL_MS).unref?.();
}
