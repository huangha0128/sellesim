<template>
  <view class="home">
    <view class="hero" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="hero-deco deco-1"></view>
      <view class="hero-deco deco-2"></view>
      <view class="hero-deco deco-3"></view>

      <view class="hero-inner">
        <view class="hero-top">
          <view class="hero-brand">
            <view class="brand-logo">
              <image class="brand-logo-img" src="/static/icons/hero-logo.png" mode="aspectFit" />
            </view>
            <view class="brand-txt">
              <text class="brand-name">YYeSim</text>
              <text class="brand-slogan">{{ fmt('index.slogan') }}</text>
            </view>
          </view>
          <view class="hero-avatar" hover-class="hero-avatar--hover" @click="goProfile">
            <image class="avatar-img" src="/static/icons/hero-avatar.png" mode="aspectFit" />
          </view>
        </view>

        <view class="hero-title">
          <text class="hero-title-main">{{ fmt('index.titleMain') }}</text>
          <text class="hero-title-sub">{{ fmt('index.titleSub') }}</text>
        </view>

        <view class="search-bar" hover-class="search-bar--hover" @click="goCountries">
          <view class="search-icon">
            <image src="/static/icons/search-icon.png" mode="aspectFit" />
          </view>
          <text class="search-ph">{{ fmt('index.searchPlaceholder') }}</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view class="quick-card">
        <view
          v-for="r in regions"
          :key="r.code"
          class="quick-item"
          hover-class="quick-item--hover"
          @click="goPackages(r.code)"
        >
          <view class="quick-icon">
            <image class="quick-flag" :src="getFlagImage(r.code)" mode="aspectFit" />
          </view>
          <text class="quick-name">{{ r.name }}</text>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">{{ fmt('index.hotCountries') }}</text>
          <view class="section-more" @click="goCountries">
            <text>{{ fmt('index.allCountries') }}</text>
          </view>
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
              <image v-if="hasFlag(c.code)" class="hot-flag-img" :src="getFlagImage(c.code)" mode="aspectFit" />
              <text v-else class="hot-flag-letter">{{ flagLetter(c.name) }}</text>
            </view>
            <text class="hot-name">{{ c.name }}</text>
            <text class="hot-price">{{ fmt('index.priceFrom', { price: minPrice(c.code) }) }}</text>
          </view>
        </scroll-view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">{{ fmt('index.hotPackages') }}</text>
          <view class="section-more" @click="goCountries">
            <text>{{ fmt('index.viewMore') }}</text>
          </view>
        </view>
        <view
          v-for="p in hotPackages"
          :key="p.id"
          class="pkg-card"
          hover-class="pkg-card--hover"
          @click="goDetail(p.id)"
        >
          <view class="pkg-flag">
            <image v-if="hasFlag(p.countryCode)" class="pkg-flag-img" :src="getFlagImage(p.countryCode)" mode="aspectFit" />
            <text v-else class="pkg-flag-letter">{{ flagLetter(p.countryName) }}</text>
          </view>
          <view class="pkg-main">
            <view class="pkg-head">
              <text class="pkg-country">{{ p.countryName }}</text>
              <text v-if="p.tag" class="pkg-tag" :style="{ color: p.tagColor, background: p.tagColor + '1A' }">{{ p.tag }}</text>
            </view>
            <view class="pkg-meta">
              <text class="pkg-meta-item">{{ fmt('index.gbTraffic', { gb: p.gb }) }}</text>
              <text class="pkg-dot">·</text>
              <text class="pkg-meta-item">{{ fmt('index.daysValid', { days: p.days }) }}</text>
              <text class="pkg-dot">·</text>
              <text class="pkg-meta-item">{{ p.network }}</text>
            </view>
          </view>
          <view class="pkg-right">
            <view class="pkg-price">
              <text class="pkg-price-symbol">¥</text>
              <text class="pkg-price-num">{{ fmtPrice(p.price) }}</text>
            </view>
            <view class="pkg-arrow">
              <text>›</text>
            </view>
          </view>
        </view>
      </view>

      <view class="guide-banner" hover-class="guide-banner--hover" @click="goGuide">
        <view class="guide-deco"><image src="/static/icons/feat-signal.png" mode="aspectFit" style="width: 44rpx; height: 44rpx;" /></view>
        <view class="guide-text">
          <text class="guide-title">{{ fmt('index.guideTitle') }}</text>
          <text class="guide-sub">{{ fmt('index.guideSub') }}</text>
        </view>
        <view class="guide-btn">{{ fmt('index.guideBtn') }}</view>
      </view>

      <view class="footer-safe"></view>
    </view>

    <FloatingTabBar current="home" />
  </view>
