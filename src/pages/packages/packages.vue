<template>
  <view class="packages-page">
    <view v-if="country" class="country-head">
      <view class="head-flag">
        <text class="head-flag-emoji">{{ country.flag }}</text>
      </view>
      <view class="head-info">
        <text class="head-name">{{ country.name }}</text>
        <text class="head-intro">{{ country.intro }}</text>
        <view class="head-tags">
          <text class="head-tag">4G/5G</text>
          <text class="head-tag">免实名</text>
          <text class="head-tag">即买即用</text>
        </view>
      </view>
    </view>

    <view class="pkg-list">
      <view
        v-for="p in packages"
        :key="p.id"
        class="pkg-card"
        hover-class="pkg-card--hover"
        @click="goDetail(p.id)"
      >
        <view class="pkg-flag">
          <text class="pkg-flag-text">{{ p.flag }}</text>
        </view>
        <view class="pkg-main">
          <view class="pkg-head">
            <text class="pkg-country">{{ p.countryName }}</text>
            <view class="pkg-type">{{ p.type }}</view>
          </view>
          <view class="pkg-meta">
            <text class="pkg-meta-item">{{ p.dayOptions[0] }}-{{ p.dayOptions[p.dayOptions.length - 1] }}天可选</text>
            <text class="pkg-dot">·</text>
            <text class="pkg-meta-item">多种流量包</text>
          </view>
          <view class="pkg-coverage">{{ p.coverage }}</view>
        </view>
        <view class="pkg-right">
          <view class="pkg-price">
            <text class="pkg-price-symbol">¥</text>
            <text class="pkg-price-num">{{ fmtPrice(p.startPrice) }}</text>
            <text class="pkg-price-unit">起</text>
          </view>
          <view class="pkg-buy">
            <text>选购</text>
            <text class="pkg-arrow">›</text>
          </view>
        </view>
      </view>
      <view v-if="!loading && !packages.length" class="empty">
        <text class="empty-emoji">📡</text>
        <text class="empty-txt">该目的地暂未上架套餐</text>
      </view>
    </view>

    <view class="tip-bar">
      <text class="tip-icon">💡</text>
      <text class="tip-txt">购买后激活码将自动发放到「我的 eSIM」，扫码即可安装</text>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { COUNTRIES, REGIONS } from '@/mock/data'

export default {
  data() {
    return {
      code: '',
      country: null,
      packages: [],
      loading: true
    }
  },
  onLoad(options) {
    this.code = options.code || ''
    this.country =
      COUNTRIES.find((c) => c.code === this.code) ||
      REGIONS.find((c) => c.code === this.code) ||
      null
    if (this.country) {
      uni.setNavigationBarTitle({ title: this.country.name })
    }
    this.load()
  },
  methods: {
    fmtPrice(n) {
      const v = Number(n)
      return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)
    },
    async load() {
      this.loading = true
      try {
        const res = await api.getPackages(this.code)
        this.packages = res.data.packages
      } finally {
        this.loading = false
      }
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    }
  }
}
</script>

<style lang="scss" scoped>
.packages-page {
  min-height: 100vh;
  background: $bg-page;
  padding-bottom: 40rpx;
}

.country-head {
  display: flex;
  align-items: center;
  background: $gradient-brand;
  padding: 44rpx $page-pad;
  border-radius: 0 0 40rpx 40rpx;
}

.head-flag {
  width: 120rpx;
  height: 120rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1rpx solid rgba(255, 255, 255, 0.35);
}

.head-flag-emoji {
  font-size: 68rpx;
}

.head-info {
  margin-left: 28rpx;
  flex: 1;
  min-width: 0;
}

.head-name {
  font-size: 40rpx;
  font-weight: 800;
  color: #ffffff;
}

.head-intro {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.head-tags {
  display: flex;
  margin-top: 14rpx;
}

.head-tag {
  font-size: 20rpx;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8rpx;
  padding: 4rpx 14rpx;
  margin-right: 12rpx;
}

.pkg-list {
  padding: 30rpx $page-pad 0;
}

.pkg-card {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-sm;
  border: 1rpx solid rgba(227, 238, 247, 0.8);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.985);
  }
}

.pkg-flag {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &-text {
    font-size: 52rpx;
    line-height: 1;
  }
}

.pkg-main {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
}

.pkg-head {
  display: flex;
  align-items: center;
}

.pkg-country {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
  margin-right: 12rpx;
}

.pkg-tag {
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  line-height: 1.4;
}

.pkg-meta {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
}

.pkg-meta-item {
  font-size: 24rpx;
  color: $ink-2;
}

.pkg-dot {
  margin: 0 10rpx;
  color: $ink-3;
}

.pkg-type {
  font-size: 20rpx;
  color: $brand-deep;
  background: $brand-lighter;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.pkg-coverage {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.pkg-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.pkg-price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 700;

  &-symbol {
    font-size: 24rpx;
  }

  &-num {
    font-size: 44rpx;
    line-height: 1;
  }
}

.pkg-buy {
  display: flex;
  align-items: center;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.pkg-arrow {
  font-size: 28rpx;
  margin-left: 4rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}

.empty-emoji {
  font-size: 88rpx;
}

.empty-txt {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: $ink-3;
}

.tip-bar {
  margin: 40rpx $page-pad 0;
  background: $brand-lighter;
  border: 1rpx solid $brand-light;
  border-radius: $radius;
  padding: 22rpx 26rpx;
  display: flex;
  align-items: flex-start;
}

.tip-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.tip-txt {
  flex: 1;
  font-size: 23rpx;
  color: $brand-deep;
  line-height: 1.6;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
