<script setup lang="ts">
import { computed, ref } from 'vue'
import { Server } from 'lucide-vue-next'
import { useElementSize } from '../composables/useElementSize'
import { useSoc, type Host, type HostStatus } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// One square per host colored by status, resized to fill the widget

const soc = useSoc()

const STATUS: { key: HostStatus; label: string; color: string }[] = [
  { key: 'healthy', label: 'Healthy', color: 'var(--good)' },
  { key: 'at-risk', label: 'At risk', color: 'var(--warning)' },
  { key: 'compromised', label: 'Compromised', color: 'var(--critical)' },
  { key: 'offline', label: 'Offline', color: 'var(--surface-3)' },
]
const colorOf = (status: HostStatus) => STATUS.find((s) => s.key === status)!.color

const counts = computed(() => Object.fromEntries(STATUS.map((s) => [s.key, soc.hosts.filter((h) => h.status === s.key).length])))

const hovered = ref<Host | null>(null)

const area = ref<HTMLElement>()
const { width, height } = useElementSize(area)
const GAP = 3

// Largest square size that fits every host
const cell = computed(() => {
  const count = soc.hosts.length
  for (let size = 48; size > 6; size--) {
    const columns = Math.max(1, Math.floor((width.value + GAP) / (size + GAP)))
    const rows = Math.ceil(count / columns)
    if (rows * (size + GAP) - GAP <= height.value) return { size, columns }
  }
  return { size: 6, columns: Math.max(1, Math.floor(width.value / 9)) }
})
</script>

<template>
  <WidgetCard title="Asset health" :icon="Server" live>
    <div class="hosts">
      <ul class="hosts__legend">
        <li v-for="s in STATUS" :key="s.key">
          <span class="hosts__swatch" :style="{ background: s.color }" />
          {{ s.label }} <strong class="mono">{{ counts[s.key] }}</strong>
        </li>
      </ul>
      <div ref="area" class="hosts__area">
      <div
        class="hosts__grid"
        :style="{ gridTemplateColumns: `repeat(${cell.columns}, ${cell.size}px)`, gridAutoRows: `${cell.size}px` }"
        @pointerleave="hovered = null"
      >
        <div
          v-for="host in soc.hosts"
          :key="host.name"
          class="hosts__cell"
          :class="`is-${host.status}`"
          :style="{ background: colorOf(host.status) }"
          :title="`${host.name} (${host.ip}): ${host.status}`"
          @pointerenter="hovered = host"
        />
      </div>
      </div>
      <div class="hosts__detail mono">
        <template v-if="hovered">{{ hovered.name }} · {{ hovered.ip }} · {{ hovered.status }}</template>
        <template v-else>Hover a square for host details</template>
      </div>
    </div>
  </WidgetCard>
</template>

<style scoped>
.hosts {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hosts__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-muted);
}

.hosts__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hosts__legend strong {
  color: var(--text);
}

.hosts__swatch {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}

.hosts__area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.hosts__grid {
  display: grid;
  gap: 3px;
}

.hosts__cell {
  border-radius: 3px;
  transition: background 0.4s, transform 0.1s;
}

.hosts__cell.is-offline {
  box-shadow: inset 0 0 0 1px var(--border-strong);
}

.hosts__cell:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--text);
}

.hosts__cell.is-compromised {
  animation: alarm 1.2s ease-in-out infinite;
}

@keyframes alarm {
  50% {
    opacity: 0.55;
  }
}

.hosts__detail {
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
