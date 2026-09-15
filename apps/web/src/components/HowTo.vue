<script setup lang="ts">
import { PhCreditCard, PhDeviceMobile, PhWifiHigh } from '@phosphor-icons/vue';
import { useI18n } from '../i18n';

const { t } = useI18n();
const steps = [
  { icon: PhCreditCard, titleKey: 'step1Title', descKey: 'step1Desc', num: '01' },
  { icon: PhDeviceMobile, titleKey: 'step2Title', descKey: 'step2Desc', num: '02' },
  { icon: PhWifiHigh, titleKey: 'step3Title', descKey: 'step3Desc', num: '03' },
];
</script>

<template>
  <section id="how" class="bg-white py-20">
    <div class="container-page">
      <div class="section-head text-center">
        <span class="eyebrow">{{ t('howto.eyebrow') }}</span>
        <h2 class="mt-4 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ t('howto.title') }}</h2>
        <p class="mx-auto mt-3 max-w-xl text-ink-2">{{ t('howto.sub') }}</p>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <div
          v-for="s in steps"
          :key="s.num"
          class="relative rounded-[32px] border border-line bg-surface-page p-7 shadow-card"
        >
          <div class="text-sm font-bold tracking-widest text-brand/40">{{ s.num }}</div>
          <div class="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
            <component :is="s.icon" :size="26" weight="bold" />
          </div>
          <h3 class="mt-5 text-xl font-semibold text-ink">{{ t(`howto.${s.titleKey}`) }}</h3>
          <p class="mt-2 leading-relaxed text-ink-2">{{ t(`howto.${s.descKey}`) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>