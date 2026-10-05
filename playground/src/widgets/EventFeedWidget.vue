<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pause, Play, Siren } from 'lucide-vue-next'
import { SEVERITIES, useSoc, type SecurityEvent, type Severity } from '../data/soc'
import WidgetCard from './WidgetCard.vue'

// Live event stream with filters and a pause toggle, buttons never start a drag

const soc = useSoc()
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
    <div class="feed">
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
  border-color: var(--border-strong);
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
  animation: slide-in 0.3s ease;
}

@keyframes slide-in {
  from {
    background: var(--accent-soft);
  }
}

.feed__time {
  color: var(--text-faint);
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
