<template>
  <view class="detail-page">
    <!-- 顶部 Tab 栏 -->
    <view class="tab-bar">
      <view
        v-for="(tab, i) in tabs"
        :key="i"
        class="tab-item"
        :class="{ active: currentTab === i }"
        @click="currentTab = i"
      >
        <text class="tab-text">{{ tab }}</text>
      </view>
    </view>

    <view v-if="pkg" class="detail-body">
      <!-- 套餐名称卡片 -->
      <view class="pkg-name-card">
        <view class="pkg-name-row">
          <text class="pkg-name-text">{{ pkg.countryName }}流量套餐</text>
          <text class="pkg-name-arrow">⌄</text>
        </view>
        <view class="pkg-tags">
          <text class="pkg-tag sold">已售 9999+</text>
          <text class="pkg-tag normal">即时激活</text>
          <text class="pkg-tag normal">无需实名</text>
          <text class="pkg-tag normal">支持全球app</text>
        </view>
      </view>

      <!-- 警告横幅 -->
      <view class="warn-banner">
        <text class="warn-icon">🔔</text>
        <text class="warn-txt">本套餐仅限在{{ pkg.countryName }}境内使用，请谨慎购买！</text>
      </view>

      <!-- 选择天数 -->
      <view class="select-section">
        <text class="select-title">选择天数</text>
        <view class="day-grid">
          <view
            v-for="d in pkg.dayOptions"
            :key="d"
            class="day-cell"
            :class="{ active: selectedDays === d }"
            @click="selectDays(d)"
          >
            <text class="day-text">{{ d }}天</text>
            <view v-if="selectedDays === d" class="day-check-icon">✓</view>
          </view>
        </view>
      </view>

      <!-- 选择数据用量包 -->
      <view class="select-section">
        <text class="select-title">选择数据用量包</text>
        <view class="data-grid">
          <view
            v-for="(dp, i) in pkg.dataPackages"
            :key="i"
            class="data-cell"
            :class="{ active: selectedDataIndex === i }"
            @click="selectData(i)"
          >
            <text class="data-text" :class="{ unlimited: dp.type === 'unlimited' }">{{ dp.label }}</text>
            <text v-if="dp.type === 'unlimited'" class="data-price-hint">{{ selectedDays }}天仅需{{ calcDataPrice(dp) }}元</text>
            <view v-if="selectedDataIndex === i" class="data-check-icon">✓</view>
          </view>
        </view>
      </view>

      <!-- 套餐详情 -->
      <view class="info-section">
        <text class="info-title">套餐详情</text>
        <view class="info-item">
          <text class="info-icon">📍</text>
          <text class="info-label">覆盖地区：</text>
          <text class="info-value">{{ pkg.coverage }}</text>
        </view>
        <view class="info-item">
          <text class="info-icon">🪪</text>
          <text class="info-label">身份登记：</text>
          <text class="info-value">不需要</text>
        </view>
      </view>

      <!-- 套餐说明 -->
      <view class="info-section">
        <text class="info-title">套餐说明</text>
        <text class="desc-text">{{ pkg.desc }}</text>
        <view class="feature-list">
          <view v-for="f in pkg.features" :key="f" class="feature-item">
            <view class="feature-check-circle">✓</view>
            <text class="feature-txt">{{ f }}</text>
          </view>
        </view>
      </view>

      <!-- 安装步骤 -->
      <view class="info-section">
        <text class="info-title">安装步骤</text>
        <view v-for="(s, i) in pkg.installSteps" :key="i" class="step-row">
          <view class="step-num">{{ i + 1 }}</view>
          <text class="step-txt">{{ s }}</text>
        </view>
        <view class="step-link" @click="goGuide">查看完整安装指南 ›</view>
      </view>

      <view class="notice">
        <text class="notice-title">温馨提示</text>
        <text class="notice-txt">1. 有效期从激活当日起算，请到达目的地后再激活。&#10;2. 流量遵循公平使用原则，超出高速额度后限速。&#10;3. 请先确认手机支持 eSIM 功能（iPhone XS 及以上等）。</text>
      </view>

      <view class="footer-safe"></view>
    </view>

    <!-- 底部价格栏 -->
    <view v-if="pkg" class="bottom-bar">
      <view class="price-area">
        <text class="price-currency">RMB</text>
        <text class="price-main">{{ priceNum }}</text>
        <view v-if="discountPercent > 0" class="price-original">
          <text class="price-orig-text">原价 ¥{{ originalPrice }}</text>
          <text class="price-discount">立减{{ discountPercent }}%</text>
        </view>
      </view>
      <view class="buy-btn" hover-class="buy-btn--hover" @click="buy">立即购买</view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { calcPrice } from '@/mock/data'

