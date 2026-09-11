<template>
  <view class="esims-page">
    <view class="head-banner">
      <view class="hb-left">
        <text class="hb-title">{{ fmt('esims.title') }}</text>
        <text class="hb-sub">{{ fmt('esims.sub', { n: cardGroups.length }) }}</text>
      </view>
      <view class="hb-btn" hover-class="hb-btn--hover" @click="goBuy">{{ fmt('esims.buy') }}</view>
    </view>

    <!-- 骨架屏：eSIM 数据加载中 -->
    <view v-if="loading && !store.esims.length" class="esim-list">
      <view v-for="i in 3" :key="i" class="sk-esim-card">
        <view class="sk-top">
          <view class="sk sk-flag"></view>
          <view class="sk sk-status"></view>
        </view>
        <view class="sk sk-line sk-country"></view>
        <view class="sk sk-line sk-spec"></view>
        <view class="sk-bottom">
          <view class="sk sk-line sk-iccid"></view>
          <view class="sk sk-line sk-expire"></view>
        </view>
      </view>
    </view>

    <view v-if="!loading && !store.esims.length" class="empty">
      <image class="empty-icon" src="/static/icons/prof-esim.png" mode="aspectFit" />
      <text class="empty-title">{{ fmt('esims.emptyTitle') }}</text>
      <text class="empty-sub">{{ fmt('esims.emptySub') }}</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="goBuy">{{ fmt('esims.goBuy') }}</view>
    </view>

    <view v-else class="esim-list">
      <view
        v-for="card in cardGroups"
        :key="card.iccid"
        class="esim-card"
        :class="card.status"
        hover-class="esim-card--hover"
      >
        <!-- 卡片背景装饰 -->
        <view class="card-deco">
          <view class="card-deco-circle c1"></view>
          <view class="card-deco-circle c2"></view>
        </view>

        <!-- 顶部：国旗 + 国家名 + 状态 -->
        <view class="card-top">
          <view class="card-flag-wrap">
            <image class="card-flag-img" :src="getFlagImage(card.displayEsim.pkg.countryCode)" mode="aspectFit" />
          </view>
          <text class="card-status-tag" :class="card.status">{{ statusText(card) }}</text>
        </view>

        <view class="card-body">
          <text class="card-country">eSIM Card</text>
          <text class="card-spec mono">{{ card.iccid }}</text>
          <text class="card-package-count">{{ fmt('esims.packageCount', { n: card.esims.length }) }}</text>
        </view>

        <!-- 正在使用的套餐用量 -->
        <view v-if="card.activeEsim" class="active-usage">
          <view class="active-usage-head">
            <text class="active-usage-title">{{ fmt('esims.currentPlan') }}</text>
            <text class="active-usage-percent">{{ usagePercent(card.activeEsim) }}%</text>
          </view>
          <view class="usage-bar">
            <view class="usage-fill" :style="{ width: usagePercent(card.activeEsim) + '%' }"></view>
          </view>
          <text class="active-usage-text">{{ usageText(card.activeEsim) }}</text>
        </view>

        <!-- 该 ICCID 下的所有套餐 -->
        <view class="package-list">
          <view
            v-for="esim in card.esims"
            :key="esim.id"
            class="package-row"
            :hover-class="esim.localEsimId ? 'package-row--hover' : 'none'"
            @click="goEsimDetail(esim.id)"
          >
            <view class="package-main">
              <text class="package-name">{{ esim.pkg.countryName }}</text>
              <text class="package-spec">{{ esim.pkg.isUnlimited ? fmt('package.unlimited') : esim.pkg.gb + 'GB' }} · {{ esim.pkg.days }}天</text>
            </view>
            <text class="package-status" :class="esim.status">{{ statusText(esim) }}</text>
          </view>
        </view>

        <!-- 底部：ICCID + 到期时间 -->
        <view class="card-bottom">
          <text class="card-iccid">{{ fmt('esims.expireLabel') }}</text>
          <text class="card-expire">{{ formatDate(card.displayEsim.expireAt) }}</text>
        </view>
      </view>
    </view>

    <view class="footer-safe"></view>

    <!-- 底部导航栏 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: currentTab === 'home' }" @click="switchTab('home')">
        <image class="tab-icon" :src="currentTab === 'home' ? '/static/icons/tab-home-active.png' : '/static/icons/tab-home.png'" mode="aspectFit" />
        <text class="tab-label">首页</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'esim' }" @click="switchTab('esim')">
        <image class="tab-icon" :src="currentTab === 'esim' ? '/static/icons/tab-esim-active.png' : '/static/icons/tab-esim.png'" mode="aspectFit" />
        <text class="tab-label">eSIM</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'profile' }" @click="switchTab('profile')">
        <image class="tab-icon" :src="currentTab === 'profile' ? '/static/icons/tab-profile-active.png' : '/static/icons/tab-profile.png'" mode="aspectFit" />
        <text class="tab-label">我的</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'
