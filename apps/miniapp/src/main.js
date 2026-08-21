import { createSSRApp } from 'vue'
import App from './App.vue'
import i18n, { t as translate } from './locales'

export function createApp() {
  const app = createSSRApp(App)
  app.use(i18n)
  // 覆盖 i18n 注入的 $t，统一走带占位符兜底替换的翻译函数，避免 {d}、{name} 等未渲染
  app.config.globalProperties.$t = (key, named) => translate(key, named)
  return { app }
}
