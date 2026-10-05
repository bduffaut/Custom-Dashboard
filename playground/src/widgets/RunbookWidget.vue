<script setup lang="ts">
import { ref } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { ListChecks } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Runbook checklist using sizeToContent, so it grows and shrinks with its steps
// Steps are saved into the dashboard with update

interface Step {
  text: string
  done: boolean
}

const props = withDefaults(defineProps<{ title?: string; steps?: Step[] }>(), {
  title: 'Runbook',
  steps: () => [],
})
const { update } = useWidget()

const draft = ref('')

function save(steps: Step[]) {
  update({ props: { title: props.title, steps } })
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
  <WidgetCard :title="title" :icon="ListChecks">
    <div class="runbook">
      <p class="runbook__progress mono">{{ steps.filter((s) => s.done).length }}/{{ steps.length }} done · grows to fit</p>
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
        <input v-model="draft" placeholder="Add a step..." aria-label="New runbook step" />
        <button type="submit" :disabled="!draft.trim()">Add</button>
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
  margin: 0;
  font-size: 11px;
  color: var(--text-faint);
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

.runbook input[type='checkbox'] {
  accent-color: var(--accent);
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
  min-width: 0;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--bg);
  font-size: 12px;
}
</style>
