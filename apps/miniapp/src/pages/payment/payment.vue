<template>
  <view class="payment-page">
    <view v-if="!paid" class="pay-content">
      <view class="amount-box">
        <text class="amount-label">{{ $t('payment.amountLabel') }}</text>
        <view class="amount">
          <text class="a-sym">¥</text>
          <text class="a-num">{{ amountText }}</text>
        </view>
        <text class="amount-sub">{{ $t('payment.orderNoPrefix', { no: orderNo }) }}</text>
      </view>

      <view class="order-card">
        <view class="oc-row">
          <text class="oc-label">{{ $t('payment.goodsLabel') }}</text>
          <text class="oc-value">{{ orderLabel }}</text>
        </view>
        <view class="oc-row">
          <text class="oc-label">{{ $t('payment.payMethodLabel') }}</text>
          <text class="oc-value">{{ $t('checkout.alipayName') }}</text>
        </view>
      </view>

      <view class="alipay-sheet">
        <view class="alipay-logo">支</view>
        <view class="alipay-info">
          <text class="alipay-name">{{ $t('checkout.alipayName') }}</text>
          <text class="alipay-balance">{{ $t('payment.alipayBalance') }}</text>
        </view>
        <view class="alipay-arrow">›</view>
      </view>

      <view class="pay-btn" hover-class="pay-btn--hover" @click="pay">{{ $t('payment.payNow') }}</view>
      <view class="pay-cancel" @click="goBack">{{ $t('payment.cancel') }}</view>

      <view class="pay-note">{{ useRealPayment ? $t('payment.noteReal') : $t('payment.noteDemo') }}</view>
    </view>

    <view v-else class="success-wrap">
      <view class="success-circle">
        <image class="check-mark" src="/static/icons/co-check.png" mode="aspectFit" />
      </view>
      <text class="success-title">{{ $t('payment.success') }}</text>
      <text class="success-sub">{{ $t('payment.successSub') }}</text>

      <view class="success-card">
        <view class="sc-row">
          <text class="sc-label">{{ $t('payment.orderNo') }}</text>
          <text class="sc-value">{{ orderNo }}</text>
        </view>
        <view class="sc-row">
          <text class="sc-label">{{ $t('payment.pkgLabel') }}</text>
          <text class="sc-value">{{ orderLabel }}</text>
        </view>
        <view class="sc-row">
          <text class="sc-label">{{ $t('payment.actualAmount') }}</text>
          <text class="sc-value sc-price">¥{{ amountText }}</text>
        </view>
      </view>

      <view class="success-actions">
        <view class="sa-primary" hover-class="sa-primary--hover" @click="goEsims">{{ $t('payment.viewEsims') }}</view>
        <view class="sa-secondary" hover-class="sa-secondary--hover" @click="goHome">{{ $t('payment.backHome') }}</view>
      </view>
    </view>

    <view v-if="paying" class="mask">
      <view class="mask-card">
        <view class="spinner"></view>
        <text class="mask-title">{{ $t('payment.paying') }}</text>
        <text class="mask-sub">{{ $t('payment.payingSub') }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'
import { setNavTitle } from '@/locales'

export default {
  data() {
    return {
      orderNo: '',
      order: null,
      paying: false,
      paid: false,
      useRealPayment: true
    }
  },
  computed: {
    amountText() {
      if (!this.order) return '0'
      const n = Number(this.order.price)
      return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
    },
    orderLabel() {
      if (!this.order) return ''
      return this.$t('payment.orderLabel', { name: this.order.countryName, gb: this.order.gb, days: this.order.days })
    }
  },
  async onLoad(options) {
    this.orderNo = options.orderNo || ''
    setNavTitle('pageTitle.payment')
    this.useRealPayment = this.getUseRealPayment()
    try {
      const res = await api.getOrder(this.orderNo)
      if (res.code === 0 && res.data.order) {
        const o = res.data.order
        // 订单自带套餐快照字段，不再嵌套 package
        const order = {
          id: o.id,
          orderNo: o.orderNo,
          pkgId: o.pkgId,
          email: o.email,
          payMethod: o.payMethod,
          status: o.status,
          price: o.price,
          paidAt: o.paidAt,
          createdAt: o.createdAt,
          countryName: o.countryName || o.pkgName || o.countryCode || this.$t('common.unknown'),
          countryCode: o.countryCode,
          gb: o.gb,
          days: o.days,
          flag: o.countryCode || '',
        }
        store.updateOrder(this.orderNo, order)
        this.order = order
      }
    } catch (e) {
      this.order = store.orders.find((o) => o.orderNo === this.orderNo) || null
    }
    if (!this.order) {
      uni.showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => this.goBack(), 1200)
      return
    }
    this.paid = this.order.status === 'paid'
  },
  methods: {
    getUseRealPayment() {
      // 已接入真实支付宝支付，始终走真实支付流程
      return true
    },
    async realPay() {
      this.paying = true
      try {
        const res = await api.createPayment(this.orderNo, store.openId, store.userIdStr)
        console.log("res: ",res)
        if (res.code === 0) {
          if (res.data.paid) {
            store.updateOrder(this.orderNo, { status: 'paid' })
            this.paying = false
            this.paid = true
            return
          }
          const tradeNo = res.data.tradeNo
          if (!tradeNo) {
            this.paying = false
            uni.showToast({ title: '未获取到支付参数', icon: 'none' })
            return
          }
          // #ifdef MP-ALIPAY
          // 支付宝小程序内支付：调起收银台
          this.paying=false;
          my.tradePay({
            tradeNO: tradeNo,
            success: (payRes) => {
              console.log("success: ",payRes)
              if (payRes.resultCode === '9000') {
                // 支付成功，以异步通知为准刷新订单
                this.refreshOrder()
              } else if (payRes.resultCode === '6001' || payRes.resultCode === '4000') {
                this.paying = false
                uni.showToast({ title: '已取消支付', icon: 'none' })
              } else {
                this.paying = false
                uni.showToast({ title: `支付失败(${payRes.resultCode || '?'}:${payRes.memo || ''})`, icon: 'none', duration: 4000 })
                // uni.showToast({ title: '支付失败', icon: 'none' })
              }
            },
            fail: (e) => {
              console.log("fail: ",e)
              this.paying = false
              // uni.showToast({ title: '支付失败，请重试', icon: 'none' })
              const msg = (err && (err.resultCode || err.errorMessage || err.message)) || '请重试'
              uni.showToast({ title: `收银台拉起失败(${msg})`, icon: 'none', duration: 4000 })
            },
          })

          console.log("realPay exe success")
          // #endif
          // #ifndef MP-ALIPAY
          this.paying = false
          uni.showToast({ title: '请在支付宝小程序内支付', icon: 'none' })
          // #endif
        } else {
          this.paying = false
          uni.showToast({ title: res.message || '创建支付失败', icon: 'none' })
        }
      } catch (e) {
        this.paying = false
        uni.showToast({ title: '创建支付失败，请重试', icon: 'none' })
      }
    },
    async refreshOrder() {
      // 支付完成后拉取最新订单，确认是否已支付
      try {
        const res = await api.getOrder(this.orderNo)
        if (res.code === 0 && res.data.order) {
          const o = res.data.order
          if (o.status === 'paid') {
            store.updateOrder(this.orderNo, { status: 'paid', paidAt: o.paidAt })
            this.order = { ...this.order, status: 'paid', paidAt: o.paidAt }
            this.paying = false
            this.paid = true
          } else {
            this.paying = false
            uni.showToast({ title: '支付确认中，请稍后在eSIM页面查看', icon: 'none' })
          }
        } else {
          this.paying = false
          uni.showToast({ title: '支付确认中，请稍后再试', icon: 'none' })
        }
      } catch (e) {
        this.paying = false
        uni.showToast({ title: '支付确认中，请稍后再试', icon: 'none' })
      }
    },
    async pay() {
      if (this.paying) return
      if (!this.order) {
        uni.showToast({ title: '订单信息异常', icon: 'none' })
        return
      }
      await this.realPay()
    },
    goEsims() {
      uni.switchTab({
        url: '/pages/esims/esims',
        fail: () => uni.reLaunch({ url: '/pages/esims/esims' })
      })
    },
    goHome() {
      uni.switchTab({
        url: '/pages/index/index',
        fail: () => uni.reLaunch({ url: '/pages/index/index' })
      })
    },
    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/index/index' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.payment-page {
  min-height: 100vh;
  background: $bg-page;
}

.pay-content {
  padding: 20rpx $page-pad;
}

.amount-box {
  background: $gradient-brand;
  border-radius: $radius-xl;
  padding: 48rpx 0 56rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: $shadow-brand;
}

.amount-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.amount {
  display: flex;
  align-items: baseline;
  color: #ffffff;
  font-weight: 800;
  margin-top: 12rpx;
}

.a-sym {
  font-size: 36rpx;
}

.a-num {
  font-size: 88rpx;
  line-height: 1.1;
}

.amount-sub {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
}

.order-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 12rpx 32rpx;
  margin-top: 24rpx;
  box-shadow: $shadow-sm;
}

