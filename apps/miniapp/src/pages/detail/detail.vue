<template>
  <view class="detail-page">
    <view v-if="pkg" class="detail-body">
      <view class="hero-card">
        <view class="hero-top">
          <view class="hero-flag">
            <image class="hero-flag-img" :src="getFlagImage(pkg.countryCode)" mode="aspectFit" />
          </view>
          <view class="hero-country">
            <text class="hero-country-name">{{ pkg.countryName }}</text>
            <text class="hero-country-type">{{ pkg.type }}</text>
          </view>
          <view v-if="pkg.tag" class="hero-tag" :style="{ background: pkg.tagColor + '1A', color: pkg.tagColor }">
            {{ pkg.tag }}
          </view>
        </view>

        <view class="hero-data">
          <view class="data-block">
            <text class="data-num">{{ pkg.gb }}</text>
            <text class="data-unit">GB</text>
            <text class="data-label">流量</text>
          </view>
          <view class="data-divider"></view>
          <view class="data-block">
            <text class="data-num">{{ pkg.days }}</text>
            <text class="data-unit">天</text>
            <text class="data-label">有效期</text>
          </view>
          <view class="data-divider"></view>
          <view class="data-block">
            <text class="data-num speed">{{ pkg.speed }}</text>
            <text class="data-unit">&nbsp;</text>
            <text class="data-label">网络</text>
          </view>
        </view>
      </view>

      <view class="benefit-row">
        <view v-for="b in benefits" :key="b.t" class="benefit">
          <image class="benefit-emoji" :src="b.e" mode="aspectFit" />
          <text class="benefit-txt">{{ b.t }}</text>
        </view>
      </view>

      <view class="section-card">
        <text class="section-title">套餐信息</text>
        <view class="info-row">
          <text class="info-label">流量</text>
          <text class="info-value">{{ pkg.gb }}GB</text>
        </view>
        <view class="info-row">
          <text class="info-label">有效期</text>
          <text class="info-value">激活后 {{ pkg.days }} 天</text>
        </view>
        <view class="info-row">
          <text class="info-label">网络制式</text>
          <text class="info-value">{{ pkg.network }} {{ pkg.speed }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">覆盖范围</text>
          <text class="info-value">{{ pkg.coverage }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">套餐类型</text>
          <text class="info-value">{{ pkg.type }}</text>
        </view>
      </view>

      <view class="section-card">
        <text class="section-title">套餐说明</text>
        <text class="desc">{{ pkg.desc }}</text>
        <view class="feature-list">
          <view v-for="f in pkg.features" :key="f" class="feature-item">
            <view class="feature-check">
              <image class="feature-check-img" src="/static/icons/co-check.png" mode="aspectFit" />
            </view>
            <text class="feature-txt">{{ f }}</text>
          </view>
        </view>
      </view>

      <view class="section-card">
        <text class="section-title">安装步骤</text>
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

    <view v-if="pkg" class="bottom-bar">
      <view class="price-box">
        <view class="price">
          <text class="price-symbol">¥</text>
          <text class="price-num">{{ priceNum }}</text>
        </view>
        <text class="price-note">不含税费</text>
      </view>
      <view class="buy-btn" hover-class="buy-btn--hover" @click="buy">立即购买</view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'

export default {
  data() {
    return {
      id: '',
      pkg: null,
      benefits: [
        { e: '/static/icons/ben-lightning.png', t: '即买即用' },
        { e: '/static/icons/ben-fire.png', t: '免翻墙' },
        { e: '/static/icons/ben-phone.png', t: '热点共享' },
        { e: '/static/icons/ben-shield.png', t: '免实名' }
      ]
    }
  },
  computed: {
    priceNum() {
      const n = Number(this.pkg.price)
      return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
    }
  },
  onLoad(options) {
    this.id = options.id || ''
    this.load()
  },
  methods: {
    getFlagImage(code) {
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    async load() {
      uni.showLoading({ title: '加载中', mask: true })
      try {
        const res = await api.getPackageDetail(this.id)
        this.pkg = res.data.pkg
        uni.setNavigationBarTitle({ title: this.pkg.countryName + ' eSIM' })
      } finally {
        uni.hideLoading()
      }
    },
    buy() {
      uni.navigateTo({
        url: `/pages/checkout/checkout?pkgId=${this.pkg.id}`
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

.detail-body {
  padding: 0 $page-pad;
  padding-bottom: 40rpx;
}

.hero-card {
  margin-top: 24rpx;
  background: $gradient-brand;
  border-radius: $radius-xl;
  padding: 36rpx;
  box-shadow: $shadow-brand;
  position: relative;
  overflow: hidden;
}

.hero-card::after {
  content: '';
  position: absolute;
  right: -80rpx;
  top: -80rpx;
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.hero-top {
  position: relative;
  display: flex;
  align-items: center;
}

.hero-flag {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-country {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
}

.hero-country-name {
  font-size: 36rpx;
  font-weight: 800;
  color: #ffffff;
}

.hero-country-type {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
}

.hero-tag {
  position: relative;
  font-size: 22rpx;
  font-weight: 700;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: #ffffff;
}

.hero-data {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 40rpx;
}

.data-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.data-num {
  font-size: 60rpx;
  font-weight: 800;
  color: #ffffff;
  line-height: 1;

  &.speed {
    font-size: 44rpx;
  }
}

.data-unit {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
}

.data-label {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
}

.data-divider {
  width: 1rpx;
  height: 72rpx;
  background: rgba(255, 255, 255, 0.3);
}

.benefit-row {
  display: flex;
  justify-content: space-between;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx 24rpx;
  margin-top: 24rpx;
  box-shadow: $shadow-sm;
}

.benefit {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.benefit-emoji {
  width: 48rpx;
  height: 48rpx;
}

.benefit-txt {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $ink-2;
}

.section-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 32rpx;
  margin-top: 24rpx;
  box-shadow: $shadow-sm;
}

.section-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  display: block;
  margin-bottom: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $line;

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 26rpx;
  color: $ink-2;
}

.info-value {
  font-size: 26rpx;
  color: $ink;
  font-weight: 600;
}

.desc {
  font-size: 26rpx;
  color: $ink-2;
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

.feature-check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $teal-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.feature-check-img {
  width: 24rpx;
  height: 24rpx;
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
  margin-top: 24rpx;
  background: $sun-light;
  border: 1rpx solid #FDE7BD;
  border-radius: $radius;
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
  box-shadow: 0 -6rpx 24rpx rgba(15, 84, 140, 0.08);
  z-index: 10;
}

.price-box {
  flex: 1;
}

.price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 800;
}

.price-symbol {
  font-size: 28rpx;
}

.price-num {
  font-size: 52rpx;
  line-height: 1;
}

.price-note {
  display: block;
  font-size: 20rpx;
  color: $ink-3;
  margin-top: 4rpx;
}

.buy-btn {
  background: $gradient-coral;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
  padding: 24rpx 72rpx;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 28rpx rgba(255, 122, 89, 0.4);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.97);
  }
}

.footer-safe {
  height: 160rpx;
}
</style>
