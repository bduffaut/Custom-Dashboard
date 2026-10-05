<script setup lang="ts">
import { ref, watch } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { NotebookPen } from 'lucide-vue-next'
import WidgetCard from './WidgetCard.vue'

// Analyst notes saved into props shortly after typing stops
// Ctrl+Z in the textarea undoes typing, not the layout

const props = withDefaults(defineProps<{ title?: string; text?: string }>(), { title: 'Analyst notes', text: '' })
const { update } = useWidget()

const draft = ref(props.text)
let timer: ReturnType<typeof setTimeout> | undefined

watch(draft, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => update({ props: { title: props.title, text: value } }), 400)
})
</script>

<template>
  <WidgetCard :title="title" :icon="NotebookPen">
    <textarea v-model="draft" class="notes" placeholder="Findings, next steps, IOCs..." spellcheck="false" />
  </WidgetCard>
</template>

<style scoped>
.notes {
  width: 100%;
  height: 100%;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font: 13px/1.5 var(--mono);
}

.notes::placeholder {
  color: var(--text-faint);
}
</style>