export default {
  data() {
    return {
      id: '',
      pkg: null,
      currentTab: 0,
      tabs: ['套餐选择', '套餐详情', '热门推荐', '使用须知'],
      selectedDays: 15,
      selectedDataIndex: 4
    }
  },
  computed: {
    currentDataPkg() {
      if (!this.pkg || !this.pkg.dataPackages) return null
      return this.pkg.dataPackages[this.selectedDataIndex]
    },
    priceNum() {
      if (!this.pkg || !this.currentDataPkg) return '0'
      const price = calcPrice(this.currentDataPkg, this.selectedDays, this.pkg.countryCode)
      return price % 1 === 0 ? price.toFixed(0) : price.toFixed(1)
    },
    originalPrice() {
      if (!this.pkg || !this.currentDataPkg) return '0'
      const base = this.currentDataPkg.base * this.selectedDays
      const region = this.pkg.countryCode
      const mult = region === 'GLOBAL' ? 2.0 : region === 'ASIA' ? 1.5 : 1.6
      const orig = Math.round(base * mult * 1.55 * 10) / 10
      return orig % 1 === 0 ? orig.toFixed(0) : orig.toFixed(1)
    },
    discountPercent() {
      const orig = parseFloat(this.originalPrice)
      const cur = parseFloat(this.priceNum)
      if (!orig || !cur) return 0
      return Math.round((1 - cur / orig) * 100)
    }
  },
  onLoad(options) {
    this.id = options.id || ''
    this.load()
  },
  methods: {
    calcDataPrice(dp) {
      if (!this.pkg) return '0'
      const price = calcPrice(dp, this.selectedDays, this.pkg.countryCode)
      return price % 1 === 0 ? price.toFixed(0) : price.toFixed(1)
    },
    async load() {
      uni.showLoading({ title: '加载中', mask: true })
      try {
        const res = await api.getPackageDetail(this.id)
        this.pkg = res.data.pkg
        if (this.pkg && this.pkg.dayOptions) {
          this.selectedDays = this.pkg.dayOptions.find(d => d === 15) || this.pkg.dayOptions[0]
        }
        if (this.pkg && this.pkg.dataPackages) {
          const unlimitedIdx = this.pkg.dataPackages.findIndex(p => p.type === 'unlimited')
          this.selectedDataIndex = unlimitedIdx >= 0 ? unlimitedIdx : this.pkg.dataPackages.length - 1
        }
        uni.setNavigationBarTitle({ title: 'eSIM 详情' })
      } finally {
        uni.hideLoading()
      }
    },
    selectDays(d) {
      this.selectedDays = d
    },
    selectData(i) {
      this.selectedDataIndex = i
    },
    buy() {
      uni.navigateTo({
        url: `/pages/checkout/checkout?pkgId=${this.pkg.id}&dataIndex=${this.selectedDataIndex}&days=${this.selectedDays}`
      })
    },
    goGuide() {
      uni.navigateTo({ url: '/pages/guide/guide' })
    }
  }
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #EEF0FF;
}

/* Tab 栏 */
.tab-bar {
  display: flex;
  background: #ffffff;
  padding: 0 $page-pad;
  border-bottom: 1rpx solid #F0F0F0;
}

.tab-item {
  padding: 28rpx 24rpx;
  margin-right: 32rpx;
  position: relative;

  &.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 48rpx;
    height: 6rpx;
    background: #6C63FF;
    border-radius: 3rpx;
  }
}

.tab-text {
  font-size: 28rpx;
  color: #999999;

  .active & {
    color: #6C63FF;
    font-weight: 700;
  }
}

.detail-body {
  padding: 20rpx $page-pad;
  padding-bottom: 40rpx;
}

/* 套餐名称卡片 */
.pkg-name-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-top: 16rpx;
}

.pkg-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pkg-name-text {
  font-size: 40rpx;
  font-weight: 800;
  color: #1A1A2E;
}

.pkg-name-arrow {
  font-size: 32rpx;
  color: #999999;
  margin-left: 12rpx;
}

.pkg-tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 20rpx;
}

.pkg-tag {
  font-size: 22rpx;
  border-radius: 8rpx;
  padding: 6rpx 16rpx;
  margin-right: 16rpx;
  margin-bottom: 8rpx;

  &.sold {
    color: #F5A623;
    background: #FFF8EC;
  }

  &.normal {
    color: #6C63FF;
    background: #F0F0FF;
  }
}

