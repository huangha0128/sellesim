<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { PhArrowLeft, PhLightning, PhWifiHigh, PhGlobeSimple, PhCaretRight } from '@phosphor-icons/vue';
import { get } from '../api/client';
import { useData } from '../api/useData';
import { useI18n } from '../i18n';
import type { PackageView, PackagesResp } from '../api/types';

const props = defineProps<{ code: string }>();
const { t, current } = useI18n();
const { countries } = useData();

const packages = ref<PackageView[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const country = computed(
  () =>
    countries.value.find((c) => c.code.toUpperCase() === props.code.toUpperCase()) ??
    countries.value.find((c) => c.code.toLowerCase() === props.code.toLowerCase()),
);
const flag = computed(() => country.value?.flag || `https://flagcdn.com/${props.code.toLowerCase()}.png`);
const regionName = computed(() =>
  country.value ? (current.value === 'zh' ? country.value.name : country.value.en) : props.code,
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const resp = await get<PackagesResp>(`/api/packages?countryCode=${encodeURIComponent(props.code)}&all=1`);
    if (resp.code === 0 && resp.data?.packages?.length) {
      packages.value = resp.data.packages;
    } else {
      packages.value = [];
      error.value = resp.data && resp.data.packages && resp.data.packages.length === 0 ? t('packages.noPlans') : (resp.message || t('packages.noPlans'));
    }
  } catch {
    packages.value = [];
    error.value = t('packages.noTiger');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
// 同一组件在 /country/:code 间复用时不触发 onMounted，需监听 code 重新拉取
watch(() => props.code, load);
</script>

<template>
  <div class="min-h-screen">
    <!-- 头部 -->
    <div class="bg-[var(--gradient-canvas)]">
      <div class="container-page py-28 md:py-32">
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-brand"
        >
          <PhArrowLeft :size="16" weight="bold" /> {{ t('packages.backToHome') }}
        </router-link>
        <div class="mt-6 flex items-center gap-5">
          <div class="h-20 w-20 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <img :src="flag" :alt="regionName" class="h-full w-full object-cover" loading="lazy" />
          </div>
          <div>
            <span class="eyebrow">{{ t('catalog.eyebrow') }}</span>
            <h1 class="mt-1 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ regionName }}</h1>
            <p class="mt-1 text-ink-2">{{ t('packages.plansSub') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 套餐列表 -->
    <div class="container-page py-14">
      <h2 class="mb-6 text-xl font-semibold text-ink">{{ t('packages.plansTitle') }}</h2>

      <!-- 加载中 -->
      <div v-if="loading" class="py-20 text-center text-ink-3">{{ t('packages.loading') }}</div>

      <!-- 错误 / 无套餐 -->
      <div v-else-if="error || packages.length === 0" class="rounded-3xl border border-line bg-white p-14 text-center">
        <div class="text-lg font-semibold text-ink">{{ error || t('packages.noPlans') }}</div>
        <p class="mt-2 text-ink-3">{{ t('packages.noTiger') }}</p>
      </div>

      <!-- 真实套餐卡片 -->
      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <router-link
          v-for="pkg in packages"
          :key="pkg.id"
          :to="'/buy/' + pkg.id"
          class="group flex flex-col rounded-[28px] border border-line bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-float"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="text-lg font-semibold text-ink">
                {{ current === 'zh' ? pkg.name : pkg.nameEn }}
              </div>
              <div class="mt-1 flex items-center gap-2 text-sm text-ink-2">
                <span v-if="pkg.isUnlimited" class="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                  {{ t('buy.unlimited') }}
                </span>
                <span>{{ pkg.gb }}{{ t('buy.gbUnit') }} · {{ pkg.days }}{{ t('buy.daysSuffix') }}</span>
              </div>
            </div>
            <span
              v-if="pkg.isFeatured"
              class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :style="{ background: pkg.tagColor || 'var(--brand-light)', color: pkg.tagColor ? '#fff' : 'var(--brand)' }"
            >
              {{ t('packages.badgeHot') }}
            </span>
          </div>

          <div class="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
            <span class="flex items-center gap-1"><PhWifiHigh :size="16" weight="bold" class="text-brand" />{{ pkg.network }}</span>
            <span class="flex items-center gap-1"><PhLightning :size="16" weight="bold" class="text-brand" />{{ current === 'zh' ? pkg.speed : pkg.speedEn }}</span>
            <span class="flex items-center gap-1"><PhGlobeSimple :size="16" weight="bold" class="text-brand" />{{ current === 'zh' ? pkg.coverage : 'Coverage' }}</span>
          </div>

          <div class="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-3">{{ current === 'zh' ? pkg.desc : pkg.descEn }}</div>

          <div class="mt-5 flex items-center justify-between border-t border-line pt-4">
            <div class="text-xl font-bold text-brand">¥{{ pkg.price }}</div>
            <span class="inline-flex items-center gap-1 text-sm font-medium text-ink-3 transition-colors group-hover:text-brand">
              {{ t('packages.buy') }} <PhCaretRight :size="14" weight="bold" />
            </span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>