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

      <view class="login-tips">
        <text class="tips-text">{{ $t('login.agreePrefix') }}</text>
        <text class="link">{{ $t('login.agreement') }}</text>
        <text class="tips-text">{{ $t('login.and') }}</text>
        <text class="link">{{ $t('login.privacy') }}</text>
      </view>
    </view>

    <view class="login-footer">
      <text class="footer-text">{{ $t('login.footer') }}</text>
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
      redirectUrl: ''
    }
  },
  onLoad(options) {
    if (options && options.redirect) {
      this.redirectUrl = decodeURIComponent(options.redirect)
    }
  },
  methods: {
    afterLogin() {
      if (this.redirectUrl) {
        uni.redirectTo({ url: this.redirectUrl })
      } else {
        uni.reLaunch({ url: '/pages/profile/profile' })
      }
    },
    async handleLogin() {
      if (this.loading) return

      this.loading = true

      try {
        // #ifdef MP-ALIPAY
        my.getAuthCode({
          scopes: 'auth_user',
          success: async (res) => {
            try {
              const loginRes = await api.login(res.authCode)

              if (loginRes.code === 0) {
                store.login(loginRes.data.token, loginRes.data.user)
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

.login-tips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
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
</style>
