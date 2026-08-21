<template>
  <view class="detail-page">
    <!-- 顶部 Tab 栏 -->
    <view class="tab-bar">
      <view v-for="(tab, i) in tabs" :key="i" class="tab-item" :class="{ active: currentTab === i }" @click="currentTab = i">
        <text class="tab-text">{{ fmt(tab) }}</text>
      </view>
    </view>

    <view v-if="pkg" class="detail-body">
      <!-- 套餐名称卡片 -->
      <view class="pkg-name-card">
        <view class="pkg-name-row">
          <text class="pkg-name-text">{{ fmt('detail.nameSuffix', { name: pkg.countryName }) }}</text>
          <text class="pkg-name-arrow">⌄</text>
        </view>
        <view class="pkg-tags">
          <text class="pkg-tag sold">{{ fmt('detail.sold') }}</text>
          <text class="pkg-tag normal">{{ fmt('detail.instant') }}</text>
          <text class="pkg-tag normal">{{ fmt('detail.noRealName') }}</text>
          <text class="pkg-tag normal">{{ fmt('detail.globalApp') }}</text>
        </view>
      </view>

      <!-- 警告横幅 -->
      <view class="warn-banner">
        <text class="warn-icon">🔔</text>
        <text class="warn-txt">{{ fmt('detail.warn', { name: pkg.countryName }) }}</text>
      </view>

      <!-- 选择天数 -->
      <view class="select-section">
        <text class="select-title">{{ fmt('detail.selectDays') }}</text>
        <view class="day-grid">
          <view
            v-for="d in dayCells"
            :key="d"
            class="day-cell"
            :class="{ active: selectedDays === d }"
            @click="selectDays(d)"
          >
            <text class="day-text">{{ fmt('detail.dayUnit', { d }) }}</text>
            <view v-if="selectedDays === d" class="day-check-icon">✓</view>
          </view>
        </view>
      </view>

      <!-- 选择数据用量包 -->
      <view class="select-section">
        <text class="select-title">{{ fmt('detail.selectData') }}</text>
        <view class="data-grid">
          <view
            v-for="c in dataCells"
            :key="c.gb"
            class="data-cell"
            :class="{ active: selectedGb === c.gb }"
            @click="selectData(c.gb)"
          >
            <text class="data-text">{{ fmt('detail.totalGb', { gb: c.gb }) }}</text>
            <view v-if="selectedGb === c.gb" class="data-check-icon">✓</view>
          </view>
        </view>
      </view>

      <!-- 套餐详情 -->
      <view class="info-section">
        <text class="info-title">{{ fmt('detail.detailTitle') }}</text>
        <view class="info-item">
          <text class="info-icon">📍</text>
          <text class="info-label">{{ fmt('detail.coverage') }}</text>
          <text class="info-value">{{ pkg.coverage }}</text>
        </view>
        <view class="info-item">
          <text class="info-icon">🪪</text>
          <text class="info-label">{{ fmt('detail.registration') }}</text>
          <text class="info-value">{{ fmt('detail.noNeed') }}</text>
        </view>
      </view>

      <!-- 套餐说明 -->
      <view class="info-section">
        <text class="info-title">{{ fmt('detail.descTitle') }}</text>
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
        <text class="info-title">{{ fmt('detail.installTitle') }}</text>
        <view v-for="(s, i) in pkg.installSteps" :key="i" class="step-row">
          <view class="step-num">{{ i + 1 }}</view>
          <text class="step-txt">{{ s }}</text>
        </view>
        <view class="step-link" @click="goGuide">{{ fmt('detail.viewFullGuide') }}</view>
      </view>

      <view class="notice">
        <text class="notice-title">{{ fmt('detail.noticeTitle') }}</text>
        <text class="notice-txt">{{ fmt('detail.noticeText') }}</text>
      </view>

      <view class="footer-safe"></view>
    </view>

    <!-- 底部价格栏 -->
    <view v-if="pkg" class="bottom-bar">
      <view class="price-area">
        <text class="price-currency">RMB</text>
        <text class="price-main">{{ priceNum }}</text>
      </view>
      <view class="buy-btn" hover-class="buy-btn--hover" @click="buy">{{ fmt('detail.buyNow') }}</view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { setNavTitle, t as translate } from '@/locales'

