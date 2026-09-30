<template>
  <view class="ts-page">
    <!-- 浅色 Hero 头部（首页同款：浅蓝紫渐变 + 编辑排版） -->
    <view class="page-hero">
      <text class="hero-overline">{{ $t('troubleshooting.eyebrow') }}</text>
      <text class="hero-title">{{ $t('troubleshooting.title') }}</text>
      <text class="hero-sub">{{ $t('troubleshooting.sub') }}</text>
    </view>

    <view class="page-body">
      <!-- 关键词搜索 -->
      <view class="search-bar">
        <image class="search-icon" :src="svgUri('search')" mode="aspectFit" />
        <input
          class="search-input"
          :value="keyword"
          :placeholder="$t('troubleshooting.searchPlaceholder')"
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
        <text class="search-empty-title">{{ $t('troubleshooting.searchEmptyTitle') }}</text>
        <text class="search-empty-sub">{{ $t('troubleshooting.searchEmptySub') }}</text>
      </view>

      <!-- 编号式故障排除列表 -->
      <view class="ts-card">
        <view
          v-for="(f, i) in filteredItems"
          :key="i"
          class="ts-item"
          :class="{ 'ts-item--open': open === i }"
          @tap="toggle(i)"
        >
          <view class="ts-q">
            <text class="ts-num">{{ i + 1 }}</text>
            <text class="ts-q-txt">{{ f.q }}</text>
            <view class="ts-chev"></view>
          </view>
          <view v-if="open === i" class="ts-a">{{ f.a }}</view>
        </view>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle, tRaw } from '@/locales'

const ICON_SVGS = {
  search:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4050C0" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  clear:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8B90B0" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
}

export default {
  data() {
    return { open: 0, keyword: '', items: [] }
  },
  computed: {
    searching() {
      return this.keyword.trim().length > 0
    },
    filteredItems() {
      const kw = this.keyword.trim().toLowerCase()
      if (!kw) return this.items
      return this.items.filter((f) =>
        (`${f.q} ${f.a}`).toLowerCase().includes(kw)
      )
    },
    hasResult() {
      return this.filteredItems.length > 0
    }
  },
  onShow() {
    setNavTitle('pageTitle.troubleshooting')
    this.buildItems()
  },
  created() {
    this.tRaw = tRaw
    this.buildItems()
  },
  methods: {
    buildItems() {
      this.items = this.tRaw('troubleshooting.items') || []
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
    toggle(i) {
      this.open = this.open === i ? -1 : i
    }
  }
}
</script>

<style lang="scss" scoped>
.ts-page {
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

/* ============ 编号式故障排除列表 ============ */
.ts-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 8rpx 30rpx;
  box-shadow: $shadow-sm;
}

.ts-item {
  border-bottom: 1rpx solid $line;
  padding: 26rpx 0;

  &:last-child {
    border-bottom: none;
  }
}

.ts-q {
  display: flex;
  align-items: center;
}

.ts-num {
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
  background: $brand-lighter;
  color: $brand;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 20rpx;
}

.ts-q-txt {
  flex: 1;
  font-size: 27rpx;
  font-weight: 600;
  color: $ink;
  line-height: 1.4;
}

.ts-chev {
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

.ts-item--open .ts-chev {
  transform: rotate(-135deg);
}

.ts-a {
  display: block;
  margin-top: 16rpx;
  padding-left: 66rpx;
  padding-right: 36rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.75;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
<!-- touch -->
