# YYeSim 开放平台 API 设计方案（v2）

> 状态：P1–P5 完成（P5 含 ExternalApp 迁移脚本 + /api/external 兼容转调，未下线）　|　日期：2026-09-16
> 目标：把"套餐查询 → 下单 → 支付 → 退款"整条链路封装为对外开放 API，
> 支持**多个个人主体**以 **API Key** 接入，各自独立定价、数据隔离、自助退款。

---

## 1. 为什么要重做

现有 `/api/external` 的定位是"单应用支付外放"，存在三个结构性限制：

| 限制 | 说明 |
|---|---|
| 只有支付 | 套餐目录、退款都需要走别的入口，主体无法自助完成闭环 |
| 无主体概念 | `ExternalApp` 是"应用"不是"接入方"，一个主体开多个环境（测试/生产）就无法表达 |
| 无定价体系 | 所有接入方同价，无法做分销加价 |

新设计引入**主体（Subject）**作为一等公民，把整条链路收敛到 `/api/open/v1` 一个命名空间。

已确认的五个决策：

1. **资金**：实时支付（沿用现有支付宝链路，主体不碰资金，不做账户体系）
2. **定价**：可独立定价，**默认使用平台价格**
3. **退款**：主体自助退款（仅未激活订单），无需后台审批
4. **凭证**：API Key + 签名双模（读用 Key，写额外签名）
5. **开户**：主体与密钥**只能由平台后台创建**，不提供自助注册（本次新增）

---

## 2. 核心概念

### 2.1 主体（Subject）

一个个接入的个人主体 / 分销方。一个主体可以有多把密钥、一套独立定价、一批独立订单。

> **主体只能由平台在管理后台创建，不提供自助注册接口。** 接入方拿到的是后台发放的
> `keyId` + `keySecret`，自己无法申请、无法改价、无法自助解绑。
> 这样省掉了注册审核流程，凭证的发放与回收完全掌握在平台侧。

| 字段 | 说明 |
|---|---|
| `name` | 主体名称 |
| `status` | `active` / `suspended`（停用后所有密钥立即失效） |
| `callbackUrl` | Webhook 回调地址（主体级，不再放在密钥上） |
| `defaultMarkupPercent` | 可选，主体级默认加价比例（未配单独套餐价时生效） |
| `userId` | 关联的内部合成用户（用于后台订单归集，同现有 `ext_xxx` 思路） |

创建主体时后台自动完成三件事：生成合成用户、写入主体记录、**自动生成第一把 `live` 密钥**。

### 2.2 API Key（密钥）

每个主体可有多把（如 `live` / `test`、或按渠道分）。

| 字段 | 说明 |
|---|---|
| `keyId` | 公开标识，如 `ak_live_7f3a9c21`，随 `X-Api-Key` 头发送 |
| `keySecret` | 签名密钥，64 位 hex，**仅创建时返回一次**，永不传输 |
| `mode` | `live` / `test` |
| `ipWhitelist` | 可选，逗号分隔 |
| `enabled` / `expiresAt` / `lastUsedAt` | 生命周期 |

**生命周期完全由后台管理，无自助入口**：

| 操作 | 说明 |
|---|---|
| 自动发放 | 创建主体时自动生成一把 `live` 密钥 |
| 追加 | 后台可再加 `test` 密钥或按渠道加 `live` 密钥 |
| 吊销 | `enabled=false`，立即失效（保留记录与历史订单） |
| 轮换 | 重置 `keySecret`，**旧 secret 立即失效**，新 secret 仅返回一次 |

两点实现注意：

1. `keySecret` **必须明文存储**。HMAC 验签需要用原始密钥重算签名，无法像口令那样只存哈希
   （现有 `ExternalApp.appSecret` 也是明文，一致）。因此数据库访问权等同于密钥权，
   生产库的访问控制和备份加密要跟上。
2. `keySecret` **仅在创建/轮换时返回一次**，后续接口只返回脱敏显示（如 `ak_live_7f3a…c21`）。
   若接入方丢失，只能走轮换，无法找回。

### 2.3 主体套餐定价（SubjectPackagePrice）

可选的套餐级覆盖，缺省回落平台价，满足"可独立定价、默认平台价"。

