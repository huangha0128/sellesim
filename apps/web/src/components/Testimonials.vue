<script setup lang="ts">
import { computed } from 'vue';
import { PhStar, PhQuotes } from '@phosphor-icons/vue';
import { useI18n } from '../i18n';

const { t, tr } = useI18n();
const items = computed(() => (tr('testimonials.items') as Array<{ name: string; text: string }>) ?? []);
</script>

<template>
  <section class="bg-white py-20">
    <div class="container-page">
      <div class="section-head text-center">
        <span class="eyebrow">{{ t('testimonials.eyebrow') }}</span>
        <h2 class="mt-4 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ t('testimonials.title') }}</h2>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <div
          v-for="item in items"
          :key="item.name"
          class="flex flex-col rounded-[32px] border border-line bg-surface-page p-7 shadow-card"
        >
          <div class="flex gap-1 text-amber-400">
            <PhStar v-for="i in 5" :key="i" :size="16" weight="fill" />
          </div>
          <p class="mt-4 flex-1 leading-relaxed text-ink-2">"{{ item.text }}"</p>
          <div class="mt-6 flex items-center gap-3">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
              <PhQuotes :size="20" weight="fill" />
            </span>
            <span class="text-sm font-semibold text-ink">{{ item.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>