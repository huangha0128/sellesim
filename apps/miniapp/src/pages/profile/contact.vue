<template>
  <view class="contact-page">
    <!-- 顶部品牌区 -->
    <view class="page-hero">
      <view class="hero-icon-wrap">
        <image class="hero-icon" src="/static/icons/prof-help.png" mode="aspectFit" />
      </view>
      <text class="hero-title">{{ $t('contact.heroTitle') }}</text>
      <text class="hero-sub">{{ $t('contact.heroSub') }}</text>
    </view>

    <view class="page-body">
      <!-- 官方邮箱卡片 -->
      <view class="card email-card">
        <text class="card-title">{{ $t('contact.emailLabel') }}</text>
        <view class="email-box">
          <text class="email-text">support@bjyyxx.com</text>
          <view class="copy-btn" hover-class="copy-btn--hover" @tap="copyEmail">
            <image class="copy-icon" src="/static/icons/esim-copy.png" mode="aspectFit" />
            <text class="copy-txt">{{ $t('contact.copyEmail') }}</text>
          </view>
        </view>
        <text class="email-tip">{{ $t('contact.responseTip') }}</text>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle } from '@/locales'

export default {
  data() {
    return {
      email: 'support@bjyyxx.com'
    }
  },
  onShow() {
    setNavTitle('pageTitle.contact')
  },
  methods: {
    copyEmail() {
      uni.setClipboardData({
        data: this.email,
        success: () => {
          uni.showToast({ title: this.$t('contact.copied'), icon: 'success' })
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.contact-page {
  min-height: 100vh;
  background: $bg-page;
}

/* ============ 顶部品牌区 ============ */
.page-hero {
  background: $gradient-canvas;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: $shadow-sm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-icon {
  width: 56rpx;
  height: 56rpx;
}

.hero-title {
  margin-top: 20rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-sub {
  margin-top: 10rpx;
  font-size: 25rpx;
  color: $ink-3;
}

/* ============ 邮箱卡片 ============ */
.page-body {
  padding: 0 24rpx;
  margin-top: -24rpx;
  position: relative;
}

.card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  box-shadow: $shadow-sm;
}

.card-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  display: block;
}

.email-box {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  background: $bg-soft;
  border-radius: $radius;
  padding: 26rpx 28rpx;
}

.email-text {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
  color: $ink;
  word-break: break-all;
}

.copy-btn {
  display: flex;
  align-items: center;
  margin-left: 20rpx;
  padding: 10rpx 22rpx;
  background: $brand-light;
  border-radius: 999rpx;
  flex-shrink: 0;
  transition: opacity 0.15s ease;

  &--hover {
    opacity: 0.6;
  }
}

.copy-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 8rpx;
}

.copy-txt {
  font-size: 22rpx;
  color: $brand;
  font-weight: 600;
}

.email-tip {
  margin-top: 20rpx;
  font-size: 23rpx;
  color: $ink-3;
  line-height: 1.7;
  display: block;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>