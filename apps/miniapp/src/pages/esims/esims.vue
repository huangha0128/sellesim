<template>
  <view class="esims-page">
    <view class="head-banner">
      <view class="hb-left">
        <text class="hb-title">我的 eSIM</text>
        <text class="hb-sub">共 {{ store.esims.length }} 张 · 全球流量随时可用</text>
      </view>
      <view class="hb-btn" hover-class="hb-btn--hover" @click="goBuy">+ 购买</view>
    </view>

    <view v-if="!store.esims.length" class="empty">
      <image class="empty-emoji" src="/static/icons/prof-esim.png" mode="aspectFit" />
      <text class="empty-title">还没有 eSIM</text>
      <text class="empty-sub">去挑选一张适合你的全球流量套餐吧</text>
      <view class="empty-btn" hover-class="empty-btn--hover" @click="goBuy">去购买</view>
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
            <text class="ec-flag-emoji">{{ esim.pkg.flag }}</text>
          </view>
          <view class="ec-main">
            <view class="ec-title-row">
              <text class="ec-name">{{ esim.pkg.countryName }} eSIM</text>
              <text class="ec-status" :class="esim.status">{{ statusText(esim) }}</text>
            </view>
            <text class="ec-meta">{{ esim.pkg.gb }}GB · {{ esim.pkg.days }}天有效</text>
          </view>
          <text class="ec-arrow">{{ expandedId === esim.id ? '⌃' : '⌄' }}</text>
        </view>

        <view v-if="esim.status === 'activated'" class="ec-usage">
          <view class="usage-bar">
            <view class="usage-fill" :style="{ width: usagePercent(esim) + '%' }"></view>
          </view>
          <text class="usage-txt">已用 {{ Number(esim.used || 0).toFixed(1) }}GB / {{ esim.pkg.gb }}GB</text>
        </view>

        <view class="ec-info">
          <view class="ec-info-row">
            <text class="eci-label">有效期至</text>
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
          <text class="qr-tip">扫描上方二维码，或复制激活码在手机「设置 → 蜂窝网络 → 添加 eSIM」中安装</text>
          <view class="code-row">
            <text class="code-txt">{{ esim.activationCode }}</text>
            <view class="copy-btn" hover-class="copy-btn--hover" @click.stop="copy(esim.activationCode)">复制</view>
          </view>
        </view>

        <view class="ec-actions">
          <view v-if="esim.status === 'pending'" class="act-btn primary" @click="activate(esim.id)">标记已激活</view>
          <view class="act-btn" @click="toggle(esim.id)">
            {{ expandedId === esim.id ? '收起' : '查看激活码' }}
          </view>
          <view class="act-btn danger" @click="remove(esim.id)">删除</view>
        </view>
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

export default {
  components: { EsimQr },
  data() {
    return {
      store,
      expandedId: null
    }
  },
  onLoad() {
    this.refresh()
  },
  onShow() {
    this.refresh()
  },
  methods: {
    formatDate,
    async refresh() {
      try {
        const res = await api.getMyEsims()
        store.setEsims(res.data.esims || [])
      } catch (e) {}
    },
    statusText(esim) {
      if (esim.status === 'activated') return '已激活'
      return '待激活'
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
        uni.showToast({ title: '已标记为激活', icon: 'success' })
        this.refresh()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    copy(text) {
      uni.setClipboardData({
        data: text,
        success: () => uni.showToast({ title: '激活码已复制', icon: 'none' })
      })
    },
    remove(id) {
      uni.showModal({
        title: '删除 eSIM',
        content: '删除后该 eSIM 将无法恢复，确定删除吗？',
        confirmColor: '#FF7A59',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.deleteEsim(id)
              uni.showToast({ title: '已删除', icon: 'none' })
              this.refresh()
            } catch (e) {
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    },
    goBuy() {
      uni.switchTab({ url: '/pages/index/index' })
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
}

.ec-flag-emoji {
  font-size: 46rpx;
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
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
