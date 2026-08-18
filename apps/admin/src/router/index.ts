import { createRouter, createWebHistory } from 'vue-router';

// BASE_URL 来自 Vite base 配置：生产部署于 /backend/ 下，开发环境为 /
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '仪表盘' } },
        { path: 'countries', name: 'Countries', component: () => import('../views/Countries.vue'), meta: { title: '国家管理' } },
        { path: 'packages', name: 'Packages', component: () => import('../views/Packages.vue'), meta: { title: '套餐管理' } },
        { path: 'orders', name: 'Orders', component: () => import('../views/Orders.vue'), meta: { title: '订单管理' } },
        { path: 'esims', name: 'Esims', component: () => import('../views/Esims.vue'), meta: { title: 'eSIM 管理' } },
        { path: 'cards', name: 'Cards', component: () => import('../views/Cards.vue'), meta: { title: '卡片管理' } },
      ],
    },
  ],
});

export default router;
