<script setup lang="ts">
import { computed } from 'vue'
import { ShieldAlert } from 'lucide-vue-next'
import { SEVERITIES, useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Alert counts by severity, bars so close values stay comparable

const soc = useSoc()

const COLORS = { critical: 'var(--critical)', high: 'var(--serious)', medium: 'var(--warning)', low: 'var(--text-faint)' }

const rows = computed(() => {
  const max = Math.max(...SEVERITIES.map((s) => soc.severityCounts[s]))
  return SEVERITIES.map((s) => ({
    severity: s,
    count: soc.severityCounts[s],
    pct: (soc.severityCounts[s] / max) * 100,
    color: COLORS[s],
  }))
})
</script>

<template>
  <WidgetCard title="Alerts by severity" :icon="ShieldAlert" live>
    <ul class="sev">
      <li v-for="row in rows" :key="row.severity" class="sev__row" :title="`${row.severity}: ${row.count}`">
        <span class="badge" :class="`sev-${row.severity}`">{{ row.severity }}</span>
        <div class="sev__track">
          <div class="sev__bar" :style="{ width: `${row.pct}%`, background: row.color }" />
        </div>
        <span class="sev__count mono">{{ row.count.toLocaleString() }}</span>
      </li>
    </ul>
  </WidgetCard>
</template>

<style scoped>
.sev {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sev__row {
  display: grid;
  grid-template-columns: 82px 1fr 52px;
  align-items: center;
  gap: 10px;
}

.sev__row .badge {
  justify-self: start;
}

.sev__track {
  height: 10px;
}

.sev__bar {
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  transition: width 0.4s ease;
}

.sev__count {
  text-align: right;
  font-size: 13px;
}
</style>
