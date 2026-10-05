<script setup lang="ts">
import { computed, ref } from 'vue'
import { ShieldAlert } from 'lucide-vue-next'
import { useTween, useWidgetBox } from '../composables/useWidgetSize'
import { SEVERITIES, useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Alert counts by severity
// Short shows one stacked bar, taller adds a bar per level, taller still a total, wide adds each level share

const soc = useSoc()
const root = ref<HTMLElement>()
const { width, height } = useWidgetBox(root)

const COLORS = { critical: 'var(--critical)', high: 'var(--serious)', medium: 'var(--warning)', low: 'var(--text-faint)' }
const SHORT = { critical: 'Crit', high: 'High', medium: 'Med', low: 'Low' }

const total = computed(() => SEVERITIES.reduce((sum, s) => sum + soc.severityCounts[s], 0))
const shownTotal = useTween(() => total.value)

const rows = computed(() => {
  const max = Math.max(...SEVERITIES.map((s) => soc.severityCounts[s]))
  return SEVERITIES.map((s) => ({
    severity: s,
    count: soc.severityCounts[s],
    pct: (soc.severityCounts[s] / max) * 100,
    share: (soc.severityCounts[s] / Math.max(1, total.value)) * 100,
    color: COLORS[s],
  }))
})

const compact = computed(() => height.value < 110)
const showTotal = computed(() => height.value >= 175)
const showShare = computed(() => width.value >= 520)
// Short labels keep the compact legend on one line in narrow cards
const shortLabels = computed(() => width.value < 380)
</script>

<template>
  <WidgetCard title="Alerts by severity" :icon="ShieldAlert" live>
    <div ref="root" class="sev" :class="{ 'sev--compact': compact }">
      <Transition name="reveal">
        <div v-if="showTotal" class="sev__total">
          <strong class="w-glow">{{ Math.round(shownTotal).toLocaleString() }}</strong>
          <span>alerts in the last 24 hours</span>
        </div>
      </Transition>

      <div v-if="compact || showTotal" class="sev__stack" role="img" :aria-label="rows.map((r) => `${r.count} ${r.severity}`).join(', ')">
        <span v-for="row in rows" :key="row.severity" :style="{ flexGrow: row.count, background: row.color, color: row.color }" :title="`${row.severity}: ${row.count}`" />
      </div>

      <ul v-if="compact" class="sev__legend">
        <li v-for="row in rows" :key="row.severity">
          <span class="sev__dot" :style="{ background: row.color, color: row.color }" />
          <span class="sev__name">{{ shortLabels ? SHORT[row.severity] : row.severity }}</span>
          <span class="sev__count">{{ row.count.toLocaleString() }}</span>
        </li>
      </ul>

      <ul v-else class="sev__rows" :class="{ 'sev__rows--share': showShare }">
        <li v-for="row in rows" :key="row.severity" class="sev__row" :title="`${row.severity}: ${row.count}`">
          <span class="badge" :class="`sev-${row.severity}`">{{ row.severity }}</span>
          <div class="sev__track">
            <div class="sev__bar" :style="{ width: `${row.pct}%`, background: row.color, color: row.color }" />
          </div>
          <span class="sev__count">{{ row.count.toLocaleString() }}</span>
          <Transition name="reveal">
            <span v-if="showShare" class="sev__share">{{ row.share.toFixed(1) }}%</span>
          </Transition>
        </li>
      </ul>
    </div>
  </WidgetCard>
</template>

<style scoped>
.sev {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sev--compact {
  justify-content: center;
}

.sev__total {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sev__total strong {
  font-family: var(--display);
  font-size: clamp(22px, 16cqh, 34px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sev__total span {
  font-size: 12.5px;
  color: var(--text-faint);
}

/* One bar split by share, 2px surface gaps between segments */
.sev__stack {
  display: flex;
  gap: 2px;
  height: 12px;
}

.sev__stack span {
  min-width: 3px;
  transition: flex-grow 0.5s ease;
  box-shadow: 0 0 10px -3px currentColor;
}

.sev__stack span:first-child {
  border-radius: 4px 0 0 4px;
}

.sev__stack span:last-child {
  border-radius: 0 4px 4px 0;
}

.sev__legend {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sev__legend li {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.sev__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.sev__name {
  color: var(--text-muted);
  text-transform: capitalize;
}

.sev__rows {
  flex: 1;
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

.sev__rows--share .sev__row {
  grid-template-columns: 82px 1fr 52px 46px;
}

.sev__row .badge {
  justify-self: start;
}

.sev__track {
  height: 10px;
}

.sev__track {
  border-radius: 0 5px 5px 0;
  background: rgb(255 255 255 / 0.035);
}

.sev__bar {
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  transition: width 0.4s ease;
  box-shadow: 2px 0 10px -3px currentColor;
}

.sev__count {
  text-align: right;
  font-family: var(--display);
  font-size: 13.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sev__share {
  text-align: right;
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>
