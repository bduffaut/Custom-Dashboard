<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Ban, MonitorCheck, ShieldAlert, Timer, TrendingDown, TrendingUp } from 'lucide-vue-next'
import { useTween, useWidgetBox } from '../composables/useWidgetSize'
import { useSoc, type MetricKey } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Headline number that opens up as it grows
// Narrow shows just the number, short puts a sparkline beside it, tall adds a full chart and stats

const props = defineProps<{ metric: MetricKey }>()

const soc = useSoc()
const root = ref<HTMLElement>()
const { width, height } = useWidgetBox(root)
const gradient = useId()

const META: Record<MetricKey, { title: string; icon: typeof Ban; unit?: string; lowerIsBetter?: boolean }> = {
  alerts: { title: 'Alerts (24h)', icon: ShieldAlert, lowerIsBetter: true },
  blocked: { title: 'Blocked requests', icon: Ban },
  mttr: { title: 'Mean time to respond', icon: Timer, unit: 'min', lowerIsBetter: true },
  endpoints: { title: 'Endpoints online', icon: MonitorCheck },
}

const meta = computed(() => META[props.metric])
const data = computed(() => soc.metrics[props.metric])
const shown = useTween(() => data.value.value)

const view = computed(() => (width.value < 200 ? 'tiny' : height.value >= 150 ? 'tall' : 'row'))

function format(value: number) {
  const n = Math.round(value)
  if (props.metric === 'endpoints') return `${n}/${soc.hosts.length}`
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()
}

// Change over the sparkline window
const delta = computed(() => {
  const history = data.value.history
  return history.length < 2 ? 0 : history[history.length - 1]! - history[0]!
})
const deltaGood = computed(() => (meta.value.lowerIsBetter ? delta.value <= 0 : delta.value >= 0))

const stats = computed(() => {
  const history = data.value.history
  if (!history.length) return null
  const sum = history.reduce((a, b) => a + b, 0)
  return { peak: Math.max(...history), low: Math.min(...history), average: sum / history.length }
})

// Points scaled into a 100 by 40 box, with a little headroom so the line never touches the edges
const points = computed(() => {
  const history = data.value.history
  if (history.length < 2) return []
  const min = Math.min(...history)
  const span = Math.max(...history) - min || 1
  return history.map((v, i) => ({ x: (i / (history.length - 1)) * 100, y: 36 - ((v - min) / span) * 32 }))
})
const line = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '))
const area = computed(() => (line.value ? `${line.value} L100,40 L0,40 Z` : ''))
const last = computed(() => points.value[points.value.length - 1])
</script>

<template>
  <WidgetCard :title="meta.title" :icon="meta.icon" live>
    <div ref="root" class="kpi" :class="`kpi--${view}`">
      <div class="kpi__head">
        <div class="kpi__value w-glow">
          {{ format(shown) }}<span v-if="meta.unit" class="kpi__unit">{{ meta.unit }}</span>
        </div>
        <div class="kpi__delta" :class="deltaGood ? 'is-good' : 'is-bad'">
          <component :is="delta >= 0 ? TrendingUp : TrendingDown" :size="13" />
          {{ Math.abs(delta).toLocaleString() }}
          <span v-if="view !== 'tiny'" class="kpi__window">last 30s</span>
        </div>
      </div>

      <Transition name="reveal">
        <div v-if="view !== 'tiny' && points.length" class="kpi__spark">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient :id="gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="var(--series-1)" stop-opacity="0.35" />
                <stop offset="1" stop-color="var(--series-1)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path class="kpi__area" :d="area" :fill="`url(#${gradient})`" />
            <path class="kpi__line" :d="line" />
          </svg>
          <span v-if="last" class="live-dot" :style="{ left: `${last.x}%`, top: `${(last.y / 40) * 100}%` }" />
        </div>
      </Transition>

      <Transition name="reveal">
        <dl v-if="view === 'tall' && stats" class="kpi__stats">
          <div>
            <dt>Peak</dt>
            <dd>{{ format(stats.peak) }}</dd>
          </div>
          <div>
            <dt>Low</dt>
            <dd>{{ format(stats.low) }}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{{ format(stats.average) }}</dd>
          </div>
        </dl>
      </Transition>
    </div>
  </WidgetCard>
</template>

<style scoped>
.kpi {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

/* Sizes follow the card through container units, so a smaller card means smaller text, never clipped text */
.kpi__value {
  font-family: var(--display);
  font-size: clamp(22px, min(58cqh, 19cqw), 40px);
  font-weight: 600;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.kpi__unit {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}

.kpi__delta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.kpi__delta.is-good {
  color: var(--good);
}

.kpi__delta.is-bad {
  color: var(--serious);
}

.kpi__window {
  font-weight: 400;
  color: var(--text-faint);
}

.kpi__spark {
  position: relative;
  height: 30px;
}

.kpi__spark svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.kpi__line {
  fill: none;
  stroke: var(--series-1);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 4px var(--cyan-glow));
}

/* Tiny: one big centered number */
.kpi--tiny {
  align-items: center;
  text-align: center;
}

.kpi--tiny .kpi__value {
  font-size: clamp(20px, min(45cqh, 21cqw), 34px);
}

/* Row: number on the left, line filling the rest of the width */
.kpi--row {
  flex-direction: row;
  align-items: center;
  gap: 16px;
}

.kpi--row .kpi__spark {
  flex: 1;
  align-self: stretch;
  margin: 6px 0;
}

/* Tall: bigger number, chart takes the free height, stats along the bottom */
.kpi--tall {
  justify-content: flex-start;
}

.kpi--tall .kpi__value {
  font-size: clamp(32px, 22cqh, 52px);
}

.kpi--tall .kpi__spark {
  flex: 1;
  min-height: 40px;
  margin-top: 4px;
}

.kpi__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--grid-line);
}

.kpi__stats dt {
  font-size: 11.5px;
  color: var(--text-faint);
}

.kpi__stats dd {
  margin: 0;
  font-family: var(--display);
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
