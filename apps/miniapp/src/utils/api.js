const BASE_URL = 'https://www.bjyyxx.com/api';

// 获取当前语言
function getCurrentLang() {
  try {
    return uni.getStorageSync('yy_locale') || 'zh-CN';
  } catch (e) {
    return 'zh-CN';
  }
}

// 将后端嵌套的 package.country 扁平化为前端所需字段
function flattenPkg(p) {
  if (!p) return p;
  const c = p.country || {};
  const isEn = getCurrentLang() === 'en';

  return {
    ...p,
    // 根据语言选择国家名称
    countryName: isEn ? (p.countryNameEn || p.countryName || c.name) : (p.countryName || c.name),
    // 根据语言选择套餐名称
    name: isEn ? (p.nameEn || p.name) : p.name,
    // 根据语言选择描述
    desc: isEn ? (p.descEn || p.desc) : p.desc,
    // 根据语言选择速度描述
    speed: isEn ? (p.speedEn || p.speed) : p.speed,
    // 根据语言选择覆盖范围参数
    coverageParams: isEn ? (p.coverageParamsEn || p.coverageParams) : p.coverageParams,
    flag: p.flag || c.flag,
    features: typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || []),
    installSteps: typeof p.installSteps === 'string' ? JSON.parse(p.installSteps) : (p.installSteps || []),
  };
}

function getToken() {
  try {
    return uni.getStorageSync('yy_token') || '';
  } catch (e) {
    return '';
  }
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    uni.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header: headers,
      success: (res) => resolve(res.data),
      fail: (err) => reject(err),
    });
  });
}

