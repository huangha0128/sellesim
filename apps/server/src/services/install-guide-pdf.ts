import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';

/**
 * eSIM 安装指南 PDF 生成
 * - 使用内置 simhei.ttf 支持中文（打包进 Docker 镜像，路径基于运行时 cwd）
 * - 样式遵循小程序深蓝紫星空体系：主色 #4050C0 / 文字 #1A1D3A / 背景 #F5F7F8 / 分隔 #E1E8EC
 */

const FONT_PATH = path.resolve(process.cwd(), 'assets/fonts/simhei.ttf');
const LOGO_PATH = path.resolve(process.cwd(), 'assets/logo.png');

// 小程序主题色（与 apps/miniapp/src/uni.scss 一致）
const C_BRAND = rgb(0.251, 0.314, 0.753); // #4050C0
const C_BRAND_LIGHT = rgb(0.894, 0.918, 1.0); // #E4EAFF
const C_INK = rgb(0.102, 0.114, 0.227); // #1A1D3A
const C_INK_2 = rgb(0.29, 0.314, 0.471); // #4A5078
const C_LINE = rgb(0.882, 0.91, 0.925); // #E1E8EC
const C_WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

export interface InstallGuidePdfParams {
  orderNo: string;
  countryName: string;
  gb: number;
  days: number;
  iccid: string;
  activationCode: string;
  expireAt: Date;
  supportAddr: string;
  siteUrl: string;
}

/** 按最大宽度折行（中文按字符切分） */
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const seg of text.split('\n')) {
    let line = '';
    for (const ch of seg) {
      if (line && font.widthOfTextAtSize(line + ch, size) > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  color = C_INK,
  lineGap = 6
): number {
  const lines = wrapText(font, text, size, maxWidth);
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + lineGap;
  }
  return cursor;
}

/** 生成安装指南 PDF（含激活二维码与激活码） */
export async function buildInstallGuidePdf(params: InstallGuidePdfParams): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = await readFile(FONT_PATH);
  const font = await pdfDoc.embedFont(fontBytes);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // ---------- 页头：品牌蓝带 + 真实 logo ----------
  page.drawRectangle({ x: 0, y: PAGE_H - 100, width: PAGE_W, height: 100, color: C_BRAND });
  const logoPng = await pdfDoc.embedPng(await readFile(LOGO_PATH));
  const logoH = 52;
  const logoW = (logoPng.width / logoPng.height) * logoH;
  const logoX = MARGIN;
  const logoY = PAGE_H - 78;
  page.drawImage(logoPng, { x: logoX, y: logoY, width: logoW, height: logoH });
  const titleX = logoX + logoW + 14;
  page.drawText('YYeSim', {
    x: titleX,
    y: PAGE_H - 64,
    size: 24,
    font,
    color: C_WHITE,
  });
  page.drawText('eSIM 安装指南', {
    x: titleX,
    y: PAGE_H - 92,
    size: 13,
    font,
    color: C_WHITE,
  });

  let y = PAGE_H - 160;

  // ---------- 引言 ----------
  y = drawWrappedText(
    page,
    font,
    `尊敬的客户，感谢您购买 YYeSim eSIM 服务。请在下方查看套餐信息，并按「安装步骤」完成激活。`,
    12,
    MARGIN,
    y,
    PAGE_W - MARGIN * 2,
    C_INK_2,
    6
  );
  y -= 8;

  // ---------- 套餐信息表 ----------
  const tableTop = y;
  const tableBottom = tableTop - 132;
  page.drawRectangle({
    x: MARGIN,
    y: tableBottom,
    width: PAGE_W - MARGIN * 2,
    height: tableTop - tableBottom,
    color: C_BRAND_LIGHT,
  });

  const rows: Array<[string, string]> = [
    ['订单号', params.orderNo],
    ['套餐', `${params.countryName} / ${params.gb}GB ${params.days}day-eSIM`],
    ['ICCID', params.iccid],
    ['有效期至', params.expireAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })],
  ];
  let ry = tableTop - 28;
  for (const [label, value] of rows) {
    page.drawText(label, { x: MARGIN + 16, y: ry - 4, size: 11, font, color: C_INK_2 });
    ry = drawWrappedText(page, font, value, 11, MARGIN + 120, ry, PAGE_W - MARGIN * 2 - 150, C_INK, 4);
    ry -= 14;
  }
  y = tableBottom - 24;

  // ---------- 激活码 ----------
  y = drawWrappedText(page, font, '激活码（LPA）', 13, MARGIN, y, PAGE_W - MARGIN * 2, C_BRAND, 6);
  y -= 4;
  y = drawWrappedText(page, font, params.activationCode, 12, MARGIN, y, PAGE_W - MARGIN * 2, C_INK, 4);
  y -= 20;

  // ---------- 激活二维码 ----------
  const qrDataUri = await QRCode.toDataURL(params.activationCode, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
  const qrPng = await pdfDoc.embedPng(Buffer.from(qrDataUri.split(',')[1], 'base64'));
  const qrSize = 168;
  const qrX = (PAGE_W - qrSize) / 2;
  const qrY = y - qrSize;
  page.drawImage(qrPng, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawRectangle({ x: qrX, y: qrY, width: qrSize, height: qrSize, borderColor: C_LINE, borderWidth: 1 });
  page.drawText('扫描二维码即可快速激活', {
    x: (PAGE_W - font.widthOfTextAtSize('扫描二维码即可快速激活', 10)) / 2,
    y: qrY - 16,
    size: 10,
    font,
    color: C_INK_2,
  });
  y = qrY - 36;

  // ---------- 安装步骤 ----------
  y = drawWrappedText(page, font, '安装步骤', 13, MARGIN, y, PAGE_W - MARGIN * 2, C_BRAND, 6);
  y -= 4;
  const steps = [
    '1. 打开手机「设置」→「蜂窝网络 / 移动网络」。',
    '2. 点击「添加 eSIM / 添加蜂窝号码」。',
    '3. 选择「使用二维码」扫描上方二维码，或「手动输入」粘贴激活码。',
    '4. 添加完成后为该号码开启「数据漫游」，即可正常使用流量。',
  ];
  for (const step of steps) {
    y = drawWrappedText(page, font, step, 11, MARGIN, y, PAGE_W - MARGIN * 2, C_INK_2, 5);
    y -= 6;
  }

  // ---------- 页脚 ----------
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 84, color: C_BRAND_LIGHT });
  const footerTexts = [
    `客服邮箱：${params.supportAddr}`,
    params.siteUrl ? `官网：${params.siteUrl}` : '',
    `© ${new Date().getFullYear()} YYeSim`,
  ].filter(Boolean);
  drawWrappedText(page, font, footerTexts.join('    '), 10, MARGIN, 52, PAGE_W - MARGIN * 2, C_INK_2, 6);

  return Buffer.from(await pdfDoc.save());
}
