<template>
  <view class="qr-wrap" :style="{ width: size + 'px', height: size + 'px' }">
    <canvas
      :id="canvasId"
      type="2d"
      class="qr-canvas"
      :style="{ width: size + 'px', height: size + 'px' }"
    ></canvas>
  </view>
</template>

<script>
import { getCurrentInstance } from 'vue'
import qrcode from '@/utils/qrcode'

export default {
  name: 'EsimQr',
  props: {
    text: { type: String, required: true },
    size: { type: Number, default: 240 }
  },
  data() {
    return {
      canvasId: 'qr-' + Math.random().toString(36).slice(2, 9),
      component: null
    }
  },
  mounted() {
    // 组件实例需在生命周期内获取，方法调用时 getCurrentInstance 不可用
    this.component = getCurrentInstance()?.proxy
    this.$nextTick(() => this.render())
  },
  watch: {
    text() {
      this.$nextTick(() => this.render())
    }
  },
  methods: {
    render() {
      if (!this.text) {
        console.warn('[EsimQr] text 为空，跳过绘制')
        return
      }
      console.log('[EsimQr] 开始绘制，text长度=' + this.text.length, 'canvasId=' + this.canvasId)
      const qr = qrcode(0, 'M')
      qr.addData(this.text)
      qr.make()
      const moduleCount = qr.getModuleCount()
      const cell = Math.floor(this.size / (moduleCount + 8))
      const offset = cell * 4
      let settled = false
      const timeout = setTimeout(() => {
        if (!settled) console.warn('[EsimQr] 获取画布上下文超时（可能挂起）')
      }, 2000)
      uni.createCanvasContextAsync({ id: this.canvasId, component: this.component })
        .then((ctx) => {
          settled = true
          clearTimeout(timeout)
          console.log('[EsimQr] 画布上下文获取成功')
          const canvas = ctx.getContext('2d')
          // 关键：显式设置画布物理像素尺寸并缩放，否则 2d canvas 位图尺寸为默认值/0，
          // 绘制内容不可见（表现为只有 CSS 背景的白色方块）
          const dpr = uni.getSystemInfoSync().pixelRatio || 1
          if (canvas.canvas) {
            canvas.canvas.width = this.size * dpr
            canvas.canvas.height = this.size * dpr
            canvas.scale(dpr, dpr)
          } else {
            console.warn('[EsimQr] context.canvas 不可用，画布尺寸未设置')
          }
          canvas.fillStyle = '#FFFFFF'
          canvas.fillRect(0, 0, this.size, this.size)
          canvas.fillStyle = '#0F2A43'
          for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
              if (qr.isDark(r, c)) {
                canvas.fillRect(offset + c * cell, offset + r * cell, cell, cell)
              }
            }
          }
          console.log('[EsimQr] 绘制完成')
        })
        .catch((e) => {
          settled = true
          clearTimeout(timeout)
          console.error('[EsimQr] 绘制二维码失败', e)
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.qr-wrap {
  border-radius: 20rpx;
  overflow: hidden;
  background: #ffffff;
}

.qr-canvas {
  display: block;
}
</style>
