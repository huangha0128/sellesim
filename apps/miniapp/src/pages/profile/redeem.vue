<template>
  <view class="redeem-page">
    <view class="page-hero">
      <text class="hero-title">{{ $t('coupon.redeemMenu') }}</text>
      <text class="hero-sub">{{ $t('coupon.redeemSub') }}</text>
    </view>

    <view class="page-body">
      <!-- 未登录 -->
      <view v-if="!store.isLoggedIn" class="card login-card">
        <text class="login-title">{{ $t('checkout.needLogin') }}</text>
        <view class="btn-primary" hover-class="btn-hover" @tap="goLogin">{{ $t('login.btn') }}</view>
      </view>

      <!-- 已登录 -->
      <block v-else>
        <view class="card">
          <view class="redeem-box">
            <input
              v-model="codeInput"
              class="code-input"
              :placeholder="$t('coupon.codePlaceholder')"
              type="text"
            />
          </view>
          <view class="actions">
            <view class="btn-primary" :class="{ 'btn-disabled': redeeming }" @tap="doRedeem">
              {{ $t('coupon.redeemBtn') }}
            </view>
          </view>
        </view>

        <view class="card tip-card">
          <image class="tip-icon" src="/static/icons/co-info.png" mode="aspectFit" />
          <text class="tip-txt">{{ $t('coupon.redeemTip') }}</text>
        </view>
      </block>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { store } from '@/store'
import { api } from '@/utils/api'
import { setNavTitle } from '@/locales'

export default {
  data() {
    return {
      store,
      codeInput: '',
      redeeming: false
    }
  },
  onShow() {
    setNavTitle('pageTitle.coupon')
  },
  methods: {
    goLogin() {
      uni.navigateTo({ url: '/pages/login/login' })
    },
    async doRedeem() {
      if (this.redeeming) return
      const code = (this.codeInput || '').trim()
      if (!code) {
        uni.showToast({ title: this.$t('coupon.codeEmpty'), icon: 'none' })
        return
      }
      this.redeeming = true
      try {
        const res = await api.redeemCoupon(code)
        if (res.code === 0) {
          this.codeInput = ''
          uni.showToast({ title: this.$t('coupon.redeemSuccess'), icon: 'success' })
        } else {
          uni.showToast({ title: res.message || this.$t('coupon.invalid'), icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: this.$t('common.networkError'), icon: 'none' })
      } finally {
        this.redeeming = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.redeem-page {
  min-height: 100vh;
  background: $bg-page;
}

.page-hero {
  background: $gradient-canvas;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-title {
  font-size: 42rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: $ink-3;
}

.page-body {
  padding: 0 24rpx;
  margin-top: -24rpx;
  position: relative;
}

.card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;
}

.login-card {
  padding: 56rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
  margin-bottom: 32rpx;
}

.redeem-box {
  margin-top: 8rpx;
}

.code-input {
  width: 100%;
  height: 88rpx;
  background: $bg-soft;
  border-radius: $radius;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: $ink;
  box-sizing: border-box;
}

.actions {
  margin-top: 28rpx;
}

.btn-primary {
  width: 100%;
  height: 88rpx;
  border-radius: $radius;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-brand;
  transition: opacity 0.15s ease;
  box-sizing: border-box;
}

.btn-hover {
  opacity: 0.85;
}

.btn-disabled {
  opacity: 0.6;
}

.tip-card {
  display: flex;
  align-items: flex-start;
}

.tip-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  margin-top: 4rpx;
  flex-shrink: 0;
}

.tip-txt {
  flex: 1;
  font-size: 23rpx;
  color: $ink-3;
  line-height: 1.7;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
