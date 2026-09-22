import { readFile } from 'fs/promises';
import path from 'path';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { buildInstallGuidePdf } from './install-guide-pdf';

/**
 * 邮件发送服务
 *
 * 内容与结构参照 exampleemail 目录中的示例邮件：
 * - 正文只放简单的订单/退款信息；安装指南与激活二维码放在 PDF 附件中。
 * - 样式遵循小程序深蓝紫星空体系（apps/miniapp/src/uni.scss）：
 *   主色 #4050C0 / 文字 #1A1D3A / 页面背景 #F5F7F8 / 卡片 #FFFFFF / 分隔 #E1E8EC。
 * - 不使用 emoji、营销渐变与夸张促销用语；HTML 与纯文本始终成对且内容一致。
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

interface SendRefundEmailOptions {
  to: string;
  orderNo: string;
  amount: string;
}

interface SendRenewEmailOptions {
  to: string;
  orderNo: string;
  countryName: string;
  gb: number; // 续费后的套餐流量
  days: number; // 续费后的套餐天数
  expireAt: Date; // 新的到期时间
}

// ---- 小程序主题色 ----
const C_BRAND = '#4050C0';
const C_BRAND_LIGHT = '#E4EAFF';
const C_INK = '#1A1D3A';
const C_INK_2 = '#4A5078';
const C_BG = '#F5F7F8';
const C_LINE = '#E1E8EC';
const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif`;

const LOGO_PATH = path.resolve(process.cwd(), 'assets/logo.png');
const LOGO_CID = 'yyesim-logo';
let logoCache: Buffer | null = null;

/** 读取品牌 logo（CID 内嵌，随邮件附件发送，避免邮箱拦截外链图片） */
async function loadLogo(): Promise<Buffer | null> {
  if (logoCache) return logoCache;
  try {
    logoCache = await readFile(LOGO_PATH);
    return logoCache;
  } catch {
    return null;
  }
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

function getSenderIdentity() {
  const brand = process.env.SMTP_FROM_NAME || 'YYeSim';
  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || '';
  const replyTo = process.env.SMTP_REPLY_TO || fromAddr;
  const supportAddr = process.env.SMTP_MANAGER_ADDR || fromAddr; // 客服联系邮箱
  const siteUrl = process.env.SMTP_SITE_URL || '';
  return { brand, fromAddr, replyTo, supportAddr, siteUrl };
}

/** 订单摘要行（左标签 / 右值） */
function summaryRow(label: string, value: string): string {
  return `
        <tr>
          <td style="padding:10px 4px;border-bottom:1px solid ${C_LINE};font-size:13px;color:${C_INK_2};font-family:${FONT_STACK};white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:10px 4px;border-bottom:1px solid ${C_LINE};font-size:13px;color:${C_INK};font-family:${FONT_STACK};text-align:right;word-break:break-all;vertical-align:top;">${value}</td>
        </tr>`;
}

/** 订单摘要卡片 */
function summaryCard(title: string, rows: Array<[string, string]>): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#FFFFFF;border:1px solid ${C_LINE};border-radius:12px;padding:20px;">
    <tr>
      <td>
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${C_BRAND};font-family:${FONT_STACK};">${title}</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          ${rows.map(([l, v]) => summaryRow(l, v)).join('')}
        </table>
      </td>
    </tr>
  </table>`;
}

/**
 * 页面外壳：浅灰底 + 居中窄卡片 + 品牌 logo 块 + 标题 + 客服页脚。
 * 版式仿照示例邮件，配色使用小程序主题色。
 */
async function renderShell(opts: { title: string; bodyRows: string; logoText?: string }): Promise<string> {
  const { brand, supportAddr, siteUrl } = getSenderIdentity();
  const wordmark = opts.logoText || brand || 'YYeSim';
  const logo = await loadLogo();
  const siteLink = siteUrl
    ? `<a href="${siteUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:${C_INK_2};font-family:${FONT_STACK};text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>`
    : `<span style="font-size:12px;color:${C_INK_2};font-family:${FONT_STACK};">${brand}</span>`;

  const logoBlock = logo
    ? `<img src="cid:${LOGO_CID}" width="72" alt="${brand}" style="display:block;border:0;width:72px;height:auto;"/>`
    : `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:${C_BRAND};border-radius:12px;">
         <tr>
           <td align="center" style="padding:10px 22px;font-size:20px;font-weight:700;color:#FFFFFF;font-family:${FONT_STACK};letter-spacing:0.5px;">${wordmark}</td>
         </tr>
       </table>`;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:${C_BG};">
    <tbody>
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table width="520" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:520px;background-color:#FFFFFF;border:1px solid ${C_LINE};border-radius:16px;">
            <tbody>
              <tr>
                <td align="center" style="padding:32px 24px 8px;">
                  ${logoBlock}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:16px 24px 24px;">
                  <h1 style="margin:0;font-size:20px;font-weight:700;color:${C_INK};font-family:${FONT_STACK};line-height:1.4;">${opts.title}</h1>
                </td>
              </tr>
              ${opts.bodyRows}
              <tr>
                <td align="center" style="padding:24px;border-top:1px solid ${C_LINE};">
                  <p style="margin:0;font-size:13px;color:${C_INK_2};font-family:${FONT_STACK};line-height:1.8;">
                    如需帮助，请联系客服：
                    <a href="mailto:${supportAddr}" style="color:${C_BRAND};text-decoration:none;font-weight:600;">${supportAddr}</a>
                  </p>
                  <p style="margin:8px 0 0;font-size:12px;color:${C_INK_2};font-family:${FONT_STACK};">${siteLink}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:${C_INK_2};font-family:${FONT_STACK};">&copy; ${new Date().getFullYear()} ${brand}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>`;
}

function wrapDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${C_BG};">
  ${bodyHtml}
</body>
</html>`;
}

interface DispatchOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string; cid?: string }>;
}

/** 发送邮件：统一设置 From / Reply-To / 附件（含品牌 logo CID），并打印日志 */
async function dispatchMail(opts: DispatchOptions, tag: string, orderNo: string) {
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

  const attachments = [...(opts.attachments ?? [])];
  const logo = await loadLogo();
  if (logo) {
    attachments.push({ filename: 'logo.png', content: logo, cid: LOGO_CID, contentType: 'image/png' });
  }
  if (attachments.length) mailOptions.attachments = attachments;

  await transporter.sendMail(mailOptions);
  console.log(`[email] ${tag} 已发送至 ${opts.to}（订单 ${orderNo}）`);
}

/** 发卡成功：正文只给简要信息，安装指南（含激活二维码）放在 PDF 附件中 */
export async function sendEsimEmail(opts: SendEsimEmailOptions): Promise<void> {
  const { supportAddr, siteUrl } = getSenderIdentity();
  const expireStr = opts.expireAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const packageName = `${opts.countryName} / ${opts.gb}GB ${opts.days}day-eSIM`;

  const pdf = await buildInstallGuidePdf({
    orderNo: opts.orderNo,
    countryName: opts.countryName,
    gb: opts.gb,
    days: opts.days,
    iccid: opts.iccid,
    activationCode: opts.activationCode,
    expireAt: opts.expireAt,
    supportAddr,
    siteUrl,
  });

  const title = '您的 eSIM 安装指南';
  const bodyRows = `
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${C_INK};font-family:${FONT_STACK};">尊敬的客户：</p>
          <p style="margin:0;font-size:14px;color:${C_INK_2};font-family:${FONT_STACK};line-height:1.8;">
            感谢您的购买。您的 eSIM 安装指南与激活二维码已放在本邮件的 <strong style="color:${C_BRAND};">PDF 附件</strong> 中，请下载并按照附件步骤完成激活。
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          ${summaryCard('订单摘要', [
            ['订单号', opts.orderNo],
            ['套餐', packageName],
            ['数量', '1'],
            ['ICCID', opts.iccid],
            ['有效期至', expireStr],
          ])}
        </td>
      </tr>`;

  const text = `${title}

尊敬的客户：

感谢您的购买。您的 eSIM 安装指南与激活二维码已放在本邮件的 PDF 附件中，请下载并按照附件步骤完成激活。

