<template>
  <view class="home">
    <view class="hero" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="hero-deco deco-1"></view>
      <view class="hero-deco deco-2"></view>
      <view class="hero-deco deco-3"></view>

      <view class="hero-inner">
        <view class="hero-top">
          <view class="hero-brand">
            <image class="brand-logo" src="/static/icons/hero-logo.png" mode="aspectFit" />
            <view class="brand-txt">
              <text class="brand-name">YYeSim</text>
              <text class="brand-slogan">全球 200+ 地区流量</text>
            </view>
          </view>
          <view class="hero-avatar" @click="goProfile">
            <image class="avatar-img" src="/static/icons/hero-avatar.png" mode="aspectFit" />
          </view>
        </view>

        <view class="hero-title">
          <text class="hero-title-main">全球流量</text>
          <text class="hero-title-sub">一卡搞定</text>
        </view>

        <view class="search-bar" hover-class="search-bar--hover" @click="goCountries">
          <image src="/static/icons/search-icon.png" mode="aspectFit" style="width: 32rpx; height: 32rpx; margin-right: 12rpx; flex-shrink: 0;" />
          <text class="search-ph">搜索国家，如「日本 / Japan」</text>
        </view>

        <view class="region-chips">
          <view
            v-for="r in regions"
            :key="r.code"
            class="region-chip"
            hover-class="region-chip--hover"
            @click="goPackages(r.code)"
          >
            <image class="region-flag" :src="getFlagImage(r.code)" mode="aspectFit" />
            <text class="region-name">{{ r.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="content">
      <view class="section">
        <view class="section-head">
          <text class="section-title">热门目的地</text>
          <text class="section-more" @click="goCountries">全部国家 ›</text>
        </view>
        <scroll-view scroll-x class="hot-scroll" :show-scrollbar="false">
          <view
            v-for="c in hotCountries"
            :key="c.code"
            class="hot-item"
            hover-class="hot-item--hover"
            @click="goPackages(c.code)"
          >
            <view class="hot-flag">
              <image class="hot-flag-img" :src="getFlagImage(c.code)" mode="aspectFit" />
              <view class="hot-rank">{{ rankText(c.code) }}</view>
            </view>
            <text class="hot-name">{{ c.name }}</text>
            <text class="hot-price">¥{{ minPrice(c.code) }} 起</text>
          </view>
        </scroll-view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">热销套餐</text>
          <text class="section-more" @click="goCountries">查看更多 ›</text>
        </view>
        <view
          v-for="p in hotPackages"
          :key="p.id"
          class="pkg-card"
          hover-class="pkg-card--hover"
          @click="goDetail(p.id)"
        >
          <view class="pkg-flag">
            <image class="pkg-flag-img" :src="getFlagImage(p.countryCode)" mode="aspectFit" />
          </view>
          <view class="pkg-main">
            <view class="pkg-head">
              <text class="pkg-country">{{ p.countryName }}</text>
              <text v-if="p.tag" class="pkg-tag" :style="{ color: p.tagColor, background: p.tagColor + '1A' }">{{ p.tag }}</text>
            </view>
            <view class="pkg-meta">
              <text class="pkg-meta-item">{{ p.gb }}GB 流量</text>
              <text class="pkg-dot">·</text>
              <text class="pkg-meta-item">{{ p.days }}天有效</text>
              <text class="pkg-dot">·</text>
              <text class="pkg-meta-item">{{ p.network }}</text>
            </view>
            <view class="pkg-type">{{ p.type }}</view>
          </view>
          <view class="pkg-right">
            <view class="pkg-price">
              <text class="pkg-price-symbol">¥</text>
              <text class="pkg-price-num">{{ fmtPrice(p.price) }}</text>
            </view>
            <view class="pkg-buy">
              <text>查看</text>
              <text class="pkg-arrow">›</text>
            </view>
          </view>
        </view>
      </view>

      <view class="guide-banner" hover-class="guide-banner--hover" @click="goGuide">
        <view class="guide-deco"><image src="/static/icons/feat-signal.png" mode="aspectFit" style="width: 48rpx; height: 48rpx;" /></view>
        <view class="guide-text">
          <text class="guide-title">第一次用 eSIM？</text>
          <text class="guide-sub">3 分钟学会安装 · 全球上网不迷路</text>
        </view>
        <view class="guide-btn">查看指南</view>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'

export default {
  data() {
    return {
      statusBarHeight: 44,
      regions: [],
      hotCountries: [],
      hotPackages: [],
      priceMap: {},
      store,
      rankMap: {}
    }
  },
  onLoad() {
    const info = uni.getSystemInfoSync()
    this.statusBarHeight = info.statusBarHeight || 44
  },
  onShow() {
    this.loadData()
  },
  methods: {
    fmtPrice(n) {
      const v = Number(n)
      return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)
    },
    async loadData() {
      uni.showLoading({ title: '加载中', mask: true })
      try {
        const res = await api.getHomeData()
        this.regions = res.data.regions.slice(0, 4)
        this.hotCountries = res.data.hotCountries
        this.hotPackages = res.data.hotPackages
        this.priceMap = res.data.priceMap || {}
        this.hotCountries.forEach((c, i) => {
          this.rankMap[c.code] = i + 1
        })
      } finally {
        uni.hideLoading()
      }
    },
    rankText(code) {
      return this.rankMap[code] ? `TOP${this.rankMap[code]}` : ''
    },
    getFlagImage(code) {
      const flagMap = {
        'GLOBAL': '/static/icons/region-global.png',
        'ASIA': '/static/icons/region-asia.png',
        'EUROPE': '/static/icons/region-europe.png',
        'AMERICAS': '/static/icons/region-americas.png',
        'OCEANIA': '/static/icons/region-oceania.png',
        'JP': '/static/icons/flag-jp.png',
        'KR': '/static/icons/flag-kr.png',
        'TH': '/static/icons/flag-th.png',
        'US': '/static/icons/flag-us.png',
        'SG': '/static/icons/flag-sg.png',
        'AU': '/static/icons/flag-au.png',
        'MY': '/static/icons/flag-my.png',
        'HK': '/static/icons/flag-hk.png',
        'CN': '/static/icons/flag-cn.png',
        'TW': '/static/icons/flag-tw.png',
        'MO': '/static/icons/flag-mo.png'
      }
      return flagMap[code] || '/static/icons/region-global.png'
    },
    minPrice(code) {
      const v = this.priceMap[code]
      return v === undefined || v === null ? '--' : v
    },
    goCountries() {
      uni.navigateTo({ url: '/pages/countries/countries' })
    },
    goPackages(code) {
      uni.navigateTo({ url: `/pages/packages/packages?code=${code}` })
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    },
    goGuide() {
      uni.navigateTo({ url: '/pages/guide/guide' })
    },
    goProfile() {
      uni.switchTab({ url: '/pages/profile/profile' })
    }
  }
}
</script>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: $bg-page;
}

