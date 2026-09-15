<script setup lang="ts">
import { ref } from 'vue';
import { PhPlus } from '@phosphor-icons/vue';
import { useI18n } from '../i18n';

const { t, tr } = useI18n();
const items = ref((tr('faq.items') as Array<{ q: string; a: string }>) ?? []);
const openIndex = ref(0);

function toggle(i: number) {
  openIndex.value = openIndex.value === i ? -1 : i;
}
</script>

<template>
  <section id="faq" class="bg-white py-20">
    <div class="container-page max-w-3xl">
      <div class="section-head text-center">
        <span class="eyebrow">{{ t('faq.eyebrow') }}</span>
        <h2 class="mt-4 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ t('faq.title') }}</h2>
        <p class="mx-auto mt-3 max-w-xl text-ink-2">{{ t('faq.sub') }}</p>
      </div>

      <div class="space-y-3">
        <div
          v-for="(item, i) in items"
          :key="i"
          class="overflow-hidden rounded-2xl border border-line bg-surface-page"
          :class="openIndex === i ? 'shadow-card' : ''"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            @click="toggle(i)"
          >
            <span class="text-base font-semibold text-ink">{{ item.q }}</span>
            <PhPlus
              :size="20"
              weight="bold"
              class="shrink-0 text-brand transition-transform duration-200"
              :class="openIndex === i ? 'rotate-45' : ''"
            />
          </button>
          <div v-show="openIndex === i" class="px-6 pb-6">
            <p class="leading-relaxed text-ink-2">{{ item.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>