// 渲染名称占位符兜底（v 存在则使用）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  data() {
    return {
      id: '',
      country: '',
      mode: '',
      esimId: '',
      pkg: null,
      allPackages: [], // 该国家所有套餐
      currentTab: 0,
      tabs: ['detail.tabSelect', 'detail.tabDetail', 'detail.tabHot', 'detail.tabNotice'],
      selectedDays: 0,
      selectedGb: 0
    }
  },
  computed: {
    // 当前所选流量下，存在哪些天数档位（与所选流量联动）
    dayCells() {
      if (!this.allPackages.length || !this.selectedGb) return []
      return Array.from(new Set(
        this.allPackages.filter(p => p.gb === this.selectedGb && p.days).map(p => p.days)
      )).sort((a, b) => a - b)
    },
    // 当前所选天数下，存在哪些流量档位（与所选天数联动）
    dataCells() {
      if (!this.allPackages.length || !this.selectedDays) return []
      return this.allPackages
        .filter(p => p.days === this.selectedDays && p.gb)
        .map(p => ({ gb: p.gb, price: p.price }))
        .sort((a, b) => a.gb - b.gb)
    },
    // 由「天数×流量」唯一确定一个真实套餐，价格直接取库内真实价
    selectedPkg() {
      if (!this.allPackages.length) return null
      return this.allPackages.find(p => p.days === this.selectedDays && p.gb === this.selectedGb) || null
    },
    priceNum() {
      const price = this.selectedPkg ? this.selectedPkg.price : 0
      return Number(price).toFixed(2)
    }
  },
  onLoad(options) {
    this.id = options.id || ''
    this.country = options.country || ''
    this.mode = options.mode || ''
    this.esimId = options.esimId || ''
    this.load()
  },
  methods: {
    // 翻译并确保 {name}/{d}/{gb} 等占位符被替换
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    // 默认选中某个真实套餐（取价格最低档），保证初次进入就落在库内已有档位
    pickDefault() {
      if (!this.allPackages.length) return
      const best = [...this.allPackages].sort((a, b) => a.price - b.price)[0]
      this.selectedDays = best.days
      this.selectedGb = best.gb
    },
    // 选择天数：与所选流量联动，自动收敛到该天数下存在的流量档
    selectDays(d) {
      this.selectedDays = d
      if (!this.dataCells.some(c => c.gb === this.selectedGb)) {
        this.selectedGb = this.dataCells[0] ? this.dataCells[0].gb : 0
      }
    },
    // 选择流量：与所选天数联动，自动收敛到该流量下存在的天数档
    selectData(gb) {
      this.selectedGb = gb
      if (!this.dayCells.includes(this.selectedDays)) {
        this.selectedDays = this.dayCells[0] || 0
      }
    },

    async load() {
      uni.showLoading({ title: this.fmt('common.loading'), mask: true })
      try {
        if (this.country) {
          // 从已有 eSIM 进入（续费/变更）：加载该国家套餐供选择
          const allRes = await api.getPackagesByCountry(this.country)
          const list = allRes.data.packages || []
          this.allPackages = list
          this.pkg = list[0] || null
          this.pickDefault()
        } else {
          // 常规入口：获取套餐详情
          const res = await api.getPackageDetail(this.id)
          this.pkg = res.data.pkg

          // 获取该国家所有套餐
          const allRes = await api.getPackagesByCountry(this.pkg.countryCode)
          this.allPackages = allRes.data.packages || []

          this.pickDefault()
        }

        setNavTitle('detail.navTitle')
      } finally {
        uni.hideLoading()
      }
    },
    buy() {
      const pkgId = (this.selectedPkg && this.selectedPkg.id) || (this.pkg ? this.pkg.id : '')
      uni.navigateTo({
        url: `/pages/checkout/checkout?pkgId=${pkgId}&mode=${this.mode}&esimId=${this.esimId}`
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
  background: $bg-page;
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
    background: $brand;
    border-radius: 3rpx;
  }
}

.tab-text {
  font-size: 28rpx;
  color: #999999;

  .active & {
    color: $brand;
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
  color: $ink;
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
    color: $sun;
    background: $sun-light;
  }

  &.normal {
    color: $brand;
    background: $brand-light;
  }
}

/* 警告横幅 */
.warn-banner {
  display: flex;
  align-items: center;
  background: $brand;
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
  color: $ink;
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
  background: $bg-soft;
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
    border-color: $brand;
    background: $brand-light;
  }
}

.day-text {
  font-size: 30rpx;
  color: #333333;
  font-weight: 600;

  .active & {
    color: $brand;
    font-weight: 700;
  }
}

.day-check-icon {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  font-size: 20rpx;
  color: $brand;
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
  background: $bg-soft;
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
    border-color: $coral;
    background: #FFF5F5;
  }
}

.data-text {
  font-size: 28rpx;
  color: #333333;
  font-weight: 600;
  text-align: center;

  .active & {
    color: $coral;
    font-weight: 700;
  }

  &.unlimited {
    color: $coral;
    font-size: 30rpx;
    font-weight: 700;
  }
}

.data-price-hint {
  font-size: 20rpx;
  color: $coral;
  margin-top: 6rpx;
  text-align: center;
}

.data-check-icon {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  font-size: 20rpx;
  color: $coral;
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
  color: $ink;
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
  color: $ink;
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
  color: $ink;
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
  background: $brand;
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
  color: $ink;
  line-height: 1.6;
}

.step-link {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: $brand;
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
  color: $ink;
  font-weight: 700;
  margin-right: 4rpx;
}

.price-main {
  font-size: 56rpx;
  color: $ink;
  font-weight: 800;
  line-height: 1;
}

.buy-btn {
  background: $gradient-brand;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
  padding: 24rpx 64rpx;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.97);
  }
}
</style>
