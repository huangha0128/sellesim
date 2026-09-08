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
      if (!this.text) {
        console.warn('[EsimQr] text 为空，跳过绘制')
        return
      }
      console.log('[EsimQr] 开始绘制，text长度=' + this.text.length, 'canvasId=' + this.canvasId)
      let qr
      try {
        qr = qrcode(0, 'M')
        qr.addData(this.text)
        qr.make()
      } catch (e) {
        console.error('[EsimQr] 生成二维码矩阵失败', e)
        return
      }
      const moduleCount = qr.getModuleCount()
      const cell = Math.floor(this.size / (moduleCount + 8))
      // 居中：按实际内容尺寸计算偏移，而非固定 4 格留白
      const offset = Math.floor((this.size - moduleCount * cell) / 2)

      const draw = (node) => {
        try {
          const ctx = node.getContext('2d')
          // 支付宝 2d canvas 需显式设置物理像素尺寸并按 DPR 缩放，否则位图为默认值/0，绘制内容不可见
          const dpr = uni.getSystemInfoSync().pixelRatio || 1
          node.width = this.size * dpr
          node.height = this.size * dpr
          ctx.scale(dpr, dpr)
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, this.size, this.size)
          ctx.fillStyle = '#16252E'
          for (let r = 0; r < moduleCount; r++) {
            for (let c = 0; c < moduleCount; c++) {
              if (qr.isDark(r, c)) {
                ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell)
              }
            }
          }
          console.log('[EsimQr] 绘制完成')
        } catch (e) {
          console.error('[EsimQr] 绘制二维码失败', e)
        }
      }

      const extractNode = (res, tag) => {
        // res 可能为 node、{node}、[node]、[{node}] 等不同形态，逐一兼容
        if (!res) {
          console.warn('[EsimQr] ' + tag + ' 查询结果为空')
          return null
        }
        let target = Array.isArray(res) ? res[0] : res
        if (!target) {
          console.warn('[EsimQr] ' + tag + ' 查询结果首项为空')
          return null
        }
        const node = target.node || target
        if (!node || typeof node.getContext !== 'function') {
          console.warn('[EsimQr] ' + tag + ' 未获得可用节点', JSON.stringify(target))
          return null
        }
        return node
      }

      const queryInComponent = (fallback) => {
        // 支付宝自定义组件内部须用 .in(组件实例) 作用域查询
        const scope = this.$scope
        if (!scope) {
          console.warn('[EsimQr] 未获取到组件实例 $scope，尝试页面作用域')
          fallback()
          return
        }
        try {
          uni
            .createSelectorQuery()
            .in(scope)
            .select('#' + this.canvasId)
            .node((res) => {
              const node = extractNode(res, '组件作用域.node')
              if (node) {
                draw(node)
              } else {
                fallback()
              }
            })
            .exec()
        } catch (e) {
          console.error('[EsimQr] 组件作用域 node 查询异常，尝试 fields', e)
          fallback()
        }
      }

      const queryInComponentFields = (fallback) => {
        try {
          uni
            .createSelectorQuery()
            .in(this.$scope)
            .select('#' + this.canvasId)
            .fields({ node: true, size: true }, () => {})
            .exec((res) => {
              const node = extractNode(res, '组件作用域.fields')
              if (node) {
                draw(node)
              } else {
                fallback()
              }
            })
        } catch (e) {
          console.error('[EsimQr] 组件作用域 fields 查询异常，尝试页面作用域', e)
          fallback()
        }
      }

      const queryInPage = () => {
        try {
          uni
            .createSelectorQuery()
            .select('#' + this.canvasId)
            .fields({ node: true, size: true }, () => {})
            .exec((res) => {
              const node = extractNode(res, '页面作用域.fields')
              if (node) {
                draw(node)
              } else {
                console.error('[EsimQr] 所有查询策略均未找到 canvas 节点')
              }
            })
        } catch (e) {
          console.error('[EsimQr] 页面作用域查询异常', e)
        }
      }

      // 依次尝试：组件作用域 node -> 组件作用域 fields -> 页面作用域 fields
      queryInComponent(() => queryInComponentFields(queryInPage))
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
