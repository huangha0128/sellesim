<template>
  <view class="guide-page">
    <view class="guide-hero">
      <text class="gh-title">{{ $t('guide.title') }}</text>
      <text class="gh-sub">{{ $t('guide.sub') }}</text>
    </view>

    <view class="guide-body">
      <view class="platform-tabs">
        <view class="pt-tab" :class="{ active: platform === 'ios' }" @click="platform = 'ios'">
          <image class="pt-emoji" src="/static/icons/guide-apple.png" mode="aspectFit" />
          <text class="pt-txt">iPhone</text>
        </view>
        <view class="pt-tab" :class="{ active: platform === 'android' }" @click="platform = 'android'">
          <image class="pt-emoji" src="/static/icons/guide-android.png" mode="aspectFit" />
          <text class="pt-txt">Android</text>
        </view>
      </view>

      <view class="compat-card">
        <view class="compat-title">
          <image src="/static/icons/prof-esim.png" mode="aspectFit" style="width: 32rpx; height: 32rpx; margin-right: 12rpx; vertical-align: middle;" />
          <text>{{ $t('guide.compatTitle') }}</text>
        </view>
        <text class="compat-txt">{{ $t('guide.compatTxt') }}</text>
      </view>

      <view class="steps">
        <view v-for="(s, i) in steps" :key="i" class="step-card">
          <view class="step-head">
            <view class="step-badge">{{ i + 1 }}</view>
            <text class="step-title">{{ s.title }}</text>
          </view>
          <text class="step-desc">{{ s.desc }}</text>
          <view v-if="s.tips && s.tips.length" class="step-tips">
            <view v-for="(t, ti) in s.tips" :key="ti" class="step-tip">
              <text class="tip-dot">·</text>
              <text class="tip-txt">{{ t }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="faq-card">
        <text class="faq-title">{{ $t('guide.faqTitle') }}</text>
        <view v-for="(f, i) in faqs" :key="i" class="faq-item" @click="toggleFaq(i)">
          <view class="faq-q">
            <text class="faq-q-txt">{{ f.q }}</text>
            <text class="faq-arrow">{{ openFaq === i ? '⌃' : '⌄' }}</text>
          </view>
          <text v-if="openFaq === i" class="faq-a">{{ f.a }}</text>
        </view>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle } from '@/locales'

export default {
  data() {
    return {
      platform: 'ios',
      openFaq: 0,
      steps: [],
      faqs: []
    }
  },
  watch: {
    platform() {
      this.buildSteps()
    }
  },
  onShow() {
    setNavTitle('pageTitle.guide')
    this.buildFaqs()
    this.buildSteps()
  },
  created() {
    this.buildFaqs()
    this.buildSteps()
  },
  methods: {
    buildFaqs() {
      this.faqs = this.$t('guide.faqs')
    },
    buildSteps() {
      if (this.platform === 'ios') {
        this.steps = this.$t('guide.stepsIos')
      } else {
        this.steps = this.$t('guide.stepsAndroid')
      }
    },
    toggleFaq(i) {
      this.openFaq = this.openFaq === i ? -1 : i
    }
  }
}
</script>

<style lang="scss" scoped>
.guide-page {
  min-height: 100vh;
  background: $bg-page;
}

.guide-hero {
  background: $gradient-brand;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gh-title {
  font-size: 42rpx;
  font-weight: 800;
  color: #ffffff;
}

.gh-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

.guide-body {
  padding: 0 $page-pad;
  margin-top: -24rpx;
  position: relative;
}

.platform-tabs {
  display: flex;
  background: $bg-card;
  border-radius: 999rpx;
  padding: 8rpx;
  box-shadow: $shadow-sm;
}

.pt-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 0;
  border-radius: 999rpx;
  transition: all 0.2s ease;

  &.active {
    background: $gradient-brand;
    box-shadow: $shadow-brand;
  }
}

.pt-emoji {
  width: 36rpx;
  height: 36rpx;
  margin-right: 10rpx;
  flex-shrink: 0;
}

.pt-txt {
  font-size: 27rpx;
  font-weight: 700;
  color: $ink-2;

  .pt-tab.active & {
    color: #ffffff;
  }
}

.compat-card {
  margin-top: 24rpx;
  background: $sun-light;
  border: 1rpx solid #FDE7BD;
  border-radius: $radius;
  padding: 26rpx 28rpx;
}

.compat-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #B45309;
}

.compat-txt {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #92600A;
  line-height: 1.7;
}

.steps {
  margin-top: 28rpx;
}

.step-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-sm;
  position: relative;
}

.step-head {
  display: flex;
  align-items: center;
}

.step-badge {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  box-shadow: 0 6rpx 16rpx rgba(14, 165, 233, 0.35);
  flex-shrink: 0;
}

.step-title {
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.step-desc {
  display: block;
  margin-top: 18rpx;
  font-size: 25rpx;
  color: $ink-2;
  line-height: 1.7;
}

.step-tips {
  margin-top: 16rpx;
  background: $brand-lighter;
  border-radius: $radius-sm;
  padding: 16rpx 20rpx;
}

.step-tip {
  display: flex;
  align-items: flex-start;
  margin-top: 8rpx;

  &:first-child {
    margin-top: 0;
  }
}

.tip-dot {
  color: $brand;
  font-weight: 700;
  margin-right: 10rpx;
}

.tip-txt {
  flex: 1;
  font-size: 22rpx;
  color: $brand-deep;
  line-height: 1.6;
}

.faq-card {
  margin-top: 32rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  box-shadow: $shadow-sm;
}

.faq-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.faq-item {
  border-bottom: 1rpx solid $line;
  padding: 24rpx 0;

  &:last-child {
    border-bottom: none;
  }
}

.faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.faq-q-txt {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: $ink;
}

.faq-arrow {
  font-size: 30rpx;
  color: $ink-3;
  margin-left: 16rpx;
}

.faq-a {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.7;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
