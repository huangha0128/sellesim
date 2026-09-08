<template>
  <view class="detail-page">
    <!-- 顶部 Tab 栏 -->
    <view class="tab-bar">
      <view
        v-for="(tab, i) in tabs"
        :key="i"
        class="tab-item"
        :class="{ active: currentTab === i }"
        @tap="currentTab = i"
      >
        <text class="tab-text">{{ fmt(tab) }}</text>
      </view>
    </view>

    <view v-if="pkg" class="detail-body">
      <!-- 套餐名称卡片 -->
      <view class="pkg-name-card">
        <view class="pkg-name-row">
          <text class="pkg-name-text">{{ fmt('detail.nameSuffix', { name: pkg.countryName }) }}</text>
          <view class="pkg-name-arrow-icon" @tap="openPackageDrawer">
            <view class="chevron-down"></view>
          </view>
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
        <view class="warn-icon-box"></view>
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
            @tap="selectDays(d)"
          >
            <text class="day-text">{{ fmt('detail.dayUnit', { d }) }}</text>
            <view v-if="selectedDays === d" class="day-check-badge">
              <text class="day-check-text">✓</text>
            </view>
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
            @tap="selectData(c.gb)"
          >
            <text class="data-text" :class="{ unlimited: c.isUnlimited }">{{ fmt('detail.totalGb', { gb: c.gb }) }}</text>
            <text v-if="c.isUnlimited" class="data-price-hint">{{ selectedDays }}{{ fmt('detail.dayUnitShort') }}{{ fmt('detail.onlyNeed') }}{{ c.priceDisplay }}</text>
            <view v-if="selectedGb === c.gb" class="data-check-badge">
              <text class="data-check-text">✓</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 套餐详情 -->
      <view class="info-section">
        <text class="info-title">{{ fmt('detail.detailTitle') }}</text>
        <view class="info-item">
          <text class="info-icon-text">📍</text>
          <text class="info-label">{{ fmt('detail.coverage') }}</text>
          <text class="info-value">{{ fmtPkgCoverage(pkg) }}</text>
        </view>
        <view class="info-item">
          <text class="info-icon-text">🪪</text>
          <text class="info-label">{{ fmt('detail.registration') }}</text>
          <text class="info-value">{{ fmt('detail.noNeed') }}</text>
        </view>
        <view class="info-item" v-if="pkgDescText">
          <text class="info-icon-text">🌐</text>
          <text class="info-label">{{ fmt('detail.network') }}</text>
          <text class="info-value desc-inline">{{ pkgDescText }}</text>
        </view>
        <view class="pkg-type-link" @tap="goGuide">
          <text class="pkg-type-link-text">{{ fmt('detail.pkgTypeIntro') }}</text>
          <text class="pkg-type-link-arrow">›</text>
        </view>
      </view>

      <!-- 安装步骤 -->
      <view class="info-section">
        <text class="info-title">{{ fmt('detail.installTitle') }}</text>
        <view class="install-btns">
          <view class="install-btn android-btn" @tap="goGuide">
            <text class="install-btn-text">{{ fmt('detail.androidInstall') }}</text>
          </view>
          <view class="install-btn apple-btn" @tap="goGuide">
            <text class="install-btn-text">{{ fmt('detail.appleInstall') }}</text>
          </view>
        </view>
      </view>

      <!-- 支持型号 & 使用须知 -->
      <view class="link-section">
        <view class="link-row" @tap="goGuide">
          <text class="link-text">{{ fmt('detail.supportModels') }}</text>
          <text class="link-arrow">›</text>
        </view>
        <view class="link-divider"></view>
        <view class="link-row" @tap="goGuide">
          <text class="link-text">{{ fmt('detail.usageNotice') }}</text>
          <text class="link-arrow">›</text>
        </view>
      </view>

      <!-- 注意事项 -->
      <view class="notice-card">
        <view class="notice-header">
          <view class="notice-dot"></view>
          <text class="notice-title">{{ fmt('detail.noticeTitle') }}</text>
          <view class="notice-collapse-icon">∨</view>
        </view>
        <view class="notice-divider"></view>
        <text class="notice-txt">{{ fmt('detail.noticeText') }}</text>
      </view>

      <view class="footer-safe"></view>
    </view>

    <!-- 底部价格栏 -->
    <view v-if="pkg" class="bottom-bar">
      <view class="price-area">
        <text class="price-currency">{{ sym }}</text>
        <text class="price-main">{{ priceNum }}</text>
        <view class="price-original-area">
          <text class="price-discount-badge">{{ fmt('detail.discount', { percent: discountPercent }) }}</text>
          <text class="price-orig-text">{{ fmt('detail.originalPrice', { price: originalPrice }) }}</text>
        </view>
      </view>
      <view class="buy-btn" hover-class="buy-btn--hover" @tap="buy">{{ fmt('detail.buyNow') }}</view>
    </view>

    <!-- 套餐选择抽屉 -->
    <view v-if="showDrawer" class="drawer-mask" @tap="closePackageDrawer"></view>
    <view v-if="showDrawer" class="drawer-panel drawer-panel-v2">
      <!-- 抽屉头部 -->
      <view class="drawer-header drawer-header-v2">
        <text class="drawer-title drawer-title-v2">{{ fmt('detail.drawerTitle') || '目的地选择' }}</text>
        <view class="drawer-close drawer-close-v2" @tap="closePackageDrawer">✕</view>
      </view>

      <!-- 搜索栏 -->
      <view class="drawer-search-bar drawer-search-v2">
        <view class="drawer-search-input drawer-search-input-v2">
          <text class="search-icon-v2">🔍</text>
          <input
            class="search-input search-input-v2"
            type="text"
            :placeholder="fmt('detail.searchPlaceholder')"
            v-model="drawerSearch"
            @input="onDrawerSearch"
          />
        </view>
      </view>

      <!-- 左右两栏布局 -->
      <view class="drawer-two-col">
        <!-- 左侧分类导航 -->
        <scroll-view class="drawer-sidebar" scroll-y>
          <view
            v-for="cat in drawerCategories"
            :key="cat"
            class="drawer-sidebar-item"
            :class="{ active: drawerActiveCat === cat }"
            @tap="drawerActiveCat = cat"
          >
            <text class="drawer-sidebar-text">{{ cat }}</text>
          </view>
        </scroll-view>

        <!-- 右侧内容区 -->
        <scroll-view class="drawer-content" scroll-y>
          <view v-if="filteredDrawerPackages.length === 0" class="drawer-empty">
            <text class="drawer-empty-text">{{ fmt('detail.noResults') }}</text>
          </view>
          <view v-for="(group, idx) in filteredDrawerPackages" :key="idx" class="drawer-group-v2">
            <text class="drawer-group-subtitle">{{ group.region }}</text>
            <view
              v-for="p in group.packages"
              :key="p.id"
              class="drawer-pkg-tag"
              :class="{ active: isCurrentPkg(p) }"
              @tap="selectPackage(p)"
            >
              <text class="drawer-pkg-tag-text">{{ p.name }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { setNavTitle, t as translate } from '@/locales'
import { currencySymbol } from '@/utils/format'

function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

// Tiger API description 数字代码映射
const DESC_CODE_MAP = {
  1: '3G/4G/5G',
  2: 'pure traffic eSIM',
  3: 'support Google/WhatsApp/ChatGPT',
  4: 'no voice call',
  5: 'no SMS',
  6: 'data only',
  7: 'instant activation'
}

function formatDesc(desc) {
  if (!desc) return ''
  if (Array.isArray(desc)) {
    return desc.map(code => DESC_CODE_MAP[code] || String(code)).join('; ')
  }
  return String(desc)
}

export default {
  data() {
    return {
      id: '',
      country: '',
      mode: '',
      esimId: '',
      pkg: null,
      allPackages: [],
      currentTab: 0,
      tabs: ['detail.tabSelect', 'detail.tabDetail', 'detail.tabHot', 'detail.tabNotice'],
      selectedDays: 0,
      selectedGb: 0,
      showDrawer: false,
      drawerSearch: '',
      drawerActiveCat: '历史/热门',
      drawerCategories: ['历史/热门', '跨境组合', '亚洲', '欧洲', '美洲', '非洲', '大洋洲'],
      drawerAllPackages: []
    }
  },
  computed: {
    dayCells() {
      if (!this.allPackages.length || !this.selectedGb) return []
      return Array.from(new Set(
        this.allPackages.filter(p => p.gb === this.selectedGb && p.days).map(p => p.days)
      )).sort((a, b) => a - b)
    },
    dataCells() {
      if (!this.allPackages.length || !this.selectedDays) return []
      const byGb = new Map()
      for (const p of this.allPackages) {
        if (p.days !== this.selectedDays || !p.gb) continue
        const cur = byGb.get(p.gb)
        if (!cur || p.price < cur.price) byGb.set(p.gb, { gb: p.gb, price: p.price, currency: p.currency })
      }
      return Array.from(byGb.values())
        .sort((a, b) => a.gb - b.gb)
        .map(c => ({
          ...c,
          isUnlimited: c.gb >= 9999,
          priceDisplay: Number(c.price).toFixed(2)
        }))
    },
    selectedPkg() {
      if (!this.allPackages.length) return null
      const matches = this.allPackages.filter(p => p.days === this.selectedDays && p.gb === this.selectedGb)
      if (!matches.length) return null
      return matches.reduce((min, p) => (p.price < min.price ? p : min), matches[0])
    },
    priceNum() {
      const price = this.selectedPkg ? this.selectedPkg.price : 0
      return Number(price).toFixed(2)
    },
    sym() {
      const pkg = this.selectedPkg || this.pkg
      return currencySymbol(pkg ? pkg.currency : 'CNY')
    },
    originalPrice() {
      const cur = parseFloat(this.priceNum)
      if (!cur) return '0.00'
      return (cur * 1.55).toFixed(2)
    },
    discountPercent() {
      const orig = parseFloat(this.originalPrice)
      const cur = parseFloat(this.priceNum)
      if (!orig || !cur) return 0
      return Math.round((1 - cur / orig) * 100)
    },
    pkgDescText() {
      if (!this.pkg) return ''
      const desc = this.pkg.desc
      if (!desc) return ''
      
      // 如果是数组
      if (Array.isArray(desc)) {
        return formatDesc(desc)
      }
      
      // 如果是 JSON 字符串 "[1,2,3]"
      if (typeof desc === 'string' && desc.startsWith('[') && desc.endsWith(']')) {
        try {
          const arr = JSON.parse(desc)
          if (Array.isArray(arr)) {
            return formatDesc(arr)
          }
        } catch (e) { /* ignore */ }
      }
      
      // 如果是 "1、2、3" 格式
      if (typeof desc === 'string' && /^[\d、\s,]+$/.test(desc)) {
        const codes = desc.split(/[、,\s]+/).filter(Boolean).map(Number)
        return codes.map(code => DESC_CODE_MAP[code] || String(code)).join('; ')
      }
      
      return desc
    },
    filteredDrawerPackages() {
      let packages = this.drawerAllPackages
      // 搜索过滤
      if (this.drawerSearch) {
        const kw = this.drawerSearch.toLowerCase()
        packages = packages.filter(p =>
          p.name.toLowerCase().includes(kw) ||
          p.countryName.toLowerCase().includes(kw) ||
          `${p.gb}GB`.toLowerCase().includes(kw) ||
          `${p.days}天`.toLowerCase().includes(kw)
        )
      }
      // 分类过滤
      if (this.drawerActiveCat === '历史/热门') {
        // 显示所有套餐，按热门推荐排序
        // 分为"历史选择"和"热门推荐"两组
        const historyPackages = packages.slice(0, 3) // 模拟历史选择
        const hotPackages = packages.slice(3) // 热门推荐
        const result = []
        if (historyPackages.length > 0) {
          result.push({ region: '历史选择', packages: historyPackages })
        }
        result.push({ region: '热门推荐', packages: hotPackages.length > 0 ? hotPackages : packages })
        return result
      } else if (this.drawerActiveCat === '跨境组合') {
        packages = packages.filter(p => p.isMulti || p.countryCode === 'GLOBAL')
      } else {
        // 按地区过滤
        const regionMap = {
          '亚洲': ['CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'TH', 'SG', 'MY', 'VN', 'ID', 'PH', 'IN', 'AE', 'TR', 'IL'],
          '欧洲': ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'PT', 'GR', 'CZ', 'PL', 'HU', 'RO', 'SE', 'NO', 'DK', 'FI', 'IE', 'RU', 'UA'],
          '美洲': ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE'],
          '非洲': ['ZA', 'EG', 'MA', 'KE', 'NG', 'TN'],
          '大洋洲': ['AU', 'NZ', 'FJ']
        }
        const codes = regionMap[this.drawerActiveCat] || []
        packages = packages.filter(p => codes.includes(p.countryCode))
      }
      // 按国家/地区分组
      const byRegion = new Map()
      for (const p of packages) {
        const region = p.countryName || p.countryCode || '其他'
        if (!byRegion.has(region)) {
          byRegion.set(region, [])
        }
        byRegion.get(region).push(p)
      }
      return Array.from(byRegion.entries()).map(([region, packages]) => ({
        region,
        packages: packages.sort((a, b) => a.price - b.price)
      }))
    }
  },
  onLoad(options) {
    this.id = options.id || ''
    this.country = options.country || ''
    this.mode = options.mode || ''
    this.esimId = options.esimId || ''
    this.load()
    this.loadAllPackages()
  },
  methods: {
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    fmtPkgCoverage(pkg) {
      if (!pkg || !pkg.coverage) return ''
      return this.fmt(pkg.coverage, { region: pkg.countryName })
    },
    pickDefault() {
      if (!this.allPackages.length) return
      const best = [...this.allPackages].sort((a, b) => a.price - b.price)[0]
      this.selectedDays = best.days
      this.selectedGb = best.gb
    },
    selectDays(d) {
      this.selectedDays = d
      if (!this.dataCells.some(c => c.gb === this.selectedGb)) {
        this.selectedGb = this.dataCells[0] ? this.dataCells[0].gb : 0
      }
    },
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
          const allRes = await api.getPackagesByCountry(this.country)
          const list = allRes.data.packages || []
          this.allPackages = list
          this.pkg = list[0] || null
          this.pickDefault()
        } else {
          const res = await api.getPackageDetail(this.id)
          this.pkg = res.data.pkg
          const allRes = await api.getPackagesByCountry(this.pkg.countryCode)
          this.allPackages = allRes.data.packages || []
          this.pickDefault()
        }
        setNavTitle('detail.navTitle')
      } finally {
        uni.hideLoading()
      }
    },
    async loadAllPackages() {
      // 尝试加载全量套餐（需线上服务器部署 /catalog/all 路由后才可用）
      let loaded = false
      try {
        const res = await api.getAllPackages()
        if (res.code === 0 && res.data.packages && res.data.packages.length > 0) {
          this.drawerAllPackages = res.data.packages
          const cats = new Set(['全部'])
          for (const p of this.drawerAllPackages) {
            if (p.countryName) cats.add(p.countryName)
          }
          this.drawerCategories = Array.from(cats)
          loaded = true
        }
      } catch (e) {
        // 线上未部署 /catalog/all 路由时静默 fallback
      }

      // Fallback: 使用当前国家的套餐
      if (!loaded && this.allPackages.length > 0) {
        this.drawerAllPackages = this.allPackages
        const cats = new Set(['全部'])
        for (const p of this.allPackages) {
          if (p.countryName) cats.add(p.countryName)
        }
        this.drawerCategories = Array.from(cats)
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
    },
    openPackageDrawer() {
      this.showDrawer = true
    },
    closePackageDrawer() {
      this.showDrawer = false
      this.drawerSearch = ''
      this.drawerActiveCat = '全部'
    },
    onDrawerSearch() {
      // 搜索时重置分类
      if (this.drawerSearch) {
        this.drawerActiveCat = '全部'
      }
    },
    isCurrentPkg(p) {
      return this.pkg && p.id === this.pkg.id
    },
    selectPackage(p) {
      this.pkg = p
      this.selectedDays = p.days || this.selectedDays
      this.selectedGb = p.gb || this.selectedGb
      this.showDrawer = false
    },
    formatDrawerPrice(p) {
      if (!p.price) return ''
      const sym = currencySymbol(p.currency || 'CNY')
      return `${sym}${Number(p.price).toFixed(2)}`
    }
  }
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #EEF0FF;
}

