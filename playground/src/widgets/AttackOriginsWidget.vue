<script setup lang="ts">
import { computed, ref } from 'vue'
import { Globe } from 'lucide-vue-next'
import { useWidgetBox } from '../composables/useWidgetSize'
import { useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Attack attempts by source country, shows more rows the taller the widget is
// Narrow drops the bars, wide adds each country share of all attempts

const soc = useSoc()
const root = ref<HTMLElement>()
const { width, height } = useWidgetBox(root)

// As many rows as fit, each about 29px with its gap
const visibleRows = computed(() => Math.max(3, Math.min(soc.origins.length, Math.floor((height.value + 9) / 29))))
const layout = computed(() => (width.value < 300 ? 'narrow' : width.value >= 640 ? 'wide' : 'normal'))
const total = computed(() => soc.origins.reduce((sum, o) => sum + o.attempts, 0))

const rows = computed(() => {
  const sorted = [...soc.origins].sort((a, b) => b.attempts - a.attempts)
  const max = sorted[0]?.attempts ?? 1
  return sorted.slice(0, visibleRows.value).map((o) => ({ ...o, pct: (o.attempts / max) * 100, share: (o.attempts / Math.max(1, total.value)) * 100 }))
})
</script>

<template>
  <WidgetCard title="Top attack origins" :icon="Globe" live>
    <div ref="root" class="origins-box">
    <TransitionGroup tag="ol" name="rank" class="origins" :class="`origins--${layout}`">
      <li v-for="(row, i) in rows" :key="row.country" class="origins__row">
        <span class="origins__rank mono">{{ i + 1 }}</span>
        <span class="origins__country">{{ row.country }}</span>
        <div class="origins__track">
          <div class="w-bar" :style="{ width: `${row.pct}%` }" />
        </div>
        <span class="origins__count">{{ row.attempts.toLocaleString() }}</span>
        <span class="origins__share">{{ row.share.toFixed(1) }}%</span>
      </li>
    </TransitionGroup>
    </div>
  </WidgetCard>
</template>

<style scoped>
.origins-box {
  height: 100%;
}

.origins {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow: hidden;
}

.origins__row {
  display: grid;
  grid-template-columns: 16px 96px 1fr 58px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.origins__rank {
  color: rgb(34 211 238 / 0.55);
  font-size: 11px;
}

.origins__country {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.origins__track {
  height: 8px;
}

.origins__track {
  border-radius: 0 4px 4px 0;
  background: rgb(255 255 255 / 0.03);
}

.origins__count {
  text-align: right;
  font-family: var(--display);
  font-weight: 600;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.origins__share {
  display: none;
  text-align: right;
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.origins__row {
  transition: color 0.15s;
}

.origins__row:hover .w-bar {
  filter: brightness(1.3);
}

.origins--narrow .origins__row {
  grid-template-columns: 16px 1fr auto;
}

.origins--narrow .origins__track {
  display: none;
}

.origins--wide .origins__row {
  grid-template-columns: 16px 110px 1fr 64px 48px;
}

.origins--wide .origins__share {
  display: block;
}

.rank-move {
  transition: transform 0.4s ease;
}
</style>