</template>

<script>
import FloatingTabBar from '@/components/FloatingTabBar.vue'
import { api } from '@/utils/api'
import { store } from '@/store'
import { t as translate } from '@/locales'

// 命名占位符兜底替换（如 {gb}、{days}、{price}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

// 国家/地区国旗图标映射（模块级常量，避免写入 methods 导致实例未绑定）
const FLAG_MAP = {
  'GLOBAL': '/static/icons/region-global.png',
  'ASIA': '/static/icons/region-asia.png',
  'EUROPE': '/static/icons/region-europe.png',
  'AMERICAS': '/static/icons/region-americas.png',
  'OCEANIA': '/static/icons/region-oceania.png',
  'AE': '/static/icons/flag-ae.png',
  'AR': '/static/icons/flag-ar.png',
  'AU': '/static/icons/flag-au.png',
  'BR': '/static/icons/flag-br.png',
  'CA': '/static/icons/flag-ca.png',
  'CH': '/static/icons/flag-ch.png',
  'CN': '/static/icons/flag-cn.png',
  'DE': '/static/icons/flag-de.png',
  'EG': '/static/icons/flag-eg.png',
  'ES': '/static/icons/flag-es.png',
  'FR': '/static/icons/flag-fr.png',
  'GB': '/static/icons/flag-gb.png',
  'GR': '/static/icons/flag-gr.png',
  'HK': '/static/icons/flag-hk.png',
  'ID': '/static/icons/flag-id.png',
  'IN': '/static/icons/flag-in.png',
  'IT': '/static/icons/flag-it.png',
  'JP': '/static/icons/flag-jp.png',
  'KR': '/static/icons/flag-kr.png',
  'LK': '/static/icons/flag-lk.png',
  'MA': '/static/icons/flag-ma.png',
  'MO': '/static/icons/flag-mo.png',
  'MV': '/static/icons/flag-mv.png',
  'MX': '/static/icons/flag-mx.png',
  'MY': '/static/icons/flag-my.png',
  'NL': '/static/icons/flag-nl.png',
  'NZ': '/static/icons/flag-nz.png',
  'PH': '/static/icons/flag-ph.png',
  'PT': '/static/icons/flag-pt.png',
  'RU': '/static/icons/flag-ru.png',
  'SG': '/static/icons/flag-sg.png',
  'TH': '/static/icons/flag-th.png',
  'TR': '/static/icons/flag-tr.png',
  'TW': '/static/icons/flag-tw.png',
  'US': '/static/icons/flag-us.png',
  'VN': '/static/icons/flag-vn.png',
  'ZA': '/static/icons/flag-za.png'
}

export default {
  components: { FloatingTabBar },
  data() {
    return {
      statusBarHeight: 44,
      regions: [],
      hotCountries: [],
      hotPackages: [],
      priceMap: {},
      store
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
    async loadData() {
      uni.showLoading({ title: this.fmt('common.loading'), mask: true })
      try {
        const res = await api.getHomeData()
        this.regions = res.data.regions.slice(0, 4)
        this.hotCountries = res.data.hotCountries
        this.hotPackages = res.data.hotPackages
        this.priceMap = res.data.priceMap || {}
      } finally {
        uni.hideLoading()
      }
    },
    getFlagImage(code) {
      return FLAG_MAP[code] || '/static/icons/region-global.png'
    },
    hasFlag(code) {
      const v = FLAG_MAP[code]
      return !!v && v.includes('/flag-')
    },
    flagLetter(name) {
      return name ? String(name).slice(0, 1) : '·'
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
      uni.reLaunch({ url: '/pages/profile/profile' })
    }
  }
}
</script>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: $bg-page;
}

/* ============ Hero ============ */
.hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 84% 8%, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 40%),
    radial-gradient(circle at 12% 92%, rgba(56, 189, 248, 0.55) 0%, rgba(56, 189, 248, 0) 46%),
    linear-gradient(160deg, #3bb8f5 0%, #0ea5e9 52%, #0369a1 100%);
  padding-bottom: 132rpx;
}

.hero-deco {
  position: absolute;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.14);
}

.deco-1 {
  width: 360rpx;
  height: 360rpx;
  right: -140rpx;
  top: -120rpx;
  background: rgba(255, 255, 255, 0.09);
}

