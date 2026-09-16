<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { PhQrCode, PhShoppingBagOpen, PhX } from '@phosphor-icons/vue';
import { alipayMiniProgramUrl } from '../config';
import { useI18n } from '../i18n';
import { closeQr, qrOpen } from '../qrModal';
import miniappQr from '../assets/miniapp-qr.png';

const { t } = useI18n();

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeQr();
}

// 弹窗打开时锁定背景滚动
watch(qrOpen, (v) => {
  document.body.style.overflow = v ? 'hidden' : '';
});

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <teleport to="body">
    <!-- 注意：这里不用 <transition>，关闭时直接移除节点，
         避免离场动画未触发时残留一层透明全屏遮罩挡住页面点击 -->
    <div
      v-if="qrOpen"
      class="qr-mask fixed inset-0 z-[100] flex items-center justify-center px-5 py-8"
      role="dialog"
      aria-modal="true"
    >
      <!-- 遮罩：点击关闭 -->
      <div class="absolute inset-0 bg-ink/50 backdrop-blur-sm" @click="closeQr()" />

      <!-- 弹窗卡片 -->
      <div class="qr-card relative w-full max-w-sm overflow-hidden rounded-[32px] bg-white p-8 text-center shadow-float">
        <button
          type="button"
          class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-page text-ink-2 transition-colors hover:bg-brand-light hover:text-brand"
          :aria-label="t('qrModal.close')"
          @click="closeQr()"
        >
          <PhX :size="18" weight="bold" />
        </button>

        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand">
          <PhQrCode :size="28" weight="bold" />
        </div>

        <h3 class="mt-4 text-xl font-semibold text-ink">{{ t('qrModal.title') }}</h3>
        <p class="mt-2 text-sm leading-relaxed text-ink-2">{{ t('qrModal.tip') }}</p>

        <div class="mx-auto mt-6 w-fit rounded-2xl border border-line bg-white p-3 shadow-card">
          <img :src="miniappQr" :alt="t('qrModal.title')" class="h-52 w-52" />
        </div>

        <ol class="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm text-ink-2">
          <li>{{ t('qrModal.hint1') }}</li>
          <li>{{ t('qrModal.hint2') }}</li>
        </ol>

        <a
          :href="alipayMiniProgramUrl()"
          class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-deep"
        >
          <PhShoppingBagOpen :size="18" weight="bold" /> {{ t('qrModal.openAlipay') }}
        </a>

        <button type="button" class="mt-4 text-sm text-ink-3 transition-colors hover:text-brand" @click="closeQr()">
          {{ t('qrModal.close') }}
        </button>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/* 入场动画：纯 CSS keyframes，关闭时节点直接移除，不依赖 transitionend */
.qr-mask {
  animation: qr-mask-in 0.18s ease-out;
}
.qr-card {
  animation: qr-card-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes qr-mask-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes qr-card-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
