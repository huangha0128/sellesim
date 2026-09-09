<template>
  <view class="home">
    <!-- Hero Banner：浅色编辑排版 + 3D 视觉 -->
    <view class="hero" :style="{ paddingTop: statusBarHeight + 'px' }">
      <image class="hero-art" src="/static/icons/hero-globe.jpg" mode="aspectFill" />

      <view class="hero-content">
        <text class="hero-overline">{{ fmt('index.heroBadge') }}</text>
        <view class="hero-title">
          <text class="hero-title-main">{{ fmt('index.heroTitle') }}</text>
          <text class="hero-title-sub">{{ fmt('index.heroSub') }}</text>
        </view>
        <view class="hero-chips">
          <view class="hero-chip">
            <text class="hero-chip-text">{{ fmt('index.heroFeature1') }}</text>
          </view>
          <view class="hero-chip">
            <text class="hero-chip-text">{{ fmt('index.heroFeature2') }}</text>
          </view>
          <view class="hero-chip">
            <text class="hero-chip-text">{{ fmt('index.heroFeature3') }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Search Bar -->
    <view class="search-section">
      <view class="search-bar" hover-class="search-bar--hover" @tap="goCountries">
        <view class="search-icon">
          <image src="/static/icons/search-icon.png" mode="aspectFit" />
        </view>
        <text class="search-placeholder">{{ fmt('index.searchPlaceholder') }}</text>
      </view>
      <view class="search-btn" hover-class="search-btn--hover" @tap="goCountries">
        <text>{{ fmt('index.searchBtn') }}</text>
      </view>
    </view>

    <!-- Package Cards -->
    <view class="package-list">
      <view class="section-head">
        <text class="section-title">{{ fmt('index.hotPackages') }}</text>
      </view>
      <view
        v-for="(pkg, idx) in hotPackages"
        :key="pkg.id"
        class="package-card"
        hover-class="package-card--hover"
        @tap="goDetail(pkg.id)"
      >
        <!-- Left: Cover Image -->
        <view class="card-cover" :style="{ background: getCoverGradient(idx) }">
          <!-- 装饰圆 -->
          <view class="cover-deco-circle"></view>
          <view class="cover-deco-circle small"></view>
          <view class="cover-content">
            <text class="cover-title">{{ pkg.countryName }}</text>
            <text class="cover-subtitle">{{ fmt('index.plan') }}</text>
            <view class="cover-specs">
              <text class="spec-tag">{{ fmt('common.dayUnit', { d: pkg.days }) }}</text>
              <text class="spec-tag">{{ pkg.isUnlimited ? fmt('package.unlimited') : pkg.gb + 'GB' }}</text>
            </view>
          </view>
          <view class="esim-badge">eSIM</view>
        </view>

        <!-- Right: Info -->
        <view class="card-info">
          <text class="card-title">{{ pkg.countryName }}{{ fmt('index.plan') }}</text>
          <view class="card-tags">
            <text class="tag tag-primary">{{ fmt('index.instant') }}</text>
            <text class="tag tag-secondary">{{ fmt('index.noRealName') }}</text>
          </view>
          <view class="card-footer">
            <text class="sales-count">{{ fmt('index.soldCount', { n: pkg.soldCount ?? 0 }) }}</text>
            <view class="price-block">
              <text class="price-currency">{{ displayCurrency }}</text>
              <text class="price-value">{{ fmtPrice(pkg.price) }}</text>
              <text class="price-unit">{{ fmt('common.priceFrom') }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="footer-safe"></view>

    <!-- 底部导航栏 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: currentTab === 'home' }" @tap="switchTab('home')">
        <image class="tab-icon" :src="currentTab === 'home' ? '/static/icons/tab-home-active.png' : '/static/icons/tab-home.png'" mode="aspectFit" />
        <text class="tab-label">{{ fmt('tab.home') }}</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'esim' }" @tap="switchTab('esim')">
        <image class="tab-icon" :src="currentTab === 'esim' ? '/static/icons/tab-esim-active.png' : '/static/icons/tab-esim.png'" mode="aspectFit" />
        <text class="tab-label">eSIM</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'profile' }" @tap="switchTab('profile')">
        <image class="tab-icon" :src="currentTab === 'profile' ? '/static/icons/tab-profile-active.png' : '/static/icons/tab-profile.png'" mode="aspectFit" />
        <text class="tab-label">{{ fmt('tab.profile') }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { t as translate } from '@/locales'
import { COVER_GRADIENTS } from '@/theme'

// 命名占位符兜底替换（如 {d}、{n}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  data() {
    return {
      statusBarHeight: 44,
      hotPackages: [],
      displayCurrency: 'CNY',
      currentTab: 'home'
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
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    fmtPrice(n) {
      const v = Number(n)
      return Number(v).toFixed(2)
    },
    getCoverGradient(idx) {
      return COVER_GRADIENTS[idx % COVER_GRADIENTS.length]
    },
    async loadData() {
      uni.showLoading({ title: this.fmt('common.loading'), mask: true })
      try {
        const res = await api.getHomeData()
        this.hotPackages = res.data.hotPackages || []
        this.displayCurrency = res.data.displayCurrency || 'CNY'
      } finally {
        uni.hideLoading()
      }
    },
    goCountries() {
      uni.navigateTo({ url: '/pages/countries/countries' })
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    },
    switchTab(tab) {
      if (tab === this.currentTab) return
      const tabMap = {
        home: '/pages/index/index',
        esim: '/pages/esims/esims',
        profile: '/pages/profile/profile'
      }
      uni.reLaunch({ url: tabMap[tab] })
    }
  }
}
</script>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: $bg-page;
}

