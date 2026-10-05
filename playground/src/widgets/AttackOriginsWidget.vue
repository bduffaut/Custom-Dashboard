<script setup lang="ts">
import { computed } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { Globe } from 'lucide-vue-next'
import { useSoc } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Attack attempts by source country, shows more rows the taller the widget is

const soc = useSoc()
const { widget } = useWidget()

const visibleRows = computed(() => Math.max(3, Math.min(soc.origins.length, widget.value.h + 1)))

const rows = computed(() => {
  const sorted = [...soc.origins].sort((a, b) => b.attempts - a.attempts)
  const max = sorted[0]?.attempts ?? 1
  return sorted.slice(0, visibleRows.value).map((o) => ({ ...o, pct: (o.attempts / max) * 100 }))
})
</script>

<template>
  <WidgetCard title="Top attack origins" :icon="Globe" live>
    <TransitionGroup tag="ol" name="rank" class="origins">
      <li v-for="(row, i) in rows" :key="row.country" class="origins__row">
        <span class="origins__rank mono">{{ i + 1 }}</span>
        <span class="origins__country">{{ row.country }}</span>
        <div class="origins__track">
          <div class="origins__bar" :style="{ width: `${row.pct}%` }" />
        </div>
        <span class="origins__count mono">{{ row.attempts.toLocaleString() }}</span>
      </li>
    </TransitionGroup>
  </WidgetCard>
</template>

<style scoped>
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
  color: var(--text-faint);
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

.origins__bar {
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: var(--series-1);
  transition: width 0.4s ease;
}

.origins__count {
  text-align: right;
  color: var(--text-muted);
  font-size: 12px;
}

.rank-move {
  transition: transform 0.4s ease;
}
</style>
