import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import zhTW from './zh-TW'
import en from './en'

const LOCALE_KEY = 'yy_locale'
export const LOCALES = [
  { value: 'zh-CN', label: '简体中文', short: '简' },
  { value: 'zh-TW', label: '繁體中文', short: '繁' },
  { value: 'en', label: 'English', short: 'EN' }
]

function getInitialLocale() {
  try {
    const saved = uni.getStorageSync(LOCALE_KEY)
    if (saved && saved !== 'undefined') return saved
  } catch (e) {}
  return 'zh-CN'
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    en
  }
})

// 兜底替换占位符（如 {d}、{name}、{days}），确保命名参数始终被渲染
function interpolate(str, params) {
  if (!params || typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (m, k) =>
    params[k] !== undefined && params[k] !== null ? params[k] : m
  )
}

export function t(key, named) {
  let out = key
  try {
    out = i18n.global.t(key, named)
  } catch (e) {
    out = key
  }
  return interpolate(out, named)
}

// 读取原始消息数据。$t 只适用于字符串 message，遇到数组/对象会回退成 key 字符串，
// 所以直接访问 messages。注意：i18n.global 在此运行时暴露的是 composer，locale/messages 均为 Ref，需用 .value。
export function tRaw(key) {
  try {
    const msgs = i18n.global.messages.value
    const pick = (dict) =>
      key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)
    const locale = i18n.global.locale.value
    const val = pick(msgs[locale])
    return val != null ? val : pick(msgs['zh-CN'])
  } catch (e) {
    return undefined
  }
}

export function getLocale() {
  return i18n.global.locale.value
}

export function setLocale(locale) {
  const available = i18n.global.availableLocales
  const locales = Array.isArray(available) ? available : available.value
  if (!locales.includes(locale)) return
  i18n.global.locale.value = locale
  try {
    uni.setStorageSync(LOCALE_KEY, locale)
  } catch (e) {}
}

// 应用语言（供 App.onLaunch 调用）
export function applyAppLocale() {}

// 设置页面导航栏标题
export function setNavTitle(key, named) {
  try {
    uni.setNavigationBarTitle({ title: t(key, named) })
  } catch (e) {}
}

export default i18n
