<script setup lang="ts">
import { useWidgetCatalog, vDraggableWidget } from 'custom-dashboard-grid'
import { Search } from 'lucide-vue-next'
import { CATEGORIES, type PaletteEntry } from '../widgets/catalog'
import FootprintGlyph from './FootprintGlyph.vue'

// Edit mode drawer, drag entries onto any grid or click to add in the first free spot

const props = defineProps<{ entries: PaletteEntry[] }>()
const emit = defineEmits<{ add: [entry: PaletteEntry] }>()

const { query, groups } = useWidgetCatalog(() => props.entries, { categories: CATEGORIES })
</script>

<template>
  <aside class="library" aria-label="Widget library">
    <header class="library__head">
      <h2>Widgets</h2>
      <p>Drag onto the board, or click to place in the first free spot.</p>
      <label class="library__search">
        <Search :size="14" />
        <input v-model="query" placeholder="Search" aria-label="Search widgets" />
      </label>
    </header>
    <div class="library__list">
      <section v-for="group in groups" :key="group.category">
        <h3>{{ group.category }}</h3>
        <button
          v-for="entry in group.entries"
          :key="entry.key"
          v-draggable-widget="entry.widget"
          class="item"
          :title="entry.description"
          @click="emit('add', entry)"
        >
          <span class="item__top">
            <component :is="entry.icon" :size="15" class="item__icon" />
            <span class="item__name">{{ entry.name }}</span>
          </span>
          <span class="item__foot">
            <FootprintGlyph :w="entry.widget.w" :h="entry.widget.h" />
            <span class="item__size">{{ entry.widget.w }} × {{ entry.widget.h }}</span>
          </span>
        </button>
      </section>
      <p v-if="!groups.length" class="library__empty">Nothing matches “{{ query }}”.</p>
    </div>
  </aside>
</template>

<style scoped>
.library {
  position: sticky;
  top: 76px;
  align-self: start;
  max-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  background: var(--surface);
  clip-path: polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, 0 100%);
  animation: drawer-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes drawer-in {
  from {
    opacity: 0;
    translate: -16px 0;
  }
}

.library__head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
}

.library__head h2 {
  margin: 0;
  font-size: 16px;
}

.library__head p {
  margin: 2px 0 10px;
  font-size: 12.5px;
  color: var(--text-faint);
}

.library__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--bg);
  color: var(--text-faint);
}

.library__search:focus-within {
  border-color: var(--accent);
  color: var(--accent);
}

.library__search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
}

.library__list {
  overflow-y: auto;
  padding: 0 10px 12px;
}

h3 {
  margin: 14px 2px 6px;
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-faint);
}

.item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 6px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  text-align: left;
  cursor: grab;
}

.item {
  position: relative;
  overflow: hidden;
  transition:
    border-color 0.2s,
    transform 0.2s cubic-bezier(0.3, 1.3, 0.5, 1),
    background 0.2s;
}

/* Accent bar that slides in from the left edge */
.item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
  transform: scaleY(0);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.item:hover:not(:disabled) {
  border-color: rgb(45 212 191 / 0.5);
  background: linear-gradient(90deg, rgb(45 212 191 / 0.06), transparent 70%), var(--surface-2);
  transform: translateX(2px);
}

.item:hover::before {
  transform: scaleY(1);
}

.item__icon {
  transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);
}

.item:hover :deep(.on) {
  fill: var(--accent-strong);
  opacity: 1;
}

.item:hover .item__icon {
  transform: scale(1.15) rotate(-6deg);
}

.item:active {
  cursor: grabbing;
}

.item__top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.item__name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item__size {
  font-family: var(--display);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-faint);
}

.library__empty {
  margin: 20px 4px;
  font-size: 13px;
  color: var(--text-faint);
}
</style>
