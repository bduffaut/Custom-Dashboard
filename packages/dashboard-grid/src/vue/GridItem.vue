<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { pinModeOf, resolveHandles, toPixels, type ResizeHandle } from '../core'
import { handledEvents, useGridContext, WIDGET_CONTEXT } from './context'
import type { GridWidget, InteractionKind } from './types'
import WidgetBoundary from './WidgetBoundary.vue'

// Internal, positions one widget, draws its resize handles and starts drags on pointerdown

const props = defineProps<{ widget: GridWidget }>()

defineSlots<{
  default(props: { interaction: InteractionKind | null }): unknown
  error(props: { error: unknown; retry: () => void }): unknown
}>()

const ctx = useGridContext()
const el = ref<HTMLElement>()

const id = computed(() => props.widget.id)
const groupBox = computed(() => ctx.groupPixels.value?.get(id.value) ?? null)
const interaction = computed<InteractionKind | null>(() =>
  ctx.active.value?.id === id.value ? ctx.active.value.kind : groupBox.value ? 'drag' : null,
)
const collapsed = computed(() => !!props.widget.collapsed)
const selected = computed(() => ctx.selected.value.has(id.value))
const enterDelay = computed(() => ctx.entering.value.get(id.value))

const box = computed(() => {
  if (groupBox.value) return ctx.drawnBox(props.widget, groupBox.value)
  if (interaction.value && ctx.livePixels.value) return ctx.drawnBox(props.widget, ctx.livePixels.value)
  return ctx.drawnBox(props.widget, toPixels(props.widget, ctx.metrics.value))
})

const locked = computed(() => !ctx.editable.value || !!props.widget.static)
const canDrag = computed(() => !locked.value && ctx.draggable.value && !props.widget.noMove)

const handles = computed<ResizeHandle[]>(() => {
  if (locked.value || !ctx.resizable.value || props.widget.noResize) return []
  const list = resolveHandles(props.widget.resizeHandles, ctx.resizeHandles.value)
  if (!collapsed.value && !fits.value) return list
  // A collapsed widget only resizes sideways, and so does one sized to its content since its height is not up to the user
  return [...new Set(list.flatMap((h) => (h.includes('e') ? ['e' as const] : h.includes('w') ? ['w' as const] : [])))]
})

// Lazy rendering, content mounts the first time it scrolls near view
const visible = ref(!ctx.lazy.value)
let stopObserving: (() => void) | null = null
onMounted(() => {
  if (!visible.value && el.value) stopObserving = ctx.observeVisibility(el.value, () => (visible.value = true))
})

// Size to content, content takes its natural height and the grid fits h to it
const fits = computed(() => {
  if (collapsed.value) return false
  const setting = props.widget.sizeToContent ?? ctx.sizeToContent.value
  return setting === true || (typeof setting === 'number' && setting > 0)
})
let contentObserver: ResizeObserver | null = null

function stopMeasuring() {
  contentObserver?.disconnect()
  contentObserver = null
}

function startMeasuring() {
  stopMeasuring()
  const content = el.value?.querySelector(':scope > .dg-content')
  if (!content || typeof ResizeObserver === 'undefined') return
  // borderBoxSize is the layout size, so an enter animation's scale never shrinks the measurement
  contentObserver = new ResizeObserver(([entry]) =>
    ctx.reportContentHeight(id.value, entry?.borderBoxSize?.[0]?.blockSize ?? content.getBoundingClientRect().height),
  )
  contentObserver.observe(content)
}

watch(
  [fits, visible],
  async ([fit, shown]) => {
    await nextTick()
    if (fit && shown) startMeasuring()
    else stopMeasuring()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopObserving?.()
  stopMeasuring()
})

provide(WIDGET_CONTEXT, {
  widget: computed(() => props.widget),
  interaction,
  editable: ctx.editable,
  collapsed,
  selected,
  remove: () => ctx.remove(id.value),
  update: (patch) => ctx.update(id.value, patch),
  updateProps: (patch) => ctx.updateProps(id.value, patch),
  collapse: (value) => ctx.setCollapsed(id.value, value),
  pinMode: computed(() => pinModeOf(props.widget)),
  setPinMode: (mode) => ctx.setPinMode(id.value, mode),
})

function onPointerDown(event: PointerEvent) {
  // Already taken by a grid nested inside this widget
  if (handledEvents.has(event)) return
  if (event.button !== 0 || !el.value || locked.value) return
  const target = event.target as Element
  // Let interactive content opt out of dragging
  if (target.closest('[data-no-drag], input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"])')) return
  if (ctx.dragCancel.value && safeClosest(target, ctx.dragCancel.value)) return
  if (ctx.keyboard.value) el.value.focus({ preventScroll: true })
  if (ctx.selectable.value) {
    const toggle = event.ctrlKey || event.metaKey || event.shiftKey
    ctx.pressSelect(id.value, toggle)
    handledEvents.add(event)
    // A modifier press only changes the selection, it never starts a drag
    if (toggle) {
      event.preventDefault()
      return
    }
  }
  if (!canDrag.value) return
  if (ctx.dragHandle.value && !safeClosest(target, ctx.dragHandle.value)) return
  if (ctx.begin('drag', id.value, event, el.value)) handledEvents.add(event)
}

function onKeyDown(event: KeyboardEvent) {
  // Only keys pressed on the widget itself, never ones typed into its content
  if (event.target === el.value) ctx.onKey(id.value, event)
}

/* closest that treats an invalid selector as no match */
function safeClosest(target: Element, selector: string): Element | null {
  try {
    return target.closest(selector)
  } catch {
    return null
  }
}