/* 警告横幅 */
.warn-banner {
  display: flex;
  align-items: center;
  background: #6C63FF;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-top: 20rpx;
}

.warn-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.warn-txt {
  flex: 1;
  font-size: 26rpx;
  color: #ffffff;
  line-height: 1.5;
}

/* 选择区域 */
.select-section {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-top: 20rpx;
}

.select-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #1A1A2E;
  display: block;
  margin-bottom: 24rpx;
}

/* 天数网格 - 4列 */
.day-grid {
  display: flex;
  flex-wrap: wrap;
}

.day-cell {
  width: calc(25% - 12rpx);
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  background: #F5F5FF;
  border-radius: 16rpx;
  padding: 28rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 2rpx solid transparent;
  transition: all 0.2s ease;

  &:nth-child(4n) {
    margin-right: 0;
  }

  &.active {
    border-color: #6C63FF;
    background: #F0EEFF;
  }
}

.day-text {
  font-size: 30rpx;
  color: #333333;
  font-weight: 600;

  .active & {
    color: #6C63FF;
    font-weight: 700;
  }
}

.day-check-icon {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  font-size: 20rpx;
  color: #6C63FF;
  font-weight: 700;
}

/* 数据用量包网格 - 3列 */
.data-grid {
  display: flex;
  flex-wrap: wrap;
}

.data-cell {
  width: calc(33.33% - 14rpx);
  margin-right: 20rpx;
  margin-bottom: 16rpx;
  background: #F5F5FF;
  border-radius: 16rpx;
  padding: 28rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 2rpx solid transparent;
  transition: all 0.2s ease;
  min-height: 120rpx;

  &:nth-child(3n) {
    margin-right: 0;
  }

  &.active {
    border-color: #FF4D4F;
    background: #FFF5F5;
  }
}

.data-text {
  font-size: 28rpx;
  color: #333333;
  font-weight: 600;
  text-align: center;

  .active & {
    color: #FF4D4F;
    font-weight: 700;
  }

  &.unlimited {
    color: #FF4D4F;
    font-size: 30rpx;
    font-weight: 700;
  }
}

.data-price-hint {
  font-size: 20rpx;
  color: #FF4D4F;
  margin-top: 6rpx;
  text-align: center;
}

.data-check-icon {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  font-size: 20rpx;
  color: #FF4D4F;
  font-weight: 700;
}

/* 套餐详情 */
.info-section {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-top: 20rpx;
}

.info-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #1A1A2E;
  display: block;
  margin-bottom: 24rpx;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}

.info-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
}

.info-label {
  font-size: 26rpx;
  color: #666666;
}

.info-value {
  font-size: 26rpx;
  color: #1A1A2E;
  font-weight: 600;
}

.desc-text {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.7;
}

.feature-list {
  margin-top: 24rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.feature-check-circle {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #E8FFF0;
  color: #14B8A6;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.feature-txt {
  font-size: 26rpx;
  color: #1A1A2E;
}

.step-row {
  display: flex;
  align-items: flex-start;
  margin-top: 20rpx;
}

.step-num {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #6C63FF;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
}

.step-txt {
  flex: 1;
  font-size: 26rpx;
  color: #1A1A2E;
  line-height: 1.6;
}

.step-link {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #6C63FF;
  font-weight: 600;
}

.notice {
  margin-top: 20rpx;
  background: #FFF8EC;
  border: 1rpx solid #FDE7BD;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
}

.notice-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #B45309;
}

.notice-txt {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #92600A;
  line-height: 1.7;
  white-space: pre-wrap;
}

.footer-safe {
  height: 160rpx;
}

/* 底部价格栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  padding: 20rpx $page-pad;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
  z-index: 10;
}

.price-area {
  flex: 1;
  display: flex;
  align-items: baseline;
}

.price-currency {
  font-size: 24rpx;
  color: #1A1A2E;
  font-weight: 700;
  margin-right: 4rpx;
}

.price-main {
  font-size: 56rpx;
  color: #1A1A2E;
  font-weight: 800;
  line-height: 1;
}

.price-original {
  display: flex;
  flex-direction: column;
  margin-left: 16rpx;
}

.price-orig-text {
  font-size: 22rpx;
  color: #999999;
  text-decoration: line-through;
}

.price-discount {
  font-size: 20rpx;
  color: #ffffff;
  background: #FF6B35;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  margin-top: 4rpx;
  display: inline-block;
  align-self: flex-start;
}

.buy-btn {
  background: #6C63FF;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
  padding: 24rpx 64rpx;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 24rpx rgba(108, 99, 255, 0.35);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.97);
  }
}
</style>
