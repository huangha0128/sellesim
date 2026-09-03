<template>
  <view class="od-page">
    <view v-if="error" class="empty">
      <text class="empty-title">{{ error }}</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="load">{{ fmt('orders.retry') }}</view>
      <view class="empty-link" @click="goBack">{{ fmt('orders.back') }}</view>
    </view>

    <view v-else-if="!order" class="empty">
      <text class="empty-title">{{ fmt('orders.detailNotFound') }}</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="goBack">{{ fmt('orders.back') }}</view>
    </view>

    <template v-else>
      <view class="hero">
        <view class="hero-flag">
          <image class="hero-flag-img" :src="getFlagImage(order)" mode="aspectFit" />
        </view>
        <view class="hero-info">
          <text class="hero-status" :class="categoryOf(order)">{{ statusText(order) }}</text>
          <text class="hero-name">{{ fmt('checkout.skuName', { name: order.countryName || order.pkgName }) }}</text>
          <text class="hero-meta">{{ fmt('orders.meta', { gb: order.gb, days: order.days }) }}</text>
        </view>
        <text class="hero-price">¥{{ priceText(order) }}</text>
      </view>

      <view v-if="esim" class="card">
        <view class="card-title">
          <text class="ct-txt">{{ fmt('orders.esimInfo') }}</text>
          <text class="ct-status" :class="esim.status">{{ esim.status === 'activated' ? fmt('esims.activated') : fmt('esims.pending') }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.iccid') }}</text>
          <text class="row-value mono">{{ esim.iccid }}</text>
        </view>
        <view class="row" @click="copy(esim.activationCode)">
          <text class="row-label">{{ fmt('orders.activationCode') }}</text>
          <text class="row-value mono copyable">{{ esim.activationCode }}<text class="copy-hint">{{ fmt('esims.copy') }}</text></text>
        </view>
        <view v-if="esim.smdp" class="row">
          <text class="row-label">SM-DP+</text>
          <text class="row-value mono">{{ esim.smdp }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.expireAt') }}</text>
          <text class="row-value">{{ formatDate(esim.expireAt) }}</text>
        </view>
        <view v-if="esim.status === 'activated'" class="row">
          <text class="row-label">{{ fmt('orders.usage') }}</text>
          <text class="row-value">{{ fmt('esims.usage', { used: Number(esim.used || 0).toFixed(1), total: esim.gb || order.gb || 0 }) }}</text>
        </view>
      </view>

      <view class="card">
        <view class="card-title">
          <text class="ct-txt">{{ fmt('orders.orderInfo') }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.orderNoLabel') }}</text>
          <text class="row-value">{{ order.orderNo }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.typeLabel') }}</text>
          <text class="row-value">{{ typeText(order) }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.createdAtLabel') }}</text>
          <text class="row-value">{{ formatDateTime(order.createdAt) }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.payMethodLabel') }}</text>
          <text class="row-value">{{ order.payMethod === 'alipay' ? fmt('checkout.alipayName') : order.payMethod }}</text>
        </view>
        <view class="row">
          <text class="row-label">{{ fmt('orders.emailLabel') }}</text>
          <text class="row-value">{{ order.email }}</text>
        </view>
        <view v-if="order.paidAt" class="row">
          <text class="row-label">{{ fmt('orders.paidAtLabel') }}</text>
          <text class="row-value">{{ formatDateTime(order.paidAt) }}</text>
        </view>
      </view>

      <view v-if="order.refundStatus === 'requested'" class="card refund-banner refund-banner--pending">
        <view class="refund-banner-head">
          <text class="refund-dot"></text>
          <text class="refund-banner-title">{{ fmt('orders.refundApplying') }}</text>
        </view>
        <view v-if="order.refundReason" class="refund-banner-sub">{{ fmt('orders.refundReasonLabel') }}：{{ order.refundReason }}</view>
        <text class="refund-banner-sub">{{ fmt('orders.refundApplyingSub') }}</text>
      </view>

      <view v-if="order.refundStatus === 'rejected'" class="card refund-banner refund-banner--rejected">
        <view class="refund-banner-head">
          <text class="refund-dot"></text>
          <text class="refund-banner-title">{{ fmt('orders.refundRejected') }}</text>
        </view>
        <view v-if="order.refundRejectReason" class="refund-banner-sub">
          <text class="refund-banner-label">{{ fmt('orders.rejectReasonLabel') }}：</text>{{ order.refundRejectReason }}
        </view>
        <text class="refund-banner-sub">{{ fmt('orders.refundRejectedSub') }}</text>
      </view>

      <view v-if="canApplyRefund" class="bottom-cta">
        <view class="refund-btn" hover-class="refund-btn--hover" @click="openRefundForm">{{ fmt('orders.refundApply') }}</view>
      </view>

      <view v-if="showRefundForm" class="popup-mask" @click.self="closeRefundForm">
        <view class="popup">
          <view class="popup-title">{{ fmt('orders.refundApply') }}</view>
          <textarea
            class="popup-input"
            v-model="refundReasonInput"
            :placeholder="fmt('orders.refundReasonPlaceholder')"
            :maxlength="200"
          />
          <view class="popup-actions">
            <view class="popup-btn cancel" @click="closeRefundForm">{{ fmt('orders.cancel') }}</view>
            <view class="popup-btn submit" :class="{ disabled: submitting }" @click="submitRefund">
              {{ submitting ? '...' : fmt('orders.refundSubmit') }}
            </view>
          </view>
        </view>
      </view>

      <view v-if="order.status === 'pending'" class="bottom-cta">
        <view class="pay-btn" hover-class="pay-btn--hover" @click="goPay(order.orderNo)">{{ fmt('orders.goPay') }}</view>
        <view class="del-btn" hover-class="del-btn--hover" @click="confirmDelete(order)">{{ fmt('orders.delete') }}</view>
      </view>
    </template>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'
import { formatDate, formatDateTime } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换（如 {name}、{gb}、{days}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

// 订单 → 分类：pending 待付款 / activate 待激活 / done 已完成 / refunded 已退款
function categoryOf(order) {
  if (!order) return ''
  if (order.status === 'pending') return 'pending'
  if (order.status === 'refunded') return 'refunded'
  if (order.esim && order.esim.status === 'activated') return 'done'
  return 'activate'
}

export default {
  data() {
    return {
      orderNo: '',
      order: null,
      esim: null,
      error: '',
      showRefundForm: false,
      refundReasonInput: '',
      submitting: false
    }
  },
  onLoad(options) {
    console.log('[order-detail] onLoad options=', JSON.stringify((options && options.orderNo) ? { orderNo: options.orderNo } : options))
    setNavTitle('pageTitle.orderDetail')
    this.orderNo = (options && options.orderNo) || ''
    // 优先取跳转时写入的订单对象即时渲染，随后实时请求刷新 esim 等信息
    const app = getApp()
    const passed = (app && app.globalData && app.globalData.ticketOrder) || null
    if (passed && (!this.orderNo || passed.orderNo === this.orderNo)) {
      this.order = passed
      this.esim = passed.esim || null
      this.orderNo = passed.orderNo || this.orderNo
    } else if (this.orderNo && store.orders.length) {
      // 其次用本地缓存中的订单即时渲染，避免实时请求失败时误报"订单不存在"
      const cached = store.orders.find((o) => o.orderNo === this.orderNo)
      if (cached) {
        this.order = cached
        this.esim = cached.esim || null
      }
    }
    this.load()
  },
  computed: {
    // 待激活订单（已支付且 eSIM 未激活）且未发起过退款申请时可申请退款
    canApplyRefund() {
      const o = this.order
      if (!o) return false
      if (o.status !== 'paid' || o.refundedAt) return false
      if (o.refundStatus) return false
      return !(o.esim && o.esim.status === 'activated')
    }
  },
  methods: {
    formatDate,
    formatDateTime,
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    categoryOf(order) {
      return categoryOf(order)
    },
    async load() {
      if (!this.orderNo) {
        console.warn('[order-detail] orderNo 为空，无法加载')
        return
      }
      console.log('[order-detail] load orderNo:', this.orderNo)
      this.error = ''
      try {
        const res = await api.getOrder(this.orderNo)
        console.log('[order-detail] response code:', res && res.code, 'message:', res && res.message)
        if (res.code === 401) {
          this.error = this.fmt('common.needLogin')
          uni.navigateTo({ url: '/pages/login/login' })
          return
        }
        if (res.code === 0 && res.data.order) {
          this.order = res.data.order
          this.esim = res.data.order.esim || null
          return
        }
        // 实时接口未返回（订单可能已删除），保留缓存展示，不误报
        if (this.order) return
        this.error = res.message || this.fmt('orders.detailNotFound')
      } catch (e) {
        // 网络异常：有缓存则保留展示，否则提示重试
        if (this.order) return
        this.error = this.fmt('orders.networkError')
      }
    },
    statusText(order) {
      const c = categoryOf(order)
      if (c === 'pending') return this.fmt('orders.tabPending')
      if (c === 'activate') return this.fmt('orders.tabActivate')
      if (c === 'done') return this.fmt('orders.tabDone')
      return this.fmt('orders.tabRefunded')
    },
    typeText(order) {
      if (order.orderType === 'renew') return this.fmt('orders.typeRenew')
      if (order.orderType === 'change') return this.fmt('orders.typeChange')
      return this.fmt('orders.typeNew')
    },
    getFlagImage(order) {
      const code = order.countryCode || order.flag
      if (code) return `/static/icons/flag-${String(code).toLowerCase()}.png`
      return `/static/icons/flag-unknown.png`
    },
    priceText(order) {
      return Number(order.price).toFixed(2)
    },
    copy(text) {
      uni.setClipboardData({
        data: text,
        success: () => uni.showToast({ title: this.fmt('esims.copied'), icon: 'none' })
      })
    },
    goPay(orderNo) {
      uni.navigateTo({ url: `/pages/payment/payment?orderNo=${orderNo}` })
    },
    confirmDelete(order) {
      uni.showModal({
        title: this.fmt('orders.deleteTitle'),
        content: this.fmt('orders.deleteConfirm', { name: order.pkgName || order.countryName || '' }),
        confirmText: this.fmt('orders.delete'),
        confirmColor: '#E05A4E',
        cancelText: this.fmt('orders.cancel'),
        success: async (r) => {
          if (!r.confirm) return
          try {
            const res = await api.deleteOrder(this.orderNo)
            if (res.code === 0) {
              uni.showToast({ title: this.fmt('orders.deleteSuccess'), icon: 'none' })
              setTimeout(() => uni.navigateBack(), 600)
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
    openRefundForm() {
      this.refundReasonInput = ''
      this.showRefundForm = true
    },
    closeRefundForm() {
      if (this.submitting) return
      this.showRefundForm = false
    },
    async submitRefund() {
      if (this.submitting) return
      this.submitting = true
      try {
        const res = await api.refundRequest(this.orderNo, this.refundReasonInput.trim() || undefined)
        if (res.code === 0) {
          this.closeRefundForm()
          uni.showToast({ title: this.fmt('orders.refundAppliedToast'), icon: 'none' })
          this.order.refundStatus = 'requested'
          this.order.refundReason = this.refundReasonInput.trim()
          this.load()
        } else if (res.code === 401) {
          uni.navigateTo({ url: '/pages/login/login' })
        } else {
          uni.showToast({ title: res.message || this.fmt('orders.networkError'), icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: this.fmt('orders.networkError'), icon: 'none' })
      } finally {
        this.submitting = false
      }
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style lang="scss" scoped>
.od-page {
  min-height: 100vh;
  background: $bg-page;
  padding: 0 $page-pad 40rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.empty-title {
  font-size: 30rpx;
  color: $ink-2;
}

.empty-btn {
  margin-top: 40rpx;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  padding: 20rpx 64rpx;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;

  &--hover {
    transform: scale(0.96);
  }
}

.empty-link {
  margin-top: 28rpx;
  font-size: 24rpx;
  color: $brand;
}

.hero {
  margin-top: 24rpx;
  background: $gradient-brand;
  border-radius: $radius-lg;
  padding: 32rpx;
  display: flex;
  align-items: center;
  box-shadow: $shadow-brand;
}

.hero-flag {
  width: 92rpx;
  height: 92rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.hero-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-info {
  flex: 1;
  margin-left: 22rpx;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.hero-status {
  align-self: flex-start;
  font-size: 20rpx;
  font-weight: 700;
  padding: 4rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;

  &.done {
    background: rgba(255, 255, 255, 0.9);
    color: #0D9488;
  }

  &.pending,
  &.activate {
    color: #ffffff;
  }

  &.refunded {
    background: rgba(255, 255, 255, 0.9);
    color: $coral;
  }
}

.hero-name {
  margin-top: 12rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-meta {
  margin-top: 6rpx;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.85);
}

.hero-price {
  font-size: 36rpx;
  font-weight: 800;
  color: #ffffff;
  margin-left: 16rpx;
}

.card {
  margin-top: 24rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-sm;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.ct-txt {
  font-size: 28rpx;
  font-weight: 800;
  color: $ink;
}

.ct-status {
  font-size: 20rpx;
  font-weight: 700;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;

  &.activated {
    color: #0D9488;
    background: $teal-light;
  }

  &.pending {
    color: #D97706;
    background: $sun-light;
  }
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16rpx 0;
  border-bottom: 1rpx solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.row-label {
  flex-shrink: 0;
  font-size: 24rpx;
  color: $ink-3;
  margin-right: 24rpx;
}

.row-value {
  font-size: 24rpx;
  color: $ink-2;
  text-align: right;
  word-break: break-all;
  line-height: 1.5;

  &.mono {
    font-family: monospace;
  }
}

.copyable {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  word-break: break-all;
}

.copy-hint {
  flex-shrink: 0;
  margin-left: 12rpx;
  font-size: 20rpx;
  color: $brand;
}

.bottom-cta {
  margin-top: 36rpx;
}

.pay-btn {
  background: $gradient-brand;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
  padding: 26rpx 0;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;

  &--hover {
    transform: scale(0.97);
  }
}

.del-btn {
  margin-top: 20rpx;
  background: #ffffff;
  color: $coral;
  border: 2rpx solid $coral;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 999rpx;

  &--hover {
    transform: scale(0.97);
  }
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}

.refund-banner {
  display: flex;
  flex-direction: column;
}

.refund-banner-head {
  display: flex;
  align-items: center;
}

.refund-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  margin-right: 14rpx;
}

.refund-banner-title {
  font-size: 28rpx;
  font-weight: 800;
  color: $ink;
}

.refund-banner--pending {
  border-left: 6rpx solid #D97706;

  .refund-dot {
    background: #D97706;
  }
}

.refund-banner--rejected {
  border-left: 6rpx solid $coral;

  .refund-dot {
    background: $coral;
  }
}

.refund-banner-sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $ink-3;
  line-height: 1.6;
}

.refund-banner-label {
  font-weight: 600;
  color: $ink-2;
}

.refund-btn {
  background: #ffffff;
  color: $coral;
  border: 2rpx solid $coral;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 999rpx;

  &--hover {
    transform: scale(0.97);
  }
}

.popup-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup {
  width: 600rpx;
  background: $bg-card;
  border-radius: $radius-xl;
  padding: 40rpx;
}

.popup-title {
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
  text-align: center;
}

.popup-input {
  margin-top: 28rpx;
  width: 100%;
  height: 180rpx;
  background: $bg-page;
  border: 2rpx solid $line;
  border-radius: $radius;
  padding: 20rpx;
  font-size: 26rpx;
  color: $ink;
  box-sizing: border-box;
}

.popup-actions {
  margin-top: 32rpx;
  display: flex;
  gap: 20rpx;
}

.popup-btn {
  flex: 1;
  text-align: center;
  font-size: 28rpx;
  font-weight: 700;
  padding: 22rpx 0;
  border-radius: 999rpx;

  &.cancel {
    border: 2rpx solid $line;
    color: $ink-3;
  }

  &.submit {
    background: $gradient-brand;
    color: #ffffff;
  }

  &.disabled {
    opacity: 0.6;
  }
}
</style>