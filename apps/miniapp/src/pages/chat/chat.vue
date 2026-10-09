<template>
  <view class="chat-page">
    <!-- 状态横幅：常显且固定（sticky），不随消息滚动 -->
    <view class="status-banner" :class="{ human: status === 'human' }">
      <text v-if="status === 'closed'">{{ $t('chat.closed') }}</text>
      <text v-else>{{ $t('chat.humanNotice') }}</text>
      <view v-if="status !== 'closed'" class="email-notice">
        <text class="email-prefix">{{ $t('chat.emailNoticePrefix') }}</text>
        <text class="email-addr" @tap="copyEmail">{{ email }}</text>
      </view>
    </view>

    <!-- 新会话快捷入口 -->
    <view v-if="status === 'ai' && !messageCount" class="quick-area">
      <view class="quick-title">{{ $t('chat.quickTitle') }}</view>
      <view class="quick-grid">
        <view class="quick-card" v-for="q in quickActions" :key="q.key" @tap="onQuick(q.prompt)">
          <text class="quick-label">{{ q.label }}</text>
        </view>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view class="msg-list" scroll-y :scroll-into-view="scrollTarget" scroll-with-animation @scroll="onScroll">
      <view class="msg-wrap">
        <!-- 会话开始欢迎语 -->
        <view class="notice-row" v-if="!messages.length">
          <text>{{ $t('chat.aiNotice') }}</text>
        </view>

        <view
          v-for="m in messages"
          :key="m.id"
          class="msg-item"
          :class="m.role === 'user' ? 'mine' : (m.role === 'system' ? 'sys' : 'theirs')"
        >
          <!-- 系统消息：居中提示 -->
          <view v-if="m.role === 'system'" class="sys-banner">{{ systemText(m) }}</view>

          <!-- 用户 / AI / 人工客服气泡 -->
          <template v-else>
            <view v-if="m.role === 'ai' || m.role === 'admin'" class="avatar ai-avatar">
              <image class="avatar-img" src="/static/icons/prof-help.png" mode="aspectFit" />
            </view>
            <view class="bubble" :class="{ 'mine-bubble': m.role === 'user' }">
              <text v-if="m.content">{{ m.content }}</text>
              <view v-if="msgImages(m).length" class="msg-imgs">
                <image
                  v-for="(img, imgIdx) in msgImages(m)"
                  :key="img"
                  class="msg-img"
                  :src="imgUrl(img)"
                  mode="aspectFill"
                  @tap="previewMsgImages(m, imgIdx)"
                />
              </view>
            </view>
          </template>
        </view>

        <!-- AI 思考中 -->
        <view v-if="aiThinking" class="msg-item theirs">
          <view class="avatar ai-avatar">
            <image class="avatar-img" src="/static/icons/prof-help.png" mode="aspectFit" />
          </view>
          <view class="bubble typing">
            <text class="dot" v-for="i in 3" :key="i">·</text>
          </view>
        </view>

        <view id="bottom-anchor" style="height: 8rpx"></view>
      </view>
    </scroll-view>

    <!-- 待发送图片缩略图 -->
    <view v-if="pendingImages.length" class="pending-imgs">
      <view v-for="(p, idx) in pendingImages" :key="p.local" class="pending-img-wrap">
        <image class="pending-img" :src="p.local" mode="aspectFill" @tap="previewPending(idx)" />
        <view class="pending-del" @tap="removePendingImage(idx)">
          <text class="pending-del-x">×</text>
        </view>
      </view>
    </view>

    <!-- 底部输入区 -->
    <view class="input-bar" v-if="status !== 'closed'">
      <view class="attach-btn" :class="{ disabled: picking }" hover-class="attach-btn--hover" @tap="pickImages">
        <image class="attach-icon" :src="plusIcon()" mode="aspectFit" />
      </view>
      <input
        class="chat-input"
        v-model="input"
        :placeholder="status === 'human' ? $t('chat.transferredTip') : $t('chat.placeholder')"
        :disabled="aiThinking || picking"
        confirm-type="send"
        @confirm="send"
        @input="onInput"
        cursor-spacing="24"
      />
      <view class="send-btn" :class="{ disabled: !canSend }" @tap="send">{{ $t('chat.send') }}</view>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { store } from '@/store'
import { api, resolveAssetUrl } from '@/utils/api'
import { setNavTitle } from '@/locales'

