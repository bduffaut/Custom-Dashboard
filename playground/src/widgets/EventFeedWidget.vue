<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pause, Play, Siren } from 'lucide-vue-next'
import { useWidgetBox } from '../composables/useWidgetSize'
import { SEVERITIES, useSoc, type SecurityEvent, type Severity } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Live event stream with filters and a pause toggle, buttons never start a drag
// Narrow keeps just severity and message, wide spreads each event across columns

const soc = useSoc()
const root = ref<HTMLElement>()
const { width } = useWidgetBox(root)
const layout = computed(() => (width.value < 380 ? 'narrow' : width.value >= 820 ? 'wide' : 'normal'))
const filter = ref<Severity | 'all'>('all')
const paused = ref(false)
const frozen = ref<SecurityEvent[]>([])

function togglePause() {
  paused.value = !paused.value
  frozen.value = paused.value ? [...soc.events] : []
}

const events = computed(() => {
  const source = paused.value ? frozen.value : soc.events
  return (filter.value === 'all' ? source : source.filter((e) => e.severity === filter.value)).slice(0, 80)
})

const time = (d: Date) => d.toLocaleTimeString([], { hour12: false })
</script>

<template>
  <WidgetCard title="Security events" :icon="Siren" :live="!paused" flush>
    <template #actions>
      <button class="icon-btn" :title="paused ? 'Resume stream' : 'Pause stream'" @click="togglePause">
        <Play v-if="paused" :size="13" />
        <Pause v-else :size="13" />
      </button>
    </template>
    <div ref="root" class="feed" :class="`feed--${layout}`">
      <div class="feed__filters" role="group" aria-label="Filter by severity">
        <button :class="{ 'is-on': filter === 'all' }" @click="filter = 'all'">All</button>
        <button
          v-for="sev in SEVERITIES"
          :key="sev"
          class="badge"
          :class="[`sev-${sev}`, { 'is-on': filter === sev }]"
          @click="filter = sev"
        >
          {{ sev }}
        </button>
      </div>
      <ol class="feed__list">
        <li v-for="event in events" :key="event.id" class="feed__row">
          <span class="feed__time mono">{{ time(event.time) }}</span>
          <span class="badge" :class="`sev-${event.severity}`">{{ event.severity }}</span>
          <span class="feed__dot" :class="`sev-${event.severity}`" :title="event.severity" />
          <span class="feed__msg">{{ event.message }}</span>
          <span class="feed__route mono">{{ event.source }} → {{ event.target }}</span>
        </li>
        <li v-if="!events.length" class="feed__empty">No events match this filter yet.</li>
      </ol>
    </div>
  </WidgetCard>
</template>

<style scoped>
.feed {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.feed__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.feed__filters button {
  padding: 2px 9px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--surface-3);
  opacity: 0.6;
}

.feed__filters button.is-on {
  opacity: 1;
  border-color: rgb(34 211 238 / 0.5);
  box-shadow: 0 0 10px -2px var(--cyan-glow);
}

.feed__list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.feed__row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--grid-line);
  font-size: 13px;
  animation: slide-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  transition: background 0.15s;
}

.feed__row:hover {
  background: linear-gradient(90deg, var(--cyan-soft), transparent 60%);
  box-shadow: inset 2px 0 0 var(--cyan);
}

.feed__dot {
  display: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--badge-color);
  box-shadow: 0 0 6px var(--badge-color);
}

/* Narrow: dot and message only */
.feed--narrow .feed__row {
  grid-template-columns: auto 1fr;
  grid-template-rows: auto;
  align-items: center;
}

.feed--narrow .feed__time,
.feed--narrow .feed__route,
.feed--narrow .feed__row .badge {
  display: none;
}

.feed--narrow .feed__dot {
  display: block;
}

/* Wide: one line per event with the route in its own column */
.feed--wide .feed__row {
  grid-template-columns: 70px 84px 1fr minmax(0, 260px);
  grid-template-rows: auto;
  align-items: center;
}

.feed--wide .feed__route {
  grid-column: auto;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes slide-in {
  from {
    background: var(--cyan-soft);
    transform: translateX(-6px);
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
}

.feed__time {
  color: rgb(34 211 238 / 0.6);
  font-size: 12px;
}

.feed__msg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed__route {
  grid-column: 3;
  font-size: 11px;
  color: var(--text-faint);
}

.feed__empty {
  padding: 20px;
  text-align: center;
  color: var(--text-faint);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
}

.icon-btn:hover {
  background: var(--surface-3);
  color: var(--text);
}
</style>
