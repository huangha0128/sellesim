<template>
  <view class="countries-page">
    <view class="search-wrap">
      <view class="search-input-wrap">
        <image class="search-icon" src="/static/icons/search-icon.png" mode="aspectFit" />
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索国家/地区，如 日本 / Japan"
          confirm-type="search"
          @input="onInput"
        />
        <text v-if="keyword" class="clear-btn" @click="clear">×</text>
      </view>
    </view>

    <view class="cat-tabs">
      <scroll-view scroll-x class="cat-scroll" :show-scrollbar="false">
        <view
          v-for="tab in tabs"
          :key="tab"
          class="cat-tab"
          :class="{ active: activeCat === tab }"
          @click="switchCat(tab)"
        >
          {{ tab }}
        </view>
      </scroll-view>
    </view>

    <scroll-view scroll-y class="country-list" :show-scrollbar="false">
      <view v-if="activeCat === '全部' && !keyword" class="region-block">
        <view class="block-title"><image src="/static/icons/region-global.png" mode="aspectFit" style="width: 28rpx; height: 28rpx; margin-right: 8rpx; vertical-align: middle;" /> 多国通用套餐</view>
        <CountryCell v-for="r in regions" :key="r.code" :country="r" @tap="goPackages" />
        <view class="block-title">国家与地区</view>
      </view>

      <CountryCell v-for="c in filtered" :key="c.code" :country="c" @tap="goPackages" />

      <view v-if="!filtered.length" class="empty">
        <image class="empty-emoji" src="/static/icons/region-global.png" mode="aspectFit" />
        <text class="empty-txt">没有找到「{{ keyword }}」，换个关键词试试</text>
      </view>

      <view class="list-safe"></view>
    </scroll-view>
  </view>
</template>

<script>
import CountryCell from '@/components/CountryCell.vue'
import { api } from '@/utils/api'

export default {
  components: { CountryCell },
  data() {
    return {
      keyword: '',
      activeCat: '全部',
      tabs: ['全部', '亚洲', '欧洲', '美洲', '大洋洲', '非洲', '中东'],
      all: [],
      regions: [],
      filtered: []
    }
  },
  onShow() {
    this.loadCountries()
  },
  methods: {
    async loadCountries() {
      uni.showLoading({ title: '加载中', mask: true })
      try {
        const res = await api.getCountries()
        const countries = res.data.countries || []
        this.regions = countries.filter((c) => c.cat === '全球')
        this.all = countries.filter((c) => c.cat !== '全球')
        if (this.keyword) {
          this.filtered = this.all.filter(
            (c) => c.name.includes(this.keyword) || c.en.toLowerCase().includes(this.keyword.toLowerCase()) || c.code.toLowerCase() === this.keyword.toLowerCase()
          )
        } else {
          this.switchCat(this.activeCat)
        }
      } finally {
        uni.hideLoading()
      }
    },
    onInput() {
      clearTimeout(this._t)
      this._t = setTimeout(() => this.switchCat(this.activeCat), 260)
    },
    switchCat(tab) {
      this.activeCat = tab
      const kw = this.keyword.trim().toLowerCase()
      let list = this.all
      if (tab !== '全部') list = list.filter((c) => c.cat === tab)
      if (kw) {
        list = list.filter(
          (c) =>
            c.name.includes(kw) ||
            c.en.toLowerCase().includes(kw) ||
            c.pinyin.includes(kw) ||
            c.code.toLowerCase() === kw
        )
      }
      this.filtered = list
    },
    clear() {
      this.keyword = ''
      this.switchCat(this.activeCat)
    },
    goPackages(country) {
      uni.navigateTo({ url: `/pages/packages/packages?code=${country.code}` })
    }
  }
}
</script>

<style lang="scss" scoped>
.countries-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

.search-wrap {
  padding: 20rpx $page-pad 8rpx;
  background: $bg-page;
}

.search-input-wrap {
  height: 84rpx;
  background: $bg-card;
  border-radius: 42rpx;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  box-shadow: $shadow-sm;
}

.search-icon {
  width: 30rpx;
  height: 30rpx;
  color: $brand;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: 27rpx;
  color: $ink;
}

.clear-btn {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $bg-soft;
  color: $ink-3;
  font-size: 30rpx;
  text-align: center;
  line-height: 36rpx;
}

.cat-tabs {
  padding: 16rpx 0 8rpx;
}

.cat-scroll {
  white-space: nowrap;
  padding: 0 $page-pad;
}

.cat-tab {
  display: inline-flex;
  padding: 12rpx 30rpx;
  margin-right: 16rpx;
  border-radius: 999rpx;
  background: $bg-card;
  color: $ink-2;
  font-size: 25rpx;
  font-weight: 600;
  border: 1rpx solid $line;
  transition: all 0.2s ease;

  &.active {
    background: $brand;
    color: #ffffff;
    border-color: $brand;
    box-shadow: $shadow-brand;
  }
}

.country-list {
  flex: 1;
  padding: 16rpx $page-pad 0;
  height: 0;
}

.region-block {
  margin-bottom: 8rpx;
}

.block-title {
  font-size: 26rpx;
  font-weight: 700;
  color: $ink-2;
  margin: 8rpx 0 20rpx;
  padding-left: 8rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 140rpx;
}

.empty-emoji {
  width: 90rpx;
  height: 90rpx;
}

.empty-txt {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: $ink-3;
}

.list-safe {
  height: calc(40rpx + env(safe-area-inset-bottom));
}
</style>
