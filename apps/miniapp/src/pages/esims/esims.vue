<template>
  <view class="esims-page">
    <view class="head-banner">
      <view class="hb-left">
        <text class="hb-title">{{ fmt('esims.title') }}</text>
        <text class="hb-sub">{{ fmt('esims.sub', { n: store.esims.length }) }}</text>
      </view>
      <view class="hb-btn" hover-class="hb-btn--hover" @click="goBuy">{{ fmt('esims.buy') }}</view>
    </view>

    <view v-if="!store.esims.length" class="empty">
      <image class="empty-emoji" src="/static/icons/prof-esim.png" mode="aspectFit" />
      <text class="empty-title">{{ fmt('esims.emptyTitle') }}</text>
      <text class="empty-sub">{{ fmt('esims.emptySub') }}</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="goBuy">{{ fmt('esims.goBuy') }}</view>
    </view>

    <view v-else class="esim-list">
      <view
        v-for="esim in store.esims"
        :key="esim.id"
        class="esim-card"
        :class="{ expanded: expandedId === esim.id }"
      >
        <view class="ec-head" @click="toggle(esim.id)">
          <view class="ec-flag">
            <image class="ec-flag-img" :src="getFlagImage(esim.pkg.countryCode)" mode="aspectFit" />
          </view>
          <view class="ec-main">
            <view class="ec-title-row">
              <text class="ec-name">{{ esim.pkg.countryName }} eSIM</text>
              <text class="ec-status" :class="esim.status">{{ statusText(esim) }}</text>
            </view>
            <text class="ec-meta">{{ fmt('esims.meta', { gb: esim.pkg.gb, days: esim.pkg.days }) }}</text>
          </view>
          <text class="ec-arrow">{{ expandedId === esim.id ? '⌃' : '⌄' }}</text>
        </view>

        <view v-if="esim.status === 'activated'" class="ec-usage">
          <view class="usage-bar">
            <view class="usage-fill" :style="{ width: usagePercent(esim) + '%' }"></view>
          </view>
          <text class="usage-txt">{{ fmt('esims.usage', { used: Number(esim.used || 0).toFixed(1), total: esim.pkg.gb }) }}</text>
        </view>

        <view class="ec-info">
          <view class="ec-info-row">
            <text class="eci-label">{{ fmt('esims.expireLabel') }}</text>
            <text class="eci-value">{{ formatDate(esim.expireAt) }}</text>
          </view>
          <view class="ec-info-row">
            <text class="eci-label">ICCID</text>
            <text class="eci-value">{{ esim.iccid }}</text>
          </view>
        </view>

        <view v-if="expandedId === esim.id" class="ec-detail">
          <view class="qr-box">
            <EsimQr :text="esim.activationCode" :size="230" />
          </view>
          <text class="qr-tip">{{ fmt('esims.qrTip') }}</text>
          <view class="code-row">
            <text class="code-txt">{{ esim.activationCode }}</text>
            <view class="copy-btn" hover-class="copy-btn--hover" @click.stop="copy(esim.activationCode)">{{ fmt('esims.copy') }}</view>
          </view>
        </view>

        <view v-if="esim.status === 'activated'" class="ec-topup">
          <view class="topup-btn primary" hover-class="topup-btn--hover" @click="goTopup(esim, 'renew')">{{ fmt('esims.renew') }}</view>
          <view class="topup-btn" hover-class="topup-btn--hover" @click="goTopup(esim, 'change')">{{ fmt('esims.change') }}</view>
        </view>

        <view class="ec-actions">
          <view v-if="esim.status === 'pending'" class="act-btn primary" @click="activate(esim.id)">{{ fmt('esims.markActivated') }}</view>
          <view class="act-btn" @click="toggle(esim.id)">
            {{ expandedId === esim.id ? fmt('esims.collapse') : fmt('esims.viewCode') }}
          </view>
          <view class="act-btn danger" @click="remove(esim.id)">{{ fmt('esims.delete') }}</view>
        </view>
      </view>
    </view>

    <view class="footer-safe"></view>

    <FloatingTabBar current="esims" />
  </view>
</template>

