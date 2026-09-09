<template>
  <view class="checkout-page">
    <template v-if="pkg">
      <!-- 浅色商品摘要 Hero（首页同款视觉语言：眉题 → 大标题 → 白色 chip） -->
      <view class="checkout-hero">
        <view class="hero-top">
          <view class="hero-main">
            <text class="hero-overline">{{ fmt('checkout.eyebrow') }}</text>
            <text class="hero-title">{{ fmt('checkout.skuName', { name: pkg.countryName }) }}</text>
            <text class="hero-meta">{{ fmt('checkout.sumMeta', { label: dataLabel, days, network: pkg.network }) }}</text>
          </view>
          <view class="hero-flag-card">
            <image class="hero-flag-img" :src="getFlagImage(pkg.countryCode)" mode="aspectFit" />
          </view>
        </view>
        <view class="hero-bottom">
          <view class="hero-chip">
            <text class="chip-text">{{ fmt('checkout.instantChip') }}</text>
          </view>
          <view class="hero-price">
            <text class="price-sym">{{ sym }}</text>
            <text class="price-num">{{ priceNum }}</text>
          </view>
        </view>
      </view>

      <view class="checkout-body">
      <view class="section-card card--overlap">
        <view class="form-item">
          <text class="form-label">{{ fmt('checkout.emailLabel') }}</text>
          <input
            v-model="email"
            class="form-input"
            :placeholder="fmt('checkout.emailPlaceholder')"
            type="text"
          />
        </view>
        <view class="form-tip">
          <image src="/static/icons/co-info.png" mode="aspectFit" style="width: 28rpx; height: 28rpx; margin-right: 8rpx; vertical-align: middle;" />
          <text>{{ fmt('checkout.emailTip') }}</text>
        </view>
      </view>

      <view class="section-card">
        <view class="order-head">
          <text class="order-title">{{ fmt('checkout.buyMode') }}</text>
        </view>

        <!-- 新购 -->
        <view
          class="bm-item"
          :class="{ active: buyMode === 'new' }"
          @tap="selectBuyMode('new')"
        >
          <view class="bm-logo">新</view>
          <view class="bm-info">
            <text class="bm-name">{{ fmt('checkout.buyNew') }}</text>
            <text class="bm-desc">{{ fmt('checkout.buyNewDesc') }}</text>
          </view>
          <view class="bm-check" :class="{ checked: buyMode === 'new' }">
            <image v-if="buyMode === 'new'" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
          </view>
        </view>

        <!-- 加购到已过期 eSIM -->
        <view
          class="bm-item"
          :class="{ active: buyMode === 'renew' }"
          @tap="selectBuyMode('renew')"
        >
          <view class="bm-logo renew-logo">充</view>
          <view class="bm-info">
            <text class="bm-name">{{ fmt('checkout.buyAdd') }}</text>
            <text class="bm-desc">{{ fmt('checkout.buyAddDesc') }}</text>
          </view>
          <view class="bm-check" :class="{ checked: buyMode === 'renew' }">
            <image v-if="buyMode === 'renew'" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
          </view>
        </view>

        <!-- 已选择加购目标卡 -->
        <view v-if="buyMode === 'renew'" class="bm-target">
          <!-- 已选卡：点左侧信息可重新选择（原生 picker），右侧清除 -->
          <template v-if="selectedEsim">
            <picker
              class="bm-target-picker"
              mode="selector"
              :range="pickerRange"
              range-key="label"
              @change="onPickEsim"
            >
              <view class="bm-target-left">
                <text class="bm-target-label">{{ fmt('checkout.buyAddTo') }}</text>
                <text class="bm-target-name">{{ selectedEsim.pkg.countryName }}</text>
                <text class="bm-target-spec">{{ selectedEsim.pkg.isUnlimited ? fmt('package.unlimited') : selectedEsim.pkg.gb + 'GB' }} · {{ selectedEsim.pkg.days }}{{ fmt('checkout.buyDayUnit') }} · {{ fmt('checkout.buyExpire', { date: formatDate(selectedEsim.expireAt) }) }}</text>
              </view>
            </picker>
            <view class="bm-clear" @tap.stop="selectEsim('')">{{ fmt('checkout.buyClear') }}</view>
          </template>
          <!-- 未选卡：整个区域用原生 picker 弹出可选卡列表 -->
          <template v-else>
            <picker
              class="bm-target-picker"
              mode="selector"
              :range="pickerRange"
              range-key="label"
              :disabled="!expiredEsims.length"
              @change="onPickEsim"
            >
              <view class="bm-target-left">
                <text class="bm-target-empty">{{ expiredEsims.length ? fmt('checkout.buySelectCard') : fmt('checkout.buyAddEmpty') }}</text>
              </view>
              <view v-if="expiredEsims.length" class="bm-target-btn">{{ fmt('checkout.buyChoose') }} ›</view>
            </picker>
          </template>
        </view>
      </view>

      <view class="section-card">
        <view class="order-head">
          <text class="order-title">{{ fmt('checkout.payMethod') }}</text>
        </view>
        <view class="pay-item" :class="{ active: payMethod === 'alipay' }" @tap="payMethod = 'alipay'">
          <view class="pay-logo alipay">支</view>
          <view class="pay-info">
            <text class="pay-name">{{ fmt('checkout.alipayName') }}</text>
            <text class="pay-desc">{{ fmt('checkout.alipayDesc') }}</text>
          </view>
          <view class="pay-check" :class="{ checked: payMethod === 'alipay' }">
            <image v-if="payMethod === 'alipay'" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
          </view>
        </view>
        <view class="pay-item disabled">
          <view class="pay-logo wechat">微</view>
          <view class="pay-info">
            <text class="pay-name">{{ fmt('checkout.wechatName') }}</text>
            <text class="pay-desc">{{ fmt('checkout.wechatDesc') }}</text>
          </view>
          <view class="pay-soon">{{ fmt('checkout.soon') }}</view>
        </view>
      </view>

      <view class="section-card">
        <view class="amount-row">
          <text class="amount-label">{{ fmt('checkout.amountLabel') }}</text>
          <text class="amount-value">{{ sym }}{{ priceNum }}</text>
        </view>
        <view class="amount-row">
          <text class="amount-label">{{ fmt('checkout.discountLabel') }}</text>
          <text class="amount-value free">- {{ sym }}0</text>
        </view>
        <view class="amount-row total">
          <text class="amount-label">{{ fmt('checkout.totalLabel') }}</text>
          <view class="total-price">
            <text class="total-symbol">{{ sym }}</text>
            <text class="total-num">{{ priceNum }}</text>
          </view>
        </view>
      </view>

      <view class="agree-row" @tap="agreed = !agreed">
        <view class="agree-box" :class="{ checked: agreed }">
          <image v-if="agreed" src="/static/icons/co-check.png" mode="aspectFit" class="check-icon" />
        </view>
        <text class="agree-txt">{{ fmt('checkout.agree') }}</text>
      </view>

      <view class="footer-safe"></view>
      </view>
    </template>

    <view v-if="pkg" class="bottom-bar">
      <view class="pay-total">
        <text class="pay-total-label">{{ fmt('checkout.payActual') }}</text>
        <view class="pay-total-price">
          <text class="pts">{{ sym }}</text>
          <text class="ptn">{{ priceNum }}</text>
        </view>
      </view>
      <view
        class="submit-btn"
        :class="{ disabled: !agreed || submitting }"
        hover-class="submit-btn--hover"
        @tap="submit"
      >
        {{ submitting ? fmt('checkout.submitting') : fmt('checkout.submit') }}
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api'
import { store } from '@/store'
import { setNavTitle, t as translate } from '@/locales'
import { currencySymbol, formatDate } from '@/utils/format'

