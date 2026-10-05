<script setup lang="ts">
import { vWidgetTrash, type DashboardGridApi } from 'custom-dashboard-grid'
import { Check, Redo2, RotateCcw, Trash2, Undo2, WandSparkles } from 'lucide-vue-next'
import type { CatalogEntry } from '../widgets/catalog'
import AddWidgetMenu from './AddWidgetMenu.vue'

// Floating edit mode toolbar with every layout command
// Also a trash zone, its drag state lives in style.css because it reacts to classes on html

defineProps<{ grid: DashboardGridApi | null; entries: CatalogEntry[] }>()
const emit = defineEmits<{ add: [entry: CatalogEntry]; reset: []; done: [] }>()
</script>

<template>
  <div v-widget-trash class="dock" role="toolbar" aria-label="Layout commands">
    <div class="dock__tools">
      <AddWidgetMenu class="dock__add" :entries="entries" placement="up-center" @add="emit('add', $event)" />
      <span class="dock__sep" />
      <button class="dock__btn" title="Undo (Ctrl+Z)" aria-label="Undo" :disabled="!grid?.canUndo" @click="grid?.undo()">
        <Undo2 :size="16" />
      </button>
      <button class="dock__btn" title="Redo (Ctrl+Y)" aria-label="Redo" :disabled="!grid?.canRedo" @click="grid?.redo()">
        <Redo2 :size="16" />
      </button>
      <span class="dock__sep" />
      <button class="dock__btn" title="Pack every widget into the tightest layout (undoable)" @click="grid?.autoArrange()">
        <WandSparkles :size="16" /><span class="dock-label">Auto-arrange</span>
      </button>
      <slot name="options" />
      <button class="dock__btn" title="Restore the default dashboard (undoable)" @click="emit('reset')">
        <RotateCcw :size="16" /><span class="dock-label">Reset</span>
      </button>
      <span class="dock__sep" />
      <button class="dock__btn dock__done" @click="emit('done')"><Check :size="16" /><span>Done</span></button>
    </div>
    <div class="dock__drop" aria-hidden="true">
      <Trash2 :size="17" />
      <span class="dock__drop-text">Release to remove</span>
      <span class="dock__drop-idle">Drag here to remove</span>
    </div>
  </div>
</template>

<style scoped>
.dock {
  position: fixed;
  left: 50%;
  bottom: 20px;
  z-index: 60;
  translate: -50% 0;
  max-width: calc(100vw - 24px);
  padding: 6px;
  border: 1px solid var(--border-strong);
  background: rgb(18 24 33 / 0.92);
  backdrop-filter: blur(10px);
  box-shadow:
    0 20px 50px rgb(0 0 0 / 0.55),
    inset 0 1px 0 rgb(255 255 255 / 0.04);
  animation: dock-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
  transition:
    border-color 0.15s,
    background 0.15s;
}

@keyframes dock-in {
  from {
    opacity: 0;
    translate: -50% 24px;
  }
}

.dock__tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dock__sep {
  width: 1px;
  height: 22px;
  margin: 0 4px;
  background: var(--border-strong);
}

.dock__btn,
.dock :deep(.options__trigger) {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 11px;
  border: none;
  background: none;
  color: var(--text-muted);
  white-space: nowrap;
}

.dock__btn:hover:not(:disabled),
.dock :deep(.options__trigger:hover),
.dock :deep(.options__trigger.is-on) {
  background: var(--surface-3);
  color: var(--text);
}

.dock :deep(.menu__trigger) {
  height: 34px;
}

.dock__done {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.dock__done:hover:not(:disabled) {
  background: rgb(45 212 191 / 0.2);
  color: var(--accent-strong);
}

/* Drop state covers the tools, style.css shows it during a drag */
.dock__drop {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-family: var(--display);
  font-weight: 600;
  font-size: 14px;
  color: var(--critical);
  background: repeating-linear-gradient(-45deg, rgb(208 59 59 / 0.08) 0 8px, transparent 8px 16px), var(--surface);
}

.dock__drop-text {
  display: none;
}

@media (max-width: 720px) {
  .dock {
    bottom: 12px;
  }
  .dock :deep(.menu__label),
  .dock :deep(.dock-label),
  .dock .dock-label {
    display: none;
  }
  .dock__btn,
  .dock :deep(.options__trigger) {
    padding: 0 9px;
  }
}
</style>
