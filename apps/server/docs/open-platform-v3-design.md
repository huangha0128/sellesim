# 开放平台 v3 重构设计：B2B 授信分销（额度记账 + 伙伴门户）

> 状态：设计稿（待评审） ｜ 日期：2026-09-18 ｜ 替代 v2（/api/open/v1，含支付外放）
>
> 方向变更：**开放平台不再外放支付/收款。** 改为 B2B 授信分销模型——
> 合作伙伴（Subject）以结算价从平台拿卡，售卖的钱**走伙伴自己账户、平台不参与收款**；
> 平台按每一笔订单的**结算价扣除伙伴授信额度**记账；伙伴线下结清后平台冲减已用额度。
> 同时提供**伙伴门户**，伙伴用平台下发的 key 登录，查看自己的额度/流水/订单，并可手动下单。

---

## 0. 待归档遗留问题（后续专门解决）

**⚠️ 结算 / 分成比例模型未定案，临时采用「毛利分成」推进（见 §1.3），后续必须重做。**

背景与矛盾（2026-09-18 讨论记录）：
平台进卡成本 C=80，平台售价 P=100，目标「平台 9 成 / 伙伴 1 成」。
旧方案「记全价 100、结账付 90%」算出的结果是平台净税 10、伙伴净收 10，实为**五五开**而非九一开，错误。
正确基准应为：

```
毛利 M = P − C
伙伴结算价 W = C + M × 平台分成比例
订单记 W、额度扣 W、结清还 W
平台净得 = W − C = M × 平台分成   （对任意伙伴售价都成立）
伙伴净得 = 伙伴售价 − W
```

关键结论：**要精确分成必须知道成本 C**（分成基于毛利，毛利依赖成本）。用户曾要求「忘记成本仍能九一分成」，这在数学上不成立，需在成本、分成、纯批发三选一。

**临时推进决定**：暂按「毛利分成」实现，后台每个套餐维护一次成本价 `costPrice`，系统自动算结算价 W。
但在实现前**必须先与用户并最终确定**：成本从哪来（Tiger 是否提供进价/成本字段）、分成比例粒度（套餐级 or 主体级）、落账方式（毛利分成 vs 纯批发放货价）。
若最终放弃毛利分成，唯一可用替代是「纯批发放货价」：后台直接给每套餐定伙伴结算价，伙伴按该价欠款/结清，无分成语义。

> 编码注释一律使用 ASCII 英文（prisma generate 遇中文注释会报 Invalid character）。

---

## 1. 核心概念与业务规则

### 1.1 一句话模型
- 伙伴以**结算价 W** 从平台拿货（卡），售卡收款归伙伴。
- 每下一单，平台把 W 记入该伙伴「已用 / 未结清」额度。
- 伙伴「已用额度 < 授信额度上限」才能继续下单；等于或超过则拒绝下单。
- 伙伴线下打款 → 平台后台手动记账「结清」→ 冲减已用额度。

### 1.2 授信额度（Quota）
| 概念 | 说明 |
|---|---|
| `quotaLimit` | 授信额度上限（伙伴未结清可欠的最大金额），后台配置 |
| `usedQuota` | 当前已用（未结清）额度：下单 `+W`，退款 `−W`，结清 `−结算金额`，手动调整 `±` |
| `availableQuota` | `= quotaLimit − usedQuota`，下单前校验 |

- 下单扣额度与后续开卡必须**同事务 + 行级锁（`SELECT ... FOR UPDATE`）**防止并发超卖。
- `usedQuota` 在 `Subject` 上维护缓存值，`SubjectLedger` 为流水明细（source of truth），两者在写入事务内原子更新。