// 归一化消息里的图片字段（可能是 JSON 字符串或数组），返回 URL 数组
function normalizeImgs(m) {
  let imgs = m && m.images
  if (typeof imgs === 'string') {
    try {
      imgs = JSON.parse(imgs)
    } catch (e) {
      imgs = []
    }
  }
  return Array.isArray(imgs) ? imgs.filter((x) => typeof x === 'string') : []
}

export default {
  data() {
    return {
      entryId: '',
      sessionId: '',
      status: 'ai',
      messages: [],
      input: '',
      aiThinking: false,
      loading: true,
      wsTask: null, // SocketTask
      wsReconnectTimer: null,
      pollTimer: null, // HTTP 增量轮询（兜底，WS 不稳定时也能收到人工回复）
      wsClosed: true, // 标记是否主动断开
      subscribedId: '', // 当前已在 WS 上订阅的 sessionId，会话切换时用于退订/重订
      globalBound: false, // 是否已降级绑定全局 socket 事件（SocketTask 不可用时）
      // 自动滚动：仅在「用户已滚到底部」时，新消息到达才自动滚到最新，避免打断回看历史
      stickyBottom: true,
      scrollTarget: '', // scroll-into-view 取值变化才会触发滚动，滚动后复位为 ''
      scrollViewH: 0, // msg-list 视口高度，用于判断是否接近底部
      email: 'support@bjyyxx.com',
      pendingImages: [], // 待发送图片 { url, local }
      picking: false, // 正在上传缩略图中
      chatImgMax: 9 // 单条消息最多图片数
    }
  },
  onLoad(options) {
    if (options && options.id) this.entryId = options.id
  },
  computed: {
    canSend() {
      return (
        !this.aiThinking &&
        !this.picking &&
        (String(this.input || '').trim() || this.pendingImages.length) &&
        this.status !== 'closed'
      )
    },
    messageCount() {
      return this.messages.length
    },
    quickActions() {
      return [
        { key: 'orders', label: this.$t('chat.quick.orders'), prompt: this.$t('chat.quickPrompts.orders') },
        { key: 'data', label: this.$t('chat.quick.data'), prompt: this.$t('chat.quickPrompts.data') },
        { key: 'install', label: this.$t('chat.quick.install'), prompt: this.$t('chat.quickPrompts.install') },
        { key: 'faq', label: this.$t('chat.quick.faq'), prompt: this.$t('chat.quickPrompts.faq') }
      ]
    }
  },
  onShow() {
    setNavTitle('pageTitle.chat')
    this.bootstrap()
    this.measureViewport()
  },
  onUnload() {
    this.closeWs()
  },
  onHide() {
    // 页面隐藏不断开，保持实时接收；仅在卸载时断开
  },
  methods: {
    // token 失效（过期或服务端密钥变更）：提示并引导重新登录，登录后回跳本页
    handleTokenExpired() {
      uni.showToast({ title: this.$t('common.needLogin'), icon: 'none' })
      this.loading = false
      uni.navigateTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/chat/chat')
      })
    },
    async bootstrap() {
      if (!store.isLoggedIn) {
        uni.showToast({ title: this.$t('common.needLogin'), icon: 'none' })
        uni.navigateTo({ url: '/pages/login/login' })
        return
      }
      if (this.sessionId) return // 已初始化，保持实时连接

      // 支持从订单/其它页面带 sessionId 进入
      const queryId = this.entryId
      let session = null
      try {
        if (queryId) {
          const res = await api.getChatSession(queryId)
          if (res.code === 401) return this.handleTokenExpired()
          if (res.code === 0) session = res.data.session
        }
        if (!session) {
          const created = await api.createChatSession({})
          if (created.code === 401) return this.handleTokenExpired()
          if (created.code === 0) session = created.data.session
        }
      } catch (e) {
        uni.showToast({ title: this.$t('chat.offlineTip'), icon: 'none' })
        this.loading = false
        return
      }

      if (session) {
        this.sessionId = session.id
        this.status = session.status
        this.loading = false
        await this.loadHistory()
        // 先启动 HTTP 增量轮询：即便 WS 在个别端（如支付宝）不可用或抛错，也能保证人工回复按时到达
        this.startPolling()
        // WS 建连单独兜底，任何异常都不能阻断轮询
        try {
          this.connectWs()
        } catch (e) {
          this.scheduleReconnect()
        }
      }
    },
    async loadHistory() {
      try {
        const res = await api.getChatSession(this.sessionId)
        if (res.code === 0) {
          this.status = res.data.session.status
          // 按 id 合并追加（不整体替换），确保历史加载或重连时不会把旧批次刷回来
          this.mergeMessages(res.data.messages || [])
          this.scrollBottom()
        }
      } catch (e) {
        /* ignore */
      }
    },
    // 按 id 去重，仅追加不存在的消息，从根上避免重复渲染
    mergeMessages(incoming) {
      if (!Array.isArray(incoming) || !incoming.length) return
      // 服务端回流的用户消息（WS 推送或 HTTP 响应）到达时，先摘掉对应的乐观占位 local_ 消息。
      // 否则在 HTTP 响应（需等 AI 生成完，较慢）返回前，界面会短暂出现「同一条消息两遍」。
      let base = this.messages
      for (const m of incoming) {
        if (!m || m.role !== 'user') continue
        const mImgs = normalizeImgs(m)
        if (!(m.content || '').trim() && !mImgs.length) continue
        // 文字 + 图片都一致才视为同一条（占位消息可能不带图；图片消息以图片集为主键）
        const mKey = (m.content || '') + '\u0000' + mImgs.join('|')
        for (let i = base.length - 1; i >= 0; i--) {
          const b = base[i]
          if (String(b.id).startsWith('local_') && b.role === 'user') {
            const bKey = (b.content || '') + '\u0000' + normalizeImgs(b).join('|')
            if (bKey === mKey) {
              base = base.slice(0, i).concat(base.slice(i + 1))
              break
            }
          }
        }
      }
      const existing = new Set(base.map((m) => m.id))
      const added = []
      const seen = new Set()
      for (const m of incoming) {
        if (!m || !m.id || existing.has(m.id) || seen.has(m.id)) continue
        seen.add(m.id)
        added.push(m)
      }
      if (base !== this.messages || added.length) {
        this.messages = base.concat(added)
        // 仅当用户停在底部时自动滚动（否则保留当前阅读位置，不打断回看历史）
        if (this.stickyBottom) this.scrollBottom()
      }
    },
    // WS 重连/订阅后，用「当前已有消息的最新 createdAt」走 HTTP 时间游标增量兜底，确保不漏任何人工回复
    // （不再用 id 增量：chatMessage.id 是随机 UUID，字符串比较与创建顺序无关）
    async fetchIncremental() {
      if (!this.sessionId) return
      let latestTs = ''
      for (const m of this.messages) {
        if (!m.id || String(m.id).startsWith('local_')) continue
        const ts = m.createdAt ? Date.parse(m.createdAt) : NaN
        if (ts && String(ts) > String(latestTs)) latestTs = String(ts)
      }
      // 首帧尚未取到时间游标：全量合并兜底
      if (!latestTs) return this.loadHistory()
      try {
        const res = await api.pollChatMessages(this.sessionId, latestTs)
        if (res.code !== 0) return
        if (res.data && res.data.session && res.data.session.status) {
          this.status = res.data.session.status
        }
        this.mergeMessages((res.data && res.data.messages) || [])
      } catch (e) {
        /* ignore */
      }
    },
    connectWs() {
      if (!this.sessionId) return
      // 避免重复建连
      if (this.wsTask) return
      this.wsClosed = false

      const task = api.connectChatSocket()
      // 部分端（支付宝小程序）uni.connectSocket 可能不返回 SocketTask；退回全局 socket 事件 API
      if (!task || typeof task.onOpen !== 'function') {
        this.bindGlobalSocket()
        return
      }
      this.wsTask = task

      task.onOpen(() => {
        // 订阅当前会话，开始接收实时推送
        if (this.wsTask) {
          this.wsTask.send({ data: JSON.stringify({ type: 'subscribe', sessionId: this.sessionId }) })
          this.subscribedId = this.sessionId
          // 重连成功后用 HTTP 增量兜底，补回断线期间漏掉的人工回复/状态消息
          this.fetchIncremental()
        }
      })

      task.onMessage((res) => {
        let msg
        try {
          msg = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch (e) {
          return
        }
        if (!msg || !msg.type) return
        // 只处理「当前会话」的推送，杜绝残留/旧会话订阅的广播把历史串入当前消息列表
        if (msg.session && msg.session.id && msg.session.id !== this.sessionId) return
        if (msg.type === 'messages') {
          if (msg.session && msg.session.status && msg.session.status !== this.status) {
            this.status = msg.session.status
          }
          this.mergeMessages(msg.messages)
          return
        }
        if (msg.type === 'status') {
          if (msg.session && msg.session.status) this.status = msg.session.status
        }
      })

      task.onError(() => {
        this.teardownWs()
        this.scheduleReconnect()
      })

      task.onClose(() => {
        this.teardownWs()
        this.scheduleReconnect()
      })
    },
    // 兜底：uni.connectSocket 未返回 SocketTask 时，改用全局 socket 事件 API（支付宝/微信均支持）
    bindGlobalSocket() {
      if (this.globalBound) {
        // 已绑定过，只需确保连接存在（再次调用 connectChatSocket 即重连，全局回调仍生效）
        api.connectChatSocket()
        return
      }
      this.globalBound = true
      uni.onSocketOpen(() => {
        try { uni.sendSocketMessage({ data: JSON.stringify({ type: 'subscribe', sessionId: this.sessionId }) }) } catch (e) { /* ignore */ }
        this.subscribedId = this.sessionId
        this.fetchIncremental()
      })
      uni.onSocketMessage((res) => {
        let msg
        try {
          msg = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch (e) {
          return
        }
        if (!msg || !msg.type) return
        if (msg.session && msg.session.id && msg.session.id !== this.sessionId) return
        if (msg.type === 'messages') {
          if (msg.session && msg.session.status) this.status = msg.session.status
          this.mergeMessages(msg.messages)
        } else if (msg.type === 'status') {
          if (msg.session && msg.session.status) this.status = msg.session.status
        }
      })
      uni.onSocketError(() => this.scheduleReconnect())
      uni.onSocketClose(() => this.scheduleReconnect())
    },
    // 统一发送（SocketTask 与全局 API 两种模式都兼容）
    wsSend(data) {
      if (this.wsTask && typeof this.wsTask.send === 'function') {
        try { this.wsTask.send({ data }) } catch (e) { /* ignore */ }
      } else {
        try { uni.sendSocketMessage({ data }) } catch (e) { /* ignore */ }
      }
    },
    // 会话切换（如超时归档后服务端返回新会话）：退订旧会话并订阅新会话
    resubscribe() {
      const old = this.subscribedId
      this.subscribedId = ''
      if (old && old !== this.sessionId) this.wsSend(JSON.stringify({ type: 'unsubscribe', sessionId: old }))
      this.wsSend(JSON.stringify({ type: 'subscribe', sessionId: this.sessionId }))
      this.subscribedId = this.sessionId
      // 会话切换后用 HTTP 兜底拉一口，避免切换瞬间丢消息
      this.fetchIncremental()
    },
    // HTTP 增量轮询兜底：WS 不可达/不稳定时，仍能定期补齐人工回复
    startPolling() {
      if (this.pollTimer) return
      this.pollTimer = setInterval(() => {
        this.fetchIncremental()
      }, 3000)
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    // 清理当前 SocketTask（不触发重连）
    teardownWs() {
      if (this.wsTask) {
        try { this.wsTask.close({}) } catch (e) { /* ignore */ }
      }
      this.wsTask = null
    },
    closeWs() {
      this.wsClosed = true
      if (this.wsReconnectTimer) {
        clearTimeout(this.wsReconnectTimer)
        this.wsReconnectTimer = null
      }
      this.stopPolling()
      this.teardownWs()
    },
    scheduleReconnect() {
      if (this.wsClosed || !this.sessionId) return
      if (this.wsReconnectTimer) return
      this.wsReconnectTimer = setTimeout(() => {
        this.wsReconnectTimer = null
        this.connectWs()
      }, 3000)
    },
    onQuick(prompt) {
      // 快捷入口：填入预置问题并直接发送
      this.input = prompt
      this.send()
    },
    onInput() {
      this.$forceUpdate()
    },
    // 滚动时跟踪是否停在底部：距离底部 <80rpx 视为「查看最新」，新消息到达才自动滚
    onScroll(e) {
      const d = (e && e.detail) || {}
      const sh = d.scrollHeight || 0
      const st = d.scrollTop || 0
      if (sh && this.scrollViewH) {
        this.stickyBottom = sh - st - this.scrollViewH < 80
      }
    },
    // 满足「在底部」时才真正触发 scroll-into-view：清空再写回，让取值发生变化从而滚动到最新
    scrollBottom() {
      if (!this.stickyBottom) return
      this.scrollTarget = ''
      this.$nextTick(() => {
        this.scrollTarget = 'bottom-anchor'
      })
    },
    measureViewport() {
      if (!this.scrollViewH) {
        const q = uni.createSelectorQuery().in(this)
        q.select('.msg-list')
          .boundingClientRect((rect) => {
            if (rect) this.scrollViewH = rect.height
          })
          .exec()
      }
    },
    async send() {
      if (!this.canSend) return
      const content = String(this.input).trim()
      this.input = ''
      const images = this.pendingImages.map((p) => p.url)
      this.pendingImages = []
      if (!content && !images.length) return

      // 乐观追加用户消息（文字 + 图片）
      this.messages.push({ id: 'local_' + Date.now(), role: 'user', content, images })
      this.aiThinking = this.status === 'ai'

      try {
        const res = await api.sendChatMessage(this.sessionId, content, images)
        if (res.code !== 0) {
          uni.showToast({ title: res.message || this.$t('chat.sendFailed'), icon: 'none' })
          this.messages = this.messages.filter((m) => !m.id.startsWith('local_'))
          return
        }
        // 移除乐观消息，再按 id 去重合入服务端确认消息（WS 推送和 HTTP 响应都来源同一批，去重避免重复）
        this.messages = this.messages.filter((m) => !m.id.startsWith('local_'))

        // 会话超时归档（30min 无新对话）：服务端自动开了新会话，这里切换到新会话并清空旧消息
        if (res.data.rotated && res.data.session) {
          this.sessionId = res.data.session.id
          this.status = res.data.session.status || 'ai'
          this.messages = []
          this.resubscribe()
          this.loadHistory()
          return
        }

        this.mergeMessages(res.data.messages || [])
        if (res.data.session && res.data.session.status) this.status = res.data.session.status
        this.scrollBottom()
      } catch (e) {
        uni.showToast({ title: this.$t('chat.offlineTip'), icon: 'none' })
        this.messages = this.messages.filter((m) => !m.id.startsWith('local_'))
      } finally {
        this.aiThinking = false
      }
    },
    systemText(m) {
      const c = m.content || ''
      if (c.includes('转接') || c.includes('转人工') || c.includes('transfer')) return this.$t('chat.transferredTip')
      if (c.includes('结束')) return this.$t('chat.closed')
      return c
    },
    // ===== 图片 =====
    msgImages(m) {
      return normalizeImgs(m)
    },
    imgUrl(url) {
      // 本地上传中的临时路径直接展示，服务端返回的 /api/uploads/.. 补全为绝对地址
      if (!url) return ''
      if (/^https?:\/\//.test(url)) return url
      if (url.startsWith('wxfile://') || url.startsWith('http')) return url
      return resolveAssetUrl(url)
    },
    previewMsgImages(m, index) {
      const urls = normalizeImgs(m).map((u) => this.imgUrl(u))
      if (!urls.length) return
      uni.previewImage({ urls, current: urls[index] || urls[0] })
    },
    pickImages() {
      if (this.picking) return
      const remain = this.chatImgMax - this.pendingImages.length
      if (remain <= 0) {
        uni.showToast({ title: this.$t('chat.imgLimit'), icon: 'none' })
        return
      }
      uni.chooseImage({
        count: remain,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const list = res && (res.tempFilePaths || res.tempFiles || [])
          const paths = (Array.isArray(list) ? list : [])
            .map((p) => (typeof p === 'string' ? p : (p && p.path) || ''))
            .filter(Boolean)
          this.uploadPending(paths)
        }
      })
    },
    async uploadPending(paths) {
      this.picking = true
      try {
        for (const p of paths) {
          if (this.pendingImages.length >= this.chatImgMax) break
          const up = await api.uploadChatImage(p)
          if (!up || up.code !== 0 || !up.data || !up.data.url) {
            uni.showToast({ title: (up && up.message) || this.$t('chat.imgUploadFailed'), icon: 'none' })
            continue
          }
          this.pendingImages.push({ url: up.data.url, local: p })
        }
        this.scrollBottom()
      } finally {
        this.picking = false
      }
    },
    removePendingImage(index) {
      this.pendingImages.splice(index, 1)
    },
    previewPending(index) {
      const urls = this.pendingImages.map((p) => p.local)
      uni.previewImage({ urls, current: urls[index] || urls[0] })
    },
    plusIcon() {
      const s =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#63708C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`
    },
    copyEmail() {
      uni.setClipboardData({
        data: this.email,
        success: () => uni.showToast({ title: this.$t('chat.emailCopied'), icon: 'none' })
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-page {
  height: 100vh;
  overflow: hidden;
  background: $bg-page;
  display: flex;
  flex-direction: column;
}

/* ============ 状态横幅 ============ */
.status-banner {
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 20rpx 24rpx 0;
  padding: 18rpx 24rpx;
  border-radius: $radius;
  background: $brand-light;
  color: $brand;
  font-size: 24rpx;
  font-weight: 600;
  text-align: center;

  &.human {
    background: $danger-light;
    color: $danger;
  }
}

.email-notice {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8rpx;
  font-size: 22rpx;
  font-weight: 500;
  line-height: 1.5;
  color: $ink-3;
}

.email-addr {
  color: $brand;
  font-weight: 600;
  text-decoration: underline;
}

/* ============ 快捷入口 ============ */
.quick-area {
  margin: 20rpx 24rpx 0;
  padding: 24rpx;
  background: $bg-card;
  border-radius: $radius;
  box-shadow: $shadow-sm;
}

.quick-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $ink;
  margin-bottom: 20rpx;
}

.quick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.quick-card {
  width: calc(50% - 8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx 16rpx;
  border-radius: $radius-sm;
  background: $brand-light;
  box-shadow: $shadow-sm;
  box-sizing: border-box;
}

.quick-label {
  font-size: 26rpx;
  font-weight: 600;
  color: $brand;
  text-align: center;
}

/* ============ 消息列表 ============ */
.msg-list {
  flex: 1;
  height: 0;
}

.msg-wrap {
  padding: 24rpx;
}

.notice-row {
  text-align: center;
  font-size: 22rpx;
  color: $ink-3;
  margin: 8rpx 0 24rpx;
}

.msg-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24rpx;

  &.mine {
    justify-content: flex-end;
  }

  &.sys {
    justify-content: center;
  }
}

.sys-banner {
  max-width: 80%;
  background: $bg-soft;
  color: $ink-2;
  font-size: 22rpx;
  border-radius: 999rpx;
  padding: 10rpx 28rpx;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
  box-shadow: $shadow-sm;

  &.ai-avatar {
    background: $brand-light;
  }
}

.avatar-img {
  width: 38rpx;
  height: 38rpx;
}

.bubble {
  max-width: 70%;
  padding: 22rpx 26rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: $ink;
  word-break: break-word;
  border-radius: $radius;
}

.msg-item.theirs .bubble {
  background: $bg-card;
  border-top-left-radius: $radius-sm;
  box-shadow: $shadow-sm;
}

.msg-item.mine .bubble {
  background: $brand;
  color: #ffffff;
  border-top-right-radius: $radius-sm;
}

/* ============ 消息图片 ============ */
.msg-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.msg-img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  background: rgba(0, 0, 0, 0.06);
}

.bubble.mine-bubble .msg-img {
  border-radius: 16rpx;
}

/* ============ 待发送图片缩略图 ============ */
.pending-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 16rpx 24rpx 0;
  background: #ffffff;
}

.pending-img-wrap {
  position: relative;
  width: 120rpx;
  height: 120rpx;
}

.pending-img {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
}

.pending-del {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pending-del-x {
  font-size: 28rpx;
  line-height: 1;
}

.bubble.typing {
  display: flex;
  gap: 6rpx;
  align-items: center;
}

.dot {
  font-size: 40rpx;
  color: $brand;
  animation: blink 1.2s infinite ease-in-out;
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}

@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

/* ============ 输入区 ============ */
.input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  border-top: 1rpx solid $line;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  height: 76rpx;
  background: $bg-soft;
  border-radius: 999rpx;
  padding: 0 28rpx;
  font-size: 27rpx;
  color: $ink;
}

.attach-btn {
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: $bg-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s ease;

  &.disabled {
    opacity: 0.5;
  }

  &--hover {
    transform: scale(0.92);
  }
}

.attach-icon {
  width: 40rpx;
  height: 40rpx;
}

.send-btn {
  height: 76rpx;
  padding: 0 34rpx;
  border-radius: 999rpx;
  background: $brand;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.disabled {
    opacity: 0.4;
  }
}

.footer-safe {
  height: calc(20rpx + env(safe-area-inset-bottom));
}
</style>