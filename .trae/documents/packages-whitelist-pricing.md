# 套餐白名单定价改造

## Context（背景）

当前实现是「全覆盖覆盖」模式：`listAllPackagesView` 返回 **全部** Tiger 套餐，再用本地 `PackagePrice` 表对个别套餐做价格覆盖 / 上下架；未覆盖的套餐直接用 Tiger 原价展示。

用户希望改为 **白名单模式**：
- 只有「后台添加过、设置了自定义价格」的套餐，才在小程序（以及后台）展示；未添加的 Tiger 套餐完全不可见。
- 后台添加套餐 = **从 TigerESIM 全量套餐中挑选并绑定**，为其设定自定义价格。添加表单只记录价格，套餐内容仍实时来自 Tiger（不落库）。
- 保留现有上下架（onSale）开关。
- **只展示自定义价**，不再展示 Tiger 原价划线价。
- 下单逻辑不变：详情/购买沿用现有 `getPackageView -> pkg.price`，用后台设定的价格去请求 Tiger 绑定。

## 设计核心

**复用现有 `PackagePrice` 表作为白名单**，`tigerPkgId` 唯一，`price` 非空即表示"已添加进白名单"。因此**无需改 Prisma 模型、无需迁移**，改动集中在视图过滤逻辑与后台交互。

- 语义映射：
  - 添加套餐 = `upsert` 一个 `PackagePrice`（设 `price`）
  - 移出白名单 = `delete`（或置 `price = null`）→ 彻底不再展示
  - 停售 = `onSale = false`（仍在白名单，前端隐藏）

## 改动清单

### 后端 apps/server

**src/pricing/priceOverride.ts**
- 把 `applyOverridesToItems` 从"全量 + 覆盖"改为 **白名单过滤**：
  - 只保留 `map` 中有记录且 `price != null` 的套餐（未添加的直接剔除）。
  - `price` 用本地记录值；`onSale` 用本地记录值（缺省视为在售）。
  - **移除 `originalPrice` / 划线价产出**。
- 同步更新 `loadOverrideMap` 缓存逻辑（不变，仍读 `prisma.packagePrice`）。
- 定义导出类型方法名（可保留 `applyOverridesToItems` 或更名 `applyWhitelistToItems`，供 view 复用）。

**src/tiger/view.ts**
- `applyOverrides` 的调用方改为白名单过滤（`refreshPackageCache`、`listAllPackagesView` 三处）。
- `filter`（includeOffSale）逻辑保持不变：公开接口剔除 `onSale === false`；后台 `includeOffSale=true` 能看见白名单中已停售的套餐。
- 缓存数据 = 白名单套餐，行为不变。
- `getPackageView` / `listPackagesByRegion`：无需改动，自动继承白名单结果，下单链路不变。

**src/routes/admin.ts**
- `GET /packages/page`：现有代码自动变为"白名单套餐列表"（含分页/搜索/停售可见），保留 `{ includeOffSale: true }`。
- **新增** `GET /packages/catalog`：返回 Tiger **全量**归一化套餐（复用 `fetchAndNormalize` 思路，单次拉取），每项标注 `added: boolean`（是否已在白名单），供后台「添加套餐」挑选。推荐在选价格前展示搜索 + 列表。
- 现有 `PUT /packages/:tigerPkgId/price`、`DELETE /packages/:tigerPkgId/price`、`POST /packages/prices/batch` 语义即为白名单"添加/移出/批量"，**保留**（更新代码注释语义说明）。
- **移除「直调 TigerESIM 新建套餐」**：删除 `POST /packages` 路由、`createPackage` 相关 adminApi 方法，以及导入 `tigerClient.createPackage` 相关逻辑（保留 `syncPackagesFromTiger` 等只读同步）。

### 前端 apps/admin

**src/api/index.ts**
- `PackageItem`：移除 `originalPrice`（不再需要）。
- 新增 `getPackageCatalog: () => http.get('/admin/packages/catalog')`。

**src/app/(admin)/packages/page.tsx**
- 移除划线原价相关：`originalPrice` 展示、`isOverridden` 逻辑、`RotateCcw`「恢复 Tiger 原价」按钮。
- 「添加 / 编辑弹窗」整段改造：从"直调 Tiger createPackage 表单"改为 **从 catalog 挑选套餐 + 填自定义价**：
  - 加载 catalog，搜索/按流量与天数过滤；点击某套餐 → 填入价格 → 提交调用 `updatePackagePrice(tigerPkgId, { price, onSale: true })` 绑定。
  - 已 `added` 的套餐在 catalog 中标注"已添加"并禁用（或提示去列表改价）。
- 「删除」操作改为「移出白名单」：调 `clearPackagePrice`（确认后不再展示），去掉跳 Tiger 后台提示。
- 批量定价弹窗：
  - 「恢复为 Tiger 原价」项语义改为「移出白名单（不再展示）」（因为不再显示原价）。
  - 文案/提示更新：自定价保存即进入白名单并全端生效；停售在前端隐藏。
- 保留现有批量勾选、上下架 Switch、分页、筛选。

**移除直建入口**：删掉 `openAdd` 直建表单、“添加/编辑弹窗”原实现、`createPackage` 调用、`PackageForm/defaultForm`（改为 catalog 挑选绑定 UI），删除“从 Tiger 导入”按钮的直建指向（`syncFromTiger` 若仍用于刷新可保留为“刷新”）。

### 测试 apps/server

**src/pricing/priceOverride.test.ts**
- 用例改为白名单语义：被添加（有 price）→ 保留并用自定价 / onSale；未添加 → 剔除；停售保留但 onSale=false；空列表返回空。

## 不做的事
- 不改 Prisma 模型、不迁移数据库（白名单语义已由现有结构表达）。
- 不动下单/订单/eSIM/退款链路。
- 不展示 Tiger 原价（按用户选择只展示自定义价）。

## 验证
1. `npm run build`（apps/server）：tsc 通过。
2. `npm test`（apps/server）：白名单单测与既有测试全绿。
3. `npm run build`（apps/admin）：Next 构建 + 类型检查通过。
4. 手动（dev server 起后端 + 后台）：
   - 后台「添加套餐」从 Tiger 全量挑选并设价 → 该套餐在小程序列表/详情可见，价格 = 自定价。
   - 未添加的 Tiger 套餐在小程序不可见。
   - 改价 / 停售即时生效；停售套餐前端隐藏、后台可见。
   - 移除白名单后前端彻底不展示。
   - 下单仍走 `getPackageView`，用自定价完成绑定。