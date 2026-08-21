<template>
  <view class="packages-page">
    <view v-if="country" class="country-head">
      <view class="head-flag">
        <image class="head-flag-img" :src="getFlagImage(country.code)" mode="aspectFit" />
      </view>
      <view class="head-info">
        <text class="head-name">{{ country.name }}</text>
        <text class="head-intro">{{ country.intro }}</text>
        <view class="head-tags">
          <text class="head-tag">4G/5G</text>
          <text class="head-tag">{{ fmt('packages.noRealName') }}</text>
          <text class="head-tag">{{ fmt('packages.instant') }}</text>
        </view>
      </view>
    </view>

    <view class="pkg-list">
      <view
        v-if="series"
        class="pkg-card"
        hover-class="pkg-card--hover"
        @click="goDetail()"
      >
        <view class="pkg-flag">
          <image class="pkg-flag-img" :src="getFlagImage(series.countryCode)" mode="aspectFit" />
        </view>
        <view class="pkg-main">
          <view class="pkg-head">
            <text class="pkg-country">{{ series.countryName }}</text>
            <text v-if="series.tag" class="pkg-tag" :style="{ color: series.tagColor, background: series.tagColor + '1A' }">{{ series.tag }}</text>
            <view class="pkg-type">{{ series.type }}</view>
          </view>
          <view class="pkg-meta">
            <text class="pkg-meta-item">{{ fmt('packages.daysSelectable', { min: series.dayOptions[0], max: series.dayOptions[series.dayOptions.length - 1] }) }}</text>
            <text class="pkg-dot">·</text>
            <text class="pkg-meta-item">{{ fmt('packages.multiData') }}</text>
          </view>
          <view class="pkg-coverage">{{ series.coverage }}</view>
        </view>
        <view class="pkg-right">
          <view class="pkg-price">
            <text class="pkg-price-symbol">¥</text>
            <text class="pkg-price-num">{{ fmtPrice(series.startPrice) }}</text>
            <text class="pkg-price-unit">起</text>
          </view>
          <view class="pkg-buy">
            <text>{{ fmt('packages.view') }}</text>
            <text class="pkg-arrow">›</text>
          </view>
        </view>
      </view>
      <view v-if="!loading && !series" class="empty">
        <image class="empty-emoji" src="/static/icons/feat-signal.png" mode="aspectFit" />
        <text class="empty-txt">{{ fmt('packages.empty') }}</text>
      </view>
    </view>

    <view class="tip-bar">
      <image class="tip-icon" src="/static/icons/co-info.png" mode="aspectFit" />
      <text class="tip-txt">{{ fmt('packages.tip') }}</text>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换（如 {min}、{max}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  data() {
    return {
      code: '',
      country: null,
      packages: [],
      series: null,
      loading: true
    }
  },
  onLoad(options) {
    this.code = options.code || ''
    setNavTitle('pageTitle.packages')
    this.loadCountry()
    this.load()
  },
  methods: {
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    getFlagImage(code) {
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    fmtPrice(n) {
      const v = Number(n)
      return Number(v).toFixed(2)
    },
    async loadCountry() {
      try {
        const res = await api.getCountryDetail(this.code)
        this.country = res.data.country
        uni.setNavigationBarTitle({ title: this.country.name })
      } catch (e) {
        this.country = null
      }
    },
    async load() {
      this.loading = true
      try {
        const res = await api.getPackages(this.code)
        this.packages = res.data.packages || []
        this.series = this.buildSeries(this.packages)
      } finally {
        this.loading = false
      }
    },
    // 将同一目的地的所有套餐组合折叠为一个套餐卡片
    buildSeries(list) {
      if (!list || list.length === 0) return null
      const first = list[0]
      const dayOptions = Array.from(new Set(list.map((p) => p.days).filter(Boolean))).sort((a, b) => a - b)
      const startPrice = list.reduce((min, p) => (p.price < min.price ? p : min), first).price
      return { ...first, dayOptions, startPrice }
    },
    goDetail() {
      uni.navigateTo({ url: `/pages/detail/detail?country=${this.code}` })
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
  overflow: hidden;
}

.head-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  overflow: hidden;
}

.pkg-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.pkg-tag {
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  line-height: 1.4;
  margin-right: 12rpx;
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
  display: inline-flex;
  align-self: flex-start;
  margin-top: 12rpx;
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

.pkg-price-unit {
  font-size: 24rpx;
  font-weight: 400;
  color: $coral;
  margin-left: 6rpx;
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
