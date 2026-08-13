<template>
  <view class="country-cell" hover-class="country-cell--hover" @click="$emit('tap', country)">
    <view class="cc-flag">
      <image class="cc-flag-img" :src="getFlagImage(country.code)" mode="aspectFit" />
    </view>
    <view class="cc-main">
      <view class="cc-name-row">
        <text class="cc-name">{{ country.name }}</text>
        <text class="cc-en">{{ country.en }}</text>
      </view>
      <view class="cc-intro">{{ country.intro }}</view>
    </view>
    <view class="cc-right">
      <text class="cc-arrow">›</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CountryCell',
  props: {
    country: { type: Object, required: true }
  },
  emits: ['tap'],
  methods: {
    getFlagImage(code) {
      return `/static/icons/flag-${code.toLowerCase()}.png`
    }
  }
}
</script>

<style lang="scss" scoped>
.country-cell {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius;
  padding: 26rpx 28rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-sm;
  transition: transform 0.15s ease;

  &--hover {
    transform: scale(0.985);
  }
}

.cc-flag {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  background: $brand-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.cc-flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cc-main {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
}

.cc-name-row {
  display: flex;
  align-items: baseline;
}

.cc-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
}

.cc-en {
  font-size: 22rpx;
  color: $ink-3;
  margin-left: 14rpx;
}

.cc-intro {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $ink-2;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cc-right {
  margin-left: 16rpx;
  flex-shrink: 0;
}

.cc-arrow {
  font-size: 36rpx;
  color: $ink-3;
}
</style>
