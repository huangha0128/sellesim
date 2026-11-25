import crypto from 'crypto';
import https from 'https';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { alipay } from './alipay';

const mockResponse = vi.hoisted(() => ({ value: '' }));

vi.mock('../config', async () => {
  const { generateKeyPairSync } = await import('crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    config: {
      alipay: {
        appId: 'test-app',
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        alipayPublicKey: '',
        gateway: 'https://openapi.alipay.com/gateway.do',
      },
    },
  };
});

vi.mock('https', async () => {
  const { EventEmitter } = await import('events');
  const { PassThrough } = await import('stream');
  return {
    default: {
      request: vi.fn((_options, callback) => {
        const req = Object.assign(new EventEmitter(), {
          write: vi.fn(),
          end: () => {
            const res = new PassThrough();
            callback(res);
            const bytes = Buffer.from(mockResponse.value, 'utf8');
            const chinese = bytes.indexOf(Buffer.from('中'));
            const split = chinese < 0 ? Math.floor(bytes.length / 2) : chinese + 1;
            res.write(bytes.subarray(0, split));
            res.end(bytes.subarray(split));
          },
        });
        return req;
      }),
    },
  };
});

describe('支付宝网关请求', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('以 UTF-8 签名和编码中文退款参数，并在 URL 指定 charset', async () => {
    mockResponse.value = JSON.stringify({ error_response: { sub_msg: '中文错误' } });
    const params = alipay.buildParams('alipay.trade.refund', { refund_reason: '中文退款原因' });

    const result = await alipay.request(params);
    const request = vi.mocked(https.request);
    const [options] = request.mock.calls[0];
    const sent = request.mock.results[0].value;
    const body = new URLSearchParams(vi.mocked(sent.write).mock.calls[0][0] as string);
    const sign = body.get('sign');
    const content = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');

    expect(options).toMatchObject({
      path: '/gateway.do?charset=utf-8',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    });
    expect(body.has('charset')).toBe(false);
    expect(JSON.parse(body.get('biz_content')!)).toEqual({ refund_reason: '中文退款原因' });
    expect(sign && crypto.verify('RSA-SHA256', Buffer.from(content), crypto.createPublicKey(config.alipay.privateKey), Buffer.from(sign, 'base64'))).toBe(true);
    expect(result.error_response.sub_msg).toBe('中文错误');
  });

  it('退款返回缺少成功码时不能视为成功', async () => {
    mockResponse.value = JSON.stringify({ alipay_trade_refund_response: { msg: '结果不完整' } });
    const result = await alipay.refund('test-order', '1.00', 'test-refund');
    expect(result).toMatchObject({ code: 'FAIL', msg: '结果不完整' });
  });
});