.deco-2 {
  width: 220rpx;
  height: 220rpx;
  left: -90rpx;
  top: 320rpx;
  background: rgba(255, 255, 255, 0.05);
}

.deco-3 {
  width: 96rpx;
  height: 96rpx;
  right: 48rpx;
  bottom: 40rpx;
  background: rgba(255, 255, 255, 0.06);
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
  width: 60rpx;
  height: 60rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.22);
  border: 1rpx solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  box-shadow: inset 0 2rpx 6rpx rgba(255, 255, 255, 0.35);
}

.brand-logo-img {
  width: 40rpx;
  height: 40rpx;
}

.brand-txt {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 1rpx;
  line-height: 1.15;
}

.brand-slogan {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
  letter-spacing: 1rpx;
}

.hero-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.24);
  border: 2rpx solid rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 2rpx 6rpx rgba(255, 255, 255, 0.35),
    0 6rpx 18rpx rgba(3, 105, 161, 0.22);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.94);
  }
}

.avatar-img {
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
}

.hero-title {
  margin-top: 52rpx;
  display: flex;
  flex-direction: column;
  text-shadow: 0 4rpx 18rpx rgba(3, 105, 161, 0.3);
}

.hero-title-main {
  font-size: 64rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 4rpx;
  line-height: 1.12;
}

.hero-title-sub {
  margin-top: 14rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.86);
  letter-spacing: 2rpx;
  line-height: 1.2;
}

.search-bar {
  margin-top: 40rpx;
  height: 96rpx;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  padding: 0 20rpx 0 24rpx;
  box-shadow:
    0 18rpx 40rpx rgba(3, 105, 161, 0.28),
    inset 0 2rpx 6rpx rgba(255, 255, 255, 0.95);

  &--hover {
    transform: scale(0.99);
  }
}

.search-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: $brand-lighter;
  border: 1rpx solid rgba(14, 165, 233, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
  box-shadow: inset 0 2rpx 4rpx rgba(14, 165, 233, 0.08);

  image {
    width: 30rpx;
    height: 30rpx;
    display: block;
  }
}

.search-ph {
  font-size: 26rpx;
  color: $ink-3;
  font-weight: 500;
}

/* ============ 内容区 ============ */
.content {
  padding: 0 $page-pad;
  margin-top: -88rpx;
  position: relative;
}

/* --- 悬浮快捷入口卡 --- */
.quick-card {
  display: flex;
  background: #ffffff;
  border-radius: $radius-xl;
  padding: 30rpx 10rpx;
  border: 1rpx solid rgba(227, 238, 247, 0.9);
  box-shadow:
    0 24rpx 56rpx rgba(15, 84, 140, 0.14),
    inset 0 2rpx 4rpx rgba(255, 255, 255, 0.95);
}

.quick-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.15s ease;

  &--hover {
    transform: translateY(-4rpx);
  }
}

.quick-icon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 30rpx;
  background: linear-gradient(160deg, #e6f6fe 0%, #d3eefe 100%);
  border: 1rpx solid rgba(14, 165, 233, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2rpx 6rpx rgba(255, 255, 255, 0.9);
}

.quick-flag {
  width: 52rpx;
  height: 52rpx;
}

.quick-name {
  margin-top: 14rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: $ink-2;
}

/* --- 区块 --- */
.section {
  margin-top: 44rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 26rpx;
}

.section-title {
  font-size: 36rpx;
  font-weight: 800;
  color: $ink;
  position: relative;
  padding-left: 24rpx;
  line-height: 1.3;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8rpx;
    height: 34rpx;
    border-radius: 4rpx;
    background: $gradient-brand;
    box-shadow: 0 4rpx 10rpx rgba(14, 165, 233, 0.3);
  }
}

.section-more {
  display: flex;
  align-items: center;
  font-size: 23rpx;
  font-weight: 600;
  color: $brand-deep;

  text {
    color: $brand-deep;
  }
}

/* --- 热门目的地 --- */
.hot-scroll {
  white-space: nowrap;
  width: 100%;
}

.hot-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(165deg, #ffffff 0%, #f7fcff 100%);
  border-radius: 30rpx;
  padding: 34rpx 18rpx 30rpx;
  margin-right: 22rpx;
  width: 176rpx;
  border: 1rpx solid rgba(227, 238, 247, 0.9);
  box-shadow:
    0 10rpx 28rpx rgba(15, 84, 140, 0.08),
    inset 0 2rpx 3rpx rgba(255, 255, 255, 0.95);
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &--hover {
    transform: translateY(-8rpx);
    box-shadow:
      0 18rpx 40rpx rgba(15, 84, 140, 0.14),
      inset 0 2rpx 3rpx rgba(255, 255, 255, 0.95);
  }
}