/* ============ Hero Banner：浅色编辑排版 + 3D 视觉 ============ */
.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(168deg, #E4EAFF 0%, #F0F3FF 52%, #F5F7F8 100%);
  padding-bottom: 130rpx;
  border-radius: 0 0 48rpx 48rpx;
}

/* 3D 插画卡：右侧出血，圆角 + 柔和阴影 */
.hero-art {
  position: absolute;
  right: -56rpx;
  top: 64rpx;
  width: 330rpx;
  height: 330rpx;
  border-radius: 40rpx;
  box-shadow: 0 24rpx 48rpx rgba(64, 80, 192, 0.18);
  z-index: 1;
}

.hero-content {
  position: relative;
  padding: 56rpx 40rpx 0;
  z-index: 2;
}

/* 眉题：品牌蓝小字，字距拉开 */
.hero-overline {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $brand;
  letter-spacing: 8rpx;
  margin-bottom: 20rpx;
}

/* 双行大标语：品牌蓝紫渐变文字（呼应 logo 深蓝紫→浅蓝） */
.hero-title-main {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.22;
  letter-spacing: 2rpx;
}

.hero-title-sub {
  display: block;
  font-size: 64rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.22;
  letter-spacing: 2rpx;
}

/* 特性：白色小卡片 chip */
.hero-chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 30rpx;
  max-width: 400rpx;
}

.hero-chip {
  display: flex;
  align-items: center;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(64, 80, 192, 0.08);
  margin-right: 14rpx;
  margin-bottom: 14rpx;
}

.hero-chip-text {
  font-size: 22rpx;
  font-weight: 600;
  color: $ink-2;
}

/* ============ Search Bar ============ */
.search-section {
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  margin-top: -48rpx;
  position: relative;
  z-index: 10;
}

.search-bar {
  flex: 1;
  height: 88rpx;
  background: #ffffff;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);

  &--hover {
    transform: scale(0.99);
  }
}

.search-icon {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;

  image {
    width: 36rpx;
    height: 36rpx;
    display: block;
  }
}

.search-placeholder {
  font-size: 28rpx;
  color: $ink-3;
  font-weight: 400;
}

.search-btn {
  margin-left: 16rpx;
  height: 88rpx;
  padding: 0 36rpx;
  border-radius: 44rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);

  text {
    font-size: 28rpx;
    font-weight: 600;
    color: $brand;
  }

  &--hover {
    transform: scale(0.96);
  }
}

/* ============ Package List ============ */
.package-list {
  padding: 36rpx 24rpx;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 40rpx;
  font-weight: 800;
  color: $ink;
  letter-spacing: 1rpx;
}

.package-card {
  display: flex;
  background: #ffffff;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  box-shadow: $shadow-sm;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &--hover {
    transform: translateY(-4rpx);
    box-shadow: 0 8rpx 28rpx rgba(0, 0, 0, 0.12);
  }
}

/* Left: Cover */
.card-cover {
  position: relative;
  width: 280rpx;
  min-height: 280rpx;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24rpx;
  flex-shrink: 0;
  overflow: hidden;
}

/* 装饰圆 */
.cover-deco-circle {
  position: absolute;
  top: -20rpx;
  right: -20rpx;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  z-index: 1;

  &.small {
    width: 60rpx;
    height: 60rpx;
    top: auto;
    right: 40rpx;
    bottom: 60rpx;
    background: rgba(255, 255, 255, 0.1);
  }
}

.cover-content {
  position: relative;
  z-index: 2;
}

.cover-title {
  font-size: 36rpx;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
  display: block;
  line-height: 1.2;
}

.cover-subtitle {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
  display: block;
  margin-top: 8rpx;
}

.cover-specs {
  display: flex;
  flex-wrap: wrap;
  row-gap: 10rpx;
  margin-top: 16rpx;
}

.spec-tag {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.25);
  padding: 6rpx 14rpx;
  border-radius: 10rpx;
  margin-right: 10rpx;
  font-weight: 500;
}

.esim-badge {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 700;
  padding: 6rpx 12rpx;
  border-radius: 8rpx;
  z-index: 2;
}

/* Right: Info */
.card-info {
  flex: 1;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.card-title {
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
  display: block;
  margin-bottom: 16rpx;
  line-height: 1.3;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: auto;
}

.tag {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  margin-right: 12rpx;
  margin-bottom: 8rpx;
}

.tag-primary {
  color: $brand;
  background: $brand-light;
}

.tag-secondary {
  color: $ink-2;
  background: $bg-soft;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.sales-count {
  font-size: 24rpx;
  color: $ink-3;
  font-weight: 500;
}

.price-block {
  display: flex;
  align-items: baseline;
}

.price-currency {
  font-size: 24rpx;
  color: $ink-2;
  font-weight: 600;
  margin-right: 4rpx;
}

.price-value {
  font-size: 48rpx;
  font-weight: 800;
  color: $ink;
  line-height: 1;
}

.price-unit {
  font-size: 24rpx;
  color: $ink-3;
  font-weight: 400;
  margin-left: 4rpx;
}

.footer-safe {
  height: calc(140rpx + env(safe-area-inset-bottom));
}

/* ============ Tab Bar ============ */
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #ffffff;
  padding: 12rpx 0 calc(12rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0;
  flex: 1;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 4rpx;
}

.tab-label {
  font-size: 22rpx;
  color: $ink-3;
  font-weight: 500;
}

.tab-item.active .tab-label {
  color: $brand;
  font-weight: 700;
}
</style>