/* ========== Tab 栏 ========== */
.tab-bar {
  display: flex;
  background: #ffffff;
  padding: 0 $page-pad;
  border-bottom: 1rpx solid #F0F0F0;
  position: sticky;
  top: 0;
  z-index: 100;
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

/* ========== 内容区 ========== */
.detail-body {
  padding: 20rpx $page-pad;
  padding-bottom: 40rpx;
}

/* ========== 套餐名称卡片 ========== */
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

.pkg-name-arrow-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #F5F5FF;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.chevron-down {
  width: 20rpx;
  height: 20rpx;
  border-right: 4rpx solid #6C63FF;
  border-bottom: 4rpx solid #6C63FF;
  transform: rotate(45deg);
  margin-top: -4rpx;
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

/* ========== 警告横幅 ========== */
.warn-banner {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #6C63FF 0%, #8B83FF 50%, #A78BFA 100%);
  border-radius: 16rpx;
  padding: 26rpx 30rpx;
  margin-top: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(108, 99, 255, 0.3);
}

.warn-icon-box {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  margin-right: 16rpx;
  flex-shrink: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23FFFFFF' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'/%3E%3Cpath d='M10.3 21a1.94 1.94 0 0 0 3.4 0'/%3E%3C/svg%3E");
  background-size: 28rpx 28rpx;
  background-repeat: no-repeat;
  background-position: center;
}

.warn-txt {
  flex: 1;
  font-size: 26rpx;
  color: #ffffff;
  line-height: 1.5;
}

/* ========== 选择区域 ========== */
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

/* 天数网格 */
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

.day-check-badge {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: #6C63FF;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-check-text {
  font-size: 16rpx;
  color: #ffffff;
  font-weight: 700;
  line-height: 1;
}

/* 数据用量包网格 */
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
  padding: 24rpx 12rpx;
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
  line-height: 1.3;
}

