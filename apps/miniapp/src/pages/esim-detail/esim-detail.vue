<template>
  <view class="detail-page">
    <!-- 顶部状态栏 -->
    <view class="status-header" :style="{ background: getHeaderGradient() }">
      <view class="status-content">
        <view class="status-flag">
          <image class="status-flag-img" :src="getFlagImage(esim?.pkg?.countryCode)" mode="aspectFit" />
        </view>
        <view class="status-info">
          <text class="status-name">{{ esim?.pkg?.countryName }} eSIM</text>
          <text class="status-badge" :class="esim?.status">{{ statusText }}</text>
        </view>
      </view>
    </view>

    <!-- 卡片信息 -->
    <view class="info-card">
      <view class="info-row">
        <text class="info-label">套餐规格</text>
        <text class="info-value">{{ esim?.pkg?.gb }}GB · {{ esim?.pkg?.days }}天</text>
      </view>
      <view class="info-row">
        <text class="info-label">到期时间</text>
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
        <text class="usage-title">流量使用情况</text>
        <text class="usage-percent">{{ usagePercent }}%</text>
      </view>
      <view class="usage-bar">
        <view class="usage-fill" :style="{ width: usagePercent + '%' }"></view>
      </view>
      <view class="usage-footer">
        <text class="usage-used">已用 {{ usedData }}GB</text>
        <text class="usage-total">共 {{ esim?.pkg?.gb }}GB</text>
      </view>
    </view>

    <!-- 激活码区域 -->
    <view class="qr-card">
      <view class="qr-header">
        <text class="qr-title">eSIM 激活码</text>
        <view class="qr-copy-btn" hover-class="qr-copy-btn--hover" @click="copyCode">
          <text>{{ copied ? '已复制' : '复制' }}</text>
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
      <view v-if="esim?.status === 'pending'" class="action-btn primary" @click="markActivated">
        <text>标记为已激活</text>
      </view>
      <view v-if="canRenew" class="action-btn renew" @click="goRenew">
        <text>续费</text>
      </view>
      <view class="action-btn danger" @click="deleteEsim">
        <text>删除</text>
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
      return this.esim.status === 'activated' ? '已激活' : '待激活'
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
    setNavTitle('eSIM 详情')
    this.loadEsim()
  },
  methods: {
    formatDate,
    getFlagImage(code) {
      if (!code) return '/static/icons/flag-unknown.png'
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    getHeaderGradient() {
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #a78bfa 100%)'
    },
    async loadEsim() {
      try {
        const res = await api.getMyEsims()
        if (res.data.esims) {
          this.esim = res.data.esims.find(e => e.id === this.esimId)
        }
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
    },
    copyCode() {
      if (!this.esim?.activationCode) return
      uni.setClipboardData({
        data: this.esim.activationCode,
        success: () => {
          this.copied = true
          uni.showToast({ title: '已复制', icon: 'success' })
          setTimeout(() => { this.copied = false }, 2000)
        }
      })
    },
    async markActivated() {
      try {
        await api.activateEsim(this.esimId)
        uni.showToast({ title: '已标记为激活', icon: 'success' })
        this.loadEsim()
      } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    goRenew() {
      uni.navigateTo({
        url: `/pages/detail/detail?country=${this.esim.pkg.countryCode}&mode=renew&esimId=${this.esimId}`
      })
    },
    deleteEsim() {
      uni.showModal({
        title: '删除 eSIM',
        content: '确定要删除这张 eSIM 卡吗？删除后无法恢复。',
        confirmColor: '#EF4444',
        success: async (res) => {
          if (res.confirm) {
            try {
              await api.deleteEsim(this.esimId)
              uni.showToast({ title: '已删除', icon: 'success' })
              setTimeout(() => {
                uni.navigateBack()
              }, 1500)
            } catch (e) {
              uni.showToast({ title: '删除失败', icon: 'none' })
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
  background: #f0f2f5;
}

.status-header {
  padding: 40rpx 40rpx 60rpx;
  border-radius: 0 0 40rpx 40rpx;
}

.status-content {
  display: flex;
  align-items: center;
}

.status-flag {
  width: 120rpx;
  height: 120rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.25);
  border: 2rpx solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.status-flag-img {
  width: 90rpx;
  height: 90rpx;
}

.status-info {
  margin-left: 28rpx;
  flex: 1;
}

.status-name {
  font-size: 36rpx;
  font-weight: 800;
  color: #ffffff;
  display: block;
  margin-bottom: 12rpx;
}

.status-badge {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  display: inline-block;

  &.activated {
    color: #059669;
    background: rgba(255, 255, 255, 0.9);
  }

  &.pending {
    color: #d97706;
    background: rgba(255, 255, 255, 0.9);
  }
}

.info-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: -30rpx 24rpx 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 2;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  font-size: 26rpx;
  color: #6b7280;
}

.info-value {
  font-size: 26rpx;
  color: #1f2937;
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
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  color: #1f2937;
}

.usage-percent {
  font-size: 28rpx;
  font-weight: 700;
  color: #667eea;
}

.usage-bar {
  height: 16rpx;
  border-radius: 8rpx;
  background: #f3f4f6;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.usage-fill {
  height: 100%;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.4s ease;
}

.usage-footer {
  display: flex;
  justify-content: space-between;
}

.usage-used {
  font-size: 24rpx;
  color: #6b7280;
}

.usage-total {
  font-size: 24rpx;
  color: #9ca3af;
}

.qr-card {
  background: #ffffff;
  border-radius: 24rpx;
  margin: 0 24rpx 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  color: #1f2937;
}

.qr-copy-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: #f9fafb;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.qr-code-text {
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 20rpx;
  text-align: center;
  font-size: 22rpx;
  color: #6b7280;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.3);
  }

  &.renew {
    background: #ffffff;
    color: #667eea;
    border: 2rpx solid #667eea;
  }

  &.danger {
    background: #ffffff;
    color: #ef4444;
    border: 2rpx solid #ef4444;
  }

  &:active {
    transform: scale(0.96);
  }
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
