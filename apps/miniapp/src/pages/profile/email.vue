<template>
  <view class="email-page">
    <view class="page-hero">
      <text class="hero-title">{{ $t('emailPage.title') }}</text>
      <text class="hero-sub">{{ $t('emailPage.sub') }}</text>
    </view>

    <view class="page-body">
      <!-- 未登录 -->
      <view v-if="!store.isLoggedIn" class="card login-card">
        <text class="login-title">{{ $t('emailPage.loginTitle') }}</text>
        <text class="login-sub">{{ $t('emailPage.loginSub') }}</text>
        <view class="btn-primary" hover-class="btn-hover" @tap="goLogin">{{ $t('emailPage.goLogin') }}</view>
      </view>

      <!-- 已登录 -->
      <block v-else>
        <view class="card">
          <text class="card-title">{{ $t('emailPage.cardTitle') }}</text>

          <!-- 展示态 -->
          <view v-if="!editing" class="email-box">
            <text class="email-text" :class="{ empty: !store.user.email }">{{ store.user.email || $t('emailPage.notSet') }}</text>
            <view v-if="store.user.email" class="copy-btn" hover-class="copy-btn--hover" @tap="copyEmail">
              <image class="copy-icon" src="/static/icons/esim-copy.png" mode="aspectFit" />
              <text class="copy-txt">{{ $t('esims.copy') }}</text>
            </view>
          </view>

          <!-- 编辑态 -->
          <view v-else class="edit-box">
            <input
              v-model="emailInput"
              class="email-input"
              :placeholder="$t('emailPage.placeholder')"
              type="text"
            />
          </view>

          <view class="actions">
            <template v-if="!editing">
              <view class="btn-primary" hover-class="btn-hover" @tap="startEdit">
                {{ store.user.email ? $t('emailPage.edit') : $t('emailPage.setEmail') }}
              </view>
            </template>
            <template v-else>
              <view class="btn-ghost" hover-class="btn-ghost--hover" @tap="cancelEdit">{{ $t('common.cancel') }}</view>
              <view class="btn-primary" :class="{ 'btn-disabled': saving }" @tap="saveEmail">
                {{ saving ? $t('emailPage.saving') : $t('emailPage.save') }}
              </view>
            </template>
          </view>
        </view>

        <view class="card tip-card">
          <image class="tip-icon" src="/static/icons/co-info.png" mode="aspectFit" />
          <text class="tip-txt">{{ $t('emailPage.tip') }}</text>
        </view>
      </block>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { store } from '@/store'
import { api } from '@/utils/api'
import { setNavTitle } from '@/locales'

export default {
  data() {
    return {
      store,
      editing: false,
      emailInput: '',
      saving: false
    }
  },
  onShow() {
    setNavTitle('pageTitle.email')
  },
  methods: {
    goLogin() {
      uni.navigateTo({ url: '/pages/login/login' })
    },
    copyEmail() {
      uni.setClipboardData({ data: store.user.email })
    },
    startEdit() {
      this.emailInput = store.user.email || ''
      this.editing = true
    },
    cancelEdit() {
      this.editing = false
    },
    async saveEmail() {
      if (this.saving) return
      const email = (this.emailInput || '').trim()
      if (!email || !email.includes('@')) {
        uni.showToast({ title: this.$t('emailPage.invalid'), icon: 'none' })
        return
      }
      this.saving = true
      try {
        const res = await api.updateProfile(store.user.id, { email })
        if (res.code === 0 && res.data && res.data.user) {
          store.setUser(res.data.user)
          this.editing = false
          uni.showToast({ title: this.$t('emailPage.saved'), icon: 'success' })
        } else {
          uni.showToast({ title: this.$t('common.opFailed'), icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: this.$t('common.networkError'), icon: 'none' })
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.email-page {
  min-height: 100vh;
  background: $bg-page;
}

.page-hero {
  background: $gradient-brand;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-title {
  font-size: 42rpx;
  font-weight: 800;
  color: #ffffff;
}

.hero-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

.page-body {
  padding: 0 24rpx;
  margin-top: -24rpx;
  position: relative;
}

.card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;
}

.card-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  display: block;
}

/* 未登录卡片 */
.login-card {
  padding: 56rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
}

.login-sub {
  margin-top: 14rpx;
  font-size: 24rpx;
  color: $ink-3;
  line-height: 1.6;
}

/* 邮箱展示 */
.email-box {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  background: $bg-soft;
  border-radius: $radius;
  padding: 26rpx 28rpx;
}

.email-text {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
  color: $ink;
  word-break: break-all;

  &.empty {
    color: $ink-3;
    font-weight: 400;
  }
}

.copy-btn {
  display: flex;
  align-items: center;
  margin-left: 20rpx;
  padding: 10rpx 22rpx;
  background: $brand-light;
  border-radius: 999rpx;
  flex-shrink: 0;
  transition: opacity 0.15s ease;

  &--hover {
    opacity: 0.6;
  }
}

.copy-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 8rpx;
}

.copy-txt {
  font-size: 22rpx;
  color: $brand;
  font-weight: 600;
}

/* 编辑输入 */
.edit-box {
  margin-top: 24rpx;
}

.email-input {
  width: 100%;
  height: 88rpx;
  background: $bg-soft;
  border-radius: $radius;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: $ink;
  box-sizing: border-box;
}

/* 操作按钮 */
.actions {
  margin-top: 28rpx;
  display: flex;
  align-items: center;
}

.btn-primary {
  flex: 1;
  height: 88rpx;
  border-radius: $radius;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-brand;
  transition: opacity 0.15s ease;
}

.btn-hover {
  opacity: 0.85;
}

.btn-disabled {
  opacity: 0.6;
}

.btn-ghost {
  width: 200rpx;
  height: 88rpx;
  margin-right: 20rpx;
  border-radius: $radius;
  border: 2rpx solid $line;
  background: $bg-card;
  color: $ink-2;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s ease;

  &--hover {
    opacity: 0.6;
  }
}

/* 说明卡片 */
.tip-card {
  display: flex;
  align-items: flex-start;
}

.tip-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  margin-top: 4rpx;
  flex-shrink: 0;
}

.tip-txt {
  flex: 1;
  font-size: 23rpx;
  color: $ink-3;
  line-height: 1.7;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
