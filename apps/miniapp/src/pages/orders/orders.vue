<template>
  <view class="orders-page">
    <!-- 浅色 Hero 头部（首页同款视觉语言） -->
    <view class="page-hero">
      <text class="hero-overline">{{ fmt('orders.eyebrow') }}</text>
      <text class="hero-title">{{ fmt('orders.heroTitle') }}</text>
      <text class="hero-sub">{{ fmt('orders.heroSub', { n: store.orders.length }) }}</text>
    </view>

    <view v-if="!store.orders.length" class="empty">
      <image class="empty-icon" src="/static/icons/prof-order.png" mode="aspectFit" />
      <text class="empty-title">{{ fmt('orders.emptyTitle') }}</text>
      <text class="empty-sub">{{ fmt('orders.emptySub') }}</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="goBuy">{{ fmt('orders.goBuy') }}</view>
    </view>

    <template v-else>
      <scroll-view class="tabs" scroll-x>
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="tab"
          :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
          <text class="tab-num" v-if="countOf(tab.key) > 0">{{ countOf(tab.key) }}</text>
        </view>
      </scroll-view>

      <view v-if="!filteredOrders.length" class="subtle-empty">
        <text class="subtle-empty-title">{{ fmt('orders.noMatch') }}</text>
        <text class="subtle-empty-sub">{{ fmt('orders.noMatchSub') }}</text>
      </view>

      <view v-else class="order-list">
        <view
          v-for="order in filteredOrders"
          :key="order.id"
          class="order-card"
          hover-class="order-card--hover"
          @click="goDetail(order)"
        >
          <view class="oc-head">
            <view class="oc-flag">
              <image class="oc-flag-img" :src="getFlagImage(order)" mode="aspectFit" />
            </view>
            <view class="oc-main">
              <view class="oc-title-row">
                <text class="oc-name">{{ fmt('checkout.skuName', { name: order.countryName }) }}</text>
                <text class="oc-status" :class="categoryOf(order)">{{ statusText(order) }}</text>
              </view>
              <text class="oc-meta">{{ fmt('orders.meta', { gb: order.gb, days: order.days }) }}</text>
            </view>
            <text class="oc-price">¥{{ priceText(order) }}</text>
          </view>

          <view class="oc-info">
            <view class="oc-info-row">
              <text class="oci-label">{{ fmt('orders.orderNoLabel') }}</text>
              <text class="oci-value">{{ order.orderNo }}</text>
            </view>
            <view class="oc-info-row">
              <text class="oci-label">{{ fmt('orders.createdAtLabel') }}</text>
              <text class="oci-value">{{ formatDateTime(order.createdAt) }}</text>
            </view>
            <view class="oc-info-row">
              <text class="oci-label">{{ fmt('orders.emailLabel') }}</text>
              <text class="oci-value">{{ order.email }}</text>
            </view>
            <view class="oc-info-row">
              <text class="oci-label">{{ fmt('orders.payMethodLabel') }}</text>
              <text class="oci-value">{{ order.payMethod === 'alipay' ? fmt('checkout.alipayName') : order.payMethod }}</text>
            </view>
            <view v-if="order.paidAt" class="oc-info-row">
              <text class="oci-label">{{ fmt('orders.paidAtLabel') }}</text>
              <text class="oci-value">{{ formatDateTime(order.paidAt) }}</text>
            </view>
          </view>

          <view v-if="order.status === 'pending'" class="oc-actions">
            <view class="act-btn danger" @click.stop="confirmDelete(order)">{{ fmt('orders.delete') }}</view>
            <view class="act-btn primary" @click.stop="goPay(order.orderNo)">{{ fmt('orders.goPay') }}</view>
          </view>
        </view>
      </view>
    </template>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'
import { formatDateTime } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'
import { colors } from '@/theme'

// 命名占位符兜底替换（如 {name}、{gb}、{days}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

