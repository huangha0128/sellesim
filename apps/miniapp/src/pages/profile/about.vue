<template>
  <view class="about-page">
    <!-- 顶部品牌区 -->
    <view class="page-hero">
      <view class="hero-logo">
        <image class="hero-logo-img" src="/static/icons/hero-avatar.png" mode="aspectFit" />
      </view>
      <text class="hero-name">YYeSim</text>
      <text class="hero-slogan">{{ $t('about.slogan') }}</text>
    </view>

    <view class="page-body">
      <!-- 应用信息卡片 -->
      <view class="info-card">
        <view class="info-row">
          <text class="info-label">{{ $t('about.version') }}</text>
          <text class="info-value">v1.0.0</text>
        </view>
        <view class="info-desc">
          <text class="info-desc-title">{{ $t('about.introTitle') }}</text>
          <text class="info-desc-txt">{{ $t('about.introText') }}</text>
        </view>
        <view class="info-tags">
          <view class="info-tag">
            <text class="info-tag-num">200+</text>
            <text class="info-tag-label">{{ $t('about.tagRegions') }}</text>
          </view>
          <view class="info-tag">
            <text class="info-tag-num">4G/5G</text>
            <text class="info-tag-label">{{ $t('about.tagSpeed') }}</text>
          </view>
          <view class="info-tag">
            <text class="info-tag-num">24h</text>
            <text class="info-tag-label">{{ $t('about.tagSupport') }}</text>
          </view>
        </view>
      </view>

      <!-- 协议文档入口 -->
      <view class="doc-card">
        <view
          v-for="doc in docs"
          :key="doc.type"
          class="doc-item"
          hover-class="doc-item--hover"
          @tap="goLegal(doc.type)"
        >
          <view class="doc-icon-wrap" :class="doc.theme">
            <image class="doc-icon" :src="doc.icon" mode="aspectFit" />
          </view>
          <view class="doc-info">
            <text class="doc-title">{{ doc.title }}</text>
            <text class="doc-sub">{{ doc.sub }}</text>
          </view>
          <text class="doc-arrow">›</text>
        </view>
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
      docs: []
    }
  },
  onShow() {
    setNavTitle('pageTitle.about')
    this.buildDocs()
  },
  created() {
    this.buildDocs()
  },
  methods: {
    buildDocs() {
      this.docs = [
        {
          type: 'agreement',
          icon: '/static/icons/prof-order.png',
          theme: 'ic-blue',
          title: this.$t('about.docAgreement'),
          sub: this.$t('about.docAgreementSub')
        },
        {
          type: 'privacy',
          icon: '/static/icons/feat-shield.png',
          theme: 'ic-green',
          title: this.$t('about.docPrivacy'),
          sub: this.$t('about.docPrivacySub')
        },
        {
          type: 'refund',
          icon: '/static/icons/feat-clock.png',
          theme: 'ic-orange',
          title: this.$t('about.docRefund'),
          sub: this.$t('about.docRefundSub')
        }
      ]
    },
    goLegal(type) {
      uni.navigateTo({ url: `/pages/profile/legal?type=${type}` })
    }
  }
}
</script>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  background: $bg-page;
}

/* ============ 顶部品牌区 ============ */
.page-hero {
  background: $gradient-brand;
  padding: 64rpx $page-pad 72rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-logo {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 4rpx solid rgba(255, 255, 255, 0.5);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-logo-img {
  width: 100%;
  height: 100%;
}

.hero-name {
  margin-top: 24rpx;
  font-size: 44rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.hero-slogan {
  margin-top: 10rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* ============ 应用信息卡片 ============ */
.page-body {
  padding: 0 24rpx;
  margin-top: -28rpx;
  position: relative;
}

.info-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 32rpx 30rpx;
  box-shadow: $shadow-sm;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid $line;
}

.info-label {
  font-size: 26rpx;
  color: $ink-2;
}

.info-value {
  font-size: 26rpx;
  font-weight: 600;
  color: $brand;
}

.info-desc {
  padding: 26rpx 0;
  border-bottom: 1rpx solid $line;
}

.info-desc-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
  display: block;
}

.info-desc-txt {
  margin-top: 14rpx;
  font-size: 25rpx;
  color: $ink-2;
  line-height: 1.7;
  display: block;
}

.info-tags {
  display: flex;
  padding-top: 26rpx;
}

.info-tag {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.info-tag-num {
  font-size: 30rpx;
  font-weight: 800;
  color: $brand;
}

.info-tag-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $ink-3;
}

/* ============ 协议文档入口 ============ */
.doc-card {
  margin-top: 24rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 8rpx 0;
  box-shadow: $shadow-sm;
}

.doc-item {
  display: flex;
  align-items: center;
  padding: 28rpx 28rpx;
  border-bottom: 1rpx solid $line;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &--hover {
    background: $bg-soft;
  }
}

.doc-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 24rpx;

  &.ic-blue {
    background: $brand-blue-light;
  }

  &.ic-green {
    background: $teal-light;
  }

  &.ic-orange {
    background: $sun-light;
  }
}

.doc-icon {
  width: 34rpx;
  height: 34rpx;
}

.doc-info {
  flex: 1;
}

.doc-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $ink;
  display: block;
}

.doc-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $ink-3;
  display: block;
}

.doc-arrow {
  font-size: 34rpx;
  color: $ink-3;
  margin-left: 16rpx;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
