<script setup lang="ts">
import { computed, ref } from 'vue'
import { Activity } from 'lucide-vue-next'
import { useElementSize } from '../composables/useElementSize'
import { useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Allowed vs blocked requests per second over the last minute
// Redraws to fit on resize and has a hover crosshair

const soc = useSoc()
const plot = ref<HTMLElement>()
const { width, height } = useElementSize(plot)

const PAD = { top: 10, right: 12, bottom: 22, left: 42 }

const SERIES = [
  { key: 'allowed', label: 'Allowed', color: 'var(--series-1)' },
  { key: 'blocked', label: 'Blocked', color: 'var(--series-2)' },
] as const

const innerW = computed(() => Math.max(0, width.value - PAD.left - PAD.right))
const innerH = computed(() => Math.max(0, height.value - PAD.top - PAD.bottom))

// Round the axis maximum so tick labels are clean numbers
const yMax = computed(() => {
  const peak = Math.max(1, ...soc.traffic.map((p) => Math.max(p.allowed, p.blocked)))
  const step = 10 ** Math.floor(Math.log10(peak))
  return Math.ceil(peak / step) * step
})
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax.value * f)))

const x = (i: number) => PAD.left + (soc.traffic.length > 1 ? (i / (soc.traffic.length - 1)) * innerW.value : 0)
const y = (v: number) => PAD.top + innerH.value - (v / yMax.value) * innerH.value

const paths = computed(() =>
  SERIES.map((s) => ({
    ...s,
    d: soc.traffic.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' '),
  })),
)

// Hover snaps to the nearest point
const hoverIndex = ref<number | null>(null)
function onMove(event: PointerEvent) {
  const rect = plot.value!.getBoundingClientRect()
  const rel = (event.clientX - rect.left - PAD.left) / innerW.value
  hoverIndex.value = rel < 0 || rel > 1 ? null : Math.round(rel * (soc.traffic.length - 1))
}
const hovered = computed(() => (hoverIndex.value === null ? null : soc.traffic[hoverIndex.value] ?? null))
const tooltipLeft = computed(() => {
  if (hoverIndex.value === null) return 0
  const px = x(hoverIndex.value)
  return px > width.value - 150 ? px - 140 : px + 12
})

const latest = computed(() => soc.traffic[soc.traffic.length - 1])
const time = (d: Date) => d.toLocaleTimeString([], { hour12: false })
</script>

<template>
  <WidgetCard title="Network traffic · req/s" :icon="Activity" live>
    <div class="chart">
      <ul class="chart__legend">
        <li v-for="s in SERIES" :key="s.key">
          <span class="chart__swatch" :style="{ background: s.color }" />
          {{ s.label }}
          <strong class="mono">{{ latest ? latest[s.key].toLocaleString() : '-' }}</strong>
        </li>
      </ul>
      <div ref="plot" class="chart__plot" @pointermove="onMove" @pointerleave="hoverIndex = null">
        <svg v-if="width && height" :width="width" :height="height" role="img" aria-label="Allowed and blocked requests per second over the last minute">
          <g class="chart__grid">
            <g v-for="t in ticks" :key="t">
              <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(t)" :y2="y(t)" />
              <text :x="PAD.left - 8" :y="y(t)" dy="0.32em" text-anchor="end">{{ t.toLocaleString() }}</text>
            </g>
            <text :x="PAD.left" :y="height - 4">-60s</text>
            <text :x="width - PAD.right" :y="height - 4" text-anchor="end">now</text>
          </g>
          <path v-for="p in paths" :key="p.key" class="chart__line" :d="p.d" :stroke="p.color" />
          <g v-if="hovered && hoverIndex !== null">
            <line class="chart__crosshair" :x1="x(hoverIndex)" :x2="x(hoverIndex)" :y1="PAD.top" :y2="PAD.top + innerH" />
            <circle
              v-for="s in SERIES"
              :key="s.key"
              class="chart__dot"
              :cx="x(hoverIndex)"
              :cy="y(hovered[s.key])"
              r="4"
              :fill="s.color"
            />
          </g>
        </svg>
        <div v-if="hovered" class="chart__tooltip" :style="{ left: `${tooltipLeft}px` }">
          <div class="chart__tooltip-time mono">{{ time(hovered.time) }}</div>
          <div v-for="s in SERIES" :key="s.key" class="chart__tooltip-row">
            <span class="chart__swatch" :style="{ background: s.color }" />
            {{ s.label }}
            <strong class="mono">{{ hovered[s.key].toLocaleString() }}</strong>
          </div>
        </div>
      </div>
    </div>
  </WidgetCard>
</template>

<style scoped>
.chart {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chart__legend {
  display: flex;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-muted);
}

.chart__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chart__legend strong {
  color: var(--text);
  font-weight: 600;
}

.chart__swatch {
  width: 10px;
  height: 3px;
  border-radius: 2px;
}

.chart__plot {
  position: relative;
  flex: 1;
  min-height: 0;
}

.chart__plot svg {
  position: absolute;
  inset: 0;
}

.chart__grid line {
  stroke: var(--grid-line);
  stroke-width: 1;
}

.chart__grid text {
  fill: var(--text-faint);
  font-size: 10.5px;
  font-family: var(--display);
}

.chart__line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.chart__crosshair {
  stroke: var(--text-faint);
  stroke-width: 1;
}

.chart__dot {
  stroke: var(--surface);
  stroke-width: 2;
}

.chart__tooltip {
  position: absolute;
  top: 6px;
  min-width: 128px;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-3);
  border: 1px solid var(--border-strong);
  font-size: 12px;
  pointer-events: none;
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
}

.chart__tooltip-time {
  margin-bottom: 4px;
  color: var(--text-faint);
  font-size: 11px;
}

.chart__tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}

.chart__tooltip-row strong {
  margin-left: auto;
  color: var(--text);
}
</style>