.oc-row {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.oc-label {
  font-size: 25rpx;
  color: $ink-2;
}

.oc-value {
  font-size: 25rpx;
  color: $ink;
  font-weight: 600;
  max-width: 60%;
  text-align: right;
}

.alipay-sheet {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx 32rpx;
  margin-top: 24rpx;
  box-shadow: $shadow-sm;
  border: 2rpx solid rgba(22, 119, 255, 0.25);
}

.alipay-logo {
  width: 80rpx;
  height: 80rpx;
  border-radius: 22rpx;
  background: #1677FF;
  color: #ffffff;
  font-size: 42rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alipay-info {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}

.alipay-name {
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.alipay-balance {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.alipay-arrow {
  font-size: 36rpx;
  color: $ink-3;
}

.pay-btn {
  margin-top: 48rpx;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
  text-align: center;
  padding: 28rpx 0;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.98);
  }
}

.pay-cancel {
  margin-top: 28rpx;
  text-align: center;
  font-size: 26rpx;
  color: $ink-3;
  padding: 12rpx;
}

.pay-note {
  margin-top: 32rpx;
  text-align: center;
  font-size: 21rpx;
  color: $ink-3;
}

/* 成功页 */
.success-wrap {
  padding: 60rpx $page-pad;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.success-circle {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: $teal;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16rpx 40rpx rgba(20, 184, 166, 0.4);
  animation: pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.check-mark {
  color: #ffffff;
  font-size: 80rpx;
  font-weight: 800;
}

@keyframes pop-in {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.success-title {
  margin-top: 36rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: $ink;
}

.success-sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: $ink-2;
}

.success-card {
  width: 100%;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 12rpx 32rpx;
  margin-top: 48rpx;
  box-shadow: $shadow-sm;
}

.sc-row {
  display: flex;
  justify-content: space-between;
  padding: 22rpx 0;
  border-bottom: 1rpx solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.sc-label {
  font-size: 25rpx;
  color: $ink-2;
}

.sc-value {
  font-size: 25rpx;
  color: $ink;
  font-weight: 600;
}

.sc-price {
  color: $coral;
}

.success-actions {
  width: 100%;
  margin-top: 56rpx;
}

.sa-primary {
  background: $gradient-brand;
  color: #ffffff;
  text-align: center;
  font-size: 30rpx;
  font-weight: 700;
  padding: 28rpx 0;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.98);
  }
}

.sa-secondary {
  margin-top: 24rpx;
  text-align: center;
  font-size: 27rpx;
  color: $ink-2;
  padding: 24rpx 0;
  border-radius: 999rpx;
  border: 1rpx solid $line;
  background: $bg-card;
}

/* 支付中 */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(30, 27, 75, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
}

.mask-card {
  background: #ffffff;
  border-radius: $radius-lg;
  padding: 56rpx 72rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.spinner {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 6rpx solid $brand-light;
  border-top-color: $brand;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.mask-title {
  margin-top: 28rpx;
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.mask-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $ink-3;
}
</style>