// 命名占位符兜底替换（如 {name}、{label}、{days}、{network}）
function fmtNamed(str, p) {
  return String(str).replace(/\{(\w+)\}/g, (m, k) =>
    p && p[k] !== undefined && p[k] !== null ? p[k] : m
  )
}

export default {
  data() {
    return {
      pkgId: '',
      mode: '',
      esimId: '',
      pkg: null,
      email: '',
      payMethod: 'alipay',
      agreed: true,
      submitting: false,
      // 购买方式：'new' 新购 / 'renew' 加购到已过期 eSIM
      buyMode: 'new',
      renewEsims: [],
      selectedEsimId: '',
      showEsimDrawer: false,
      store
    }
  },
  computed: {
    // 详情页已传入唯一真实套餐，此处直接取套餐字段展示
    dataLabel() {
      if (!this.pkg) return ''
      return this.pkg.isUnlimited ? this.fmt('package.unlimited') : this.fmt('detail.totalGb', { gb: this.pkg.gb })
    },
    days() {
      return this.pkg ? this.pkg.days : 0
    },
    priceNum() {
      // pkgId 已精确对应所选天数×流量，直接展示该套餐真实价格
      if (!this.pkg) return '0.00'
      const price = this.pkg.price
      return Number(price).toFixed(2)
    },
    sym() {
      return currencySymbol(this.pkg ? this.pkg.currency : 'CNY')
    },
    expiredEsims() {
      // 仅已激活且已过期的卡可作为加购目标，与后端 expireAt<now 校验一致
      return this.renewEsims.filter(
        e => e.status === 'activated' && new Date(e.expireAt) < new Date()
      )
    },
    selectedEsim() {
      return this.renewEsims.find(e => e.id === this.selectedEsimId) || null
    },
    pickerRange() {
      return this.expiredEsims.map(e => ({
        label: `${e.pkg.countryName} · ${e.pkg.isUnlimited ? this.fmt('package.unlimited') : e.pkg.gb + 'GB'} · ${e.pkg.days}${this.fmt('checkout.buyDayUnit')} · ${this.fmt('checkout.buyExpire', { date: formatDate(e.expireAt) })}`
      }))
    }
  },
  onLoad(options) {
    this.pkgId = options.pkgId || ''
    this.mode = options.mode || ''
    this.esimId = options.esimId || ''
    // 自动填充账号邮箱（「我的 → 我的邮箱地址」中设置的）
    this.email = (store.isLoggedIn && store.user.email) || ''
    setNavTitle('pageTitle.checkout')
    this.load()
    this.loadReneEsims()
  },
  methods: {
    fmt(key, params) {
      return fmtNamed(translate(key, params), params)
    },
    getFlagImage(code) {
      return `/static/icons/flag-${code.toLowerCase()}.png`
    },
    async load() {
      uni.showLoading({ title: this.fmt('common.loading'), mask: true })
      try {
        const res = await api.getPackageDetail(this.pkgId)
        this.pkg = res.data.pkg
      } finally {
        uni.hideLoading()
      }
    },
    async loadReneEsims() {
      if (!store.isLoggedIn) return
      try {
        const res = await api.getMyEsims()
        const all = res.data.esims || []
        this.renewEsims = all.filter(
          e => e.status === 'activated' && new Date(e.expireAt) < new Date()
        )
        // 诊断：确认前端拿到的卡数量与过滤结果
        console.log('[checkout] esims total=', all.length, 'expired=', this.renewEsims.length, all.map(e => ({ s: e.status, exp: e.expireAt })))
        // 预选：从 eSIM 详情页续费进入时（onLoad 已带 mode=renew&esimId）
        if (this.mode === 'renew' && this.esimId) {
          if (this.renewEsims.some(e => e.id === this.esimId)) {
            this.buyMode = 'renew'
            this.selectedEsimId = this.esimId
          } else {
            // 预选卡不可续费（不在过期列表）→ 清空转新购并提示
            this.buyMode = 'new'
            this.selectedEsimId = ''
            uni.showToast({ title: this.fmt('checkout.buyPreselectGone'), icon: 'none' })
          }
        }
      } catch (e) {
        console.error('[checkout] 加载我的 eSIM 失败：', e)
      }
    },
    selectBuyMode(m) {
      this.buyMode = m
      if (m === 'new') this.selectedEsimId = ''
    },
    onPickEsim(e) {
      const idx = Number(e.detail.value)
      const target = this.expiredEsims[idx]
      if (target) this.selectedEsimId = target.id
    },
    selectEsim(id) {
      this.selectedEsimId = id
      this.closeEsimDrawer()
    },
    openEsimDrawer() {
      console.log('[checkout] openEsimDrawer expired=', this.expiredEsims.length)
      // 无可选加购卡时给出明确提示，避免点了没反应
      if (!this.expiredEsims.length) {
        uni.showToast({ title: this.fmt('checkout.buyAddEmpty'), icon: 'none' })
        return
      }
      this.showEsimDrawer = true
    },
    closeEsimDrawer() {
      this.showEsimDrawer = false
    },
    async submit() {
      if (!this.agreed) {
        uni.showToast({ title: this.fmt('checkout.agreeFirst'), icon: 'none' })
        return
      }
      if (!this.email || !this.email.includes('@')) {
        uni.showToast({ title: this.fmt('checkout.emailInvalid'), icon: 'none' })
        return
      }
      // 加购必须已选目标卡，否则不予提交
      if (this.buyMode === 'renew' && !this.selectedEsimId) {
        uni.showToast({ title: this.fmt('checkout.buySelectCard'), icon: 'none' })
        return
      }
      // 下单前强制登录，确保订单归属当前账号
      if (!store.isLoggedIn) {
        uni.showToast({ title: this.fmt('checkout.needLogin'), icon: 'none' })
        const redirect = `/pages/checkout/checkout?pkgId=${this.pkgId}`
        uni.navigateTo({
          url: `/pages/login/login?redirect=${encodeURIComponent(redirect)}`,
        })
        return
      }
      this.submitting = true
      try {
        const res = await api.createOrder({
          pkgId: this.pkgId,
          email: this.email,
          payMethod: this.payMethod,
          orderType: this.buyMode === 'renew' ? 'renew' : 'new',
          targetEsimId: this.buyMode === 'renew' ? this.selectedEsimId : undefined
        })
        if (res.code === 0) {
          const order = {
            ...res.data.order,
            countryName: this.pkg.countryName,
            dataLabel: this.dataLabel,
            days: this.pkg.days,
            flag: this.pkg.flag,
          }
          store.pushOrder(order)
          uni.navigateTo({ url: `/pages/payment/payment?orderNo=${res.data.order.orderNo}` })
        } else {
          uni.showToast({ title: res.message || this.fmt('checkout.orderFailed'), icon: 'none' })
          this.submitting = false
        }
      } catch (e) {
        this.submitting = false
        uni.showToast({ title: this.fmt('common.networkError'), icon: 'none' })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.checkout-page {
  min-height: 100vh;
  background: $bg-page;
}

.checkout-body {
  padding: 0 $page-pad;
  padding-bottom: 40rpx;
}

/* ============ 浅色商品摘要 Hero（首页同款：浅蓝紫渐变 + 编辑排版） ============ */
.checkout-hero {
  background: $gradient-canvas;
  padding: 40rpx $page-pad 100rpx;
  border-radius: 0 0 48rpx 48rpx;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hero-main {
  flex: 1;
  min-width: 0;
  padding-right: 24rpx;
}

/* 眉题：品牌蓝小字，字距拉开 */
.hero-overline {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: $brand;
  letter-spacing: 8rpx;
  margin-bottom: 16rpx;
}

/* 主标题：深墨色大字 */
.hero-title {
  display: block;
  font-size: 48rpx;
  font-weight: 800;
  color: $brand;
  background-image: $gradient-text;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.24;
  letter-spacing: 1rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 副标语：规格信息 */
.hero-meta {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $ink-3;
}

/* 国旗卡：白色浮雕小卡 */
.hero-flag-card {
  width: 144rpx;
  height: 144rpx;
  border-radius: 36rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 32rpx rgba(64, 80, 192, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.hero-flag-img {
  width: 100rpx;
  height: 100rpx;
}

/* 底部行：特性 chip + 价格 */
.hero-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 28rpx;
}

.hero-chip {
  display: flex;
  align-items: center;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(64, 80, 192, 0.08);
}

.chip-text {
  font-size: 22rpx;
  font-weight: 600;
  color: $ink-2;
}

.hero-price {
  display: flex;
  align-items: baseline;
}

.price-sym {
  font-size: 26rpx;
  font-weight: 600;
  color: $ink-2;
  margin-right: 4rpx;
}

.price-num {
  font-size: 44rpx;
  font-weight: 800;
  color: $ink;
  line-height: 1;
}

.section-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 30rpx 32rpx;
  margin-top: 24rpx;
  box-shadow: $shadow-sm;
}

/* 首张卡片上浮叠压 Hero 底部 */
.card--overlap {
  margin-top: -48rpx;
  position: relative;
  z-index: 2;
}

.order-head {
  margin-bottom: 24rpx;
}

.order-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.form-item {
  display: flex;
  align-items: center;
}

.form-label {
  font-size: 27rpx;
  color: $ink;
  font-weight: 600;
  width: 150rpx;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  height: 76rpx;
  background: $bg-soft;
  border-radius: $radius-sm;
  padding: 0 24rpx;
  font-size: 26rpx;
  color: $ink;
}

.form-tip {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.pay-item {
  display: flex;
  align-items: center;
  border: 2rpx solid $line;
  border-radius: $radius;
  padding: 24rpx;
  margin-bottom: 20rpx;
  transition: all 0.2s ease;

  &.active {
    border-color: $brand;
    background: $brand-lighter;
  }

  &.disabled {
    opacity: 0.55;
  }
}

.pay-logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 800;
  flex-shrink: 0;

  &.alipay {
    background: $alipay;
  }

  &.wechat {
    background: $wechat;
  }
}

.pay-info {
  flex: 1;
  margin-left: 22rpx;
  display: flex;
  flex-direction: column;
}

.pay-name {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}

.pay-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}

.pay-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &.checked {
    background: $brand;
    border-color: $brand;
  }
}

.check-icon {
  width: 24rpx;
  height: 24rpx;
}

.pay-soon {
  font-size: 22rpx;
  color: $ink-3;
  background: $bg-soft;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
}

/* ========== 购买方式（新购 / 加购到已过期 eSIM） ========== */
.bm-item {
  display: flex;
  align-items: center;
  border: 2rpx solid $line;
  border-radius: $radius;
  padding: 24rpx;
  margin-bottom: 20rpx;
  transition: all 0.2s ease;

  &.active {
    border-color: $brand;
    background: $brand-lighter;
  }
}

.bm-logo {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 800;
  flex-shrink: 0;
  background: $brand;

  &.renew-logo {
    background: $coral;
  }
}

.bm-info {
  flex: 1;
  margin-left: 22rpx;
  display: flex;
  flex-direction: column;
}

.bm-name {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink;
}

.bm-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}

.bm-check {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &.checked {
    background: $brand;
    border-color: $brand;
  }
}

.bm-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-soft;
  border-radius: $radius-sm;
  padding: 20rpx 24rpx;
  margin-top: 8rpx;
}

.bm-target-picker {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.bm-target-left {
  flex: 1;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  min-width: 0;
}

.bm-target-label {
  font-size: 22rpx;
  color: $brand;
  font-weight: 600;
  margin-right: 12rpx;
}

.bm-target-name {
  font-size: 26rpx;
  color: $ink;
  font-weight: 700;
}

.bm-target-spec {
  font-size: 21rpx;
  color: $ink-3;
  margin-left: 14rpx;
  white-space: nowrap;
}

.bm-target-empty {
  font-size: 24rpx;
  color: $ink-3;
}

.bm-target-btn {
  font-size: 24rpx;
  color: $brand;
  font-weight: 700;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.bm-clear {
  font-size: 22rpx;
  color: $ink-3;
  padding: 6rpx 18rpx;
  background: #ffffff;
  border-radius: 999rpx;
  margin-left: 16rpx;
  flex-shrink: 0;
}

/* 加购目标卡选择抽屉 */
.drawer-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.drawer-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 75vh;
  background: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid $line;
}

.drawer-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
}

.drawer-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: $ink-3;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 40rpx;
  padding-bottom: 40rpx;
}

.drawer-empty {
  padding: 60rpx 0;
  text-align: center;
}

.drawer-empty-text {
  font-size: 26rpx;
  color: $ink-3;
}

.drawer-item {
  display: flex;
  align-items: center;
  padding: 26rpx 0;
  border-bottom: 1rpx solid $line;

  &.active {
    background: $brand-lighter;
    margin: 0 -40rpx;
    padding-left: 40rpx;
    padding-right: 40rpx;
    border-radius: 12rpx;
    border-bottom: none;
  }
}

.drawer-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.drawer-item-name {
  font-size: 27rpx;
  color: $ink;
  font-weight: 600;
  margin-bottom: 6rpx;
}

.drawer-item-spec {
  font-size: 21rpx;
  color: $ink-3;
}

.drawer-item-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: $brand;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;

  &.total {
    border-top: 1rpx solid $line;
    margin-top: 10rpx;
    padding-top: 26rpx;
  }
}

