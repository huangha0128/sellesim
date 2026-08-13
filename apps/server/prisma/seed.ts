import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 36 个国家（与小程序 mock 保持一致）
const COUNTRIES = [
  { code: 'JP', name: '日本', en: 'Japan', flag: '🇯🇵', pinyin: 'riben', hot: 99, tier: 2, cat: '亚洲', intro: '东京·大阪·京都全境高速覆盖' },
  { code: 'KR', name: '韩国', en: 'Korea', flag: '🇰🇷', pinyin: 'hanguo', hot: 96, tier: 2, cat: '亚洲', intro: '首尔·釜山·济州岛畅快连接' },
  { code: 'TH', name: '泰国', en: 'Thailand', flag: '🇹🇭', pinyin: 'taiguo', hot: 95, tier: 1, cat: '亚洲', intro: '曼谷·普吉·清迈全程在线' },
  { code: 'SG', name: '新加坡', en: 'Singapore', flag: '🇸🇬', pinyin: 'xinjiapo', hot: 93, tier: 2, cat: '亚洲', intro: '全岛高速，机场即买即用' },
  { code: 'MY', name: '马来西亚', en: 'Malaysia', flag: '🇲🇾', pinyin: 'malaixiya', hot: 90, tier: 1, cat: '亚洲', intro: '吉隆坡·沙巴·兰卡威覆盖' },
  { code: 'ID', name: '印度尼西亚', en: 'Indonesia', flag: '🇮🇩', pinyin: 'yindunixiya', hot: 88, tier: 1, cat: '亚洲', intro: '巴厘岛·雅加达高速上网' },
  { code: 'VN', name: '越南', en: 'Vietnam', flag: '🇻🇳', pinyin: 'yuenan', hot: 86, tier: 1, cat: '亚洲', intro: '河内·胡志明·岘港在线' },
  { code: 'PH', name: '菲律宾', en: 'Philippines', flag: '🇵🇭', pinyin: 'feilvbin', hot: 80, tier: 1, cat: '亚洲', intro: '马尼拉·长滩岛·宿务覆盖' },
  { code: 'HK', name: '中国香港', en: 'Hong Kong', flag: '🇭🇰', pinyin: 'xianggang', hot: 89, tier: 2, cat: '亚洲', intro: '全港高速，商旅首选' },
  { code: 'MO', name: '中国澳门', en: 'Macau', flag: '🇲🇴', pinyin: 'aomen', hot: 78, tier: 2, cat: '亚洲', intro: '澳门全境即买即用' },
  { code: 'TW', name: '中国台湾', en: 'Taiwan', flag: '🇹🇼', pinyin: 'taiwan', hot: 82, tier: 2, cat: '亚洲', intro: '台北·高雄·垦丁覆盖' },
  { code: 'IN', name: '印度', en: 'India', flag: '🇮🇳', pinyin: 'yindu', hot: 70, tier: 1, cat: '亚洲', intro: '新德里·孟买·班加罗尔' },
  { code: 'LK', name: '斯里兰卡', en: 'Sri Lanka', flag: '🇱🇰', pinyin: 'sililanka', hot: 65, tier: 1, cat: '亚洲', intro: '科伦坡·康提全岛覆盖' },
  { code: 'MV', name: '马尔代夫', en: 'Maldives', flag: '🇲🇻', pinyin: 'maerdaifu', hot: 84, tier: 2, cat: '亚洲', intro: '海岛度假，全程在线' },
  { code: 'AE', name: '阿联酋', en: 'UAE', flag: '🇦🇪', pinyin: 'alianqiu', hot: 85, tier: 2, cat: '亚洲', intro: '迪拜·阿布扎比高速覆盖' },
  { code: 'TR', name: '土耳其', en: 'Turkey', flag: '🇹🇷', pinyin: 'tuerqi', hot: 83, tier: 1, cat: '亚洲', intro: '伊斯坦布尔·卡帕多奇亚' },
  { code: 'GB', name: '英国', en: 'United Kingdom', flag: '🇬🇧', pinyin: 'yingguo', hot: 87, tier: 3, cat: '欧洲', intro: '伦敦·曼彻斯特·爱丁堡' },
  { code: 'FR', name: '法国', en: 'France', flag: '🇫🇷', pinyin: 'faguo', hot: 86, tier: 3, cat: '欧洲', intro: '巴黎·尼斯·普罗旺斯' },
  { code: 'IT', name: '意大利', en: 'Italy', flag: '🇮🇹', pinyin: 'yidali', hot: 85, tier: 3, cat: '欧洲', intro: '罗马·米兰·威尼斯覆盖' },
  { code: 'DE', name: '德国', en: 'Germany', flag: '🇩🇪', pinyin: 'deguo', hot: 81, tier: 3, cat: '欧洲', intro: '柏林·慕尼黑·法兰克福' },
  { code: 'ES', name: '西班牙', en: 'Spain', flag: '🇪🇸', pinyin: 'xibanya', hot: 79, tier: 3, cat: '欧洲', intro: '马德里·巴塞罗那覆盖' },
  { code: 'GR', name: '希腊', en: 'Greece', flag: '🇬🇷', pinyin: 'xila', hot: 77, tier: 2, cat: '欧洲', intro: '雅典·圣托里尼·克里特岛' },
  { code: 'CH', name: '瑞士', en: 'Switzerland', flag: '🇨🇭', pinyin: 'ruishi', hot: 76, tier: 4, cat: '欧洲', intro: '苏黎世·日内瓦·因特拉肯' },
  { code: 'NL', name: '荷兰', en: 'Netherlands', flag: '🇳🇱', pinyin: 'helan', hot: 72, tier: 3, cat: '欧洲', intro: '阿姆斯特丹·鹿特丹覆盖' },
  { code: 'PT', name: '葡萄牙', en: 'Portugal', flag: '🇵🇹', pinyin: 'putaoya', hot: 68, tier: 2, cat: '欧洲', intro: '里斯本·波尔图高速连接' },
  { code: 'RU', name: '俄罗斯', en: 'Russia', flag: '🇷🇺', pinyin: 'eluosi', hot: 60, tier: 3, cat: '欧洲', intro: '莫斯科·圣彼得堡覆盖' },
  { code: 'US', name: '美国', en: 'United States', flag: '🇺🇸', pinyin: 'meiguo', hot: 94, tier: 4, cat: '美洲', intro: '全美 4G/5G 高速覆盖' },
  { code: 'CA', name: '加拿大', en: 'Canada', flag: '🇨🇦', pinyin: 'jianada', hot: 74, tier: 4, cat: '美洲', intro: '多伦多·温哥华·班夫覆盖' },
  { code: 'MX', name: '墨西哥', en: 'Mexico', flag: '🇲🇽', pinyin: 'moxige', hot: 66, tier: 1, cat: '美洲', intro: '坎昆·墨西哥城高速上网' },
  { code: 'BR', name: '巴西', en: 'Brazil', flag: '🇧🇷', pinyin: 'baxi', hot: 62, tier: 1, cat: '美洲', intro: '圣保罗·里约热内卢覆盖' },
  { code: 'AR', name: '阿根廷', en: 'Argentina', flag: '🇦🇷', pinyin: 'agenting', hot: 55, tier: 1, cat: '美洲', intro: '布宜诺斯艾利斯覆盖' },
  { code: 'AU', name: '澳大利亚', en: 'Australia', flag: '🇦🇺', pinyin: 'aodaliya', hot: 92, tier: 3, cat: '大洋洲', intro: '悉尼·墨尔本·黄金海岸' },
  { code: 'NZ', name: '新西兰', en: 'New Zealand', flag: '🇳🇿', pinyin: 'xinxilan', hot: 75, tier: 3, cat: '大洋洲', intro: '奥克兰·皇后镇全程覆盖' },
  { code: 'EG', name: '埃及', en: 'Egypt', flag: '🇪🇬', pinyin: 'aiji', hot: 63, tier: 1, cat: '非洲', intro: '开罗·卢克索·红海覆盖' },
  { code: 'ZA', name: '南非', en: 'South Africa', flag: '🇿🇦', pinyin: 'nanfei', hot: 52, tier: 1, cat: '非洲', intro: '开普敦·约翰内斯堡覆盖' },
  { code: 'MA', name: '摩洛哥', en: 'Morocco', flag: '🇲🇦', pinyin: 'moluoge', hot: 58, tier: 1, cat: '非洲', intro: '马拉喀什·卡萨布兰卡' },
];

