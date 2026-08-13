import { reactive } from 'vue'

const USER_KEY = 'yy_user'
const TOKEN_KEY = 'yy_token'
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

function loadStr(key, fallback) {
  try {
    return uni.getStorageSync(key) || fallback
  } catch (e) {
    return fallback
  }
}

function saveStr(key, value) {
  try {
    uni.setStorageSync(key, value)
  } catch (e) {}
}

export const store = reactive({
  token: loadStr(TOKEN_KEY, ''),
  user: load(USER_KEY, { id: '', nickname: '', avatar: '', email: '' }),
  orders: load(ORDERS_KEY, []),
  esims: load(ESIMS_KEY, []),

  get isLoggedIn() {
    return !!this.token
  },

  setToken(token) {
    this.token = token
    saveStr(TOKEN_KEY, token)
  },

  setUser(user) {
    Object.assign(this.user, user)
    save(USER_KEY, this.user)
  },

  login(token, user) {
    this.setToken(token)
    this.setUser(user)
  },

  logout() {
    this.token = ''
    this.user = { id: '', nickname: '', avatar: '', email: '' }
    saveStr(TOKEN_KEY, '')
    save(USER_KEY, this.user)
  },

  setOrders(list) {
    this.orders = list
    save(ORDERS_KEY, this.orders)
  },
  setEsims(list) {
    this.esims = list
    save(ESIMS_KEY, this.esims)
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