// 订单 → 分类：pending 待付款 / activate 待激活 / done 已完成 / refunded 已退款
function categoryOf(order) {
  if (order.status === 'pending') return 'pending'
  if (order.status === 'refunded') return 'refunded'
  return order.esimStatus === 'activated' ? 'done' : 'activate'
}

export default {
  data() {
    return {
      store,
      activeTab: 'all'
    }
  },
  computed: {
    tabs() {
      return [
        { key: 'all', label: this.fmt('orders.tabAll') },
        { key: 'pending', label: this.fmt('orders.tabPending') },
        { key: 'activate', label: this.fmt('orders.tabActivate') },
        { key: 'done', label: this.fmt('orders.tabDone') },
        { key: 'refunded', label: this.fmt('orders.tabRefunded') }
      ]
    },
    filteredOrders() {
      if (this.activeTab === 'all') return this.store.orders
      return this.store.orders.filter((o) => categoryOf(o) === this.activeTab)
    }
  },
  onLoad(options) {
    if (options && options.status && ['all', 'pending', 'activate', 'done', 'refunded'].includes(options.status)) {
      this.activeTab = options.status
    }
  },
  onShow() {
    setNavTitle('pageTitle.orders')
    this.refresh()
  },
  methods: {
    formatDateTime,
    categoryOf(order) {
      return categoryOf(order)
    },
    countOf(key) {
      if (key === 'all') return this.store.orders.length
      return this.store.orders.filter((o) => categoryOf(o) === key).length
    },
    switchTab(key) {
      this.activeTab = key
    },
    statusText(order) {
      if (order.refundStatus === 'requested') return this.fmt('orders.refundApplying')
      if (order.refundStatus === 'rejected') return this.fmt('orders.refundRejected')
      return this.tabs.find((t) => t.key === categoryOf(order)).label
    },
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    async refresh() {
      try {
        const res = await api.getOrders()
        if (res.code === 401) {
          uni.showToast({ title: this.fmt('common.needLogin'), icon: 'none' })
          uni.navigateTo({ url: '/pages/login/login' })
          return
        }
        if (res.data.orders) {
          store.setOrders(res.data.orders)
        }
      } catch (e) {}
    },
    getFlagImage(order) {
      const code = order.countryCode || order.flag
      if (code) return `/static/icons/flag-${String(code).toLowerCase()}.png`
      return `/static/icons/flag-unknown.png`
    },
    priceText(order) {
      const n = Number(order.price)
      return Number(n).toFixed(2)
    },
    confirmDelete(order) {
      uni.showModal({
        title: this.fmt('orders.deleteTitle'),
        content: this.fmt('orders.deleteConfirm', { name: order.countryName || order.pkgName || '' }),
        confirmText: this.fmt('orders.delete'),
        confirmColor: colors.danger,
        cancelText: this.fmt('orders.cancel'),
        success: async (r) => {
          if (!r.confirm) return
          try {
            const res = await api.deleteOrder(order.orderNo)
            if (res.code === 0) {
              uni.showToast({ title: this.fmt('orders.deleteSuccess'), icon: 'none' })
              await this.refresh()
            } else if (res.code === 401) {
              uni.navigateTo({ url: '/pages/login/login' })
            } else {
              uni.showToast({ title: res.message || this.fmt('orders.networkError'), icon: 'none' })
            }
          } catch (e) {
            uni.showToast({ title: this.fmt('orders.networkError'), icon: 'none' })
          }
        }
      })
    },
    goPay(orderNo) {
      uni.navigateTo({ url: `/pages/payment/payment?orderNo=${orderNo}` })
    },
    goDetail(order) {
      console.log('[orders] goDetail orderNo=', order && order.orderNo)
      const app = getApp()
      if (app && app.globalData) app.globalData.ticketOrder = order
      uni.navigateTo({
        url: `/pages/orders/order-detail?orderNo=${order.orderNo}`,
        success: () => console.log('[orders] navigateTo success'),
        fail: (err) => console.error('[orders] navigateTo fail', err)
      })
    },
    goBuy() {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  }
}
</script>

<style lang="scss" scoped>
.orders-page {
  min-height: 100vh;
  background: $bg-page;
  padding: 0 $page-pad;
}

/* ============ 浅色 Hero 头部（首页同款：浅蓝紫渐变 + 编辑排版） ============ */
.page-hero {
  margin: 0 (-$page-pad);
  background: $gradient-canvas;
  padding: 40rpx $page-pad 44rpx;
  border-radius: 0 0 48rpx 48rpx;
}

.hero-overline {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $brand;
  letter-spacing: 8rpx;
  margin-bottom: 16rpx;
}

.hero-title {
  display: block;
  font-size: 48rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.24;
  letter-spacing: 1rpx;
}

.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $ink-3;
}

