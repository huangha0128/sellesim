import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发环境将 /api 代理到线上后端（与小程序一致，取真实国家/套餐数据）
      // 生产构建为同源请求（Caddy /api 反代到同一后端），无需本配置
      '/api': 'https://www.bjyyxx.com',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});