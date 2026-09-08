<template>
  <view class="profile-page">
    <!-- 顶部用户区 -->
    <view class="user-header" @click="goLogin">
      <view class="uh-avatar">
        <image v-if="store.isLoggedIn && store.user.avatar" class="uh-avatar-img" :src="store.user.avatar" mode="aspectFit" />
        <image v-else class="uh-avatar-img" src="/static/icons/hero-avatar.png" mode="aspectFit" />
      </view>
      <view class="uh-info">
        <text class="uh-name">{{ store.isLoggedIn ? (store.user.nickname || store.user.email || $t('profile.traveler')) : $t('profile.clickLogin') }}</text>
        <text class="uh-sub" v-if="store.isLoggedIn && store.user.email">{{ maskEmail(store.user.email) }}</text>
        <text class="uh-sub" v-else-if="!store.isLoggedIn">{{ $t('profile.loginBenefits') }}</text>
      </view>
    </view>

    <!-- 我的购买 -->
    <view class="order-card">
      <view class="oc-header">
        <text class="oc-title">{{ $t('profile.myPurchases') }}</text>
        <view class="oc-all" hover-class="oc-all--hover" @click="goOrders">
          <text>{{ $t('profile.allOrders') }}</text>
          <text class="oc-arrow">›</text>
        </view>
      </view>
      <view class="oc-items">
        <view class="oc-item" hover-class="oc-item--hover" @click="goOrdersByStatus('pending')">
          <view class="oc-icon-wrap">
            <image class="oc-icon" src="/static/icons/prof-order.png" mode="aspectFit" />
          </view>
          <text class="oc-label">{{ $t('profile.statusPending') }}</text>
          <view class="oc-badge" v-if="orderCountBy('pending') > 0">{{ orderCountBy('pending') }}</view>
        </view>
        <view class="oc-item" hover-class="oc-item--hover" @click="goOrdersByStatus('activate')">
          <view class="oc-icon-wrap">
            <image class="oc-icon" src="/static/icons/prof-esim.png" mode="aspectFit" />
          </view>
          <text class="oc-label">{{ $t('profile.statusActivate') }}</text>
          <view class="oc-badge" v-if="orderCountBy('activate') > 0">{{ orderCountBy('activate') }}</view>
        </view>
        <view class="oc-item" hover-class="oc-item--hover" @click="goOrdersByStatus('done')">
          <view class="oc-icon-wrap">
            <image class="oc-icon" src="/static/icons/feat-signal.png" mode="aspectFit" />
          </view>
          <text class="oc-label">{{ $t('profile.statusDone') }}</text>
          <view class="oc-badge" v-if="orderCountBy('done') > 0">{{ orderCountBy('done') }}</view>
        </view>
        <view class="oc-item" hover-class="oc-item--hover" @click="goOrdersByStatus('refunded')">
          <view class="oc-icon-wrap">
            <image class="oc-icon" src="/static/icons/prof-help.png" mode="aspectFit" />
          </view>
          <text class="oc-label">{{ $t('profile.statusRefunded') }}</text>
          <view class="oc-badge" v-if="orderCountBy('refunded') > 0">{{ orderCountBy('refunded') }}</view>
        </view>
        <view class="oc-item" hover-class="oc-item--hover" @click="goOrders">
          <view class="oc-icon-wrap">
            <image class="oc-icon" src="/static/icons/prof-help.png" mode="aspectFit" />
          </view>
          <text class="oc-label">{{ $t('profile.afterSales') }}</text>
        </view>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-card">
      <view class="menu-item" hover-class="menu-item--hover" @click="goEmail">
        <view class="menu-icon-wrap ic-orange">
          <image class="menu-icon" src="/static/icons/prof-order.png" mode="aspectFit" />
        </view>
        <text class="menu-txt">{{ $t('profile.menuEmail') }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="goGuide">
        <view class="menu-icon-wrap ic-green">
          <image class="menu-icon" src="/static/icons/feat-signal.png" mode="aspectFit" />
        </view>
        <text class="menu-txt">{{ $t('profile.menuGuide') }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="goFaq">
        <view class="menu-icon-wrap ic-red">
          <image class="menu-icon" src="/static/icons/prof-help.png" mode="aspectFit" />
        </view>
        <text class="menu-txt">{{ $t('profile.menuFaq') }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="switchLanguage">
        <view class="menu-icon-wrap ic-purple">
          <image class="menu-icon" src="/static/icons/prof-settings.png" mode="aspectFit" />
        </view>
        <text class="menu-txt">{{ $t('profile.menuLanguage') }}</text>
        <text class="menu-value">{{ currentLocaleLabel }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" hover-class="menu-item--hover" @click="about">
        <view class="menu-icon-wrap ic-blue">
          <image class="menu-icon" src="/static/icons/prof-about.png" mode="aspectFit" />
        </view>
        <text class="menu-txt">{{ $t('profile.menuAbout') }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 客服悬浮按钮 -->
    <view class="float-cs" hover-class="float-cs--hover" @click="goCs">
      <image class="float-cs-icon" src="/static/icons/prof-help.png" mode="aspectFit" />
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
import { store } from '@/store'
import { api } from '@/utils/api'
import { maskEmail } from '@/utils/format'
import { getLocale, setLocale, LOCALES } from '@/locales'

// 订单 → 分类：pending 待付款 / activate 待激活 / done 已完成 / refunded 已退款
function orderCategory(order) {
  if (order.status === 'pending') return 'pending'
  if (order.status === 'refunded') return 'refunded'
  return order.esimStatus === 'activated' ? 'done' : 'activate'
}

export default {
  data() {
    return { store, locale: getLocale(), currentTab: 'profile' }
  },
  computed: {
    currentLocaleLabel() {
      const found = LOCALES.find((l) => l.value === this.locale)
      return found ? found.label : this.locale
    }
  },
  onShow() {
    this.locale = getLocale()
    this.refreshOrders()
  },
  methods: {
    maskEmail,
    async refreshOrders() {
      if (!store.isLoggedIn) return
      try {
        const res = await api.getOrders()
        if (res.code === 0 && res.data.orders) {
          store.setOrders(res.data.orders)
        }
      } catch (e) {}
    },
    goLogin() {
      if (!store.isLoggedIn) {
        uni.navigateTo({ url: '/pages/login/login' })
      }
    },
    goOrders() {
      uni.navigateTo({ url: '/pages/orders/orders' })
    },
    goOrdersByStatus(status) {
      uni.navigateTo({ url: `/pages/orders/orders?status=${status}` })
    },
    orderCountBy(key) {
      return store.orders.filter((o) => orderCategory(o) === key).length
    },
    goGuide() {
      uni.navigateTo({ url: '/pages/guide/guide' })
    },
    goEmail() {
      uni.navigateTo({ url: '/pages/profile/email' })
    },
    goFaq() {
      uni.navigateTo({ url: '/pages/profile/faq' })
    },
    goCs() {
      uni.showToast({ title: '客服功能开发中', icon: 'none' })
    },
    switchLanguage() {
      const items = LOCALES.map((l) => ({ name: l.label, value: l.value }))
      uni.showActionSheet({
        itemList: items.map((i) => i.name),
        success: (res) => {
          const target = items[res.tapIndex]
          if (target && target.value !== this.locale) {
            setLocale(target.value)
            this.locale = target.value
            uni.showToast({ title: this.$t('profile.languageTitle'), icon: 'none' })
          }
        }
      })
    },
    about() {
      uni.showModal({
        title: this.$t('profile.menuAbout'),
        content: this.$t('profile.aboutContent'),
        showCancel: false,
        confirmText: this.$t('common.know'),
        confirmColor: '#0E5E8F'
      })
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
.profile-page {
  min-height: 100vh;
  background: #f5f6fa;
}

/* ============ 顶部用户区 ============ */
.user-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 60%, #a78bfa 100%);
  padding: 80rpx 40rpx 60rpx;
  display: flex;
  align-items: center;
}

.uh-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 4rpx solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.uh-avatar-img {
  width: 100%;
  height: 100%;
}

.uh-info {
  margin-left: 28rpx;
  flex: 1;
}

.uh-name {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
  display: block;
}

.uh-sub {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  display: block;
}

/* ============ 我的购买卡片 ============ */
.order-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: -20rpx 24rpx 0;
  padding: 32rpx 24rpx 16rpx;
  position: relative;
  z-index: 2;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.oc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.oc-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}

.oc-all {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #9ca3af;
  transition: opacity 0.15s;

  &--hover {
    opacity: 0.6;
  }
}

.oc-arrow {
  margin-left: 4rpx;
  font-size: 28rpx;
}

.oc-items {
  display: flex;
  align-items: flex-start;
}

.oc-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.92);
  }
}

.oc-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.oc-icon {
  width: 40rpx;
  height: 40rpx;
}

.oc-label {
  margin-top: 14rpx;
  font-size: 22rpx;
  color: #4b5563;
  text-align: center;
}

.oc-badge {
  position: absolute;
  top: -6rpx;
  right: 8rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #ef4444;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* ============ 功能菜单 ============ */
.menu-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: 24rpx 24rpx 0;
  padding: 8rpx 0;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 28rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &--hover {
    background: #f9fafb;
  }
}

.menu-icon-wrap {
  width: 60rpx;
  height: 60rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;

  &.ic-orange {
    background: #fff3e0;
  }

  &.ic-green {
    background: #e8f5e9;
  }

  &.ic-red {
    background: #fce4ec;
  }

  &.ic-purple {
    background: #f3e5f5;
  }

  &.ic-blue {
    background: #e3f2fd;
  }
}

.menu-icon {
  width: 32rpx;
  height: 32rpx;
}

.menu-txt {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 500;
}

.menu-value {
  font-size: 24rpx;
  color: #9ca3af;
  margin-right: 16rpx;
}

.menu-arrow {
  font-size: 34rpx;
  color: #d1d5db;
}

/* ============ 客服悬浮按钮 ============ */
.float-cs {
  position: fixed;
  right: 32rpx;
  bottom: calc(160rpx + env(safe-area-inset-bottom));
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 28rpx rgba(102, 126, 234, 0.4);
  z-index: 50;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.92);
  }
}

.float-cs-icon {
  width: 48rpx;
  height: 48rpx;
  filter: brightness(0) invert(1);
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
