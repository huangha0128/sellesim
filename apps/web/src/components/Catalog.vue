<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhGlobeSimple } from '@phosphor-icons/vue';
import { useData } from '../api/useData';
import { useI18n } from '../i18n';
import { openQr } from '../qrModal';
import CountryCard from './CountryCard.vue';
import type { Country } from '../api/types';

const { countries, minByCode, hasPrices } = useData();
const { t, current } = useI18n();

// 首页只展示后端数据库真实有套餐的国家（min-prices >0 的国家/区域）
const available = computed<Country[]>(() =>
  hasPrices.value ? countries.value.filter((c) => minByCode.value[c.code]) : [],
);

type ContKey = 'asia' | 'europe' | 'americas' | 'oceania' | 'africa' | 'middleEast' | 'global' | 'other';

const CAT_MAP: Record<string, ContKey> = {
  亚洲: 'asia',
  asia: 'asia',
  欧洲: 'europe',
  europe: 'europe',
  美洲: 'americas',
  americas: 'americas',
  北美洲: 'americas',
  南美洲: 'americas',
  大洋洲: 'oceania',
  oceania: 'oceania',
  非洲: 'africa',
  africa: 'africa',
  中东: 'middleEast',
  middleEast: 'middleEast',
  全球: 'global',
  global: 'global',
};

function contKey(c: Country): ContKey {
  return CAT_MAP[c.cat] || 'other';
}

// 该大洲分组下的卡片排序：优先热门、其次按名称
function byContinent(cont: ContKey) {
  return available.value
    .filter((c) => contKey(c) === cont)
    .slice()
    .sort((a, b) => Number(b.hot) - Number(a.hot) || a.code.localeCompare(b.code));
}

const presentConts = computed<ContKey[]>(() => {
  const keys = new Set<ContKey>();
  available.value.forEach((c) => {
    const k = contKey(c);
    if (k !== 'other') keys.add(k);
  });
  const order: ContKey[] = ['asia', 'europe', 'americas', 'oceania', 'africa', 'middleEast', 'global'];
  return order.filter((k) => keys.has(k));
});

// 后端未标注大洲（cat 为空）的有货国家，归入「其他」
const uncategorized = computed<Country[]>(() => byContinent('other'));

const activeTab = ref<string>('all');
const groupList = computed(() => {
  if (activeTab.value === 'all') {
    const groups = presentConts.value.map((k) => ({ key: k, items: byContinent(k) }));
    if (uncategorized.value.length) groups.push({ key: 'other', items: uncategorized.value });
    return groups;
  }
  if (activeTab.value === 'other') {
    return uncategorized.value.length ? [{ key: 'other', items: uncategorized.value }] : [];
  }
  return presentConts.value.filter((k) => k === activeTab.value).map((k) => ({ key: k, items: byContinent(k) }));
});
</script>

<template>
  <section id="destinations" class="bg-surface-page py-20">
    <div class="container-page">
      <div class="section-head text-center">
        <span class="eyebrow">{{ t('catalog.eyebrow') }}</span>
        <h2 class="mt-4 text-3xl font-semibold tracking-[-0.02em] text-ink md:text-4xl">{{ t('catalog.title') }}</h2>
        <p class="mx-auto mt-3 max-w-xl text-ink-2">{{ t('catalog.sub') }}</p>
      </div>

      <!-- 大洲 Tab -->
      <div class="mb-10 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'all' ? 'bg-brand text-white' : 'bg-white text-ink-2 border border-line hover:text-brand'"
          @click="activeTab = 'all'"
        >
          {{ t('catalog.allRegions') }}
        </button>
        <button
          v-for="k in presentConts"
          :key="k"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          :class="activeTab === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:text-brand'"
          @click="activeTab = k"
        >
          {{ t(`catalog.tabs.${k}`) }}
        </button>
        <button
          v-if="uncategorized.length"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
          :class="activeTab === 'other' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:text-brand'"
          @click="activeTab = 'other'"
        >
          {{ t('catalog.tabs.other') }}
        </button>
      </div>

      <!-- 分组展示 -->
      <div v-for="group in groupList" :key="group.key" class="mb-10 last:mb-0">
        <div class="mb-4 flex items-center gap-2">
          <PhGlobeSimple :size="20" weight="bold" class="text-brand" />
          <h3 class="text-xl font-semibold text-ink">{{ t(`catalog.tabs.${group.key}`) }}</h3>
          <span class="text-sm text-ink-3">· {{ group.items.length }}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <CountryCard
            v-for="c in group.items"
            :key="c.code"
            :code="c.code"
            :name="c.name"
            :en="c.en"
            :flag="c.flag"
            :hot="c.hot"
            :has-prices="hasPrices"
            :min="minByCode[c.code]?.minPrice"
            :currency="minByCode[c.code]?.currency"
          />
        </div>
      </div>

      <div v-if="available.length === 0" class="py-16 text-center text-ink-3">
        {{ t('catalog.loading') }}
      </div>

      <div class="mt-12 text-center">
        <a
          href="#"
          class="inline-flex items-center gap-2 rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:text-brand"
          @click.prevent="openQr()"
        >
          {{ current === 'zh' ? '本国查看更多与选购' : 'Browse all countries' }}
          ·
          {{ t('catalog.viewMore') }}
        </a>
      </div>
    </div>
  </section>
</template>