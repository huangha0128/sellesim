<template>
  <view class="checkout-page">
    <view v-if="pkg" class="checkout-body">
      <view class="section-card">
        <view class="order-head">
          <text class="order-title">商品信息</text>
        </view>
        <view class="pkg-summary">
          <view class="sum-flag">
            <image class="sum-flag-img" :src="getFlagImage(pkg.countryCode)" mode="aspectFit" />
          </view>
          <view class="sum-main">
            <text class="sum-name">{{ pkg.countryName }} eSIM</text>
            <text class="sum-meta">{{ pkg.gb }}GB · {{ pkg.days }}天 · {{ pkg.network }}</text>
          </view>
          <view class="sum-price">¥{{ priceNum }}</view>
        </view>
      </view>

      <view class="section-card">
        <view class="form-item">
          <text class="form-label">接收邮箱</text>
          <input
            v-model="email"
            class="form-input"
            placeholder="用于接收 eSIM 激活信息"
            type="text"
          />
        </view>
        <view class="form-tip">
          <image src="/static/icons/co-info.png" mode="aspectFit" style="width: 28rpx; height: 28rpx; margin-right: 8rpx; vertical-align: middle;" />
          <text>购买后激活码将自动发放至「我的 eSIM」，邮箱仅用于消息提醒</text>
        </view>
      </view>

      <view class="section-card">
        <view class="order-head">
          <text class="order-title">支付方式</text>
        </view>
        <view class="pay-item" :class="{ active: payMethod === 'alipay' }" @click="payMethod = 'alipay'">
          <view class="pay-logo alipay">支</view>
          <view class="pay-info">
            <text class="pay-name">支付宝</text>
            <text class="pay-desc">安全快捷 · 支持余额/花呗/银行卡</text>
          </view>
          <view class="pay-check" :class="{ checked: payMethod === 'alipay' }">
            <image v-if="payMethod === 'alipay'" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
          </view>
        </view>
        <view class="pay-item disabled">
          <view class="pay-logo wechat">微</view>
          <view class="pay-info">
            <text class="pay-name">微信支付</text>
            <text class="pay-desc">即将上线</text>
          </view>
          <view class="pay-soon">敬请期待</view>
        </view>
      </view>

      <view class="section-card">
        <view class="amount-row">
          <text class="amount-label">商品金额</text>
          <text class="amount-value">¥{{ priceNum }}</text>
        </view>
        <view class="amount-row">
          <text class="amount-label">优惠</text>
          <text class="amount-value free">- ¥0</text>
        </view>
        <view class="amount-row total">
          <text class="amount-label">应付总额</text>
          <view class="total-price">
            <text class="total-symbol">¥</text>
            <text class="total-num">{{ priceNum }}</text>
          </view>
        </view>
      </view>

      <view class="agree-row" @click="agreed = !agreed">
        <view class="agree-box" :class="{ checked: agreed }">
          <image v-if="agreed" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
        </view>
        <text class="agree-txt">我已阅读并同意《购买服务协议》与《eSIM 使用须知》</text>
      </view>

      <view class="footer-safe"></view>
    </view>

    <view v-if="pkg" class="bottom-bar">
      <view class="pay-total">
        <text class="pay-total-label">实付</text>
        <view class="pay-total-price">
          <text class="pts">¥</text>
          <text class="ptn">{{ priceNum }}</text>
        </view>
      </view>
      <view
        class="submit-btn"
        :class="{ disabled: !agreed || submitting }"
        hover-class="submit-btn--hover"
        @click="submit"
      >
        {{ submitting ? '提交中...' : '提交订单' }}
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'

