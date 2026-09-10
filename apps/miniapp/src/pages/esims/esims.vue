<template>
  <view class="esims-page">
    <view class="head-banner">
      <view class="hb-left">
        <text class="hb-title">{{ fmt('esims.title') }}</text>
        <text class="hb-sub">{{ fmt('esims.sub', { n: store.esims.length }) }}</text>
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
        v-for="esim in store.esims"
        :key="esim.id"
        class="esim-card"
        :class="esim.status"
        hover-class="esim-card--hover"
        @click="goEsimDetail(esim.id)"
      >
        <!-- 卡片背景装饰 -->
        <view class="card-deco">
          <view class="card-deco-circle c1"></view>
          <view class="card-deco-circle c2"></view>
        </view>

        <!-- 顶部：国旗 + 国家名 + 状态 -->
        <view class="card-top">
          <view class="card-flag-wrap">
            <image class="card-flag-img" :src="getFlagImage(esim.pkg.countryCode)" mode="aspectFit" />
          </view>
          <text class="card-status-tag" :class="esim.status">{{ statusText(esim) }}</text>
        </view>

        <!-- 中部：套餐信息 -->
        <view class="card-body">
          <text class="card-country">{{ esim.pkg.countryName }} eSIM</text>
          <text class="card-spec">{{ esim.pkg.isUnlimited ? fmt('package.unlimited') : esim.pkg.gb + 'GB' }} · {{ esim.pkg.days }}天</text>
        </view>

        <!-- 底部：ICCID + 到期时间 -->
        <view class="card-bottom">
          <text class="card-iccid">{{ esim.iccid }}</text>
          <text class="card-expire">{{ formatDate(esim.expireAt) }}</text>
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
    getFlagImage(code) {
      if (!code) return '/static/icons/flag-unknown.png'
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    goBuy() {
      uni.reLaunch({ url: '/pages/index/index' })
    },
    goEsimDetail(id) {
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
