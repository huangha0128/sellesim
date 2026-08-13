<template>
  <view class="pkg-card" hover-class="pkg-card--hover" @click="onTap">
    <view class="pkg-flag">
      <text class="pkg-flag-text">{{ pkg.flag }}</text>
    </view>
    <view class="pkg-main">
      <view class="pkg-head">
        <text class="pkg-country">{{ pkg.countryName }}</text>
        <text v-if="pkg.tag" class="pkg-tag" :style="{ color: pkg.tagColor, background: pkg.tagColor + '1A' }">{{ pkg.tag }}</text>
      </view>
      <view class="pkg-meta">
        <text class="pkg-meta-item">{{ pkg.gb }}GB 流量</text>
        <text class="pkg-dot">·</text>
        <text class="pkg-meta-item">{{ pkg.days }}天有效</text>
        <text class="pkg-dot">·</text>
        <text class="pkg-meta-item">{{ pkg.network }}</text>
      </view>
      <view class="pkg-type">{{ pkg.type }}</view>
    </view>
    <view class="pkg-right">
      <view class="pkg-price">
        <text class="pkg-price-symbol">¥</text>
        <text class="pkg-price-num">{{ priceNum }}</text>
      </view>
      <view class="pkg-buy">
        <text>查看</text>
        <text class="pkg-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script>
import { formatPrice } from '@/utils/format'

export default {
  name: 'PackageCard',
  props: {
    pkg: { type: Object, required: true }
  },
  computed: {
    priceNum() {
      const n = Number(this.pkg.price)
      return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
    }
  },
  emits: ['tap'],
  methods: {
    onTap() {
      this.$emit('tap', JSON.stringify(this.pkg.id))
    }
  }
}
</script>

<style lang="scss" scoped>
.pkg-card {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-sm;
  border: 1rpx solid rgba(227, 238, 247, 0.8);
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.985);
  }
}

.pkg-flag {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &-text {
    font-size: 52rpx;
    line-height: 1;
  }
}

.pkg-main {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
}

.pkg-head {
  display: flex;
  align-items: center;
}

.pkg-country {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
  margin-right: 12rpx;
}

.pkg-tag {
  font-size: 20rpx;
  font-weight: 600;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  line-height: 1.4;
}

.pkg-meta {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
}

.pkg-meta-item {
  font-size: 24rpx;
  color: $ink-2;
}

.pkg-dot {
  margin: 0 10rpx;
  color: $ink-3;
}

.pkg-type {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 12rpx;
  font-size: 20rpx;
  color: $brand-deep;
  background: $brand-lighter;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}

.pkg-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.pkg-price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 700;

  &-symbol {
    font-size: 24rpx;
  }

  &-num {
    font-size: 44rpx;
    line-height: 1;
  }
}

.pkg-buy {
  display: flex;
  align-items: center;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.pkg-arrow {
  font-size: 28rpx;
  margin-left: 4rpx;
}
</style>
