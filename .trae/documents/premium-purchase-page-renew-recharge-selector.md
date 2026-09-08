# 套餐购买页「加购/续费到已过期 eSIM」选择器

## Context（背景）

用户确认：项目里的"续费"语义就是**只有一\*\*\*\*张 ICCID 卡的套餐真正过期后，才可在该原卡上重新购买/充值新套餐**（过期卡无剩余流量，加购即重设套餐、激活码不变）。

该能力后端已闭环：

- `apps/server/src/routes/order.ts` 校验 `orderType='renew'` 时目标卡必须 `expireAt < now`；

- `apps/server/src/services/topup.ts` 的 `renewEsim()` 对目标 ICCID 调 `bindPackage` 重设套餐。

- 前端链路也已打通：`detail.vue` 的 `buy()` 把 `mode/esimId` 透传 `checkout.vue`，其 `submit()` 组 `orderType` + `targetEsimId`，未登录跳登录带 redirect 回跳。

**唯一的缺口**：套餐购买页本身没有"从我的已过期 eSIM 卡里选一张加购"的选择器（目前只能从 eSIM 详情页的"续费"按钮预置跳入）。本次新增该选择器交互。

**范围**：仅改前端购买页；后端与 checkout 已支持，无需改动。

## 涉及文件

- `apps/miniapp/src/pages/detail/detail.vue`（主改造）

- `apps/miniapp/src/locales/zh-CN.js` / `en.js` / `zh-TW.js`（新增文案，`detail:` 块内）

- `apps/miniapp/src/utils/format.js`（复用 `formatDate`，不改）

- `apps/miniapp/src/utils/api.js`（复用 `getMyEsims`，不改）

- `apps/miniapp/src/store/index.js`（复用 `store.isLoggedIn`，不改）

## 实现步骤

### 1. detail.vue：新增 import 与状态

import `{ store }`（`@/store`）与 `{ formatDate }`（`@/utils/format`）。

`data()` 新增：

- `renewEsims: []`（已过滤的已过期 eSIM 候选）

- `showEsimDrawer: false`（选择器抽屉开关）

- `selectedEsimId: ''`（选中的加购目标卡 id；空 = 纯新购）

`computed` 新增：

- `expiredEsims`：对 `renewEsims` 再做兜底过滤 `status==='activated' && new Date(expireAt) < new Date()`

- `selectedEsim`：`renewEsims.find(e => e.id === selectedEsimId)`

- `showRenewEntry`：`store.isLoggedIn && expiredEsims.length > 0`

### 2. detail.vue：加载与预选

新增方法 `loadReneEsims()`，在 `onLoad` 中并行触发、不 await、失败静默：

```js
async loadReneEsims() {
  if (!store.isLoggedIn) return
  try {
    const res = await api.getMyEsims()
    this.renewEsims = (res.data.esims || [])
      .filter(e => e.status === 'activated' && new Date(e.expireAt) < new Date())
    // 预选：从 eSIM 详情页续费进入时（onLoad 已带 mode=renew&esimId）
    if (this.mode === 'renew' && this.esimId && this.renewEsims.some(e => e.id === this.esimId)) {
      this.selectedEsimId = this.esimId
    } else if (this.mode === 'renew' && this.esimId) {
      // 预选卡不可续费（不存在于过期列表）→ 清空转新购并提示
      this.selectedEsimId = ''
      uni.showToast({ title: this.fmt('detail.renewPreselectGone'), icon: 'none' })
    }
  } catch (e) { console.error('加载我的eSIM失败', e) }
}
```

### 3. detail.vue：底部入口 UI

将 `bottom-bar`（L142-153）从单行改为纵向，新增顶部入口行（`v-if="showRenewEntry"`）：

- **未选卡**：引导文案 + 「选择卡片」副钮（`openEsimDrawer`）

- **已选卡**：`renewSelectedLabel` + 卡名 + `{gb}GB · {days}天 · 到期 {formatDate(expireAt)}` + 「清除」钮（`clearEsimSelection`）

