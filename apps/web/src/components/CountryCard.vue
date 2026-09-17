<script setup lang="ts">
import { useI18n } from '../i18n';
import { resolveFlag, onFlagError } from '../utils/flag';

defineProps<{
  code: string;
  name: string;
  en: string;
  flag: string;
  hot: number;
  hasPrices: boolean;
  min?: number;
  currency?: string;
}>();
const { current } = useI18n();
</script>

<template>
  <router-link
    :to="'/country/' + code"
    class="group flex items-center gap-4 rounded-2xl border border-line bg-white p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-float"
  >
    <div class="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-soft">
      <img :src="resolveFlag(code, flag)" :alt="en" class="h-full w-full object-cover" loading="lazy" @error="onFlagError(code, $event)" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="truncate text-base font-semibold text-ink">{{ current === 'zh' ? name : en }}</span>
        <span
          v-if="hot > 0"
          class="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold leading-none text-brand"
        >
          {{ current === 'zh' ? '热门' : 'Hot' }}
        </span>
      </div>
      <div class="mt-1 text-sm" :class="hasPrices ? 'font-medium text-brand' : 'text-ink-3'">
        {{ hasPrices && min != null ? `${current === 'zh' ? '¥' : 'From ¥'}${min}` : '' }}
        <span v-if="hasPrices && min != null" class="ml-0.5 text-ink-3">· {{ current === 'zh' ? '起' : 'up' }}</span>
        <span v-else>{{ current === 'zh' ? '流量套餐' : 'Data Plan' }}</span>
      </div>
      <div class="mt-1 text-xs font-medium text-ink-3 group-hover:text-brand">
        {{ current === 'zh' ? '查套餐 ›' : 'View plans ›' }}
      </div>
    </div>
  </router-link>
</template>