| 字段 | 说明 |
|---|---|
| `pkgId` | 套餐 ID（Tiger） |
| `price` | 固定售价（优先） |
| `markupPercent` | 加价比例（次之，基于平台价） |
| `enabled` | 是否对该主体开放（false = 该主体看不到此套餐） |

---

## 3. 鉴权设计（双模）

### 3.1 请求头

| 头 | 读操作 | 写操作 | 说明 |
|---|---|---|---|
| `X-Api-Key` | 必填 | 必填 | `ak_live_xxx`，标识主体与密钥 |
| `X-Timestamp` | — | 必填 | 毫秒时间戳，±5 分钟 |
| `X-Nonce` | — | 必填 | 随机串，5 分钟防重放 |
| `X-Sign` | — | 必填 | 见下 |

写操作 = `POST /orders`、`POST /orders/{no}/refunds`、以及任何会产生资金/资源变更的接口。

### 3.2 签名算法

```
签名串 = keyId + "\n" + timestamp + "\n" + nonce + "\n" + rawBody
X-Sign  = hex( HMAC-SHA256( keySecret, 签名串 ) )
```

`rawBody` 为请求原始 body 字符串，与现有 `/api/external` 约定完全一致（可复用 `utils/hmac.ts`）。

### 3.3 为什么要双模

**关键安全收益**：`keyId` 本身只能读。即使泄露（前端代码、日志、抓包），攻击者也无法下单或退款——因为写操作需要 `keySecret` 签名，而 `keySecret` 从不出现在请求里。

纯 API Key 方案一旦泄露即可任意下单；纯签名方案对接成本高。双模在两者间取平衡。

### 3.4 校验顺序

```
1. X-Api-Key 是否存在 → 401
2. 查 ApiKey（含 enabled / expiresAt）→ 401
3. 查 Subject（status=active）→ 401
4. IP 白名单（若配置）→ 403
5. 写操作：校验 timestamp / nonce / X-Sign → 401
6. 限流（Redis 计数）→ 429
7. 注入 req.subject / req.apiKey，放行
```

---

## 4. 数据模型变更

```prisma
// 接入主体（一个个人主体 = 一条记录）
model Subject {
  id                   String   @id @default(uuid())
  name                 String
  status               String   @default("active")   // active | suspended
  callbackUrl          String?  @map("callback_url")
  defaultMarkupPercent Float?   @map("default_markup_percent")
  contactName          String?  @map("contact_name")
  contactPhone         String?  @map("contact_phone")
  remark               String?
  userId               String?  @unique @map("user_id")
  user                 User?    @relation(fields: [userId], references: [id])
  keys                 ApiKey[]
  prices               SubjectPackagePrice[]
  orders               Order[]
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

// API 密钥（一个主体可有多把）
model ApiKey {
  id          String    @id @default(uuid())
  subjectId   String    @map("subject_id")
  subject     Subject   @relation(fields: [subjectId], references: [id])
  keyId       String    @unique @map("key_id")     // ak_live_xxx，公开
  keySecret   String    @map("key_secret")          // 签名密钥，不外传
  name        String
  mode        String    @default("live")            // live | test
  ipWhitelist String?   @map("ip_whitelist")
  lastUsedAt  DateTime? @map("last_used_at")
  expiresAt   DateTime?
  enabled     Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([subjectId])
}

// 主体套餐定价（缺省回落平台价）
model SubjectPackagePrice {
  id            String   @id @default(uuid())
  subjectId     String   @map("subject_id")
  subject       Subject  @relation(fields: [subjectId], references: [id])
  pkgId         String   @map("pkg_id")
  price         Float?                              // 固定售价，优先
  markupPercent Float?   @map("markup_percent")      // 加价比例，次之
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([subjectId, pkgId])
  @@index([subjectId])
}

// 退款单（支持多次/部分退款，替代散落在 Order 上的退款字段）
model Refund {
  id          String   @id @default(uuid())
  refundNo    String   @unique @map("refund_no")    // 平台退款单号
  extRefundNo String?  @map("ext_refund_no")        // 主体退款单号，幂等键
  orderId     String   @map("order_id")
  order       Order    @relation(fields: [orderId], references: [id])
  subjectId   String   @map("subject_id")
  amount      Float
  status      String   @default("processing")       // processing | success | failed
  reason      String?
  channelTradeNo String? @map("channel_trade_no")
  failReason  String?  @map("fail_reason")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([subjectId, extRefundNo])
  @@index([orderId])
}
```

