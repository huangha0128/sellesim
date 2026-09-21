import nodemailer, { type SendMailOptions } from 'nodemailer';
import QRCode from 'qrcode';

/**
 * 邮件发送服务
 *
 * 样式参照 exampleemail 目录中的 TigerESIM 示例邮件（该模板经验证不易被识别为垃圾邮件）：
 * - 暖色 #fff0e8 背景 + 居中窄卡片（max-width 520px）
 * - 顶部圆角 logo、居中小黑标题、纯黑字体正文、无 emoji / 无营销渐变
 * - 订单信息用浅色嵌套表格呈现
 * - 页脚为邮箱 + 网址 + 版权（无需退订链接，减少 spam 误报）
 * - HTML 与纯文本始终成对，内容一致
 */

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

function getSenderIdentity() {
  const brand = process.env.SMTP_FROM_NAME || 'YYeSim';
  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || '';
  const replyTo = process.env.SMTP_REPLY_TO || fromAddr;
  const supportAddr = process.env.SMTP_MANAGER_ADDR || fromAddr; // 客服联系邮箱
  const siteUrl = process.env.SMTP_SITE_URL || process.env.MINIPROGRAM_HOST || '';
  const logoUrl = process.env.SMTP_LOGO_URL || '';
  return { brand, fromAddr, replyTo, supportAddr, siteUrl, logoUrl };
}

const BASE_FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro', 'Helvetica Neue', Arial, sans-serif`;

/** 订单摘要行（示例邮件同款：左标签 black、右值 black、行间浅分隔） */
function summaryRow(label: string, value: string): string {
  return `
          <tr>
            <td style="font-family:${BASE_FONT};font-size:14px;color:#000000;line-height:24px;padding:7px 12px;">
              ${label}
            </td>
            <td style="font-family:${BASE_FONT};font-size:14px;color:#000000;line-height:24px;text-align:right;word-break:break-all;padding:7px 12px;">
              ${value}
            </td>
          </tr>`;
}

/** 订单信息卡片（示例邮件同款：白底圆角内嵌表格） */
function summaryCard(rows: Array<[string, string]>): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:20px;">
        <p style="margin:0 0 12px;font-family:${BASE_FONT};font-size:14px;font-weight:700;color:#000000;line-height:24px;">Order summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tbody>
            ${rows.map(([l, v]) => summaryRow(l, v)).join('')}
          </tbody>
        </table>
      </td>
    </tr>
  </table>`;
}

/** 外层布局外壳：暖色背景 + 居中卡片 + 圆角 logo + 标题 + 页脚（完全还原示例邮件版式） */
function renderShell(opts: {
  title: string;
  titlePre?: string;
  headerSpace?: boolean;
  bodyRows: string; // 正文若干行（已拼好的 <tr> 或 <td> 内容）
  footerNote?: string; // 可选的客服提示（如 "For support or further clarification, please contact customer service:"）
}): string {
  const { brand, supportAddr, siteUrl, logoUrl } = getSenderIdentity();
  const siteLink = siteUrl
    ? `<a href="${siteUrl}" target="_blank" rel="noopener noreferrer" style="font-family:${BASE_FONT};font-size:14px;color:#333333;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>`
    : `<span style="font-family:${BASE_FONT};font-size:14px;color:#333333;">${brand}</span>`;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" width="64" height="64" alt="" style="display:block;border:0;border-radius:12.8px;"/>`
    : `<td align="center" style="width:64px;height:64px;background:#ec652b;border-radius:12.8px;display:inline-block;"><span style="font-family:${BASE_FONT};font-size:28px;font-weight:700;color:#ffffff;line-height:64px;">${brand.charAt(0)}</span></td>`;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff0e8;">
    <tbody>
      <tr>
        <td align="center" style="padding:0;">
          <table width="375" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:#fff0e8;">
            <tbody>
              <tr>
                <td align="center" style="padding:${opts.headerSpace ? '16px 24px 24px' : '48px 24px 24px'};">
                  ${logoHtml}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 24px 32px;">
                  <h1 style="margin:0;font-family:${BASE_FONT};font-size:20px;font-weight:700;color:#000000;line-height:22px;letter-spacing:0;">
                    ${opts.title}
                  </h1>
                </td>
              </tr>
              ${opts.bodyRows}
              <tr>
                <td align="center" style="padding:0 24px 16px;">
                  <p style="margin:0;font-family:${BASE_FONT};font-size:14px;font-weight:400;color:#000000;line-height:24px;">
                    For support or further clarification, please contact customer service:
                  </p>
                  <p style="margin:0;font-family:${BASE_FONT};font-size:14px;font-weight:700;color:#000000;line-height:24px;">
                    <a href="mailto:${supportAddr}" style="color:#000000;font-weight:700;text-decoration:none;">${supportAddr}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 24px 32px;">
                  ${siteLink}
                  <p style="margin:8px 0 0;font-family:${BASE_FONT};font-size:12px;font-weight:400;color:#333333;line-height:24px;">
                    &copy; ${new Date().getFullYear()} ${brand}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>`;
}

/** 生成的完整 <title> 与 <body>（Html 部分），便于统一包裹 DOCTYPE */
function wrapDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#fff0e8;">
  ${bodyHtml}
</body>
</html>`;
}

