<template>
  <view class="login-page">
    <view class="login-header">
      <image class="logo" src="/static/icons/hero-avatar.png" mode="aspectFit" />
      <text class="title">YYeSim</text>
      <text class="subtitle">{{ $t('login.subtitle') }}</text>
    </view>

    <view class="login-content">
      <button class="login-btn" @click="handleLogin" :loading="loading">
        <text class="btn-text">{{ $t('login.btn') }}</text>
      </button>

      <view class="agree-row">
        <view class="agree-box" :class="{ checked: agreed }" @tap="toggleAgreed">
          <image v-if="agreed" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
        </view>
        <view class="agree-text">
          <text class="tips-text">{{ $t('login.agreeRead') }}</text>
          <text class="link" @tap="goLegal('agreement')">{{ $t('login.agreement') }}</text>
          <text class="tips-text">{{ $t('login.and') }}</text>
          <text class="link" @tap="goLegal('privacy')">{{ $t('login.privacy') }}</text>
        </view>
      </view>
    </view>

    <view class="login-footer">
      <text class="footer-text">{{ $t('login.footer') }}</text>
    </view>

    <!-- 协议同意抽屉：原生 showModal 按钮文字会截断，改用自定义弹窗 -->
    <view v-if="showAgreePopup" class="agree-mask" @tap="closeAgreePopup"></view>
    <view v-if="showAgreePopup" class="agree-popup">
      <view class="agree-popup-title">{{ $t('login.agreeModalTitle') }}</view>
      <scroll-view scroll-y class="agree-popup-body">
        <text class="agree-popup-text">{{ $t('login.agreeModalContent') }}</text>
        <view class="popup-links">
          <text class="popup-link" @tap="goLegal('agreement')">{{ $t('login.agreement') }}</text>
          <text class="popup-link" @tap="goLegal('privacy')">{{ $t('login.privacy') }}</text>
        </view>
      </scroll-view>
      <view class="agree-popup-btns">
        <view class="agree-btn cancel" @tap="closeAgreePopup">{{ $t('login.agreeCancel') }}</view>
        <view class="agree-btn confirm" @tap="confirmAgree">{{ $t('login.agreeConfirm') }}</view>
      </view>
    </view>
  </view>
</template>

<script>
import { store } from '@/store'
import { api } from '@/utils/api'

export default {
  data() {
    return {
      loading: false,
      redirectUrl: '',
      agreed: false,
      showAgreePopup: false
    }
  },
  onLoad(options) {
    if (options && options.redirect) {
      this.redirectUrl = decodeURIComponent(options.redirect)
    }
    // 已同意过协议则自动勾选，无需重复勾选
    this.agreed = store.agreed
  },
  methods: {
    toggleAgreed() {
      this.agreed = !this.agreed
      store.setAgreed(this.agreed)
    },
    goLegal(type) {
      this.showAgreePopup = false
      uni.navigateTo({ url: `/pages/profile/legal?type=${type}` })
    },
    afterLogin() {
      if (this.redirectUrl) {
        uni.redirectTo({ url: this.redirectUrl })
      } else {
        uni.reLaunch({ url: '/pages/profile/profile' })
      }
    },
    closeAgreePopup() {
      this.showAgreePopup = false
    },
    confirmAgree() {
      this.agreed = true
      store.setAgreed(true)
      this.showAgreePopup = false
      this.doLogin()
    },
    async handleLogin() {
      if (this.loading) return

      // 隐私合规：默认不勾选，未同意时弹出抽屉单独征得用户主动同意（可拒绝，不强制、不循环弹窗）
      if (!this.agreed) {
        this.showAgreePopup = true
        return
      }

      this.doLogin()
    },
    async doLogin() {
      this.loading = true

      try {
        // #ifdef MP-ALIPAY
        my.getAuthCode({
          scopes: 'auth_user',
          success: async (res) => {
            try {
              const loginRes = await api.login(res.authCode)

              if (loginRes.code === 0) {
                store.login(loginRes.data.token, loginRes.data.openId, loginRes.data.userId, loginRes.data.user)
                uni.showToast({
                  title: this.$t('login.success'),
                  icon: 'success'
                })

                setTimeout(() => {
                  this.afterLogin()
                }, 1500)
              } else {
                uni.showToast({
                  title: loginRes.message || this.$t('login.failed'),
                  icon: 'none'
                })
              }
            } catch (error) {
              console.error('登录请求失败:', error)
              uni.showToast({
                title: this.$t('common.networkError'),
                icon: 'none'
              })
            } finally {
              this.loading = false
            }
          },
          fail: (err) => {
            console.error('获取授权码失败:', err)
            uni.showToast({
              title: this.$t('login.authFailed'),
              icon: 'none'
            })
            this.loading = false
          }
        })
        // #endif

        // #ifndef MP-ALIPAY
        uni.showToast({
          title: this.$t('login.alipayOnly'),
          icon: 'none'
        })
        this.loading = false
        // #endif
      } catch (error) {
        console.error('登录流程错误:', error)
        uni.showToast({
          title: this.$t('login.failedRetry'),
          icon: 'none'
        })
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: $gradient-brand;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 120rpx $page-pad 80rpx;
}

.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ffffff;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 4rpx solid rgba(255, 255, 255, 0.4);
  margin-bottom: 32rpx;
}

.title {
  font-size: 56rpx;
  font-weight: 800;
  margin-bottom: 16rpx;
}

.subtitle {
  font-size: 28rpx;
  opacity: 0.9;
}

.login-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  background: #ffffff;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-brand;
  margin-bottom: 32rpx;
  border: none;

  &::after {
    border: none;
  }
}

.btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: $brand-deep;
}

.agree-row {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  max-width: 100%;
}

.agree-box {
  width: 34rpx;
  height: 34rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12rpx;
  margin-top: 2rpx;
  transition: all 0.2s ease;

  &.checked {
    background: #ffffff;
    border-color: #ffffff;
  }
}

.check-icon {
  width: 24rpx;
  height: 24rpx;
}

.agree-text {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.tips-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 4rpx;
}

.link {
  font-size: 22rpx;
  color: #ffffff;
  text-decoration: underline;
}

.login-footer {
  text-align: center;
}

.footer-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

/* 协议同意抽屉（自定义，替代原生 showModal 避免按钮文字截断） */
.agree-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
}

.agree-popup {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  z-index: 301;
  padding: 40rpx 40rpx calc(32rpx + env(safe-area-inset-bottom));
  animation: slideUp 0.3s ease;
}

.agree-popup-title {
  font-size: 34rpx;
  font-weight: 700;
  color: $ink;
  text-align: center;
  margin-bottom: 24rpx;
}

.agree-popup-body {
  max-height: 40vh;
  margin-bottom: 32rpx;
}

.agree-popup-text {
  display: block;
  font-size: 27rpx;
  line-height: 1.7;
  color: $ink-3;
}

.popup-links {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
}

.popup-link {
  font-size: 27rpx;
  color: $brand;
  text-decoration: underline;
  padding: 8rpx 0;
}

.agree-popup-btns {
  display: flex;
  align-items: center;
}

.agree-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
}

.agree-btn.cancel {
  background: #f3f4f6;
  color: $ink-3;
  margin-right: 20rpx;
}

.agree-btn.confirm {
  background: $gradient-brand;
  color: #ffffff;
  box-shadow: $shadow-brand;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
