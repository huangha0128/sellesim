import crypto from 'crypto';

/**
 * 外部开放支付 API 的 HMAC-SHA256 签名工具。
 *
 * 签名约定（入站请求与出站 webhook 回调通用）：
 *   签名字符串 = appId + '\n' + timestamp + '\n' + nonce + '\n' + rawBody
 *   其中 rawBody 为请求原始 body 字符串；GET 等无 body 请求为空字符串，
 *   即签名字符串以 nonce 后的换行结尾。
 *   X-Sign = hex(HMAC-SHA256(appSecret, 签名字符串))
 */

/** 拼接签名字符串 */
export function signContent(appId: string, timestamp: string, nonce: string, rawBody: string): string {
  return `${appId}\n${timestamp}\n${nonce}\n${rawBody}`;
}

/** 计算签名（hex 编码） */
export function hmacSign(secret: string, content: string): string {
  return crypto.createHmac('sha256', secret).update(content, 'utf8').digest('hex');
}

/** 校验签名（timingSafeEqual 防时序攻击）；签名格式非法时直接返回 false */
export function hmacVerify(secret: string, content: string, signature: string): boolean {
  if (!signature || !/^[0-9a-fA-F]{64}$/.test(signature)) return false;
  const expected = Buffer.from(hmacSign(secret, content), 'hex');
  const actual = Buffer.from(signature.toLowerCase(), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** 生成随机 AppSecret（32 字节 hex） */
export function genAppSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** 生成随机 nonce（16 字节 hex） */
export function genNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