**Order 表增量**：新增 `subjectId`、`apiKeyId`（审计用）；保留 `extOrderNo`、`webhook*`。
`Refund` 与既有 Order 退款字段并存一段时间，迁移完成后再下线旧字段。

> ⚠️ 提醒：`prisma/schema.prisma` 的注释必须全用英文（中文注释会导致 `prisma generate`
> 报 `Error: Invalid character`，但 `validate` 却通过）。

---

## 5. 价格解析

```
resolveSubjectPrice(pkg, subject):
  1. 查 SubjectPackagePrice(subjectId, pkgId)
  2. 命中且 enabled = false        -> 该主体不可见此套餐
  3. 命中且 price != null          -> 用固定价
  4. 命中且 markupPercent != null  -> 平台价 × (1 + markupPercent/100)
  5. 未命中 且 subject.defaultMarkupPercent != null -> 平台价 × (1 + 默认比例/100)
  6. 否则                          -> 平台价
  7. 四舍五入到 2 位小数
```

对外返回的 `price` 一律是**该主体的售价**；结算仍按现有逻辑折算为 CNY（`toCnyAmount`）。

---

## 6. 接口清单

基础路径：`https://<域名>/api/open/v1`
统一响应：`{ "code": 0, "message": "ok", "data": {...}, "requestId": "..." }`

### 6.1 读接口（仅 `X-Api-Key`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/packages` | 套餐列表。参数 `countryCode` `keyword` `page` `pageSize`，返回**主体售价** |
| GET | `/packages/{pkgId}` | 套餐详情（含主体售价与可见性） |
| GET | `/regions` | 可用国家/地区列表 |
| GET | `/orders` | 主体订单列表（分页，按 `status` `extOrderNo` `createdAt` 过滤） |
| GET | `/orders/{orderNo}` | 订单详情（含 eSIM 激活码，仅 `paid`） |
| GET | `/orders/ext/{extOrderNo}` | 按主体订单号反查 |
| GET | `/orders/{orderNo}/esim` | eSIM 详情与用量 |
| GET | `/refunds/{refundNo}` | 退款单查询 |
| GET | `/me` | 当前主体信息与密钥信息 |

### 6.2 写接口（`X-Api-Key` + 签名）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/orders` | 下单。body `{ pkgId, email, extOrderNo?, returnUrl? }`，返回支付链接与应付金额 |
| POST | `/orders/{orderNo}/refunds` | 申请退款。body `{ extRefundNo, amount?, reason? }` |
| POST | `/orders/{orderNo}/webhook/retry` | 手动重发回调 |

### 6.3 下单响应示例

```json
{
  "code": 0,
  "message": "ok",
  "requestId": "req_01J8Z...",
  "data": {
    "orderNo": "DPH178945416813028",
    "extOrderNo": "AGENT-A-20260916-001",
    "payUrl": "https://openapi.alipay.com/gateway.do?...",
    "price": 32.9,
    "totalAmount": "32.90",
    "paid": false
  }
}
```

`price` = 该主体售价（展示货币），`totalAmount` = 实际结算金额（**恒为 CNY 字符串**）。

---

## 7. 退款规则（主体自助）

可退条件（全部满足）：

1. 订单 `status = paid`
2. eSIM 未激活（`esim.status = pending`）—— 已激活/已使用不可退
3. 累计已退金额 < 实付金额

处理流程：

1. 校验 `extRefundNo` 幂等（同一主体下唯一，重复提交返回已有退款单）
2. 校验可退条件与金额（不传 `amount` 默认全额）
3. 调用支付宝原路退款（按 `paidAmount` 实付，不得超额）
4. 成功：写 `Refund(status=success)`、更新订单、释放 eSIM，发 `order.refunded` 事件
5. 失败：写 `Refund(status=failed)` 并记录原因，返回明确错误码

> 现有 `services/refund.ts` 的 `refundOrder` 要求 `refundStatus='requested'`（即先申请后审批）。
> 自助退款需新增一条跳过该前置校验的执行路径，建议新增 `refundOrderSelfService()`，
> 复用同一套 `RefundDeps`，避免两套退款逻辑分叉。

---

## 8. Webhook

