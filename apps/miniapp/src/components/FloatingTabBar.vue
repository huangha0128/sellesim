<template>
  <view class="tabbar-wrap">
    <view class="tabbar">
      <view
        v-for="item in items"
        :key="item.key"
        class="tab-item"
        :class="{ active: item.key === current }"
        hover-class="tab-item--hover"
        @click="switchTo(item)"
      >
        <view class="tab-icon-box">
          <image class="tab-icon" :src="item.key === current ? item.activeIcon : item.icon" mode="aspectFit" />
        </view>
        <text class="tab-label">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'FloatingTabBar',
  props: {
    current: {
      type: String,
      default: 'home'
    }
  },
  computed: {
    items() {
      return [
        {
          key: 'home',
          label: this.$t('tab.home'),
          icon: '/static/icons/tab-home.png',
          activeIcon: '/static/icons/tab-home-active.png',
          url: '/pages/index/index'
        },
        {
          key: 'esims',
          label: this.$t('tab.esims'),
          icon: '/static/icons/tab-esim.png',
          activeIcon: '/static/icons/tab-esim-active.png',
          url: '/pages/esims/esims'
        },
        {
          key: 'profile',
          label: this.$t('tab.profile'),
          icon: '/static/icons/tab-profile.png',
          activeIcon: '/static/icons/tab-profile-active.png',
          url: '/pages/profile/profile'
        }
      ]
    }
  },
  methods: {
    switchTo(item) {
      if (item.key === this.current) return
      uni.reLaunch({ url: item.url })
    }
  }
}
</script>

<style lang="scss" scoped>
.tabbar-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.tabbar {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.97);
  border: 1rpx solid rgba(255, 255, 255, 0.75);
  border-radius: 999rpx;
  padding: 14rpx 16rpx;
  box-shadow:
    0 16rpx 48rpx rgba(15, 84, 140, 0.18),
    inset 0 2rpx 6rpx rgba(255, 255, 255, 0.9);
}

.tab-item {
  width: 156rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0 6rpx;
  border-radius: 40rpx;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.94);
  }
}

.tab-icon-box {
  width: 72rpx;
  height: 56rpx;
  border-radius: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.tab-icon {
  width: 44rpx;
  height: 44rpx;
  display: block;
}

.tab-label {
  margin-top: 4rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: $ink-3;
  line-height: 1.2;
}

.tab-item.active {
  .tab-icon-box {
    background: $gradient-sky;
    box-shadow:
      inset 0 2rpx 6rpx rgba(14, 165, 233, 0.18),
      0 4rpx 10rpx rgba(14, 165, 233, 0.14);
  }

  .tab-label {
    color: $brand-deep;
    font-weight: 700;
  }
}
</style>
