<script setup lang="ts">
import { computed } from 'vue'
import { Gauge } from 'lucide-vue-next'
import { useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Risk score from 0 to 100 as a half circle gauge with a labeled band

const soc = useSoc()

const band = computed(() => {
  const r = soc.risk
  if (r >= 80) return { label: 'Critical', cls: 'sev-critical', color: 'var(--critical)' }
  if (r >= 60) return { label: 'High', cls: 'sev-high', color: 'var(--serious)' }
  if (r >= 35) return { label: 'Elevated', cls: 'sev-medium', color: 'var(--warning)' }
  return { label: 'Low', cls: 'sev-low', color: 'var(--good)' }
})

// Arc from 180 to 0 degrees, radius 80, centered at 100,100
function arc(fraction: number) {
  const angle = Math.PI * (1 - fraction)
  const x = 100 + 80 * Math.cos(angle)
  const y = 100 - 80 * Math.sin(angle)
  return `M20,100 A80,80 0 0 1 ${x.toFixed(2)},${y.toFixed(2)}`
}

const valuePath = computed(() => arc(Math.max(0.005, soc.risk / 100)))
</script>

<template>
  <WidgetCard title="Risk score" :icon="Gauge" live>
    <div class="gauge">
      <svg viewBox="0 0 200 124" role="img" :aria-label="`Risk score ${soc.risk} out of 100, ${band.label}`">
        <path class="gauge__track" :d="arc(1)" />
        <path class="gauge__value" :d="valuePath" :stroke="band.color" />
        <text x="100" y="92" text-anchor="middle" class="gauge__number">{{ soc.risk }}</text>
        <text x="20" y="122" text-anchor="middle" class="gauge__end">0</text>
        <text x="180" y="122" text-anchor="middle" class="gauge__end">100</text>
      </svg>
      <span class="badge" :class="band.cls">{{ band.label }}</span>
    </div>
  </WidgetCard>
</template>

<style scoped>
.gauge {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.gauge svg {
  width: 100%;
  max-width: 260px;
  flex: 1;
  min-height: 0;
}

.gauge__track,
.gauge__value {
  fill: none;
  stroke-width: 14;
  stroke-linecap: round;
}

.gauge__track {
  stroke: var(--surface-3);
}

.gauge__value {
  transition: d 0.6s ease, stroke 0.6s;
}

.gauge__number {
  fill: var(--text);
  font-family: var(--display);
  font-size: 40px;
  font-weight: 600;
}

.gauge__end {
  fill: var(--text-faint);
  font-size: 10px;
  font-family: var(--display);
}
</style>
