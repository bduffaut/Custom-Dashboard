<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Activity } from 'lucide-vue-next'
import { useElementSize } from '../composables/useElementSize'
import { useWidgetBox } from '../composables/useWidgetSize'
import { useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Allowed vs blocked requests per second over the last minute, with a hover crosshair
// Small drops the axes for a clean trace, big adds a row of stats under the chart

const soc = useSoc()
const plot = ref<HTMLElement>()
const { width, height } = useElementSize(plot)
const root = ref<HTMLElement>()
const box = useWidgetBox(root)
const ids = { allowed: useId(), blocked: useId() }

const compact = computed(() => box.height.value < 170 || box.width.value < 400)
const showStats = computed(() => box.height.value >= 300)

const pad = computed(() => (compact.value ? { top: 6, right: 4, bottom: 4, left: 4 } : { top: 10, right: 12, bottom: 22, left: 42 }))

const SERIES = [
  { key: 'allowed', label: 'Allowed', color: 'var(--series-1)' },
  { key: 'blocked', label: 'Blocked', color: 'var(--series-2)' },
] as const

const innerW = computed(() => Math.max(0, width.value - pad.value.left - pad.value.right))
const innerH = computed(() => Math.max(0, height.value - pad.value.top - pad.value.bottom))

// Round the axis maximum so tick labels are clean numbers
const yMax = computed(() => {
  const peak = Math.max(1, ...soc.traffic.map((p) => Math.max(p.allowed, p.blocked)))
  const step = 10 ** Math.floor(Math.log10(peak))
  return Math.ceil(peak / step) * step
})
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax.value * f)))

const x = (i: number) => pad.value.left + (soc.traffic.length > 1 ? (i / (soc.traffic.length - 1)) * innerW.value : 0)
const y = (v: number) => pad.value.top + innerH.value - (v / yMax.value) * innerH.value

const paths = computed(() =>
  SERIES.map((s) => {
    const line = soc.traffic.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' ')
    const floor = (pad.value.top + innerH.value).toFixed(1)
    const area = line ? `${line} L${x(soc.traffic.length - 1).toFixed(1)},${floor} L${x(0).toFixed(1)},${floor} Z` : ''
    return { ...s, line, area, gradient: ids[s.key] }
  }),
)

// Hover snaps to the nearest point
const hoverIndex = ref<number | null>(null)
function onMove(event: PointerEvent) {
  const rect = plot.value!.getBoundingClientRect()
  const rel = (event.clientX - rect.left - pad.value.left) / innerW.value
  hoverIndex.value = rel < 0 || rel > 1 ? null : Math.round(rel * (soc.traffic.length - 1))
}
const hovered = computed(() => (hoverIndex.value === null ? null : (soc.traffic[hoverIndex.value] ?? null)))
const tooltipLeft = computed(() => {
  if (hoverIndex.value === null) return 0
  const px = x(hoverIndex.value)
  return px > width.value - 150 ? px - 140 : px + 12
})

const latest = computed(() => soc.traffic[soc.traffic.length - 1])
const lastIndex = computed(() => soc.traffic.length - 1)
const time = (d: Date) => d.toLocaleTimeString([], { hour12: false })

const stats = computed(() => {
  const points = soc.traffic
  if (!points.length) return null
  const allowed = points.reduce((sum, p) => sum + p.allowed, 0)
  const blocked = points.reduce((sum, p) => sum + p.blocked, 0)
  return [
    { label: 'Blocked peak', value: Math.max(...points.map((p) => p.blocked)).toLocaleString() },
    { label: 'Average allowed', value: Math.round(allowed / points.length).toLocaleString() },
    { label: 'Block rate', value: `${((blocked / Math.max(1, allowed + blocked)) * 100).toFixed(1)}%` },
  ]
})
</script>