export default {
  data() {
    return {
      pkgId: '',
      pkg: null,
      email: '',
      payMethod: 'alipay',
      agreed: true,
      submitting: false,
      store
    }
  },
  computed: {
    priceNum() {
      const n = Number(this.pkg.price)
      return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
    }
  },
  onLoad(options) {
    this.pkgId = options.pkgId || ''
    this.load()
  },
  methods: {
    getFlagImage(code) {
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    async load() {
      uni.showLoading({ title: '加载中', mask: true })
      try {
        const res = await api.getPackageDetail(this.pkgId)
        this.pkg = res.data.pkg
      } finally {
        uni.hideLoading()
      }
    },
    async submit() {
      if (!this.agreed) {
        uni.showToast({ title: '请先阅读并同意协议', icon: 'none' })
        return
      }
      if (!this.email || !this.email.includes('@')) {
        uni.showToast({ title: '请填写正确的邮箱', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const res = await api.createOrder({
          pkgId: this.pkgId,
          email: this.email,
          payMethod: this.payMethod
        })
        if (res.code === 0) {
          const order = {
            ...res.data.order,
            countryName: this.pkg.countryName,
            gb: this.pkg.gb,
            days: this.pkg.days,
            flag: this.pkg.flag,
          }
          store.pushOrder(order)
          uni.navigateTo({ url: `/pages/payment/payment?orderNo=${res.data.order.orderNo}` })
        } else {
          uni.showToast({ title: res.message || '下单失败', icon: 'none' })
          this.submitting = false
        }
      } catch (e) {
        this.submitting = false
        uni.showToast({ title: '网络错误，请重试', icon: 'none' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.checkout-page {
  min-height: 100vh;
  background: $bg-page;
}

.checkout-body {
  padding: 0 $page-pad;
  padding-bottom: 40rpx;
}

.section-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx 32rpx;
  margin-top: 24rpx;
  box-shadow: $shadow-sm;
}

.order-head {
  margin-bottom: 24rpx;
}

.order-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.pkg-summary {
  display: flex;
  align-items: center;
}

.sum-flag {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.sum-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sum-main {
  flex: 1;
  margin-left: 24rpx;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sum-name {
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.sum-meta {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-2;
}

.sum-price {
  font-size: 32rpx;
  font-weight: 800;
  color: $coral;
}

.form-item {
  display: flex;
  align-items: center;
}

.form-label {
  font-size: 27rpx;
  color: $ink;
  font-weight: 600;
  width: 150rpx;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  height: 76rpx;
  background: $bg-soft;
  border-radius: $radius-sm;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: $ink;
}

.form-tip {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.pay-item {
  display: flex;
  align-items: center;
  border: 2rpx solid $line;
  border-radius: $radius;
  padding: 24rpx;
  margin-bottom: 20rpx;
  transition: all 0.2s ease;

  &.active {
    border-color: $brand;
    background: $brand-lighter;
  }

  &.disabled {
    opacity: 0.55;
  }
}

.pay-logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 800;
  flex-shrink: 0;

  &.alipay {
    background: #1677FF;
  }

  &.wechat {
    background: #07C160;
  }
}

.pay-info {
  flex: 1;
  margin-left: 22rpx;
  display: flex;
  flex-direction: column;
}

.pay-name {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}

.pay-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}

.pay-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &.checked {
    background: $brand;
    border-color: $brand;
  }
}

.check-icon {
  width: 24rpx;
  height: 24rpx;
}

.pay-soon {
  font-size: 22rpx;
  color: $ink-3;
  background: $bg-soft;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;

  &.total {
    border-top: 1rpx solid $line;
    margin-top: 10rpx;
    padding-top: 26rpx;
  }
}

.amount-label {
  font-size: 26rpx;
  color: $ink-2;
}

.amount-value {
  font-size: 26rpx;
  color: $ink;
  font-weight: 600;

  &.free {
    color: $teal;
  }
}

.total-price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 800;
}

.total-symbol {
  font-size: 26rpx;
}

.total-num {
  font-size: 44rpx;
  line-height: 1;
}

.agree-row {
  display: flex;
  align-items: flex-start;
  margin-top: 28rpx;
  padding: 0 8rpx;
}

.agree-box {
  width: 40rpx;
  height: 40rpx;
  border-radius: 10rpx;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
  transition: all 0.2s ease;

  &.checked {
    background: $brand;
    border-color: $brand;
  }
}

.agree-txt {
  flex: 1;
  font-size: 22rpx;
  color: $ink-3;
  line-height: 1.6;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  padding: 20rpx $page-pad;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -6rpx 24rpx rgba(15, 84, 140, 0.08);
  z-index: 10;
}

.pay-total {
  flex: 1;
  display: flex;
  align-items: baseline;
}

.pay-total-label {
  font-size: 26rpx;
  color: $ink-2;
  margin-right: 12rpx;
}

.pay-total-price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 800;
}

.pts {
  font-size: 26rpx;
}

.ptn {
  font-size: 50rpx;
  line-height: 1;
}

.submit-btn {
  background: $gradient-brand;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
  padding: 26rpx 64rpx;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: all 0.15s ease;

  &.disabled {
    opacity: 0.5;
    box-shadow: none;
  }

  &--hover {
    transform: scale(0.97);
  }
}

.footer-safe {
  height: 200rpx;
}
</style>
