<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { DashboardGrid, useWidget, type DashboardGridApi, type GridWidget } from 'custom-dashboard-grid'
import { Layers, Redo2, Undo2 } from 'lucide-vue-next'
import AddWidgetMenu from '../components/AddWidgetMenu.vue'
import { catalog, limitsForRows, widgetComponents, type PaletteEntry } from './catalog'
import WidgetCard from './WidgetCard.vue'

// A grid inside a grid
// Inner widgets live in props.widgets and save back with updateProps, so the tree is one JSON layout
// Dragging an inner widget moves just that widget, the header or empty space moves the group

const props = withDefaults(defineProps<{ incidentId?: string; widgets?: GridWidget[] }>(), {
  widgets: () => [],
})

const { widget, updateProps, editable } = useWidget()
const inner = useTemplateRef<DashboardGridApi>('inner')

// No incidents inside incidents in the demo, the library allows any depth
const entries = computed(() => catalog.filter((e) => e.widget.type !== 'incident'))
const acceptDrop = (widget: GridWidget) => widget.type !== 'incident'
// Same minimum room in pixels as the main board, converted to this grid's shorter rows
const limits = limitsForRows(38, 8)

// New incidents get a stable number from their widget id
const label = computed(() => {
  if (props.incidentId) return props.incidentId
  let hash = 0
  for (const char of widget.value.id) hash = (hash * 31 + char.charCodeAt(0)) % 9000
  return `INC-${1000 + hash}`
})

function add(entry: PaletteEntry) {
  inner.value?.addWidget(entry.widget)
}
</script>

<template>
  <WidgetCard :title="`Incident ${label}`" :icon="Layers" flush>
    <template #actions>
      <span class="badge sev-high">Investigating</span>
      <template v-if="editable">
        <button class="icon-btn" title="Undo inside this incident" :disabled="!inner?.canUndo" @click="inner?.undo()">
          <Undo2 :size="13" />
        </button>
        <button class="icon-btn" title="Redo inside this incident" :disabled="!inner?.canRedo" @click="inner?.redo()">
          <Redo2 :size="13" />
        </button>
        <AddWidgetMenu :entries="entries" label="Add to incident" placement="down-right" compact @add="add" />
      </template>
    </template>
    <div class="incident">
      <DashboardGrid
        ref="inner"
        :model-value="widgets"
        :components="widgetComponents"
        :columns="12"
        :row-height="38"
        :gap="8"
        :editable="editable"
        :accept-drops="acceptDrop"
        resize-handles="all"
        :size-limits="limits"
        @update:model-value="(widgets: GridWidget[]) => updateProps({ widgets })"
      />
      <p v-if="!widgets.length" class="incident__empty">Empty incident. Drag widgets here or use + in the header.</p>
    </div>
  </WidgetCard>
</template>

<style scoped>
.incident {
  height: 100%;
  padding: 10px;
  overflow-y: auto;
  background: repeating-linear-gradient(-45deg, transparent 0 10px, rgb(255 255 255 / 0.012) 10px 20px);
}

/* Let the inner grid fill the body so drops work anywhere inside */
.incident :deep(.dg-grid) {
  min-height: 100%;
}

.incident__empty {
  margin: 24px 0;
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

.icon-btn:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text);
}
</style>
