<template>
  <view class="countries-page">
    <view class="search-wrap">
      <view class="search-input-wrap">
        <image class="search-icon" src="/static/icons/search-icon.png" mode="aspectFit" />
        <input
          v-model="keyword"
          class="search-input"
          :placeholder="fmt('countries.searchPlaceholder')"
          confirm-type="search"
          @input="onInput"
        />
        <text v-if="keyword" class="clear-btn" @click="clear">×</text>
      </view>
    </view>

    <view class="cat-tabs">
      <scroll-view scroll-x class="cat-scroll" :show-scrollbar="false">
        <view
          v-for="cat in cats"
          :key="cat.key"
          class="cat-tab"
          :class="{ active: activeCat === cat.key }"
          @click="switchCat(cat.key)"
        >
          {{ fmt(cat.labelKey) }}
        </view>
      </scroll-view>
    </view>

    <scroll-view scroll-y class="country-list" :show-scrollbar="false">
      <view v-if="activeCat === '' && !keyword" class="region-block">
        <view class="block-title"><image src="/static/icons/region-global.png" mode="aspectFit" style="width: 28rpx; height: 28rpx; margin-right: 8rpx; vertical-align: middle;" /> {{ fmt('countries.multiRegion') }}</view>
        <CountryCell v-for="r in regions" :key="r.code" :country="r" @tap="goPackages" />
        <view class="block-title">{{ fmt('countries.nationalRegions') }}</view>
      </view>

      <CountryCell v-for="c in filtered" :key="c.code" :country="c" @tap="goPackages" />

      <view v-if="!filtered.length" class="empty">
        <image class="empty-emoji" src="/static/icons/region-global.png" mode="aspectFit" />
        <text class="empty-txt">{{ fmt('countries.empty', { kw: keyword }) }}</text>
      </view>

      <view class="list-safe"></view>
    </scroll-view>
  </view>
</template>

<script>
import CountryCell from '@/components/CountryCell.vue'
import { api } from '@/utils/api'
import { setNavTitle, t as translate } from '@/locales'

// 命名占位符兜底替换（如 {kw}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  components: { CountryCell },
  data() {
    return {
      keyword: '',
      activeCat: '',
      cats: [
        { key: '', labelKey: 'countries.catAll' },
        { key: '亚洲', labelKey: 'countries.catAsia' },
        { key: '欧洲', labelKey: 'countries.catEurope' },
        { key: '美洲', labelKey: 'countries.catAmericas' },
        { key: '大洋洲', labelKey: 'countries.catOceania' },
        { key: '非洲', labelKey: 'countries.catAfrica' },
        { key: '中东', labelKey: 'countries.catMiddleEast' }
      ],
      all: [],
      regions: [],
      filtered: []
    }
  },
  onShow() {
    setNavTitle('pageTitle.countries')
    this.loadCountries()
  },
  methods: {
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    async loadCountries() {
      uni.showLoading({ title: this.fmt('common.loading'), mask: true })
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
    switchCat(key) {
      this.activeCat = key
      const kw = this.keyword.trim().toLowerCase()
      let list = this.all
      if (key !== '') list = list.filter((c) => c.cat === key)
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
