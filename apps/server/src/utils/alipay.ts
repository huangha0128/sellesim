import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';
import { config } from '../config';

const ALIPAY_APP_ID = config.alipay.appId;
const ALIPAY_PRIVATE_KEY = normalizePrivateKey(config.alipay.privateKey);
const ALIPAY_PUBLIC_KEY = config.alipay.alipayPublicKey
  ? normalizePublicKey(config.alipay.alipayPublicKey)
  : '';

function normalizePrivateKey(key: string): string {
  if (key.includes('-----BEGIN')) return key;
  return `-----BEGIN PRIVATE KEY-----\n${key.replace(/\s+/g, '')}\n-----END PRIVATE KEY-----`;
}

function normalizePublicKey(key: string): string {
  if (key.includes('-----BEGIN')) return key;
  return `-----BEGIN PUBLIC KEY-----\n${key.replace(/\s+/g, '')}\n-----END PUBLIC KEY-----`;
}

function buildParams(method: string, bizContent: Record<string, any>, extraParams?: Record<string, string>): Record<string, string> {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const params: Record<string, string> = {
    app_id: ALIPAY_APP_ID,
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp,
    version: '1.0',
    biz_content: JSON.stringify(bizContent),
    ...extraParams,
  };
  return params;
}

function sign(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const signContent = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signContent);
  return signer.sign(ALIPAY_PRIVATE_KEY, 'base64');
}

function verifySign(params: Record<string, string>, signature: string): boolean {
  if (!ALIPAY_PUBLIC_KEY) return true;
  const sortedKeys = Object.keys(params).sort();
  const signContent = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signContent);
  return verifier.verify(ALIPAY_PUBLIC_KEY, signature, 'base64');
}

function request(params: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const signStr = sign(params);
    const postData = querystring.stringify({ ...params, sign: signStr });

    const options = {
      hostname: 'openapi.alipay.com',
      port: 443,
      path: '/gateway.do',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function buildPaymentUrl(
  outTradeNo: string,
  subject: string,
  totalAmount: string,
  notifyUrl: string,
  returnUrl: string,
  passbackParams?: string,
): string {
  const bizContent: Record<string, any> = {
    subject,
    out_trade_no: outTradeNo,
    total_amount: totalAmount,
    product_code: 'QUICK_WAP_WAY',
  };
  if (passbackParams) {
    bizContent.passback_params = encodeURIComponent(passbackParams);
  }

  const params = buildParams('alipay.trade.wap.pay', bizContent, {
    notify_url: notifyUrl,
    return_url: returnUrl,
  });

  const signStr = sign(params);
  params.sign = signStr;

  return `https://openapi.alipay.com/gateway.do?${querystring.stringify(params)}`;
}

async function createTradeNo(
  outTradeNo: string,
  subject: string,
  totalAmount: string,
  notifyUrl: string,
): Promise<string> {
  const bizContent: Record<string, any> = {
    subject,
    out_trade_no: outTradeNo,
    total_amount: totalAmount,
    product_code: 'QUICK_MSECURITY_PAY',
  };

  const params = buildParams('alipay.trade.create', bizContent, {
    notify_url: notifyUrl,
  });

  const result = await request(params);
  const response = result.alipay_trade_create_response;

  if (!response || (response.code && response.code !== '10000')) {
    throw new Error(`支付宝创建交易失败: ${response?.sub_msg || response?.msg || '未知错误'}`);
  }

  return response.trade_no;
}

async function refund(
  outTradeNo: string,
  refundAmount: string,
  outRequestNo: string,
  refundReason?: string,
): Promise<{ code: string; msg: string; subMsg?: string; tradeNo?: string }> {
  const bizContent: Record<string, any> = {
    out_trade_no: outTradeNo,
    refund_amount: refundAmount,
    out_request_no: outRequestNo,
  };
  if (refundReason) {
    bizContent.refund_reason = refundReason;
  }

  const params = buildParams('alipay.trade.refund', bizContent);
  const result = await request(params);
  const response = result.alipay_trade_refund_response;

  return {
    code: response?.code || '10000',
    msg: response?.sub_msg || response?.msg || '',
    subMsg: response?.sub_msg,
    tradeNo: response?.trade_no || outTradeNo,
  };
}

export const alipay = {
  sign,
  verifySign,
  request,
  buildPaymentUrl,
  createTradeNo,
  buildParams,
  refund,
};