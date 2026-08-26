export const TIER_MULT = { 1: 1, 2: 1.15, 3: 1.4, 4: 1.75 }

export const CATEGORIES = ['亚洲', '欧洲', '美洲', '大洋洲', '非洲', '中东']

export const COUNTRIES = [
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
  { code: 'MA', name: '摩洛哥', en: 'Morocco', flag: '🇲🇦', pinyin: 'moluoge', hot: 58, tier: 1, cat: '非洲', intro: '马拉喀什·卡萨布兰卡' }
]

export const REGIONS = [
  { code: 'GLOBAL', name: '全球通用', en: 'Global', flag: '🌍', tier: 4, cat: '全球', intro: '200+ 国家与地区通用' },
  { code: 'ASIA', name: '亚洲多国', en: 'Asia', flag: '🌏', tier: 3, cat: '全球', intro: '覆盖 30+ 亚洲国家和地区' },
  { code: 'EUROPE', name: '欧洲多国', en: 'Europe', flag: '🇪🇺', tier: 3, cat: '全球', intro: '覆盖 40+ 欧洲国家和地区' },
  { code: 'AMERICAS', name: '美洲多国', en: 'Americas', flag: '🌎', tier: 3, cat: '全球', intro: '覆盖 30+ 美洲国家和地区' },
  { code: 'OCEANIA', name: '大洋洲多国', en: 'Oceania', flag: '🏝️', tier: 3, cat: '全球', intro: '澳新及太平洋群岛' }
]

// 可选的天数
export const DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 30, 60, 90, 180, 365]

// 数据用量包选项
export const DATA_PACKAGES = [
  { label: '1GB/天', type: 'perday', value: 1, base: 8.9 },
  { label: '2GB/天', type: 'perday', value: 2, base: 15.9 },
  { label: '总量 10GB', type: 'total', value: 10, base: 49.9 },
  { label: '总量 30GB', type: 'total', value: 30, base: 99.9 },
  { label: '无限流量', type: 'unlimited', value: 0, base: 12.9 }
]

// 区域套餐的基础价格系数
const REGION_PRICE_MULT = {
  GLOBAL: 2.0,
  ASIA: 1.5,
  EUROPE: 1.6,
  AMERICAS: 1.7,
  OCEANIA: 1.6
}

function toPrice(n) {
  return Math.round(n * 10) / 10
}

function findCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || REGIONS.find((c) => c.code === code)
}

// 计算价格：用量包基础价 × 天数 × 地区系数
export function calcPrice(dataPkg, days, countryCode) {
  const region = REGIONS.find((r) => r.code === countryCode)
  const country = findCountry(countryCode)
  if (!country) return 0

  let basePrice = dataPkg.base * days

  // 地区套餐使用区域系数
  if (region) {
    basePrice *= REGION_PRICE_MULT[region.code]
  } else {
    // 国家套餐使用 tier 系数
    basePrice *= TIER_MULT[country.tier]
  }

  return toPrice(basePrice)
}

// 获取套餐系列（每个国家/地区一个）
export function getPackages(countryCode) {
  const c = findCountry(countryCode)
  if (!c) return []
  const region = REGIONS.find((r) => r.code === countryCode)

  // 起步价：1GB/天 × 1天
  const startPkg = DATA_PACKAGES[0]
  const startPrice = calcPrice(startPkg, 1, countryCode)

  return [{
    id: `${countryCode}-SERIES`,
    countryCode: c.code,
    countryName: c.name,
    flag: c.flag,
    network: '4G/5G',
    speed: '高速',
    coverage: region ? `${region.name}区域覆盖` : `${c.name}全国覆盖`,
    type: region ? '区域套餐' : '本地套餐',
    desc: region
      ? `${region.name}通用数据套餐，跨区漫游免切换，即买即用免激活费。`
      : `${c.name}本地数据套餐，即买即用免激活费。`,
    features: [
      '即买即用，扫码秒激活',
      '全程高速 4G/5G 网络',
      '可开热点，多人共享',
      '无需实名，无需换卡'
    ],
    installSteps: [
      '购买后复制二维码下方的激活码',
      '手机设置 → 蜂窝网络 → 添加 eSIM',
      '扫码或输入激活码完成安装',
      '到达目的地后开启数据漫游即用'
    ],
    dayOptions: DAY_OPTIONS,
    dataPackages: DATA_PACKAGES,
    startPrice
  }]
}

export function getAllPackages() {
  const list = []
  COUNTRIES.forEach((c) => {
    list.push(...getPackages(c.code))
  })
  REGIONS.forEach((r) => {
    list.push(...getPackages(r.code))
  })
  return list
}

// 获取套餐系列详情（按 countryCode 查找）
export function getPackageByCountry(countryCode) {
  const list = getPackages(countryCode)
  return list[0] || null
}

// 保留兼容旧 id 查找
export function getPackageById(id) {
  // 新格式 id 为 `${countryCode}-SERIES`
  const countryCode = id.replace('-SERIES', '')
  return getPackageByCountry(countryCode)
}

export function getHotCountries(n = 10) {
  return COUNTRIES.slice()
    .sort((a, b) => b.hot - a.hot)
    .slice(0, n)
}

export function getHotPackages(n = 6) {
  const hot = getHotCountries(n)
  return hot.map((c) => getPackages(c.code)[0]).filter(Boolean)
}

export function searchCountries(keyword) {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return COUNTRIES
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(kw) ||
      c.pinyin.includes(kw) ||
      c.en.toLowerCase().includes(kw) ||
      c.code.toLowerCase() === kw
  )
}

export function genEsimPayload(pkg, orderNo) {
  const rand = () =>
    Array.from({ length: 4 }, () =>
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 31))
    ).join('')
  const smdp = 'smdp.yyesim.net'
  const iccid = '89' + String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
  return {
    smdp,
    activationCode: `LPA:1$${smdp}$${rand()}-${rand()}-${rand()}`,
    iccid,
    orderNo,
    issuedAt: Date.now(),
    validDays: pkg.days
  }
}
