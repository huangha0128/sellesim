<template>
  <view class="chat-page">
    <!-- 状态横幅 -->
    <view v-if="status === 'closed'" class="status-banner">{{ $t('chat.closed') }}</view>
    <view v-else-if="status === 'human'" class="status-banner human">{{ $t('chat.humanNotice') }}</view>
    <view v-else-if="!messageCount" class="status-banner ai">{{ $t('chat.emptyHint') }}</view>

    <!-- 消息列表 -->
    <scroll-view class="msg-list" scroll-y :scroll-into-view="scrollAnchor" scroll-with-animation>
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
            <view class="bubble" :class="{ 'mine-bubble': m.role === 'user' }">{{ m.content }}</view>
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

    <!-- 底部输入区 -->
    <view class="input-bar" v-if="status !== 'closed'">
      <view class="transfer-btn" :class="{ disabled: status === 'human' }" @tap="onTransfer">
        <image v-if="status !== 'human'" class="transfer-icon" src="/static/icons/prof-help.png" mode="aspectFit" />
        <text v-if="status !== 'human'">{{ $t('chat.transferBtn') }}</text>
        <text v-else class="transfer-done">✓ {{ $t('chat.transferred') }}</text>
      </view>
      <input
        class="chat-input"
        v-model="input"
        :placeholder="status === 'human' ? $t('chat.transferredTip') : $t('chat.placeholder')"
        :disabled="aiThinking"
        confirm-type="send"
        @confirm="send"
        @input="onInput"
      />
      <view class="send-btn" :class="{ disabled: !canSend }" @tap="send">{{ $t('chat.send') }}</view>
    </view>

    <view class="footer-safe"></view>
  </view>
</template>

<script>
import { store } from '@/store'
import { api } from '@/utils/api'
import { setNavTitle } from '@/locales'

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
      wsClosed: true // 标记是否主动断开
    }
  },
  onLoad(options) {
    if (options && options.id) this.entryId = options.id
  },
  computed: {
    canSend() {
      return !this.aiThinking && this.input && String(this.input).trim() && this.status !== 'closed'
    },
    messageCount() {
      return this.messages.length
    },
    scrollAnchor() {
      return 'bottom-anchor'
    }
  },
  onShow() {
    setNavTitle('pageTitle.chat')
    this.bootstrap()
  },
  onUnload() {
    this.closeWs()
  },
  onHide() {
    // 页面隐藏不断开，保持实时接收；仅在卸载时断开
  },
  methods: {
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
          if (res.code === 0) session = res.data.session
        }
        if (!session) {
          const created = await api.createChatSession({})
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
        this.connectWs()
      }
    },
    async loadHistory() {
      try {
        const res = await api.getChatSession(this.sessionId)
        if (res.code === 0) {
          this.messages = res.data.messages || []
          this.status = res.data.session.status
          this.scrollBottom()
        }
      } catch (e) {
        /* ignore */
      }
    },
    // 按 id 去重，仅追加不存在的消息，从根上避免重复渲染
    mergeMessages(incoming) {
      if (!Array.isArray(incoming) || !incoming.length) return
      const existing = new Set(this.messages.map((m) => m.id))
      const added = incoming.filter((m) => m && m.id && !existing.has(m.id))
      if (added.length) {
        this.messages = this.messages.concat(added)
        this.scrollBottom()
      }
    },
    connectWs() {
      if (!this.sessionId) return
      // 避免重复建连
      if (this.wsTask) return
      this.wsClosed = false

      const task = api.connectChatSocket()
      this.wsTask = task

      task.onOpen(() => {
        // 订阅当前会话，开始接收实时推送
        if (this.wsTask) {
          this.wsTask.send({ data: JSON.stringify({ type: 'subscribe', sessionId: this.sessionId }) })
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
    onInput() {
      this.$forceUpdate()
    },
    scrollBottom() {
      this.$nextTick(() => {
        const q = uni.createSelectorQuery().in(this)
        q.select('#bottom-anchor').boundingClientRect(() => {}).exec()
      })
    },
    async send() {
      if (!this.canSend) return
      const content = String(this.input).trim()
      this.input = ''
      if (!content) return

      // 乐观追加用户消息
      this.messages.push({ id: 'local_' + Date.now(), role: 'user', content })
      this.aiThinking = this.status === 'ai'

      try {
        const res = await api.sendChatMessage(this.sessionId, content)
        if (res.code !== 0) {
          uni.showToast({ title: res.message || this.$t('chat.sendFailed'), icon: 'none' })
          this.messages = this.messages.filter((m) => !m.id.startsWith('local_'))
          return
        }
        // 移除乐观消息，再按 id 去重合入服务端确认消息（WS 推送和 HTTP 响应都来源同一批，去重避免重复）
        this.messages = this.messages.filter((m) => !m.id.startsWith('local_'))
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
    async onTransfer() {
      if (this.status === 'human' || this.status === 'closed' || !this.sessionId) return
      uni.showModal({
        title: this.$t('chat.transferConfirm'),
        success: async (r) => {
          if (!r.confirm) return
          try {
            const res = await api.transferChat(this.sessionId)
            if (res.code === 0 && res.data.session) {
              this.status = res.data.session.status
              uni.showToast({ title: this.$t('chat.transferring'), icon: 'none' })
              await this.loadHistory()
              this.scrollBottom()
            }
          } catch (e) {
            uni.showToast({ title: this.$t('chat.offlineTip'), icon: 'none' })
          }
        }
      })
    },
    systemText(m) {
      const c = m.content || ''
      if (c.includes('转接') || c.includes('转人工') || c.includes('transfer')) return this.$t('chat.transferredTip')
      if (c.includes('结束')) return this.$t('chat.closed')
      return c
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-page {
  min-height: 100vh;
  background: $bg-page;
  display: flex;
  flex-direction: column;
}

/* ============ 状态横幅 ============ */
.status-banner {
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

  &.ai {
    background: $teal-light;
    color: $teal-deep;
  }
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
}

.transfer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 76rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: $brand-light;
  color: $brand;
  font-size: 24rpx;
  font-weight: 600;
  flex-shrink: 0;

  &.disabled {
    background: $teal-light;
    color: $teal-deep;
  }
}

.transfer-icon {
  width: 30rpx;
  height: 30rpx;
}

.transfer-done {
  font-size: 24rpx;
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