<script setup lang="ts">
import BrandNav from './components/BrandNav.vue';
import SiteFooter from './components/SiteFooter.vue';
import MiniappQrModal from './components/MiniappQrModal.vue';
</script>

<template>
  <div class="min-h-screen bg-surface-page">
    <BrandNav />
    <main>
      <router-view />
    </main>
    <SiteFooter />
    <!-- 全局小程序码弹窗：任意位置的「扫码进入小程序」都复用它 -->
    <MiniappQrModal />
  </div>
</template>
