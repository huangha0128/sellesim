<script setup lang="ts">
defineProps<{ lang: 'zh' | 'en' }>();
const emit = defineEmits<{ (e: 'change', lang: 'zh' | 'en'): void }>();
</script>

<template>
  <div class="inline-flex items-center rounded-full border border-line bg-white/80 p-1 shadow-card">
    <button
      type="button"
      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
      :class="lang === 'zh' ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink'"
      @click="emit('change', 'zh')"
    >
      中
    </button>
    <button
      type="button"
      class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
      :class="lang === 'en' ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink'"
      @click="emit('change', 'en')"
    >
      EN
    </button>
  </div>
</template>

<style scoped>
button {
  font-variant-numeric: normal;
}
</style>