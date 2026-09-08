<template>
  <view class="faq-page">
    <view class="page-hero">
      <text class="hero-title">{{ $t('faq.title') }}</text>
      <text class="hero-sub">{{ $t('faq.sub') }}</text>
    </view>

    <view class="page-body">
      <view class="faq-card">
        <view v-for="(f, i) in items" :key="i" class="faq-item" @tap="toggle(i)">
          <view class="faq-q">
            <text class="faq-q-txt">{{ f.q }}</text>
            <text class="faq-arrow">{{ open === i ? '⌃' : '⌄' }}</text>
          </view>
          <text v-if="open === i" class="faq-a">{{ f.a }}</text>
        </view>
      </view>

      <view class="guide-card" hover-class="guide-card--hover" @tap="goGuide">
        <view class="guide-info">
          <text class="guide-title">{{ $t('faq.guideEntry') }}</text>
          <text class="guide-sub">{{ $t('faq.guideEntrySub') }}</text>
        </view>
        <text class="guide-arrow">›</text>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle, tRaw } from '@/locales'

export default {
  data() {
    return {
      open: 0,
      items: []
    }
  },
  onShow() {
    setNavTitle('pageTitle.faq')
    this.buildItems()
  },
  created() {
    // uni-app 编译后 methods 无法引用外层 import 自由变量，
    // 需挂到实例上，统一用 this.tRaw 访问
    this.tRaw = tRaw
    this.buildItems()
  },
  methods: {
    buildItems() {
      this.items = this.tRaw('faq.items') || []
    },
    toggle(i) {
      this.open = this.open === i ? -1 : i
    },
    goGuide() {
      uni.navigateTo({ url: '/pages/guide/guide' })
    }
  }
}
</script>

<style lang="scss" scoped>
.faq-page {
  min-height: 100vh;
  background: $bg-page;
}

.page-hero {
  background: $gradient-brand;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-title {
  font-size: 42rpx;
  font-weight: 800;
  color: #ffffff;
}

.hero-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

.page-body {
  padding: 0 24rpx;
  margin-top: -24rpx;
  position: relative;
}

.faq-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 12rpx 30rpx;
  box-shadow: $shadow-sm;
}

.faq-item {
  border-bottom: 1rpx solid $line;
  padding: 24rpx 0;

  &:last-child {
    border-bottom: none;
  }
}

.faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.faq-q-txt {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: $ink;
}

.faq-arrow {
  font-size: 30rpx;
  color: $ink-3;
  margin-left: 16rpx;
}

.faq-a {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.7;
}

.guide-card {
  margin-top: 24rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  box-shadow: $shadow-sm;
  display: flex;
  align-items: center;
  transition: background 0.15s ease;

  &--hover {
    background: $brand-lighter;
  }
}

.guide-info {
  flex: 1;
}

.guide-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
  display: block;
}

.guide-sub {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-3;
  display: block;
}

.guide-arrow {
  font-size: 36rpx;
  color: $ink-3;
  margin-left: 16rpx;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
