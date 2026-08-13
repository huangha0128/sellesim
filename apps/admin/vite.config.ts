import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 6661,
    proxy: {
      '/api': {
        target: 'http://localhost:6660',
        changeOrigin: true,
      },
    },
  },
});
