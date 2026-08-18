import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { alipay } from '../utils/alipay';
import { tigerClient, extractEsimInfo, getAvailableIccid } from '../tiger';

async function provisionEsim(prisma: PrismaClient, order: any, pkg: any) {
  const expireAt = new Date(Date.now() + (pkg?.days || 7) * 86400000);

  if (tigerClient.configured) {
    const iccid = await getAvailableIccid(prisma);
    if (!iccid) {
      throw new Error('Tiger 卡片池已用完或未配置 TIGER_ICCIDS，请补充卡片库存');
    }
    let tigerPkgId: number | null = pkg?.tigerPkgId ?? null;
    if (!tigerPkgId) {
      const listRes = await tigerClient.listPackages({ package_type: 'data', is_active: true, limit: 500 });
      const items: any[] = listRes?.data?.items || listRes?.items || [];
      const matched = items.find(
        (it) => Number(it.amount) === (pkg?.gb || 0) * 1024 && Number(it.valid_days) === (pkg?.days || 0),
      );
      if (!matched) {
        throw new Error(`未找到与套餐「${pkg?.countryCode} ${pkg?.gb}GB/${pkg?.days}天」匹配的 Tiger 套餐，请先在后台同步套餐映射`);
      }
      tigerPkgId = Number(matched.pid || matched.id);
    }
    const bindRes = await tigerClient.bindPackage(iccid, tigerPkgId);
    const info = extractEsimInfo(bindRes?.data, process.env.TIGER_SMDP_ADDRESS);
    if (!info || !info.activationCode) {
      console.error('[tiger] 绑定成功但未能解析激活信息：', JSON.stringify(bindRes?.data));
      throw new Error('Tiger 绑定套餐成功，但返回数据缺少激活码，请检查响应结构');
    }
    return {
      orderId: order.id,
      pkgId: order.pkgId,
      activationCode: info.activationCode,
      iccid: info.iccid || iccid,
      smdp: info.smdp,
      status: 'pending',
      expireAt,
    };
  }

  const rand = () =>
    Array.from({ length: 4 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31))
    ).join('');
  const smdp = 'smdp.yyesim.net';
  const iccid = '89' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return {
    orderId: order.id,
    pkgId: order.pkgId,
    activationCode: `LPA:1$${smdp}$${rand()}-${rand()}-${rand()}`,
    iccid,
    smdp,
    status: 'pending',
    expireAt,
  };
}

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
        await prisma.esim.create({ data: esimData });
        console.log(`[alipay] 订单 ${outTradeNo} 支付成功，eSIM 已下发`);
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