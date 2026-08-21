<template>
  <view class="orders-page">
    <view v-if="!store.orders.length" class="empty">
      <image class="empty-icon" src="/static/icons/prof-order.png" mode="aspectFit" />
      <text class="empty-title">{{ fmt('orders.emptyTitle') }}</text>
      <text class="empty-sub">{{ fmt('orders.emptySub') }}</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="goBuy">{{ fmt('orders.goBuy') }}</view>
    </view>

    <view v-else class="order-list">
      <view
        v-for="order in store.orders"
        :key="order.id"
        class="order-card"
      >
        <view class="oc-head">
          <view class="oc-flag">
            <image class="oc-flag-img" :src="getFlagImage(order)" mode="aspectFit" />
          </view>
          <view class="oc-main">
            <view class="oc-title-row">
              <text class="oc-name">{{ fmt('checkout.skuName', { name: order.countryName }) }}</text>
              <text class="oc-status" :class="order.status">{{ order.status === 'paid' ? fmt('orders.paid') : fmt('orders.pending') }}</text>
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
          <view class="act-btn primary" @click="goPay(order.orderNo)">{{ fmt('orders.goPay') }}</view>
        </view>
      </view>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'
import { formatDateTime } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换（如 {name}、{gb}、{days}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  data() {
    return {
      store
    }
  },
  onShow() {
    setNavTitle('pageTitle.orders')
    this.refresh()
  },
  methods: {
    formatDateTime,
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
    goPay(orderNo) {
      uni.navigateTo({ url: `/pages/payment/payment?orderNo=${orderNo}` })
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

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 180rpx;
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
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
  margin-right: 14rpx;
}

.oc-status {
  font-size: 19rpx;
  font-weight: 700;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;

  &.paid {
    color: #0D9488;
    background: $teal-light;
  }

  &.pending {
    color: #D97706;
    background: $sun-light;
  }
}

.oc-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-2;
}

.oc-price {
  font-size: 32rpx;
  font-weight: 800;
  color: $coral;
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

  &.primary {
    background: $gradient-brand;
    color: #ffffff;
    font-weight: 700;
    box-shadow: $shadow-brand;
  }
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>