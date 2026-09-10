<template>
  <view class="sm-page">
    <view class="sm-hero">
      <text class="sh-eyebrow">{{ $t('supportedModels.eyebrow') }}</text>
      <text class="sh-title">{{ $t('supportedModels.title') }}</text>
      <text class="sh-sub">{{ $t('supportedModels.sub') }}</text>
    </view>

    <view class="sm-body">
      <view v-for="group in groups" :key="group.id" class="brand-card">
        <view class="brand-head">
          <view class="brand-name-row">
            <text class="brand-name">{{ group.name }}</text>
            <text v-if="group.count" class="brand-count">{{ group.count }}</text>
          </view>
          <text v-if="group.note" class="brand-note">{{ group.note }}</text>
        </view>
        <view class="model-grid">
          <view v-for="(m, i) in group.models" :key="i" class="model-cell">{{ m }}</view>
        </view>
      </view>
      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
import { setNavTitle } from '@/locales'

export default {
  data() {
    return {
      groups: [
        {
          id: 'apple',
          name: 'Apple iPhone',
          note: '',
          models: [
            'iPhone XR', 'iPhone XS', 'iPhone XS Max', 'iPhone SE（第 2 代）',
            'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
            'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
            'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
            'iPhone SE（第 3 代）',
            'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
            'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
            'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
            'iPhone 16e', 'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
          ]
        },
        {
          id: 'pixel',
          name: 'Google Pixel',
          note: '海外版全部自带 eSIM',
          models: [
            'Pixel 3', 'Pixel 3 XL', 'Pixel 3a', 'Pixel 3a XL',
            'Pixel 4', 'Pixel 4 XL', 'Pixel 4a', 'Pixel 4a 5G',
            'Pixel 5', 'Pixel 5a',
            'Pixel 6', 'Pixel 6 Pro', 'Pixel 6a',
            'Pixel 7', 'Pixel 7 Pro', 'Pixel 7a',
            'Pixel 8', 'Pixel 8 Pro', 'Pixel 8a', 'Pixel Fold',
            'Pixel 9', 'Pixel 9 Pro', 'Pixel 9 Pro XL', 'Pixel 9 Pro Fold',
            'Pixel 10', 'Pixel 10 Pro', 'Pixel 10 Pro XL', 'Pixel 10 Pro Fold', 'Pixel 10a'
          ]
        },
        {
          id: 'samsung',
          name: '三星 Samsung',
          note: '海外 / 欧 / 港版；国行无 eSIM',
          models: [
            'Galaxy S20', 'Galaxy S20+', 'Galaxy S20 Ultra',
            'Galaxy S21', 'Galaxy S21+', 'Galaxy S21 Ultra',
            'Galaxy S22', 'Galaxy S22+', 'Galaxy S22 Ultra',
            'Galaxy S23', 'Galaxy S23+', 'Galaxy S23 Ultra', 'Galaxy S23 FE',
            'Galaxy S24', 'Galaxy S24+', 'Galaxy S24 Ultra', 'Galaxy S24 FE',
            'Galaxy S25', 'Galaxy S25+', 'Galaxy S25 Ultra', 'Galaxy S25 Edge', 'Galaxy S25 FE',
            'Galaxy S26', 'Galaxy S26+', 'Galaxy S26 Ultra',
            'Galaxy Note20', 'Galaxy Note20 Ultra',
            'Galaxy Fold',
            'Galaxy Z Fold2', 'Galaxy Z Fold3', 'Galaxy Z Fold4', 'Galaxy Z Fold5',
            'Galaxy Z Fold6', 'Galaxy Z Fold7', 'Galaxy Z Fold8', 'Galaxy Z Fold8 Ultra',
            'Galaxy Z Flip', 'Galaxy Z Flip 5G', 'Galaxy Z Flip3', 'Galaxy Z Flip4',
            'Galaxy Z Flip5', 'Galaxy Z Flip6', 'Galaxy Z Flip7', 'Galaxy Z Flip7 FE', 'Galaxy Z Flip8',
            'Galaxy A36 5G', 'Galaxy A55 5G', 'Galaxy A56 5G',
            'Galaxy XCover7', 'Galaxy XCover7 Pro'
          ]
        },
        {
          id: 'oneplus',
          name: 'OnePlus 一加',
          note: '全球版，国内国行无 eSIM',
          models: ['OnePlus 12', 'OnePlus 13', 'OnePlus Open', 'OnePlus Nord 4']
        },
        {
          id: 'motorola',
          name: 'Motorola 摩托罗拉',
          note: '海外版',
          models: [
            'Motorola Razr 2019', 'Motorola Razr 5G',
            'Motorola Razr 40', 'Motorola Razr 40 Ultra', 'Motorola Razr+', 'Motorola Razr+ 2024',
            'Motorola Razr 2024', 'Motorola Razr 50', 'Motorola Razr 50 Ultra',
            'Motorola Edge+', 'Motorola Edge 40', 'Motorola Edge 40 Pro', 'Motorola Edge 50',
            'Motorola Edge 60', 'Motorola Edge 60 Pro', 'Motorola Edge 60 Fusion', 'Motorola Edge 60 Stylus',
            'Moto G34', 'Moto G35', 'Moto G54', 'Moto G84', 'Moto G75', 'Moto G85',
            'Moto G Stylus 5G (2024)', 'Moto G Power 5G (2024)', 'Moto G Power 5G (2025)'
          ]
        },
        {
          id: 'sony',
          name: 'Sony 索尼 Xperia',
          note: '国际版',
          models: [
            'Xperia 10 III Lite', 'Xperia 1 IV', 'Xperia 1 V', 'Xperia 1 VI',
            'Xperia 5 IV', 'Xperia 5 V', 'Xperia 5 VI'
          ]
        },
        {
          id: 'sharp',
          name: 'Sharp 夏普',
          note: '',
          models: [
            'AQUOS sense4 lite', 'AQUOS Sense6s', 'AQUOS sense7', 'AQUOS sense7 plus',
            'AQUOS Wish', 'AQUOS wish2', 'AQUOS wish3',
            'AQUOS zero6', 'AQUOS R7', 'AQUOS R8'
          ]
        }
      ]
    }
  },
  onShow() {
    setNavTitle('pageTitle.supportedModels')
  },
  created() {
    this.groups.forEach((g) => {
      g.count = `${g.models.length} 款`
    })
  }
}
</script>

