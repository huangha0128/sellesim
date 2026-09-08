# ICCID 卡片池改为实时来自 TigerESIM

## Context / 背景

后台「卡片池」目前是**本地存储**：来源为数据库 `card` 表（后台手动批量添加）+ 环境变量 `TIGER_ICCIDS`。而套餐已经实时来自 TigerESIM（`GET /api/package`），不落本地库。

由此产生问题：TigerESIM 合作伙伴平台有 5 张 ICCID 卡，但本地卡片池只维护了 4 张，缺失的第 5 张从未导入本地「卡片池」。点「全量同步所有数据」也无效——因为 `syncAllFromTiger` 只同步国家/地区与套餐，**从不读 `GET /api/card`**。

用户决定：ICCID 卡片与套餐一样，**实时从 TigerESIM `GET /api/card` 同步**，不再以本地存储为准。

## 目标

- 配置了 Tiger 凭据时，卡片池 = 实时 `GET /api/card`（分页+去重）。
- 「已使用」判定沿用本地 `esim` 表（不变）：Tiger 卡不在本地 esim 表即视为可用。
- 后台 `GET /admin/cards` 返回 Tiger 实时卡片 + 使用状态 + `mode:'tiger'`；未配置 Tiger（mock/开发）时保持原 db+env 回退。
- `GET /admin/tiger/status` 的 `iccidPoolSize` 反映实时 Tiger 卡数。
- `sync-all` 结果附带 `cardsCount` 便于同步页展示。
- 现有单元测试保持通过、mock 行为不变。

**约束**：`iccid-pool.ts` 不 import `tigerClient`（因为 `client.ts` 顶部会 `dotenv.config()`，一旦 import 已配置的 Tiger，单测会去请求真实 Tiger API）。改用**函数注入**方式，由调用方决定是否传入 Tiger 拉取函数。不加缓存、不加 DB 表、不改 schema。

## 具体改动

### 后端

1. **`apps/server/src/tiger/client.ts`**：新增 `listAllCards()`，复用 `listCards()`（`GET /api/card`），分页 + 按 ICCID 去重，`limit` 用 500（Tiger 最小值 5）。

2. **新增 `apps/server/src/tiger/iccid-source.ts`**：可安全 import `tigerClient` 的小模块，导出（本文件不会被 `iccid-pool.ts` import，故不影响单测）：
   - `iccidOf(card)`：规范化卡片 ICCID（`iccid || iccid_number`，trim）。
   - `fetchTigerIccids(client = tigerClient)`：未配置返回 `[]`；否则 `listAllCards()` → 去重 ICCID 数组。

3. **`apps/server/src/tiger/iccid-pool.ts`**：三个公开函数加可选注入参数 `fetcher?: IccidFetcher`（类型 `() => Promise<string[]>`），保持向后兼容：
   - `getIccidPool(prisma, fetcher?)` / `iccidPoolCount(prisma, fetcher?)` / `getAvailableIccid(prisma, fetcher?)`
   - 有 `fetcher` 且有值时用 Tiger；否则回退 db+env（原逻辑）。
   - **不 import `tigerClient`**。`cardPool` 不动。单测不传 fetcher → 走本地路径 → 全绿。

4. **`apps/server/src/tiger/index.ts`**：re-export `fetchTigerIccids`。

5. **`apps/server/src/services/provision.ts`**：仅当 `tigerClient.configured` 分支内，`getAvailableIccid(prisma, () => fetchTigerIccids())`；并调整卡池耗尽报错文案（不再提 `TIGER_ICCIDS`）。

6. **`apps/server/src/routes/admin.ts`**：
   - 定义 `const tigerFetcher = tigerClient.configured ? () => fetchTigerIccids() : undefined`。
   - `GET /cards`：Tiger 模式返回实时卡 + used（来自本地 esim）+ `mode:'tiger'`（`envOnly:0`，remark/createdAt 空缺由前端 `-` 兜底）；包 try/catch 失败返回 502。mock 模式原样。
   - `POST /cards` / `DELETE /cards/:iccid`：Tiger 模式下直接返回提示「卡片由 TigerESIM 后台管理」，不写库；mock 模式保留原逻辑。
   - `GET /tiger/status`：`iccidPoolCount(prisma, tigerFetcher)`。

7. **`apps/server/src/tiger/sync.ts`**：`SyncResult` 加 `cardsCount?: number`；`syncAllFromTiger`（已守卫 configured）拉取 `(await fetchTigerIccids()).length` 计入。卡片不落库（与套餐一致），仅返回计数。mock 分支 `cardsCount: 0`。

### 前端

8. **`apps/admin/src/api/index.ts`**：给卡片列表响应类型与 `TigerStatus` 加可选 `mode?: 'tiger' | 'mock'`。方法签名不变。

9. **`apps/admin/src/app/(admin)/cards/page.tsx`**：读取响应中的 `mode`；当 `mode==='tiger'` 时隐藏「批量添加卡片」按钮与新增/删除弹窗，隐藏「操作」列，标题副文案改为「卡片实时来自 TigerESIM 平台，只读」；mock 模式不变。

10. **`apps/admin/src/app/(admin)/tiger-sync/page.tsx`**：本地 `SyncResult` 加 `cardsCount?`；结果网格加「卡片总数」`MiniStat`（`result.cardsCount ?? 0`）。状态行的 `iccidPoolSize` 已自动反映实时数量，无需改。

## 验证

1. 单测：`cd apps/server && npx vitest run src/tiger/iccid-pool.test.ts` —— 现有用例不改应全绿（走无 fetcher 本地路径）。
2. 服务端/后台前端类型检查通过（fetcher 为可选参数，既有调用可编译）。
3. 手动 mock 模式（临时清空 `TIGER_CLIENT_ID/SECRET`）：`GET /admin/cards` 返回本地卡 + mock 统计；添加/删除仍可用；tiger-sync `iccidPoolSize` = 本地数。
4. 手动 Tiger 模式（保留 `.env` 真实凭据）：
   - `GET /admin/cards` 返回实时 Tiger 卡（5 张），`used` 与本地 `esim` 对齐，`stats.total=5`，`mode:'tiger'`；卡片页隐藏增删。
   - `GET /admin/tiger/status` `iccidPoolSize = 5`。
   - 下一测试订单：从 Tiger 池取卡绑定，之后该卡显示 `used`；缺失的第 5 张可被使用。
   - `POST /admin/tiger/sync-all` 返回 `cardsCount`，同步页展示。

## 关键文件

- apps/server/src/tiger/iccid-pool.ts
- apps/server/src/tiger/client.ts（新增 listAllCards）
- apps/server/src/tiger/iccid-source.ts（新增）
- apps/server/src/routes/admin.ts
- apps/server/src/services/provision.ts
- apps/server/src/tiger/sync.ts
- apps/admin/src/app/(admin)/cards/page.tsx