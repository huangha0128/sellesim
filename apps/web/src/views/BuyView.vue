<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhArrowLeft, PhCheck, PhWifiHigh, PhCreditCard, PhQrCode, PhShoppingBagOpen } from '@phosphor-icons/vue';
import { get } from '../api/client';
import { useData } from '../api/useData';
import { useI18n } from '../i18n';
import { alipayMiniProgramUrl } from '../config';
import miniappQr from '../assets/miniapp-qr.png';
import type { PackageResp, PackageView } from '../api/types';

const props = defineProps<{ id: string }>();
const { t, current } = useI18n();
const { countries } = useData();

const pkg = ref<PackageView | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const region = computed(() => {
  if (!pkg.value) return null;
  const code = pkg.value.countryCode;
  return (
    countries.value.find((c) => c.code.toUpperCase() === code.toUpperCase()) ??
    countries.value.find((c) => c.code.toLowerCase() === code.toLowerCase())
  );
});
const flag = computed(() => region.value?.flag || `https://flagcdn.com/${pkg.value?.countryCode.toLowerCase() || ''}.png`);
const title = computed(() => (current.value === 'zh' ? pkg.value?.name : pkg.value?.nameEn) || '');
const descText = computed(() => (current.value === 'zh' ? pkg.value?.desc : pkg.value?.descEn) || '');
const dataLine = computed(() =>
  pkg.value?.isUnlimited
    ? t('buy.dataU')
    : t('buy.data0', { gb: pkg.value?.gb ?? 0 }),
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const resp = await get<PackageResp>(`/api/packages/${encodeURIComponent(props.id)}`);
    if (resp.code === 0 && resp.data?.pkg) {
      pkg.value = resp.data.pkg;
    } else {
      pkg.value = null;
      error.value = resp.message || t('buy.notFound');
    }
  } catch {
    pkg.value = null;
    error.value = t('buy.noTiger');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
// 同一组件在 /buy/:id 间复用时不触发 onMounted，需监听 id 重新拉取
watch(() => props.id, load);
</script>

<template>
  <div class="min-h-screen bg-surface-page">
    <div class="container-page py-24 md:py-28">
      <router-link
        :to="pkg ? '/country/' + pkg.countryCode : '/'"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-brand"
      >
        <PhArrowLeft :size="16" weight="bold" /> {{ t('buy.back') }}
      </router-link>

      <!-- 加载中 -->
      <div v-if="loading" class="py-24 text-center text-ink-3">{{ t('buy.loading') }}</div>

      <!-- 错误 -->
      <div v-else-if="error || !pkg" class="mt-8 rounded-3xl border border-line bg-white p-16 text-center">
        <div class="text-lg font-semibold text-ink">{{ error || t('buy.notFound') }}</div>
        <p class="mt-2 text-ink-3">{{ t('buy.noTiger') }}</p>
      </div>

      <!-- 套餐详情 + 小程序码 -->
      <div v-else class="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <!-- 左：套餐信息 -->
        <div class="rounded-[32px] border border-line bg-white p-8 shadow-card">
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 overflow-hidden rounded-xl border border-line">
              <img :src="flag" :alt="pkg.countryName" class="h-full w-full object-cover" loading="lazy" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-semibold tracking-[-0.02em] text-ink">{{ title }}</h1>
                <span
                  v-if="pkg.isFeatured && pkg.tagColor"
                  class="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  :style="{ background: pkg.tagColor }"
                >
                  {{ t('packages.badgeHot') }}
                </span>
              </div>
              <div class="mt-0.5 text-sm text-ink-2">{{ current === 'zh' ? pkg.countryName : pkg.countryNameEn }}</div>
            </div>
          </div>

          <div class="mt-6 rounded-2xl bg-surface-page p-5">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
                <PhWifiHigh :size="24" weight="bold" />
              </span>
              <div>
                <div class="text-xl font-bold text-ink">{{ dataLine }}</div>
                <div class="text-sm text-ink-2">{{ pkg.days }}{{ t('buy.daysSuffix') }} · {{ pkg.network }}</div>
              </div>
              <div class="ml-auto text-right">
                <div class="text-sm text-ink-3">{{ t('buy.priceLabel') }}</div>
                <div class="text-2xl font-bold text-brand">¥{{ pkg.price }}</div>
              </div>
            </div>
          </div>

          <p class="mt-6 leading-relaxed text-ink-2">{{ descText }}</p>

          <!-- 套餐权益 -->
          <div class="mt-8">
            <h2 class="text-base font-semibold text-ink">{{ t('buy.benefit') }}</h2>
            <ul class="mt-3 grid gap-2.5 sm:grid-cols-2">
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('catalog.from', { price: pkg.price }) }} {{ t('buy.data0', { gb: pkg.gb }) }}
              </li>
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('buy.installStepsShort') }}
              </li>
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('hero.feature1') }}
              </li>
              <li v-if="pkg.soldCount" class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('buy.soldCount', { n: pkg.soldCount }) }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 右：支付宝小程序码 -->
        <aside class="lg:sticky lg:top-24 h-fit rounded-[32px] border border-line bg-white p-8 text-center shadow-card">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand">
            <PhQrCode :size="28" weight="bold" />
          </div>
          <h2 class="mt-4 text-xl font-semibold text-ink">{{ t('buy.qrTitle') }}</h2>
          <p class="mt-2 text-sm text-ink-2">{{ t('buy.qrTip') }}</p>

          <div class="mx-auto mt-6 w-fit rounded-2xl border border-line bg-white p-3 shadow-card">
            <img :src="miniappQr" alt="Alipay mini-program QR" class="h-52 w-52" />
          </div>

          <ol class="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm text-ink-2">
            <li>{{ t('buy.qrHint1') }}</li>
            <li>{{ t('buy.qrHint2') }}</li>
          </ol>

          <a
            :href="alipayMiniProgramUrl()"
            class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-deep"
          >
            <PhShoppingBagOpen :size="18" weight="bold" /> {{ t('buy.openAlipay') }}
          </a>
          <div class="mt-4 flex items-center justify-center gap-1 text-xs text-ink-3">
            <PhCreditCard :size="14" weight="bold" /> {{ t('buy.hint') }}
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>