export const api = {
  async login(authCode) {
    return request('POST', '/auth/login', { authCode });
  },

  async updateProfile(userId, data) {
    return request('POST', '/auth/update-profile', { userId, ...data });
  },

  async getHomeData() {
    const [countriesRes, hotRes, minRes] = await Promise.all([
      request('GET', '/countries'),
      request('GET', '/countries/hot?limit=8'),
      request('GET', '/packages/min-prices'),
    ]);
    const allCountries = countriesRes.data.countries || [];
    const regions = allCountries.filter((c) => c.cat === '全球');
    const hotCountries = hotRes.data.countries || [];
    const hotPackages = [];
    for (const c of hotCountries) {
      const pkgRes = await request('GET', `/packages?countryCode=${c.code}`);
      const list = pkgRes.data.packages || [];
      // 取该国最便宜的真实套餐作「热销」卡片，价格与「起价」一致；
      // 真实后端 tag 只有「热门」，故不再用不存在的「热销」去匹配
      const featured = list.filter((p) => p.tag);
      const hot = (featured.length ? featured : list)
        .slice()
        .sort((a, b) => a.price - b.price)[0] || null;
      if (hot) hotPackages.push(flattenPkg(hot));
    }
    const priceMap = {};
    let displayCurrency = 'CNY';
    (minRes.data.minPrices || []).forEach((m) => {
      priceMap[m.code] = m.minPrice;
      if (m.currency) displayCurrency = m.currency;
    });
    return {
      code: 0,
      data: {
        hotCountries,
        hotPackages: hotPackages.slice(0, 6),
        regions,
        priceMap,
        displayCurrency,
        categories: [...new Set(allCountries.filter((c) => c.cat !== '全球').map((c) => c.cat))],
      },
    };
  },

  async getCountries() {
    return request('GET', '/countries');
  },

  async getCountryDetail(code) {
    return request('GET', `/countries/${code}`);
  },

  async searchCountries(keyword) {
    return request('GET', `/countries/search?keyword=${encodeURIComponent(keyword)}`);
  },

  async getPackages(countryCode) {
    const res = await request('GET', `/packages?countryCode=${countryCode}&all=1`);
    res.data.packages = (res.data.packages || []).map(flattenPkg);
    return res;
  },

  // 获取某国家所有套餐（用于 detail 页提取天数和流量选项）
  async getPackagesByCountry(countryCode) {
    const res = await request('GET', `/packages?countryCode=${countryCode}&all=1`);
    res.data.packages = (res.data.packages || []).map(flattenPkg);
    return res;
  },

  async getPackageDetail(id) {
    const res = await request('GET', `/packages/${id}`);
    res.data.pkg = flattenPkg(res.data.pkg);
    return res;
  },

  async createOrder({ pkgId, dataIndex, days, email, payMethod = 'alipay', orderType = 'new', targetEsimId }) {
    return request('POST', '/orders', { pkgId, dataIndex, days, email, payMethod, orderType, targetEsimId });
  },

  async getOrders() {
    const res = await request('GET', '/orders');
    const isEn = getCurrentLang() === 'en';
    // 订单自带套餐快照字段（countryCode/pkgName/pkgNameEn/gb/days），不再嵌套 package
    res.data.orders = (res.data.orders || []).map((o) => {
      // 根据语言选择套餐名称：英文优先用 pkgNameEn，中文用 pkgName
      const countryName = isEn
        ? (o.pkgNameEn || `${o.countryCode || ''} ${o.gb || 0}GB/${o.days || 0} Days`)
        : (o.pkgName || o.countryCode || '未知');
      return {
        id: o.id,
        orderNo: o.orderNo,
        pkgId: o.pkgId,
        email: o.email,
        payMethod: o.payMethod,
        status: o.status,
        price: o.price,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
        countryName,
        countryCode: o.countryCode,
        gb: o.gb,
        days: o.days,
        flag: o.countryCode || '',
        esimStatus: (o.esim && o.esim.status) || '',
        refundedAt: o.refundedAt,
        refundStatus: o.refundStatus,
        refundReason: o.refundReason,
        refundRequestedAt: o.refundRequestedAt,
        refundRejectReason: o.refundRejectReason,
        refundRejectedAt: o.refundRejectedAt,
      };
    });
    return res;
  },

  async refundRequest(orderNo, reason) {
    return request('POST', `/orders/${orderNo}/refund-request`, { reason });
  },

  async createPayment(orderNo, buyerOpenId, buyerId) {
    return request('POST', `/orders/${orderNo}/create-payment`, { buyerOpenId, buyerId });
  },

  async payOrder(orderNo) {
    return request('POST', `/orders/${orderNo}/pay`);
  },

  async getOrder(orderNo) {
    const res = await request('GET', `/orders/${orderNo}`);
    if (res.code === 0 && res.data.order) {
      const o = res.data.order;
      const isEn = getCurrentLang() === 'en';
      // 根据语言选择套餐名称：英文优先用 pkgNameEn，中文用 pkgName
      const countryName = isEn
        ? (o.pkgNameEn || `${o.countryCode || ''} ${o.gb || 0}GB/${o.days || 0} Days`)
        : (o.pkgName || o.countryCode || '未知');
      res.data.order.countryName = countryName;
      // 处理 esim 的 countryName
      if (o.esim) {
        const e = o.esim;
        const esimCountryName = isEn
          ? (e.pkgNameEn || o.pkgNameEn || `${e.countryCode || o.countryCode || ''} ${e.gb ?? o.gb ?? 0}GB/${e.days ?? o.days ?? 0} Days`)
          : (e.pkgName || o.pkgName || e.countryCode || o.countryCode || '未知');
        res.data.order.esim.countryName = esimCountryName;
      }
    }
    return res;
  },

  async deleteOrder(orderNo) {
    return request('DELETE', `/orders/${orderNo}`);
  },

  async getMyEsims() {
    const res = await request('GET', '/esims');
    const isEn = getCurrentLang() === 'en';
    // eSIM 自带套餐快照字段（countryCode/pkgName/pkgNameEn/gb/days），不再嵌套 package
    res.data.esims = (res.data.esims || []).map((e) => {
      const o = e.order || {};
      // 根据语言选择套餐名称：英文优先用 pkgNameEn，中文用 pkgName
      const countryName = isEn
        ? (e.pkgNameEn || o.pkgNameEn || `${e.countryCode || o.countryCode || ''} ${e.gb ?? o.gb ?? 0}GB/${e.days ?? o.days ?? 0} Days`)
        : (e.pkgName || o.pkgName || e.countryCode || o.countryCode || '未知');
      return {
        id: e.id,
        activationCode: e.activationCode,
        iccid: e.iccid,
        smdp: e.smdp,
        status: e.status,
        used: e.used,
        expireAt: e.expireAt,
        pkg: {
          id: e.orderId || e.id,
          countryCode: e.countryCode || o.countryCode || '',
          countryName,
          flag: e.countryCode || '',
          gb: e.gb ?? o.gb ?? 0,
          days: e.days ?? o.days ?? 0,
          price: o.price ?? 0,
        },
      };
    });
    return res;
  },

  async activateEsim(id) {
    return request('POST', `/esims/${id}/activate`);
  },

  async deleteEsim(id) {
    return request('DELETE', `/esims/${id}`);
  },
};