.tabs {
  position: sticky;
  top: 0;
  z-index: 3;
  background: $bg-page;
  padding: 24rpx 0 20rpx;
  white-space: nowrap;
  width: calc(100% + (2 * #{$page-pad}));
  margin-left: (-$page-pad);
  padding-left: $page-pad;
  padding-right: $page-pad;
}

.tab {
  display: inline-flex;
  align-items: center;
  font-size: 26rpx;
  color: $ink-2;
  background: $bg-card;
  border: 2rpx solid transparent;
  padding: 14rpx 30rpx;
  border-radius: 999rpx;
  margin-right: 16rpx;
  box-shadow: $shadow-sm;
  transition: all 0.2s ease;

  &.active {
    background: $gradient-brand;
    color: #ffffff;
    font-weight: 700;
    box-shadow: $shadow-brand;
  }
}

.tab-num {
  margin-left: 8rpx;
  font-size: 20rpx;
  background: rgba(255, 255, 255, 0.3);
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  font-weight: 700;

  .active & {
    color: #ffffff;
  }
}

.subtle-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 140rpx;
}

.subtle-empty-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink-2;
}

.subtle-empty-sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $ink-3;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 110rpx;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  opacity: 0.4;
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

  &--hover {
    transform: scale(0.96);
  }
}

.order-list {
  padding: 28rpx 0 0;
}

.order-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;

  &--hover {
    transform: scale(0.985);
  }
}

.oc-head {
  display: flex;
  align-items: center;
}

.oc-flag {
  width: 84rpx;
  height: 84rpx;
  border-radius: 22rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.oc-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.oc-main {
  flex: 1;
  margin-left: 22rpx;
  min-width: 0;
}

.oc-title-row {
  display: flex;
  align-items: center;
}

.oc-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
  margin-right: 14rpx;
}

.oc-status {
  flex-shrink: 0;
  font-size: 19rpx;
  font-weight: 700;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;

  &.done {
    color: $teal-deep;
    background: $teal-light;
  }

  &.pending,
  &.activate {
    color: $sun-deep;
    background: $sun-light;
  }

  &.refunded {
    color: $coral;
    background: $coral-light;
  }
}

.oc-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-2;
}

.oc-price {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
  margin-left: 16rpx;
}

.oc-info {
  margin-top: 22rpx;
  border-top: 1rpx solid $line;
  padding-top: 20rpx;
}

.oc-info-row {
  display: flex;
  justify-content: space-between;
  padding: 6rpx 0;
}

.oci-label {
  font-size: 23rpx;
  color: $ink-3;
}

.oci-value {
  font-size: 23rpx;
  color: $ink-2;
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-actions {
  display: flex;
  margin-top: 24rpx;
  justify-content: flex-end;
}

.act-btn {
  text-align: center;
  font-size: 24rpx;
  color: $ink-2;
  background: $bg-soft;
  border-radius: 999rpx;
  padding: 16rpx 40rpx;
  margin-left: 16rpx;

  &:first-child {
    margin-left: 0;
  }

  &.primary {
    background: $gradient-brand;
    color: #ffffff;
    font-weight: 700;
    box-shadow: $shadow-brand;
  }

  &.danger {
    color: $coral;
    background: $coral-light;
    font-weight: 600;
  }
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>