.data-check-badge {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: #FF4D4F;
  display: flex;
  align-items: center;
  justify-content: center;
}

.data-check-text {
  font-size: 16rpx;
  color: #ffffff;
  font-weight: 700;
  line-height: 1;
}

/* ========== 套餐详情 ========== */
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
  align-items: flex-start;
  padding: 14rpx 0;
}

.info-icon-text {
  font-size: 30rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
}

.info-label {
  font-size: 28rpx;
  color: #666666;
  flex-shrink: 0;
}

.info-value {
  font-size: 28rpx;
  color: #1A1A2E;
  font-weight: 600;
}

.desc-inline {
  font-weight: 400;
  color: #333333;
  line-height: 1.6;
}

.pkg-type-link {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
  padding-top: 16rpx;
}

.pkg-type-link-text {
  font-size: 28rpx;
  color: #6C63FF;
  font-weight: 600;
}

.pkg-type-link-arrow {
  font-size: 28rpx;
  color: #6C63FF;
  margin-left: 4rpx;
}

/* ========== 安装按钮 ========== */
.install-btns {
  display: flex;
  gap: 20rpx;
}

.install-btn {
  flex: 1;
  padding: 28rpx 0;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #8B83FF;
}

.install-btn-text {
  font-size: 28rpx;
  color: #ffffff;
  font-weight: 600;
}

