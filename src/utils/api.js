import {
  COUNTRIES,
  REGIONS,
  CATEGORIES,
  getHotCountries,
  getHotPackages,
  getPackages,
  getPackageById,
  searchCountries,
  genEsimPayload,
  calcPrice,
  DATA_PACKAGES
} from '@/mock/data'
import { store } from '@/store'
import { genOrderNo } from '@/utils/format'

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms))

function ok(data) {
  return { code: 0, message: 'ok', data }
}

export const api = {
  async getHomeData() {
    await delay(120)
    return ok({
      hotCountries: getHotCountries(8),
      hotPackages: getHotPackages(6),
      regions: REGIONS,
      categories: CATEGORIES
    })
  },

  async getCountries() {
    await delay()
    return ok({ countries: COUNTRIES })
  },

  async searchCountries(keyword) {
    await delay(160)
    return ok({ countries: searchCountries(keyword) })
  },

  async getPackages(countryCode) {
    await delay(200)
    return ok({ packages: getPackages(countryCode) })
  },

  async getPackageDetail(id) {
    await delay(180)
    return ok({ pkg: getPackageById(id) })
  },

  async createOrder({ pkgId, dataIndex, days, email, payMethod = 'alipay' }) {
    await delay(260)
    const pkg = getPackageById(pkgId)
    if (!pkg) return { code: 1, message: '套餐不存在' }
    const dataPkg = pkg.dataPackages[dataIndex]
    if (!dataPkg) return { code: 1, message: '用量包不存在' }
    const orderNo = genOrderNo()
    const price = calcPrice(dataPkg, days, pkg.countryCode)
    const order = {
      orderNo,
      pkgId: pkg.id,
      countryName: pkg.countryName,
      flag: pkg.flag,
      dataLabel: dataPkg.label,
      days,
      price,
      payMethod,
      email,
      status: 'pending',
      createdAt: Date.now()
    }
    store.pushOrder(order)
    return ok({ order })
  },

  async payOrder(orderNo) {
    await delay(900)
    const order = store.orders.find((o) => o.orderNo === orderNo)
    if (!order) return { code: 1, message: '订单不存在' }
    if (order.status === 'paid') return ok({ order })
    store.updateOrder(orderNo, { status: 'paid', paidAt: Date.now() })
    const pkg = getPackageById(order.pkgId)
    const payload = genEsimPayload(pkg, orderNo)
    store.pushEsim({
      id: `esim-${Date.now()}`,
      orderNo,
      pkg: {
        id: pkg.id,
        countryCode: pkg.countryCode,
        countryName: pkg.countryName,
        flag: pkg.flag,
        dataLabel: order.dataLabel,
        days: order.days,
        price: order.price
      },
      activationCode: payload.activationCode,
      iccid: payload.iccid,
      smdp: payload.smdp,
      status: 'pending',
      issuedAt: Date.now(),
      activatedAt: null,
      expireAt: Date.now() + order.days * 86400000,
      used: 0
    })
    return ok({ order })
  },

  async getMyEsims() {
    await delay(160)
    return ok({ esims: store.esims })
  },

  async activateEsim(id) {
    await delay(200)
    store.updateEsim(id, { status: 'activated', activatedAt: Date.now() })
    return ok({ esim: store.esims.find((e) => e.id === id) })
  },

  async deleteEsim(id) {
    await delay(120)
    const i = store.esims.findIndex((e) => e.id === id)
    if (i > -1) store.esims.splice(i, 1)
    return ok({})
  }
}