/** 发信的公共入口：设置 From / Reply-To / 主题并发送 */
async function dispatchMail(opts: { to: string; subject: string; html: string; text: string }, tag: string, orderNo: string) {
  const transporter = createTransporter();
  const { brand, fromAddr, replyTo } = getSenderIdentity();

  const mailOptions: SendMailOptions = {
    from: `"${brand}" <${fromAddr}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };
  if (replyTo) mailOptions.replyTo = replyTo;

  await transporter.sendMail(mailOptions);
  console.log(`[email] ${tag} 已发送至 ${opts.to}（订单 ${orderNo}）`);
}

/** 发卡成功：向用户发送 eSIM 激活码与二维码（对应示例邮件 "Your eSIM installation guide"） */
export async function sendEsimEmail(opts: SendEsimEmailOptions): Promise<void> {
  const qrDataUri = await generateQrDataUri(opts.activationCode);
  const expireStr = opts.expireAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const packageName = `${opts.countryName} / ${opts.gb}GB ${opts.days}day-eSIM`;

  const rows: Array<[string, string]> = [
    ['Order ID:', opts.orderNo],
    ['Product:', packageName],
    ['Qty:', '1'],
    ['ICCID:', opts.iccid],
    ['Valid until:', expireStr],
  ];

  const bodyRows = `
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-family:${BASE_FONT};font-size:14px;font-weight:700;color:#000000;line-height:24px;">Hi ${opts.to},</p>
          <p style="margin:0 0 8px;font-family:${BASE_FONT};font-size:14px;font-weight:400;color:#000000;line-height:24px;">
            Thank you for your purchase. Please find your eSIM activation information below or in the QR code.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          ${summaryCard(rows)}
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-family:${BASE_FONT};font-size:14px;font-weight:700;color:#000000;line-height:24px;">Activation code (LPA)</p>
          <p style="margin:0;font-family:monospace;font-size:13px;color:#000000;line-height:20px;word-break:break-all;">${opts.activationCode}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 24px 16px;">
          <img src="${qrDataUri}" width="200" height="200" alt="QR code" style="display:block;border:0;border-radius:8px;"/>
        </td>
      </tr>`;

  const html = wrapDocument('您的 eSIM 已就绪', renderShell({ title: 'Your eSIM installation guide', headerSpace: true, bodyRows }));

  const text = `Your eSIM installation guide

Hi ${opts.to},

Thank you for your purchase. Please find your eSIM activation information below.

Order summary
  Order ID: ${opts.orderNo}
  Product: ${packageName}
  Qty: 1
  ICCID: ${opts.iccid}
  Valid until: ${expireStr}

Activation code (LPA):
${opts.activationCode}

For support or further clarification, please contact customer service: ${process.env.SMTP_MANAGER_ADDR || process.env.SMTP_FROM || ''}`;

  await dispatchMail({ to: opts.to, subject: `Your eSIM installation guide - ${opts.orderNo}`, html, text }, '激活邮件', opts.orderNo);
}

interface SendRefundEmailOptions {
  to: string;
  orderNo: string;
  amount: string;
}

/** 订单退款成功通知（对应示例邮件 "Refund completed – Order"） */
export async function sendRefundEmail(opts: SendRefundEmailOptions): Promise<void> {
  const refundTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const rows: Array<[string, string]> = [
    ['Refund amount:', `¥${opts.amount}`],
    ['Refund time:', refundTime],
  ];

  const bodyRows = `
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-family:${BASE_FONT};font-size:14px;font-weight:400;color:#000000;line-height:24px;">
            Your refund request for order <strong>${opts.orderNo}</strong> has been updated.
          </p>
          <p style="margin:0 0 8px;font-family:${BASE_FONT};font-size:14px;color:#000000;line-height:24px;">
            Status: <strong>refunded</strong>
          </p>
          <p style="margin:0;font-family:${BASE_FONT};font-size:13px;color:#444444;line-height:22px;">
            Refund will be returned to your original payment method within 1~3 business days.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          ${summaryCard(rows)}
        </td>
      </tr>`;

  const html = wrapDocument('退款已完成', renderShell({ title: 'Refund completed', headerSpace: true, bodyRows }));

  const text = `Refund completed - Order ${opts.orderNo}

Your refund request for order ${opts.orderNo} has been updated.

Status: refunded
Refund amount: ¥${opts.amount}
Refund time: ${refundTime}

Refund will be returned to your original payment method within 1~3 business days.

For support or further clarification, please contact customer service: ${process.env.SMTP_MANAGER_ADDR || process.env.SMTP_FROM || ''}`;

  await dispatchMail({ to: opts.to, subject: `Refund completed - ${opts.orderNo}`, html, text }, '退款通知', opts.orderNo);
}

interface SendRenewEmailOptions {
  to: string;
  orderNo: string;
  countryName: string;
  gb: number; // 续费后的套餐流量
  days: number; // 续费后的套餐天数
  expireAt: Date; // 新的到期时间
}

/** 续费成功通知（对应示例邮件 "Order Confirmation" 版式） */
export async function sendRenewEmail(opts: SendRenewEmailOptions): Promise<void> {
  const expireStr = opts.expireAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const packageName = `${opts.countryName} / ${opts.gb}GB ${opts.days}day-eSIM`;

  const rows: Array<[string, string]> = [
    ['Order ID:', opts.orderNo],
    ['Product:', packageName],
    ['Qty:', '1'],
    ['Valid until:', expireStr],
  ];

  const bodyRows = `
      <tr>
        <td align="center" style="padding:0 24px 8px;">
          <p style="margin:0;font-family:${BASE_FONT};font-size:20px;font-weight:700;color:#000000;line-height:22px;">Thank you for choosing us!</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-family:${BASE_FONT};font-size:14px;font-weight:700;color:#000000;line-height:24px;">Dear ${opts.to},</p>
          <p style="margin:0;font-family:${BASE_FONT};font-size:14px;color:#000000;line-height:24px;">
            Your renewal has been activated successfully. No re-installation is needed; the new package takes effect on your current eSIM.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          ${summaryCard(rows)}
        </td>
      </tr>`;

  const html = wrapDocument('续费已生效', renderShell({ title: 'Order Confirmation', headerSpace: true, bodyRows }));

  const text = `Order Confirmation

Thank you for choosing us!

Dear ${opts.to},

Your renewal has been activated successfully. No re-installation is needed; the new package takes effect on your current eSIM.

Order summary
  Order ID: ${opts.orderNo}
  Product: ${packageName}
  Qty: 1
  Valid until: ${expireStr}

For support or further clarification, please contact customer service: ${process.env.SMTP_MANAGER_ADDR || process.env.SMTP_FROM || ''}`;

  await dispatchMail({ to: opts.to, subject: `Order Confirmation - ${opts.orderNo}`, html, text }, '续费通知', opts.orderNo);
}