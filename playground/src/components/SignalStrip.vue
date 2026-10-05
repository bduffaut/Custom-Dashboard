<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { SEVERITIES, useSoc, type Severity } from '../data/soc'

// Last two minutes of events as ticks, newest on the right and taller when more severe
// The text beside it says the same in words, so color is never the only signal

const WINDOW = 120_000
const WIDTH = 240
const HEIGHT = 28
const TICK_HEIGHT: Record<Severity, number> = { critical: 26, high: 18, medium: 11, low: 6 }

const soc = useSoc()

// Tick every second so ticks slide left even without new events
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const recent = computed(() => soc.events.filter((e) => now.value - e.time.getTime() < WINDOW))

const ticks = computed(() =>
  recent.value.map((e) => ({
    id: e.id,
    x: WIDTH - ((now.value - e.time.getTime()) / WINDOW) * WIDTH,
    h: TICK_HEIGHT[e.severity],
    severity: e.severity,
  })),
)

const counts = computed(() => {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const e of recent.value) out[e.severity]++
  return out
})

const summary = computed(() => {
  const severe = counts.value.critical + counts.value.high
  return severe ? `${severe} critical or high` : 'Nothing severe'
})

const label = computed(
  () => `Events in the last 2 minutes: ${SEVERITIES.map((s) => `${counts.value[s]} ${s}`).join(', ')}`,
)
</script>

<template>
  <div class="signal" :title="label">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" :width="WIDTH" :height="HEIGHT" role="img" :aria-label="label">
      <line class="signal__base" x1="0" :y1="HEIGHT - 0.5" :x2="WIDTH" :y2="HEIGHT - 0.5" />
      <rect
        v-for="t in ticks"
        :key="t.id"
        :class="`tick tick--${t.severity}`"
        :x="t.x - 1"
        :y="HEIGHT - 1 - t.h"
        width="2"
        :height="t.h"
        rx="1"
      />
    </svg>
    <div class="signal__text">
      <span class="signal__count">{{ recent.length }} events</span>
      <span class="signal__severe" :class="{ 'is-hot': counts.critical + counts.high > 0 }">{{ summary }}</span>
    </div>
  </div>
</template>

<style scoped>
.signal {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px 4px 10px;
  border-left: 1px solid var(--border);
}

svg {
  display: block;
  overflow: visible;
  /* Fade the oldest ticks out on the left */
  mask-image: linear-gradient(to right, transparent, #000 25%);
}

.signal__base {
  stroke: var(--border-strong);
  stroke-width: 1;
}

.tick {
  transition: x 1s linear;
}

.tick--critical {
  fill: var(--critical);
}
.tick--high {
  fill: var(--serious);
}
.tick--medium {
  fill: var(--warning);
}
.tick--low {
  fill: var(--text-faint);
}

.signal__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  white-space: nowrap;
}

.signal__count {
  font-family: var(--display);
  font-weight: 600;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.signal__severe {
  font-size: 11.5px;
  color: var(--text-faint);
}

.signal__severe.is-hot {
  color: var(--serious);
}
</style>