| 事件 | 触发时机 |
|---|---|
| `order.paid` | 支付成功且 eSIM 下发完成 |
| `order.refunded` | 退款成功 |

请求头与签名规则同入站（`X-Api-Key` + `X-Timestamp` + `X-Nonce` + `X-Sign`），
签名密钥为主题对应密钥的 `keySecret`。payload 带 `orderNo` / `extOrderNo` 供幂等去重。

**投递记录（已实现）**：独立成 `WebhookDelivery` 表，替代 Order 上的 `webhook*` 字段，
可支撑多事件类型（`order.paid` / `order.refunded`）与投递明细排查。

```prisma
model WebhookDelivery {
  id          String   @id @default(uuid())
  subjectId   String   @map("subject_id")
  event       String   // order.paid | order.refunded
  orderNo     String   @map("order_no")
  extOrderNo  String?  @map("ext_order_no")
  refundNo    String?  @map("refund_no")  // refunded 事件携带，支持同订单多次退款
  payload     String   @db.LongText       // json webhook payload
  status      String   @default("pending") // pending | success | failed
  attempts    Int      @default(0)
  nextRetryAt DateTime? @map("next_retry_at")
  lastError   String?  @map("last_error") @db.Text
  lastErrorAt DateTime? @map("last_error_at")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([subjectId])
  @@index([status, nextRetryAt])
}
```

投递流程：

1. 事件触发（`order.paid` 在支付履约后入队；`order.refunded` 在退款成功后入队），
   `enqueueSubjectWebhook` 幂等去重（同主体 + 事件 + 订单号 / 退款单号）。
2. 后台 60 秒定时器 `retryPendingSubjectWebhooks` 扫描待投递且已到重试时间的记录，
   逐个投递到 `Subject.callbackUrl`，签名用主体首要启用密钥。
3. 退避：立即 → 60s → 5min → 30min → 2h；5 次失败后 `status=failed` 转终态，
   不再自动重试，可通过 `POST /orders/:no/webhook/retry` 手动重发（重置后立即投递一次）。

---

## 9. 幂等、限流与错误码

**幂等**

| 场景 | 机制 |
|---|---|
| 重复下单 | `extOrderNo` 在主体内唯一，重复提交返回已有订单 |
| 重复退款 | `extRefundNo` 在主体内唯一 |
| 重复回调 | 接收方按 `orderNo` + `event` 去重 |

**限流**（Redis 计数，未配 Redis 降级为进程内存）

| 类型 | 阈值 |
|---|---|
| 读接口 | 120 次 / 分钟 / 主体 |
| 写接口 | 30 次 / 分钟 / 主体 |

> 阈值为实现内常量（`openAuth.ts` 的 `READ_LIMIT` / `WRITE_LIMIT`），按**主体**（subjectId）计
> 而非单把密钥，便于多密钥共用同一额度。可按实际接入规模后续调整，也可下沉到配置化。

**错误码**

| HTTP | code | 说明 |
|---|---|---|
| 200 | 0 | 成功 |
| 400 | 400 | 参数错误 |
| 401 | 401 | 未授权（Key 无效/过期/签名错误/主体停用） |
| 403 | 403 | 越权（IP 不在白名单、操作他人订单） |
| 404 | 404 | 资源不存在（含不属于本主体的资源） |
| 409 | 409 | 状态冲突（订单已支付/已退款、eSIM 已激活） |
| 429 | 429 | 触发限流 |
| 500 | 500 | 服务端错误 |
| 502 | 502 | 上游 Tiger 异常 |

---

## 10. 管理端（平台侧）

