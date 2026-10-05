<script setup lang="ts">
import { computed, ref } from 'vue'
import { Gauge } from 'lucide-vue-next'
import { useTween, useWidgetBox } from '../composables/useWidgetSize'
import { useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Risk score from 0 to 100 on a banded gauge
// Given room, it opens a breakdown of what is driving the score, beside the gauge when wide, under it when tall

const soc = useSoc()
const root = ref<HTMLElement>()
const { width, height } = useWidgetBox(root)
const score = useTween(() => soc.risk, 700)

// Each layout needs room in both directions, so the breakdown never pushes anything out of the card
const view = computed(() => (width.value >= 460 && height.value >= 150 ? 'wide' : height.value >= 260 ? 'tall' : 'compact'))

const BANDS = [
  { from: 0, to: 35, label: 'Low', cls: 'sev-low', color: 'var(--good)' },
  { from: 35, to: 60, label: 'Elevated', cls: 'sev-medium', color: 'var(--warning)' },
  { from: 60, to: 80, label: 'High', cls: 'sev-high', color: 'var(--serious)' },
  { from: 80, to: 100, label: 'Critical', cls: 'sev-critical', color: 'var(--critical)' },
]
const band = computed(() => BANDS.find((b) => soc.risk < b.to) ?? BANDS[BANDS.length - 1]!)

// Points on a half circle from 180 degrees (left) to 0 (right), centered at 100,100
function polar(fraction: number, radius: number) {
  const angle = Math.PI * (1 - fraction)
  return { x: 100 + radius * Math.cos(angle), y: 100 - radius * Math.sin(angle) }
}
function arc(from: number, to: number, radius: number) {
  const a = polar(from, radius)
  const b = polar(to, radius)
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${radius},${radius} 0 0 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`
}

const fraction = computed(() => Math.min(1, Math.max(0.005, score.value / 100)))
const marker = computed(() => polar(fraction.value, 78))
const ticks = Array.from({ length: 11 }, (_, i) => ({ inner: polar(i / 10, 92), outer: polar(i / 10, i % 5 ? 96 : 99) }))

const drivers = computed(() => {
  const severe = soc.events.slice(0, 20).filter((e) => e.severity === 'critical' || e.severity === 'high').length
  const compromised = soc.hosts.filter((host) => host.status === 'compromised').length
  const cves = soc.vulns.filter((v) => v.status !== 'mitigated' && v.cvss >= 9).length
  return [
    { label: 'Severe alerts in the last 20', value: severe, max: 20 },
    { label: 'Compromised hosts', value: compromised, max: 8 },
    { label: 'Critical CVEs still open', value: cves, max: 4 },
  ]
})
</script>

<template>
  <WidgetCard title="Risk score" :icon="Gauge" live>
    <div ref="root" class="risk" :class="`risk--${view}`">
      <div class="gauge">
        <svg viewBox="0 0 200 116" role="img" :aria-label="`Risk score ${soc.risk} out of 100, ${band.label}`">
          <path class="gauge__track" :d="arc(0, 1, 78)" />
          <path
            v-for="b in BANDS"
            :key="b.label"
            class="gauge__band"
            :class="{ 'is-current': b === band }"
            :d="arc(b.from / 100 + 0.004, b.to / 100 - 0.004, 88)"
            :stroke="b.color"
          />
          <line v-for="(t, i) in ticks" :key="i" class="gauge__tick" :x1="t.inner.x" :y1="t.inner.y" :x2="t.outer.x" :y2="t.outer.y" />
          <path class="gauge__value" :d="arc(0, fraction, 78)" :stroke="band.color" :style="{ color: band.color }" />
          <circle class="gauge__marker" :cx="marker.x" :cy="marker.y" r="5" :fill="band.color" />
          <text x="100" y="96" text-anchor="middle" class="gauge__number w-glow">{{ Math.round(score) }}</text>
        </svg>
        <span class="badge" :class="band.cls">{{ band.label }}</span>
      </div>

      <Transition name="reveal">
        <ul v-if="view !== 'compact'" class="drivers" aria-label="What drives the score">
          <li class="drivers__title">What drives it</li>
          <li v-for="d in drivers" :key="d.label" class="driver">
            <span class="driver__label">{{ d.label }}</span>
            <span class="driver__value">{{ d.value }}</span>
            <span class="w-track"><span class="w-bar" :style="{ width: `${Math.min(100, (d.value / d.max) * 100)}%` }" /></span>
          </li>
        </ul>
      </Transition>
    </div>
  </WidgetCard>
</template>

<style scoped>
.risk {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk--wide {
  flex-direction: row;
  align-items: center;
  gap: 20px;
}

.gauge {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.risk--tall .drivers {
  flex: 0 0 auto;
}

.gauge svg {
  width: 100%;
  max-width: 280px;
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.gauge__track,
.gauge__value {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
}

.gauge__track {
  stroke: rgb(34 211 238 / 0.08);
}

.gauge__band {
  fill: none;
  stroke-width: 3;
  opacity: 0.3;
  transition: opacity 0.4s;
}

.gauge__band.is-current {
  opacity: 0.9;
}

.gauge__tick {
  stroke: var(--cyan);
  stroke-width: 1;
  opacity: 0.35;
}

.gauge__value {
  filter: drop-shadow(0 0 5px currentColor);
  transition: stroke 0.6s;
}

.gauge__marker {
  stroke: var(--surface);
  stroke-width: 2;
  transition: fill 0.6s;
}

.gauge__number {
  fill: var(--text);
  font-family: var(--display);
  font-size: 42px;
  font-weight: 600;
}

.drivers {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.risk--tall .drivers {
  justify-content: flex-start;
  padding-top: 10px;
  border-top: 1px solid var(--grid-line);
}

.drivers__title {
  font-size: 12px;
  color: var(--text-faint);
}

.driver {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.driver__value {
  font-family: var(--display);
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.driver .w-track {
  grid-column: 1 / -1;
  height: 4px;
}

.driver .w-bar {
  display: block;
}
</style>