/* ========== 链接列表 ========== */
.link-section {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 0 32rpx;
  margin-top: 20rpx;
}

.link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0;
}

.link-text {
  font-size: 30rpx;
  color: #1A1A2E;
  font-weight: 600;
}

.link-arrow {
  font-size: 32rpx;
  color: #CCCCCC;
}

.link-divider {
  height: 1rpx;
  background: #F0F0F0;
}

/* ========== 注意事项 ========== */
.notice-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-top: 20rpx;
}

.notice-header {
  display: flex;
  align-items: center;
}

.notice-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #4ADE80;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.notice-title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 800;
  color: #1A1A2E;
}

.notice-collapse-icon {
  font-size: 28rpx;
  color: #6C63FF;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #F0EEFF;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notice-divider {
  height: 2rpx;
  background: #6C63FF;
  margin: 20rpx 0;
  border-radius: 1rpx;
}

.notice-txt {
  font-size: 26rpx;
  color: #666666;
  line-height: 1.8;
  white-space: pre-wrap;
}

/* ========== 底部占位 ========== */
.footer-safe {
  height: 160rpx;
}

/* ========== 底部价格栏 ========== */
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
  font-variant-numeric: tabular-nums;
}

.price-original-area {
  display: flex;
  flex-direction: column;
  margin-left: 16rpx;
  align-items: flex-start;
}