// 5 个区域（多国通用套餐），cat 固定为「全球」
const REGIONS = [
  { code: 'GLOBAL', name: '全球通用', en: 'Global', flag: '🌍', pinyin: 'quanqiu', hot: 98, tier: 4, cat: '全球', intro: '200+ 国家与地区通用' },
  { code: 'ASIA', name: '亚洲多国', en: 'Asia', flag: '🌏', pinyin: 'yazhou', hot: 91, tier: 3, cat: '全球', intro: '覆盖 30+ 亚洲国家和地区' },
  { code: 'EUROPE', name: '欧洲多国', en: 'Europe', flag: '🇪🇺', pinyin: 'ouzhou', hot: 89, tier: 3, cat: '全球', intro: '覆盖 40+ 欧洲国家和地区' },
  { code: 'AMERICAS', name: '美洲多国', en: 'Americas', flag: '🌎', pinyin: 'meizhou', hot: 73, tier: 3, cat: '全球', intro: '覆盖 30+ 美洲国家和地区' },
  { code: 'OCEANIA', name: '大洋洲多国', en: 'Oceania', flag: '🏝️', pinyin: 'dayangzhou', hot: 71, tier: 3, cat: '全球', intro: '澳新及太平洋群岛' },
];

const TIER_MULT: Record<number, number> = { 1: 1, 2: 1.15, 3: 1.4, 4: 1.75 };
const BASE_PLANS = [
  { gb: 1, days: 7, base: 12.9, tag: '超值', tagColor: '#14B8A6' },
  { gb: 3, days: 7, base: 22.9, tag: '热销', tagColor: '#FF7A59' },
  { gb: 5, days: 15, base: 34.9, tag: '', tagColor: '' },
  { gb: 10, days: 30, base: 59.9, tag: '热销', tagColor: '#FF7A59' },
  { gb: 20, days: 30, base: 94.9, tag: '大流量', tagColor: '#0EA5E9' },
];
const REGION_PLAN_PRICES: Record<string, number[]> = {
  GLOBAL: [24.9, 44.9, 69.9, 119.9, 189.9],
  ASIA: [19.9, 34.9, 54.9, 94.9, 149.9],
  EUROPE: [19.9, 36.9, 57.9, 99.9, 159.9],
  AMERICAS: [19.9, 38.9, 59.9, 99.9, 164.9],
  OCEANIA: [19.9, 36.9, 57.9, 99.9, 159.9],
};

