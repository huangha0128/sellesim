<template>
  <view class="home">
    <!-- Hero Banner -->
    <view class="hero" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="hero-content">
        <view class="hero-left">
          <text class="hero-title">全球通 eSIM</text>
          <view class="hero-features">
            <view class="feature-item">
              <text class="feature-dot">•</text>
              <text class="feature-text">中国旅行首选</text>
            </view>
            <view class="feature-item">
              <text class="feature-dot">•</text>
              <text class="feature-text">覆盖190+目的地</text>
            </view>
          </view>
        </view>
        <view class="hero-right">
          <image class="hero-phone" src="/static/icons/hero-airplane.png" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- Search Bar -->
    <view class="search-section">
      <view class="search-bar" hover-class="search-bar--hover" @click="goCountries">
        <view class="search-icon">
          <image src="/static/icons/search-icon.png" mode="aspectFit" />
        </view>
        <text class="search-placeholder">搜索您想去的目的地</text>
      </view>
      <view class="search-btn" hover-class="search-btn--hover">
        <text>搜索</text>
      </view>
    </view>

    <!-- Package Cards -->
    <view class="package-list">
      <view
        v-for="(p, idx) in hotPackages"
        :key="p.id"
        class="package-card"
        hover-class="package-card--hover"
        @click="goDetail(p.id)"
      >
        <!-- Left: Cover Image -->
        <view class="card-cover" :style="{ background: getCoverGradient(idx) }">
          <!-- 装饰圆 -->
          <view class="cover-deco-circle"></view>
          <view class="cover-deco-circle small"></view>
          <view class="cover-content">
            <text class="cover-title">{{ p.countryName }}</text>
            <text class="cover-subtitle">流量套餐</text>
            <view class="cover-specs">
              <text class="spec-tag">1-365天</text>
              <text class="spec-tag">1-100GB</text>
            </view>
          </view>
          <view class="esim-badge">eSIM</view>
        </view>

        <!-- Right: Info -->
        <view class="card-info">
          <text class="card-title">{{ p.countryName }}流量套餐</text>
          <view class="card-tags">
            <text class="tag tag-primary">即时激活</text>
            <text class="tag tag-secondary">无需实名</text>
          </view>
          <view class="card-footer">
            <text class="sales-count">已售 {{ formatSales(idx) }}</text>
            <view class="price-block">
              <text class="price-currency">RMB</text>
              <text class="price-value">{{ fmtPrice(p.price) }}</text>
              <text class="price-unit">起</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="footer-safe"></view>

    <!-- 底部导航栏 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: currentTab === 'home' }" @click="switchTab('home')">
        <image class="tab-icon" :src="currentTab === 'home' ? '/static/icons/tab-home-active.png' : '/static/icons/tab-home.png'" mode="aspectFit" />
        <text class="tab-label">首页</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'esim' }" @click="switchTab('esim')">
        <image class="tab-icon" :src="currentTab === 'esim' ? '/static/icons/tab-esim-active.png' : '/static/icons/tab-esim.png'" mode="aspectFit" />
        <text class="tab-label">eSIM</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'profile' }" @click="switchTab('profile')">
        <image class="tab-icon" :src="currentTab === 'profile' ? '/static/icons/tab-profile-active.png' : '/static/icons/tab-profile.png'" mode="aspectFit" />
        <text class="tab-label">我的</text>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'

// 封面渐变配色方案
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
]

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
    fmtPrice(n) {
      const v = Number(n)
      return Number(v).toFixed(2)
    },
    getCoverGradient(idx) {
      return COVER_GRADIENTS[idx % COVER_GRADIENTS.length]
    },
    formatSales(idx) {
      const salesList = ['9999+', '6590', '3447', '2890', '1560', '980']
      return salesList[idx] || '1000+'
    },
    async loadData() {
      uni.showLoading({ title: '加载中...', mask: true })
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
  background: #f0f2f5;
}

/* ============ Hero Banner ============ */
.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #a78bfa 100%);
  padding-bottom: 120rpx;
}

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  padding: 40rpx 40rpx 0;
}

.hero-left {
  flex: 1;
  z-index: 2;
}

.hero-title {
  font-size: 56rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
  line-height: 1.2;
  text-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
}

.hero-features {
  margin-top: 24rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.feature-dot {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-right: 12rpx;
}

.feature-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.hero-right {
  position: absolute;
  right: 20rpx;
  top: 20rpx;
  width: 280rpx;
  height: 280rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}

.hero-phone {
  width: 240rpx;
  height: 240rpx;
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
  color: #9ca3af;
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
    color: #667eea;
  }

  &--hover {
    transform: scale(0.96);
  }
}

/* ============ Package List ============ */
.package-list {
  padding: 32rpx 24rpx;
}

.package-card {
  display: flex;
  background: #ffffff;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  right: 16rpx;
  bottom: 16rpx;
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
  color: #1f2937;
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
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

.tag-secondary {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.1);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.sales-count {
  font-size: 24rpx;
  color: #9ca3af;
  font-weight: 500;
}

.price-block {
  display: flex;
  align-items: baseline;
}

.price-currency {
  font-size: 24rpx;
  color: #6b7280;
  font-weight: 600;
  margin-right: 4rpx;
}

.price-value {
  font-size: 48rpx;
  font-weight: 800;
  color: #1f2937;
  line-height: 1;
}

.price-unit {
  font-size: 24rpx;
  color: #9ca3af;
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
  color: #9ca3af;
  font-weight: 500;
}

.tab-item.active .tab-label {
  color: #667eea;
  font-weight: 700;
}
</style>
