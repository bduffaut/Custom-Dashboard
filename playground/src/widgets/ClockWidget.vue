<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Clock } from 'lucide-vue-next'
import { useWidgetBox } from '../composables/useWidgetSize'
import WidgetCard from './WidgetCard.vue'

// Shift clock in UTC, the time logs use
// Taller adds local time, wider adds other offices, and the tallest swaps the progress bar for a full day timeline

const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const root = ref<HTMLElement>()
const { width, height } = useWidgetBox(root)
const compact = computed(() => height.value < 100)
const showLocal = computed(() => height.value >= 100)
const showZones = computed(() => width.value >= 420 && height.value >= 100)
const showTimeline = computed(() => height.value >= 230)

const format = (timeZone?: string, seconds = true) =>
  now.value.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, timeZone })

const ZONES = [
  { label: 'New York', zone: 'America/New_York' },
  { label: 'London', zone: 'Europe/London' },
  { label: 'Singapore', zone: 'Asia/Singapore' },
]

// Shifts start at 06:00, 14:00 and 22:00 UTC
const SHIFTS = [
  { name: 'Night', from: 0, to: 6 },
  { name: 'Day', from: 6, to: 14 },
  { name: 'Swing', from: 14, to: 22 },
  { name: 'Night', from: 22, to: 24 },
]

const hours = computed(() => now.value.getUTCHours() + now.value.getUTCMinutes() / 60 + now.value.getUTCSeconds() / 3600)
const shift = computed(() => {
  const start = hours.value >= 22 || hours.value < 6 ? 22 : hours.value >= 14 ? 14 : 6
  const elapsed = (hours.value - start + 24) % 24
  return { name: start === 6 ? 'Day' : start === 14 ? 'Swing' : 'Night', pct: (elapsed / 8) * 100, left: 8 - elapsed }
})
const handover = computed(() => {
  const left = shift.value.left
  return left >= 1 ? `${Math.floor(left)}h ${Math.round((left % 1) * 60)}m` : `${Math.round(left * 60)}m`
})
</script>

<template>
  <WidgetCard title="Shift clock" :icon="Clock">
    <div ref="root" class="clock" :class="{ 'clock--compact': compact }">
      <div class="clock__main">
        <div>
          <div class="clock__label">UTC</div>
          <div class="clock__time w-glow">{{ format('UTC') }}</div>
        </div>
        <Transition name="reveal">
          <div v-if="showLocal">
            <div class="clock__label">Local</div>
            <div class="clock__time clock__time--small">{{ format() }}</div>
          </div>
        </Transition>
      </div>

      <Transition name="reveal">
        <div v-if="showZones" class="clock__zones">
          <div v-for="z in ZONES" :key="z.zone">
            <span class="clock__label">{{ z.label }}</span>
            <span class="clock__zone-time">{{ format(z.zone, false) }}</span>
          </div>
        </div>
      </Transition>

      <div class="clock__shift">
        <div class="clock__shift-text">
          <strong>{{ shift.name }} shift</strong>
          <span>handover in {{ handover }}</span>
        </div>
        <div v-if="!showTimeline" class="clock__bar"><div :style="{ width: `${shift.pct}%` }" /></div>
        <Transition name="reveal">
          <div v-if="showTimeline" class="timeline" aria-label="Shifts across the UTC day">
            <div class="timeline__track">
              <span
                v-for="(s, i) in SHIFTS"
                :key="i"
                class="timeline__shift"
                :class="{ 'is-now': s.name === shift.name && hours >= s.from && hours < s.to }"
                :style="{ left: `${(s.from / 24) * 100}%`, width: `${((s.to - s.from) / 24) * 100}%` }"
              >
                <span v-if="s.to - s.from > 4">{{ s.name }}</span>
              </span>
              <span class="timeline__now" :style="{ left: `${(hours / 24) * 100}%` }" />
            </div>
            <div class="timeline__scale"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
          </div>
        </Transition>
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
  gap: 10px;
}

.clock__main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 6px 22px;
}

.clock__label {
  font-size: 12px;
  color: var(--text-faint);
}

.clock__time {
  font-family: var(--display);
  font-size: clamp(22px, min(26cqh, 13cqw), 34px);
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.clock__time--small {
  font-size: 17px;
  color: var(--text-muted);
}

.clock__zones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
}

.clock__zones div {
  display: flex;
  flex-direction: column;
}

.clock__zone-time {
  font-family: var(--display);
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.clock__shift-text {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12.5px;
  color: var(--text-faint);
}

.clock__shift-text strong {
  font-weight: 600;
  color: var(--text-muted);
}

.clock__bar {
  height: 4px;
  border-radius: 2px;
  background: var(--surface-3);
}

.clock__bar div {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, rgb(34 211 238 / 0.3), var(--cyan));
  box-shadow: 0 0 8px var(--cyan-glow);
}

/* Compact: time and shift on one line, progress underneath */
.clock--compact {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'main text'
    'bar bar';
  align-items: center;
  align-content: center;
  gap: 8px 12px;
}

.clock--compact .clock__main {
  grid-area: main;
}

.clock--compact .clock__main .clock__label {
  display: none;
}

.clock--compact .clock__time {
  font-size: clamp(20px, min(55cqh, 13cqw), 32px);
}

.clock--compact .clock__shift {
  display: contents;
}

.clock--compact .clock__shift-text {
  grid-area: text;
  flex-direction: column;
  align-items: flex-end;
  margin: 0;
}

.clock--compact .clock__bar {
  grid-area: bar;
}

.timeline__track {
  position: relative;
  height: 22px;
}

.timeline__shift {
  position: absolute;
  top: 0;
  bottom: 0;
  display: grid;
  place-items: center;
  border-left: 2px solid var(--surface);
  background: var(--surface-3);
  font-size: 11px;
  color: var(--text-faint);
}

.timeline__shift:first-child {
  border-left: none;
  border-radius: 4px 0 0 4px;
}

.timeline__shift:nth-child(4) {
  border-radius: 0 4px 4px 0;
}

.timeline__shift.is-now {
  background: var(--cyan-soft);
  color: var(--cyan-strong);
}

.timeline__now {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan-glow);
}

.timeline__scale {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 10.5px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>