<template>
  <WidgetCard title="Network traffic, requests per second" :icon="Activity" live>
    <div ref="root" class="chart" :class="{ 'chart--compact': compact }">
      <ul class="chart__legend">
        <li v-for="s in SERIES" :key="s.key">
          <span class="chart__swatch" :style="{ background: s.color }" />
          {{ s.label }}
          <strong>{{ latest ? latest[s.key].toLocaleString() : '-' }}</strong>
        </li>
      </ul>
      <div ref="plot" class="chart__plot" @pointermove="onMove" @pointerleave="hoverIndex = null">
        <svg v-if="width && height" :width="width" :height="height" role="img" aria-label="Allowed and blocked requests per second over the last minute">
          <defs>
            <linearGradient v-for="p in paths" :id="p.gradient" :key="p.key" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" :stop-color="p.color" stop-opacity="0.22" />
              <stop offset="1" :stop-color="p.color" stop-opacity="0" />
            </linearGradient>
          </defs>
          <g v-if="!compact" class="chart__grid">
            <g v-for="t in ticks" :key="t">
              <line :x1="pad.left" :x2="width - pad.right" :y1="y(t)" :y2="y(t)" />
              <text :x="pad.left - 8" :y="y(t)" dy="0.32em" text-anchor="end">{{ t.toLocaleString() }}</text>
            </g>
            <text :x="pad.left" :y="height - 4">-60s</text>
            <text :x="width - pad.right" :y="height - 4" text-anchor="end">now</text>
          </g>
          <path v-for="p in paths" :key="`area-${p.key}`" :d="p.area" :fill="`url(#${p.gradient})`" />
          <path v-for="p in paths" :key="p.key" class="chart__line" :d="p.line" :stroke="p.color" :style="{ color: p.color }" />
          <g v-if="hovered && hoverIndex !== null">
            <line class="chart__crosshair" :x1="x(hoverIndex)" :x2="x(hoverIndex)" :y1="pad.top" :y2="pad.top + innerH" />
            <circle v-for="s in SERIES" :key="s.key" class="chart__dot" :cx="x(hoverIndex)" :cy="y(hovered[s.key])" r="4" :fill="s.color" />
          </g>
        </svg>
        <template v-if="latest && width && !hovered">
          <span
            v-for="s in SERIES"
            :key="s.key"
            class="live-dot"
            :style="{ left: `${x(lastIndex)}px`, top: `${y(latest[s.key])}px`, '--dot': s.color }"
          />
        </template>
        <div v-if="hovered" class="chart__tooltip" :style="{ left: `${tooltipLeft}px` }">
          <div class="chart__tooltip-time">{{ time(hovered.time) }}</div>
          <div v-for="s in SERIES" :key="s.key" class="chart__tooltip-row">
            <span class="chart__swatch" :style="{ background: s.color }" />
            {{ s.label }}
            <strong>{{ hovered[s.key].toLocaleString() }}</strong>
          </div>
        </div>
      </div>
      <Transition name="reveal">
        <dl v-if="showStats && stats" class="chart__stats">
          <div v-for="s in stats" :key="s.label">
            <dt>{{ s.label }}</dt>
            <dd class="w-glow">{{ s.value }}</dd>
          </div>
        </dl>
      </Transition>
    </div>
  </WidgetCard>
</template>

<style scoped>
.chart {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart__legend {
  display: flex;
  gap: 18px;
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
  font-family: var(--display);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
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
  stroke: rgb(34 211 238 / 0.08);
  stroke-width: 1;
  stroke-dasharray: 2 4;
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
  filter: drop-shadow(0 0 3px currentColor);
}

.chart__crosshair {
  stroke: var(--text-faint);
  stroke-width: 1;
  stroke-dasharray: 3 3;
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
  font-family: var(--mono);
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
  font-variant-numeric: tabular-nums;
}

.chart__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--grid-line);
}

.chart__stats dt {
  font-size: 11.5px;
  color: var(--text-faint);
}

.chart__stats dd {
  margin: 0;
  font-family: var(--display);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
