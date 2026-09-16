<script setup lang="ts">
import { PhArrowRight, PhQrCode } from '@phosphor-icons/vue';
import { useI18n } from '../i18n';
import { openQr } from '../qrModal';
import { scrollToSection } from '../scrollTo';

const { t } = useI18n();
</script>

<template>
  <section id="buy" class="bg-surface-page py-20">
    <div class="container-page">
      <div class="relative overflow-hidden rounded-[44px] bg-[var(--gradient-brand)] px-8 py-14 text-center shadow-float md:px-16">
        <div class="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-sky/30 blur-3xl" />

        <span class="eyebrow text-brand-sky">{{ t('qrcta.eyebrow') }}</span>
        <h2 class="mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-snug tracking-[-0.02em] text-white md:text-4xl">
          {{ t('qrcta.title') }}
        </h2>
        <p class="mx-auto mt-4 max-w-xl text-white/85">{{ t('qrcta.sub1') }}</p>
        <p class="mx-auto mt-1 text-white/85">{{ t('qrcta.sub2') }}</p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand shadow-card transition-transform hover:scale-[1.02]"
            @click="openQr()"
          >
            <PhQrCode :size="18" weight="bold" /> {{ t('qrcta.scanQr') }}
          </button>
          <span class="rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white">
            {{ t('qrcta.tip') }}
          </span>
          <a
            href="#"
            class="group inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            @click.prevent="scrollToSection('destinations')"
          >
            {{ t('qrcta.miniappQr') }}
            <PhArrowRight :size="18" weight="bold" class="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </div>
  </section>
</template>