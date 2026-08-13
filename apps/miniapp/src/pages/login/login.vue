<template>
  <view class="login-page">
    <view class="login-header">
      <image class="logo" src="/static/icons/hero-avatar.png" mode="aspectFit" />
      <text class="title">YYeSim</text>
      <text class="subtitle">全球流量，即买即用</text>
    </view>

    <view class="login-content">
      <button class="login-btn" @click="handleLogin" :loading="loading">
        <text class="btn-text">支付宝一键登录</text>
      </button>

      <view class="login-tips">
        <text class="tips-text">登录即表示同意</text>
        <text class="link">《用户协议》</text>
        <text class="tips-text">和</text>
        <text class="link">《隐私政策》</text>
      </view>
    </view>

    <view class="login-footer">
      <text class="footer-text">全球200+国家和地区可用</text>
    </view>
  </view>
</template>

<script>
import { store } from '@/store'
import { api } from '@/utils/api'

export default {
  data() {
    return {
      loading: false
    }
  },
  methods: {
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
                  title: '登录成功',
                  icon: 'success'
                })

                setTimeout(() => {
                  uni.switchTab({
                    url: '/pages/profile/profile'
                  })
                }, 1500)
              } else {
                uni.showToast({
                  title: loginRes.message || '登录失败',
                  icon: 'none'
                })
              }
            } catch (error) {
              console.error('登录请求失败:', error)
              uni.showToast({
                title: '网络错误，请重试',
                icon: 'none'
              })
            } finally {
              this.loading = false
            }
          },
          fail: (err) => {
            console.error('获取授权码失败:', err)
            uni.showToast({
              title: '授权失败，请重试',
              icon: 'none'
            })
            this.loading = false
          }
        })
        // #endif

        // #ifndef MP-ALIPAY
        uni.showToast({
          title: '仅支持支付宝小程序登录',
          icon: 'none'
        })
        this.loading = false
        // #endif
      } catch (error) {
        console.error('登录流程错误:', error)
        uni.showToast({
          title: '登录失败，请重试',
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
