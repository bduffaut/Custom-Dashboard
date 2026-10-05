<script setup lang="ts">
import { computed } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { Ban, MonitorCheck, ShieldAlert, Timer } from 'lucide-vue-next'
import { useSoc, type MetricKey } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Headline number with a sparkline that hides when the widget is too small

const props = defineProps<{ metric: MetricKey }>()

const soc = useSoc()
const { widget } = useWidget()

const META: Record<MetricKey, { title: string; icon: typeof Ban; unit?: string; lowerIsBetter?: boolean }> = {
  alerts: { title: 'Alerts (24h)', icon: ShieldAlert, lowerIsBetter: true },
  blocked: { title: 'Blocked requests', icon: Ban },
  mttr: { title: 'Mean time to respond', icon: Timer, unit: 'min', lowerIsBetter: true },
  endpoints: { title: 'Endpoints online', icon: MonitorCheck },
}

const meta = computed(() => META[props.metric])
const data = computed(() => soc.metrics[props.metric])

const formatted = computed(() => {
  const value = data.value.value
  if (props.metric === 'endpoints') return `${value}/${soc.hosts.length}`
  return value >= 10000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()
})

// Change over the sparkline window
const delta = computed(() => {
  const history = data.value.history
  if (history.length < 2) return 0
  return history[history.length - 1]! - history[0]!
})
const deltaGood = computed(() => (meta.value.lowerIsBetter ? delta.value <= 0 : delta.value >= 0))

const showSpark = computed(() => widget.value.h >= 2 && widget.value.w >= 2)

const sparkPath = computed(() => {
  const history = data.value.history
  if (history.length < 2) return ''
  const min = Math.min(...history)
  const max = Math.max(...history)
  const span = max - min || 1
  return history
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (history.length - 1)) * 100},${28 - ((v - min) / span) * 26}`)
    .join(' ')
})
</script>

<template>
  <WidgetCard :title="meta.title" :icon="meta.icon" live>
    <div class="kpi">
      <div class="kpi__value">
        {{ formatted }}<span v-if="meta.unit" class="kpi__unit">{{ meta.unit }}</span>
      </div>
      <div class="kpi__delta" :class="deltaGood ? 'is-good' : 'is-bad'">
        {{ delta >= 0 ? '▲' : '▼' }} {{ Math.abs(delta).toLocaleString() }}
        <span class="kpi__window">last 30s</span>
      </div>
      <svg v-if="showSpark" class="kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <path :d="sparkPath" />
      </svg>
    </div>
  </WidgetCard>
</template>

<style scoped>
.kpi {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.kpi__value {
  font-family: var(--display);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.kpi__unit {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}

.kpi__delta {
  font-size: 12px;
  font-weight: 600;
}

.kpi__delta.is-good {
  color: var(--good);
}

.kpi__delta.is-bad {
  color: var(--serious);
}

.kpi__window {
  margin-left: 4px;
  font-weight: 400;
  color: var(--text-faint);
}

.kpi__spark {
  width: 100%;
  height: 28px;
  margin-top: 6px;
  overflow: visible;
}

.kpi__spark path {
  fill: none;
  stroke: var(--series-1);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
}
</style>
