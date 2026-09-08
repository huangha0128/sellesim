# 后台汇率设置与套餐价格动态换算（USD ⇄ 人民币）

## Context（背景）

后台套餐价格现在直接当作人民币展示（前端多处硬编码 `¥`），没有任何货币/汇率概念。用户希望：
- 后台可以设置**美元与人民币汇率**；
- 后台设置套餐价格时可**选择货币单位（USD 或 CNY）**；
- 后台可设置**小程序/H5 前台展示的货币（USD 或 CNY）**；
- 前台展示与下单金额，按汇率**动态换算**成后台指定的展示货币（存储货币 ≠ 展示货币时换算，相同则原样）。

目标：让「存储价格」独立于「展示货币」，汇率集中配置、全局即时生效，避免把价格写死成人民币。

## 设计核心

换算统一放在**后端视图层**：`listAllPackagesView`/`getPackageView` 产出套餐视图后，追加一层 `applyDisplayCurrency`，读全局设置里的展示货币 + 汇率，逐项换算 `price` 并回填 `currency`。前端只按返回的 `currency` 渲染符号（`¥`/`$`）。`order.ts` 用 `pkg.price` 落库，故下单金额 天然 = 展示货币金额，无需改下单逻辑。

- 换算规则：`currency === displayCurrency` → 价格不变；否则 `displayCurrency === 'USD' ? price / rate : price * rate`（USD 与 CNY 互转，rate = 1 USD 折合多少 CNY）。
- 汇率变更后需失效套餐缓存（复用现有 `refreshAfterOverride` 的清缓存+重拉机制，避免展示价格滞后）。

## 改动清单

### 后端 apps/server

**prisma/schema.prisma**（`npx prisma db push` 迁移）
- `PackagePrice` 新增字段：`currency String @default("CNY") @map("currency")` —— 后台填价时的货币单位。
- 新增全局配置表（存汇率 + 展示货币）：
  ```prisma
  model Setting {
    key   String @id
    value String
  }
  ```

**src/pricing/priceOverride.ts**
- 新增 `DisplayCurrency { rate: number; symbol: 'CNY' | 'USD'; displayCurrency: 'CNY' | 'USD' }` 的读取：从 `Setting` 读 `displayCurrency`、`usdCnyRate`（无则默认 `CNY` / 7.0）。提供读取缓存与 `clearSettingsCache()`。
- 新增 `applyDisplayCurrency(items: any[]): Promise<any[]>`：逐项按存储 `currency` 与展示货币换算 `price`，并回填 `currency = displayCurrency`。保持纯函数便于测试（`applyDisplayCurrencyToItems(items, cfg)`）。

**src/tiger/view.ts**
- 在 `listAllPackagesView` / `refreshPackageCache` 已写入白名单缓存的数据基础上，**返回前**调用 `applyDisplayCurrency`（用一个 helper 包裹 filter 前的结果），保证列表/min-prices/详情与下单拿到展示货币价格。
- 顺序：`applyWhitelist(data)` → `applyDisplayCurrency(data)` → 按 `onSale` filter → 返回。

**src/routes/admin.ts**
- 新增配置接口：
  - `GET /api/admin/settings`：返回 `{ displayCurrency, usdCnyRate }`。
  - `PUT /api/admin/settings`：接收 `{ displayCurrency?, usdCnyRate? }`，`upsert` 到 `Setting` 表；写完后 `clearSettingsCache()` + 沿用 `refreshAfterOverride()` 失效套餐缓存并重拉，保证即时生效。
- `PUT /packages/:tigerPkgId/price` 与 `POST /packages/prices/batch` 的 body 支持可选 `currency`（`'CNY' | 'USD'`），缺省保持原值（新增时默认 `CNY`）。
- 后台 `GET /packages/page`、`GET /packages/catalog` 返回项带上 `currency`，供后台回显单位。

### 前端 apps/admin

**src/api/index.ts**
- `PackageItem` / `CatalogItem` 增加 `currency?: 'CNY' | 'USD'`。
- `updatePackagePrice` / `batchUpdatePackagePrices` 参数加 `currency?`。
- 新增 `getSettings`、`updateSettings`。

**src/components/layout/AppShell.tsx**
- `NAV_ITEMS` 增加 `{ href: '/settings', label: '系统设置', icon: Settings }`；`TITLE_MAP` 加 `'/settings': '系统设置'`（`Settings` 从 lucide-react 引入）。

**新增 src/app/(admin)/settings/page.tsx**
- 表单：展示货币（CNY/USD 下拉）、汇率（NumberField，可小数）；加载 `getSettings` 回显，保存调 `updateSettings`，成功后 toast 提示"汇率已更新，套餐价格将即时重新计算"。

**src/app/(admin)/packages/page.tsx**
- 单行改价与「添加套餐」弹窗：价格旁显示当前套餐 `currency` 单位（`¥`/`$`），「添加套餐」定价时可选货币单位（默认跟随后台展示货币）。
- 批量定价弹窗保持不改货币单位（沿用已有设置）。

### 前端 apps/miniapp（生产前端，需重新编译上传支付宝）
- 价格符号由硬编码 `¥` 改为按套餐/响应 `currency` 动态显示：新增 `formatPrice(pkg)` 辅助，`currency === 'USD' ? '$' : '¥'` + 金额。
- 涉及文件：`src/components/PackageCard.vue`、`src/pages/packages/packages.vue`、`src/pages/index/index.vue`、`src/pages/detail/detail.vue`（详情页 `RMB` 徽标与价格）、`src/pages/payment/payment.vue`、`src/pages/orders/orders.vue`、`src/pages/orders/order-detail.vue`、`src/pages/checkout/checkout.vue`。可用统一工具函数（如 `utils/format.ts` 增加货币符号逻辑）。
- 说明：`src/`（H5 mock 原型）本次不动，仅作为参考。

## 不做的事
- 不改订单/支付/eSIM/退款链路（下单金额沿用后端换算后的 `pkg.price`）。
- 不改 `src/` H5 mock 原型。
- 本次不把 `docs/plans.xlsx` 的 160 个套餐批量导入（那是独立数据录入任务，但新增的 `currency` 字段已为其铺路）。

## 验证
1. `npx prisma db push`（apps/server）成功迁移新增字段与 Setting 表。
2. `npm run build`（apps/server）tsc 通过；`npm test` 含新增 `applyDisplayCurrencyToItems` 单测全绿。
3. `npm run build`（apps/admin）通过。
4. apps/miniapp 重新编译上传支付宝后，手动验证：
   - 后台设展示货币 CNY、汇率 7，套餐存 USD 价 → 列表/详情/下单显示换算后 ¥。
   - 改展示货币为 USD → 前台显示 `$`，金额 = 存储价 / 汇率。
   - 改汇率后后台「从 Tiger 刷新」或读套餐，价格即时更新。
   - 存储与展示货币相同时价格原样。