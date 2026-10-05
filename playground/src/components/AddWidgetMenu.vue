<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWidgetCatalog, vDraggableWidget } from 'custom-dashboard-grid'
import { Plus, Search } from 'lucide-vue-next'
import { usePopover } from '../composables/usePopover'
import { CATEGORIES, type PaletteEntry } from '../widgets/catalog'
import FootprintGlyph from './FootprintGlyph.vue'

// Searchable menu of widget types, click to add or drag straight onto any grid
// Closes as soon as a drag starts so it does not cover the drop spot

const props = withDefaults(
  defineProps<{
    entries: PaletteEntry[]
    label?: string
    /* Where the panel opens relative to the button */
    placement?: 'down-left' | 'down-right' | 'up-center'
    compact?: boolean
  }>(),
  { label: 'Add widget', placement: 'down-left', compact: false },
)

const emit = defineEmits<{ add: [entry: PaletteEntry] }>()

const root = ref<HTMLElement>()
const search = ref<HTMLInputElement>()
const { query, groups } = useWidgetCatalog(() => props.entries, { categories: CATEGORIES })
const open = usePopover(root, () => {
  query.value = ''
  search.value?.focus()
})

const panelClass = computed(() => {
  const [v, h] = props.placement.split('-')
  return [`popover--${v}`, `popover--${h}`]
})


function choose(entry: PaletteEntry) {
  emit('add', entry)
  open.value = false
}

function closeOnDrag(event: PointerEvent) {
  const start = { x: event.clientX, y: event.clientY }
  const onMove = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return
    open.value = false
    done()
  }
  const done = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', done)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', done)
}
</script>

<template>
  <div ref="root" class="menu" data-no-drag>
    <button
      class="menu__trigger"
      :class="{ 'menu__trigger--compact': compact }"
      :aria-expanded="open"
      :title="compact ? label : undefined"
      @click="open = !open"
    >
      <Plus :size="15" />
      <span v-if="!compact" class="menu__label">{{ label }}</span>
    </button>
    <div v-if="open" class="popover menu__panel" :class="panelClass" role="dialog" :aria-label="label">
      <label class="menu__search">
        <Search :size="14" />
        <input
          ref="search"
          v-model="query"
          placeholder="Search widgets"
          @keydown.enter="groups[0]?.entries[0] && choose(groups[0].entries[0])"
        />
      </label>
      <div class="menu__list">
        <section v-for="group in groups" :key="group.category">
          <h3>{{ group.category }}</h3>
          <button
            v-for="entry in group.entries"
            :key="entry.key"
            v-draggable-widget="entry.widget"
            class="menu__item"
            @pointerdown="closeOnDrag"
            @click="choose(entry)"
          >
            <component :is="entry.icon" :size="16" class="menu__icon" />
            <span class="menu__text">
              <span class="menu__name">{{ entry.name }}</span>
              <span class="menu__desc">{{ entry.description }}</span>
            </span>
            <FootprintGlyph :w="entry.widget.w" :h="entry.widget.h" />
          </button>
        </section>
        <p v-if="!groups.length" class="menu__empty">No widgets match “{{ query }}”. Try a category such as response.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.menu {
  position: relative;
}

.menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  border-color: transparent;
  color: #04201c;
  font-weight: 600;
}

.menu__trigger:hover:not(:disabled) {
  background: var(--accent-strong);
  border-color: transparent;
}

.menu__trigger--compact {
  padding: 3px;
  background: var(--surface-3);
  color: var(--text-muted);
}

.menu__trigger--compact:hover:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent);
}

.menu__panel {
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: min(520px, 70vh);
  display: flex;
  flex-direction: column;
  padding: 0;
}

.menu__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-faint);
}

.menu__search:focus-within {
  color: var(--accent);
}

.menu__search input {
  flex: 1;
  border: none;
  outline: none;
  background: none;
}

.menu__list {
  overflow-y: auto;
  padding: 2px 6px 8px;
}

.menu__list h3 {
  margin: 12px 8px 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-faint);
}

.menu__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
}

.menu__item {
  transition:
    background 0.15s,
    box-shadow 0.2s;
}

.menu__item:hover,
.menu__item:focus-visible {
  background: var(--surface-3);
  box-shadow: inset 2px 0 0 var(--accent);
}

.menu__item:hover :deep(.on) {
  fill: var(--accent-strong);
  opacity: 1;
}

.menu__icon {
  transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);
}

.menu__item:hover .menu__icon {
  transform: scale(1.15);
}

.menu__trigger svg {
  transition: transform 0.3s cubic-bezier(0.3, 1.4, 0.5, 1);
}

.menu__trigger:hover svg {
  transform: rotate(90deg);
}

.menu__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.menu__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.menu__name {
  font-size: 13px;
  font-weight: 500;
}

.menu__desc {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu__empty {
  padding: 16px;
  text-align: center;
  color: var(--text-faint);
}
</style>
