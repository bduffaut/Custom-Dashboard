<script setup lang="ts">
import { ref } from 'vue'
import type { NamedLayout } from 'custom-dashboard-grid'
import { ChevronDown, LayoutGrid, Trash2 } from 'lucide-vue-next'
import { usePopover } from '../composables/usePopover'

// Saved layouts menu backed by useSavedLayouts in App.vue

defineProps<{ layouts: NamedLayout[] }>()
const emit = defineEmits<{ save: [name: string]; load: [id: string]; remove: [id: string] }>()

const root = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const name = ref('')
const open = usePopover(root, () => input.value?.focus())

function save() {
  emit('save', name.value)
  name.value = ''
}

function load(id: string) {
  emit('load', id)
  open.value = false
}

const when = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div ref="root" class="presets">
    <button class="presets__trigger" :class="{ 'is-on': open }" :aria-expanded="open" title="Saved layouts" @click="open = !open">
      <LayoutGrid :size="15" />
      <span class="presets__label">Layouts</span>
      <ChevronDown :size="13" class="presets__chev" />
    </button>
    <div v-if="open" class="popover popover--down popover--left presets__panel" role="dialog" aria-label="Saved layouts">
      <form class="presets__save" @submit.prevent="save">
        <input ref="input" v-model="name" placeholder="Name this layout" aria-label="Layout name" />
        <button type="submit">Save current</button>
      </form>
      <ul>
        <li v-for="layout in layouts" :key="layout.id">
          <button class="presets__load" @click="load(layout.id)">
            <span>{{ layout.name }}</span>
            <small>{{ layout.widgets.length }} widgets, saved {{ when(layout.savedAt) }}</small>
          </button>
          <button class="presets__remove" :title="`Delete ${layout.name}`" :aria-label="`Delete ${layout.name}`" @click="emit('remove', layout.id)">
            <Trash2 :size="13" />
          </button>
        </li>
        <li v-if="!layouts.length" class="presets__empty">Save this arrangement to switch back to it later. Reusing a name replaces that layout.</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.presets {
  position: relative;
}

.presets__trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.presets__chev {
  color: var(--text-faint);
  transition: transform 0.25s;
}

.presets__trigger.is-on .presets__chev {
  transform: rotate(180deg);
}

.presets__load:hover:not(:disabled) {
  background: var(--surface-3);
  box-shadow: inset 2px 0 0 var(--accent);
}

.presets__panel {
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: 10px;
}

.presets__save {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.presets__save input {
  flex: 1;
  min-width: 0;
  padding: 5px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--bg);
}

.presets__save input:focus {
  outline: none;
  border-color: var(--accent);
}

.presets__save button {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
  font-weight: 600;
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
}

li {
  display: flex;
  align-items: center;
  gap: 2px;
}

.presets__load {
  border-radius: var(--radius-sm);
  transition:
    background 0.15s,
    box-shadow 0.2s;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 7px 8px;
  border: none;
  background: none;
  text-align: left;
}

.presets__load span {
  font-weight: 500;
}

.presets__load small {
  color: var(--text-faint);
  font-size: 11.5px;
}

.presets__remove {
  border: none;
  background: none;
  color: var(--text-faint);
  padding: 7px;
}

.presets__remove:hover:not(:disabled) {
  color: var(--critical);
  background: none;
}

.presets__empty {
  padding: 10px 6px 4px;
  font-size: 12.5px;
  color: var(--text-faint);
}

@media (max-width: 640px) {
  .presets__label,
  .presets__chev {
    display: none;
  }
}
</style>
