<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { Clock } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Shift clock with UTC, local time and shift progress, plus extra zones when wide

const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const { widget } = useWidget()

const format = (timeZone?: string) =>
  now.value.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone })

const extraZones = [
  { label: 'NYC', zone: 'America/New_York' },
  { label: 'LON', zone: 'Europe/London' },
  { label: 'SGP', zone: 'Asia/Singapore' },
]
const showZones = computed(() => widget.value.w >= 5)

// Shifts start at 06:00, 14:00 and 22:00 UTC
const shift = computed(() => {
  const hours = now.value.getUTCHours() + now.value.getUTCMinutes() / 60
  const start = hours >= 22 || hours < 6 ? 22 : hours >= 14 ? 14 : 6
  const elapsed = (hours - start + 24) % 24
  return { name: start === 6 ? 'Day' : start === 14 ? 'Swing' : 'Night', pct: (elapsed / 8) * 100, left: 8 - elapsed }
})
</script>

<template>
  <WidgetCard title="Shift clock" :icon="Clock">
    <div class="clock">
      <div class="clock__main">
        <div>
          <div class="clock__label">UTC</div>
          <div class="clock__time mono">{{ format('UTC') }}</div>
        </div>
        <div>
          <div class="clock__label">Local</div>
          <div class="clock__time clock__time--small mono">{{ format() }}</div>
        </div>
      </div>
      <div v-if="showZones" class="clock__zones">
        <div v-for="z in extraZones" :key="z.zone">
          <span class="clock__label">{{ z.label }}</span>
          <span class="mono">{{ format(z.zone) }}</span>
        </div>
      </div>
      <div class="clock__shift">
        <div class="clock__shift-text">
          {{ shift.name }} shift · <span class="mono">{{ shift.left.toFixed(1) }}h</span> left
        </div>
        <div class="clock__bar"><div :style="{ width: `${shift.pct}%` }" /></div>
      </div>
    </div>
  </WidgetCard>
</template>

<style scoped>
.clock {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}

.clock__main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 6px 20px;
}

.clock__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-faint);
}

.clock__time {
  font-family: var(--display);
  font-size: 28px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.clock__time--small {
  font-size: 16px;
  color: var(--text-muted);
}

.clock__zones {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.clock__zones div {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.clock__shift-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 5px;
}

.clock__bar {
  height: 4px;
  border-radius: 2px;
  background: var(--surface-3);
}

.clock__bar div {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
}
</style>
