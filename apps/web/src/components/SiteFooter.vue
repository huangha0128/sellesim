<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';
import logoUrl from '../assets/logo.png';

const { t, tr } = useI18n();

const groups = computed(() => [
  { title: t('footer.product'), links: (tr('footer.productLinks') as string[]) ?? [] },
  { title: t('footer.about'), links: (tr('footer.aboutLinks') as string[]) ?? [] },
]);
</script>

<template>
  <footer class="border-t border-line bg-surface-page py-12">
    <div class="container-page">
      <div class="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div class="flex items-center gap-2.5">
            <img :src="logoUrl" alt="YYeSim" class="h-9 w-9 rounded-xl" />
            <span class="text-lg font-semibold text-ink">YYeSim</span>
          </div>
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-ink-2">{{ t('footer.tagline') }}</p>
          <p class="mt-2 text-sm text-ink-3">{{ t('footer.miniappTip') }}</p>
        </div>

        <div v-for="g in groups" :key="g.title">
          <h4 class="text-sm font-semibold text-ink">{{ g.title }}</h4>
          <ul class="mt-4 space-y-2.5">
            <li v-for="l in g.links" :key="l">
              <a href="#" class="text-sm text-ink-2 transition-colors hover:text-brand">{{ l }}</a>
            </li>
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-ink">{{ t('footer.support') }}</h4>
          <p class="mt-4 text-sm leading-relaxed text-ink-2">
            {{ t('footer.miniappTip') }}
          </p>
        </div>
      </div>

      <div class="mt-12 border-t border-line pt-6 text-center text-sm text-ink-3">
        {{ t('footer.rights') }}
      </div>
    </div>
  </footer>
</template>