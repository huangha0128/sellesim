<template>
  <view class="esims-page">
    <view class="head-banner">
      <view class="hb-left">
        <text class="hb-title">{{ fmt('esims.title') }}</text>
        <text class="hb-sub">{{ fmt('esims.sub', { n: store.esims.length }) }}</text>
      </view>
      <view class="hb-btn" hover-class="hb-btn--hover" @click="goBuy">{{ fmt('esims.buy') }}</view>
    </view>

    <view v-if="!store.esims.length" class="empty">
      <image class="empty-emoji" src="/static/icons/prof-esim.png" mode="aspectFit" />
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
          <text class="card-spec">{{ esim.pkg.gb }}GB · {{ esim.pkg.days }}天</text>
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
        <image class="tab-icon" src="/static/icons/tab-home.png" mode="aspectFit" />
        <text class="tab-label">首页</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'esim' }" @click="switchTab('esim')">
        <image class="tab-icon" src="/static/icons/tab-esim.png" mode="aspectFit" />
        <text class="tab-label">eSIM</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'profile' }" @click="switchTab('profile')">
        <image class="tab-icon" src="/static/icons/tab-profile.png" mode="aspectFit" />
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
      currentTab: 'esim'
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
      } catch (e) {}
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
  background: #f0f2f5;
}

.head-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #a78bfa 100%);
  padding: 36rpx 40rpx 44rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hb-left {
  display: flex;
  flex-direction: column;
}

.hb-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #ffffff;
}

.hb-sub {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.85);
}

.hb-btn {
  background: #ffffff;
  color: #667eea;
  font-size: 26rpx;
  font-weight: 700;
  padding: 16rpx 32rpx;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.25);
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

.empty-emoji {
  font-size: 110rpx;
}

.empty-title {
  margin-top: 32rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: #1f2937;
}

.empty-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: #9ca3af;
}

.empty-btn {
  margin-top: 44rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  padding: 22rpx 72rpx;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 32rpx rgba(102, 126, 234, 0.35);
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
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  min-height: 280rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  // 已激活：蓝紫渐变
  &.activated {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  // 待激活：暖橙渐变
  &.pending {
    background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
  }

  &--hover {
    transform: scale(0.98);
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.18);
  }
}

/* 背景装饰圆 */
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
  background: rgba(255, 255, 255, 0.08);
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
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-flag-img {
  width: 52rpx;
  height: 52rpx;
}

.card-status-tag {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;

  &.activated {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.2);
  }

  &.pending {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.2);
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
  color: #ffffff;
  margin-bottom: 8rpx;
}

.card-spec {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
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
}

.card-iccid {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  font-family: monospace;
  letter-spacing: 1rpx;
}

.card-expire {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.6);
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
  color: #9ca3af;
  font-weight: 500;
}

.tab-item.active .tab-label {
  color: #667eea;
  font-weight: 700;
}
</style>