<style lang="scss" scoped>
.sm-page {
  min-height: 100vh;
  background: $bg-page;
}

.sm-hero {
  background: $gradient-canvas;
  padding: 60rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sh-eyebrow {
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: $tracking-label;
  color: $brand;
  text-transform: uppercase;
}

.sh-title {
  margin-top: 16rpx;
  font-size: 42rpx;
  font-weight: 800;
  color: $ink;
}

.sh-sub {
  margin-top: 14rpx;
  font-size: 25rpx;
  color: $ink-3;
  text-align: center;
  line-height: 1.6;
}

.sm-body {
  padding: 28rpx $page-pad 0;
}

.brand-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;
}

.brand-head {
  padding-bottom: 22rpx;
  border-bottom: 1rpx solid $line;
  margin-bottom: 24rpx;
}

.brand-name-row {
  display: flex;
  align-items: center;
}

.brand-name {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.brand-count {
  margin-left: 14rpx;
  font-size: 20rpx;
  color: $brand;
  background: $brand-lighter;
  border-radius: 999rpx;
  padding: 4rpx 14rpx;
  font-weight: 600;
}

.brand-note {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $sun-deep;
  background: $sun-light;
  border-radius: $radius-sm;
  padding: 10rpx 16rpx;
  line-height: 1.5;
}

.model-grid {
  display: flex;
  flex-wrap: wrap;
  margin: -10rpx;
}

.model-cell {
  flex: 0 0 50%;
  box-sizing: border-box;
  padding: 10rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.5;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>