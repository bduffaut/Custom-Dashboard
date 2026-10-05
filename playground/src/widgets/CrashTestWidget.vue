<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bomb } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Crashes on demand to show the error boundary
// Only this widget shows a fallback, Retry remounts and resets it

const broken = ref(false)

const output = computed(() => {
  if (broken.value) throw new Error('Malformed CEF record at offset 0x3F2A')
  return ['parsed 1,204 syslog lines', 'parsed 88 CEF records', '0 parse errors']
})
</script>

<template>
  <WidgetCard title="Log parser (unstable)" :icon="Bomb">
    <div class="parser">
      <ul class="mono">
        <li v-for="line in output" :key="line">{{ line }}</li>
      </ul>
      <button class="parser__crash" @click="broken = true">Simulate crash</button>
    </div>
  </WidgetCard>
</template>

<style scoped>
.parser {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}

.parser ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-muted);
}

.parser__crash {
  align-self: flex-start;
  border-color: var(--critical);
  color: var(--critical);
  background: none;
}
</style>
