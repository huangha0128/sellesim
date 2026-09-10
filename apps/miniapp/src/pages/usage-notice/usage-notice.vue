<template>
  <view class="un-page">
    <view class="un-hero">
      <text class="uh-eyebrow">{{ $t('usageNotice.eyebrow') }}</text>
      <text class="uh-title">{{ $t('usageNotice.title') }}</text>
      <text class="uh-sub">{{ $t('usageNotice.sub') }}</text>
    </view>

    <view class="un-body">
      <view v-for="(sec, i) in sections" :key="i" class="un-card">
        <view class="un-head">
          <text class="un-index">{{ i + 1 }}</text>
          <text class="un-title">{{ sec.title }}</text>
        </view>
        <view class="un-divider"></view>
        <view v-for="(item, j) in sec.items" :key="j" class="un-item">
          <text class="un-dot">·</text>
          <text class="un-txt">{{ item }}</text>
        </view>
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
      sections: []
    }
  },
  onShow() {
    setNavTitle('pageTitle.usageNotice')
    this.sections = this.tRaw('usageNotice.sections') || []
  },
  created() {
    this.tRaw = tRaw
    this.sections = this.tRaw('usageNotice.sections') || []
  }
}
</script>

<style lang="scss" scoped>
.un-page {
  min-height: 100vh;
  background: $bg-page;
}

.un-hero {
  background: $gradient-canvas;
  padding: 60rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.uh-eyebrow {
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: $tracking-label;
  color: $brand;
  text-transform: uppercase;
}

.uh-title {
  margin-top: 16rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: $ink;
}

.uh-sub {
  margin-top: 14rpx;
  font-size: 25rpx;
  color: $ink-3;
  text-align: center;
  line-height: 1.6;
}

.un-body {
  padding: 28rpx $page-pad 0;
}

.un-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;
}

.un-head {
  display: flex;
  align-items: center;
}

.un-index {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
  flex-shrink: 0;
}

.un-title {
  font-size: 29rpx;
  font-weight: 800;
  color: $ink;
}

.un-divider {
  height: 1rpx;
  background: $line;
  margin: 20rpx 0;
}

.un-item {
  display: flex;
  align-items: flex-start;
  margin-top: 14rpx;

  &:first-of-type {
    margin-top: 0;
  }
}

.un-dot {
  color: $brand;
  font-weight: 700;
  font-size: 26rpx;
  line-height: 1.7;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.un-txt {
  flex: 1;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.7;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>