**主体与密钥的全部生命周期都在后台完成，无对外自助入口。**

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/subjects` | 主体列表（含密钥数、订单数） |
| POST | `/api/admin/subjects` | 创建主体，**自动生成第一把密钥** |
| GET | `/api/admin/subjects/{id}` | 主体详情 |
| PUT | `/api/admin/subjects/{id}` | 改资料/状态/回调地址/默认加价 |
| DELETE | `/api/admin/subjects/{id}` | 停用主体（软删，保留订单） |
| GET | `/api/admin/subjects/{id}/keys` | 密钥列表（secret 脱敏） |
| POST | `/api/admin/subjects/{id}/keys` | 追加密钥，secret **仅此一次返回** |
| POST | `/api/admin/subjects/{id}/keys/{keyId}/revoke` | 吊销（立即失效） |
| POST | `/api/admin/subjects/{id}/keys/{keyId}/rotate` | 轮换 secret，**仅此一次返回** |
| GET/PUT | `/api/admin/subjects/{id}/prices` | 批量查看/设置该主体套餐价 |

**创建主体**（`POST /api/admin/subjects`）

请求：

```json
{
  "name": "张三数码",
  "contactName": "张三",
  "contactPhone": "13800000000",
  "callbackUrl": "https://agent-a.com/api/yyesim/webhook",
  "defaultMarkupPercent": 10,
  "remark": "华东渠道"
}
```

响应（**这是唯一一次能看到 `keySecret` 的机会**）：

```json
{
  "code": 0,
  "data": {
    "id": "sub_01J8Z...",
    "name": "张三数码",
    "status": "active",
    "key": {
      "keyId": "ak_live_7f3a9c21e4b8d0f6",
      "keySecret": "9f2c...（64 位 hex，仅此一次）",
      "mode": "live"
    }
  }
}
```

后台界面需要在弹窗里提示管理员立即复制保存，并提供"我已保存"确认，关闭后不再展示。

管理端已加登录鉴权（2026-09-15 完成），上述接口自动受保护。
管理前端（`backend` 静态导出）已新增「开放平台主体」菜单与页面（2026-09-16 完成）：
主体列表/创建（含一次性 keySecret 弹窗）、详情编辑与启停、密钥追加/轮换/吊销、套餐定价维护。

---

## 11. 迁移方案（✅ P5 完成）

1. **数据迁移**：`ExternalApp` → 一条 `Subject` + 一条 `ApiKey`（`appId`→`keyId`，`appSecret`→`keySecret`），
   保持 `extOrderNo` 与订单归属不变。
   - 脚本：`apps/server/scripts/migrate-external-apps.mjs`（幂等，以 `keyId === appId` 为已迁移标记）。
   - 映射：`Subject.name=app.name`（缺省占位 `ext_<appId>`）、`callbackUrl` 复用、`userId` 复用同一合成用户；
     ApiKey `mode='live'`、`enabled=true`；无 `userId` 的应用先按 `externalAuth` 规则懒建合成用户。
   - 订单表无需改动（订单 `userId` 已指向合成用户）。
2. **并存期**：`/api/external` 保留（仍走 `appId/appSecret` HMAC 鉴权、`userId` 数据隔离、响应结构不变），
   仅对全部响应追加 `Deprecation: true` + `Link: </api/open/v1>; rel="successor-version"` 响应头，
   并输出一次迁移提示日志（进程内一次）。
3. **下线**：确认无调用量后移除 `/api/external`。**尚在计划中，未执行。**

---

## 12. 分阶段实施

| 阶段 | 内容 | 依赖 |
|---|---|---|
| P1 | 数据模型（Subject/ApiKey/SubjectPackagePrice）+ 双模鉴权中间件 + 套餐查询（含主体定价） | ✅ 完成 |
| P2 | 下单 + 支付 + 订单查询（主体隔离） | ✅ 完成 |
| P3 | 自助退款（Refund 表 + 支付宝退款 + eSIM 释放） | ✅ 完成 |
| P4 | Webhook 多事件落表（WebhookDelivery + 退避重试 + 手动重发）+ 管理端主体/密钥/定价界面 + 限流 | ✅ 完成 |
| P5 | ExternalApp 迁移 + `/api/external` 兼容转调 | ✅ 完成 |

建议 P1–P5 已交付：主体能独立完成查价→下单→支付→退款闭环，具备可追溯的 webhook 投递；
P5 已提供 ExternalApp 迁移脚本并对 `/api/external` 做兼容转调（仅加 Deprecation 头，未下线）。

---

## 13. 待确认

1. 是否需要**部分退款**（同一订单多次退款）？当前设计支持，若不需要可简化为整单退。
2. 主体是否需要**独立的套餐可见范围**（白名单模式）？当前用 `enabled=false` 做黑名单，
   若主体多、套餐多，白名单模式更好维护。
3. 是否需要 `test` 模式密钥的**模拟支付**（不真调支付宝）？
4. `/api/external` 现有接入方有几个？决定迁移优先级。