import { formatDate } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  data() {
    return {
      store,
      currentTab: 'esim',
      loading: true
    }
  },
  onShow() {
    setNavTitle('pageTitle.esims')
    this.refresh()
  },
  computed: {
    cardGroups() {
      const groups = new Map()
      for (const esim of this.store.esims) {
        if (!groups.has(esim.iccid)) {
          groups.set(esim.iccid, {
            iccid: esim.iccid,
            esims: [],
            activeEsim: null,
            displayEsim: esim,
            status: 'pending',
            latestAt: 0
          })
        }
        groups.get(esim.iccid).esims.push(esim)
      }

      const now = Date.now()
      const result = [...groups.values()].map((group) => {
        const activeEsims = group.esims
          .filter((esim) => esim.status === 'activated' && new Date(esim.expireAt).getTime() >= now)
          .sort((a, b) => new Date(b.activatedAt || b.expireAt) - new Date(a.activatedAt || a.expireAt))
        group.activeEsim = activeEsims[0] || null
        group.displayEsim = group.activeEsim || group.esims[0]
        group.status = group.activeEsim
          ? 'activated'
          : (group.esims.some((esim) => esim.status === 'pending') ? 'pending' : 'activated')
        group.latestAt = Math.max(...group.esims.map((esim) => new Date(esim.createdAt || esim.expireAt).getTime() || 0))
        return group
      })
      return result.sort((a, b) => b.latestAt - a.latestAt)
    }
  },
  methods: {
    formatDate,
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    async refresh() {
      this.loading = true
      try {
        const res = await api.getMyEsims()
        if (res.code === 401) {
          uni.showToast({ title: this.fmt('common.needLogin'), icon: 'none' })
          uni.navigateTo({ url: '/pages/login/login' })
          return
        }
        if (res.data.esims) {
          store.setEsims(res.data.esims)
        }
      } catch (e) {} finally {
        this.loading = false
      }
    },
    statusText(esim) {
      if (esim.status === 'activated') return this.fmt('esims.activated')
      return this.fmt('esims.pending')
    },
    usagePercent(esim) {
      const total = Number(esim?.pkg?.gb || 0)
      const used = Number(esim?.used || 0)
      if (!total) return 0
      return Math.min(100, Math.round((used / total) * 100))
    },
    usageText(esim) {
      return this.fmt('esims.usage', {
        used: Number(esim?.used || 0).toFixed(1),
        total: Number(esim?.pkg?.gb || 0).toFixed(1)
      })
    },
    getFlagImage(code) {
      if (!code) return '/static/icons/flag-unknown.png'
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    goBuy() {
      uni.reLaunch({ url: '/pages/index/index' })
    },
    goEsimDetail(id) {
      const esim = this.store.esims.find((item) => item.id === id)
      if (!esim?.localEsimId) return
      uni.navigateTo({ url: `/pages/esim-detail/esim-detail?id=${id}` })
    },
    switchTab(tab) {
      if (tab === this.currentTab) return
      const tabMap = {
        home: '/pages/index/index',
        esim: '/pages/esims/esims',
        profile: '/pages/profile/profile'
      }
      uni.reLaunch({ url: tabMap[tab] })
    }
  }
}
</script>

<style lang="scss" scoped>
.esims-page {
  min-height: 100vh;
  background: $bg-page;
}

.head-banner {
  background: linear-gradient(168deg, #E4EAFF 0%, #F0F3FF 52%, #F5F7F8 100%);
  padding: 36rpx 40rpx 52rpx;
  border-radius: 0 0 48rpx 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hb-left {
  display: flex;
  flex-direction: column;
}

.hb-title {
  font-size: 44rpx;
  font-weight: 800;
  color: $ink;
  letter-spacing: 1rpx;
}

.hb-sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $ink-3;
}

.hb-btn {
  background: #ffffff;
  color: $brand;
  font-size: 26rpx;
  font-weight: 600;
  padding: 18rpx 36rpx;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 16rpx rgba(64, 80, 192, 0.08);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.95);
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 140rpx;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  margin-bottom: 8rpx;
}

.empty-title {
  margin-top: 32rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
}

.empty-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: $ink-3;
}

.empty-btn {
  margin-top: 44rpx;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  padding: 22rpx 72rpx;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.96);
  }
}

.esim-list {
  padding: 28rpx 24rpx 0;
}

