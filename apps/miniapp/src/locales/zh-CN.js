// 简体中文
export default {
  common: {
    loading: '加载中',
    networkError: '网络错误，请重试',
    opFailed: '操作失败',
    view: '查看',
    unknown: '未知',
    know: '知道了',
    needLogin: '请先登录'
  },
  tab: {
    home: '首页',
    esims: '我的 eSIM',
    profile: '我的'
  },
  pageTitle: {
    countries: '选择目的地',
    packages: 'eSIM 套餐',
    detail: '套餐详情',
    checkout: '确认订单',
    payment: '收银台',
    orders: '我的订单',
    orderDetail: '订单详情',
    esims: '我的 eSIM',
    profile: '我的',
    guide: 'eSIM 安装指南'
  },
  index: {
    slogan: '全球 200+ 地区流量',
    titleMain: '全球流量',
    titleSub: '一卡搞定',
    searchPlaceholder: '搜索国家，如「日本 / Japan」',
    searchBtn: '搜索',
    hotCountries: '热门目的地',
    allCountries: '全部国家 ›',
    hotPackages: '热销套餐',
    viewMore: '查看更多 ›',
    gbTraffic: '{gb}GB 流量',
    daysValid: '{days}天有效',
    priceFrom: '¥{price} 起',
    guideTitle: '第一次用 eSIM？',
    guideSub: '3 分钟学会安装 · 全球上网不迷路',
    guideBtn: '查看指南'
  },
  profile: {
    traveler: '全球旅行者',
    clickLogin: '点击登录',
    loginBenefits: '登录后享受更多服务',
    welcomeBack: '欢迎回来',
    statEsims: '我的 eSIM',
    statOrders: '全部订单',
    statRegions: '覆盖地区',
    statusPending: '待付款',
    statusActivate: '待激活',
    statusDone: '已完成',
    statusRefunded: '已退款',
    myPurchases: '我的购买',
    allOrders: '全部订单',
    afterSales: '售后',
    menuEmail: '我的邮箱地址',
    menuFaq: '常见问题',
    menuEsims: '我的 eSIM',
    menuOrders: '我的订单',
    menuGuide: '安装与激活说明',
    menuAbout: '关于我们',
    menuLanguage: '语言设置',
    menuLogout: '退出登录',
    demo: '演示环境 · 数据已对接本地后端服务',
    aboutContent: 'YYeSim v1.0.0（演示版）\n全球 200+ 国家与地区流量套餐，即买即用。',
    logoutConfirm: '确定要退出登录吗？',
    loggedOut: '已退出登录',
    languageTitle: '切换语言'
  },
  login: {
    subtitle: '全球流量，即买即用',
    btn: '支付宝一键登录',
    agreePrefix: '登录即表示同意',
    agreement: '《用户协议》',
    and: '和',
    privacy: '《隐私政策》',
    footer: '全球200+国家和地区可用',
    success: '登录成功',
    failed: '登录失败',
    authFailed: '授权失败，请重试',
    alipayOnly: '仅支持支付宝小程序登录',
    failedRetry: '登录失败，请重试'
  },
  countries: {
    searchPlaceholder: '搜索国家/地区，如 日本 / Japan',
    catAll: '全部',
    catAsia: '亚洲',
    catEurope: '欧洲',
    catAmericas: '美洲',
    catOceania: '大洋洲',
    catAfrica: '非洲',
    catMiddleEast: '中东',
    multiRegion: '多国通用套餐',
    nationalRegions: '国家与地区',
    empty: '没有找到「{kw}」，换个关键词试试'
  },
  packages: {
    noRealName: '免实名',
    instant: '即买即用',
    daysSelectable: '{min}-{max}天可选',
    daysValid: '{days}天有效',
    multiData: '多种流量包',
    view: '查看',
    empty: '该目的地暂未上架套餐',
    tip: '购买后激活码将自动发放到「我的 eSIM」，扫码即可安装'
  },
  package: {
    // 覆盖类型
    coverageMulti: '{region}多国通用',
    coverageLocal: '{region}覆盖',
    // 套餐类型
    typeMulti: '多国通用',
    typeLocal: '本地套餐',
    // 标签
    tagHot: '热门',
    // 特性
    feature1: '即买即用，扫码秒激活',
    feature2: '全程高速 4G/5G 网络',
    feature3: '可开热点，多人共享',
    feature4: '无需实名，无需换卡',
    // 安装步骤
    step1: '购买后复制二维码下方的激活码',
    step2: '手机设置 → 蜂窝网络 → 添加 eSIM',
    step3: '扫码或输入激活码完成安装',
    step4: '到达目的地后开启数据漫游即用'
  },
  detail: {
    tabSelect: '套餐选择',
    tabDetail: '套餐详情',
    tabHot: '热门推荐',
    tabNotice: '使用须知',
    nameSuffix: '{name}流量套餐',
    sold: '已售 9999+',
    instant: '即时激活',
    noRealName: '无需实名',
    globalApp: '支持全球app',
    warn: '本套餐仅限在{name}境内使用，请谨慎购买！',
    selectDays: '选择天数',
    dayUnit: '{d}天',
    selectData: '选择数据用量包',
    perDay: '{unit}GB/天',
    totalGb: '总量 {gb}GB',
    dataPriceHint: '{days}天仅需{price}元',
    coverage: '覆盖地区：',
    registration: '身份登记：',
    noNeed: '不需要',
    detailTitle: '套餐详情',
    descTitle: '套餐说明',
    installTitle: '安装步骤',
    viewFullGuide: '查看完整安装指南 ›',
    noticeTitle: '温馨提示',
    noticeText:
      '1. 有效期从激活当日起算，请到达目的地后再激活。\n2. 流量遵循公平使用原则，超出高速额度后限速。\n3. 请先确认手机支持 eSIM 功能（iPhone XS 及以上等）。',
    dayUnitShort: '天',
    onlyNeed: '仅需',
    network: '通话和短信：',
    pkgTypeIntro: '套餐类型介绍',
    csTitle: '在线客服',
    csNow: '立即咨询',
    androidInstall: '安卓安装eSIM',
    appleInstall: '苹果安装eSIM',
    supportModels: '支持eSIM手机型号汇总',
    usageNotice: 'eSIM使用须知',
    selectPackage: '选择套餐',
    searchPlaceholder: '搜索国家/套餐',
    noResults: '暂无匹配结果',
    originalPrice: '原价 ¥{price}',
    discount: '立减{percent}%',
    buyNow: '立即购买',
    navTitle: 'eSIM 详情',
    renewEntryPrompt: '有已过期的 eSIM？加购/续费到这张卡',
    renewSelect: '选择卡片',
    renewSelectedLabel: '续费到',
    renewClear: '清除',
    renewDrawerTitle: '选择要续费的 eSIM',
    renewNoEsim: '暂无已过期的 eSIM',
    renewNewBuy: '不续费，直接新购',
    renewExpire: '到期 {date}',
    renewCountryMismatch: '该 eSIM 与当前套餐国家不一致',
    renewPreselectGone: '目标卡不可续费，已转为新购'
  },
  checkout: {
    title: '商品信息',
    emailLabel: '接收邮箱',
    emailPlaceholder: '用于接收 eSIM 激活信息',
    emailTip: '购买后激活码将自动发放至「我的 eSIM」，邮箱仅用于消息提醒',
    payMethod: '支付方式',
    alipayName: '支付宝',
    alipayDesc: '安全快捷 · 支持余额/花呗/银行卡',
    wechatName: '微信支付',
    wechatDesc: '即将上线',
    soon: '敬请期待',
    amountLabel: '商品金额',
    discountLabel: '优惠',
    totalLabel: '应付总额',
    agree: '我已阅读并同意《购买服务协议》与《eSIM 使用须知》',
    payActual: '实付',
    submitting: '提交中...',
    submit: '提交订单',
    agreeFirst: '请先阅读并同意协议',
    emailInvalid: '请填写正确的邮箱',
    orderFailed: '下单失败',
    needLogin: '请先登录后再下单',
    needLoginTip: '登录后订单和 eSIM 将归入你的账号',
    skuName: '{name} eSIM',
    sumMeta: '{label} · {days}天 · {network}'
  },
  payment: {
    amountLabel: '支付金额',
    orderNoPrefix: '订单号 {no}',
    goodsLabel: '商品',
    payMethodLabel: '支付方式',
    alipayBalance: '余额支付 · 尾号 8848',
    payNow: '立即支付',
    cancel: '暂不支付',
    noteReal: '将跳转至支付宝完成安全支付',
    noteDemo: '演示环境 · 点击立即支付将模拟支付宝扣款并自动发卡',
    success: '支付成功',
    successSub: 'eSIM 已自动发放至你的账户',
    orderNo: '订单号',
    pkgLabel: '套餐',
    actualAmount: '实付金额',
    viewEsims: '查看我的 eSIM',
    backHome: '返回首页',
    paying: '正在支付...',
    payingSub: '正在通过支付宝完成扣款',
    orderNotFound: '订单不存在',
    createFail: '创建支付失败',
    createFailRetry: '创建支付失败，请重试',
    payFail: '支付失败',
    payFailRetry: '支付失败，请重试',
    orderAbnormal: '订单信息异常',
    orderLabel: '{name} eSIM（{gb}GB / {days}天）'
  },
  orders: {
    emptyTitle: '暂无订单',
    emptySub: '去挑选一张适合你的全球流量套餐吧',
    goBuy: '去购买',
    paid: '已支付',
    pending: '待支付',
    refunded: '已退款',
    tabAll: '全部',
    tabPending: '待付款',
    tabActivate: '待激活',
    tabDone: '已完成',
    tabRefunded: '已退款',
    noMatch: '该分类暂无订单',
    noMatchSub: '换个分类看看吧',
    meta: '{gb}GB · {days}天有效',
    orderNoLabel: '订单号',
    createdAtLabel: '下单时间',
    emailLabel: '接收邮箱',
    payMethodLabel: '支付方式',
    paidAtLabel: '支付时间',
    goPay: '去支付',
    detailNotFound: '订单不存在',
    retry: '重试',
    networkError: '网络异常，请稍后重试',
    back: '返回',
    esimInfo: 'eSIM 激活信息',
    iccid: 'ICCID',
    activationCode: '激活码',
    expireAt: '有效期至',
    orderInfo: '订单信息',
    typeLabel: '订单类型',
    typeNew: '新购',
    typeRenew: '续费',
    refundApply: '申请退款',
    refundApplying: '退款审核中',
    refundApplyingSub: '退款申请已提交，请耐心等待处理',
    refundRejected: '退款被拒绝',
    refundRejectedSub: '您的退款申请已被拒绝',
    refundReasonLabel: '退款原因',
    refundReasonPlaceholder: '请填写退款原因（选填）',
    refundSubmit: '提交申请',
    refundAppliedToast: '退款申请已提交，请耐心等待',
    rejectReasonLabel: '拒绝理由',
    delete: '删除订单',
    deleteTitle: '删除订单',
    deleteConfirm: '确定要删除「{name}」这笔待付款订单吗？',
    deleteSuccess: '订单已删除',
    cancel: '取消'
  },
  esims: {
    title: '我的 eSIM',
    sub: '共 {n} 张 · 全球流量随时可用',
    buy: '+ 购买',
    emptyTitle: '还没有 eSIM',
    emptySub: '去挑选一张适合你的全球流量套餐吧',
    goBuy: '去购买',
    activated: '已激活',
    pending: '待激活',
    meta: '{gb}GB · {days}天有效',
    usage: '已用 {used}GB / {total}GB',
    expireLabel: '有效期至',
    qrTip: '扫描上方二维码，或复制激活码在手机「设置 → 蜂窝网络 → 添加 eSIM」中安装',
    copy: '复制',
    renew: '续费',
    markActivated: '标记已激活',
    collapse: '收起',
    viewCode: '查看激活码',
    delete: '删除',
    activateSuccess: '已标记为激活',
    copied: '激活码已复制',
    deleteTitle: '删除 eSIM',
    deleteConfirm: '删除后该 eSIM 将无法恢复，确定删除吗？',
    deleted: '已删除',
    deleteFailed: '删除失败'
  },
  guide: {
    title: 'eSIM 安装指南',
    sub: '3 分钟搞定，全球上网不迷路',
    compatTitle: '设备兼容性检查',
    compatTxt:
      '支持 eSIM 的设备：iPhone XS/XR 及以上、iPad Pro 及以上、三星 Galaxy S20 及以上、华为 P40/Mate40 Pro 及以上（国行部分机型除外）、小米 12T Pro 及以上等。可前往手机「设置」中查看是否有「添加 eSIM」或「SIM 卡管理」入口。',
    faqTitle: '常见问题',
    stepsIos: [
      {
        image: '/static/guide/zh/ios-1.png',
        title: '连接 Wi-Fi 网络',
        desc: '前往「设置」页面，连接好 Wi-Fi 网络。'
      },
      {
        image: '/static/guide/zh/ios-2.png',
        title: '进入添加 eSIM',
        desc: '设置 → 蜂窝网络 → 点击「添加 eSIM」。'
      },
      {
        image: '/static/guide/zh/ios-3.png',
        title: '点击使用二维码',
        desc: '点击「使用二维码」。'
      },
      {
        image: '/static/guide/zh/ios-4.png',
        title: '点击扫描二维码',
        desc: '点击「扫描二维码」。'
      },
      {
        image: '/static/guide/zh/ios-5.png',
        title: '扫描 Tiger eSIM 二维码',
        desc: '扫描 Tiger eSIM 提供的二维码，然后稍等片刻。'
      },
      {
        image: '/static/guide/zh/ios-6.png',
        title: '开始激活',
        desc: '激活 eSIM，点击「继续」开始激活。'
      },
      {
        image: '/static/guide/zh/ios-7.png',
        title: '选择使用此 eSIM 的位置',
        desc: '选择使用此 eSIM 的位置，点击「继续」。'
      },
      {
        image: '/static/guide/zh/ios-8.png',
        title: '启用此号码并开启漫游',
        desc: '重要操作提醒：安装完成后，前往「设置 → 蜂窝网络」选择「启用此号码」，开启「数据漫游」功能，方可正常上网。'
      },
      {
        image: '/static/guide/zh/ios-9.jpeg',
        title: '无法扫码时手动输入',
        desc: '如果无法扫描二维码，可点击扫码取景框下方的「其他选项」，进入输入激活码页面，复制 Tiger eSIM「手动安装」下方的 SM-DP+ 地址和激活码。'
      },
      {
        image: '/static/guide/zh/ios-10.png',
        title: '粘贴到输入框完成激活',
        desc: '粘贴到输入框，确认码无需输入，点击「下一步」，重复以上步骤即可进行激活。'
      }
    ],
    stepsAndroid: [
      {
        image: '/static/guide/zh/and-1.jpeg',
        title: '连接 Wi-Fi 网络',
        desc: '前往「设置 → 连接 → 网络与互联网」，开启 Wi-Fi 并连接。'
      },
      {
        image: '/static/guide/zh/and-2.jpeg',
        title: '进入 SIM 管理器',
        desc: '设置 → 连接 → 点击「SIM 管理器」或「SIM 卡与移动网络」。'
      },
      {
        image: '/static/guide/zh/and-3.jpeg',
        title: '添加 eSIM',
        desc: '点击「添加 eSIM」或「添加移动套餐」。'
      },
      {
        image: '/static/guide/zh/and-4.jpeg',
        title: '扫码添加',
        desc: '选择「扫一扫」或「扫描运营商二维码」。'
      },
      {
        image: '/static/guide/zh/and-5.jpeg',
        title: '扫描 Tiger eSIM 二维码',
        desc: '将 Tiger eSIM 提供的二维码置于取景框内进行扫描。'
      },
      {
        image: '/static/guide/zh/and-6.jpeg',
        title: '确认添加',
        desc: '出现「要添加 eSIM 吗」提示时，点击「添加」按钮。'
      },
      {
        image: '/static/guide/zh/and-7.jpeg',
        title: '等待下载安装',
        desc: '需等待几分钟，进行下载安装。'
      },
      {
        image: '/static/guide/zh/and-8.jpeg',
        title: '启用 eSIM 并设为移动数据',
        desc: '下载完毕后，找到已安装的 eSIM 卡，点击「启用」或打开开关以激活 eSIM 套餐，移动数据选择 eSIM 卡。'
      },
      {
        image: '/static/guide/zh/and-9.jpeg',
        title: '开启数据漫游',
        desc: '重要操作提醒：安装完成后，请务必前往「设置 → 移动网络」选择安装的 eSIM 卡 → 开启「数据漫游」功能，方可正常上网。不同手机品牌路径略有差异。',
        tips: ['华为在「无线和网络」中', '小米需进入「双卡与移动网络」']
      },
      {
        image: '/static/guide/zh/and-10.png',
        title: '无法扫码时手动输入',
        desc: '如果无法扫描二维码，可点击扫码取景框下方的「输入激活码」，复制 Tiger eSIM 提供的手动安装下方的 SM-DP+ 地址和激活码。'
      },
      {
        image: '/static/guide/zh/and-11.jpeg',
        title: '粘贴到输入框完成激活',
        desc: '粘贴到输入框，点击「完成」，重复以上步骤即可进行激活。'
      }
    ],
    faqs: [
      {
        q: '激活码有效期多久？',
        a: '激活码自购买后长期有效，套餐有效期从「安装激活」当天起算，建议到达目的地后再安装。'
      },
      {
        q: '流量用完了怎么办？',
        a: '可在「我的 eSIM」页面购买新的套餐，或在首页选择相同地区再次下单，新激活码将叠加到已激活的 eSIM 上。'
      },
      {
        q: '可以开热点共享吗？',
        a: '可以。大部分套餐支持开启个人热点，供同行的手机、平板等设备共享流量。'
      },
      {
        q: '到了国外没网怎么办？',
        a: '请确认已安装 eSIM 并开启「数据漫游」开关；若仍无法上网，可尝试手动选择当地运营商网络。'
      }
    ]
  }
}
