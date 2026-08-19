const BASE_URL = 'https://www.bjyyxx.com/api';

// 将后端嵌套的 package.country 扁平化为前端所需字段
function flattenPkg(p) {
  if (!p) return p;
  const c = p.country || {};
  return {
    ...p,
    countryName: p.countryName || c.name,
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
      const hot = list.find((p) => p.tag === '热销') || list[1];
      if (hot) hotPackages.push(flattenPkg(hot));
    }
    const priceMap = {};
    (minRes.data.minPrices || []).forEach((m) => {
      priceMap[m.code] = m.minPrice;
    });
    return {
      code: 0,
      data: {
        hotCountries,
        hotPackages: hotPackages.slice(0, 6),
        regions,
        priceMap,
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

  async createOrder({ pkgId, dataIndex, days, email, payMethod = 'alipay' }) {
    return request('POST', '/orders', { pkgId, dataIndex, days, email, payMethod });
  },

  async getOrders() {
    const res = await request('GET', '/orders');
    res.data.orders = (res.data.orders || []).map((o) => {
      const pkg = o.package || {};
      const c = (pkg.country) || {};
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
        countryName: c.name || pkg.countryCode || '未知',
        countryCode: pkg.countryCode,
        gb: pkg.gb,
        days: pkg.days,
        flag: c.flag,
      };
    });
    return res;
  },

  async createPayment(orderNo) {
    return request('POST', `/orders/${orderNo}/create-payment`);
  },

  async payOrder(orderNo) {
    return request('POST', `/orders/${orderNo}/pay`);
  },

  async getOrder(orderNo) {
    return request('GET', `/orders/${orderNo}`);
  },

  async getMyEsims() {
    const res = await request('GET', '/esims');
    res.data.esims = (res.data.esims || []).map((e) => {
      const pkg = (e.order && e.order.package) || {};
      const c = pkg.country || {};
      return {
        id: e.id,
        activationCode: e.activationCode,
        iccid: e.iccid,
        smdp: e.smdp,
        status: e.status,
        used: e.used,
        expireAt: e.expireAt,
        pkg: {
          id: pkg.id,
          countryCode: pkg.countryCode,
          countryName: c.name,
          flag: c.flag,
          gb: pkg.gb,
          days: pkg.days,
          price: pkg.price,
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