<script>
import FloatingTabBar from '@/components/FloatingTabBar.vue'
import EsimQr from '@/components/EsimQr.vue'
import { api } from '@/utils/api'
import { store } from '@/store'
import { formatDate } from '@/utils/format'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换（如 {n}、{gb}、{days}、{used}、{total}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  components: { FloatingTabBar, EsimQr },
  data() {
    return {
      store,
      expandedId: null
    }
  },
  onShow() {
    setNavTitle('pageTitle.esims')
    this.refresh()
  },
  methods: {
    formatDate,
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    async refresh() {
      try {
        const res = await api.getMyEsims()
        if (res.code === 401) {
          uni.showToast({ title: this.fmt('common.needLogin'), icon: 'none' })
          uni.navigateTo({ url: '/pages/login/login' })
          return
        }
        if (res.data.esims) {
          store.setEsims(res.data.esims)
        }
      } catch (e) {}
    },
    statusText(esim) {
      if (esim.status === 'activated') return this.fmt('esims.activated')
      return this.fmt('esims.pending')
    },
    usagePercent(esim) {
      const p = (Number(esim.used || 0) / Number(esim.pkg.gb)) * 100
      return Math.min(100, Math.max(4, p))
    },
    toggle(id) {
      this.expandedId = this.expandedId === id ? null : id
    },
    async activate(id) {
      try {
        await api.activateEsim(id)
        uni.showToast({ title: this.fmt('esims.activateSuccess'), icon: 'success' })
        this.refresh()
      } catch (e) {
        uni.showToast({ title: this.fmt('common.opFailed'), icon: 'none' })
      }
    },
    copy(text) {
      uni.setClipboardData({
        data: text,
        success: () => uni.showToast({ title: this.fmt('esims.copied'), icon: 'none' })
      })
    },
    remove(id) {
      uni.showModal({
        title: this.fmt('esims.deleteTitle'),
        content: this.fmt('esims.deleteConfirm'),
        confirmColor: '#FF7A59',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.deleteEsim(id)
              uni.showToast({ title: this.fmt('esims.deleted'), icon: 'none' })
              this.refresh()
            } catch (e) {
              uni.showToast({ title: this.fmt('esims.deleteFailed'), icon: 'none' })
            }
          }
        }
      })
    },
    getFlagImage(code) {
      if (!code) return '/static/icons/flag-unknown.png'
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    goBuy() {
      uni.reLaunch({ url: '/pages/index/index' })
    },
    goTopup(esim, mode) {
      uni.navigateTo({
        url: `/pages/detail/detail?country=${esim.pkg.countryCode}&mode=${mode}&esimId=${esim.id}`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.esims-page {
  min-height: 100vh;
  background: $bg-page;
}

.head-banner {
  background: $gradient-brand;
  padding: 36rpx $page-pad 44rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hb-left {
  display: flex;
  flex-direction: column;
}

.hb-title {
  font-size: 40rpx;
  font-weight: 800;
  color: #ffffff;
}

.hb-sub {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.85);
}

.hb-btn {
  background: #ffffff;
  color: $brand-deep;
  font-size: 26rpx;
  font-weight: 700;
  padding: 16rpx 32rpx;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 20rpx rgba(3, 105, 161, 0.25);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.95);
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 140rpx;
}

.empty-emoji {
  font-size: 110rpx;
}

.empty-title {
  margin-top: 32rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
}

.empty-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: $ink-3;
}

.empty-btn {
  margin-top: 44rpx;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  padding: 22rpx 72rpx;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.96);
  }
}

.esim-list {
  padding: 28rpx $page-pad 0;
}

.esim-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;
  transition: all 0.25s ease;

  &.expanded {
    box-shadow: $shadow;
  }
}

.ec-head {
  display: flex;
  align-items: center;
}

.ec-flag {
  width: 84rpx;
  height: 84rpx;
  border-radius: 22rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.ec-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ec-main {
  flex: 1;
  margin-left: 22rpx;
  min-width: 0;
}

.ec-title-row {
  display: flex;
  align-items: center;
}

.ec-name {
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
  margin-right: 14rpx;
}

.ec-status {
  font-size: 19rpx;
  font-weight: 700;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;

  &.activated {
    color: #0D9488;
    background: $teal-light;
  }

  &.pending {
    color: #D97706;
    background: $sun-light;
  }
}

.ec-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-2;
}

.ec-arrow {
  font-size: 32rpx;
  color: $ink-3;
  margin-left: 12rpx;
}

.ec-usage {
  margin-top: 22rpx;
  background: $bg-soft;
  border-radius: $radius-sm;
  padding: 18rpx 22rpx;
}

.usage-bar {
  height: 12rpx;
  border-radius: 6rpx;
  background: #D6E7F5;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  border-radius: 6rpx;
  background: $gradient-brand;
  transition: width 0.4s ease;
}

.usage-txt {
  display: block;
  margin-top: 10rpx;
  font-size: 21rpx;
  color: $ink-2;
}

.ec-info {
  margin-top: 22rpx;
  border-top: 1rpx solid $line;
  padding-top: 20rpx;
}

.ec-info-row {
  display: flex;
  justify-content: space-between;
  padding: 6rpx 0;
}

.eci-label {
  font-size: 23rpx;
  color: $ink-3;
}

.eci-value {
  font-size: 23rpx;
  color: $ink-2;
  max-width: 65%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-detail {
  margin-top: 24rpx;
  background: $bg-soft;
  border-radius: $radius;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-box {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 20rpx;
  box-shadow: $shadow-sm;
}

.qr-tip {
  margin-top: 22rpx;
  font-size: 21rpx;
  color: $ink-2;
  text-align: center;
  line-height: 1.6;
}

.code-row {
  margin-top: 20rpx;
  width: 100%;
  background: #ffffff;
  border-radius: $radius-sm;
  padding: 16rpx 20rpx;
  display: flex;
  align-items: center;
  border: 1rpx dashed $brand;
}

.code-txt {
  flex: 1;
  font-size: 22rpx;
  color: $brand-deep;
  word-break: break-all;
  line-height: 1.5;
}

.copy-btn {
  flex-shrink: 0;
  margin-left: 16rpx;
  background: $brand;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
  padding: 10rpx 26rpx;
  border-radius: 999rpx;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.94);
  }
}

.ec-topup {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.topup-btn {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: $ink-2;
  background: $bg-soft;
  border-radius: 999rpx;
  padding: 16rpx 0;
  transition: transform 0.15s ease;

  &.primary {
    background: $gradient-brand;
    color: #ffffff;
    font-weight: 700;
    box-shadow: $shadow-brand;
  }

  &--hover {
    transform: scale(0.97);
  }
}

.ec-actions {
  display: flex;
  margin-top: 24rpx;
  gap: 16rpx;
}

.act-btn {
  flex: 1;
  text-align: center;
  font-size: 24rpx;
  color: $ink-2;
  background: $bg-soft;
  border-radius: 999rpx;
  padding: 16rpx 0;

  &.primary {
    background: $gradient-brand;
    color: #ffffff;
    font-weight: 700;
    box-shadow: $shadow-brand;
  }

  &.danger {
    color: #DC2626;
    background: #FEF2F2;
  }
}

.footer-safe {
  height: calc(176rpx + env(safe-area-inset-bottom));
}
</style>
