<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PhList, PhX } from '@phosphor-icons/vue';
import { useI18n } from '../i18n';
import { scrollToSection } from '../scrollTo';
import LangSwitcher from './LangSwitcher.vue';
import logoUrl from '../assets/logo.png';

const { t, current, setLang } = useI18n();
const route = useRoute();
const router = useRouter();
const scrolled = ref(false);
const open = ref(false);

const links = computed(() => [
  { anchor: 'destinations', label: t('nav.countries') },
  { anchor: 'why', label: t('nav.features') },
  { anchor: 'how', label: t('nav.how') },
  { anchor: 'faq', label: t('nav.faq') },
]);

function onAnchorClick(anchor: string) {
  open.value = false;
  scrollToSection(anchor);
}

/**
 * 点击 logo：非首页时先回到首页（并置顶），已在首页则平滑滚到顶部。
 */
function goHome() {
  open.value = false;
  if (route.path !== '/') {
    router.push('/').then(() => window.scrollTo({ top: 0 }));
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onScroll() {
  scrolled.value = window.scrollY > 8;
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-all duration-300"
    :class="scrolled ? 'bg-white/85 shadow-card backdrop-blur-md' : 'bg-transparent'"
  >
    <div class="container-page flex h-16 items-center justify-between">
      <a
        href="#/"
        class="flex items-center gap-2.5"
        :aria-label="t('nav.home')"
        @click.prevent="goHome()"
      >
        <img :src="logoUrl" alt="YYeSim" class="h-9 w-9 rounded-xl" />
        <span class="text-lg font-semibold tracking-tight text-ink">YYeSim</span>
      </a>

      <nav class="hidden items-center gap-8 md:flex">
        <a
          v-for="link in links"
          :key="link.anchor"
          href="#"
          class="text-sm font-medium text-ink-2 transition-colors hover:text-brand"
          @click.prevent="onAnchorClick(link.anchor)"
        >
          {{ link.label }}
        </a>
      </nav>

      <div class="hidden items-center gap-4 md:flex">
        <LangSwitcher :lang="current" @change="setLang" />
        <a
          href="#"
          class="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-brand-deep"
          @click.prevent="scrollToSection('buy')"
        >
          {{ t('nav.buy') }}
        </a>
      </div>

      <div class="flex items-center gap-3 md:hidden">
        <LangSwitcher :lang="current" @change="setLang" />
        <button type="button" class="text-2xl text-ink" @click="open = !open">
          <PhList v-if="!open" :size="26" weight="bold" />
          <PhX v-else :size="26" weight="bold" />
        </button>
      </div>
    </div>

    <transition name="fade">
      <nav v-if="open" class="border-t border-line bg-white px-6 py-4 md:hidden">
        <div class="flex flex-col gap-4">
          <a
            v-for="link in links"
            :key="link.anchor"
            href="#"
            class="text-base font-medium text-ink-2"
            @click.prevent="onAnchorClick(link.anchor)"
          >
            {{ link.label }}
          </a>
          <a
            href="#"
            class="rounded-full bg-brand px-5 py-2 text-center text-sm font-semibold text-white"
            @click.prevent="scrollToSection('buy')"
          >
            {{ t('nav.buy') }}
          </a>
        </div>
      </nav>
    </transition>
  </header>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>