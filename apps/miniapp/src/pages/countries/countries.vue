<template>
  <view class="countries-page">
    <!-- Search Hero -->
    <view class="hero-header">
      <view class="hero-search-wrap">
        <view class="search-bar">
          <view class="search-icon">
            <image src="/static/icons/search-icon.png" mode="aspectFit" />
          </view>
          <input
            v-model="keyword"
            class="search-input"
            :placeholder="fmt('countries.searchPlaceholder')"
            confirm-type="search"
            @input="onInput"
          />
          <view v-if="keyword" class="clear-btn" @tap="clear">
            <view class="clear-icon-x"></view>
          </view>
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="main-scroll"
      :show-scrollbar="false"
      :scroll-into-view="scrollToView"
    >
      <!-- 搜索中：套餐卡片 -->
      <view v-if="keyword" class="search-results">
        <view v-if="searchPackages.length" class="pkg-list">
          <view
            v-for="(pkg, idx) in searchPackages"
            :key="pkg.id"
            class="package-card"
            hover-class="package-card--hover"
            @tap="goDetail(pkg.id)"
          >
            <!-- 封面 -->
            <view class="card-cover" :style="{ background: getCoverGradient(idx) }">
              <view class="cover-deco-circle"></view>
              <view class="cover-deco-circle small"></view>
              <view class="cover-content">
                <text class="cover-title">{{ pkg.countryName }}</text>
                <text class="cover-subtitle">{{ fmt('countries.plan') }}</text>
                <view class="cover-specs">
                  <text class="spec-tag">{{ formatDays(pkg) }}</text>
                  <text class="spec-tag">{{ formatGb(pkg) }}</text>
                </view>
              </view>
              <view class="esim-badge">eSIM</view>
            </view>
            <!-- 信息 -->
            <view class="card-info">
              <text class="card-title">{{ pkg.countryName }}{{ fmt('countries.plan') }}</text>
              <view class="card-tags">
                <text class="tag tag-primary">{{ fmt('countries.instant') }}</text>
                <text class="tag tag-secondary">{{ fmt('countries.noRealName') }}</text>
              </view>
              <view class="card-footer">
                <text class="sales-count">{{ fmt('countries.sold', { n: pkg.soldCount ?? 0 }) }}</text>
                <view class="price-block">
                  <text class="price-currency">{{ displayCurrency }}</text>
                  <text class="price-value">{{ fmtPrice(pkg.price) }}</text>
                  <text class="price-unit">{{ fmt('common.priceFrom') }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <image class="empty-icon" src="/static/icons/search-icon.png" mode="aspectFit" />
          <text class="empty-title">{{ fmt('countries.emptySearchTitle', { kw: keyword }) }}</text>
          <text class="empty-sub">{{ fmt('countries.emptySearchSub') }}</text>
        </view>
      </view>

      <!-- 正常浏览 -->
      <view v-else class="browse-content">
        <!-- 最近搜索 -->
        <view v-if="recentSearches.length" class="section-block">
          <view class="section-header">
            <text class="section-title">{{ fmt('countries.recentTitle') }}</text>
            <text class="section-clear" @tap="clearRecent">{{ fmt('countries.clearAll') }}</text>
          </view>
          <view class="recent-tags">
            <view
              v-for="(tag, idx) in recentSearches"
              :key="idx"
              class="recent-tag"
              hover-class="recent-tag--hover"
              @tap="searchFromTag(tag)"
            >
              <text>{{ tag }}</text>
            </view>
          </view>
        </view>

        <!-- 热门目的地 -->
        <view class="section-block">
          <view class="section-header">
            <view class="section-title-row">
              <image class="hot-icon" src="/static/icons/ben-fire.png" mode="aspectFit" />
              <text class="section-title">{{ fmt('countries.hotTitle') }}</text>
            </view>
          </view>
          <view class="hot-grid">
            <view
              v-for="h in hotDestinations"
              :key="h.code"
              class="hot-card"
              hover-class="hot-card--hover"
              @tap="onCountryTap(h)"
            >
              <view class="hot-flag">
                <image class="hot-flag-img" :src="getFlagImage(h.code)" mode="aspectFit" />
              </view>
              <text class="hot-name">{{ h.name }}</text>
            </view>
          </view>
        </view>

        <!-- 分类标签 -->
        <view class="cat-tabs">
          <scroll-view scroll-x class="cat-scroll" :show-scrollbar="false">
            <view
              v-for="cat in cats"
              :key="cat.key"
              class="cat-tab"
              :class="{ active: activeCat === cat.key }"
              @tap="switchCat(cat.key)"
            >
              {{ fmt(cat.labelKey) }}
            </view>
          </scroll-view>
        </view>

        <!-- 全球套餐 -->
        <view v-if="activeCat === '' && regions.length" class="region-block">
          <view class="block-title">
            <image src="/static/icons/region-global.png" mode="aspectFit" style="width: 28rpx; height: 28rpx; margin-right: 8rpx;" />
            {{ fmt('countries.multiRegion') }}
          </view>
          <view class="country-grid">
            <view
              v-for="r in regions"
              :key="r.code"
              class="country-grid-item"
              hover-class="country-grid-item--hover"
              @tap="onCountryTap(r)"
            >
              <view class="grid-flag">
                <image class="grid-flag-img" :src="getFlagImage(r.code)" mode="aspectFit" />
              </view>
              <text class="grid-name">{{ r.name }}</text>
            </view>
          </view>
        </view>

        <!-- 国家列表 -->
        <view class="country-section">
          <view v-if="activeCat === ''" class="block-title">{{ fmt('countries.nationalRegions') }}</view>

          <view class="country-flex">
            <view class="country-flex-main">
              <view v-for="group in groupedCountries" :key="group.letter" :id="'letter-' + group.letter" class="letter-group">
                <view class="letter-header">{{ group.letter }}</view>
                <view
                  v-for="c in group.items"
                  :key="c.code"
                  class="country-row"
                  hover-class="country-row--hover"
                  @tap="onCountryTap(c)"
                >
                  <view class="row-flag">
                    <image class="row-flag-img" :src="getFlagImage(c.code)" mode="aspectFit" />
                  </view>
                  <view class="row-info">
                    <text class="row-name">{{ localName(c) }}</text>
                    <text class="row-en">{{ altName(c) }}</text>
                  </view>
                  <text class="row-arrow">›</text>
                </view>
              </view>

              <view v-if="activeCat !== '' && !groupedCountries.length" class="empty-state">
                <image class="empty-icon" src="/static/icons/region-global.png" mode="aspectFit" />
                <text class="empty-title">{{ fmt('countries.emptyCatTitle') }}</text>
                <text class="empty-sub">{{ fmt('countries.emptyCatSub') }}</text>
              </view>
            </view>

            <!-- 字母索引（占实际位置，不覆盖内容） -->
            <view v-if="letterIndex.length" class="country-index">
              <view
                v-for="l in letterIndex"
                :key="l"
                class="index-letter"
                :class="{ active: currentLetter === l }"
                @tap="scrollToLetter(l)"
              >
                {{ l }}
              </view>
            </view>
          </view>
        </view>

        <view class="list-safe"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { setNavTitle, t as translate } from '@/locales'
import { COVER_GRADIENTS } from '@/theme'

// 命名占位符兜底替换（如 {kw}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

// 热门目的地（按销量排序）
const HOT_CODES = ['mo', 'my', 'hk', 'cn', 'jp', 'kr', 'th', 'sg']

// 多国区域 -> 组成国家 code（需与后端 REGION_COUNTRY_ALIASES 保持一致）：
// 新马泰/日韩/中国大陆香港澳门 等组合区域套餐覆盖的单个国家，也要出现在目的地列表中
const REGION_CONSTITUENTS = {
  SINGAPOREMALAYSIATHAILAND: ['SG', 'MY', 'TH'],
  JAPANKOREA: ['JP', 'KR'],
  CHINAMAINLANDHONGKONGMACAO: ['CN', 'HK', 'MO'],
}

export default {
  data() {
    return {
      keyword: '',
      activeCat: '',
      cats: [
        { key: '', labelKey: 'countries.catAll' },
        { key: '亚洲', labelKey: 'countries.catAsia' },
        { key: '欧洲', labelKey: 'countries.catEurope' },
        { key: '美洲', labelKey: 'countries.catAmericas' },
        { key: '大洋洲', labelKey: 'countries.catOceania' },
        { key: '非洲', labelKey: 'countries.catAfrica' },
        { key: '中东', labelKey: 'countries.catMiddleEast' }
      ],
      all: [],
      regions: [],
      searchPackages: [],
      displayCurrency: 'RMB',
      recentSearches: [],
      scrollToView: '',
      currentLetter: ''
    }
  },
  computed: {
    hotDestinations() {
      return HOT_CODES
        .map((code) => this.all.find((c) => c.code.toLowerCase() === code))
        .filter(Boolean)
    },
    letterIndex() {
      return this.activeCat === '' ? this.groupedCountries.map((g) => g.letter) : []
    },
    groupedCountries() {
      const kw = this.keyword.trim().toLowerCase()
      let list = this.all
      if (this.activeCat !== '') list = list.filter((c) => c.cat === this.activeCat)
      if (kw) {
        list = list.filter(
          (c) =>
            c.name.includes(kw) ||
            c.en.toLowerCase().includes(kw) ||
            (c.pinyin && c.pinyin.includes(kw)) ||
            c.code.toLowerCase() === kw
        )
      }
      const groups = {}
      list.forEach((c) => {
        const letter = (c.pinyin && c.pinyin[0]) || c.en[0] || '#'
        const upper = letter.toUpperCase()
        const key = /[A-Z]/.test(upper) ? upper : '#'
        if (!groups[key]) groups[key] = []
        groups[key].push(c)
      })
      return Object.keys(groups)
        .sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
        .map((letter) => ({ letter, items: groups[letter] }))
    }
  },
  onShow() {
    setNavTitle('pageTitle.countries')
    this.loadRecentSearches()
    this.loadCountries()
  },
  methods: {
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    // 地区名称按当前语言显示：英文用 en，中文（简/繁）用 name
    localName(c) {
      if (!c) return ''
      const isEn = this.isEnLocale()
      return (isEn ? (c.en || c.name) : (c.name || c.en)) || ''
    },
    // 副语言名：英文模式显示中文，中文模式显示英文
    altName(c) {
      if (!c) return ''
      const isEn = this.isEnLocale()
      return (isEn ? (c.name || c.en) : (c.en || c.name)) || ''
    },
    isEnLocale() {
      try {
        return uni.getStorageSync('yy_locale') === 'en'
      } catch (e) {
        return false
      }
    },
    getFlagImage(code) {
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    getCoverGradient(idx) {
      return COVER_GRADIENTS[idx % COVER_GRADIENTS.length]
    },
    fmtPrice(n) {
      return Number(n || 0).toFixed(2)
    },
    formatGb(p) {
      if (p.isUnlimited) return this.fmt('package.unlimited')
      const gb = p.gb ?? (p.amount ? p.amount / 1024 : null)
      return gb ? `${gb}GB` : ''
    },
    formatDays(p) {
      const d = p.days ?? p.valid_days ?? p.validDays
      return d ? this.fmt('common.dayUnit', { d }) : ''
    },
    async doSearch() {
      const kw = this.keyword.trim()
      if (!kw) {
        this.searchPackages = []
        return
      }
      try {
        const res = await api.searchPackages(kw)
        this.searchPackages = res.data.packages || []
        if (kw !== this.keyword.trim()) return
        this.saveRecentSearch(kw)
      } catch (e) {
        this.searchPackages = []
      }
    },
    async loadCountries() {
      uni.showLoading({ title: this.fmt('common.loading'), mask: true })
      try {
        const res = await api.getCountries()
        const countries = res.data.countries || []
        // 只展示小程序套餐中存在（已添加并定价）的国家/地区，packageCount 由后端实时统计
        const withPkg = countries.filter((c) => (c.packageCount || 0) > 0)
        // 多国区域套餐覆盖的组成国家（如"新马泰"覆盖新加坡/马来西亚/泰国）也加入列表，
        // 点击后按国家名搜索即可命中对应组合套餐
        const byCode = new Map(countries.map((c) => [c.code, c]))
        withPkg.forEach((c) => {
          ;(REGION_CONSTITUENTS[c.code] || []).forEach((code) => {
            const cc = byCode.get(code)
            if (cc && !withPkg.includes(cc)) withPkg.push(cc)
          })
        })
        this.regions = withPkg.filter((c) => c.cat === '全球')
        this.all = withPkg.filter((c) => c.cat !== '全球')
      } finally {
        uni.hideLoading()
      }
    },
    onInput() {
      clearTimeout(this._t)
      this._t = setTimeout(() => this.doSearch(), 260)
    },
    switchCat(key) {
      this.activeCat = key
    },
    clear() {
      this.keyword = ''
      this.searchPackages = []
    },
    searchFromTag(tag) {
      this.keyword = tag
      this.doSearch()
      this.saveRecentSearch(tag)
    },
    onCountryTap(country) {
      const name = this.localName(country)
      this.keyword = name
      this.doSearch()
      this.saveRecentSearch(name)
    },
    scrollToLetter(letter) {
      this.currentLetter = letter
      this.scrollToView = 'letter-' + letter
    },
    saveRecentSearch(kw) {
      if (!kw) return
      let list = this.recentSearches.filter((t) => t !== kw)
      list.unshift(kw)
      if (list.length > 8) list = list.slice(0, 8)
      this.recentSearches = list
      try {
        uni.setStorageSync('recent_searches', list)
      } catch (e) {}
    },
    loadRecentSearches() {
      try {
        this.recentSearches = uni.getStorageSync('recent_searches') || []
      } catch (e) {
        this.recentSearches = []
      }
    },
    clearRecent() {
      this.recentSearches = []
      try {
        uni.removeStorageSync('recent_searches')
      } catch (e) {}
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/detail/detail?id=${id}` })
    }
  }
}
</script>

<style lang="scss" scoped>
.countries-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
  position: relative;
}

/* ============ Hero Header ============ */
.hero-header {
  position: relative;
  overflow: hidden;
  background: linear-gradient(168deg, #E4EAFF 0%, #F0F3FF 52%, #F5F7F8 100%);
  padding: 28rpx 32rpx 52rpx;
  border-radius: 0 0 48rpx 48rpx;
  flex-shrink: 0;
}

.hero-search-wrap {
  position: relative;
  z-index: 10;
}

.search-bar {
  height: 88rpx;
  background: #ffffff;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(48, 48, 160, 0.08);
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

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: $ink;
  font-weight: 400;
}

.clear-btn {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $bg-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.clear-icon-x {
  width: 20rpx;
  height: 20rpx;
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16rpx;
    height: 3rpx;
    background: $ink-3;
    border-radius: 2rpx;
  }

  &::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  &::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }
}

/* ============ Main Scroll ============ */
.main-scroll {
  flex: 1;
  height: 0;
}

/* ============ Search Results ============ */
.search-results {
  padding: 24rpx 32rpx;
}

.pkg-list {
  display: flex;
  flex-direction: column;
}

/* 套餐卡片（与首页一致） */
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

/* ============ Browse Content ============ */
.browse-content {
  padding: 24rpx 32rpx 0;
}

.section-block {
  margin-bottom: 32rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title-row {
  display: flex;
  align-items: center;
}

.hot-icon {
  width: 36rpx;
  height: 36rpx;
  margin-right: 8rpx;
}

.section-title {
  font-size: $fs-h3;
  font-weight: 700;
  color: $ink;
  letter-spacing: 1rpx;
}

.section-clear {
  font-size: $fs-sm;
  color: $ink-3;
  font-weight: 500;
}

/* ============ Recent Tags ============ */
.recent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.recent-tag {
  padding: 14rpx 28rpx;
  background: $bg-card;
  border-radius: 999rpx;
  box-shadow: $shadow-sm;
  transition: all 0.2s ease;

  text {
    font-size: 25rpx;
    color: $ink-2;
    font-weight: 500;
  }

  &--hover {
    transform: scale(0.96);
    box-shadow: $shadow;
  }
}

/* ============ Hot Grid ============ */
.hot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.hot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: $bg-card;
  border-radius: $radius;
  padding: 24rpx 16rpx;
  box-shadow: $shadow-sm;
  transition: all 0.2s ease;

  &--hover {
    transform: translateY(-4rpx);
    box-shadow: $shadow;
  }
}

.hot-flag {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.hot-flag-img {
  width: 80%;
  height: 80%;
  object-fit: cover;
}

.hot-name {
  font-size: 24rpx;
  font-weight: 600;
  color: $ink;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* ============ Category Tabs ============ */
.cat-tabs {
  padding: 8rpx 0 24rpx;
}

.cat-scroll {
  white-space: nowrap;
}

.cat-tab {
  display: inline-flex;
  padding: 14rpx 32rpx;
  margin-right: 16rpx;
  border-radius: 999rpx;
  background: $bg-card;
  color: $ink-2;
  font-size: 25rpx;
  font-weight: 600;
  border: 1rpx solid $line;
  box-shadow: $shadow-sm;
  transition: all 0.2s ease;

  &.active {
    background: $brand;
    color: #ffffff;
    border-color: $brand;
    box-shadow: $shadow-brand;
  }
}

/* ============ Region Block ============ */
.region-block {
  margin-bottom: 32rpx;
}

.block-title {
  display: flex;
  align-items: center;
  font-size: $fs-sm;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: $ink-2;
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.country-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.country-grid-item {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius;
  padding: 20rpx 24rpx;
  box-shadow: $shadow-sm;
  transition: all 0.2s ease;

  &--hover {
    transform: scale(0.98);
    box-shadow: $shadow;
  }
}

.grid-flag {
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  margin-right: 16rpx;
}

.grid-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-name {
  font-size: 26rpx;
  font-weight: 600;
  color: $ink;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============ Country Section ============ */
.country-section {
  padding-bottom: 24rpx;
}

.country-flex {
  display: flex;
  align-items: flex-start;
}

.country-flex-main {
  flex: 1;
  min-width: 0;
}

.country-index {
  width: 44rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
  padding-top: 4rpx;
  padding-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.index-letter {
  width: 44rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  color: $ink-3;
  border-radius: 8rpx;
  transition: all 0.15s ease;

  &.active {
    color: #ffffff;
    background: $brand;
  }
}

.letter-group {
  margin-bottom: 24rpx;
  margin-right: 8rpx;
}

.letter-header {
  font-size: $fs-sm;
  font-weight: 700;
  color: $ink-2;
  letter-spacing: 2rpx;
  margin-bottom: 16rpx;
  padding-left: 4rpx;
}

.country-row {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius;
  padding: 22rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: $shadow-sm;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.985);
  }
}

.row-flag {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.row-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-info {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
}

.row-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
  display: block;
}

.row-en {
  font-size: 22rpx;
  color: $ink-3;
  display: block;
  margin-top: 4rpx;
}

.row-arrow {
  font-size: 34rpx;
  font-weight: 300;
  line-height: 1;
  color: $ink-3;
  margin-left: 16rpx;
  flex-shrink: 0;
}

/* ============ Empty State ============ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 96rpx;
  height: 96rpx;
  margin-bottom: 24rpx;
  opacity: 0.4;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $ink-2;
  margin-bottom: 12rpx;
}

.empty-sub {
  font-size: 26rpx;
  color: $ink-3;
}

/* ============ Safe Area ============ */
.list-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
