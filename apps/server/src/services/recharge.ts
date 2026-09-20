import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { config } from '../config';
import { applyDeposit, lockSubject } from './quota';

/**
 * Open platform v3: subject wallet top-up (prepaid recharge via Alipay H5).
 * The partner pays CNY into the platform wallet. On Alipay notify success the
 * deposit credits the wallet: it offsets any outstanding DEBT (usedQuota -) first
 * and puts any leftover into BALANCE (balance +). See quota.applyDeposit.
 *
 * rechargeNo is both the merchant order id and the Alipay out_trade_no. Its
 * 'RC' prefix lets the shared /api/alipay/notify handler route to this flow.
 */
export const RECHARGE_PREFIX = 'RC';

/** Create a recharge order and return the Alipay H5 (wap.pay) checkout URL. */
export async function createRechargeWapUrl(
  prisma: PrismaClient,
  subject: { id: string },
  amount: number,
  returnUrl: string,
): Promise<{ rechargeNo: string; payUrl: string }> {
  const cny = Math.round(Number(amount) * 100) / 100;
  if (!(cny > 0)) throw new Error('充值金额必须大于 0');
  if (cny > 100000) throw new Error('单笔充值金额过大');

  const rechargeNo = `${RECHARGE_PREFIX}${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
  const notifyUrl = `${config.alipay.notifyHost}/api/alipay/notify`;

  await prisma.subjectRecharge.create({
    data: { rechargeNo, subjectId: subject.id, amount: cny, status: 'pending' },
  });

  // subject kept pure ASCII to avoid GBK sign issues on the Alipay gateway
  const payUrl = await alipay.wapPay(rechargeNo, 'YYeSim Wallet Top-up', cny.toFixed(2), notifyUrl, returnUrl);
  return { rechargeNo, payUrl };
}

/** Credit a recharge on Alipay notify success. Idempotent (skips when already paid). */
export async function fulfillRecharge(
  prisma: PrismaClient,
  rechargeNo: string,
  meta: { alipayTradeNo?: string; paidAmount?: number } = {},
): Promise<{ recharge: any | null; credited: boolean }> {
  const recharge = await prisma.subjectRecharge.findUnique({ where: { rechargeNo } });
  if (!recharge) return { recharge: null, credited: false };
  if (recharge.status !== 'paid') {
    await prisma.$transaction(async (tx: any) => {
      const fresh = await lockSubject(tx, recharge.subjectId);
      await applyDeposit(tx, fresh, rechargeNo, Number(recharge.amount), '支付宝充值入账');
      await tx.subjectRecharge.update({
        where: { id: recharge.id },
        data: { status: 'paid', paidAt: new Date(), alipayTradeNo: meta.alipayTradeNo || null },
      });
    });
  }
  const updated = await prisma.subjectRecharge.findUnique({ where: { rechargeNo } });
  return { recharge: updated, credited: true };
}