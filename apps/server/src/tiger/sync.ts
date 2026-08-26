import { PrismaClient } from '@prisma/client';
import { tigerClient } from './client';

/** Tiger -> 本地同步结果（套餐内容不再落本地库，仅国家/区域落库） */
export interface SyncResult {
  regionsSynced: number;
  packagesSynced: number;
  packagesMatched: number;
  packagesUnmatched: number;
  packageTotal: number;
  mode: 'tiger' | 'mock';
  message: string;
}

const MULTI_REGION_CODE: Record<string, string> = {
  '全球 (180+)': 'GLOBAL',
  'Asia': 'ASIA',
  'Caribbean': 'CARIBBEAN',
  'North America': 'NAMERICA',
  'Oceania': 'OCEANIA',
  'Latin America': 'LAMERICA',
  'European': 'EUROPE',
  'African': 'AFRICA',
};
const MULTI_REGION_CODES = new Set(Object.values(MULTI_REGION_CODE));

function normalizeRegionCode(t: any): string {
  const rawCode = String(t.code || t.region_code || '').trim().toUpperCase();
  const en = String(t.name_en || '').trim();
  const cn = String(t.name_cn || '').trim();
  if (rawCode) return rawCode;
  if (MULTI_REGION_CODE[en]) return MULTI_REGION_CODE[en];
  if (MULTI_REGION_CODE[cn]) return MULTI_REGION_CODE[cn];
  return en ? en.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'UNKNOWN' : 'UNKNOWN';
}

function toCountry(t: any) {
  const code = normalizeRegionCode(t);
  const name = t.name_cn || t.name || t.name_en || code;
  const en = t.name_en || t.name || code;
  const flag = t.iconUrl || t.icon || '';
  const intro = en + ' eSIM 流量套餐';
  return {
    code,
    name,
    en,
    flag,
    pinyin: '',
    hot: 0,
    tier: 1,
    cat: MULTI_REGION_CODES.has(code) ? '全球' : '',
    intro,
    iconUrl: t.iconUrl || t.icon || '',
    tigerRegionId: Number(t.id || 0) || undefined,
  };
}

/** 仅同步国家/地区到本地 Country 表（套餐本身实时来自 TigerESIM） */
export async function syncRegionsFromTiger(prisma: PrismaClient): Promise<SyncResult> {
  const regions = await tigerClient.listAllRegions();
  let regionsSynced = 0;
  if (regions.length) {
    for (const t of regions) {
      const c = toCountry(t);
      await prisma.country.upsert({
        where: { code: c.code },
        update: {
          name: c.name,
          en: c.en,
          flag: c.flag,
          pinyin: c.pinyin,
          cat: c.cat,
          intro: c.intro,
          hot: c.hot,
          tier: c.tier,
          iconUrl: c.iconUrl || undefined,
          tigerRegionId: c.tigerRegionId || undefined,
        },
        create: c,
      });
      regionsSynced += 1;
    }
  }
  return {
    regionsSynced,
    packagesSynced: 0,
    packagesMatched: 0,
    packagesUnmatched: 0,
    packageTotal: 0,
    mode: tigerClient.configured ? 'tiger' : 'mock',
    message: '同步区域完成：' + regionsSynced + ' 个',
  };
}

/**
 * 套餐同步：从 TigerESIM 实时获取套餐并统计上报。
 * 套餐内容不落本地库（实时来源 Tiger），此处仅返回可售卖套餐总数，供后台查看。
 */
export async function syncPackagesFromTiger(_prisma: PrismaClient): Promise<SyncResult> {
  const packages = await tigerClient.listAllPackages({
    category: 'esim',
    package_type: 'data',
    is_active: true,
  });
  const uniquePkg = new Map<string, any>();
  for (const p of packages) {
    const rc = normalizeRegionCode(p.region || p);
    uniquePkg.set(rc + ':' + (p.id || p.pid), p);
  }
  const total = uniquePkg.size;
  return {
    regionsSynced: 0,
    packagesSynced: total,
    packagesMatched: 0,
    packagesUnmatched: 0,
    packageTotal: total,
    mode: tigerClient.configured ? 'tiger' : 'mock',
    message: '同步套餐完成（实时）：Tiger 可售套餐 ' + total + ' 条',
  };
}

export async function syncAllFromTiger(prisma: PrismaClient): Promise<SyncResult> {
  if (!tigerClient.configured) {
    return {
      regionsSynced: 0,
      packagesSynced: 0,
      packagesMatched: 0,
      packagesUnmatched: 0,
      packageTotal: 0,
      mode: 'mock',
      message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，无法同步',
    };
  }
  const regionRes = await syncRegionsFromTiger(prisma);
  const pkgRes = await syncPackagesFromTiger(prisma);
  return {
    ...pkgRes,
    regionsSynced: regionRes.regionsSynced,
    message: '全量同步完成：区域 ' + regionRes.regionsSynced + ' 个，Tiger 可售套餐 ' + pkgRes.packageTotal + ' 条',
  };
}