function onHandleDown(event: PointerEvent, handle: ResizeHandle) {
  if (event.button !== 0 || handledEvents.has(event) || !el.value) return
  if (ctx.begin('resize', id.value, event, el.value, handle)) handledEvents.add(event)
}
</script>

<template>
  <div
    ref="el"
    class="dg-item"
    :data-widget-id="id"
    :class="{
      'dg-item--dragging': interaction === 'drag',
      'dg-item--resizing': interaction === 'resize',
      'dg-item--static': widget.static,
      'dg-item--draggable': canDrag,
      'dg-item--collapsed': collapsed,
      'dg-item--transferring': ctx.transferring.value === id,
      'dg-item--removing': ctx.removing.value === id,
      'dg-item--entering': enterDelay !== undefined,
      'dg-item--selected': selected,
      'dg-item--fit': fits,
      'dg-item--pending': !visible,
    }"
    :style="{
      width: `${box.w}px`,
      height: `${box.h}px`,
      transform: `translate(${box.x}px, ${box.y}px)`,
      '--dg-enter-delay': enterDelay ? `${enterDelay}ms` : undefined,
    }"
    :tabindex="ctx.keyboard.value ? 0 : undefined"
    :aria-roledescription="ctx.keyboard.value ? 'widget' : undefined"
    :aria-label="ctx.keyboard.value ? ctx.labelFor(widget) : undefined"
    @pointerdown="onPointerDown"
    @keydown="onKeyDown"
  >
    <WidgetBoundary v-if="visible" @error="(error: unknown) => ctx.reportError(widget, error)">
      <slot :interaction="interaction" />
      <template #fallback="{ error, retry }">
        <slot name="error" :error="error" :retry="retry" />
      </template>
    </WidgetBoundary>
    <div
      v-for="handle in handles"
      :key="handle"
      class="dg-resize-handle"
      :class="`dg-resize-handle--${handle}`"
      @pointerdown="onHandleDown($event, handle)"
    />
  </div>
</template>

<style>
.dg-item {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  transition:
    transform var(--dg-duration, 200ms) var(--dg-easing, ease),
    width var(--dg-duration, 200ms) var(--dg-easing, ease),
    height var(--dg-duration, 200ms) var(--dg-easing, ease);
}

.dg-content {
  height: 100%;
}

/* Size to content, keep the natural height so it can be measured */
.dg-item--fit > .dg-content {
  height: auto;
}

/* Keyboard focus and selection, both themeable */
.dg-item:focus {
  outline: none;
}
.dg-item:focus-visible {
  outline: 2px solid var(--dg-focus-color, #3b82f6);
  outline-offset: 2px;
}
.dg-item--selected {
  outline: 2px solid var(--dg-selection-color, #3b82f6);
  outline-offset: 2px;
}

.dg-item--removing {
  opacity: 0.45;
  filter: grayscale(1);
}

.dg-item--collapsed .dg-content {
  overflow: hidden;
}

/* Only draggable widgets block touch scrolling, so read only dashboards scroll on phones */
.dg-item--draggable {
  cursor: grab;
  touch-action: none;
}

.dg-item--dragging,
.dg-item--resizing {
  z-index: 10;
  transition: none;
}

.dg-item--dragging {
  cursor: grabbing;
  opacity: 0.9;
}

.dg-item--transferring {
  visibility: hidden;
}

.dg-item--pending {
  border-radius: var(--dg-radius, 8px);
  background: var(--dg-pending-bg, rgba(100, 116, 139, 0.08));
}

/* Resize handles, edges are thin strips and corners small squares */
.dg-resize-handle {
  position: absolute;
  z-index: 2;
  touch-action: none;
}

.dg-resize-handle--n,
.dg-resize-handle--s {
  left: 12px;
  right: 12px;
  height: 8px;
  cursor: ns-resize;
}

.dg-resize-handle--e,
.dg-resize-handle--w {
  top: 12px;
  bottom: 12px;
  width: 8px;
  cursor: ew-resize;
}

.dg-resize-handle--n {
  top: -4px;
}
.dg-resize-handle--s {
  bottom: -4px;
}
.dg-resize-handle--e {
  right: -4px;
}
.dg-resize-handle--w {
  left: -4px;
}

.dg-resize-handle--ne,
.dg-resize-handle--nw,
.dg-resize-handle--se,
.dg-resize-handle--sw {
  width: 16px;
  height: 16px;
}

.dg-resize-handle--ne {
  top: 0;
  right: 0;
  cursor: nesw-resize;
}
.dg-resize-handle--nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}
.dg-resize-handle--se {
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
}
.dg-resize-handle--sw {
  bottom: 0;
  left: 0;
  cursor: nesw-resize;
}

/* Visible corner mark, se handle only */
.dg-resize-handle--se::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  opacity: 0.4;
}

/* Edge handles show a subtle bar on hover */
.dg-resize-handle--n:hover,
.dg-resize-handle--s:hover,
.dg-resize-handle--e:hover,
.dg-resize-handle--w:hover {
  background: var(--dg-handle-hover, rgba(100, 116, 139, 0.35));
  border-radius: 4px;
}

.dg-error {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  box-sizing: border-box;
  text-align: center;
  border-radius: var(--dg-radius, 8px);
  border: 1px dashed rgba(220, 38, 38, 0.6);
  color: rgb(220, 38, 38);
  font-size: 0.85rem;
}

.dg-error button {
  cursor: pointer;
}
</style>