.hot-flag {
  width: 104rpx;
  height: 104rpx;
  border-radius: 36rpx;
  background: linear-gradient(160deg, #e6f6fe 0%, #d3eefe 100%);
  border: 1rpx solid rgba(14, 165, 233, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2rpx 6rpx rgba(255, 255, 255, 0.9);
}

.hot-flag-img {
  width: 66rpx;
  height: 66rpx;
}

.hot-flag-letter {
  font-size: 44rpx;
  font-weight: 800;
  color: $brand-deep;
  line-height: 1;
}

.hot-name {
  margin-top: 20rpx;
  font-size: 27rpx;
  font-weight: 700;
  color: $ink;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 146rpx;
  white-space: nowrap;
}

.hot-price {
  margin-top: 8rpx;
  font-size: 23rpx;
  font-weight: 700;
  color: $brand-deep;
  font-variant-numeric: tabular-nums;
}

/* --- 热销套餐 --- */
.pkg-card {
  display: flex;
  align-items: center;
  background: linear-gradient(165deg, #ffffff 0%, #fbfeff 100%);
  border-radius: $radius-lg;
  padding: 28rpx 26rpx;
  margin-bottom: 22rpx;
  border: 1rpx solid rgba(227, 238, 247, 0.9);
  box-shadow:
    0 8rpx 24rpx rgba(15, 84, 140, 0.06),
    inset 0 2rpx 4rpx rgba(255, 255, 255, 0.95);
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &--hover {
    transform: translateY(-3rpx);
    box-shadow:
      0 16rpx 36rpx rgba(15, 84, 140, 0.12),
      inset 0 2rpx 4rpx rgba(255, 255, 255, 0.95);
  }
}

.pkg-flag {
  width: 96rpx;
  height: 96rpx;
  border-radius: 30rpx;
  background: linear-gradient(160deg, #e6f6fe 0%, #d3eefe 100%);
  border: 1rpx solid rgba(14, 165, 233, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 2rpx 6rpx rgba(255, 255, 255, 0.9);
}

.pkg-flag-img {
  width: 60rpx;
  height: 60rpx;
}

.pkg-flag-letter {
  font-size: 40rpx;
  font-weight: 800;
  color: $brand-deep;
  line-height: 1;
}

.pkg-main {
  flex: 1;
  min-width: 0;
  margin-left: 26rpx;
}

.pkg-head {
  display: flex;
  align-items: center;
}

.pkg-country {
  font-size: 31rpx;
  font-weight: 800;
  color: $ink;
  margin-right: 12rpx;
}

.pkg-tag {
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  line-height: 1.4;
  flex-shrink: 0;
}

.pkg-meta {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
}

.pkg-meta-item {
  font-size: 24rpx;
  color: $ink-2;
  font-variant-numeric: tabular-nums;
}

.pkg-dot {
  margin: 0 10rpx;
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
  color: $brand-deep;
  font-weight: 800;

  &-symbol {
    font-size: 24rpx;
  }

  &-num {
    font-size: 46rpx;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
}

.pkg-arrow {
  margin-top: 16rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $brand-lighter;
  border: 1rpx solid rgba(14, 165, 233, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2rpx 4rpx rgba(255, 255, 255, 0.9);

  text {
    font-size: 30rpx;
    font-weight: 700;
    color: $brand;
    line-height: 1;
    margin-top: -2rpx;
  }
}

/* --- 新手引导 --- */
.guide-banner {
  margin-top: 44rpx;
  background:
    radial-gradient(circle at 92% 16%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 44%),
    linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #0369a1 100%);
  border-radius: $radius-lg;
  padding: 32rpx 30rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 14rpx 36rpx rgba(14, 165, 233, 0.3);
  transition: transform 0.18s ease;

  &--hover {
    transform: scale(0.985);
  }
}

.guide-deco {
  width: 84rpx;
  height: 84rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 2rpx 6rpx rgba(255, 255, 255, 0.25);
}

.guide-text {
  flex: 1;
  margin-left: 26rpx;
  display: flex;
  flex-direction: column;
}

.guide-title {
  font-size: 30rpx;
  font-weight: 800;
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
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
  box-shadow: 0 6rpx 16rpx rgba(3, 105, 161, 0.22);
}

.footer-safe {
  height: calc(176rpx + env(safe-area-inset-bottom));
}
</style>
