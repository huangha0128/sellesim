import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import CountryView from './views/CountryView.vue';

// hash 模式：纯静态 file_server 下深链无需 Caddy try_files 也能工作
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/country/:code', name: 'country', component: CountryView, props: true },
    { path: '/buy/:id', name: 'buy', component: () => import('./views/BuyView.vue'), props: true },
  ],
});