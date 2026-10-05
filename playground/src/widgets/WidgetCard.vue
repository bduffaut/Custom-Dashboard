<script setup lang="ts">
import { computed, type Component } from 'vue'
import { PIN_MODE_OPTIONS, useWidget } from 'custom-dashboard-grid'
import { ChevronDown, ChevronRight, Lock, Move, Pin, X } from 'lucide-vue-next'
import PinMenu from './PinMenu.vue'

// Shared frame for every demo widget, everything it needs comes from useWidget

const props = withDefaults(
  defineProps<{
    title: string
    icon?: Component
    /* Pulsing status light for widgets fed by the simulator */
    live?: boolean
    /* Remove body padding for tables and charts that run edge to edge */
    flush?: boolean
    /* The body is a size container so content can scale with cq units, off for widgets that grow with their content */
    fluid?: boolean
  }>(),
  { fluid: true },
)

const { widget, interaction, editable, collapsed, selected, remove, collapse, pinMode } = useWidget()

// In view mode a small icon shows how the widget is pinned, labelled by the library
const PIN_ICONS = { pinned: Pin, locked: Lock, 'no-resize': Move } as const
const pinBadge = computed(() => {
  if (pinMode.value === 'free') return null
  const option = PIN_MODE_OPTIONS.find((o) => o.mode === pinMode.value)!
  return { icon: PIN_ICONS[pinMode.value], label: `${option.label}: ${option.description}` }
})

// Live grid position or size while dragging or resizing
const readout = computed(() => {
  const w = widget.value
  return interaction.value === 'resize' ? `${w.w} × ${w.h}` : `col ${w.x + 1}, row ${w.y + 1}`
})
const titleText = computed(() => props.title)
</script>

<template>
  <section
    class="card"
    :class="{
      'card--static': widget.static,
      'card--active': interaction,
      'card--editing': editable,
      'card--pinned': pinMode !== 'free',
      'card--selected': selected,
    }"
  >
    <header class="card__header">
      <button class="card__btn card__toggle" :aria-label="collapsed ? 'Expand' : 'Collapse'" :title="collapsed ? 'Expand' : 'Collapse'" @click="collapse()">
        <ChevronRight v-if="collapsed" :size="14" />
        <ChevronDown v-else :size="14" />
      </button>
      <component :is="icon" v-if="icon" class="card__icon" :size="15" />
      <h2 class="card__title">{{ titleText }}</h2>
      <span v-if="live" class="card__led" role="img" aria-label="Live" title="Live data" />
      <span v-if="interaction" class="card__readout">{{ readout }}</span>
      <div class="card__actions">
        <slot name="actions" />
        <template v-if="editable">
          <PinMenu />
          <button v-if="pinMode !== 'locked'" class="card__btn card__remove" title="Remove widget" aria-label="Remove widget" @click="remove">
            <X :size="14" />
          </button>
        </template>
        <component :is="pinBadge.icon" v-else-if="pinBadge" class="card__pin" :size="13" :aria-label="pinBadge.label">
          <title>{{ pinBadge.label }}</title>
        </component>
      </div>
    </header>
    <div v-show="!collapsed" class="card__body" :class="{ 'card__body--flush': flush, 'card__body--fluid': fluid }">
      <slot />
    </div>
    <span class="card__corner" aria-hidden="true" />
  </section>
</template>

<style scoped>
/* One chamfered corner, clip-path cuts the box and card__corner draws the border along the cut */
.card {
  --edge: var(--border);
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--edge);
  clip-path: polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, 0 100%);
  transition:
    border-color 0.15s,
    background-color 0.15s;
}

.card__corner {
  position: absolute;
  top: -1px;
  right: -1px;
  width: var(--chamfer);
  height: var(--chamfer);
  pointer-events: none;
  background: linear-gradient(
    to bottom left,
    transparent calc(50% - 1px),
    var(--edge) calc(50% - 1px) calc(50% + 0.5px),
    transparent calc(50% + 0.5px)
  );
}

.card:hover {
  --edge: var(--border-strong);
}

/* Hover lights the cut corner and brings the header controls forward */
.card__corner {
  transition: filter 0.25s;
}

.card:hover .card__corner {
  --edge: var(--accent);
  filter: drop-shadow(0 0 3px var(--accent-glow));
}

.card__icon {
  transition: transform 0.3s cubic-bezier(0.3, 1.4, 0.5, 1);
}

.card:hover .card__icon {
  transform: rotate(-8deg) scale(1.1);
}

.card__actions {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.card:hover .card__actions,
.card:focus-within .card__actions {
  opacity: 1;
}

.card--static {
  background: linear-gradient(var(--surface), var(--surface-2));
}

/* Edit mode registration marks on the three square corners */
.card--editing {
  background-image:
    linear-gradient(var(--text-faint), var(--text-faint)), linear-gradient(var(--text-faint), var(--text-faint)),
    linear-gradient(var(--text-faint), var(--text-faint)), linear-gradient(var(--text-faint), var(--text-faint)),
    linear-gradient(var(--text-faint), var(--text-faint)), linear-gradient(var(--text-faint), var(--text-faint));
  background-size:
    8px 1px,
    1px 8px,
    8px 1px,
    1px 8px,
    8px 1px,
    1px 8px;
  background-position:
    3px 3px,
    3px 3px,
    3px calc(100% - 3px),
    3px calc(100% - 11px),
    calc(100% - 3px) calc(100% - 3px),
    calc(100% - 3px) calc(100% - 11px);
  background-repeat: no-repeat;
}

.card--editing.card--pinned {
  --edge: rgb(45 212 191 / 0.35);
}

/* Selected cards light their edge and tint the header, the chamfer keeps its shape */
.card--selected {
  --edge: var(--accent);
}

.card--selected .card__header {
  background: var(--accent-soft);
}

.card--active {
  --edge: var(--accent);
  background-color: var(--surface-2);
}

.card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 calc(var(--chamfer) - 2px) 0 4px;
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.card__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__led {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft), 0 0 8px var(--accent-glow);
  animation: led 2.4s ease-in-out infinite;
}

@keyframes led {
  50% {
    opacity: 0.35;
    box-shadow: 0 0 0 3px transparent;
  }
}

.card__readout {
  flex-shrink: 0;
  padding: 1px 7px;
  font-family: var(--display);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--bg);
  background: var(--accent);
}

.card__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}

.card__btn {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-faint);
}

.card__btn:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-3);
}

.card__remove:hover:not(:disabled) {
  color: var(--critical);
}

.card__pin {
  color: var(--text-faint);
  margin-right: 4px;
}

.card__body {
  flex: 1;
  min-height: 0;
  padding: 12px 14px;
  position: relative;
}

.card__body--flush {
  padding: 0;
}

.card__body--fluid {
  container-type: size;
  overflow: hidden;
}
</style>
