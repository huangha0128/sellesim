<template>
  <view class="card-detail-page">
    <view class="hero">
      <view class="hero-content">
        <text class="hero-overline">eSIM CARD</text>
        <text class="hero-title mono">{{ iccid || '-' }}</text>
      </view>
      <view class="hero-side">
        <view class="status-chip" :class="cardStatus">
          <text>{{ statusText(cardStatus) }}</text>
        </view>
        <text class="package-count">{{ fmt('esims.packageCount', { n: esims.length }) }}</text>
      </view>
    </view>

    <view v-if="loading && !esims.length" class="loading-card">
      <text>{{ fmt('common.loading') }}</text>
    </view>

    <view v-else-if="!esims.length" class="empty-card">
      <text>{{ fmt('common.unknown') }}</text>
    </view>

    <template v-else>
      <view v-if="activeEsim" class="active-card">
        <view class="active-head">
          <text class="active-label">{{ fmt('esims.currentPlan') }}</text>
          <text class="active-percent">{{ usagePercent(activeEsim) }}%</text>
        </view>
        <text class="active-name">{{ activeEsim.pkg.countryName }}</text>
        <text class="active-spec">{{ specText(activeEsim) }}</text>
        <view class="usage-bar">
          <view class="usage-fill" :style="{ width: usagePercent(activeEsim) + '%' }"></view>
        </view>
        <text class="usage-text">{{ usageText(activeEsim) }}</text>
      </view>

      <view class="section-title">{{ fmt('esims.packageCount', { n: esims.length }) }}</view>
      <view class="package-list">
        <view
          v-for="esim in esims"
          :key="esim.id"
          class="package-card"
          hover-class="package-card--hover"
          @click="goEsimDetail(esim)"
        >
          <view class="package-head">
            <text class="package-name">{{ esim.pkg.countryName }}</text>
            <text class="package-status" :class="esim.status">{{ statusText(esim.status) }}</text>
          </view>
          <text class="package-spec">{{ specText(esim) }}</text>

          <view class="info-grid">
            <view class="info-item">
              <text class="info-label">{{ fmt('esims.activationDate') }}</text>
              <text class="info-value">{{ formatDateTime(esim.activatedAt) }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">{{ fmt('esims.expireLabel') }}</text>
              <text class="info-value">{{ formatDateTime(esim.expireAt) }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">{{ fmt('esims.bindingId') }}</text>
              <text class="info-value mono">{{ esim.tigerBindingId || '-' }}</text>
            </view>
            <view class="info-item">
              <text class="info-label">{{ fmt('esims.tigerPackage') }}</text>
              <text class="info-value mono">{{ esim.tigerPkgId || '-' }}</text>
            </view>
          </view>

          <view v-if="esim.status === 'activated'" class="mini-usage">
            <view class="usage-bar">
              <view class="usage-fill" :style="{ width: usagePercent(esim) + '%' }"></view>
            </view>
            <text>{{ usageText(esim) }}</text>
          </view>

          <view v-if="esim.localEsimId" class="package-action">
            <text>{{ fmt('common.view') }}</text>
          </view>
        </view>
      </view>
    </template>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { formatDate, formatDateTime } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'

function fmtNamed(str, params) {
  return String(str).replace(/\{(\w+)\}/g, (match, key) =>
    params && params[key] !== undefined && params[key] !== null ? params[key] : match
  )
}

export default {
  data() {
    return {
      iccid: '',
      esims: [],
      loading: true
    }
  },
  computed: {
    activeEsim() {
      const now = Date.now()
      return this.esims
        .filter((esim) => esim.status === 'activated' && new Date(esim.expireAt).getTime() >= now)
        .sort((a, b) => new Date(b.activatedAt || b.expireAt) - new Date(a.activatedAt || a.expireAt))[0] || null
    },
    cardStatus() {
      if (this.activeEsim) return 'activated'
      if (this.esims.some((esim) => esim.status === 'pending')) return 'pending'
      return this.esims[0]?.status || 'pending'
    }
  },
  onLoad(options) {
    this.iccid = decodeURIComponent(options.iccid || '')
    setNavTitle('pageTitle.esimCard')
    this.load()
  },
  methods: {
    formatDate,
    formatDateTime(value) {
      if (!value || Number.isNaN(new Date(value).getTime())) return '-'
      return formatDateTime(value)
    },
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    statusText(status) {
      const key = { activated: 'activated', pending: 'pending', used: 'used', expired: 'expired' }[status]
      return this.fmt(`esims.${key || 'pending'}`)
    },
    specText(esim) {
      const gbText = esim.pkg.isUnlimited
        ? this.fmt('package.unlimited')
        : this.fmt('esimDetail.specGb', { gb: esim.pkg.gb })
      return `${gbText} · ${this.fmt('esimDetail.specDays', { days: esim.pkg.days })}`
    },
    usagePercent(esim) {
      const total = Number(esim?.pkg?.gb || 0)
      const used = Number(esim?.used || 0)
      if (!total) return 0
      return Math.min(100, Math.round((used / total) * 100))
    },
    usageText(esim) {
      return this.fmt('esims.usage', {
        used: Number(esim?.used || 0).toFixed(1),
        total: Number(esim?.pkg?.gb || 0).toFixed(1)
      })
    },
    async load() {
      this.loading = true
      try {
        const res = await api.getMyEsims()
        this.esims = (res.data?.esims || []).filter((esim) => esim.iccid === this.iccid)
      } catch (error) {
        uni.showToast({ title: this.fmt('common.networkError'), icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    goEsimDetail(esim) {
      uni.navigateTo({ url: `/pages/esim-detail/esim-detail?id=${esim.id}` })
    }
  }
}
</script>

<style lang="scss" scoped>
.card-detail-page {
  min-height: 100vh;
  background: $bg-page;
}

.hero {
  background: linear-gradient(168deg, #E4EAFF 0%, #F0F3FF 52%, #F5F7F8 100%);
  padding: 42rpx 40rpx 44rpx;
  border-radius: 0 0 44rpx 44rpx;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.hero-content {
  min-width: 0;
}

.hero-overline {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $brand;
  letter-spacing: 6rpx;
}

.hero-title {
  display: block;
  margin-top: 16rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: $ink;
  word-break: break-all;
}

.hero-side {
  flex-shrink: 0;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16rpx;
}

.status-chip {
  font-size: 22rpx;
  font-weight: 700;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;

  &.activated { color: $brand; background: $brand-light; }
  &.pending { color: $warn-deep; background: $warn-bg; }
  &.used { color: $ink-2; background: rgba(0, 0, 0, 0.06); }
  &.expired { color: $ink-3; background: rgba(0, 0, 0, 0.04); }
}

.package-count {
  font-size: 23rpx;
  color: $ink-3;
}

.loading-card,
.empty-card {
  margin: 28rpx 24rpx;
  padding: 48rpx;
  text-align: center;
  color: $ink-3;
  background: #ffffff;
  border-radius: 28rpx;
}

.active-card {
  margin: 28rpx 24rpx 0;
  padding: 30rpx;
  background: #ffffff;
  border-radius: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(48, 48, 160, 0.08);
}

.active-head {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  font-weight: 700;
  color: $brand;
}

.active-name {
  display: block;
  margin-top: 20rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
}

.active-spec {
  display: block;
  margin-top: 8rpx;
  font-size: 25rpx;
  color: $ink-2;
}

.usage-bar {
  height: 12rpx;
  margin-top: 22rpx;
  background: rgba(80, 80, 208, 0.12);
  border-radius: 999rpx;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: $gradient-brand;
  border-radius: 999rpx;
}

.usage-text,
.mini-usage text {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $ink-2;
}

.section-title {
  margin: 34rpx 34rpx 18rpx;
  font-size: 28rpx;
  font-weight: 800;
  color: $ink;
}

.package-list {
  padding: 0 24rpx;
}

.package-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 22rpx;
  box-shadow: 0 4rpx 18rpx rgba(48, 48, 160, 0.07);
}

.package-card--hover {
  transform: scale(0.99);
  opacity: 0.9;
}

.package-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
}

.package-name {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.package-status {
  flex-shrink: 0;
  font-size: 21rpx;
  font-weight: 700;
  padding: 7rpx 16rpx;
  border-radius: 999rpx;

  &.activated { color: $brand; background: $brand-light; }
  &.pending { color: $warn-deep; background: $warn-bg; }
  &.used { color: $ink-2; background: rgba(0, 0, 0, 0.06); }
  &.expired { color: $ink-3; background: rgba(0, 0, 0, 0.04); }
}

.package-spec {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: $ink-2;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 22rpx;
}

.info-label {
  display: block;
  font-size: 21rpx;
  color: $ink-3;
}

.info-value {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: $ink;
  word-break: break-all;
}

.mono {
  font-family: monospace;
}

.mini-usage {
  margin-top: 22rpx;
}

.package-action {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $line;
  text-align: right;
  font-size: 23rpx;
  font-weight: 700;
  color: $brand;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
