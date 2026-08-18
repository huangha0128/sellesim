<template>
  <view class="profile-page">
    <view class="user-card" @click="goLogin">
      <view class="uc-avatar">
        <image v-if="store.isLoggedIn && store.user.avatar" class="uc-avatar-img" :src="store.user.avatar" mode="aspectFit" />
        <image v-else class="uc-avatar-img" src="/static/icons/hero-avatar.png" mode="aspectFit" />
      </view>
      <view class="uc-info">
        <text class="uc-name">{{ store.isLoggedIn ? (store.user.nickname || '全球旅行者') : '点击登录' }}</text>
        <text class="uc-email" v-if="store.isLoggedIn && store.user.email">{{ maskEmail(store.user.email) }}</text>
        <text class="uc-email" v-else-if="!store.isLoggedIn">登录后享受更多服务</text>
        <text class="uc-email" v-else>欢迎回来</text>
      </view>
      <view class="uc-badge" v-if="store.isLoggedIn">全球旅行者</view>
    </view>

    <view class="stat-row">
      <view class="stat-item" @click="goEsims">
        <text class="stat-num">{{ store.esims.length }}</text>
        <text class="stat-label">我的 eSIM</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @click="goEsims">
        <text class="stat-num">{{ store.orders.filter((o) => o.status === 'paid').length }}</text>
        <text class="stat-label">已完成订单</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item" @click="goCountries">
        <text class="stat-num">200+</text>
        <text class="stat-label">覆盖地区</text>
      </view>
    </view>

    <view class="menu-card">
      <view class="menu-item" hover-class="menu-item--hover" @click="goEsims">
        <view class="menu-icon ic-blue"><image src="/static/icons/prof-esim.png" mode="aspectFit" style="width: 36rpx; height: 36rpx;" /></view>
        <text class="menu-txt">我的 eSIM</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="goOrders">
        <view class="menu-icon ic-coral"><image src="/static/icons/prof-order.png" mode="aspectFit" style="width: 36rpx; height: 36rpx;" /></view>
        <text class="menu-txt">我的订单</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="goGuide">
        <view class="menu-icon ic-teal"><image src="/static/icons/feat-signal.png" mode="aspectFit" style="width: 36rpx; height: 36rpx;" /></view>
        <text class="menu-txt">eSIM 安装指南</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="about">
        <view class="menu-icon ic-gray"><image src="/static/icons/prof-about.png" mode="aspectFit" style="width: 36rpx; height: 36rpx;" /></view>
        <text class="menu-txt">关于YYeSim</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="handleLogout" v-if="store.isLoggedIn">
        <view class="menu-icon ic-red"><image src="/static/icons/prof-about.png" mode="aspectFit" style="width: 36rpx; height: 36rpx;" /></view>
        <text class="menu-txt">退出登录</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="demo-badge">
      <text class="demo-txt">
        <image src="/static/icons/prof-demo.png" mode="aspectFit" style="width: 24rpx; height: 24rpx; margin-right: 8rpx; vertical-align: middle;" />
        <text>演示环境 · 数据已对接本地后端服务</text>
      </text>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { store } from '@/store'
import { maskEmail } from '@/utils/format'

export default {
  data() {
    return { store }
  },
  methods: {
    maskEmail,
    goLogin() {
      if (!store.isLoggedIn) {
        uni.navigateTo({ url: '/pages/login/login' })
      }
    },
    goEsims() {
      uni.switchTab({ url: '/pages/esims/esims' })
    },
    goOrders() {
      uni.navigateTo({ url: '/pages/orders/orders' })
    },
    goGuide() {
      uni.navigateTo({ url: '/pages/guide/guide' })
    },
    goCountries() {
      uni.navigateTo({ url: '/pages/countries/countries' })
    },
    about() {
      uni.showModal({
        title: '关于YYeSim',
        content: 'YYeSim v1.0.0（演示版）\n全球 200+ 国家与地区流量套餐，即买即用。',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#0EA5E9'
      })
    },
    handleLogout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            store.logout()
            uni.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: $bg-page;
  padding: 0 $page-pad;
}

.user-card {
  background: $gradient-brand;
  border-radius: 0 0 40rpx 40rpx;
  margin: 0 (-$page-pad);
  padding: 56rpx $page-pad 60rpx;
  display: flex;
  align-items: center;
}

.uc-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 4rpx solid rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.uc-avatar-emoji {
  font-size: 62rpx;
}

.uc-info {
  flex: 1;
  margin-left: 28rpx;
  display: flex;
  flex-direction: column;
}

.uc-name {
  font-size: 38rpx;
  font-weight: 800;
  color: #ffffff;
}

.uc-email {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.8);
}

.uc-badge {
  background: rgba(255, 255, 255, 0.22);
  border: 1rpx solid rgba(255, 255, 255, 0.4);
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 600;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.stat-row {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 32rpx 0;
  margin-top: -24rpx;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  box-shadow: $shadow-sm;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 800;
  color: $brand-deep;
}

.stat-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $ink-2;
}

.stat-divider {
  width: 1rpx;
  height: 52rpx;
  background: $line;
}

.menu-card {
  background: $bg-card;
  border-radius: $radius-lg;
  margin-top: 24rpx;
  padding: 8rpx 28rpx;
  box-shadow: $shadow-sm;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1rpx solid $line;
  transition: transform 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &--hover {
    transform: translateX(6rpx);
  }
}

.menu-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 24rpx;
  flex-shrink: 0;

  &.ic-blue {
    background: $brand-light;
  }

  &.ic-coral {
    background: $coral-light;
  }

  &.ic-teal {
    background: $teal-light;
  }

  &.ic-gray {
    background: $bg-soft;
  }
}

.menu-txt {
  flex: 1;
  font-size: 28rpx;
  color: $ink;
  font-weight: 600;
}

.menu-tag {
  font-size: 20rpx;
  color: $coral;
  background: $coral-light;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  margin-right: 12rpx;
  font-weight: 600;
}

.menu-arrow {
  font-size: 34rpx;
  color: $ink-3;
}

.demo-badge {
  margin-top: 32rpx;
  text-align: center;
}

.demo-txt {
  font-size: 22rpx;
  color: $ink-3;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
