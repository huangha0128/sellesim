<template>
  <view class="faq-page">
    <!-- 浅色 Hero 头部（首页同款：浅蓝紫渐变 + 编辑排版） -->
    <view class="page-hero">
      <text class="hero-overline">{{ $t('faq.eyebrow') }}</text>
      <text class="hero-title">{{ $t('faq.title') }}</text>
      <text class="hero-sub">{{ $t('faq.sub') }}</text>
    </view>

    <view class="page-body">
      <!-- 关键词搜索 -->
      <view class="search-bar">
        <image class="search-icon" :src="svgUri('search')" mode="aspectFit" />
        <input
          class="search-input"
          :value="keyword"
          :placeholder="$t('faq.searchPlaceholder')"
          placeholder-class="search-ph"
          confirm-type="search"
          @input="onSearch"
        />
        <view v-if="searching" class="search-clear" @tap="clearSearch">
          <image class="search-clear-icon" :src="svgUri('clear')" mode="aspectFit" />
        </view>
      </view>

      <!-- 无匹配结果 -->
      <view v-if="searching && !hasResult" class="search-empty">
        <image class="search-empty-icon" :src="svgUri('search')" mode="aspectFit" />
        <text class="search-empty-title">{{ $t('faq.searchEmptyTitle') }}</text>
        <text class="search-empty-sub">{{ $t('faq.searchEmptySub', { kw: keyword }) }}</text>
      </view>

      <!-- 多维度分组常见问题 -->
      <view class="faq-group" v-for="(g, gi) in filteredGroups" :key="gi">
        <view class="group-head">
          <view class="group-icon-wrap">
            <image class="group-icon" :src="svgUri(g.icon)" mode="aspectFit" />
          </view>
          <view class="group-titles">
            <text class="group-title">{{ g.title }}</text>
            <text class="group-count">{{ g.items.length }} {{ $t('faq.countUnit') }}</text>
          </view>
        </view>

        <view class="faq-card">
          <view
            v-for="(f, i) in g.items"
            :key="i"
            class="faq-item"
            :class="{ 'faq-item--open': open[gi] === i || searching }"
            @tap="toggle(gi, i)"
          >
            <view class="faq-q">
              <text class="faq-q-txt">{{ f.q }}</text>
              <view class="faq-chev"></view>
            </view>
            <view v-if="open[gi] === i || searching" class="faq-a">{{ f.a }}</view>
          </view>
        </view>
      </view>

      <view class="guide-card" hover-class="guide-card--hover" @tap="goGuide">
        <view class="guide-info">
          <text class="guide-title">{{ $t('faq.guideEntry') }}</text>
          <text class="guide-sub">{{ $t('faq.guideEntrySub') }}</text>
        </view>
        <view class="guide-chev"></view>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle, tRaw } from '@/locales'

/* 各维度分类的 SVG 图标（线性、品牌蓝），运行时编码为 data URI 供 <image> 使用 */
const ICON_SVGS = {
  order:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4050C0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h8l4 4v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M14.5 3.5v4.5h4.5"/><path d="M8 12h8M8 16h5"/></svg>',
  install:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4050C0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5h3"/><path d="M12 14v-4m0 0-2 2m2-2 2 2"/></svg>',
  signal:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4050C0" stroke-width="1.8" stroke-linecap="round"><path d="M5 17v-3M12 17V9M19 17V5"/></svg>',
  data:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4050C0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a8 8 0 1 1 16 0"/><path d="M12 14l4-4"/><circle cx="12" cy="14" r="1.6" fill="#4050C0" stroke="none"/></svg>',
  search:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4050C0" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  clear:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8B90B0" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
}

