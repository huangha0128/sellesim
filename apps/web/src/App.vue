<script setup lang="ts">
import BrandNav from './components/BrandNav.vue';
import SiteFooter from './components/SiteFooter.vue';
</script>

<template>
  <div class="min-h-screen bg-surface-page">
    <BrandNav />
    <main>
      <router-view />
    </main>
    <SiteFooter />
  </div>
</template>