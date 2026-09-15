<script setup lang="ts">
import { PhLightning, PhQrCode, PhGlobeSimple, PhArrowRight, PhCheck } from '@phosphor-icons/vue';
import { useI18n } from '../i18n';
import { scrollToSection } from '../scrollTo';
import globeUrl from '../assets/hero-globe.jpg';

const { t } = useI18n();

const features = [
  { icon: PhLightning, key: 'feature1' },
  { icon: PhQrCode, key: 'feature2' },
  { icon: PhGlobeSimple, key: 'feature3' },
];
</script>

<template>
  <section id="top" class="relative overflow-hidden">
    <div class="absolute inset-0 bg-[var(--gradient-canvas)]" />
    <!-- 极柔和装饰圆，避免 AI 感堆砌 -->
    <div class="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-light/50 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-lighter/60 blur-3xl" />

    <div class="container-page relative grid gap-10 pt-28 pb-16 md:grid-cols-2 md:items-center md:pt-32 lg:pt-36">
      <!-- 左：文案 -->
      <div>
        <span class="eyebrow">{{ t('hero.badge') }}</span>
        <h1 class="mt-5 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-6xl">
          <span class="text-gradient">{{ t('hero.title1') }}</span>
          <br />
          {{ t('hero.title2') }}
        </h1>
        <p class="mt-5 max-w-md text-lg leading-relaxed text-ink-2">{{ t('hero.sub') }}</p>

        <ul class="mt-7 flex flex-wrap gap-x-6 gap-y-2">
          <li v-for="f in features" :key="f.key" class="flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <component :is="f.icon" :size="18" weight="bold" class="text-brand" />
            {{ t(`hero.${f.key}`) }}
          </li>
        </ul>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#"
            class="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-white shadow-card transition-all hover:bg-brand-deep"
            @click.prevent="scrollToSection('buy')"
          >
            {{ t('hero.ctaPrimary') }}
            <PhArrowRight :size="18" weight="bold" class="transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#"
            class="inline-flex items-center gap-2 rounded-full border border-line bg-white px-6 py-3 text-base font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
            @click.prevent="scrollToSection('destinations')"
          >
            {{ t('hero.ctaSecondary') }}
          </a>
        </div>

        <!-- 统计 -->
        <div class="mt-10 flex items-center gap-6 text-ink">
          <div>
            <div class="text-2xl font-bold text-ink">200+</div>
            <div class="text-sm text-ink-3">{{ t('hero.statRegions') }}</div>
          </div>
          <div class="h-8 w-px bg-line" />
          <div>
            <div class="text-2xl font-bold text-ink">2</div>
            <div class="text-sm text-ink-3">{{ t('hero.statMins') }}</div>
          </div>
          <div class="h-8 w-px bg-line" />
          <div>
            <div class="text-2xl font-bold text-ink">1000+</div>
            <div class="text-sm text-ink-3">{{ t('hero.statPlans') }}</div>
          </div>
        </div>
      </div>

      <!-- 右：柔和产品配图 -->
      <div class="relative hidden md:block">
        <div class="mx-auto max-w-md overflow-hidden rounded-[44px] border border-line bg-white/70 p-3 shadow-float">
          <img :src="globeUrl" alt="Global eSIM connectivity" class="h-auto w-full rounded-[36px]" />
          <div class="flex items-center gap-2 px-5 py-4">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-brand">
              <PhCheck :size="18" weight="bold" />
            </span>
            <div>
              <div class="text-sm font-semibold text-ink">TRAVEL eSIM</div>
              <div class="text-xs text-ink-3">Global Data · One Card</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>