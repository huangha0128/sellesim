<template>
  <view class="detail-page">
    <!-- 顶部 Tab 导航栏（固定在上方，滚动时吸顶） -->
    <view class="tab-bar">
      <view
        v-for="(tab, i) in tabs"
        :key="tab.anchor"
        class="tab-item"
        :class="{ active: currentTab === i }"
        @tap="switchTab(i)"
      >
        <text class="tab-text">{{ fmt(tab.key) }}</text>
      </view>
      <!-- 滑动指示条 -->
      <view class="tab-indicator" :style="indicatorStyle"></view>
    </view>

    <!-- 骨架屏：数据加载中（真机不依赖原生 loading，改用页面内骨架占位） -->
    <view v-if="loading" class="skeleton-body">
      <!-- 套餐名称骨架 -->
      <view class="sk-card">
        <view class="sk sk-line sk-title"></view>
        <view class="sk-tag-row">
          <view class="sk sk-tag"></view>
          <view class="sk sk-tag"></view>
          <view class="sk sk-tag"></view>
        </view>
      </view>

      <!-- 警告横幅骨架 -->
      <view class="sk-banner">
        <view class="sk sk-circle"></view>
        <view class="sk sk-line sk-warn-line"></view>
      </view>

      <!-- 选择天数骨架 -->
      <view class="sk-card">
        <view class="sk sk-line sk-section-title"></view>
        <view class="sk-grid">
          <view class="sk sk-cell" v-for="i in 8" :key="'d' + i"></view>
        </view>
      </view>

      <!-- 选择数据骨架 -->
      <view class="sk-card">
        <view class="sk sk-line sk-section-title"></view>
        <view class="sk-grid">
          <view class="sk sk-cell-data" v-for="i in 6" :key="'g' + i"></view>
        </view>
      </view>

      <!-- 套餐详情骨架 -->
      <view class="sk-card">
        <view class="sk sk-line sk-section-title"></view>
        <view class="sk sk-info-line" v-for="i in 3" :key="'l' + i"></view>
        <view class="sk sk-short-line"></view>
      </view>

      <view class="footer-safe"></view>
    </view>

    <!-- 页面原生滚动，onPageScroll 联动高亮 -->
    <view v-if="pkg" class="detail-body">
      <!-- ===== 套餐选择 ===== -->
      <view id="sec-select" class="sec-anchor">
      <!-- 套餐名称卡片 -->
      <view class="pkg-name-card">
        <view class="pkg-name-row">
          <text class="pkg-name-text">{{ fmt('detail.nameSuffix', { name: pkg.countryName }) }}</text>
          <view class="pkg-name-arrow-icon" @tap="openPackageDrawer">
            <view class="chevron-down"></view>
          </view>
        </view>
        <view class="pkg-tags">
          <text class="pkg-tag sold">{{ fmt('detail.sold', { n: pkg.soldCount ?? 0 }) }}</text>
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
            :key="c.gb + (c.isUnlimited ? '-unlimited' : '')"
            class="data-cell"
            :class="{ active: selectedGb === c.gb && selectedIsUnlimited === c.isUnlimited }"
            @tap="selectData(c)"
          >
            <text class="data-text" :class="{ unlimited: c.isUnlimited }">{{ c.isUnlimited ? fmt('package.unlimited') : fmt('detail.totalGb', { gb: c.gb }) }}</text>
            <text v-if="c.isUnlimited" class="data-price-hint">{{ selectedDays }}{{ fmt('detail.dayUnitShort') }}{{ fmt('detail.onlyNeed') }}{{ c.priceDisplay }}</text>
            <view v-if="selectedGb === c.gb && selectedIsUnlimited === c.isUnlimited" class="data-check-badge">
              <text class="data-check-text">✓</text>
            </view>
          </view>
        </view>
        <!-- 不限量套餐说明：高速额度用完后限速，eSIM 仍可使用 -->
        <view v-if="selectedPkg && selectedPkg.isUnlimited" class="unlimited-note">
          <text class="unlimited-note-txt">{{ fmt('detail.unlimitedHint', { gb: selectedPkg.gb }) }}</text>
        </view>
      </view>
      </view><!-- /sec-select -->

      <!-- ===== 套餐详情 ===== -->
      <view id="sec-detail" class="sec-anchor">
      <view class="info-section">
        <text class="info-title">{{ fmt('detail.detailTitle') }}</text>
        <view class="info-item">
          <text class="info-icon-text">📍</text>
          <text class="info-label">{{ fmt('detail.coverage') }}</text>
          <text class="info-value">{{ fmtPkgCoverage(pkg) }}</text>
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
      </view><!-- /sec-detail -->

      <!-- ===== 使用须知 ===== -->
      <view id="sec-notice" class="sec-anchor">
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
        <view class="link-row" @tap="goSupportedModels">
          <text class="link-text">{{ fmt('detail.supportModels') }}</text>
          <text class="link-arrow">›</text>
        </view>
        <view class="link-divider"></view>
        <view class="link-row" @tap="goUsageNotice">
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
      </view><!-- /sec-notice -->

      <view class="footer-safe"></view>
    </view>

    <!-- 底部价格栏 -->
    <view v-if="pkg" class="bottom-bar">
      <view class="price-area">
        <text class="price-currency">{{ sym }}</text>
        <text class="price-main">{{ priceNum }}</text>
      </view>
      <view class="buy-btn" hover-class="buy-btn--hover" @tap="buy">{{ fmt('detail.buyNow') }}</view>
    </view>

    <!-- 底部价格栏骨架 -->
    <view v-if="loading" class="bottom-bar skeleton-bottom-bar">
      <view class="sk sk-line sk-price-short"></view>
      <view class="sk sk-btn-short"></view>
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
          <view class="drawer-tag-wrap">
            <view
              v-for="pkg in filteredDrawerPackages"
              :key="pkg.id"
              class="drawer-pkg-tagv2"
              :class="{ active: isCurrentPkg(pkg) }"
              @tap="selectPackage(pkg)"
            >
              <text class="drawer-pkg-tagv2-text">{{ pkg.countryName }}</text>
              <text v-if="isCurrentPkg(pkg)" class="drawer-pkg-tagv2-check">✓</text>
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
import { COVER_GRADIENTS } from '@/theme'

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
      loading: true,
      allPackages: [],
      currentTab: 0,
      tabs: [
        { key: 'detail.tabSelect', anchor: 'sec-select' },
        { key: 'detail.tabDetail', anchor: 'sec-detail' },
        { key: 'detail.tabNotice', anchor: 'sec-notice' }
      ],
      sectionOffsets: [],
      _tabH: 0,
      selectedDays: 0,
      selectedGb: 0,
      selectedIsUnlimited: false,
      showDrawer: false,
      drawerSearch: '',
      drawerActiveCat: '历史/热门',
      drawerCategories: ['历史/热门', '跨境组合', '亚洲', '欧洲', '美洲', '非洲', '大洋洲'],
      drawerAllPackages: []
    }
  },
  computed: {
    // 天数区固定展示所有可选天数的并集，不再随选中的流量变化
    dayCells() {
      if (!this.allPackages.length) return []
      return Array.from(new Set(
        this.allPackages.filter(p => p.days).map(p => p.days)
      )).sort((a, b) => a - b)
    },
    dataCells() {
      if (!this.allPackages.length || !this.selectedDays) return []
      // 分组键需区分「相同GB数的限量/不限量」两种套餐（如 3GB 限量与 3GB 高速不限量并存）
      const byGb = new Map()
      for (const p of this.allPackages) {
        if (p.days !== this.selectedDays || !p.gb) continue
        const key = p.gb + (p.isUnlimited ? '-unlimited' : '')
        const cur = byGb.get(key)
        if (!cur || p.price < cur.price) byGb.set(key, { gb: p.gb, isUnlimited: !!p.isUnlimited, price: p.price, currency: p.currency })
      }
      return Array.from(byGb.values())
        .sort((a, b) => a.gb - b.gb || (a.isUnlimited ? 1 : 0) - (b.isUnlimited ? 1 : 0))
        .map(c => ({
          ...c,
          priceDisplay: Number(c.price).toFixed(2)
        }))
    },
    selectedPkg() {
      if (!this.allPackages.length) return null
      const matches = this.allPackages.filter(
        p => p.days === this.selectedDays && p.gb === this.selectedGb && !!p.isUnlimited === this.selectedIsUnlimited
      )
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
        // 显示所有地区，不做筛选
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
      // 每个地区取一条代表套餐（最低价），像首页卡片一样展示
      const byRegion = new Map()
      for (const p of packages) {
        const region = p.countryName || p.countryCode || '其他'
        const cur = byRegion.get(region)
        if (!cur || p.price < cur.price) {
          byRegion.set(region, p)
        }
      }
      const list = Array.from(byRegion.values())
      // 按价格排序
      return list.sort((a, b) => a.price - b.price)
    },
    // 滑动指示条定位：宽度按 tab 均分，translateX 按当前索引平移
    indicatorStyle() {
      const n = this.tabs.length || 1
      return {
        width: (100 / n) + '%',
        transform: 'translateX(' + (this.currentTab * 100) + '%)'
      }
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
    onReady() {
      this.measureSections()
    },
    // 页面滚动高亮联动（页面级生命周期）
    onPageScroll(e) {
      const st = (e && e.scrollTop) || 0
      const offs = this.sectionOffsets || []
      if (!offs.length) {
        this.measureSections()
        return
      }
      let active = 0
      for (let i = 0; i < offs.length; i++) {
        if (st >= offs[i] - (this._tabH || 0) - 20) active = i
      }
      this.currentTab = active
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
      this.selectedIsUnlimited = !!best.isUnlimited
    },
    // 指定流量（含限量/不限量）下真实存在的天数集合（升序）
    validDaysFor(gb, isUnlimited) {
      return Array.from(new Set(
        this.allPackages
          .filter(p => p.gb === gb && !!p.isUnlimited === isUnlimited && p.days)
          .map(p => p.days)
      )).sort((a, b) => a - b)
    },
    selectDays(d) {
      this.selectedDays = d
      if (!this.dataCells.some(c => c.gb === this.selectedGb && c.isUnlimited === this.selectedIsUnlimited)) {
        const fallback = this.dataCells[0]
        this.selectedGb = fallback ? fallback.gb : 0
        this.selectedIsUnlimited = fallback ? !!fallback.isUnlimited : false
      }
      this.measureSections()
    },
    selectData(c) {
      this.selectedGb = c.gb
      this.selectedIsUnlimited = !!c.isUnlimited
      // 天数区固定展示所有可选天数，仅当所选流量不存在当前天数组合时，吸附到最接近的有效天数
      const valid = this.validDaysFor(this.selectedGb, this.selectedIsUnlimited)
      if (valid.length && !valid.includes(this.selectedDays)) {
        const cur = this.selectedDays
        this.selectedDays = valid.reduce(
          (a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a),
          valid[0]
        )
      }
      this.measureSections()
    },
    async load() {
      // 用页面内骨架屏代替原生 loading（真机原生 toast 常不显示）
      this.loading = true
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
        this.loading = false
        this.measureSections()
      }
    },
    async loadAllPackages() {
      // 尝试加载全量套餐（需线上服务器部署 /catalog/all 路由后才可用）
      let loaded = false
      try {
        const res = await api.getAllPackages()
        if (res.code === 0 && res.data.packages && res.data.packages.length > 0) {
          this.drawerAllPackages = res.data.packages
          loaded = true
        }
      } catch (e) {
        // 线上未部署 /catalog/all 路由时静默 fallback
      }

      // Fallback: 使用当前国家的套餐
      if (!loaded && this.allPackages.length > 0) {
        this.drawerAllPackages = this.allPackages
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
    goSupportedModels() {
      uni.navigateTo({ url: '/pages/supported-models/supported-models' })
    },
    goUsageNotice() {
      uni.navigateTo({ url: '/pages/usage-notice/usage-notice' })
    },
    // 点击 Tab：滚动到对应区块
    switchTab(i) {
      this.currentTab = i
      const offs = this.sectionOffsets || []
      let top = offs[i] || 0
      top = Math.max(0, top - (this._tabH || 0))
      uni.pageScrollTo({ scrollTop: top, duration: 250 })
    },
    // 测量各区块在页面中的滚动位置与 Tab 栏高度（用于点击定位与滚动高亮）
    measureSections() {
      this.$nextTick(() => {
        uni.createSelectorQuery()
          .select('.tab-bar')
          .boundingClientRect((bar) => {
            this._tabH = bar ? bar.height : 0
          })
          .exec()
        uni.createSelectorQuery()
          .selectViewport()
          .scrollOffset((res) => {
            const refScroll = res ? res.scrollTop : 0
            uni.createSelectorQuery()
              .selectAll('.sec-anchor')
              .boundingClientRect((rects) => {
                this.sectionOffsets = (rects || []).map((r) => r.top + refScroll)
              })
              .exec()
          })
          .exec()
      })
    },
    openPackageDrawer() {
      this.showDrawer = true
    },
    closePackageDrawer() {
      this.showDrawer = false
      this.drawerSearch = ''
      this.drawerActiveCat = '历史/热门'
    },
    onDrawerSearch() {
    },
    isCurrentPkg(p) {
      return this.pkg && p.id === this.pkg.id
    },
    getCoverGradient(idx) {
      return COVER_GRADIENTS[idx % COVER_GRADIENTS.length]
    },
    selectPackage(p) {
      // 切换当前套餐
      this.pkg = p
      this.selectedDays = p.days || this.selectedDays
      this.selectedGb = p.gb || this.selectedGb
      this.selectedIsUnlimited = !!p.isUnlimited
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
  background: $bg-page;
}

/* ========== Tab 栏（固定上方） ========== */
.tab-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #ffffff;
  border-bottom: 1rpx solid $line;
  z-index: 100;
}

.tab-item {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 8rpx;
  white-space: nowrap;
}

.tab-text {
  font-size: 28rpx;
  color: $ink-3;
  white-space: nowrap;
  transition: color 0.3s ease;

  .active & {
    color: $brand;
    font-weight: 700;
  }
}

/* 滑动指示条 */
.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 6rpx;
  background: $brand;
  border-radius: 3rpx;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

/* ========== 内容区 ========== */
.detail-body {
  padding: 20rpx $page-pad;
  padding-top: 100rpx;
  padding-bottom: 40rpx;
}

/* ========== 骨架屏 ========== */
.skeleton-body {
  padding: 20rpx $page-pad;
  padding-top: 100rpx;
  padding-bottom: 40rpx;
}

.sk-card {
  background: $bg-card;
  border-radius: 20rpx;
  padding: 32rpx;
  margin-top: 16rpx;
}

.sk {
  background: linear-gradient(100deg, $brand-lighter 25%, #E6EBFF 37%, $brand-lighter 63%);
  background-size: 400% 100%;
  border-radius: 8rpx;
  animation: skShimmer 1.4s ease infinite;
}

.sk-line {
  height: 28rpx;
}

.sk-title {
  height: 40rpx;
  width: 55%;
  border-radius: 12rpx;
}

.sk-tag-row {
  display: flex;
  margin-top: 24rpx;
}

.sk-tag {
  width: 96rpx;
  height: 36rpx;
  border-radius: 10rpx;
  margin-right: 16rpx;
}

.sk-banner {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: 16rpx;
  padding: 26rpx 30rpx;
  margin-top: 24rpx;
}

.sk-circle {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.sk-warn-line {
  width: 70%;
  height: 26rpx;
}

.sk-section-title {
  width: 220rpx;
  height: 32rpx;
  margin-bottom: 24rpx;
}

.sk-grid {
  display: flex;
  flex-wrap: wrap;
}

.sk-cell {
  width: calc(25% - 12rpx);
  height: 110rpx;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  border-radius: 16rpx;

  &:nth-child(4n) {
    margin-right: 0;
  }
}

.sk-cell-data {
  width: calc(33.33% - 14rpx);
  height: 110rpx;
  margin-right: 20rpx;
  margin-bottom: 16rpx;
  border-radius: 16rpx;

  &:nth-child(3n) {
    margin-right: 0;
  }
}

.sk-info-line {
  height: 26rpx;
  margin: 14rpx 0;
}

.sk-short-line {
  width: 55%;
  height: 26rpx;
  margin-top: 20rpx;
}

.skeleton-bottom-bar {
  padding: 28rpx $page-pad;
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  justify-content: space-between;
}

.sk-price-short {
  width: 160rpx;
  height: 44rpx;
}

.sk-btn-short {
  width: 200rpx;
  height: 72rpx;
  border-radius: 999rpx;
}

@keyframes skShimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
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
  color: $ink;
}

.pkg-name-arrow-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $brand-lighter;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.chevron-down {
  width: 20rpx;
  height: 20rpx;
  border-right: 4rpx solid $brand;
  border-bottom: 4rpx solid $brand;
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
    color: $sun;
    background: $sun-light;
  }

  &.normal {
    color: $brand;
    background: $brand-light;
  }
}

/* ========== 警告横幅（柔和琥珀警示，与浅色画布视觉语言一致） ========== */
.warn-banner {
  display: flex;
  align-items: center;
  background: $warn-bg;
  border-left: 6rpx solid $warn;
  border-radius: 16rpx;
  padding: 26rpx 30rpx;
  margin-top: 24rpx;
}

.warn-icon-box {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(217, 119, 6, 0.12);
  margin-right: 16rpx;
  flex-shrink: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23D97706' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'/%3E%3Cpath d='M10.3 21a1.94 1.94 0 0 0 3.4 0'/%3E%3C/svg%3E");
  background-size: 28rpx 28rpx;
  background-repeat: no-repeat;
  background-position: center;
}

.warn-txt {
  flex: 1;
  font-size: 26rpx;
  color: $warn-deep;
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
  color: $ink;
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
  background: $brand-lighter;
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
  color: $ink;
  font-weight: 600;

  .active & {
    color: $brand;
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
  background: $brand;
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
  background: $brand-lighter;
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
    border-color: $coral;
    background: $coral-light;
  }
}

.data-text {
  font-size: 28rpx;
  color: $ink;
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
  line-height: 1.3;
}

/* 不限量套餐说明（高速额度用完后限速可用） */
.unlimited-note {
  margin-top: 16rpx;
  background: $brand-lighter;
  border-radius: 12rpx;
  padding: 18rpx 24rpx;
}

.unlimited-note-txt {
  font-size: 22rpx;
  color: $brand-deep;
  line-height: 1.6;
}

.data-check-badge {
  position: absolute;
  bottom: 4rpx;
  right: 8rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: $coral;
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
  color: $ink;
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
  color: $ink-2;
  flex-shrink: 0;
}

.info-value {
  font-size: 28rpx;
  color: $ink;
  font-weight: 600;
}

.desc-inline {
  font-weight: 400;
  color: $ink;
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
  color: $brand;
  font-weight: 600;
}

.pkg-type-link-arrow {
  font-size: 28rpx;
  color: $brand;
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
  background: $brand-sky;
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
  color: $ink;
  font-weight: 600;
}

.link-arrow {
  font-size: 32rpx;
  color: $ink-3;
}

.link-divider {
  height: 1rpx;
  background: $line;
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
  background: $teal;
  margin-right: 12rpx;
  flex-shrink: 0;
}

.notice-title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 800;
  color: $ink;
}

.notice-collapse-icon {
  font-size: 28rpx;
  color: $brand;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notice-divider {
  height: 2rpx;
  background: $brand;
  margin: 20rpx 0;
  border-radius: 1rpx;
}

.notice-txt {
  font-size: 26rpx;
  color: $ink-2;
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
  color: $ink;
  font-weight: 700;
  margin-right: 4rpx;
}

.price-main {
  font-size: 56rpx;
  color: $ink;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.buy-btn {
  background: $brand;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
  padding: 24rpx 64rpx;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 24rpx rgba(6, 44, 69, 0.35);
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
  border-bottom: 1rpx solid $line;
}

.drawer-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $ink;
}

.drawer-close {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $bg-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: $ink-3;
}

/* 搜索栏 */
.drawer-search-bar {
  padding: 20rpx 40rpx;
  border-bottom: 1rpx solid $line;
}

.drawer-search-input {
  display: flex;
  align-items: center;
  background: $bg-soft;
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
  color: $ink;
}

/* 分类标签 */
.drawer-tabs {
  display: flex;
  padding: 20rpx 40rpx;
  border-bottom: 1rpx solid $line;
  white-space: nowrap;
}

.drawer-tab {
  padding: 12rpx 24rpx;
  margin-right: 16rpx;
  border-radius: 24rpx;
  background: $bg-soft;

  &.active {
    background: $brand;
  }
}

.drawer-tab-text {
  font-size: 24rpx;
  color: $ink-2;

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
  color: $ink-3;
}

.drawer-group {
  margin-bottom: 32rpx;
}

.drawer-group-title {
  font-size: 26rpx;
  color: $ink-3;
  font-weight: 600;
  margin-bottom: 16rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid $line;
}

.drawer-pkg-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid $bg-soft;
  position: relative;

  &:last-child {
    border-bottom: none;
  }

  &.active {
    background: $brand-lighter;
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
  color: $ink;
  font-weight: 600;
  margin-bottom: 4rpx;
}

.drawer-pkg-spec {
  font-size: 22rpx;
  color: $ink-3;
}

.drawer-pkg-price {
  font-size: 28rpx;
  color: $brand;
  font-weight: 700;
  margin-right: 16rpx;
}

.drawer-pkg-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: $brand;
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
  border-bottom: 1rpx solid $line;
  position: relative;
}

.drawer-title-v2 {
  font-size: 36rpx;
  font-weight: 700;
  color: $ink;
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
  color: $ink-3;
}

.drawer-search-v2 {
  padding: 20rpx 32rpx;
}

.drawer-search-input-v2 {
  display: flex;
  align-items: center;
  background: $bg-soft;
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
  color: $ink;
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
  background: $bg-page;
  border-right: 1rpx solid $line;
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
    border-left-color: $brand;
  }
}

.drawer-sidebar-text {
  font-size: 26rpx;
  color: $ink-2;
  font-weight: 500;

  .active & {
    color: $brand;
    font-weight: 700;
  }
}

/* 右侧内容区 */
.drawer-content {
  flex: 1;
  padding: 24rpx 24rpx;
  overflow-y: auto;
}

/* 地区套餐标签 */
.drawer-tag-wrap {
  display: flex;
  flex-wrap: wrap;
}

.drawer-pkg-tagv2 {
  display: flex;
  align-items: center;
  padding: 16rpx 28rpx;
  background: $bg-soft;
  border-radius: 999rpx;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
  transition: all 0.2s ease;

  &.active {
    background: $brand;
  }
}

.drawer-pkg-tagv2-text {
  font-size: 26rpx;
  color: $ink;
  font-weight: 500;
  white-space: nowrap;

  .active & {
    color: #ffffff;
    font-weight: 600;
  }
}

.drawer-pkg-tagv2-check {
  font-size: 22rpx;
  color: #ffffff;
  font-weight: 700;
  margin-left: 8rpx;
}
</style>
