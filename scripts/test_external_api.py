#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
线上对外开放支付 API 冒烟测试
用法: python scripts/test_external_api.py <baseUrl>
无需真实凭据即可完成鉴权链路与参数校验的验证。
"""
import hashlib, hmac, json, secrets, sys, time, urllib.request, urllib.error

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'https://www.bjyyxx.com'


def sign(app_id, app_secret, timestamp, nonce, raw_body):
    content = f"{app_id}\n{timestamp}\n{nonce}\n{raw_body}"
    return hmac.new(app_secret.encode(), content.encode(), hashlib.sha256).hexdigest()


def call(path, method='GET', body=None, app_id=None, app_secret=None,
         timestamp=None, drop_headers=()):
    """发起请求；drop_headers 用于测试缺头场景。"""
    ts = timestamp if timestamp is not None else str(int(time.time() * 1000))
    nonce = secrets.token_hex(16)
    raw = '' if body is None else json.dumps(body, ensure_ascii=False, separators=(',', ':'))

    headers = {'Content-Type': 'application/json'}
    if app_id is not None:
        for name, value in (('X-App-Id', app_id), ('X-Timestamp', ts), ('X-Nonce', nonce),
                            ('X-Sign', sign(app_id, app_secret or '', ts, nonce, raw))):
            if name not in drop_headers:
                headers[name] = value

    req = urllib.request.Request(BASE + path, method=method,
                                 data=raw.encode() if body is not None else None,
                                 headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, f'EXCEPTION: {e}'


def show(name, expected, code, text):
    try:
        msg = json.loads(text).get('message', '')
    except Exception:
        msg = ''
    ok = 'PASS' if str(expected) in str(code) else 'FAIL'
    print(f'[{ok}] {name}\n      HTTP {code} | {msg or text[:160]}')


FAKE_ID = 'smoke_test_app_000'
FAKE_SECRET = 'f' * 64

print(f'目标: {BASE}\n' + '=' * 70)

# 1. 完全不带鉴权头
show('1. 缺少鉴权头 -> 401', 401, *call('/api/external/orders', 'POST', {}, drop_headers=('X-App-Id',)))

# 2. 缺 X-Sign
show('2. 缺少 X-Sign -> 401', 401, *call('/api/external/orders', 'POST', {},
                                        app_id=FAKE_ID, app_secret=FAKE_SECRET,
                                        drop_headers=('X-Sign',)))

# 3. 带齐头但 AppId 不存在（可验证 ExternalApp 表是否已建好：500=表缺失，401=表正常）
show('3. AppId 不存在 -> 401（若返回500说明ExternalApp表未建）', 401,
     *call('/api/external/orders', 'POST', {'pkgId': '10731', 'email': 'a@b.com'},
           app_id=FAKE_ID, app_secret=FAKE_SECRET))

# 4. 时间戳超出 ±5 分钟
old = str(int(time.time() * 1000) - 10 * 60 * 1000)
show('4. 时间戳超窗 -> 401', 401,
     *call('/api/external/orders', 'POST', {'pkgId': '10731', 'email': 'a@b.com'},
           app_id=FAKE_ID, app_secret=FAKE_SECRET, timestamp=old))

# 5. GET 查单（无鉴权）
show('5. GET 查单 无鉴权 -> 401', 401, *call('/api/external/orders?extOrderNo=X'))

# 6. GET 手动重发回调（无鉴权）
show('6. POST 重发回调 无鉴权 -> 401', 401, *call('/api/external/orders/DPH123/webhook/retry', 'POST', {}))

print('=' * 70)
print('说明: 若第3项返回 500「鉴权服务异常」，说明数据库迁移未生效（ExternalApp 表缺失)。')
