<template>
  <view class="detail-page">
    <!-- 顶部浅色 Hero（与首页视觉语言一致：眉题 → 大标题 → 白色 chip） -->
    <view class="hero">
      <view class="hero-content">
        <text class="hero-overline">{{ fmt('esimDetail.eyebrow') }}</text>
        <text class="hero-title">{{ esim?.pkg?.countryName || 'eSIM' }}</text>
        <view class="hero-chips">
          <view class="hero-chip" :class="esim?.status">
            <view class="chip-dot"></view>
            <text class="chip-text">{{ statusText }}</text>
          </view>
          <view class="hero-chip">
            <text class="chip-text">{{ specText }}</text>
          </view>
        </view>
      </view>
      <view class="hero-flag-card">
        <image class="hero-flag-img" :src="getFlagImage(esim?.pkg?.countryCode)" mode="aspectFit" />
      </view>
    </view>

    <!-- 卡片信息（上浮叠压 Hero 底部） -->
    <view class="info-card">
      <view class="info-row">
        <text class="info-label">{{ fmt('esims.expireLabel') }}</text>
        <text class="info-value">{{ formatDate(esim?.expireAt) }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">ICCID</text>
        <text class="info-value iccid">{{ esim?.iccid }}</text>
      </view>
    </view>

    <!-- 流量使用情况 -->
    <view v-if="esim?.status === 'activated'" class="usage-card">
      <view class="usage-header">
        <text class="usage-title">{{ fmt('esimDetail.usageTitle') }}</text>
        <text class="usage-percent">{{ usagePercent }}%</text>
      </view>
      <view class="usage-bar">
        <view class="usage-fill" :style="{ width: usagePercent + '%' }"></view>
      </view>
      <view class="usage-footer">
        <text class="usage-used">{{ fmt('esimDetail.usedGb', { used: usedData }) }}</text>
        <text class="usage-total">
          {{ esim?.pkg?.isUnlimited ? fmt('esimDetail.highSpeedGb', { gb: esim?.pkg?.gb }) : fmt('esimDetail.totalGb', { gb: esim?.pkg?.gb }) }}
        </text>
      </view>
      <!-- 不限量套餐：高速额度用完后限速，仍可继续使用 -->
      <view v-if="esim?.pkg?.isUnlimited" class="usage-note">
        <text class="usage-note-txt">{{ fmt('esimDetail.unlimitedNote') }}</text>
      </view>
    </view>

    <!-- 激活码区域 -->
    <view v-if="esim?.activationCode" class="qr-card">
      <view class="qr-header">
        <text class="qr-title">{{ fmt('esimDetail.qrTitle') }}</text>
        <view class="qr-copy-btn" hover-class="qr-copy-btn--hover" @tap="copyCode">
          <text>{{ copied ? fmt('esimDetail.copied') : fmt('esims.copy') }}</text>
        </view>
      </view>
      <view class="qr-code-box">
        <EsimQr :text="esim?.activationCode" :size="240" />
      </view>
      <view class="qr-code-text">
        <text>{{ esim?.activationCode }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-buttons">
      <view v-if="esim?.status === 'pending'" class="action-btn primary" @tap="markActivated">
        <text>{{ fmt('esims.markActivated') }}</text>
      </view>
      <view v-if="canRenew" class="action-btn renew" @tap="goRenew">
        <text>{{ fmt('esims.renew') }}</text>
      </view>
      <view class="action-btn danger" @tap="deleteEsim">
        <text>{{ fmt('esims.delete') }}</text>
      </view>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import EsimQr from '@/components/EsimQr.vue'
import { api } from '@/utils/api'
import { store } from '@/store'
import { formatDate } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换（如 {gb}、{used}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  components: { EsimQr },
  data() {
    return {
      esimId: null,
      esim: null,
      copied: false
    }
  },
  computed: {
    statusText() {
      if (!this.esim) return ''
      return this.fmt(this.esim.status === 'activated' ? 'esims.activated' : 'esims.pending')
    },
    specText() {
      if (!this.esim?.pkg) return ''
      const gbText = this.esim.pkg.isUnlimited
        ? this.fmt('package.unlimited')
        : this.fmt('esimDetail.specGb', { gb: this.esim.pkg.gb })
      return `${gbText} · ${this.fmt('esimDetail.specDays', { days: this.esim.pkg.days })}`
    },
    usagePercent() {
      if (!this.esim || this.esim.status !== 'activated') return 0
      const used = Number(this.esim.used || 0)
      const total = Number(this.esim.pkg?.gb || 1)
      return Math.min(100, Math.round((used / total) * 100))
    },
    usedData() {
      if (!this.esim) return 0
      return Number(this.esim.used || 0).toFixed(1)
    },
    canRenew() {
      return this.esim?.status === 'activated' && new Date(this.esim.expireAt) < new Date()
    }
  },
  onLoad(options) {
    this.esimId = options.id
    setNavTitle('pageTitle.esimDetail')
    this.loadEsim()
  },
  methods: {
    formatDate,
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    getFlagImage(code) {
      if (!code) return '/static/icons/flag-unknown.png'
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    async loadEsim() {
      try {
        const res = await api.getMyEsims()
        if (res.data.esims) {
          this.esim = res.data.esims.find(e => e.id === this.esimId)
        }
      } catch (e) {
        uni.showToast({ title: this.fmt('esimDetail.loadFailed'), icon: 'none' })
      }
    },
    copyCode() {
      if (!this.esim?.activationCode) return
      uni.setClipboardData({
        data: this.esim.activationCode,
        success: () => {
          this.copied = true
          uni.showToast({ title: this.fmt('esimDetail.copied'), icon: 'success' })
          setTimeout(() => { this.copied = false }, 2000)
        }
      })
    },
    async markActivated() {
      try {
        await api.activateEsim(this.esimId)
        uni.showToast({ title: this.fmt('esims.activateSuccess'), icon: 'success' })
        this.loadEsim()
      } catch (e) {
        uni.showToast({ title: this.fmt('common.opFailed'), icon: 'none' })
      }
    },
    goRenew() {
      uni.navigateTo({
        url: `/pages/detail/detail?country=${this.esim.pkg.countryCode}&mode=renew&esimId=${this.esimId}`
      })
    },
    deleteEsim() {
      uni.showModal({
        title: this.fmt('esims.deleteTitle'),
        content: this.fmt('esimDetail.deleteConfirm'),
        confirmColor: '#DE4B5B',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.deleteEsim(this.esimId)
              uni.showToast({ title: this.fmt('esims.deleted'), icon: 'success' })
              setTimeout(() => {
                uni.navigateBack()
              }, 1500)
            } catch (e) {
              uni.showToast({ title: this.fmt('esims.deleteFailed'), icon: 'none' })
            }
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: $bg-page;
}

/* ============ 顶部浅色 Hero（首页同款：浅蓝紫渐变 + 编辑排版） ============ */
.hero {
  position: relative;
  background: $gradient-canvas;
  padding: 44rpx 40rpx 120rpx;
  border-radius: 0 0 48rpx 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-content {
  flex: 1;
  min-width: 0;
  padding-right: 24rpx;
}

/* 眉题：品牌蓝小字，字距拉开 */
.hero-overline {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $brand;
  letter-spacing: 8rpx;
  margin-bottom: 16rpx;
}

/* 主标题：深墨色大字 */
.hero-title {
  display: block;
  font-size: 56rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.22;
  letter-spacing: 2rpx;
}

/* 状态 / 规格 chip：白色小卡片 */
.hero-chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 28rpx;
}

.hero-chip {
  display: flex;
  align-items: center;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(64, 80, 192, 0.08);
  margin-right: 14rpx;
}

.chip-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  margin-right: 10rpx;
  background: $ink-3;
}

.hero-chip.activated .chip-dot {
  background: $teal;
}

.hero-chip.pending .chip-dot {
  background: $sun;
}

.chip-text {
  font-size: 22rpx;
  font-weight: 600;
  color: $ink-2;
}

.hero-chip.activated .chip-text {
  color: $teal-deep;
}

.hero-chip.pending .chip-text {
  color: $sun-deep;
}

/* 国旗卡：白色浮雕小卡（呼应首页 3D 插画卡） */
.hero-flag-card {
  width: 168rpx;
  height: 168rpx;
  border-radius: 40rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 32rpx rgba(64, 80, 192, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.hero-flag-img {
  width: 116rpx;
  height: 116rpx;
}

.info-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: -56rpx 24rpx 24rpx;
  padding: 8rpx 28rpx;
  box-shadow: $shadow-sm;
  position: relative;
  z-index: 2;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
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

  &.iccid {
    font-size: 22rpx;
    font-family: monospace;
  }
}

.usage-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: 0 24rpx 24rpx;
  padding: 28rpx;
  box-shadow: $shadow-sm;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.usage-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}

.usage-percent {
  font-size: 28rpx;
  font-weight: 700;
  color: $brand;
}

.usage-bar {
  height: 16rpx;
  border-radius: 8rpx;
  background: $bg-soft;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.usage-fill {
  height: 100%;
  border-radius: 8rpx;
  background: linear-gradient(90deg, $brand 0%, $brand-sky 100%);
  transition: width 0.4s ease;
}

.usage-footer {
  display: flex;
  justify-content: space-between;
}

.usage-used {
  font-size: 24rpx;
  color: $ink-2;
}

.usage-total {
  font-size: 24rpx;
  color: $ink-3;
}

.qr-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: 0 24rpx 24rpx;
  padding: 28rpx;
  box-shadow: $shadow-sm;
}

.qr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.qr-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}

.qr-copy-btn {
  background: $gradient-brand;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 600;
  padding: 10rpx 28rpx;
  border-radius: 999rpx;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.95);
  }
}

.qr-code-box {
  display: flex;
  justify-content: center;
  padding: 20rpx;
  background: $bg-soft;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.qr-code-text {
  background: $bg-soft;
  border-radius: 12rpx;
  padding: 20rpx;
  text-align: center;
  font-size: 22rpx;
  color: $ink-2;
  font-family: monospace;
  word-break: break-all;
  line-height: 1.6;
}

.action-buttons {
  display: flex;
  gap: 16rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
}

.action-btn {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
  padding: 24rpx 0;
  border-radius: 16rpx;
  transition: transform 0.15s ease;

  &.primary {
    background: $gradient-brand;
    color: #ffffff;
    box-shadow: 0 8rpx 20rpx rgba(6, 44, 69, 0.3);
  }

  &.renew {
    background: #ffffff;
    color: $brand;
    border: 2rpx solid $brand;
  }

  &.danger {
    background: #ffffff;
    color: $danger;
    border: 2rpx solid $danger;
  }

  &:active {
    transform: scale(0.96);
  }
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