订单摘要
  订单号：${opts.orderNo}
  套餐：${packageName}
  数量：1
  ICCID：${opts.iccid}
  有效期至：${expireStr}

如需帮助，请联系客服：${supportAddr}
${siteUrl ? `官网：${siteUrl}` : ''}`;

  await dispatchMail(
    {
      to: opts.to,
      subject: `${title} - ${opts.orderNo}`,
      html: wrapDocument(title, await renderShell({ title, bodyRows })),
      text,
      attachments: [
        {
          filename: `eSIM-installation-guide-${opts.orderNo}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    },
    '激活邮件',
    opts.orderNo
  );
}

/** 退款完成通知：简单几行信息（对照示例邮件 Refund completed） */
export async function sendRefundEmail(opts: SendRefundEmailOptions): Promise<void> {
  const { supportAddr } = getSenderIdentity();
  const refundTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const title = '退款已完成';
  const bodyRows = `
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-size:14px;color:${C_INK_2};font-family:${FONT_STACK};line-height:1.8;">
            您的订单 <strong style="color:${C_INK};">${opts.orderNo}</strong> 的退款申请已处理完成。
          </p>
          <p style="margin:0 0 4px;font-size:14px;color:${C_INK};font-family:${FONT_STACK};">状态：<strong style="color:${C_BRAND};">已退款</strong></p>
          <p style="margin:0;font-size:14px;color:${C_INK};font-family:${FONT_STACK};">退款金额：<strong>¥${opts.amount}</strong></p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          ${summaryCard('退款信息', [
            ['退款金额', `¥${opts.amount}`],
            ['退款时间', refundTime],
          ])}
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0;font-size:13px;color:${C_INK_2};font-family:${FONT_STACK};line-height:1.8;">退款将按原支付渠道原路退回，一般 1～3 个工作日到账。</p>
        </td>
      </tr>`;

  const text = `${title}

您的订单 ${opts.orderNo} 的退款申请已处理完成。

状态：已退款
退款金额：¥${opts.amount}
退款时间：${refundTime}

退款将按原支付渠道原路退回，一般 1～3 个工作日到账。

如需帮助，请联系客服：${supportAddr}`;

  await dispatchMail(
    {
      to: opts.to,
      subject: `${title} - ${opts.orderNo}`,
      html: wrapDocument(title, await renderShell({ title, bodyRows })),
      text,
    },
    '退款通知',
    opts.orderNo
  );
}

/** 续费生效通知（对照示例邮件 Order Confirmation） */
export async function sendRenewEmail(opts: SendRenewEmailOptions): Promise<void> {
  const { supportAddr } = getSenderIdentity();
  const expireStr = opts.expireAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const packageName = `${opts.countryName} / ${opts.gb}GB ${opts.days}day-eSIM`;

  const title = '续费已生效';
  const bodyRows = `
      <tr>
        <td style="padding:0 24px 16px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${C_INK};font-family:${FONT_STACK};">感谢您的续费！</p>
          <p style="margin:0;font-size:14px;color:${C_INK_2};font-family:${FONT_STACK};line-height:1.8;">
            您的订单 <strong style="color:${C_INK};">${opts.orderNo}</strong> 已处理完成，新套餐已生效，无需重新安装 eSIM。
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          ${summaryCard('订单摘要', [
            ['订单号', opts.orderNo],
            ['套餐', packageName],
            ['数量', '1'],
            ['有效期至', expireStr],
          ])}
        </td>
      </tr>`;

  const text = `${title}

感谢您的续费！

您的订单 ${opts.orderNo} 已处理完成，新套餐已生效，无需重新安装 eSIM。

订单摘要
  订单号：${opts.orderNo}
  套餐：${packageName}
  数量：1
  有效期至：${expireStr}

如需帮助，请联系客服：${supportAddr}`;

  await dispatchMail(
    {
      to: opts.to,
      subject: `${title} - ${opts.orderNo}`,
      html: wrapDocument(title, await renderShell({ title, bodyRows })),
      text,
    },
    '续费通知',
    opts.orderNo
  );
}
