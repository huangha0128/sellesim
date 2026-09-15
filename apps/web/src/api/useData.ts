import { ref } from 'vue';
import { get } from './client';
import type { Country, CountriesResp, MinPrice, MinPricesResp } from './types';

const countries = ref<Country[]>([]);
const minByCode = ref<Record<string, MinPrice>>({});
const loaded = ref(false);
const hasPrices = ref(false);
const failSilently = ref(false);

// 后端 /api/countries 不可用时的静态兜底（常用目的地）
const FALLBACK: Country[] = [
  { code: 'JP', name: '日本', en: 'Japan', flag: 'https://flagcdn.com/jp.png', cat: '亚洲', priority: 1, hot: 95, packageCount: 0 },
  { code: 'KR', name: '韩国', en: 'South Korea', flag: 'https://flagcdn.com/kr.png', cat: '亚洲', priority: 2, hot: 90, packageCount: 0 },
  { code: 'TH', name: '泰国', en: 'Thailand', flag: 'https://flagcdn.com/th.png', cat: '亚洲', priority: 3, hot: 88, packageCount: 0 },
  { code: 'SG', name: '新加坡', en: 'Singapore', flag: 'https://flagcdn.com/sg.png', cat: '亚洲', priority: 4, hot: 86, packageCount: 0 },
  { code: 'US', name: '美国', en: 'United States', flag: 'https://flagcdn.com/us.png', cat: '美洲', priority: 5, hot: 84, packageCount: 0 },
  { code: 'FR', name: '法国', en: 'France', flag: 'https://flagcdn.com/fr.png', cat: '欧洲', priority: 6, hot: 82, packageCount: 0 },
  { code: 'DE', name: '德国', en: 'Germany', flag: 'https://flagcdn.com/de.png', cat: '欧洲', priority: 7, hot: 80, packageCount: 0 },
  { code: 'GB', name: '英国', en: 'United Kingdom', flag: 'https://flagcdn.com/gb.png', cat: '欧洲', priority: 8, hot: 78, packageCount: 0 },
  { code: 'AU', name: '澳大利亚', en: 'Australia', flag: 'https://flagcdn.com/au.png', cat: '大洋洲', priority: 9, hot: 76, packageCount: 0 },
  { code: 'AE', name: '阿联酋', en: 'UAE', flag: 'https://flagcdn.com/ae.png', cat: '中东', priority: 10, hot: 70, packageCount: 0 },
  { code: 'ES', name: '西班牙', en: 'Spain', flag: 'https://flagcdn.com/es.png', cat: '欧洲', priority: 11, hot: 68, packageCount: 0 },
  { code: 'IT', name: '意大利', en: 'Italy', flag: 'https://flagcdn.com/it.png', cat: '欧洲', priority: 12, hot: 66, packageCount: 0 },
];

export function useData() {
  if (!loaded.value) {
    loaded.value = true;
    Promise.allSettled([
      get<CountriesResp>('/api/countries'),
      get<MinPricesResp>('/api/packages/min-prices'),
    ]).then(([c, m]) => {
      if (c.status === 'fulfilled' && c.value?.data?.countries?.length) {
        countries.value = c.value.data.countries;
      } else {
        failSilently.value = true;
        countries.value = FALLBACK;
      }
      if (m.status === 'fulfilled') {
        minByCode.value = Object.fromEntries(
          m.value.data.minPrices
            .filter((p) => p.minPrice > 0) // TIGER 未配置/无套餐 → 恒为空 → hasPrices=false
            .map((p) => [p.code, p]),
        );
        hasPrices.value = Object.keys(minByCode.value).length > 0;
      }
    });
  }
  return { countries, minByCode, hasPrices, failSilently };
}