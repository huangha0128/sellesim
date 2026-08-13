import { PrismaClient } from '@prisma/client';
import { tigerClient } from './client';

/** Tiger -> ???????? */
export interface SyncResult {
  regionsSynced: number;
  packagesSynced: number;
  packagesMatched: number;
  packagesUnmatched: number;
  packageTotal: number;
  mode: 'tiger' | 'mock';
  message: string;
}

const FEATURED_GB = [1, 3, 5, 10, 15, 20, 30];
const FEATURED_DAYS = [7, 15, 30];

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

function isFeatured(gb: number, days: number): boolean {
  return FEATURED_GB.includes(gb) && FEATURED_DAYS.includes(days);
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

function toPackage(t: any, countryCode: string, isMulti: boolean) {
  const region = t.region || t;
  const amountMb = Number(t.amount || 0);
  const gb = Math.max(1, Math.round(amountMb / 1024));
  const days = Math.max(1, Number(t.valid_days) || 1);
  const price = Number(t.sales ?? t.nets ?? 0);
  const regionName = region.name_cn || region.name_en || countryCode;
  const name = t.name || regionName + ' ' + gb + 'GB/' + days + '天';
  const desc = Array.isArray(t.description)
    ? t.description.join('、')
    : t.description
      ? String(t.description)
      : gb + 'GB 流量，' + days + ' 天有效';
  const coverage = isMulti ? regionName + '多国通用' : regionName + '覆盖';
  const type = isMulti ? '多国通用' : '本地套餐';
  const tag = isFeatured(gb, days) ? '热门' : '';
  return {
    tigerPkgId: Number(t.id || t.pid || 0),
    tigerPid: String(t.pid || ''),
    countryCode,
    gb,
    days,
    price,
    name,
    desc,
    coverage,
    network: '4G/5G',
    speed: '高速',
    type,
    tag,
    tagColor: tag ? '#FF7A59' : '',
    isFeatured: isFeatured(gb, days),
    features: '["即买即用，扫码秒激活","全程高速 4G/5G 网络","可开热点，多人共享","无需实名，无需换卡"]',
    installSteps: '["购买后复制二维码下方的激活码","手机设置 → 蜂窝网络 → 添加 eSIM","扫码或输入激活码完成安装","到达目的地后开启数据漫游即用"]',
    tigerRaw: JSON.stringify(t),
  };
}
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

export async function syncPackagesFromTiger(prisma: PrismaClient): Promise<SyncResult> {
  const regionsRes = await tigerClient.listAllRegions();
  const regionMap = new Map<string, any>();
  for (const t of regionsRes) regionMap.set(normalizeRegionCode(t), t);
  const packages = await tigerClient.listAllPackages({ category: 'esim', package_type: 'data', is_active: true });
  const uniquePkg = new Map<string, any>();
  for (const p of packages) {
    const rc = normalizeRegionCode(p.region || p);
    uniquePkg.set(rc + ':' + (p.id || p.pid), p);
  }
  const items = Array.from(uniquePkg.values());

  const referencedPkgIds = new Set<string>();
  const [orders, esims] = await Promise.all([
    prisma.order.findMany({ select: { pkgId: true } }),
    prisma.esim.findMany({ select: { pkgId: true } }),
  ]);
  for (const o of orders) referencedPkgIds.add(o.pkgId);
  for (const e of esims) referencedPkgIds.add(e.pkgId);
  await prisma.package.deleteMany({ where: { id: { notIn: Array.from(referencedPkgIds) } } });

  let packagesSynced = 0;
  let packagesMatched = 0;
  for (const p of items) {
    const region = p.region || p;
    const code = normalizeRegionCode(region);
    if (!code || code === 'UNKNOWN') continue;
    const isMulti = MULTI_REGION_CODES.has(code);
    const exists = await prisma.country.findUnique({ where: { code } });
    if (!exists) {
      const t = regionMap.get(code) || region;
      await prisma.country.upsert({ where: { code }, update: { ...toCountry(t) }, create: toCountry(t) });
    }
    const data = toPackage(p, code, isMulti);
    const dup = await prisma.package.findFirst({ where: { countryCode: code, gb: data.gb, days: data.days } });
    if (dup) {
      if (data.price < dup.price) await prisma.package.update({ where: { id: dup.id }, data });
      packagesMatched += 1;
      continue;
    }
    await prisma.package.create({ data });
    packagesSynced += 1;
  }

  // Prune seed leftovers: delete countries with no packages and no order/esim refs
  const allCountries = await prisma.country.findMany();
  for (const c of allCountries) {
    const cnt = await prisma.package.count({ where: { countryCode: c.code } });
    const orderRef = await prisma.order.count({ where: { package: { countryCode: c.code } } });
    const esimRef = await prisma.esim.count({ where: { package: { countryCode: c.code } } });
    if (cnt === 0 && orderRef === 0 && esimRef === 0) {
      await prisma.country.delete({ where: { id: c.id } }).catch(() => {});
    }
  }

  const total = await prisma.package.count();
  return {
    regionsSynced: 0,
    packagesSynced,
    packagesMatched,
    packagesUnmatched: Math.max(0, items.length - packagesSynced - packagesMatched),
    packageTotal: total,
    mode: tigerClient.configured ? 'tiger' : 'mock',
    message: '同步套餐完成：Tiger ' + items.length + ' 条，本地上架 ' + total + ' 条',
  };
}

export async function syncAllFromTiger(prisma: PrismaClient): Promise<SyncResult> {
  if (!tigerClient.configured) {
    return {
      regionsSynced: 0,
      packagesSynced: 0,
      packagesMatched: 0,
      packagesUnmatched: 0,
      packageTotal: await prisma.package.count(),
      mode: 'mock',
      message: '未配置 TIGER_CLIENT_ID / TIGER_CLIENT_SECRET，无法同步',
    };
  }
  const regionRes = await syncRegionsFromTiger(prisma);
  const pkgRes = await syncPackagesFromTiger(prisma);
  return {
    ...pkgRes,
    regionsSynced: regionRes.regionsSynced,
    message: '全量同步完成：区域 ' + regionRes.regionsSynced + ' 个，套餐 ' + pkgRes.packageTotal + ' 条',
  };
}
