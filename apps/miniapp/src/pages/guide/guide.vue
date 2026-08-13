<template>
  <view class="guide-page">
    <view class="guide-hero">
      <text class="gh-title">eSIM 安装指南</text>
      <text class="gh-sub">3 分钟搞定，全球上网不迷路</text>
    </view>

    <view class="guide-body">
      <view class="platform-tabs">
        <view class="pt-tab" :class="{ active: platform === 'ios' }" @click="platform = 'ios'">
          <image class="pt-emoji" src="/static/icons/guide-apple.png" mode="aspectFit" />
          <text class="pt-txt">iPhone</text>
        </view>
        <view class="pt-tab" :class="{ active: platform === 'android' }" @click="platform = 'android'">
          <image class="pt-emoji" src="/static/icons/guide-android.png" mode="aspectFit" />
          <text class="pt-txt">Android</text>
        </view>
      </view>

      <view class="compat-card">
        <view class="compat-title">
          <image src="/static/icons/prof-esim.png" mode="aspectFit" style="width: 32rpx; height: 32rpx; margin-right: 12rpx; vertical-align: middle;" />
          <text>设备兼容性检查</text>
        </view>
        <text class="compat-txt">支持 eSIM 的设备：iPhone XS/XR 及以上、iPad Pro 及以上、三星 Galaxy S20 及以上、华为 P40/Mate40 Pro 及以上（国行部分机型除外）、小米 12T Pro 及以上等。可前往手机「设置」中查看是否有「添加 eSIM」或「SIM 卡管理」入口。</text>
      </view>

      <view class="steps">
        <view v-for="(s, i) in steps" :key="i" class="step-card">
          <view class="step-head">
            <view class="step-badge">{{ i + 1 }}</view>
            <text class="step-title">{{ s.title }}</text>
          </view>
          <text class="step-desc">{{ s.desc }}</text>
          <view v-if="s.tips && s.tips.length" class="step-tips">
            <view v-for="(t, ti) in s.tips" :key="ti" class="step-tip">
              <text class="tip-dot">·</text>
              <text class="tip-txt">{{ t }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="faq-card">
        <text class="faq-title">常见问题</text>
        <view v-for="(f, i) in faqs" :key="i" class="faq-item" @click="toggleFaq(i)">
          <view class="faq-q">
            <text class="faq-q-txt">{{ f.q }}</text>
            <text class="faq-arrow">{{ openFaq === i ? '⌃' : '⌄' }}</text>
          </view>
          <text v-if="openFaq === i" class="faq-a">{{ f.a }}</text>
        </view>
      </view>

      <view class="footer-safe"></view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      platform: 'ios',
      openFaq: 0,
      steps: [],
      faqs: [
        {
          q: '激活码有效期多久？',
          a: '激活码自购买后长期有效，套餐有效期从「安装激活」当天起算，建议到达目的地后再安装。'
        },
        {
          q: '流量用完了怎么办？',
          a: '可在「我的 eSIM」页面购买新的套餐，或在首页选择相同地区再次下单，新激活码将叠加到已激活的 eSIM 上。'
        },
        {
          q: '可以开热点共享吗？',
          a: '可以。大部分套餐支持开启个人热点，供同行的手机、平板等设备共享流量。'
        },
        {
          q: '到了国外没网怎么办？',
          a: '请确认已安装 eSIM 并开启「数据漫游」开关；若仍无法上网，可尝试手动选择当地运营商网络。'
        }
      ]
    }
  },
  watch: {
    platform() {
      this.buildSteps()
    }
  },
  created() {
    this.buildSteps()
  },
  methods: {
    buildSteps() {
      if (this.platform === 'ios') {
        this.steps = [
          {
            title: '购买套餐并获取激活码',
            desc: '在首页选择目的地与套餐，完成支付后，激活码会自动发放到「我的 eSIM」页面。',
            tips: ['购买前请确认手机支持 eSIM 功能']
          },
          {
            title: '打开系统设置',
            desc: '进入「设置 → 蜂窝网络（或 蜂窝数据）→ 添加蜂窝套餐」。'
          },
          {
            title: '扫描二维码或输入激活码',
            desc: '点击「使用二维码」扫描「我的 eSIM」中的二维码；或选择「手动输入」，粘贴 LPA:1$ 开头的激活码。'
          },
          {
            title: '设置标签并启用',
            desc: '为 eSIM 命名（如「日本流量」），默认开启该号码的蜂窝数据，建议开启「允许切换蜂窝数据」。'
          },
          {
            title: '到达目的地后开启漫游',
            desc: '到目的地后，在「蜂窝数据 → 网络选择」中关闭「自动」，手动选择当地运营商，即可高速上网。',
            tips: ['双卡用户建议将默认语音号码设为国内 SIM 卡，避免意外扣费']
          }
        ]
      } else {
        this.steps = [
          {
            title: '购买套餐并获取激活码',
            desc: '在首页选择目的地与套餐，完成支付后，激活码会自动发放到「我的 eSIM」页面。'
          },
          {
            title: '打开系统设置',
            desc: '进入「设置 → 移动网络 / 双卡与移动网络 → SIM 卡管理（或 eSIM 管理）」，点击「添加 eSIM / 添加已下载的 eSIM」。'
          },
          {
            title: '扫描二维码或输入激活码',
            desc: '选择「扫描运营商提供的二维码」，「我的 eSIM」页面的二维码即为运营商二维码；部分机型需在「设置 → 连接 → SIM 卡管理器」中手动添加。'
          },
          {
            title: '完成安装并设为数据卡',
            desc: '安装完成后，将该 eSIM 设为「默认移动数据」卡，双卡用户建议将语音、短信保持在国内 SIM 卡。'
          },
          {
            title: '到达目的地后开启漫游',
            desc: '到目的地后开启「数据漫游」，等待信号自动连接当地网络即可使用。',
            tips: ['若无法上网，可重启手机或手动搜索网络']
          }
        ]
      }
    },
    toggleFaq(i) {
      this.openFaq = this.openFaq === i ? -1 : i
    }
  }
}
</script>

