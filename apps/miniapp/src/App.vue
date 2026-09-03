<script>
import { applyAppLocale } from './locales'

export default {
  globalData: {
    // 跨页面传递当前选中的订单，避免依赖 navigateTo query 传参
    ticketOrder: null
  },
  onLaunch() {
    console.log('YYeSim App Launch')
    applyAppLocale()
  }
}
</script>

<style lang="scss">
page {
  background-color: $bg-page;
  color: $ink;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
}

view,
text,
image,
scroll-view,
input,
button {
  box-sizing: border-box;
}
</style>
