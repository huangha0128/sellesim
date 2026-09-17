<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  PhArrowLeft,
  PhLightning,
  PhWifiHigh,
  PhGlobeSimple,
  PhCheck,
  PhCreditCard,
  PhQrCode,
  PhShoppingBagOpen,
} from '@phosphor-icons/vue';
import { get } from '../api/client';
import { useData } from '../api/useData';
import { useI18n } from '../i18n';
import { alipayMiniProgramUrl } from '../config';
import { resolveFlag, isoFlagUrl, flagPlaceholder, onFlagError } from '../utils/flag';
import miniappQr from '../assets/miniapp-qr.png';
import type { PackageView, PackagesResp } from '../api/types';

const props = defineProps<{ code: string }>();
const { t, current } = useI18n();
const { countries } = useData();

const packages = ref<PackageView[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const selectedDays = ref(0);
const selectedGb = ref(0);
const selectedIsUnlimited = ref(false);

const country = computed(
  () =>
    countries.value.find((c) => c.code.toUpperCase() === props.code.toUpperCase()) ??
    countries.value.find((c) => c.code.toLowerCase() === props.code.toLowerCase()),
);
const flag = computed(() =>
  country.value ? resolveFlag(country.value.code, country.value.flag) : isoFlagUrl(props.code) || flagPlaceholder(props.code),
);
const regionName = computed(() =>
  country.value ? (current.value === 'zh' ? country.value.name : country.value.en) : props.code,
);

/** 天数区：全量套餐真实天数的并集，升序（不随所选流量变化） */
const dayCells = computed<number[]>(() =>
  Array.from(new Set(packages.value.filter((p) => p.days).map((p) => p.days))).sort((a, b) => a - b),
);

/** 指定天数下真实存在的流量套餐（限量/不限量按 gb+isUnlimited 去重，取最低价） */
const dataCells = computed(() => {
  if (!packages.value.length || !selectedDays.value) return [];
  const byGb = new Map<string, PackageView>();
  for (const p of packages.value) {
    if (p.days !== selectedDays.value || !p.gb) continue;
    const key = p.gb + (p.isUnlimited ? '-unlimited' : '');
    const cur = byGb.get(key);
    if (!cur || p.price < cur.price) byGb.set(key, p);
  }
  return Array.from(byGb.values())
    .sort((a, b) => Number(a.isUnlimited) - Number(b.isUnlimited) || a.gb - b.gb);
});

/** 当前选中组合对应的真实套餐（该组合最低价） */
const selectedPkg = computed<PackageView | null>(() => {
  if (!packages.value.length) return null;
  const matches = packages.value.filter(
    (p) => p.days === selectedDays.value && p.gb === selectedGb.value && !!p.isUnlimited === selectedIsUnlimited.value,
  );
  if (!matches.length) return null;
  return matches.reduce((min, p) => (p.price < min.price ? p : min), matches[0]);
});

const dataLine = computed(() =>
  selectedPkg.value?.isUnlimited
    ? t('buy.dataU')
    : t('buy.data0', { gb: selectedPkg.value?.gb ?? 0 }),
);

const descText = computed(() =>
  selectedPkg.value ? (current.value === 'zh' ? selectedPkg.value.desc : selectedPkg.value.descEn) : '',
);
const speedText = computed(() =>
  selectedPkg.value ? (current.value === 'zh' ? selectedPkg.value.speed : selectedPkg.value.speedEn) : '',
);
const coverageText = computed(() =>
  selectedPkg.value ? (current.value === 'zh' ? selectedPkg.value.coverage : 'Coverage') : '',
);
const nameText = computed(() =>
  selectedPkg.value ? (current.value === 'zh' ? selectedPkg.value.name : selectedPkg.value.nameEn) : '',
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const resp = await get<PackagesResp>(`/api/packages?countryCode=${encodeURIComponent(props.code)}&all=1`);
    if (resp.code === 0 && resp.data?.packages?.length) {
      packages.value = resp.data.packages;
      pickDefault();
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

function pickDefault() {
  if (!packages.value.length) return;
  const best = [...packages.value].sort((a, b) => a.price - b.price)[0];
  selectedDays.value = best.days;
  selectedGb.value = best.gb;
  selectedIsUnlimited.value = !!best.isUnlimited;
}

/** 指定流量（含限量/不限量）下真实存在的天数（升序） */
function validDaysFor(gb: number, isUnlimited: boolean): number[] {
  return Array.from(
    new Set(
      packages.value
        .filter((p) => p.gb === gb && !!p.isUnlimited === isUnlimited && p.days)
        .map((p) => p.days),
    ),
  ).sort((a, b) => a - b);
}

function selectDays(d: number) {
  selectedDays.value = d;
  if (!dataCells.value.some((c) => c.gb === selectedGb.value && c.isUnlimited === selectedIsUnlimited.value)) {
    const fallback = dataCells.value[0];
    selectedGb.value = fallback ? fallback.gb : 0;
    selectedIsUnlimited.value = fallback ? !!fallback.isUnlimited : false;
  }
}

function selectData(p: PackageView) {
  selectedGb.value = p.gb;
  selectedIsUnlimited.value = !!p.isUnlimited;
  // 天数区固定展示所有可选天数，仅当所选流量不存在当前天数组合时吸附到最接近的有效天数
  const valid = validDaysFor(selectedGb.value, selectedIsUnlimited.value);
  if (valid.length && !valid.includes(selectedDays.value)) {
    const cur = selectedDays.value;
    selectedDays.value = valid.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a), valid[0]);
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
      <div class="container-page py-20 md:py-24">
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-brand"
        >
          <PhArrowLeft :size="16" weight="bold" /> {{ t('packages.backToHome') }}
        </router-link>
        <div class="mt-6 flex items-center gap-5">
          <div class="h-20 w-20 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <img :src="flag" :alt="regionName" class="h-full w-full object-cover" loading="lazy" @error="onFlagError(code, $event)" />
          </div>
          <div>
            <span class="eyebrow">{{ t('catalog.eyebrow') }}</span>
            <h1 class="mt-1 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ regionName }}</h1>
            <p class="mt-1 text-ink-2">{{ t('packages.plansSub') }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="container-page py-14">
      <!-- 加载中 -->
      <div v-if="loading" class="py-20 text-center text-ink-3">{{ t('packages.loading') }}</div>

      <!-- 错误 / 无套餐 -->
      <div v-else-if="error || packages.length === 0" class="rounded-3xl border border-line bg-white p-14 text-center">
        <div class="text-lg font-semibold text-ink">{{ error || t('packages.noPlans') }}</div>
        <p class="mt-2 text-ink-3">{{ t('packages.noTiger') }}</p>
      </div>

      <!-- 按天按流量选择 + 小程序码 -->
      <div v-else class="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <!-- 左：套餐选择 -->
        <div class="rounded-[32px] border border-line bg-white p-8 shadow-card">
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 overflow-hidden rounded-xl border border-line">
              <img :src="flag" :alt="regionName" class="h-full w-full object-cover" loading="lazy" @error="onFlagError(code, $event)" />
            </div>
            <div>
              <h1 class="text-2xl font-semibold tracking-[-0.02em] text-ink">{{ nameText }}</h1>
              <div class="mt-0.5 text-sm text-ink-2">{{ regionName }}</div>
            </div>
            <span
              v-if="selectedPkg?.isUnlimited"
              class="ml-auto shrink-0 rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand"
            >
              {{ t('buy.unlimited') }}
            </span>
          </div>

          <!-- 选择天数 -->
          <div class="mt-8">
            <h2 class="text-base font-semibold text-ink">{{ t('buy.selectDays') }}</h2>
            <div class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              <button
                v-for="d in dayCells"
                :key="d"
                type="button"
                class="relative rounded-2xl border-2 py-3 text-center text-sm font-semibold transition-colors"
                :class="
                  selectedDays === d
                    ? 'border-brand bg-brand-light text-brand'
                    : 'border-transparent bg-brand-lighter text-ink hover:bg-brand-light'
                "
                @click="selectDays(d)"
              >
                {{ current === 'zh' ? `${d}天` : `${d} ${t('buy.daysSuffix')}` }}
                <span
                  v-if="selectedDays === d"
                  class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white"
                >
                  <PhCheck :size="10" weight="bold" />
                </span>
              </button>
            </div>
          </div>

          <!-- 选择数据 -->
          <div class="mt-8">
            <h2 class="text-base font-semibold text-ink">{{ t('buy.selectData') }}</h2>
            <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              <button
                v-for="c in dataCells"
                :key="c.gb + (c.isUnlimited ? '-unlimited' : '')"
                type="button"
                class="relative flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-4 transition-colors"
                :class="
                  selectedGb === c.gb && selectedIsUnlimited === c.isUnlimited
                    ? 'border-brand bg-brand-light'
                    : 'border-transparent bg-brand-lighter hover:bg-brand-light'
                "
                @click="selectData(c)"
              >
                <span
                  class="text-sm font-semibold"
                  :class="selectedGb === c.gb && selectedIsUnlimited === c.isUnlimited ? 'text-brand' : 'text-ink'"
                >
                  {{ c.isUnlimited ? t('buy.unlimited') : t('buy.totalGb', { gb: c.gb }) }}
                </span>
                <span
                  v-if="c.isUnlimited"
                  class="mt-1 text-xs text-brand/70"
                >
                  {{ t('buy.onlyNeed', { price: c.price }) }}
                </span>
                <span
                  v-if="selectedGb === c.gb && selectedIsUnlimited === c.isUnlimited"
                  class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white"
                >
                  <PhCheck :size="10" weight="bold" />
                </span>
              </button>
            </div>
            <p v-if="selectedPkg?.isUnlimited" class="mt-3 rounded-xl bg-brand-lighter px-4 py-3 text-xs leading-relaxed text-brand-deep">
              {{ t('buy.unlimitedHint', { gb: selectedPkg.gb }) }}
            </p>
          </div>

          <!-- 选中套餐摘要 -->
          <div v-if="selectedPkg" class="mt-8 rounded-2xl bg-surface-page p-5">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
                <PhWifiHigh :size="24" weight="bold" />
              </span>
              <div>
                <div class="text-xl font-bold text-ink">{{ dataLine }}</div>
                <div class="mt-0.5 text-sm text-ink-2">{{ selectedPkg.days }}{{ t('buy.daysSuffix') }} · {{ selectedPkg.network }}</div>
              </div>
              <div class="ml-auto text-right">
                <div class="text-sm text-ink-3">{{ t('buy.priceLabel') }}</div>
                <div class="text-2xl font-bold text-brand">¥{{ selectedPkg.price }}</div>
              </div>
            </div>
          </div>

          <p v-if="descText" class="mt-6 leading-relaxed text-ink-2">{{ descText }}</p>

          <!-- 套餐权益 -->
          <div v-if="selectedPkg" class="mt-8">
            <h2 class="text-base font-semibold text-ink">{{ t('buy.benefit') }}</h2>
            <ul class="mt-3 grid gap-2.5 sm:grid-cols-2">
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('catalog.from', { price: selectedPkg.price }) }} {{ dataLine }}
              </li>
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                <span class="flex items-center gap-1"><PhLightning :size="16" weight="bold" class="text-brand" />{{ speedText }}</span>
              </li>
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                <span class="flex items-center gap-1"><PhGlobeSimple :size="16" weight="bold" class="text-brand" />{{ coverageText }}</span>
              </li>
              <li class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('buy.installStepsShort') }}
              </li>
              <li v-if="selectedPkg.soldCount" class="flex items-center gap-2 text-sm text-ink-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light text-brand"><PhCheck :size="14" weight="bold" /></span>
                {{ t('buy.soldCount', { n: selectedPkg.soldCount }) }}
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