export default {
  data() {
    return {
      open: { 0: 0 },
      keyword: '',
      groups: []
    }
  },
  computed: {
    searching() {
      return this.keyword.trim().length > 0
    },
    filteredGroups() {
      const kw = this.keyword.trim().toLowerCase()
      if (!kw) return this.groups
      const out = []
      this.groups.forEach((g) => {
        const items = g.items.filter((f) =>
          (`${f.q} ${f.a}`).toLowerCase().includes(kw)
        )
        if (items.length) out.push({ ...g, items })
      })
      return out
    },
    hasResult() {
      return this.filteredGroups.length > 0
    }
  },
  onShow() {
    setNavTitle('pageTitle.faq')
    this.buildGroups()
  },
  created() {
    // uni-app 编译后 methods 无法引用外层 import 自由变量，
    // 需挂到实例上，统一用 this.tRaw 访问
    this.tRaw = tRaw
    this.buildGroups()
  },
  methods: {
    buildGroups() {
      this.groups = this.tRaw('faq.groups') || []
    },
    svgUri(name) {
      const s = ICON_SVGS[name]
      return s ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}` : ''
    },
    onSearch(e) {
      this.keyword = e.detail.value
    },
    clearSearch() {
      this.keyword = ''
    },
    toggle(gi, i) {
      const cur = this.open[gi]
      this.open = { ...this.open, [gi]: cur === i ? -1 : i }
    },
    goGuide() {
      uni.navigateTo({ url: '/pages/guide/guide' })
    }
  }
}
</script>

<style lang="scss" scoped>
.faq-page {
  min-height: 100vh;
  background: $bg-page;
  padding: 0 $page-pad;
}

/* ============ 浅色 Hero 头部（首页同款：浅蓝紫渐变 + 编辑排版） ============ */
.page-hero {
  margin: 0 (-$page-pad);
  background: $gradient-canvas;
  padding: 40rpx $page-pad 44rpx;
  border-radius: 0 0 48rpx 48rpx;
}

.hero-overline {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $brand;
  letter-spacing: 8rpx;
  margin-bottom: 16rpx;
}

.hero-title {
  display: block;
  font-size: 48rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $ink-3;
}

.page-body {
  padding-top: 28rpx;
}

/* ============ 关键词搜索 ============ */
.search-bar {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius;
  padding: 0 26rpx;
  height: 76rpx;
  box-shadow: $shadow-sm;
  margin-bottom: 30rpx;
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 26rpx;
  color: $ink;
}

.search-ph {
  color: $ink-3;
}

.search-clear {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12rpx;
  flex-shrink: 0;
}

.search-clear-icon {
  width: 30rpx;
  height: 30rpx;
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.search-empty-icon {
  width: 88rpx;
  height: 88rpx;
  opacity: 0.45;
}

.search-empty-title {
  margin-top: 24rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}

.search-empty-sub {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-3;
}

/* ============ 多维度分组 ============ */
.faq-group {
  margin-bottom: 34rpx;
}

.group-head {
  display: flex;
  align-items: center;
  padding: 0 4rpx 18rpx;
}

.group-icon-wrap {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: $brand-lighter;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
  flex-shrink: 0;
}

.group-icon {
  width: 32rpx;
  height: 32rpx;
}

.group-titles {
  display: flex;
  flex-direction: column;
}

.group-title {
  font-size: 31rpx;
  font-weight: 800;
  color: $ink;
  line-height: 1.2;
}

.group-count {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}

.faq-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 8rpx 30rpx;
  box-shadow: $shadow-sm;
}

.faq-item {
  border-bottom: 1rpx solid $line;
  padding: 26rpx 0;

  &:last-child {
    border-bottom: none;
  }
}

.faq-q {
  display: flex;
  align-items: center;
}

.faq-q-txt {
  flex: 1;
  font-size: 27rpx;
  font-weight: 600;
  color: $ink;
  line-height: 1.4;
}

.faq-chev {
  width: 16rpx;
  height: 16rpx;
  border-right: 3rpx solid $ink-3;
  border-bottom: 3rpx solid $ink-3;
  transform: rotate(45deg);
  margin-left: 20rpx;
  margin-top: -6rpx;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.faq-item--open .faq-chev {
  transform: rotate(-135deg);
}

.faq-a {
  display: block;
  margin-top: 14rpx;
  padding-right: 36rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.75;
}

/* ============ 底部安装指南入口 ============ */
.guide-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  box-shadow: $shadow-sm;
  display: flex;
  align-items: center;
  transition: background 0.15s ease;

  &--hover {
    background: $brand-lighter;
  }
}

.guide-info {
  flex: 1;
}

.guide-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
  display: block;
}

.guide-sub {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-3;
  display: block;
}

.guide-chev {
  width: 14rpx;
  height: 14rpx;
  border-top: 3rpx solid $ink-3;
  border-right: 3rpx solid $ink-3;
  transform: rotate(45deg);
  margin-left: 16rpx;
  flex-shrink: 0;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>