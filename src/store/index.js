import { reactive } from 'vue'

const USER_KEY = 'yy_user'
const ORDERS_KEY = 'yy_orders'
const ESIMS_KEY = 'yy_esims'

function load(key, fallback) {
  try {
    const raw = uni.getStorageSync(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    return fallback
  }
}

function save(key, value) {
  try {
    uni.setStorageSync(key, JSON.stringify(value))
  } catch (e) {}
}

function seedEsims() {
  const now = Date.now()
  return [
    {
      id: 'demo-0001',
      orderNo: 'DPH202608010001',
      pkg: {
        id: 'JP-3G7D',
        countryCode: 'JP',
        countryName: '日本',
        flag: '🇯🇵',
        gb: 3,
        days: 7,
        price: 26.3
      },
      activationCode: 'LPA:1$smdp.yyesim.net$K7QX-H2PV-8MKA',
      iccid: '89886120012345678901',
      smdp: 'smdp.yyesim.net',
      status: 'activated',
      issuedAt: now - 2 * 86400000,
      activatedAt: now - 2 * 86400000,
      expireAt: now + 5 * 86400000,
      used: 0.4
    }
  ]
}

export const store = reactive({
  user: load(USER_KEY, { nickname: '旅行者', avatar: '🦋', email: 'traveller@yy.esim' }),
  orders: load(ORDERS_KEY, []),
  esims: load(ESIMS_KEY, seedEsims()),
  setUser(user) {
    Object.assign(this.user, user)
    save(USER_KEY, this.user)
  },
  pushOrder(order) {
    this.orders.unshift(order)
    save(ORDERS_KEY, this.orders)
  },
  pushEsim(esim) {
    this.esims.unshift(esim)
    save(ESIMS_KEY, this.esims)
  },
  updateEsim(id, patch) {
    const i = this.esims.findIndex((e) => e.id === id)
    if (i > -1) {
      Object.assign(this.esims[i], patch)
      save(ESIMS_KEY, this.esims)
    }
  },
  updateOrder(orderNo, patch) {
    const i = this.orders.findIndex((o) => o.orderNo === orderNo)
    if (i > -1) {
      Object.assign(this.orders[i], patch)
      save(ORDERS_KEY, this.orders)
    }
  }
})