.amount-label {
  font-size: 26rpx;
  color: $ink-2;
}

.amount-value {
  font-size: 26rpx;
  color: $ink;
  font-weight: 600;

  &.free {
    color: $teal;
  }
}

.total-price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 800;
}

.total-symbol {
  font-size: 26rpx;
}

.total-num {
  font-size: 44rpx;
  line-height: 1;
}

.agree-row {
  display: flex;
  align-items: flex-start;
  margin-top: 28rpx;
  padding: 0 8rpx;
}

.agree-box {
  width: 40rpx;
  height: 40rpx;
  border-radius: 10rpx;
  border: 2rpx solid $line;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
  transition: all 0.2s ease;

  &.checked {
    background: $brand;
    border-color: $brand;
  }
}

.agree-txt {
  flex: 1;
  font-size: 22rpx;
  color: $ink-3;
  line-height: 1.6;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  display: flex;
  align-items: center;
  padding: 20rpx $page-pad;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -6rpx 24rpx rgba(10, 67, 104, 0.08);
  z-index: 10;
}

.pay-total {
  flex: 1;
  display: flex;
  align-items: baseline;
}

.pay-total-label {
  font-size: 26rpx;
  color: $ink-2;
  margin-right: 12rpx;
}

.pay-total-price {
  display: flex;
  align-items: baseline;
  color: $coral;
  font-weight: 800;
}

.pts {
  font-size: 26rpx;
}

.ptn {
  font-size: 50rpx;
  line-height: 1;
}

.submit-btn {
  background: $gradient-brand;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
  padding: 26rpx 64rpx;
  border-radius: 999rpx;
  box-shadow: $shadow-brand;
  transition: all 0.15s ease;

  &.disabled {
    opacity: 0.5;
    box-shadow: none;
  }

  &--hover {
    transform: scale(0.97);
  }
}

.footer-safe {
  height: 200rpx;
}
</style>
