import nodemailer from 'nodemailer';
import QRCode from 'qrcode';

/** 邮件发送服务：发卡成功后向用户邮箱发送激活码与二维码 */

interface SendEsimEmailOptions {
  to: string;
  orderNo: string;
  countryName: string;
  gb: number;
  days: number;
  activationCode: string;
  iccid: string;
  expireAt: Date;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE !== 'false';

  if (!host || !user || !pass) {
    throw new Error('未配置 SMTP 邮件服务（SMTP_HOST / SMTP_USER / SMTP_PASS）');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function generateQrDataUri(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

export async function sendEsimEmail(opts: SendEsimEmailOptions): Promise<void> {
  const transporter = createTransporter();

  const qrDataUri = await generateQrDataUri(opts.activationCode);

  const expireStr = opts.expireAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const fromName = process.env.SMTP_FROM_NAME || 'YYeSim';
  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || '';

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- 头部 -->
        <tr><td style="background:linear-gradient(135deg,#1a6fb5 0%,#0d4a7a 100%);padding:32px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🎉 您的 eSIM 已就绪</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">订单号：${opts.orderNo}</p>
        </td></tr>
        <!-- 套餐信息 -->
        <tr><td style="padding:28px 40px 0;">
          <div style="background:#f0f7ff;border-radius:8px;padding:20px 24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;">套餐信息</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">${opts.countryName} · ${opts.gb}GB · ${opts.days}天</p>
            <p style="margin:8px 0 0;font-size:13px;color:#888;">有效期至 ${expireStr}</p>
          </div>
        </td></tr>
        <!-- 二维码 -->
        <tr><td style="padding:24px 40px 0;text-align:center;">
          <p style="margin:0 0 16px;font-size:14px;color:#666;font-weight:600;">📱 扫码激活 eSIM</p>
          <img src="${qrDataUri}" alt="eSIM 二维码" style="width:240px;height:240px;border-radius:8px;" />
        </td></tr>
        <!-- 激活码 -->
        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#666;font-weight:600;"> 激活码（LPA）</p>
          <div style="background:#f8f8f8;border:1px solid #e8e8e8;border-radius:8px;padding:16px 20px;word-break:break-all;font-size:14px;color:#333;line-height:1.6;">${opts.activationCode}</div>
        </td></tr>
        <!-- ICCID -->
        <tr><td style="padding:16px 40px 0;">
          <p style="margin:0;font-size:13px;color:#999;">ICCID：${opts.iccid}</p>
        </td></tr>
        <!-- 使用说明 -->
        <tr><td style="padding:24px 40px 0;">
          <p style="margin:0 0 12px;font-size:14px;color:#666;font-weight:600;">📋 激活步骤</p>
          <ol style="margin:0;padding-left:20px;font-size:13px;color:#666;line-height:2;">
            <li>打开手机「设置 → 蜂窝网络（或移动网络）」</li>
            <li>点击「添加 eSIM」或「添加蜂窝号码」</li>
            <li>选择「使用二维码」，扫描上方二维码</li>
            <li>或选择「手动输入」，粘贴上方激活码</li>
            <li>开启该 eSIM 的数据漫游即可使用</li>
          </ol>
        </td></tr>
        <!-- 底部 -->
        <tr><td style="padding:32px 40px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#bbb;">如有疑问请联系客服 · YYeSim</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `您的 eSIM 已就绪

订单号：${opts.orderNo}
套餐：${opts.countryName} · ${opts.gb}GB · ${opts.days}天
有效期至：${expireStr}

激活码（LPA）：
${opts.activationCode}

ICCID：${opts.iccid}

激活步骤：
1. 打开手机「设置 → 蜂窝网络」
2. 点击「添加 eSIM」
3. 选择「使用二维码」或「手动输入激活码」
4. 开启数据漫游即可使用

如有疑问请联系客服 · YYeSim`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to: opts.to,
    subject: `【YYeSim】您的 eSIM 已就绪 - ${opts.countryName} ${opts.gb}GB/${opts.days}天`,
    html,
    text,
  });

  console.log(`[email] 激活码邮件已发送至 ${opts.to}（订单 ${opts.orderNo}）`);
}