### 1.3 结算价与售价（§0 遗留项，临时按毛利分成）
- **结算价 W（扣额度/结清金额）**：默认 = 平台价；可被套餐级 `SubjectPackagePrice.costPrice`、主体级默认加价覆盖。
- **售价（可选）**：伙伴门户展示用（伙伴给终端客户的自定价，平台不参与收款）。
- 分成比例：`splitPercent`（主体级，伙伴≥0 且 <100）。**临时实现**：`W = costPrice + (平台价 − costPrice) × (1 − splitPercent/100)`。
  - `splitPercent` 语义：`splitPercent`=90 → 平台留 10%。仅当提供 `costPrice` 时才生效；未提供成本价则 W = 平台价（等价于平台全收，伙伴 0 分成）。

> 最终模型未定，见 §0。此公式为占位实现，后续重写。

---

## 2. 数据模型变更（prisma）

```prisma
model Subject {
  // 既有字段不变 ...
  quotaLimit     Float?          @map("quota_limit")   // 授信额度上限
  usedQuota      Float           @default(0) @map("used_quota") // 已用/未结清额度（缓存值）
  splitPercent   Float?          @map("split_percent")// 分成比例：伙伴分成 %，占位
  ledger         SubjectLedger[]
}

model SubjectLedger {                                 // 额度记账流水（source of truth）
  id         String   @id @default(uuid())
  subjectId  String   @map("subject_id")
  type       String   // order_debit | refund_credit | settle_credit | adjust
  orderNo    String?  @map("order_no")                // 关联订单（非订单类流水为空）
  refundNo   String?  @map("refund_no")               // 关联退款单（refund_credit 用）
  amount     Float                                    // 正数绝对值，方向由 type 决定
  note       String?  @db.Text
  operatorId String?  @map("operator_id")             // 手动操作者（后台管理员）
  createdAt  DateTime @default(now())
  @@index([subjectId, createdAt])
}

model SubjectPackagePrice {
  // 既有字段（pkgId/price/enabled/markupPercent）保留
  costPrice  Float?  @map("cost_price")               // 结算成本价（扣额度基准，§1.3）
  price      Float?                                    // 售价（门户展示，可选）
}

// Order 表增量：
//   status 新增取值 'delivered'（已交付：扣额并已开卡下发），替代现金单的 'paid'
//   payMethod 取 'quota'（额度记账），用于区分现金单
```

> 迁移脚本：新增字段均可 `ALTER` 加列 + 默认值；`Subject.usedQuota` 用既有订单回填。
> 现金支付链路（小程序/后台 `paid/pending`）**保持不变**，只新增 `delivered`/`quota` 旁路。

---

## 3. 订单履约（去支付）

1. 下单（API 或门户）入参：`pkgId / email / extOrderNo?`（不再有 `returnUrl`）。
2. 校验：主体 `active`；eSIM 卡片池非空；可用额度充足。
3. **同事务**：`SELECT Subject FOR UPDATE` → 校验 → `usedQuota += W` → 写 `SubjectLedger(order_debit)` → 创建 `status='delivered'`, `payMethod='quota'` 订单。
4. **同事务后立即开卡**：复用 `provisionEsim`（Tiger `bindPackage` + 激活码兜底），写 eSIM 记录。
5. 订单创建/履约失败：回滚额度扣减与流水，返回错误。
6. 成功后：发送激活码邮件；入队 webhook `order.delivered`。

订单状态：`delivered`（交付）→（额度冲回退款）→ `refunded`。

---

## 4. 对外 API（移除支付，保留全流程）

基础路径 `https://<域名>/api/open/v1`，双模鉴权沿用 v2（读 `X-Api-Key`，写加 `X-Timestamp/X-Nonce/X-Sign`）。

**移除**：不再返回任何 `payUrl`；不再调用支付宝；`/orders` 下单直接返回 eSIM/激活码。

读接口：
- `GET /me`：主体信息 + 额度信息（quotaLimit / usedQuota / availableQuota）+ 密钥
- `GET /packages`、`GET /packages/:pkgId`：返回 `costPrice`（结算价）+ `price`（售价）+ 可见性
- `GET /regions`：不变
- `GET /orders`、`GET /orders/:no`、`GET /orders/ext/:no`、`GET /orders/:no/esim`：订单视图按 `delivered` 状态适配
- `GET /quota`：额度总览 + `SubjectLedger` 流水（type/amount/orderNo/createdAt）

