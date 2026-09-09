<template>
  <view class="legal-page">
    <!-- 顶部标题区 -->
    <view class="page-hero">
      <text class="hero-title">{{ doc.title }}</text>
      <text class="hero-sub">{{ $t('legal.updated', { date: doc.date }) }}</text>
    </view>

    <view class="page-body">
      <!-- 重点条款（退款协议等） -->
      <view v-if="highlights.length" class="hl-card">
        <view v-for="(hl, i) in highlights" :key="i" class="hl-item" :class="hl.theme">
          <view class="hl-dot"></view>
          <view class="hl-info">
            <text class="hl-title">{{ hl.title }}</text>
            <text class="hl-desc">{{ hl.desc }}</text>
          </view>
        </view>
      </view>

      <!-- 条款正文 -->
      <view class="doc-card">
        <view v-for="(s, i) in sections" :key="i" class="sec">
          <text class="sec-h">{{ s.h }}</text>
          <text v-for="(p, j) in s.p" :key="j" class="sec-p">{{ p }}</text>
        </view>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle, tRaw } from '@/locales'

export default {
  data() {
    return {
      type: 'agreement',
      doc: { title: '', date: '', sections: [] },
      highlights: []
    }
  },
  onLoad(options) {
    if (options && options.type) {
      this.type = options.type
    }
    this.buildDoc()
  },
  onShow() {
    setNavTitle(`legal.${this.type}.title`)
  },
  methods: {
    buildDoc() {
      const data = tRaw(`legal.${this.type}`)
      if (data) {
        this.doc = {
          title: data.title || '',
          date: data.date || tRaw('legal.date') || '',
          sections: data.sections || []
        }
        this.highlights = data.highlights || []
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.legal-page {
  min-height: 100vh;
  background: $bg-page;
}

/* ============ 顶部标题区 ============ */
.page-hero {
  background: $gradient-brand;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-title {
  font-size: 42rpx;
  font-weight: 800;
  color: #ffffff;
}

.hero-sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.page-body {
  padding: 0 24rpx;
  margin-top: -24rpx;
  position: relative;
}

/* ============ 重点条款卡片 ============ */
.hl-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 8rpx 30rpx;
  box-shadow: $shadow-sm;
}

.hl-item {
  display: flex;
  align-items: flex-start;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.hl-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  margin: 14rpx 20rpx 0 0;
  flex-shrink: 0;

  .ok & {
    background: $teal;
  }

  .warn & {
    background: $warn;
  }
}

.hl-info {
  flex: 1;
}

.hl-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
  display: block;

  .ok & {
    color: $teal-deep;
  }

  .warn & {
    color: $warn-deep;
  }
}

.hl-desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.7;
  display: block;
}

/* ============ 条款正文 ============ */
.doc-card {
  margin-top: 24rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 34rpx 30rpx 12rpx;
  box-shadow: $shadow-sm;
}

.sec {
  margin-bottom: 34rpx;
}

.sec-h {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
  display: block;
  margin-bottom: 16rpx;
}

.sec-p {
  font-size: 25rpx;
  color: $ink-2;
  line-height: 1.75;
  display: block;
  margin-bottom: 12rpx;
  text-align: justify;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
