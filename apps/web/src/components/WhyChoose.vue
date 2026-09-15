<script setup lang="ts">
import { computed } from 'vue';
import {
  PhLightning,
  PhGlobeSimple,
  PhWifiHigh,
  PhShareNetwork,
  PhShieldCheck,
  PhCreditCard,
} from '@phosphor-icons/vue';
import { useI18n } from '../i18n';

const { t, tr } = useI18n();

const ICONS: Record<string, any> = {
  bolt: PhLightning,
  globe: PhGlobeSimple,
  wifiHigh: PhWifiHigh,
  shareNetwork: PhShareNetwork,
  shieldCheck: PhShieldCheck,
  creditCard: PhCreditCard,
};

const items = computed(() => (tr('why.items') as Array<{ icon: string; title: string; desc: string }>) ?? []);
</script>

<template>
  <section id="why" class="bg-surface-page py-20">
    <div class="container-page">
      <div class="section-head text-center">
        <span class="eyebrow">{{ t('why.eyebrow') }}</span>
        <h2 class="mt-4 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ t('why.title') }}</h2>
        <p class="mx-auto mt-3 max-w-xl text-ink-2">{{ t('why.sub') }}</p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="item in items"
          :key="item.title"
          class="rounded-[32px] border border-line bg-white p-7 shadow-card transition-transform hover:-translate-y-1"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
            <component :is="ICONS[item.icon] || PhGlobeSimple" :size="26" weight="bold" />
          </div>
          <h3 class="mt-5 text-lg font-semibold text-ink">{{ item.title }}</h3>
          <p class="mt-2 leading-relaxed text-ink-2">{{ item.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>