async function main() {
  console.log('开始播种数据...');
  const all = [...COUNTRIES, ...REGIONS];

  for (const c of all) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
    console.log(`  国家/区域：${c.name} (${c.code})`);

    const isRegion = c.cat === '全球';
    const regionPrices = REGION_PLAN_PRICES[c.code];

    for (const p of BASE_PLANS) {
      const price = isRegion
        ? regionPrices[BASE_PLANS.indexOf(p)]
        : Math.round(p.base * TIER_MULT[c.tier] * 10) / 10;
      await prisma.package.upsert({
        where: {
          countryCode_gb_days: { countryCode: c.code, gb: p.gb, days: p.days },
        },
        update: {
          price,
          tag: p.tag,
          tagColor: p.tagColor,
          type: isRegion ? '区域套餐' : '本地套餐',
        },
        create: {
          countryCode: c.code,
          gb: p.gb,
          days: p.days,
          price,
          network: '4G/5G',
          speed: '高速',
          coverage: isRegion ? `${c.name}区域覆盖` : `${c.name}全国覆盖`,
          type: isRegion ? '区域套餐' : '本地套餐',
          tag: p.tag,
          tagColor: p.tagColor,
          desc: isRegion
            ? `${c.name}通用数据套餐，跨区漫游免切换，${p.gb}GB 流量 ${p.days} 天有效。`
            : `${c.name}本地数据套餐，${p.gb}GB 流量 ${p.days} 天有效，即买即用免激活费。`,
          features: JSON.stringify([
            '即买即用，扫码秒激活',
            '全程高速 4G/5G 网络',
            '可开热点，多人共享',
            '无需实名，无需换卡',
          ]),
          installSteps: JSON.stringify([
            '购买后复制二维码下方的激活码',
            '手机设置 → 蜂窝网络 → 添加 eSIM',
            '扫码或输入激活码完成安装',
            '到达目的地后开启数据漫游即用',
          ]),
        },
      });
    }
    console.log(`    套餐：5 档`);
  }

  console.log('播种完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
