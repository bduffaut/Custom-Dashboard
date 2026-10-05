<script setup lang="ts">
import { ref } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { ListChecks } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Runbook checklist using sizeToContent, so it grows and shrinks with its steps
// Steps are saved into the dashboard with updateProps

interface Step {
  text: string
  done: boolean
}

const props = withDefaults(defineProps<{ title?: string; steps?: Step[] }>(), {
  title: 'Runbook',
  steps: () => [],
})
const { updateProps } = useWidget()

const draft = ref('')

function save(steps: Step[]) {
  updateProps({ steps })
}

function toggle(index: number) {
  save(props.steps.map((s, i) => (i === index ? { ...s, done: !s.done } : s)))
}

function add() {
  const text = draft.value.trim()
  if (!text) return
  save([...props.steps, { text, done: false }])
  draft.value = ''
}

function remove(index: number) {
  save(props.steps.filter((_, i) => i !== index))
}
</script>

<template>
  <WidgetCard :title="title" :icon="ListChecks" :fluid="false">
    <div class="runbook">
      <div class="runbook__progress">
        <span>{{ steps.filter((s) => s.done).length }} of {{ steps.length }} done</span>
        <span class="w-track"><span class="w-bar" :style="{ width: `${steps.length ? (steps.filter((s) => s.done).length / steps.length) * 100 : 0}%` }" /></span>
      </div>
      <ol>
        <li v-for="(step, i) in steps" :key="i" :class="{ 'is-done': step.done }">
          <label>
            <input type="checkbox" :checked="step.done" @change="toggle(i)" />
            <span>{{ step.text }}</span>
          </label>
          <button class="runbook__remove" title="Remove step" @click="remove(i)">×</button>
        </li>
      </ol>
      <form class="runbook__add" @submit.prevent="add">
        <input v-model="draft" class="w-input" placeholder="Add a step" aria-label="New runbook step" />
        <button class="w-btn" type="submit" :disabled="!draft.trim()">Add</button>
      </form>
    </div>
  </WidgetCard>
</template>

<style scoped>
.runbook {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.runbook__progress {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--text-faint);
}

.runbook__progress .w-bar {
  display: block;
}

.runbook ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.runbook li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--grid-line);
  font-size: 13px;
}

.runbook li label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.runbook li.is-done span {
  color: var(--text-faint);
  text-decoration: line-through;
}

/* Square check drawn in cyan, with a glow once ticked */
.runbook input[type='checkbox'] {
  appearance: none;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  margin: 0;
  border-radius: 3px;
  border: 1px solid var(--border-strong);
  background: var(--bg-deep);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
}

.runbook input[type='checkbox']::after {
  content: '';
  width: 4px;
  height: 8px;
  margin-top: -2px;
  border: solid var(--bg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform 0.15s;
}

.runbook input[type='checkbox']:checked {
  background: var(--cyan);
  border-color: var(--cyan);
  box-shadow: 0 0 8px var(--cyan-glow);
}

.runbook input[type='checkbox']:checked::after {
  transform: rotate(45deg) scale(1);
}

.runbook li {
  transition: background 0.15s;
}

.runbook li:hover {
  background: rgb(255 255 255 / 0.02);
}

.runbook__remove {
  border: none;
  background: none;
  padding: 0 4px;
  color: var(--text-faint);
}

.runbook__add {
  display: flex;
  gap: 6px;
}

.runbook__add input {
  flex: 1;
}
</style>