### 4. detail.vue：选择器抽屉

仿照现有 `drawer-mask`/`drawer-panel`（L156-214）新建 `esim-drawer-mask`/`esim-drawer-panel`：

- 头部标题 + 关闭

- 国家不一致软警告（`selectedEsim.pkg.countryCode !== pkg.countryCode` 时显示 `renewCountryMismatch`，不阻断）

- `scroll-view` 列表单选：点选 `selectEsim(e)` 即确认并关闭；命中项 ✓ 圆标；空态 `renewNoEsim`

- 底部「不续费，直接新购」清除钮

方法：`openEsimDrawer / closeEsimDrawer / selectEsim(e) / clearEsimSelection`。

### 5. detail.vue：buy() 改造

```js
buy() {
  const pkgId = (this.selectedPkg && this.selectedPkg.id) || (this.pkg ? this.pkg.id : '')
  const mode = this.selectedEsimId ? 'renew' : ''
  const esimId = this.selectedEsimId || ''
  uni.navigateTo({
    url: `/pages/checkout/checkout?pkgId=${pkgId}&mode=${mode}&esimId=${esimId}`
  })
}
```

选中卡 → `orderType='renew'` + `targetEsimId`；未选 → `orderType='new'`（现行为不变）。

### 6. locale 新增文案（三语同步，`detail:` 块内）

| key                  | zh-CN                | en                                                  |
| -------------------- | -------------------- | --------------------------------------------------- |
| renewEntryPrompt     | 有已过期的 eSIM？加购/续费到这张卡 | Have an expired eSIM? Top up to renew it            |
| renewSelect          | 选择卡片                 | Choose a card                                       |
| renewSelectedLabel   | 续费到                  | Renew to                                            |
| renewClear           | 清除                   | Clear                                               |
| renewDrawerTitle     | 选择要续费的 eSIM          | Select eSIM to renew                                |
| renewNoEsim          | 暂无已过期的 eSIM          | No expired eSIM                                     |
| renewNewBuy          | 不续费，直接新购             | Don't renew, new purchase                           |
| renewExpire          | 到期 {date}            | Expires {date}                                      |
| renewCountryMismatch | 该 eSIM 与当前套餐国家不一致    | This eSIM is for a different country                |
| renewPreselectGone   | 目标卡不可续费，已转为新购        | Target card not renewable, switched to new purchase |

## 边界与取舍

- **入口只在** **`已登录 && 有已过期卡`** **时渲染**，其余场景（未登录 / 无过期卡 / 加载失败）整条隐藏，页面保持纯新购，避免空态干扰转化。

- **预选冲突**：`loadReneEsims` 成功后按 `onLoad` 的 `mode=renew&esimId` 预选；若该 id 不在过期列表则清空转新购 + toast，避免把不可续费卡死传为 renew。

- **国家不一致**：抽屉内软警告，不阻断（续费本质是给该 ICCID 换套餐，可换国家）。

- **过期判定**与 esim-detail `canRenew`、后端 `expireAt<now` 三端一致。detail 每次现拉 `getMyEsims()`，不依赖本地 `store.esims` 缓存。

## 验证

1. **纯新购回归**：首页进收藏详情，无加购入口，点立即购买 → checkout `orderType='new'`。
2. **预选续费**：我的 eSIM → 打开已过期卡 → 续费 → detail 入口渲染并预选该卡 → 购买传 `renew`+该卡 id，后端订单 `orderType='renew'`，目标卡套餐重置、激活码不变。
3. **选择器单选**：有 ≥2 张过期卡时打开抽屉列出全部，点选后关闭并显示所选卡。
4. **清除/转新购**：清除后入口回引导态，购买传 `orderType='new'`。
5. **国家不一致**：选不同国家的卡，抽屉内显示警告，仍可下单。
6. **未登录 / 无过期卡**：入口不显示，页面纯新购。
7. **中英文**：切 en 验证文案。