.price-discount-badge {
  font-size: 20rpx;
  color: #ffffff;
  background: #FF6B35;
  border-radius: 6rpx;
  padding: 2rpx 12rpx;
  display: inline-block;
  align-self: flex-start;
  margin-bottom: 4rpx;
}

.price-orig-text {
  font-size: 22rpx;
  color: #999999;
  text-decoration: line-through;
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

/* ========== 套餐选择抽屉 ========== */
.drawer-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.drawer-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.drawer-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1A1A2E;
}

.drawer-close {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #999999;
}

/* 搜索栏 */
.drawer-search-bar {
  padding: 20rpx 40rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.drawer-search-input {
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333333;
}

/* 分类标签 */
.drawer-tabs {
  display: flex;
  padding: 20rpx 40rpx;
  border-bottom: 1rpx solid #F0F0F0;
  white-space: nowrap;
}

.drawer-tab {
  padding: 12rpx 24rpx;
  margin-right: 16rpx;
  border-radius: 24rpx;
  background: #F5F5F5;

  &.active {
    background: #6C63FF;
  }
}

.drawer-tab-text {
  font-size: 24rpx;
  color: #666666;

  .active & {
    color: #ffffff;
    font-weight: 600;
  }
}

/* 套餐列表 */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20rpx 40rpx;
  padding-bottom: 40rpx;
}