<style lang="scss" scoped>
.guide-page {
  min-height: 100vh;
  background: $bg-page;
}

.guide-hero {
  background: $gradient-brand;
  padding: 56rpx $page-pad 64rpx;
  border-radius: 0 0 40rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gh-title {
  font-size: 42rpx;
  font-weight: 800;
  color: #ffffff;
}

.gh-sub {
  margin-top: 12rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

.guide-body {
  padding: 0 $page-pad;
  margin-top: -24rpx;
  position: relative;
}

.platform-tabs {
  display: flex;
  background: $bg-card;
  border-radius: 999rpx;
  padding: 8rpx;
  box-shadow: $shadow-sm;
}

.pt-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 0;
  border-radius: 999rpx;
  transition: all 0.2s ease;

  &.active {
    background: $gradient-brand;
    box-shadow: $shadow-brand;
  }
}

.pt-emoji {
  font-size: 30rpx;
  margin-right: 10rpx;
}

.pt-txt {
  font-size: 27rpx;
  font-weight: 700;
  color: $ink-2;

  .pt-tab.active & {
    color: #ffffff;
  }
}

.compat-card {
  margin-top: 24rpx;
  background: $sun-light;
  border: 1rpx solid #FDE7BD;
  border-radius: $radius;
  padding: 26rpx 28rpx;
}

.compat-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #B45309;
}

.compat-txt {
  display: block;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #92600A;
  line-height: 1.7;
}

.steps {
  margin-top: 28rpx;
}

.step-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: $shadow-sm;
  position: relative;
}

.step-head {
  display: flex;
  align-items: center;
}

.step-badge {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: $gradient-brand;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  box-shadow: 0 6rpx 16rpx rgba(14, 165, 233, 0.35);
  flex-shrink: 0;
}

.step-title {
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.step-desc {
  display: block;
  margin-top: 18rpx;
  font-size: 25rpx;
  color: $ink-2;
  line-height: 1.7;
}

.step-tips {
  margin-top: 16rpx;
  background: $brand-lighter;
  border-radius: $radius-sm;
  padding: 16rpx 20rpx;
}

.step-tip {
  display: flex;
  align-items: flex-start;
  margin-top: 8rpx;

  &:first-child {
    margin-top: 0;
  }
}

.tip-dot {
  color: $brand;
  font-weight: 700;
  margin-right: 10rpx;
}

.tip-txt {
  flex: 1;
  font-size: 22rpx;
  color: $brand-deep;
  line-height: 1.6;
}

.faq-card {
  margin-top: 32rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx;
  box-shadow: $shadow-sm;
}

.faq-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.faq-item {
  border-bottom: 1rpx solid $line;
  padding: 24rpx 0;

  &:last-child {
    border-bottom: none;
  }
}

.faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.faq-q-txt {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: $ink;
}

.faq-arrow {
  font-size: 30rpx;
  color: $ink-3;
  margin-left: 16rpx;
}

.faq-a {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.7;
}

.footer-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
