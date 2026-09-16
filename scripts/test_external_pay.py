#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
线上对外开放支付 API 全链路测试（需提供已创建的外部应用凭据）
用法: python scripts/test_external_pay.py <baseUrl> <appId> <appSecret>
"""
import hashlib, hmac, json, secrets, sys, time, urllib.request, urllib.error

BASE = sys.argv[1].rstrip('/')
APP_ID = sys.argv[2]
APP_SECRET = sys.argv[3]
PKG_ID = '10731'          # PTR-SGT-1GB-1DAY, price=7
EMAIL = 'smoke-test@example.com'


def sign(ts, nonce, raw):
    return hmac.new(APP_SECRET.encode(), f"{APP_ID}\n{ts}\n{nonce}\n{raw}".encode(),
                    hashlib.sha256).hexdigest()


def call(path, method='GET', body=None, nonce=None, ts=None, bad_sign=False):
    ts = ts or str(int(time.time() * 1000))
    nonce = nonce or secrets.token_hex(16)
    raw = '' if body is None else json.dumps(body, ensure_ascii=False, separators=(',', ':'))
    sg = '0' * 64 if bad_sign else sign(ts, nonce, raw)
    req = urllib.request.Request(
        BASE + path, method=method,
        data=raw.encode() if body is not None else None,
        headers={'Content-Type': 'application/json', 'X-App-Id': APP_ID,
                 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Sign': sg})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, json.loads(r.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8', 'replace'))
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {'message': f'EXCEPTION {e}'}


results = []


def check(name, cond, detail=''):
    results.append(cond)
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f"\n      {detail}" if detail else ''))


print(f'目标 {BASE}  应用 {APP_ID}\n' + '=' * 72)

# ---- 1. 创建订单 ----
ext_no = 'SMOKE-' + str(int(time.time()))
c1, r1 = call('/api/external/orders', 'POST',
              {'pkgId': PKG_ID, 'email': EMAIL, 'extOrderNo': ext_no})
d1 = r1.get('data', {})
order_no = d1.get('orderNo')
check('1. 创建订单 -> 200 + payUrl', c1 == 200 and bool(d1.get('payUrl')),
      f"orderNo={order_no} totalAmount={d1.get('totalAmount')} paid={d1.get('paid')}")
check('   payUrl 为支付宝 gateway', 'openapi.alipay.com' in str(d1.get('payUrl', '')),
      str(d1.get('payUrl', ''))[:90] + '...')
check('   totalAmount 为 CNY 两位小数字符串',
      isinstance(d1.get('totalAmount'), str) and len(d1['totalAmount'].split('.')[-1]) == 2)

# ---- 2. 幂等 ----
c2, r2 = call('/api/external/orders', 'POST',
              {'pkgId': PKG_ID, 'email': EMAIL, 'extOrderNo': ext_no})
check('2. 相同 extOrderNo 幂等 -> 同一订单', c2 == 200 and r2.get('data', {}).get('orderNo') == order_no,
      f"第二次 orderNo={r2.get('data', {}).get('orderNo')}")

# ---- 3. 参数校验 ----
c3, r3 = call('/api/external/orders', 'POST', {'pkgId': PKG_ID, 'email': 'not-an-email'})
check('3. 非法 email -> 400', c3 == 400, f"{c3} {r3.get('message')}")

c4, r4 = call('/api/external/orders', 'POST',
              {'pkgId': PKG_ID, 'email': EMAIL, 'returnUrl': 'javascript:alert(1)'})
check('4. 非法 returnUrl -> 400（防开放重定向）', c4 == 400, f"{c4} {r4.get('message')}")

c5, r5 = call('/api/external/orders', 'POST', {'pkgId': 'NO_SUCH_PKG', 'email': EMAIL})
check('5. 不存在套餐 -> 400', c5 == 400, f"{c5} {r5.get('message')}")

c6, r6 = call('/api/external/orders', 'POST', {'email': EMAIL})
check('6. 缺 pkgId -> 400', c6 == 400, f"{c6} {r6.get('message')}")

# ---- 4. 签名/重放 ----
c7, r7 = call('/api/external/orders', 'POST', {'pkgId': PKG_ID, 'email': EMAIL}, bad_sign=True)
check('7. 错误签名 -> 401', c7 == 401, f"{c7} {r7.get('message')}")

fixed_nonce = secrets.token_hex(16)
call('/api/external/orders', 'POST', {'pkgId': PKG_ID, 'email': EMAIL}, nonce=fixed_nonce)
c8, r8 = call('/api/external/orders', 'POST', {'pkgId': PKG_ID, 'email': EMAIL}, nonce=fixed_nonce)
check('8. nonce 重放 -> 401', c8 == 401, f"{c8} {r8.get('message')}")

# ---- 5. 查单 ----
c9, r9 = call(f'/api/external/orders/{order_no}')
o = r9.get('data', {}).get('order', {})
check('9. 按 orderNo 查单 -> 200', c9 == 200 and o.get('orderNo') == order_no,
      f"status={o.get('status')} price={o.get('price')} webhookStatus={o.get('webhookStatus')}")
refund_fields = ['refundStatus', 'refundAmount', 'refundReason', 'refundRejectReason',
                 'refundRequestedAt', 'refundedAt']
missing = [f for f in refund_fields if f not in o]
check('10. 订单含新增退款字段', not missing, f"缺失字段={missing or '无'}")

c11, r11 = call(f'/api/external/orders?extOrderNo={ext_no}')
check('11. 按 extOrderNo 反查 -> 同一订单',
      c11 == 200 and r11.get('data', {}).get('order', {}).get('orderNo') == order_no)

c12, r12 = call('/api/external/orders/DPH_NOT_EXIST_000')
check('12. 不存在订单 -> 404', c12 == 404, f"{c12} {r12.get('message')}")

c13, r13 = call(f'/api/external/orders/{order_no}/webhook/retry', 'POST', {})
check('13. 未支付订单重发回调 -> 400', c13 == 400, f"{c13} {r13.get('message')}")

c14, r14 = call('/api/external/orders')
check('14. 查单缺 extOrderNo -> 400', c14 == 400, f"{c14} {r14.get('message')}")

print('=' * 72)
print(f'结果: {sum(results)}/{len(results)} 通过')