.esim-card {
  position: relative;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  min-height: 260rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4rpx 20rpx rgba(48, 48, 160, 0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  // 状态色带：顶部一条细色带标示激活状态
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    height: 8rpx;
  }

  // 已激活：品牌蓝紫
  &.activated::before {
    background: linear-gradient(90deg, #5050D0 0%, #4050C0 60%, #6CD5FA 130%);
  }

  // 待激活：琥珀
  &.pending::before {
    background: linear-gradient(90deg, $sun 0%, $warn 100%);
  }

  &--hover {
    transform: translateY(-4rpx);
    box-shadow: 0 12rpx 32rpx rgba(48, 48, 160, 0.14);
  }
}

/* 背景装饰圆（极淡品牌色） */
.card-deco {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.card-deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(80, 80, 208, 0.045);
}

.card-deco-circle.c1 {
  width: 280rpx;
  height: 280rpx;
  top: -80rpx;
  right: -60rpx;
}

.card-deco-circle.c2 {
  width: 180rpx;
  height: 180rpx;
  bottom: -40rpx;
  left: -30rpx;
}

/* 顶部：国旗 + 状态标签 */
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

.card-flag-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-flag-img {
  width: 84%;
  height: 84%;
}

.card-status-tag {
  font-size: 22rpx;
  font-weight: 600;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;

  &.activated {
    color: $brand;
    background: $brand-light;
  }

  &.pending {
    color: $warn-deep;
    background: $warn-bg;
  }
}

/* 中部：国家名 + 规格 */
.card-body {
  position: relative;
  z-index: 1;
  margin-top: 20rpx;
}

.card-country {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
  margin-bottom: 8rpx;
}

.card-spec {
  display: block;
  font-size: 26rpx;
  color: $ink-2;
  font-weight: 500;
}

.card-spec.mono {
  font-family: monospace;
  letter-spacing: 1rpx;
}

.card-package-count {
  display: inline-block;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: $brand;
  background: $brand-light;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.active-usage {
  position: relative;
  z-index: 1;
  margin-top: 24rpx;
  padding: 22rpx;
  border-radius: 20rpx;
  background: rgba(80, 80, 208, 0.06);
}

.active-usage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.active-usage-title {
  font-size: 24rpx;
  font-weight: 700;
  color: $brand;
}

.active-usage-percent {
  font-size: 24rpx;
  font-weight: 700;
  color: $ink;
}

.usage-bar {
  height: 12rpx;
  margin-top: 16rpx;
  background: rgba(80, 80, 208, 0.12);
  border-radius: 999rpx;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: $gradient-brand;
  border-radius: 999rpx;
}

.active-usage-text {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $ink-2;
}

.package-list {
  position: relative;
  z-index: 1;
  margin-top: 20rpx;
}

.package-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid $line;
}

.package-row--hover {
  opacity: 0.72;
}

.package-main {
  min-width: 0;
}

.package-name {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
}

.package-spec {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: $ink-3;
}

.package-status {
  flex-shrink: 0;
  font-size: 21rpx;
  font-weight: 600;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;

  &.activated {
    color: $brand;
    background: $brand-light;
  }

  &.pending {
    color: $warn-deep;
    background: $warn-bg;
  }
}

/* 底部：ICCID + 到期时间 */
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $line;
}

.card-iccid {
  font-size: 24rpx;
  color: $ink-3;
  font-family: monospace;
  letter-spacing: 1rpx;
}

.card-expire {
  font-size: 22rpx;
  color: $ink-3;
}

.footer-safe {
  height: calc(140rpx + env(safe-area-inset-bottom));
}

/* ============ Tab Bar ============ */
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #ffffff;
  padding: 12rpx 0 calc(12rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0;
  flex: 1;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 4rpx;
}

.tab-label {
  font-size: 22rpx;
  color: $ink-3;
  font-weight: 500;
}

.tab-item.active .tab-label {
  color: $brand;
  font-weight: 700;
}

/* ========== 骨架屏（eSIM 加载中） ========== */
.sk {
  background: linear-gradient(100deg, $brand-lighter 25%, #E6EBFF 37%, $brand-lighter 63%);
  background-size: 400% 100%;
  animation: skShimmer 1.4s ease infinite;
}

.sk-esim-card {
  background: #ffffff;
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  min-height: 260rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4rpx 20rpx rgba(48, 48, 160, 0.08);
}

.sk-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sk-flag {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
}

.sk-status {
  width: 120rpx;
  height: 36rpx;
  border-radius: 999rpx;
}

.sk-line {
  height: 24rpx;
  border-radius: 8rpx;
  margin: 10rpx 0;
}

.sk-country {
  width: 60%;
  height: 32rpx;
  margin-top: 24rpx;
}

.sk-spec {
  width: 40%;
}

.sk-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $line;
}

.sk-iccid {
  width: 45%;
}

.sk-expire {
  width: 28%;
}

@keyframes skShimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
</style>
