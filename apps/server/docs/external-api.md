# YYeSim 对外开放支付 API 文档

> 版本：v1　|　更新日期：2026-09-15　|　适用于：外部配套项目（合作方系统）接入 eSIM 购买与支付

本文档描述 YYeSim eSIM 平台对外开放的支付接口。合作方系统通过本组接口即可完成
**查询套餐 → 创建订单 → H5 支付宝支付 → 支付结果回调（Webhook）→ 查询订单/激活码** 的完整链路，
无需接入本系统的小程序登录态。

| 项目 | 说明 |
|---|---|
| 服务地址 | `https://www.bjyyxx.com`（以实际部署域名为准） |
| 支付接口前缀 | `/api/external`（**需 HMAC 签名鉴权**） |
| 套餐查询前缀 | `/api/packages`（**公开，无需鉴权**） |
| 数据格式 | JSON（UTF-8） |
| 支付渠道 | 支付宝 H5 网页支付（`alipay.trade.wap.pay`） |
| 结算币种 | 人民币 CNY |

---

## 目录

1. [接入准备](#1-接入准备)
2. [鉴权（HMAC-SHA256 签名）](#2-鉴权hmac-sha256-签名)
3. [获取套餐 pkgId](#3-获取套餐-pkgid公开接口)
4. [支付接口列表](#4-支付接口列表需鉴权)
5. [Webhook 支付成功回调](#5-webhook-支付成功回调)
6. [字段字典（状态与金额）](#6-字段字典状态与金额)
7. [重试与幂等](#7-重试与幂等)
8. [错误码表](#8-错误码表)
9. [支付流程时序](#9-支付流程时序)
10. [管理端接口（应用凭据管理）](#10-管理端接口应用凭据管理)
11. [接入检查清单与安全建议](#11-接入检查清单与安全建议)

---

## 1. 接入准备

### 1.1 获取应用凭据

由 YYeSim 管理员在管理后台「外部应用」页面创建应用（或调用 `POST /api/admin/external-apps`），创建成功后得到一对凭据：

| 凭据 | 说明 |
|---|---|
| **AppId** | 应用唯一标识（Hex 字符串），随每个请求的 `X-App-Id` 头发送 |
| **AppSecret** | 签名密钥，**仅在创建 / 重置时返回一次**，请立即保存；泄露后请立即重置 |

> 每个外部应用会自动关联一个内部合成用户（内部标识 `ext_<appId>`），该应用创建的所有订单都归属此用户，
> 便于后台按应用维度统计与管理。

### 1.2 配置回调地址（Webhook）

创建应用时可填写 **callbackUrl**（必须以 `http(s)://` 开头）。支付成功后本系统会向该地址 POST 一条
`order.paid` 事件，失败会自动退避重试（见 [第 5 节](#5-webhook-支付成功回调)）。

---

## 2. 鉴权（HMAC-SHA256 签名）

所有 `/api/external/*` 接口**必须**携带以下 4 个请求头：

| Header | 必填 | 说明 |
|---|---|---|
| `X-App-Id` | 是 | 应用 AppId |
| `X-Timestamp` | 是 | **毫秒**时间戳（`Date.now()`），与服务器时间差须在 **±5 分钟**以内 |
| `X-Nonce` | 是 | 随机串（建议 16 字节 hex），**5 分钟内不可重复**（防重放） |
| `X-Sign` | 是 | 签名，算法见下 |

### 2.1 签名算法

```
签名字符串 = appId + "\n" + timestamp + "\n" + nonce + "\n" + rawBody
X-Sign     = hex( HMAC-SHA256( appSecret, 签名字符串 ) )
```

关键要点（**踩坑高发区**）：

- `rawBody` 必须是**实际发送的原始 body 字符串**。请先序列化好字符串再计算签名，并用**同一个字符串**发送；
  不要先签名再 `JSON.stringify(obj)` 重新序列化（键顺序/空格差异会导致签名不一致）。
- **GET 等无 body 的请求**，`rawBody` 为空字符串，签名字符串以 `nonce` 后的换行结尾，即：
  `appId\ntimestamp\nnonce\n`。
- 服务端使用 `crypto.timingSafeEqual` 做等时比较，防时序攻击。
- `Content-Type` 请固定为 `application/json`，否则服务端无法取到原始 body 做验签。

### 2.2 签名与请求示例

#### Node.js（零依赖，Node 18+ 内置 fetch）

```js
import crypto from 'crypto';

const BASE_URL = 'https://www.bjyyxx.com';
const APP_ID = '你的 AppId';
const APP_SECRET = '你的 AppSecret';

function buildSign({ timestamp, nonce, rawBody }) {
  const content = `${APP_ID}\n${timestamp}\n${nonce}\n${rawBody}`;
  return crypto.createHmac('sha256', APP_SECRET).update(content, 'utf8').digest('hex');
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(16).toString('hex');
  const rawBody = body === undefined ? '' : JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': APP_ID,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Sign': buildSign({ timestamp, nonce, rawBody }),
    },
    body: body === undefined ? undefined : rawBody,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${json?.message || res.statusText}`);
  return json;
}

// 用法
const { data } = await apiRequest('/api/external/orders', {
  method: 'POST',
  body: { pkgId: '12345', email: 'user@example.com', extOrderNo: 'ORDER-001' },
});
console.log(data.payUrl);
```

#### Python（stdlib）

```python
import hashlib, hmac, json, secrets, time, urllib.request

BASE_URL = "https://www.bjyyxx.com"
APP_ID = "你的 AppId"
APP_SECRET = "你的 AppSecret"

def api_request(path: str, method: str = "GET", body=None):
    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_hex(16)
    raw_body = "" if body is None else json.dumps(body, ensure_ascii=False, separators=(",", ":"))

    content = f"{APP_ID}\n{timestamp}\n{nonce}\n{raw_body}"
    sign = hmac.new(APP_SECRET.encode(), content.encode(), hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        BASE_URL + path,
        method=method,
        data=raw_body.encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            "X-App-Id": APP_ID,
            "X-Timestamp": timestamp,
            "X-Nonce": nonce,
            "X-Sign": sign,
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

data = api_request("/api/external/orders", "POST", {
    "pkgId": "12345",
    "email": "user@example.com",
    "extOrderNo": "ORDER-001",
})["data"]
print(data["payUrl"])
```

> Python 示例使用 `separators=(",", ":")` 紧凑序列化。若改用默认 `json.dumps`（带空格）亦可，
> **只要签名与发送的字节串完全一致即可**。

#### curl 快速验证签名

```bash
APP_ID=你的AppId
APP_SECRET=你的AppSecret
TS=$(date +%s000)
NONCE=$(openssl rand -hex 16)
BODY='{"pkgId":"12345","email":"user@example.com"}'

SIGN=$(printf '%s\n%s\n%s\n%s' "$APP_ID" "$TS" "$NONCE" "$BODY" \
  | openssl dgst -sha256 -hmac "$APP_SECRET" -hex | awk '{print $NF}')

curl -s -X POST "https://www.bjyyxx.com/api/external/orders" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: $APP_ID" -H "X-Timestamp: $TS" \
  -H "X-Nonce: $NONCE" -H "X-Sign: $SIGN" \
  -d "$BODY"
```

### 2.3 常见鉴权错误

| HTTP | code | message | 原因与排查 |
|---|---|---|---|
| 401 | 401 | 缺少鉴权头（需要 X-App-Id/X-Timestamp/X-Nonce/X-Sign） | 4 个头未全部携带 |
| 401 | 401 | 时间戳无效或已超出允许范围（±5 分钟） | 客户端与服务器时钟偏差过大；`X-Timestamp` 必须是**毫秒**整数字符串 |
| 401 | 401 | 应用不存在或已被禁用 | AppId 错误，或应用已被后台停用/删除 |
| 401 | 401 | 签名校验失败 | 签名算错，**优先核对 rawBody 是否与发送内容逐字节一致**；`Content-Type` 是否为 `application/json` |
| 401 | 401 | 重复的请求（nonce 已被使用） | 同一 nonce 在 5 分钟内被重复使用，每次请求请重新生成 |
| 500 | 500 | 鉴权服务异常 | 服务端内部错误，请重试并联系技术支持 |

---

## 3. 获取套餐 pkgId（公开接口）

下单接口必填 `pkgId`，需先从套餐目录获取。套餐数据实时来自 TigerESIM，以下接口**公开、无需签名**。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/packages?countryCode=SG&all=1` | 某国家/地区的套餐列表 |
| GET | `/api/packages/search?keyword=新加坡` | 按关键词搜索（国家名/套餐名/流量/天数/覆盖地区） |
| GET | `/api/packages/catalog/all` | 全量套餐目录 |
| GET | `/api/packages/:pkgId` | 套餐详情 |
| GET | `/api/packages/min-prices` | 各国/地区最低起售价 |

**示例：查询新加坡套餐**

```
GET /api/packages?countryCode=SG&all=1
```

```json
{
  "code": 0,
  "data": {
    "packages": [
      {
        "id": "12345",
        "countryCode": "SG",
        "countryName": "新加坡",
        "countryNameEn": "Singapore",
        "gb": 3,
        "days": 7,
        "price": 29.9,
        "isUnlimited": false,
        "name": "新加坡 3GB 7天",
        "nameEn": "Singapore 3GB 7 Days",
        "tigerPkgId": 12345,
        "soldCount": 128
      }
    ]
  }
}
```

> **取值要点**：下单时的 `pkgId` 取套餐的 **`id`**（或等价的 `tigerPkgId`），例如上例传 `"12345"`。
> `price` 为展示价，实际结算金额以下单接口返回的 `totalAmount`（CNY）为准。
> 套餐价格为实时数据，建议在自有系统中缓存（如 10 分钟），下单前可做一次校验。

---

## 4. 支付接口列表（需鉴权）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/external/orders` | 创建订单 + 返回 H5 支付链接 |
| GET | `/api/external/orders/:orderNo` | 查询订单详情（含激活码） |
| GET | `/api/external/orders?extOrderNo=xxx` | 按外部订单号反查 |
| POST | `/api/external/orders/:orderNo/webhook/retry` | 手动重发支付成功回调 |
| GET | `/api/external/orders/:orderNo/return` | H5 支付后浏览器回跳（302） |

**统一响应约定：**

```
成功        HTTP 200   { "code": 0, "data": { ... } }
鉴权失败    HTTP 401   { "code": 401, "message": "..." }
业务失败    HTTP 400/404/500/502  { "code": <同 HTTP 状态码>, "message": "..." }
```

### 4.1 创建订单并发起支付

`POST /api/external/orders`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pkgId` | string | 是 | 套餐 ID（见[第 3 节](#3-获取套餐-pkgid公开接口)） |
| `email` | string | 是 | 接收 eSIM 激活码的邮箱，需为合法邮箱格式 |
| `extOrderNo` | string | 否 | 合作方自有订单号，用于对账与反查。**同一应用重复提交相同 `extOrderNo` 时幂等返回已有订单，不会重复下单** |
| `returnUrl` | string | 否 | 支付完成后浏览器回跳地址，必须为 `http(s)://` 开头；缺省回跳到本系统支付结果页 |

**请求示例：**

```json
{
  "pkgId": "12345",
  "email": "user@example.com",
  "extOrderNo": "ORDER-20260915-001",
  "returnUrl": "https://your-app.com/pay/result"
}
```

**成功响应（HTTP 200）：**

```json
{
  "code": 0,
  "data": {
    "orderNo": "DPH1726300000123",
    "extOrderNo": "ORDER-20260915-001",
    "payUrl": "https://openapi.alipay.com/gateway.do?app_id=2021...&method=alipay.trade.wap.pay&...",
    "totalAmount": "29.90",
    "paid": false
  }
}
```

| 返回字段 | 说明 |
|---|---|
| `orderNo` | 本系统订单号（`DPH` 前缀），后续查单/重发回调均使用它 |
| `extOrderNo` | 回显合作方订单号 |
| `payUrl` | 支付宝 H5 收银台链接，前端 `window.location.href = payUrl` 直接跳转即可 |
| `totalAmount` | 应付金额，**字符串，单位元、恒为 CNY**（两位小数） |
| `paid` | 订单是否已支付。为 `true` 时（幂等命中已支付订单）`payUrl` 为空 |

> 若订单已支付（幂等命中），`paid` 为 `true` 且 `payUrl` 为空，此时应直接走查单流程获取激活码。

**错误响应：**

| HTTP | code | message |
|---|---|---|
| 400 | 400 | 缺少必要参数 pkgId / email |
| 400 | 400 | email 格式不正确 |
| 400 | 400 | returnUrl 必须是 http(s):// 开头的合法地址 |
| 400 | 400 | 套餐不存在（TigerESIM 未找到该套餐） |
| 502 | 502 | Tiger 套餐获取失败：…（上游套餐服务异常，可重试） |

### 4.2 查询订单详情

`GET /api/external/orders/:orderNo`

**成功响应（HTTP 200）：**

```json
{
  "code": 0,
  "data": {
    "order": {
      "orderNo": "DPH1726300000123",
      "extOrderNo": "ORDER-20260915-001",
      "status": "paid",
      "orderType": "new",
      "pkgId": "12345",
      "countryCode": "SG",
      "pkgName": "新加坡 3GB 7天",
      "pkgNameEn": "Singapore 3GB 7 Days",
      "gb": 3,
      "days": 7,
      "isUnlimited": false,
      "price": 29.9,
      "paidAmount": 29.9,
      "paidAt": "2026-09-15T10:00:00.000Z",
      "createdAt": "2026-09-15T09:58:00.000Z",
      "webhookStatus": "success",
      "refundStatus": null,
      "refundAmount": null,
      "refundReason": null,
      "refundRejectReason": null,
      "refundRequestedAt": null,
      "refundedAt": null,
      "esim": {
        "status": "activated",
        "activatedAt": "2026-09-15T10:00:05.000Z",
        "expireAt": "2026-09-22T09:58:00.000Z",
        "used": 0.02,
        "activationCode": "LPA:1$smdp.example.com$...",
        "iccid": "8986001234567890123",
        "smdp": "smdp.example.com"
      }
    }
  }
}
```

**字段说明：**

| 字段 | 说明 |
|---|---|
| `status` | 订单状态：`pending` 待支付 / `paid` 已支付 / `refunded` 已退款 |
| `orderType` | `new` 新购 / `renew` 续费 |
| `price` | 订单金额（展示货币，见[第 6.2 节](#62-金额与货币)） |
| `paidAmount` | 实付金额；未支付为 `null` |
| `webhookStatus` | 回调状态：`none` 无 / `pending` 待发送 / `success` 已送达 / `failed` 重试耗尽 |
| `esim` | 未支付时为 `null`；已退款时 eSIM 已释放，同样为 `null` |
| `esim.used` | 已用流量，单位 **GB** |

> **敏感字段**：`activationCode` / `iccid` / `smdp` **仅在 `status=paid` 时返回**。
> 退款字段（`refundStatus` 等）未发生退款时均为 `null`。

**错误响应：**

| HTTP | code | message |
|---|---|---|
| 404 | 404 | 订单不存在 |

> 订单仅对**创建它的应用**可见，查询其他应用的订单同样返回 404。

### 4.3 按外部订单号反查

`GET /api/external/orders?extOrderNo=ORDER-20260915-001`

响应结构同 [4.2](#42-查询订单详情)。

| HTTP | code | message |
|---|---|---|
| 400 | 400 | 缺少查询参数 extOrderNo |
| 404 | 404 | 订单不存在 |

### 4.4 手动重发支付成功回调

`POST /api/external/orders/:orderNo/webhook/retry`

适用于回调多次失败进入 `failed` 状态、且回调地址已修复的场景。**立即发送一次**。

**成功响应：**

```json
{ "code": 0, "data": { "orderNo": "DPH1726300000123", "sent": true } }
```

**错误响应：**

| HTTP | code | message |
|---|---|---|
| 400 | 400 | 订单尚未支付成功，无需回调 |
| 400 | 400 | 回调发送失败，请检查回调地址后重试 / 外部应用未配置回调地址 |
| 404 | 404 | 订单不存在 |

### 4.5 H5 支付回跳

`GET /api/external/orders/:orderNo/return`

不返回 JSON，`302` 跳转到本系统 H5 支付结果页（`?orderNo=...`）。适合作为 `returnUrl` 的缺省值场景，
合作方一般无需主动调用。

> 浏览器回跳**不可作为支付成功依据**（用户可能在收银台直接关闭页面）。
> 请以 [Webhook](#5-webhook-支付成功回调) 或 [查单接口 4.2](#42-查询订单详情) 的 `status=paid` 为准。

---

## 5. Webhook 支付成功回调

支付成功且 eSIM 下发完成后，本系统向应用的 `callbackUrl` POST 一条事件。

**请求头：** 与入站鉴权相同的 4 个 Header（`X-App-Id` / `X-Timestamp` / `X-Nonce` / `X-Sign`），
签名算法完全相同（`rawBody` 即下述 payload 的原始 JSON 字符串）。

**Payload：**

```json
{
  "event": "order.paid",
  "orderNo": "DPH1726300000123",
  "extOrderNo": "ORDER-20260915-001",
  "status": "paid",
  "paidAt": "2026-09-15T10:00:00.000Z",
  "totalAmount": 29.9
}
```

| 字段 | 说明 |
|---|---|
| `event` | 事件类型，当前仅有 `order.paid` |
| `orderNo` | 本系统订单号（幂等去重主键） |
| `extOrderNo` | 合作方订单号，未传时为 `null` |
| `paidAt` | 支付完成时间（ISO 8601 / UTC） |
| `totalAmount` | 实付金额；有支付宝实付记录时为其值，否则回落订单金额（见[第 6.2 节](#62-金额与货币)） |

**接收方要求：**

1. 返回 **HTTP 2xx** 即视为送达成功；其他状态码或 **10 秒超时**均视为失败。
2. 必须按 `orderNo`（或 `extOrderNo`）做**幂等去重**——网络重试可能导致同一订单多次回调。
3. **务必校验 `X-Sign`**，防止伪造回调；并对 `X-Timestamp` 做 ±5 分钟校验防重放。
4. 回调响应体不做校验，但建议返回 `{"code":0}`。

**验签示例（Node.js）：**

```js
import crypto from 'crypto';

function verifyCallback(req) {
  const { 'x-app-id': appId, 'x-timestamp': ts, 'x-nonce': nonce, 'x-sign': sign } = req.headers;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return false;
  const content = `${appId}\n${ts}\n${nonce}\n${req.rawBody}`;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(content, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(sign).toLowerCase(), 'hex'));
}
```

> 需拿到**原始 body 字符串** `req.rawBody`（如 Express 的 `express.json({ verify })` 或 `body-parser` raw），
> 不能重新 `JSON.stringify(req.body)`。

**回调失败重试策略（退避）：**

| 尝试次数 | 触发间隔 |
|---|---|
| 1（首次） | 立即 |
| 2 | 60 秒后 |
| 3 | 5 分钟后 |
| 4 | 30 分钟后 |
| 5 | 2 小时后 |

5 次均失败后订单标记 `webhookStatus=failed`，不再自动重试；可通过 [4.4](#44-手动重发支付成功回调) 手动重发。
若应用未配置 `callbackUrl`，订单会直接置为 `failed` 而不再重试。

---

## 6. 字段字典（状态与金额）

### 6.1 状态取值

**订单状态 `order.status`**

| 值 | 含义 |
|---|---|
| `pending` | 待支付（订单已创建，未收到支付宝支付成功通知） |
| `paid` | 已支付（eSIM 已下发，可查询激活码） |
| `refunded` | 已退款（eSIM 记录已释放） |

**退款状态 `order.refundStatus`**（未发起退款时为 `null`）

| 值 | 含义 |
|---|---|
| `requested` | 已申请退款，等待处理 |
| `approved` | 退款申请已通过并完成退款 |
| `rejected` | 退款申请被拒绝（原因见 `refundRejectReason`） |

**eSIM 状态 `order.esim.status`**

| 值 | 含义 |
|---|---|
| `pending` | 未激活 |
| `activated` | 已激活 |
| `used` | 已使用 |
| `expired` | 已过期 |

### 6.2 金额与货币

本系统后台可配置「展示货币」（CNY 或 USD），支付宝仅支持人民币结算，因此存在两种金额口径，请务必区分：

| 字段 | 币种 | 说明 |
|---|---|---|
| 下单响应 `totalAmount`（字符串） | **恒为 CNY** | 实际需支付的人民币金额。展示货币为 USD 时，由后台汇率折算后四舍五入到分 |
| 订单 `price` | 展示货币（CNY 或 USD） | 下单时快照的订单金额 |
| 订单 `paidAmount` | 通常 CNY | 支付宝通知的买家实付金额 |
| Webhook `totalAmount` | 优先 CNY | 取 `paidAmount`，无实付记录时回落 `price` |

> **对账建议**：以**下单响应返回的 `totalAmount`（CNY 字符串）** 或订单 `paidAmount` 作为结算依据；
> 若展示货币为 USD，`price` 与结算金额会因汇率存在小额差异，属正常现象。

---

## 7. 重试与幂等

| 场景 | 处理方式 |
|---|---|
| 重复提交相同 `extOrderNo` | **幂等**：直接返回已有订单（用 `paid` 标记是否已支付），**不会重复下单** |
| Webhook 回调失败 | 自动退避重试 5 次（见[第 5 节](#5-webhook-支付成功回调)），仍失败可手动重发 |
| Webhook 重复送达 | 接收方须按 `orderNo` 幂等去重 |
| 网络超时后重试下单 | 请**保持 `extOrderNo` 不变**重试，服务端幂等保证不会产生第二笔订单 |
| nonce 重复 | 服务端拒绝（401）；每次请求请重新生成 nonce |

> **多实例部署提示**：nonce 防重放优先使用 Redis（配置 `REDIS_URL`）实现跨实例共享；
> 未配置 Redis 时降级为进程内存，**多实例部署下防重放仅在单实例内有效**。

---

## 8. 错误码表

| HTTP | code | 说明 |
|---|---|---|
| 200 | 0 | 成功 |
| 400 | 400 | 业务参数错误（缺参数、邮箱格式错误、returnUrl 非法、订单未支付、回调发送失败等） |
| 401 | 401 | 鉴权失败（见 [2.3](#23-常见鉴权错误)） |
| 404 | 404 | 订单/资源不存在（或不属于当前应用） |
| 500 | 500 | 服务器内部错误 |
| 502 | 502 | 上游 Tiger 套餐服务异常 |

---

## 9. 支付流程时序

```
合作方系统                      YYeSim 服务                      支付宝
    │                               │                             │
    │ GET /api/packages?countryCode │                             │
    ├──────────────────────────────►│  (公开接口，取 pkgId)         │
    │◄──────── { packages } ────────┤                             │
    │                               │                             │
    │ POST /api/external/orders     │                             │
    │ (pkgId,email,extOrderNo)      │                             │
    ├──────────────────────────────►│ 创建订单 + 生成 H5 支付链接    │
    │◄──────── { payUrl } ──────────┤                             │
    │                               │                             │
    │ 浏览器跳转 payUrl              │                             │
    ├───────────────────────────────┼────────────────────────────►│
    │                               │                             │ 用户付款
    │                               │◄────────────────────────────┤
    │                               │ POST /api/alipay/notify      │
    │                               │ 履约：置已支付 + 下发 eSIM    │
    │ 浏览器回跳 returnUrl ◄─────────┤                             │
    │                               │                             │
    │ POST callbackUrl (X-Sign)     │                             │
    │◄──────────────────────────────┤ 支付成功回调 order.paid       │
    │                               │                             │
    │ GET /api/external/orders/:no  │                             │
    ├──────────────────────────────►│                             │
    │◄──────── 订单 + 激活码 ────────┤ 查单（回调的兜底手段）        │
```

> **重要**：回调失败不阻塞主流程。即使未收到 Webhook，也可通过轮询查单接口获取支付结果与激活码。
> 建议以 Webhook 为主、查单为兜底（如支付后 30 秒内未收到回调则开始轮询，间隔 5 秒，最多 12 次）。

---

## 10. 管理端接口（应用凭据管理）

供 YYeSim 管理后台使用，**不对外部公司开放**。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/external-apps` | 应用列表（含各应用订单数） |
| POST | `/api/admin/external-apps` | 创建应用，body `{ name, callbackUrl? }`，返回 `appId`/`appSecret`（**仅此一次**） |
| DELETE | `/api/admin/external-apps/:id` | 软删除（停用鉴权，保留订单历史与合成用户） |
| POST | `/api/admin/external-apps/:id/reset-secret` | 重置密钥（新 secret **仅返回一次**，旧密钥立即失效） |

---

## 11. 接入检查清单与安全建议

**接入自检**

- [ ] 已拿到 `AppId` / `AppSecret`，且 AppSecret 已安全保存（只显示一次）
- [ ] 服务器已配置 `callbackUrl`，且公网可访问、10 秒内返回 2xx
- [ ] 签名算法已验证：用 [2.2](#22-签名与请求示例) 的示例成功调通创建订单接口
- [ ] 下单时传入了全局唯一的 `extOrderNo`（便于对账与幂等）
- [ ] Webhook 接收端已实现**签名校验**与**按 `orderNo` 幂等去重**
- [ ] 已实现查单兜底逻辑（未收到回调时主动查询）
- [ ] 已确认金额口径（结算看 `totalAmount` / `paidAmount`，CNY）

**安全建议**

- AppSecret 妥善保管，**定期重置**；不要写入客户端代码、日志或版本库。
- 仅通过 **HTTPS** 调用本 API。
- 务必校验 Webhook 的 `X-Sign` 与 `X-Timestamp`（±5 分钟），防止伪造回调与重放。
- `returnUrl` 请使用己方受信域名（服务端已限制为 `http(s)://`）。
- `extOrderNo` 建议全局唯一，避免使用连续可枚举的序号。
- 生产环境请为 YYeSim 服务配置 `REDIS_URL`，启用跨实例 nonce 防重放。

**常见问题（FAQ）**

| 现象 | 排查方向 |
|---|---|
| 一直返回「签名校验失败」 | 核对 `rawBody` 与发送内容是否逐字节一致；GET 请求 rawBody 应为空串；`Content-Type` 是否为 `application/json` |
| 「时间戳无效」 | `X-Timestamp` 必须是**毫秒**时间戳字符串，且服务器时钟偏差 ≤5 分钟 |
| 「套餐不存在」 | `pkgId` 请传套餐的 `id`/`tigerPkgId`；套餐为实时数据，可能已下架，请重新拉取目录 |
| 支付完成但一直查不到激活码 | 先确认 `status` 是否为 `paid`；eSIM 下发为异步，可稍后重试查单 |
| 未收到 Webhook | 检查回调地址公网可达性与 2xx 响应；查看订单 `webhookStatus`，`failed` 时用 [4.4](#44-手动重发支付成功回调) 重发 |