.hero {
  position: relative;
  overflow: hidden;
  background: $gradient-brand;
  padding-bottom: 60rpx;
}

.hero-deco {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.deco-1 {
  width: 320rpx;
  height: 320rpx;
  right: -120rpx;
  top: -80rpx;
}

.deco-2 {
  width: 180rpx;
  height: 180rpx;
  left: -60rpx;
  bottom: 40rpx;
  background: rgba(255, 255, 255, 0.08);
}

.deco-3 {
  width: 60rpx;
  height: 60rpx;
  right: 80rpx;
  bottom: 20rpx;
  background: rgba(255, 255, 255, 0.18);
}

.hero-inner {
  position: relative;
  padding: 20rpx 40rpx 0;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-brand {
  display: flex;
  align-items: center;
}

.brand-logo {
  width: 56rpx;
  height: 56rpx;
  margin-right: 16rpx;
}

.brand-txt {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.brand-slogan {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 2rpx;
}

.hero-avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 3rpx solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
}

.hero-title {
  margin-top: 48rpx;
  display: flex;
  align-items: baseline;
}

.hero-title-main {
  font-size: 64rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.hero-title-sub {
  font-size: 44rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-left: 20rpx;
}

.search-bar {
  margin-top: 36rpx;
  height: 92rpx;
  background: #ffffff;
  border-radius: 46rpx;
  display: flex;
  align-items: center;
  padding: 0 34rpx;
  box-shadow: 0 12rpx 32rpx rgba(3, 105, 161, 0.25);

  &--hover {
    transform: scale(0.99);
  }
}

.search-icon {
  width: 32rpx !important;
  height: 32rpx !important;
  min-width: 32rpx !important;
  min-height: 32rpx !important;
  max-width: 32rpx !important;
  max-height: 32rpx !important;
  margin-right: 12rpx;
  flex-shrink: 0;
  display: block;
  object-fit: contain;
}

.search-ph {
  font-size: 27rpx;
  color: $ink-3;
}

.region-chips {
  display: flex;
  margin-top: 36rpx;
}

.region-chip {
  flex: 1;
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(255, 255, 255, 0.35);
  border-radius: 20rpx;
  padding: 18rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 18rpx;
  transition: all 0.15s ease;

  &:last-child {
    margin-right: 0;
  }

  &--hover {
    background: rgba(255, 255, 255, 0.32);
  }
}

.region-flag {
  width: 40rpx;
  height: 40rpx;
  margin-bottom: 4rpx;
}

.region-name {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #ffffff;
  font-weight: 600;
}

.content {
  padding: 0 $page-pad;
  margin-top: -16rpx;
  position: relative;
}

.section {
  margin-top: 36rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
  position: relative;
  padding-left: 20rpx;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8rpx;
    height: 32rpx;
    border-radius: 4rpx;
    background: $gradient-coral;
  }
}

.section-more {
  font-size: 24rpx;
  color: $ink-3;
}

.hot-scroll {
  white-space: nowrap;
  width: 100%;
}

.hot-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  background: $bg-card;
  border-radius: $radius;
  padding: 24rpx 18rpx;
  margin-right: 20rpx;
  box-shadow: $shadow-sm;
  width: 156rpx;
  transition: transform 0.15s ease;

  &--hover {
    transform: translateY(-4rpx);
  }
}

.hot-flag {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hot-flag-emoji {
  font-size: 48rpx;
}

.hot-rank {
  position: absolute;
  top: -6rpx;
  right: -10rpx;
  background: $gradient-coral;
  color: #ffffff;
  font-size: 16rpx;
  font-weight: 700;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
}

.hot-name {
  margin-top: 16rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130rpx;
}

.hot-price {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $coral;
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
  display: inline-flex;
  align-self: flex-start;
  margin-top: 12rpx;
  font-size: 20rpx;
  color: $brand-deep;
  background: $brand-lighter;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
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

.guide-banner {
  margin-top: 40rpx;
  background: $gradient-brand;
  border-radius: $radius-lg;
  padding: 32rpx 34rpx;
  display: flex;
  align-items: center;
  box-shadow: $shadow-brand;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.985);
  }
}

.guide-deco {
  width: 92rpx;
  height: 92rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  flex-shrink: 0;
}

.guide-text {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}

.guide-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #ffffff;
}

.guide-sub {
  margin-top: 6rpx;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.85);
}

.guide-btn {
  background: #ffffff;
  color: $brand-deep;
  font-size: 24rpx;
  font-weight: 700;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
