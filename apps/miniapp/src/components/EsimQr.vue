<template>
  <view class="qr-wrap" :style="{ width: size + 'px', height: size + 'px' }">
    <canvas
      :id="canvasId"
      :canvas-id="canvasId"
      class="qr-canvas"
      :style="{ width: size + 'px', height: size + 'px' }"
    ></canvas>
  </view>
</template>

<script>
import qrcode from '@/utils/qrcode'

export default {
  name: 'EsimQr',
  props: {
    text: { type: String, required: true },
    size: { type: Number, default: 240 }
  },
  data() {
    return {
      canvasId: 'qr-' + Math.random().toString(36).slice(2, 9)
    }
  },
  mounted() {
    this.$nextTick(() => this.render())
  },
  watch: {
    text() {
      this.$nextTick(() => this.render())
    }
  },
  methods: {
    render() {
      if (!this.text) return
      const qr = qrcode(0, 'M')
      qr.addData(this.text)
      qr.make()
      const moduleCount = qr.getModuleCount()
      const cell = Math.floor(this.size / (moduleCount + 8))
      const offset = cell * 4
      const ctx = uni.createCanvasContext(this.canvasId, this)
      ctx.setFillStyle('#FFFFFF')
      ctx.fillRect(0, 0, this.size, this.size)
      ctx.setFillStyle('#0F2A43')
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell)
          }
        }
      }
      ctx.draw()
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
