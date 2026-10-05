<script setup lang="ts">
import { ref, watch } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { NotebookPen } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Analyst notes saved into props shortly after typing stops
// Ctrl+Z in the textarea undoes typing, not the layout

const props = withDefaults(defineProps<{ title?: string; text?: string }>(), { title: 'Analyst notes', text: '' })
const { updateProps } = useWidget()

const draft = ref(props.text)
let timer: ReturnType<typeof setTimeout> | undefined

watch(draft, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => updateProps({ text: value }), 400)
})
</script>

<template>
  <WidgetCard :title="title" :icon="NotebookPen">
    <textarea v-model="draft" class="notes" placeholder="Findings, next steps, IOCs..." spellcheck="false" />
  </WidgetCard>
</template>

<style scoped>
/* Ruled like a notebook, the lines sit exactly on the text baseline */
.notes {
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 0;
  background: repeating-linear-gradient(to bottom, transparent 0 19px, rgb(34 211 238 / 0.07) 19px 20px);
  background-attachment: local;
  color: var(--text);
  caret-color: var(--cyan);
  font: 13px/20px var(--mono);
}

.notes::placeholder {
  color: var(--text-faint);
}
</style>