.drawer-empty {
  padding: 60rpx 0;
  text-align: center;
}

.drawer-empty-text {
  font-size: 28rpx;
  color: #999999;
}

.drawer-group {
  margin-bottom: 32rpx;
}

.drawer-group-title {
  font-size: 26rpx;
  color: #999999;
  font-weight: 600;
  margin-bottom: 16rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.drawer-pkg-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F5F5F5;
  position: relative;

  &:last-child {
    border-bottom: none;
  }

  &.active {
    background: #F5F5FF;
    margin: 0 -40rpx;
    padding-left: 40rpx;
    padding-right: 40rpx;
    border-radius: 12rpx;
    border-bottom: none;
  }
}

.drawer-pkg-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.drawer-pkg-name {
  font-size: 28rpx;
  color: #1A1A2E;
  font-weight: 600;
  margin-bottom: 4rpx;
}

.drawer-pkg-spec {
  font-size: 22rpx;
  color: #999999;
}

.drawer-pkg-price {
  font-size: 28rpx;
  color: #6C63FF;
  font-weight: 700;
  margin-right: 16rpx;
}

.drawer-pkg-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #6C63FF;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ========== 新抽屉样式（左右两栏） ========== */
.drawer-panel-v2 {
  border-radius: 32rpx 32rpx 0 0;
  max-height: 90vh;
  overflow: hidden;
}

.drawer-header-v2 {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx 40rpx 24rpx;
  border-bottom: 1rpx solid #F0F0F0;
  position: relative;
}

.drawer-title-v2 {
  font-size: 36rpx;
  font-weight: 700;
  color: #1A1A2E;
}

.drawer-close-v2 {
  position: absolute;
  right: 32rpx;
  top: 32rpx;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #999999;
}

.drawer-search-v2 {
  padding: 20rpx 32rpx;
}

.drawer-search-input-v2 {
  display: flex;
  align-items: center;
  background: #F5F5F7;
  border-radius: 16rpx;
  padding: 18rpx 24rpx;
}

.search-icon-v2 {
  font-size: 28rpx;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.search-input-v2 {
  flex: 1;
  font-size: 28rpx;
  color: #333333;
}

/* 左右两栏 */
.drawer-two-col {
  display: flex;
  height: 60vh;
  overflow: hidden;
}

/* 左侧分类导航 */
.drawer-sidebar {
  width: 180rpx;
  background: #F8F8FA;
  border-right: 1rpx solid #EEEEEE;
  flex-shrink: 0;
  overflow-y: auto;
}

.drawer-sidebar-item {
  padding: 28rpx 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 6rpx solid transparent;
  transition: all 0.2s ease;

  &.active {
    background: #ffffff;
    border-left-color: #6C63FF;
  }
}

.drawer-sidebar-text {
  font-size: 26rpx;
  color: #666666;
  font-weight: 500;

  .active & {
    color: #6C63FF;
    font-weight: 700;
  }
}

/* 右侧内容区 */
.drawer-content {
  flex: 1;
  padding: 24rpx 32rpx;
  overflow-y: auto;
}

.drawer-group-v2 {
  margin-bottom: 28rpx;
}

.drawer-group-subtitle {
  font-size: 24rpx;
  color: #999999;
  font-weight: 500;
  margin-bottom: 16rpx;
  display: block;
}

.drawer-pkg-tag {
  display: inline-block;
  padding: 16rpx 28rpx;
  background: #F5F5F7;
  border-radius: 12rpx;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  transition: all 0.2s ease;

  &.active {
    background: #6C63FF;
  }
}

.drawer-pkg-tag-text {
  font-size: 26rpx;
  color: #333333;
  font-weight: 500;
  white-space: nowrap;

  .active & {
    color: #ffffff;
    font-weight: 600;
  }
}
</style>
