import { describe, it, expect } from 'vitest';
import { signContent, hmacSign, hmacVerify, genAppSecret, genNonce } from './hmac';

const APP_ID = 'test-app-123';
const SECRET = genAppSecret();

describe('hmac 签名工具', () => {
  it('genAppSecret / genNonce 生成随机且长度正确的值', () => {
    const s1 = genAppSecret();
    const s2 = genAppSecret();
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect(s1).not.toBe(s2);
    expect(genNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('正确签名可通过校验（含 GET 空 body）', () => {
    const ts = String(Date.now());
    const nonce = genNonce();
    // POST：有 body
    const body = JSON.stringify({ pkgId: '123', email: 'a@b.com' });
    const content = signContent(APP_ID, ts, nonce, body);
    const sign = hmacSign(SECRET, content);
    expect(hmacVerify(SECRET, content, sign)).toBe(true);

    // GET：无 body，签名串以 nonce 后的换行结尾
    const contentEmpty = signContent(APP_ID, ts, nonce, '');
    const signEmpty = hmacSign(SECRET, contentEmpty);
    expect(hmacVerify(SECRET, contentEmpty, signEmpty)).toBe(true);
  });

  it('body 被篡改后验签失败', () => {
    const ts = String(Date.now());
    const nonce = genNonce();
    const body = '{"pkgId":"123"}';
    const content = signContent(APP_ID, ts, nonce, body);
    const sign = hmacSign(SECRET, content);
    const tampered = signContent(APP_ID, ts, nonce, '{"pkgId":"999"}');
    expect(hmacVerify(SECRET, tampered, sign)).toBe(false);
  });

  it('appSecret 错误 / 时间戳 / nonce 任一变化均验签失败', () => {
    const ts = String(Date.now());
    const nonce = genNonce();
    const body = 'hello';
    const content = signContent(APP_ID, ts, nonce, body);
    const sign = hmacSign(SECRET, content);

    expect(hmacVerify('wrong-secret', content, sign)).toBe(false);
    expect(hmacVerify(SECRET, signContent(APP_ID, String(Number(ts) + 1), nonce, body), sign)).toBe(false);
    expect(hmacVerify(SECRET, signContent(APP_ID, ts, 'another-nonce', body), sign)).toBe(false);
  });

  it('非法格式签名直接拒绝（防时序攻击路径不触发）', () => {
    const ts = String(Date.now());
    const nonce = genNonce();
    const content = signContent(APP_ID, ts, nonce, 'x');
    expect(hmacVerify(SECRET, content, '')).toBe(false);
    expect(hmacVerify(SECRET, content, 'abc')).toBe(false);
    expect(hmacVerify(SECRET, content, 'Z'.repeat(64))).toBe(false); // 非 hex 字符
  });

  it('大小写签名等价（hex 不区分大小写）', () => {
    const ts = String(Date.now());
    const nonce = genNonce();
    const content = signContent(APP_ID, ts, nonce, 'y');
    const sign = hmacSign(SECRET, content);
    expect(hmacVerify(SECRET, content, sign.toUpperCase())).toBe(true);
  });
});