写接口：
- `POST /orders`：下单即扣额 + 开卡；响应 `{ orderNo, extOrderNo, cost(结算价), esim:{...} }`（无 payUrl）
- `POST /orders/:no/refunds`：**额度冲回**（改 ledger `refund_credit`，释放 eSIM/ICCID），不再调支付宝
- `POST /orders/:no/webhook/retry`：不变，事件改为 `order.delivered`

Webhook 事件：`order.paid` → **`order.delivered`**；`order.refunded`（语义：额度冲回）。

错误码沿用 v2（400/401/403/404/409/429/500/502），新增 `409 可用额度不足`。

---

## 5. 伙伴门户（全新前端 app）

- 独立前端 `apps/partner`（沿用后台 Admin 的技术栈：Next.js + Tailwind + lucide + shadcn 风格），静态导出部署在独立子路径 `/partner`。
- **登录**：伙伴输入平台下发的 `keyId + keySecret` → `POST /api/open/v1/auth/login` 校验 → 签发**门户 JWT 会话**（scope-only，仅门户数据视图，不替代 API 双模写鉴权）。
- 页面：
  - 总览：额度（已用/可用/上限）+ 最近流水
  - 套餐（含结算价/售价/不可见过滤）
  - 下单（手动选套餐下单，扣额+开卡）
  - 我的订单 / eSIM
  - 记账流水（全部 type）
- 数据全部按当前登录伙伴隔离（subjectId 过滤）。

> 门户登录使用 key，但 API 写操作仍要求 HMAC 双模；门户会话 token 与 API Key 独立，避免泄露扩散。

---

## 6. 管理后台新增

- 主体列表/详情扩展：授信额度 `quotaLimit`、已用 `usedQuota`、可用额度、分成比例 `splitPercent`。
- 新增「记账流水」视图（按主体过滤，全部 type）。
- 新增操作：
  - **结清记账** `POST /api/admin/subjects/:id/settle`：`{ amount }` → `usedQuota -= amount`，写 `SubjectLedger(settle_credit)`，记录 `operatorId`。
  - **额度调整** `POST /api/admin/subjects/:id/adjquota`：`{ amount, reason }` → 直接增减 `usedQuota` 并写 `adjust` 流水。
  - 套餐级 `costPrice`/`price` 维护（可复用现有 `prices` 批量接口扩展字段）。
- 后台主体路由/服务均在既有 admin 鉴权之下。

---

## 7. 实施清单（P1–P5）

| 阶段 | 内容 |
|---|---|
| P1 | prisma 迁移（Subject 额度字段、SubjectLedger、SubjectPackagePrice.costPrice、Order.delivered/quota）+ 额度服务（校验/扣减/流水/结清/调整） |
| P2 | 下单改「去支付 + 扣额即开卡」，refund 改额度冲回；webhook 事件改造 |
| P3 | 对外 API 收敛（移除支付入参/返回、新增 /quota、状态适配） |
| P4 | 管理后台：额度配置 + 流水视图 + 结清/调整操作 |
| P5 | 伙伴门户 apps/partner：key 登录 + 总览/下单/订单/流水 |

> 分阶段仅在「结算/分成模型定案」后细化。当前先完成 P1 的数据与额度基座、P3 的对外约束（移除支付），门户可在模型定案后并行。

---

## 8. 已知待定 / 阻塞

1. **结算/分成模型未定案（§0）**：成本来源、分成粒度、毛利分成 vs 纯批发 —— 阻塞 P1 的 costPrice/结算价实现与 P5 门户结算展示。
2. 伙伴门户登录是否也要求双模签名？当前设计为「keyId+keySecret 换门户 JWT」，API 写仍双模。
3. `delivered` 状态是否会对后台现有订单页/退找造成范式冲突（需在后台订单页兼容展示）。