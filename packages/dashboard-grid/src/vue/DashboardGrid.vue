<script setup lang="ts" generic="T extends GridWidget">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch, type Component } from 'vue'
import {
  addItem,
  autoArrange as arrangeLayout,
  bottom,
  changedIds,
  clampItem,
  clearBreakpoint,
  cloneLayout,
  columnsForWidth,
  columnWidth,
  compact,
  compactGroup,
  DEFAULT_BREAKPOINTS,
  deriveLayout,
  findFreeSpot,
  gridHeight,
  insertItem,
  isAreaEmpty as areaIsEmpty,
  alignmentGuides,
  LayoutHistory,
  layoutsEqual,
  moveItem,
  moveItems,
  normalizeBreakpoints,
  pickBreakpoint,
  pinModeOf,
  placeMissing,
  removeItem,
  resizeBox,
  resizeItem,
  resolveCollisions,
  resolveHandles,
  restoreLayout,
  rowsForHeight,
  sanitizeLayout,
  toExactPosition,
  toGridPosition,
  toGridRect,
  toPixels,
  warn,
  withPinMode,
  writeLayout,
  type AlignmentGuide,
  type ArrangeOptions,
  type Breakpoint,
  type BreakpointConfig,
  type BreakpointLayout,
  type CompactMode,
  type ItemId,
  type LayoutItem,
  type LayoutOptions,
  type NewItem,
  type PinMode,
  type Rect,
  type ResizeHandle,
  type SizeLimits,
  type ResizeHandles,
} from '../core'
import { GRID_CONTEXT, handledEvents, shortcutOwner, type ActiveInteraction, type GridContext } from './context'
import { findDropTarget, registerDropTarget, snapshotDropTargets, type DropTarget, type Point, type TargetSnapshot } from './dnd'
import { createGhost, startAutoScroll, type Ghost } from './dom'
import { animateLeave, enterDuration, resolveAnimation, type AnimationSetting } from './animation'
import GridItem from './GridItem.vue'
import { cloneData, createWidgetId } from './id'
import { safeWidgetProps } from './safeProps'
import { setActiveTrash, trashAt } from './trash'
import { endDragState, startDragState } from './dragState'
import type { AddWidgetOptions, DropEvent, DropSource, GridWidget, InteractionKind, WidgetSource } from './types'

const props = withDefaults(
  defineProps<{
    /* The widgets, use v-model so moves, resizes and drops save back to your array */
    modelValue: T[]
    /* Widget type to the component that renders it */
    components?: Record<string, Component>
    /* Number of columns, ignored when breakpoints are set */
    columns?: number
    /* Row height in px, or auto for square cells */
    rowHeight?: number | 'auto'
    /* Space between widgets in px, or [columns, rows] */
    gap?: number | [number, number]
    /* Fit as many columns as possible at this minimum width, up to columns */
    minColumnWidth?: number
    /* vertical floats widgets up, horizontal floats them left, none leaves them where dropped */
    compact?: CompactMode
    /* Nothing may extend below this many rows */
    maxRows?: number
    /* Minimum grid height in rows, so an empty grid still accepts drops */
    minRows?: number
    /* Edit mode, when false there is no dragging, resizing, dropping or undo shortcut */
    editable?: boolean
    draggable?: boolean
    resizable?: boolean
    /* CSS selector, when set widgets can only be dragged by a matching element */
    dragHandle?: string
    /* Resize handles: se (default), all, corners, edges, none or a list like [e, s, se] */
    resizeHandles?: ResizeHandles
    /* Responsive layouts, true uses 12, 6 and 1 columns at 1024, 640 and 0 px, or pass your own */
    breakpoints?: BreakpointConfig | boolean
    /* How narrower breakpoints are derived, scale keeps proportions, list flows in reading order */
    breakpointLayout?: BreakpointLayout
    /* Measure breakpoints against the grid width (default) or the window */
    breakpointsFrom?: 'container' | 'window'
    /* Height in rows of a collapsed widget */
    collapsedRows?: number
    /* Keep an undo history of layout changes */
    history?: boolean
    /* Most undo steps kept */
    historyLimit?: number
    /* Ctrl+Z undo, Ctrl+Y or Ctrl+Shift+Z redo (Cmd on Mac) for the most recently used grid */
    shortcuts?: boolean
    /* Scroll the page or a scrolling parent while dragging near its edge */
    autoScroll?: boolean
    /* Grids in the same group can drag widgets between each other */
    group?: string
    /* Accept widgets from other grids or outside, or a function that decides per widget */
    acceptDrops?: boolean | ((widget: GridWidget) => boolean)
    /* Render widget content only once it scrolls near view, a number sets how many px early */
    lazy?: boolean | number
    /* Show column guides while dragging or resizing */
    guides?: boolean
    /* Draw every grid cell behind the widgets, always (true) or only in edit mode (editing) */
    showCells?: boolean | 'editing'
    /* true, false, a preset (none, snappy, smooth, gentle, bouncy) or { duration, easing, enter, leave } */
    animation?: AnimationSetting
    /* When handle marks show: always, hover, or auto (hover with a mouse, always on touch) */
    showHandles?: 'auto' | 'always' | 'hover'
    /* CSS selector for elements inside widgets that never start a drag */
    dragCancel?: string
    /* Remove a widget dropped outside every grid, undoable */
    removeOnDropOutside?: boolean
    /* Size widgets to their content by default, a number caps the rows */
    sizeToContent?: boolean | number
    /* Keyboard editing in edit mode: arrows move, Shift+arrows resize, Delete removes */
    keyboard?: boolean
    /* Select widgets by clicking, Ctrl or Shift+click or a drag box on empty space, then move them together */
    selectable?: boolean
    /* Show lines where a moving widget lines up with others */
    snapGuides?: boolean
    /* Name used for a widget in labels and announcements, defaults to props.title, then type, then id */
    widgetLabel?: (widget: T) => string
    /* Minimum and maximum sizes by widget type, for any limit a widget does not set itself */
    sizeLimits?: Record<string, SizeLimits>
  }>(),
  {
    components: () => ({}),
    columns: 12,
    rowHeight: 60,
    gap: 12,
    compact: 'vertical',
    maxRows: undefined,
    minRows: 1,
    editable: true,
    draggable: true,
    resizable: true,
    dragHandle: undefined,
    resizeHandles: 'se',
    breakpoints: undefined,
    collapsedRows: 1,
    history: true,
    historyLimit: 100,
    shortcuts: true,
    autoScroll: true,
    group: 'default',
    acceptDrops: true,
    lazy: false,
    guides: true,
    showCells: false,
    minColumnWidth: undefined,
    breakpointLayout: 'scale',
    breakpointsFrom: 'container',
    animation: 'smooth',
    showHandles: 'auto',
    dragCancel: undefined,
    removeOnDropOutside: false,
    sizeToContent: false,
    keyboard: true,
    selectable: false,
    snapGuides: false,
    widgetLabel: undefined,
    sizeLimits: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [widgets: T[]]
  dragStart: [widget: T]
  dragEnd: [widget: T]
  resizeStart: [widget: T]
  resizeEnd: [widget: T]
  remove: [widget: T]
  /* A widget arrived from another grid or from outside */
  drop: [event: DropEvent<T>]
  /* A widget left for another grid */
  dragOut: [widget: T]
  undo: []
  redo: []
  breakpointChange: [name: string]
  /* A widget threw while rendering and now shows a retry fallback */
  widgetError: [widget: T, error: unknown]
  /* Widgets whose position, size or collapsed state changed */
  change: [widgets: T[]]
  /* A widget was added by addWidget or a drop */
  add: [widget: T]
  /* While dragging, when the widget reaches a new cell */
  drag: [widget: T, cell: { x: number; y: number }]
  /* While resizing, when the size in cells changes */
  resize: [widget: T, rect: Rect]
  /* The selected ids changed */
  selectionChange: [ids: ItemId[]]
}>()

defineSlots<{
  /* Optional, render widgets yourself instead of using components */
  default?(props: {
    widget: T
    interaction: InteractionKind | null
    editable: boolean
    collapsed: boolean
    selected: boolean
    remove: () => void
    update: (patch: Partial<Omit<T, 'id'>>) => void
    updateProps: (patch: Record<string, unknown>) => void
    collapse: (collapsed?: boolean) => void
    pinMode: PinMode
    setPinMode: (mode: PinMode) => void
  }): unknown
  /* Optional, replace the crash fallback */
  error?(props: { widget: T; error: unknown; retry: () => void }): unknown
}>()

// Sanitized settings, bad values fall back to defaults

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const wholeAtLeast = (v: unknown, min: number, fallback: number) => (isNum(v) && v >= min ? Math.floor(v) : fallback)

const fixedRowHeight = computed(() => (isNum(props.rowHeight) && props.rowHeight > 0 ? props.rowHeight : 60))
const colGap = computed(() => {
  const value = Array.isArray(props.gap) ? props.gap[0] : props.gap
  return isNum(value) && value >= 0 ? value : 12
})
const rowGap = computed(() => {
  const value = Array.isArray(props.gap) ? props.gap[1] : props.gap
  return isNum(value) && value >= 0 ? value : colGap.value
})
const maxRows = computed(() => (isNum(props.maxRows) && props.maxRows >= 1 ? Math.floor(props.maxRows) : undefined))
const minRows = computed(() => wholeAtLeast(props.minRows, 0, 1))
const collapsedRows = computed(() => wholeAtLeast(props.collapsedRows, 1, 1))
const canEdit = computed(() => props.editable !== false)
const defaultHandles = computed(() => resolveHandles(props.resizeHandles, ['se']))

// Container width

const container = ref<HTMLElement>()
const width = ref(0)
let resizeObserver: ResizeObserver | undefined
// Fallback without ResizeObserver, content width minus padding
const measure = () => {
  const el = container.value
  if (!el) return
  const style = getComputedStyle(el)
  width.value = Math.max(0, el.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0))
}

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
const onWindowResize = () => (windowWidth.value = window.innerWidth)

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) width.value = entry.contentRect.width
    })
    resizeObserver.observe(container.value!)
  } else {
    measure()
    window.addEventListener('resize', measure)
  }
})

// Breakpoints, the widget array holds the widest layout and narrower ones are derived

const breakpointList = computed(() => {
  if (props.breakpoints === true) return normalizeBreakpoints(DEFAULT_BREAKPOINTS)
  if (props.breakpoints && typeof props.breakpoints === 'object') {
    const list = normalizeBreakpoints(props.breakpoints)
    if (!list) warn('The breakpoints prop has no valid entries; using a single layout.')
    return list
  }
  return null
})
const baseBp = computed<Breakpoint>(
  () => breakpointList.value?.[0] ?? { name: 'base', width: 0, columns: wholeAtLeast(props.columns, 1, 12) },
)
const breakpointWidth = computed(() => (props.breakpointsFrom === 'window' ? windowWidth.value : width.value))
const activeBp = computed<Breakpoint>(() => {
  if (breakpointList.value) return breakpointWidth.value > 0 ? pickBreakpoint(breakpointList.value, breakpointWidth.value) : baseBp.value
  // Automatic columns, treated like a breakpoint of their own
  if (isNum(props.minColumnWidth) && props.minColumnWidth > 0 && width.value > 0) {
    const columns = columnsForWidth(width.value, props.minColumnWidth, colGap.value, baseBp.value.columns)
    return columns === baseBp.value.columns ? baseBp.value : { name: `${columns}col`, width: 0, columns }
  }
  return baseBp.value
})
const isBase = computed(() => activeBp.value.name === baseBp.value.name)
// Type limits apply at layout time only, they are never written into the widgets
const limitsFor = computed(() => {
  const table = props.sizeLimits
  if (!table || typeof table !== 'object') return undefined
  return (item: LayoutItem) => {
    const type = (item as GridWidget).type
    return type && Object.prototype.hasOwnProperty.call(table, type) ? table[type] : undefined
  }
})
const opts = computed<LayoutOptions>(() => ({ columns: activeBp.value.columns, maxRows: maxRows.value, limits: limitsFor.value }))
const baseOpts = computed<LayoutOptions>(() => ({ columns: baseBp.value.columns, maxRows: maxRows.value, limits: limitsFor.value }))
const metrics = computed(() => {
  const base = { columns: activeBp.value.columns, width: width.value, gap: colGap.value, rowGap: rowGap.value, rowHeight: 0 }
  base.rowHeight = props.rowHeight === 'auto' ? Math.max(1, columnWidth(base)) : fixedRowHeight.value
  return base
})
const rowHeight = computed(() => metrics.value.rowHeight)

// Collapsed widgets keep their full h in the data but take collapsedRows on screen

function applyCollapse(list: readonly T[]): T[] {
  if (!list.some((w) => w.collapsed)) return list as T[]
  return list.map((w) => (w.collapsed ? { ...w, h: collapsedRows.value } : w))
}

function restoreHeights(next: readonly T[], source: readonly T[], extra?: Map<string, number>): T[] {
  if (!next.some((w) => w.collapsed)) return next as T[]
  const heights = new Map(source.map((w) => [w.id, w.h]))
  extra?.forEach((h, id) => heights.set(id, h))
  return next.map((w) => (w.collapsed && heights.has(w.id) ? { ...w, h: heights.get(w.id)! } : w))
}

/* Clamp, remove overlaps and compact a layout as shown on screen */
function settle(list: readonly T[], o: LayoutOptions): T[] {
  return compact(
    resolveCollisions(list.map((w) => clampItem(w, o))),
    props.compact,
    o,
  )
}

/*
 * Make a widget array valid at the base breakpoint, accounting for collapsed widgets
 * Ids in unplaced came without x or y and get the first free spots
 */
function tidyModel(list: readonly T[], unplaced?: ReadonlySet<ItemId>): T[] {
  const onScreen = applyCollapse(list)
  if (!unplaced?.size) return restoreHeights(settle(onScreen, baseOpts.value), list)
  const known = new Map(settle(onScreen.filter((w) => !unplaced.has(w.id)), baseOpts.value).map((w) => [w.id, w]))
  const merged = onScreen.map((w) => known.get(w.id) ?? clampItem(w, baseOpts.value))
  return restoreHeights(compact(placeMissing(merged, unplaced, baseOpts.value), props.compact, baseOpts.value), list)
}

// The grid keeps its own copy of the widgets so back to back changes, like two addWidget calls
// or a drop between nested grids, never overwrite each other before the parent passes the array back

const model = shallowRef<T[]>([])
let committed: T[] = []
let ready = false
const history = new LayoutHistory<T>(wholeAtLeast(props.historyLimit, 0, 100))
const canUndo = ref(false)
const canRedo = ref(false)

function syncHistoryFlags() {
  canUndo.value = props.history && history.canUndo
  canRedo.value = props.history && history.canRedo
}

function setModel(next: T[], notify: boolean, record = true) {
  const previous = committed
  if (record && ready && props.history) history.record(previous, next)
  if (ready) animatePresence(previous, next)
  else if (animation.value.appear) animatePresence([], next)
  model.value = next
  committed = cloneLayout(next)
  syncHistoryFlags()
  if (!notify) return
  emit('update:modelValue', next)
  if (!ready) return
  const changed = changedIds(previous, next)
  if (changed.size) emit('change', next.filter((w) => changed.has(w.id)))
}

// CSS animates moves and resizes, this handles widgets appearing and disappearing

const reducedMotion = ref(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
const animation = computed(() => resolveAnimation(props.animation, reducedMotion.value))
const entering = shallowRef<ReadonlyMap<ItemId, number>>(new Map())
const enterTimers = new Set<ReturnType<typeof setTimeout>>()
// No fade out for widgets moving to another grid, the ghost already shows where they went
const skipLeave = new Set<ItemId>()

function animatePresence(previous: readonly T[], next: readonly T[]) {
  const anim = animation.value
  const before = new Set(previous.map((w) => w.id))
  const after = new Set(next.map((w) => w.id))
  if (anim.enter) {
    // Arrivals cascade in reading order when stagger is set, capped so a big load never drags on
    const added = next.filter((w) => !before.has(w.id)).sort((a, b) => a.y - b.y || a.x - b.x)
    if (added.length) {
      const delays = added.map((w, i) => [w.id, Math.min(i * anim.stagger, 1200)] as const)
      entering.value = new Map([...entering.value, ...delays])
      const longest = delays[delays.length - 1]![1]
      enterTimers.add(setTimeout(() => {
        const remaining = new Map(entering.value)
        delays.forEach(([id]) => remaining.delete(id))
        entering.value = remaining
      }, enterDuration(anim) + longest + 50))
    }
  }
  if (anim.leave && container.value) {
    for (const w of previous) {
      if (after.has(w.id) || skipLeave.has(w.id)) continue
      const el = [...container.value.children].find((child) => (child as HTMLElement).dataset?.widgetId === w.id)
      if (el) animateLeave(el as HTMLElement, container.value, anim)
    }
  }
  skipLeave.clear()
}

onMounted(() => {
  const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  if (!query) return
  reducedMotion.value = query.matches
  const onChange = () => (reducedMotion.value = query.matches)
  query.addEventListener?.('change', onChange)
  onBeforeUnmount(() => query.removeEventListener?.('change', onChange))
})

const modelItem = (id: ItemId) => model.value.find((w) => w.id === id)

// Selection, several widgets picked to move, remove or edit together

const selected = shallowRef<ReadonlySet<ItemId>>(new Set())
const selectionEnabled = computed(() => props.selectable && canEdit.value)

function setSelection(ids: Iterable<ItemId>) {
  const next = new Set<ItemId>()
  for (const id of ids) if (modelItem(id)) next.add(id)
  const current = selected.value
  if (next.size === current.size && [...next].every((id) => current.has(id))) return
  selected.value = next
  emit('selectionChange', [...next])
}

/* Replace the selection, add to it, or toggle each id in and out */
function select(ids: ItemId | readonly ItemId[], mode: 'replace' | 'add' | 'toggle' = 'replace') {
  const list = typeof ids === 'string' ? [ids] : [...ids]
  if (mode === 'replace') return setSelection(list)
  const next = new Set(selected.value)
  for (const id of list) {
    if (mode === 'toggle' && next.has(id)) next.delete(id)
    else next.add(id)
  }
  setSelection(next)
}

const clearSelection = () => setSelection([])
const selectAll = () => setSelection(model.value.map((w) => w.id))
const selection = computed(() => [...selected.value])

/* The selected group a pressed widget moves with, empty unless it is part of a multi selection */
function groupMembers(id: ItemId): ItemId[] {
  if (!selectionEnabled.value || !selected.value.has(id) || selected.value.size < 2) return []
  return rendered.value.filter((w) => w.id !== id && selected.value.has(w.id) && !w.static && !w.noMove).map((w) => w.id)
}

function pressSelect(id: ItemId, toggle: boolean) {
  if (!selectionEnabled.value) return
  if (toggle) select(id, 'toggle')
  else if (!selected.value.has(id)) setSelection([id])
}

// On screen layout for the active breakpoint, with collapsed widgets shortened

const view = computed<T[]>(() =>
  isBase.value ? model.value : deriveLayout(model.value, activeBp.value, baseBp.value, maxRows.value, props.breakpointLayout),
)
const effective = computed<T[]>(() => (isBase.value ? applyCollapse(view.value) : settle(applyCollapse(view.value), opts.value)))

// Live layout while dragging, resizing or previewing a drop
const display = shallowRef<T[] | null>(null)
const rendered = computed<T[]>(() => (display.value ? restoreLayout(display.value, effective.value) : effective.value))

/* Save a layout arranged on screen back into the widget array */
function commitView(next: readonly T[], extraHeights?: Map<string, number>, record = true) {
  const withHeights = restoreHeights(next, view.value, extraHeights)
  setModel(writeLayout(model.value, withHeights, activeBp.value, baseBp.value), true, record)
}

// Drag and resize

interface Session {
  kind: InteractionKind
  id: ItemId
  handle: ResizeHandle
  el: HTMLElement
  /* Layout at pointerdown, every move is computed from it so nothing drifts */
  start: T[]
  /* Pointer position inside the grid at pointerdown, in px */
  startPointer: Point
  startPixels: Rect
  /* Grab point relative to the widget top left corner */
  grab: Point
  /* Grab point as a fraction of the widget size, so it survives column width changes */
  grabFraction: Point
  /* Resize only, pointer distance to the dragged edge, kept so the edge stays under the pointer */
  edgeOffset: Point
  /* The widget at pointerdown in grid units, its pixel box is recomputed on every move */
  startItem: T
  /* Other selected widgets moving along, empty for a single widget */
  members: ItemId[]
  /* Pointer position on screen at pointerdown */
  startClient: Point
  /* Set once the pointer travels far enough to count as a drag rather than a click */
  moved: boolean
  /* Where every grid in the group was when the drag started, for hit testing */
  targets: TargetSnapshot[]
  /* Another grid the widget is being dragged over */
  transfer: DropTarget | null
  ghost: Ghost | null
  stopScroll: (() => void) | null
}

const session = shallowRef<Session | null>(null)
const active = ref<ActiveInteraction | null>(null)
const livePixels = ref<Rect | null>(null)
const groupPixels = shallowRef<ReadonlyMap<ItemId, Rect> | null>(null)
const transferring = ref<ItemId | null>(null)
const removing = ref<ItemId | null>(null)
let pointer: Point = { x: 0, y: 0 }
// Last cell or size reported, so drag and resize events only fire on real changes
let lastReported = ''

/* Pointer position relative to the grid, measured fresh so scrolling never causes drift */
function pointerInGrid(p: Point = pointer): Point {
  const el = container.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return { x: p.x - rect.left - el.clientLeft, y: p.y - rect.top - el.clientTop }
}

/* A widget leaving for another grid, breakpoint positions belong to this grid and stay behind */
function travelling(widget: T): GridWidget {
  const { breakpoints: _ignored, ...rest } = widget
  return rest
}

function listen() {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', onCancel)
  // Capture phase catches scrolling of any ancestor, not just the window
  window.addEventListener('scroll', update, true)
}

function unlisten() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onCancel)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('blur', onCancel)
  window.removeEventListener('scroll', update, true)
}

function onPointerMove(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY }
  const s = session.value
  if (s && !s.moved && Math.hypot(pointer.x - s.startClient.x, pointer.y - s.startClient.y) > 3) s.moved = true
  // Moving with no button held means the release was missed, so finish the drag here
  if (event.pointerType === 'mouse' && event.buttons === 0) return finish(true)
  update()
}
const onPointerUp = () => finish(true)
const onCancel = () => finish(false)
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') finish(false)
}

/* Start a drag or resize, false if this widget cannot right now */
function begin(kind: InteractionKind, id: ItemId, event: PointerEvent, el: HTMLElement, handle: ResizeHandle = 'se'): boolean {
  if (session.value || incoming.value || !canEdit.value) return false
  const widget = rendered.value.find((w) => w.id === id)
  if (!widget || widget.static) return false
  if (kind === 'drag' && (!props.draggable || widget.noMove)) return false
  if (kind === 'resize' && (!props.resizable || widget.noResize)) return false

  event.preventDefault()
  pointer = { x: event.clientX, y: event.clientY }
  const startPixels = toPixels(widget, metrics.value)
  const startPointer = pointerInGrid()
  const start = cloneLayout(rendered.value)
  const members = kind === 'drag' ? groupMembers(id) : []
  session.value = {
    kind,
    id,
    handle,
    el,
    start,
    startPointer,
    startPixels,
    grab: { x: startPointer.x - startPixels.x, y: startPointer.y - startPixels.y },
    grabFraction: {
      x: (startPointer.x - startPixels.x) / Math.max(1, startPixels.w),
      y: (startPointer.y - startPixels.y) / Math.max(1, startPixels.h),
    },
    edgeOffset: {
      x: startPointer.x - (handle.includes('w') ? startPixels.x : startPixels.x + startPixels.w),
      y: startPointer.y - (handle.includes('n') ? startPixels.y : startPixels.y + startPixels.h),
    },
    startItem: { ...widget },
    members,
    startClient: { ...pointer },
    moved: false,
    // A selected group stays in this grid, so it needs no drop targets
    targets: kind === 'drag' && !members.length ? snapshotDropTargets(props.group, el) : [],
    transfer: null,
    ghost: null,
    stopScroll: props.autoScroll ? startAutoScroll(() => pointer, () => session.value?.transfer?.element() ?? container.value) : null,
  }
  active.value = { kind, id }
  livePixels.value = startPixels
  display.value = start
  lastReported = ''
  const original = modelItem(id) ?? widget
  startDragState(kind, props.group, original, members.length + 1)
  listen()
  if (kind === 'drag') emit('dragStart', original)
  else emit('resizeStart', original)
  return true
}

/* True if the pointer is over this grid or any grid it could drop into */
function overAnyGrid(s: Session, widget: T): boolean {
  const rect = container.value?.getBoundingClientRect()
  if (rect && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom) return true
  return findDropTarget(pointer, travelling(widget), s.targets, selfTarget) !== null
}

/*
 * Over a trash zone, or outside every grid with removeOnDropOutside
 * Shows the widget as about to be removed and closes its space, true while that is the case
 */
function trackRemoval(s: Session): boolean {
  const widget = modelItem(s.id)
  if (!widget) return false
  const trash = trashAt(pointer, props.group)
  const outside = !trash && props.removeOnDropOutside && !overAnyGrid(s, widget)
  setActiveTrash(trash)
  if (!trash && !outside) {
    if (removing.value === s.id) removing.value = null
    return false
  }
  if (s.transfer) {
    s.transfer.leave()
    s.transfer = null
  }
  // A fixed position copy follows the pointer so the page never stretches, the real widget is hidden
  if (!s.ghost) {
    const size = livePixels.value ?? s.startPixels
    s.ghost = createGhost(s.el, { w: size.w, h: size.h })
    transferring.value = s.id
  }
  s.ghost.el.classList.add('dg-ghost--removing')
  s.ghost.moveTo(pointer.x - s.grab.x, pointer.y - s.grab.y)
  removing.value = s.id
  display.value = compact(removeItem(s.start, s.id), props.compact, opts.value)
  return true
}

/* Over another grid, hide the widget here and let that grid preview it under a floating copy */
function trackTransfer(s: Session): boolean {
  const widget = modelItem(s.id)
  if (!widget) return false
  const target = findDropTarget(pointer, travelling(widget), s.targets, selfTarget)
  const other = target && target !== selfTarget ? target : null
  if (other !== s.transfer) {
    s.transfer?.leave()
    s.transfer = other
  }
  if (!other) {
    if (s.ghost) {
      s.ghost.destroy()
      s.ghost = null
      transferring.value = null
    }
    return false
  }
  if (!s.ghost) {
    const size = livePixels.value ?? s.startPixels
    s.ghost = createGhost(s.el, { w: size.w, h: size.h })
    transferring.value = s.id
  }
  s.ghost.el.classList.remove('dg-ghost--removing')
  // The space it leaves closes up while it is away
  display.value = compact(removeItem(s.start, s.id), props.compact, opts.value)
  s.ghost.moveTo(pointer.x - s.grab.x, pointer.y - s.grab.y)
  other.preview(travelling(widget), pointer, s.grab)
  return true
}

/* Recompute the live layout from the pointer */
function update() {
  const s = session.value
  if (!s) return
  // The widget was removed from outside mid-drag
  if (!modelItem(s.id)) return finish(false)
  if (s.kind === 'drag' && !s.members.length && (trackRemoval(s) || trackTransfer(s))) return

  // Anchored to the pointer and recomputed with current column and row sizes,
  // so the widget stays under the pointer even if the grid changes width mid-drag
  const now = pointerInGrid()
  const base = toPixels(s.startItem, metrics.value)
  // Never past the grid sides or top, which would scroll the page sideways
  // Downward is fine, the grid grows and the page scrolls normally
  const gridWidth = Math.max(0, width.value)
  let next: readonly T[]
  if (s.kind === 'drag') {
    // The bounding box of everything moving stays inside the grid, for one widget that is the widget itself
    const boxes = [base, ...s.members.map((id) => toPixels(s.start.find((w) => w.id === id)!, metrics.value))]
    let left = Infinity
    let right = 0
    let top = Infinity
    for (const b of boxes) {
      left = Math.min(left, b.x)
      right = Math.max(right, b.x + b.w)
      top = Math.min(top, b.y)
    }
    const offsetX = Math.min(Math.max(now.x - s.grabFraction.x * base.w - base.x, -left), Math.max(-left, gridWidth - right))
    const offsetY = Math.max(now.y - s.grabFraction.y * base.h - base.y, -top)
    const px = { ...base, x: base.x + offsetX, y: base.y + offsetY }
    livePixels.value = px
    const cell = toGridPosition(px, metrics.value)
    if (s.members.length) {
      groupPixels.value = new Map(s.members.map((id, i) => [id, { ...boxes[i + 1]!, x: boxes[i + 1]!.x + offsetX, y: boxes[i + 1]!.y + offsetY }]))
      next = moveItems(s.start, [s.id, ...s.members], cell.x - s.startItem.x, cell.y - s.startItem.y, opts.value)
    } else {
      // The exact position lets the widget slide into a nearby gap instead of shoving a neighbour
      next = moveItem(s.start, s.id, cell.x, cell.y, opts.value, toExactPosition(px, metrics.value))
    }
  } else {
    const collapsed = !!s.startItem.collapsed
    const minPx = Math.min(24, rowHeight.value)
    // How far the dragged edge must move to sit under the pointer
    const edgeX = s.handle.includes('w') ? base.x : base.x + base.w
    const edgeY = s.handle.includes('n') ? base.y : base.y + base.h
    const dx = now.x - s.edgeOffset.x - edgeX
    const dy = now.y - s.edgeOffset.y - edgeY
    const box = resizeBox(base, s.handle, dx, collapsed ? 0 : dy, minPx)
    // Growing past the left or top edge stops at it
    if (box.x < 0) {
      box.w += box.x
      box.x = 0
    }
    if (box.y < 0) {
      box.h += box.y
      box.y = 0
    }
    box.w = Math.max(minPx, Math.min(box.w, gridWidth - box.x))
    livePixels.value = box
    next = resizeItem(s.start, s.id, toGridRect(box, metrics.value), s.handle, opts.value)
  }
  // A group keeps its formation under gravity instead of each member floating on its own
  display.value = s.members.length ? compactGroup(next, [s.id, ...s.members], props.compact, opts.value) : compact(next, props.compact, opts.value)

  const moved = display.value.find((w) => w.id === s.id)
  const widget = modelItem(s.id)
  if (moved && widget) {
    const key = `${moved.x},${moved.y},${moved.w},${moved.h}`
    if (key !== lastReported) {
      lastReported = key
      if (s.kind === 'drag') emit('drag', widget, { x: moved.x, y: moved.y })
      else emit('resize', widget, { x: moved.x, y: moved.y, w: moved.w, h: moved.h })
    }
  }
}

/* End the current drag or resize, saving it (commit) or throwing it away */
function finish(commit: boolean) {
  const s = session.value
  if (!s) return
  unlisten()
  s.stopScroll?.()
  const widget = modelItem(s.id)

  try {
    if (commit && widget) {
      if (removing.value === s.id) {
        skipLeave.add(s.id)
        commitView(compact(removeItem(s.start, s.id), props.compact, opts.value))
        s.ghost?.fadeOut(animation.value.duration)
        s.ghost = null
        emit('remove', widget)
      } else if (s.transfer) {
        const placed = s.transfer.drop(travelling(widget), pointer, s.grab, 'grid')
        if (placed) {
          skipLeave.add(s.id)
          commitView(compact(removeItem(s.start, s.id), props.compact, opts.value))
          emit('dragOut', widget)
        }
      } else if (display.value && !layoutsEqual(display.value, s.start)) {
        commitView(display.value)
      }
    } else {
      s.transfer?.leave()
    }
  } catch (error) {
    warn(`Finishing the drag failed (${error instanceof Error ? error.message : String(error)}); the layout was left as it was.`)
  } finally {
    s.ghost?.destroy()
    setActiveTrash(null)
    endDragState()
    session.value = null
    display.value = null
    active.value = null
    livePixels.value = null
    groupPixels.value = null
    transferring.value = null
    removing.value = null
  }
  // Clicking a widget in a multi selection without dragging selects just that widget
  if (commit && !s.moved && s.members.length) setSelection([s.id])
  // Apply content heights reported mid-drag
  if (pendingHeights.size) scheduleContentHeights()

  if (widget) {
    if (s.kind === 'drag') emit('dragEnd', widget)
    else emit('resizeEnd', widget)
  }
}

// Receiving widgets from another grid or from outside

const incoming = shallowRef<{ id: ItemId; sourceId: ItemId; storedH: number } | null>(null)

function previewIncoming(source: GridWidget, p: Point, grab: Point) {
  if (session.value) return
  const current = incoming.value
  const id =
    current && current.sourceId === source.id
      ? current.id
      : modelItem(source.id)
        ? createWidgetId(source.type)
        : source.id
  const storedH = source.h
  const sized = clampItem({ ...source, id, x: 0, y: 0, h: source.collapsed ? collapsedRows.value : source.h } as T, opts.value)
  const px = toPixels(sized, metrics.value)
  const g = { x: Math.min(Math.max(0, grab.x), px.w), y: Math.min(Math.max(0, grab.y), px.h) }
  const local = pointerInGrid(p)
  const topLeft = { x: local.x - g.x, y: local.y - g.y }
  const cell = toGridPosition(topLeft, metrics.value)
  const placed = insertItem(
    effective.value.filter((w) => w.id !== id),
    { ...sized, x: cell.x, y: cell.y },
    opts.value,
    toExactPosition(topLeft, metrics.value),
  )
  if (!placed) {
    // No room within maxRows, so show no preview
    display.value = null
    incoming.value = null
    return
  }
  display.value = compact(placed, props.compact, opts.value)
  incoming.value = { id, sourceId: source.id, storedH }
}

function clearIncoming() {
  if (!incoming.value) return
  incoming.value = null
  if (!session.value) display.value = null
}

function dropIncoming(source: GridWidget, p: Point, grab: Point, from: DropSource): GridWidget | null {
  previewIncoming(source, p, grab)
  const inc = incoming.value
  const layout = display.value
  if (!inc || !layout) {
    clearIncoming()
    return null
  }
  // The dropped widget gets its own copy of the data
  const data = cloneData(source) as T
  delete data.breakpoints
  const final = layout.map((w) => (w.id === inc.id ? ({ ...data, id: inc.id, x: w.x, y: w.y, w: w.w, h: w.h } as T) : w))
  commitView(final, new Map([[inc.id, inc.storedH]]))
  clearIncoming()
  const placed = modelItem(inc.id)
  if (placed) {
    emit('drop', { widget: placed, from })
    emit('add', placed)
  }
  return placed ?? null
}

// Declared after the session and drop state because the first run is immediate
// Cleans and tidies whatever the parent passes, outside changes become undo steps
watch(
  () => props.modelValue,
  (incomingValue) => {
    if (incomingValue === model.value && layoutsEqual(incomingValue, committed)) return
    const unplaced = new Set<ItemId>()
    const sane = sanitizeLayout<T>(incomingValue, warn, unplaced)
    // Same positions with new content, like live data in props, is taken as is
    // No tidy, no undo step, and a drag in progress carries on
    if (ready && !unplaced.size && layoutsEqual(sane, committed)) {
      model.value = sane
      committed = cloneLayout(sane)
      if (sane !== incomingValue) emit('update:modelValue', sane)
      return
    }
    if (session.value) finish(false)
    const tidy = tidyModel(sane, unplaced)
    const unchanged = !unplaced.size && sane === incomingValue && layoutsEqual(tidy, incomingValue)
    setModel(unchanged ? incomingValue : tidy, !unchanged)
    ready = true
  },
  { immediate: true, deep: 2 },
)

watch(model, (list) => {
  if (selected.value.size && [...selected.value].some((id) => !list.some((w) => w.id === id))) setSelection(selected.value)
})
watch(selectionEnabled, (on) => {
  if (!on) clearSelection()
})

watch([() => baseBp.value.columns, () => props.compact, maxRows, collapsedRows, limitsFor], () => {
  if (!ready) return
  if (session.value) finish(false)
  const tidy = tidyModel(model.value)
  if (!layoutsEqual(tidy, model.value)) setModel(tidy, true)
})

watch(
  () => activeBp.value.name,
  (name, previous) => {
    if (previous === undefined) return
    if (session.value) finish(false)
    clearIncoming()
    emit('breakpointChange', name)
  },
)

const selfTarget: DropTarget = {
  element: () => container.value,
  group: () => props.group,
  accepts: (widget) => canEdit.value && (typeof props.acceptDrops === 'function' ? !!props.acceptDrops(widget) : props.acceptDrops !== false),
  preview: previewIncoming,
  leave: clearIncoming,
  drop: dropIncoming,
}
let unregisterTarget: (() => void) | null = null
onMounted(() => (unregisterTarget = registerDropTarget(selfTarget)))

// Lazy rendering, one IntersectionObserver per grid

const lazyEnabled = computed(() => props.lazy !== false && typeof IntersectionObserver !== 'undefined')
let visibilityObserver: IntersectionObserver | null = null
const visibilityCallbacks = new Map<Element, () => void>()

function observeVisibility(el: Element, onVisible: () => void): () => void {
  if (!lazyEnabled.value) {
    onVisible()
    return () => {}
  }
  if (!visibilityObserver) {
    const margin = isNum(props.lazy) ? Math.max(0, props.lazy) : 200
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const callback = visibilityCallbacks.get(entry.target)
          visibilityCallbacks.delete(entry.target)
          visibilityObserver?.unobserve(entry.target)
          callback?.()
        }
      },
      { rootMargin: `${margin}px` },
    )
  }
  visibilityCallbacks.set(el, onVisible)
  visibilityObserver.observe(el)
  return () => {
    visibilityCallbacks.delete(el)
    visibilityObserver?.unobserve(el)
  }
}

// Undo and redo

function travel(restored: T[] | null): boolean {
  if (!restored) return false
  if (session.value) finish(false)
  setModel(tidyModel(restored), true, false)
  return true
}

/* Undo the last layout change, false if there was nothing to undo */
function undo(): boolean {
  if (!props.history || !travel(history.undo(model.value))) return false
  emit('undo')
  return true
}

/* Redo the last undone change, false if there was nothing to redo */
function redo(): boolean {
  if (!props.history || !travel(history.redo(model.value))) return false
  emit('redo')
  return true
}

function clearHistory() {
  history.clear()
  syncHistoryFlags()
}

watch(
  () => props.history,
  (enabled) => {
    if (!enabled) history.clear()
    syncHistoryFlags()
  },
)
watch(
  () => props.historyLimit,
  (limit) => {
    history.setLimit(wholeAtLeast(limit, 0, 100))
    syncHistoryFlags()
  },
)

// Shortcuts go to the most recently used grid only
const gridKey = Symbol('grid')

function claimShortcuts() {
  shortcutOwner.current = gridKey
}

function onShortcut(event: KeyboardEvent) {
  if (!props.shortcuts || !canEdit.value || shortcutOwner.current !== gridKey) return
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  // Leave text fields alone so their own undo and select all work
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return
  const key = event.key.toLowerCase()
  if (key === 'a' && selectionEnabled.value) {
    event.preventDefault()
    selectAll()
    return
  }
  if (!props.history) return
  const isUndo = key === 'z' && !event.shiftKey
  const isRedo = key === 'y' || (key === 'z' && event.shiftKey)
  if (!isUndo && !isRedo) return
  event.preventDefault()
  if (isUndo) undo()
  else redo()
}

onMounted(() => {
  shortcutOwner.current ??= gridKey
  window.addEventListener('keydown', onShortcut)
  // A plain listener instead of @pointerdown.capture, Vue skips handlers for an event stamped
  // in the same millisecond they were attached, which would swallow the first press on a widget
  container.value?.addEventListener('pointerdown', claimShortcuts, true)
})

// Selection box, dragging on empty grid space selects every widget it touches

const marquee = ref<Rect | null>(null)
let stopMarquee: (() => void) | null = null

function onGridPointerDown(event: PointerEvent) {
  const el = container.value
  if (!el || event.target !== el || event.button !== 0 || handledEvents.has(event)) return
  if (!selectionEnabled.value || session.value || incoming.value) return
  // A grid inside a widget leaves plain presses on its empty space to the outer widget, Shift starts a box there
  const nested = !!el.parentElement?.closest('.dg-item')
  if (nested && !event.shiftKey) return
  handledEvents.add(event)
  event.preventDefault()
  const additive = event.shiftKey || event.ctrlKey || event.metaKey
  const before = new Set(selected.value)
  const origin = pointerInGrid({ x: event.clientX, y: event.clientY })
  let drawing = false

  const onMove = (e: PointerEvent) => {
    const now = pointerInGrid({ x: e.clientX, y: e.clientY })
    if (!drawing && Math.hypot(now.x - origin.x, now.y - origin.y) < 4) return
    drawing = true
    const box = { x: Math.min(origin.x, now.x), y: Math.min(origin.y, now.y), w: Math.abs(now.x - origin.x), h: Math.abs(now.y - origin.y) }
    marquee.value = box
    const hits = rendered.value
      .filter((w) => {
        const r = toPixels(w, metrics.value)
        return r.x < box.x + box.w && box.x < r.x + r.w && r.y < box.y + box.h && box.y < r.y + r.h
      })
      .map((w) => w.id)
    setSelection(additive ? [...before, ...hits] : hits)
  }
  const stop = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancelBox)
    window.removeEventListener('keydown', onKey)
    marquee.value = null
    stopMarquee = null
  }
  // A click on empty space without a modifier clears the selection
  const onUp = () => {
    if (!drawing && !additive) clearSelection()
    stop()
  }
  const onCancelBox = () => {
    setSelection(before)
    stop()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancelBox()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancelBox)
  window.addEventListener('keydown', onKey)
  stopMarquee = stop
}

// Keyboard editing on a focused widget, every change is a normal undo step

const keyboardEnabled = computed(() => props.keyboard && canEdit.value)
const announcement = ref('')
let announcements = 0

/* Read a message to screen readers through the live region */
function announce(message: string) {
  // Alternate a trailing space so the same message twice in a row is still read
  announcements++
  announcement.value = announcements % 2 ? message : `${message}\u00a0`
}

function labelFor(widget: GridWidget): string {
  const custom = props.widgetLabel?.(widget as T)
  if (typeof custom === 'string' && custom.trim()) return custom
  const title = widget.props?.title
  return typeof title === 'string' && title.trim() ? title : (widget.type ?? widget.id)
}

const DIRECTIONS: Record<string, [number, number, string]> = {
  ArrowLeft: [-1, 0, 'left'],
  ArrowRight: [1, 0, 'right'],
  ArrowUp: [0, -1, 'up'],
  ArrowDown: [0, 1, 'down'],
}

/* Ids an arrow key or Delete acts on, the whole selection when the focused widget is part of it */
function keyTargets(id: ItemId): ItemId[] {
  return selectionEnabled.value && selected.value.has(id) && selected.value.size > 1 ? [...selected.value] : [id]
}

function moveBy(widget: T, dx: number, dy: number, direction: string) {
  const ids = keyTargets(widget.id)
  const label = ids.length > 1 ? `${ids.length} widgets` : labelFor(widget)
  if (ids.length === 1 && (widget.static || widget.noMove)) return announce(`${label} cannot be moved`)
  const start = effective.value
  const group = start.filter((w) => ids.includes(w.id))
  const left = Math.min(...group.map((w) => w.x))
  const right = Math.max(...group.map((w) => w.x + w.w))
  const top = Math.min(...group.map((w) => w.y))
  const room = dx < 0 ? left : dx > 0 ? opts.value.columns - right : dy < 0 ? top : 50
  // Gravity can snap a one cell step straight back, so keep stepping until the widget really moves
  for (let step = 1; step <= room; step++) {
    const raw =
      ids.length > 1
        ? moveItems(start, ids, dx * step, dy * step, opts.value)
        : moveItem(start, widget.id, widget.x + dx * step, widget.y + dy * step, opts.value)
    if (raw === start) continue
    const next = ids.length > 1 ? compactGroup(raw, ids, props.compact, opts.value) : compact(raw, props.compact, opts.value)
    const after = next.find((w) => w.id === widget.id)!
    if (after.x === widget.x && after.y === widget.y) continue
    commitView(next)
    return announce(ids.length > 1 ? `${label} moved ${direction}` : `${label} moved to column ${after.x + 1}, row ${after.y + 1}`)
  }
  announce(`${label} cannot move ${direction}`)
}

function resizeBy(widget: T, dw: number, dh: number) {
  const label = labelFor(widget)
  if (widget.static || widget.noResize) return announce(`${label} cannot be resized`)
  const start = effective.value
  const raw = resizeItem(start, widget.id, { x: widget.x, y: widget.y, w: widget.w + dw, h: widget.h + dh }, 'se', opts.value)
  const next = raw === start ? start : compact(raw, props.compact, opts.value)
  const after = next.find((w) => w.id === widget.id)!
  if (raw === start || (after.w === widget.w && after.h === widget.h)) return announce(`${label} cannot resize that way`)
  commitView(next)
  announce(`${label} resized to ${after.w} by ${after.h}`)
}

function removeByKey(id: ItemId) {
  const ids = keyTargets(id).filter((target) => !modelItem(target)?.static)
  const widget = modelItem(id)
  if (!ids.length || !widget) return announce(`${widget ? labelFor(widget) : 'Widget'} cannot be removed`)
  removeWidgets(ids)
  announce(ids.length > 1 ? `${ids.length} widgets removed` : `${labelFor(widget)} removed`)
  // Keep focus in the grid so the keyboard can carry on
  nextTick(() => (container.value?.querySelector(':scope > .dg-item') as HTMLElement | null)?.focus({ preventScroll: true }))
}

function onWidgetKey(id: ItemId, event: KeyboardEvent) {
  if (!keyboardEnabled.value || session.value || event.ctrlKey || event.metaKey || event.altKey) return
  const widget = effective.value.find((w) => w.id === id)
  if (!widget) return
  const direction = DIRECTIONS[event.key]
  if (direction) {
    event.preventDefault()
    if (event.shiftKey) resizeBy(widget, direction[0], direction[1])
    else moveBy(widget, direction[0], direction[1], direction[2])
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeByKey(id)
  } else if ((event.key === ' ' || event.key === 'Enter') && selectionEnabled.value) {
    event.preventDefault()
    select(id, 'toggle')
    const count = selected.value.size
    announce(`${labelFor(widget)} ${selected.value.has(id) ? 'selected' : 'deselected'}, ${count} selected`)
  } else if (event.key === 'Escape' && selected.value.size) {
    clearSelection()
    announce('Selection cleared')
  }
}

// Snap guides, lines where the moving widgets line up with the rest

const snapLines = computed<AlignmentGuide[]>(() => {
  if (!props.snapGuides || transferring.value || removing.value) return []
  const s = session.value
  const ids = new Set(s ? [s.id, ...s.members] : incoming.value ? [incoming.value.id] : [])
  if (!ids.size) return []
  const moving = rendered.value.filter((w) => ids.has(w.id)).map((w) => toPixels(w, metrics.value))
  if (!moving.length) return []
  const left = Math.min(...moving.map((b) => b.x))
  const top = Math.min(...moving.map((b) => b.y))
  const target = {
    x: left,
    y: top,
    w: Math.max(...moving.map((b) => b.x + b.w)) - left,
    h: Math.max(...moving.map((b) => b.y + b.h)) - top,
  }
  const others = rendered.value.filter((w) => !ids.has(w.id)).map((w) => toPixels(w, metrics.value))
  return alignmentGuides(target, others)
})

// Public methods, reachable through a template ref

/*
 * Add a widget, placed in the first free spot without x and y and given an id without one
 * Returns the placed widget, or null if there is no room
 */
function addWidget(source: WidgetSource<T>, options: AddWidgetOptions = {}): T | null {
  const input = typeof source === 'function' ? source() : source
  if (!input || typeof input !== 'object') {
    warn('addWidget needs a widget object.')
    return null
  }
  if (session.value) finish(false)
  const data = cloneData(input) as Partial<T>
  let id = typeof data.id === 'string' && data.id ? data.id : createWidgetId(data.type)
  if (modelItem(id)) {
    warn(`addWidget: the id ${id} is already used, so a new one was generated.`)
    id = createWidgetId(data.type)
  }
  const w = wholeAtLeast(data.w, 1, 1)
  const h = wholeAtLeast(data.h, 1, 1)
  const { x, y, breakpoints: _drop, ...rest } = data
  // Without both x and y, addItem finds the first free spot
  const candidate = { ...rest, id, w, h: data.collapsed ? collapsedRows.value : h, ...(isNum(x) && isNum(y) ? { x, y } : {}) } as NewItem<T>
  const next = addItem(effective.value, candidate, opts.value)
  if (!next) {
    warn(`addWidget: no room for widget ${id} within maxRows.`)
    return null
  }
  commitView(compact(next, props.compact, opts.value), new Map([[id, h]]))
  const added = modelItem(id) ?? null
  if (added) emit('add', added)
  if (added && options.scrollIntoView) scrollToWidget(id)
  return added
}

/* Merge values into a widget's props against the latest copy, so quick successive calls all land */
function mergeProps(id: ItemId, patch: Record<string, unknown>): boolean {
  const current = modelItem(id)?.props
  const base = current && typeof current === 'object' && !Array.isArray(current) ? current : {}
  return updateWidget(id, { props: { ...base, ...patch } } as Partial<Omit<T, 'id'>>)
}

/* Bring a widget into view once it has rendered */
function scrollToWidget(id: ItemId) {
  nextTick(() =>
    requestAnimationFrame(() => {
      const el = [...(container.value?.children ?? [])].find((child) => (child as HTMLElement).dataset.widgetId === id)
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }),
  )
}

function removeWidget(id: ItemId): boolean {
  const widget = modelItem(id)
  if (!widget) return false
  if (session.value?.id === id) finish(false)
  setModel(tidyModel(model.value.filter((w) => w.id !== id)), true)
  emit('remove', widget)
  return true
}

/* Play the arrival animation again for some widgets or all of them, like a fresh load */
function playEnter(ids?: readonly ItemId[]) {
  const replay = new Set(ids ?? model.value.map((w) => w.id))
  // Clear first and wait for a paint so animations already running restart from the beginning
  entering.value = new Map()
  nextTick(() => {
    enterTimers.add(setTimeout(() => animatePresence(effective.value.filter((w) => !replay.has(w.id)), effective.value), 20))
  })
}

/* Remove several widgets as one undo step */
function removeWidgets(ids: readonly ItemId[]): boolean {
  const drop = new Set(ids)
  const removed = model.value.filter((w) => drop.has(w.id))
  if (!removed.length) return false
  if (session.value) finish(false)
  setModel(tidyModel(model.value.filter((w) => !drop.has(w.id))), true)
  removed.forEach((w) => emit('remove', w))
  return true
}

const LAYOUT_FIELDS = ['x', 'y', 'w', 'h', 'collapsed', 'minW', 'maxW', 'minH', 'maxH', 'static', 'locked', 'noMove', 'noResize', 'breakpoints']

/* Change fields of one widget, position and size changes are undoable, content is not */
function updateWidget(id: ItemId, patch: Partial<Omit<T, 'id'>>): boolean {
  if (!patch || typeof patch !== 'object' || !modelItem(id)) return false
  const { id: _ignored, ...changes } = patch as Partial<T>
  const affectsLayout = Object.keys(changes).some((key) => LAYOUT_FIELDS.includes(key))
  // A drop would undo a position or rule change to the widget being dragged, so end the drag first
  if (affectsLayout && session.value) finish(false)
  const merged = model.value.map((w) => (w.id === id ? ({ ...w, ...changes } as T) : w))
  setModel(affectsLayout ? tidyModel(sanitizeLayout(merged, warn)) : merged, true)
  return true
}

/* Collapse (true), expand (false) or toggle (no argument) */
function collapseWidget(id: ItemId, collapsed?: boolean): boolean {
  const widget = modelItem(id)
  if (!widget) return false
  const next = collapsed ?? !widget.collapsed
  if (!!widget.collapsed === next) return true
  if (session.value) finish(false)
  const list = model.value.map((w) => {
    if (w.id !== id) return w
    const copy = { ...w }
    if (next) copy.collapsed = true
    else delete copy.collapsed
    return copy
  })
  setModel(tidyModel(list), true)
  return true
}

/* Set how a widget may move: free, pinned, locked or no-resize, undoable */
function setPinMode(id: ItemId, mode: PinMode): boolean {
  const widget = modelItem(id)
  if (!widget || !['free', 'pinned', 'locked', 'no-resize'].includes(mode)) return false
  if (pinModeOf(widget) === mode) return true
  if (session.value) finish(false)
  setModel(tidyModel(model.value.map((w) => (w.id === id ? withPinMode(w, mode) : w))), true)
  return true
}

/*
 * Pack every widget into the tightest layout as one undo step
 * keepOrder keeps reading order, false if it does not fit
 */
function autoArrange(options: ArrangeOptions = {}): boolean {
  if (session.value) finish(false)
  const next = arrangeLayout(effective.value, opts.value, options)
  if (!next) {
    warn('autoArrange: the widgets do not fit within maxRows.')
    return false
  }
  commitView(compact(next, props.compact, opts.value))
  return true
}

/* Forget positions arranged at a breakpoint (default the current one) so it is derived again */
function resetBreakpoint(name: string = activeBp.value.name) {
  if (session.value) finish(false)
  const next = clearBreakpoint(model.value, name)
  if (!layoutsEqual(next, model.value)) setModel(next, true)
}

// Size to content, widgets report content height and once per frame the grid turns it into rows
// Automatic, so not an undo step

const sizeSetting = computed<boolean | number>(() => props.sizeToContent ?? false)
const pendingHeights = new Map<ItemId, number>()
const forcedSizing = new Set<ItemId>()
const recentResizes = new Map<ItemId, number[]>()
let sizeFrame: ReturnType<typeof setTimeout> | number | null = null

function scheduleContentHeights() {
  if (sizeFrame !== null) return
  const run = () => {
    sizeFrame = null
    applyContentHeights()
  }
  sizeFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 16)
}

function reportContentHeight(id: ItemId, px: number) {
  if (!isNum(px) || px < 0) return
  pendingHeights.set(id, px)
  scheduleContentHeights()
}

/* Stop content whose height depends on the widget height from resizing forever */
function oscillating(id: ItemId): boolean {
  const now = Date.now()
  const times = (recentResizes.get(id) ?? []).filter((t) => now - t < 1000)
  times.push(now)
  recentResizes.set(id, times)
  // Forget widgets that have settled so this never grows
  if (recentResizes.size > 200) for (const [key, list] of recentResizes) if (now - list[list.length - 1]! > 1000) recentResizes.delete(key)
  if (times.length <= 8) return false
  warn(`Widget ${id} keeps changing size to fit its content; sizing it was paused. Its content height probably depends on the widget height.`)
  return true
}

function applyContentHeights() {
  // Never resize under the pointer, finish runs this again afterwards
  if (session.value || incoming.value || !pendingHeights.size) return
  let next: readonly T[] = effective.value
  for (const [id, px] of pendingHeights) {
    const item = next.find((w) => w.id === id)
    if (!item || item.collapsed) continue
    const setting = item.sizeToContent ?? sizeSetting.value
    const forced = forcedSizing.has(id)
    if (!forced && (setting === false || setting === 0)) continue
    let rows = rowsForHeight(px, metrics.value)
    if (typeof setting === 'number' && setting > 0) rows = Math.min(rows, Math.floor(setting))
    if (rows === item.h || oscillating(id)) continue
    next = resizeItem(next, id, { x: item.x, y: item.y, w: item.w, h: rows }, 's', opts.value)
  }
  pendingHeights.clear()
  forcedSizing.clear()
  if (next !== effective.value) commitView(compact(next, props.compact, opts.value), undefined, false)
}

/* Measure content at its natural height, whatever its normal styling */
function measureContent(id: ItemId): number | null {
  const item = container.value && [...container.value.children].find((child) => (child as HTMLElement).dataset?.widgetId === id)
  const content = item?.querySelector(':scope > .dg-content') as HTMLElement | null | undefined
  if (!content) return null
  const previous = content.style.height
  content.style.height = 'auto'
  const height = content.getBoundingClientRect().height
  content.style.height = previous
  return height
}

/* Fit one widget or all to their content now, even without sizeToContent, not an undo step */
function resizeToContent(id?: ItemId) {
  if (session.value) return
  const ids = id ? [id] : model.value.map((w) => w.id)
  for (const target of ids) {
    const height = measureContent(target)
    if (height === null) continue
    pendingHeights.set(target, height)
    forcedSizing.add(target)
  }
  applyContentHeights()
}

/* Whether a w by h widget fits anywhere right now */
function willItFit(w: number, h: number): boolean {
  return findFreeSpot(effective.value, w, h, opts.value) !== null
}

/* Whether a rect in grid units is inside the grid and empty */
function isAreaEmpty(rect: Rect): boolean {
  return areaIsEmpty(effective.value, rect, opts.value)
}

/* Grid cell under a screen point, like a mouse event clientX and clientY */
function cellFromPoint(clientX: number, clientY: number): { x: number; y: number } {
  const local = pointerInGrid({ x: clientX, y: clientY })
  const m = metrics.value
  const x = Math.floor(local.x / Math.max(1, columnWidth(m) + m.gap))
  const y = Math.floor(local.y / Math.max(1, m.rowHeight + (m.rowGap ?? m.gap)))
  return { x: Math.min(Math.max(0, x), m.columns - 1), y: Math.max(0, y) }
}

/* Remove every widget as one undo step */
function removeAll(): boolean {
  if (!model.value.length) return false
  if (session.value) finish(false)
  const removed = model.value
  setModel([], true)
  removed.forEach((w) => emit('remove', w))
  return true
}

const breakpoint = computed(() => activeBp.value.name)
const columns = computed(() => activeBp.value.columns)
const rows = computed(() => bottom(effective.value))

defineExpose({
  addWidget,
  removeWidget,
  removeWidgets,
  playEnter,
  select,
  selectAll,
  clearSelection,
  selection,
  updateWidget,
  collapseWidget,
  setPinMode,
  autoArrange,
  undo,
  redo,
  clearHistory,
  resetBreakpoint,
  resizeToContent,
  willItFit,
  isAreaEmpty,
  cellFromPoint,
  removeAll,
  canUndo,
  canRedo,
  breakpoint,
  columns,
  rows,
})

function reportError(widget: GridWidget, error: unknown) {
  console.error(`[dashboard-grid] Widget ${widget.id} crashed and was replaced by a fallback:`, error)
  emit('widgetError', widget as T, error)
}

provide<GridContext>(GRID_CONTEXT, {
  metrics,
  active,
  livePixels,
  transferring,
  removing,
  entering,
  groupPixels,
  selected,
  selectable: selectionEnabled,
  keyboard: keyboardEnabled,
  editable: canEdit,
  draggable: computed(() => props.draggable),
  resizable: computed(() => props.resizable),
  dragHandle: computed(() => props.dragHandle),
  dragCancel: computed(() => props.dragCancel),
  sizeToContent: sizeSetting,
  resizeHandles: defaultHandles,
  lazy: lazyEnabled,
  observeVisibility,
  begin,
  remove: (id) => void removeWidget(id),
  update: (id, patch) => void updateWidget(id, patch as Partial<Omit<T, 'id'>>),
  updateProps: (id, patch) => void mergeProps(id, patch),
  setCollapsed: (id, value) => void collapseWidget(id, value),
  setPinMode: (id, mode) => void setPinMode(id, mode),
  reportError,
  reportContentHeight,
  pressSelect,
  onKey: onWidgetKey,
  labelFor,
})

onBeforeUnmount(() => {
  finish(false)
  stopMarquee?.()
  clearIncoming()
  unregisterTarget?.()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onShortcut)
  container.value?.removeEventListener('pointerdown', claimShortcuts, true)
  if (sizeFrame !== null) {
    if (typeof cancelAnimationFrame === 'function' && typeof sizeFrame === 'number') cancelAnimationFrame(sizeFrame)
    clearTimeout(sizeFrame as ReturnType<typeof setTimeout>)
  }
  if (shortcutOwner.current === gridKey) shortcutOwner.current = null
  visibilityObserver?.disconnect()
  visibilityCallbacks.clear()
  enterTimers.forEach(clearTimeout)
  enterTimers.clear()
})

// Rendering

const widgetsOnScreen = computed(() => {
  const skip = incoming.value?.id
  const list = skip ? rendered.value.filter((w) => w.id !== skip) : rendered.value
  // A widget dragged to a trash zone or another grid leaves the layout but stays mounted
  // under the pointer, so its content keeps its state
  const held = session.value?.id
  if (!held || list.some((w) => w.id === held)) return list
  const original = effective.value.find((w) => w.id === held)
  return original ? [...list, original] : list
})

function componentFor(widget: T): Component | undefined {
  const registry = props.components
  // Own keys only, so a type like toString never picks up a built in
  return widget.type && registry && Object.prototype.hasOwnProperty.call(registry, widget.type) ? registry[widget.type] : undefined
}

// Saved layouts are untrusted, so only declared props reach the component, never the page
function propsFor(widget: T): Record<string, unknown> {
  const props = widget.props
  const component = componentFor(widget)
  if (!props || typeof props !== 'object' || Array.isArray(props) || !component) return {}
  return safeWidgetProps(component, props, widget.id)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown error')
}

const placeholders = computed(() => {
  const s = session.value
  const ids = incoming.value ? [incoming.value.id] : s && !transferring.value && !removing.value ? [s.id, ...s.members] : []
  return rendered.value.filter((w) => ids.includes(w.id)).map((w) => ({ id: w.id, ...toPixels(w, metrics.value) }))
})

const gridRows = computed(() => {
  const extra = session.value || incoming.value ? 1 : 0
  const used = bottom(rendered.value) + extra
  const capped = maxRows.value ? Math.min(used, maxRows.value) : used
  return Math.max(capped, minRows.value)
})

const containerStyle = computed(() => ({
  height: `${gridHeight(gridRows.value, metrics.value)}px`,
  '--dg-col-width': `${columnWidth(metrics.value)}px`,
  '--dg-gap': `${colGap.value}px`,
  '--dg-row-gap': `${rowGap.value}px`,
  '--dg-row-height': `${rowHeight.value}px`,
  '--dg-duration': `${animation.value.duration}ms`,
  '--dg-enter-duration': `${enterDuration(animation.value)}ms`,
  '--dg-easing': animation.value.easing,
}))

</script>

<template>
  <div
    ref="container"
    class="dg-grid"
    :class="{
      'dg-grid--interacting': session || incoming,
      'dg-grid--receiving': incoming,
      'dg-grid--editable': canEdit,
      'dg-grid--readonly': !canEdit,
      'dg-grid--guides': guides,
      'dg-grid--cells': showCells === true || (showCells === 'editing' && canEdit),
      [`dg-grid--handles-${showHandles}`]: true,
      [`dg-grid--enter-${animation.enter}`]: !!animation.enter,
      'dg-grid--selecting': !!marquee,
    }"
    :style="containerStyle"
    :data-breakpoint="activeBp.name"
    @pointerdown="onGridPointerDown"
  >
    <div
      v-for="box in placeholders"
      :key="`placeholder-${box.id}`"
      class="dg-placeholder"
      :style="{
        width: `${box.w}px`,
        height: `${box.h}px`,
        transform: `translate(${box.x}px, ${box.y}px)`,
      }"
    />
    <div
      v-for="line in snapLines"
      :key="`${line.orientation}-${line.position}`"
      class="dg-snap-guide"
      :class="`dg-snap-guide--${line.orientation}`"
      :style="
        line.orientation === 'vertical'
          ? { transform: `translate(${line.position}px, ${line.start}px)`, height: `${line.end - line.start}px` }
          : { transform: `translate(${line.start}px, ${line.position}px)`, width: `${line.end - line.start}px` }
      "
    />
    <div
      v-if="marquee"
      class="dg-marquee"
      :style="{ width: `${marquee.w}px`, height: `${marquee.h}px`, transform: `translate(${marquee.x}px, ${marquee.y}px)` }"
    />
    <div class="dg-live" aria-live="polite" aria-atomic="true">{{ announcement }}</div>
    <GridItem v-for="widget in widgetsOnScreen" :key="widget.id" :widget="widget">
      <template #default="{ interaction }">
        <slot
          :widget="widget"
          :interaction="interaction"
          :editable="canEdit"
          :collapsed="!!widget.collapsed"
          :selected="selected.has(widget.id)"
          :remove="() => removeWidget(widget.id)"
          :update="(patch: Partial<Omit<T, 'id'>>) => updateWidget(widget.id, patch)"
          :update-props="(patch: Record<string, unknown>) => mergeProps(widget.id, patch)"
          :collapse="(value?: boolean) => collapseWidget(widget.id, value)"
          :pin-mode="pinModeOf(widget)"
          :set-pin-mode="(mode: PinMode) => setPinMode(widget.id, mode)"
        >
          <component :is="componentFor(widget)" v-if="componentFor(widget)" v-bind="propsFor(widget)" />
          <div v-else-if="widget.type" class="dg-missing">No component registered for type {{ widget.type }}</div>
        </slot>
      </template>
      <template #error="{ error, retry }">
        <slot name="error" :widget="widget" :error="error" :retry="retry">
          <div class="dg-error" role="alert">
            <strong>This widget crashed</strong>
            <span>{{ errorMessage(error) }}</span>
            <button type="button" @click="retry">Retry</button>
          </div>
        </slot>
      </template>
    </GridItem>
  </div>
</template>

<style>
.dg-grid {
  position: relative;
  transition: height var(--dg-duration, 200ms) var(--dg-easing, ease);
}

/* Handle marks, hover shows them over a widget, auto does that with a mouse and always on touch */
.dg-grid--handles-hover .dg-resize-handle--se::after {
  opacity: 0;
  transition: opacity 0.15s;
}
.dg-grid--handles-hover .dg-item:hover > .dg-resize-handle--se::after {
  opacity: 0.4;
}
@media (hover: hover) {
  .dg-grid--handles-auto .dg-resize-handle--se::after {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .dg-grid--handles-auto .dg-item:hover > .dg-resize-handle--se::after {
    opacity: 0.4;
  }
}

.dg-grid--interacting {
  user-select: none;
}

.dg-grid--guides.dg-grid--interacting {
  background-image: repeating-linear-gradient(
    to right,
    var(--dg-guide-color, rgba(100, 116, 139, 0.07)) 0 var(--dg-col-width),
    transparent var(--dg-col-width) calc(var(--dg-col-width) + var(--dg-gap))
  );
}

/* Cell lattice behind the widgets, sized from the grid's own variables */
.dg-grid--cells::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    to right,
    var(--dg-cell-color, rgba(100, 116, 139, 0.06)) 0 var(--dg-col-width),
    transparent var(--dg-col-width) calc(var(--dg-col-width) + var(--dg-gap))
  );
  -webkit-mask-image: repeating-linear-gradient(
    to bottom,
    #000 0 var(--dg-row-height),
    transparent var(--dg-row-height) calc(var(--dg-row-height) + var(--dg-row-gap))
  );
  mask-image: repeating-linear-gradient(
    to bottom,
    #000 0 var(--dg-row-height),
    transparent var(--dg-row-height) calc(var(--dg-row-height) + var(--dg-row-gap))
  );
  animation: dg-cells-in 0.3s ease;
}

.dg-grid--cells.dg-grid--interacting::before {
  background-image: repeating-linear-gradient(
    to right,
    var(--dg-cell-active-color, rgba(100, 116, 139, 0.12)) 0 var(--dg-col-width),
    transparent var(--dg-col-width) calc(var(--dg-col-width) + var(--dg-gap))
  );
}

@keyframes dg-cells-in {
  from {
    opacity: 0;
  }
}

/* Arrival effects, the grid picks one and each widget waits its own delay for a cascade */
.dg-grid > .dg-item--entering > .dg-content {
  animation: dg-enter-scale var(--dg-enter-duration, 200ms) var(--dg-easing, ease) var(--dg-enter-delay, 0ms) both;
}
.dg-grid--enter-fade > .dg-item--entering > .dg-content {
  animation-name: dg-enter-fade;
}
.dg-grid--enter-rise > .dg-item--entering > .dg-content {
  animation-name: dg-enter-rise;
}
.dg-grid--enter-drop > .dg-item--entering > .dg-content {
  animation-name: dg-enter-drop;
}
.dg-grid--enter-zoom > .dg-item--entering > .dg-content {
  animation-name: dg-enter-zoom;
}
.dg-grid--enter-flip > .dg-item--entering > .dg-content {
  animation-name: dg-enter-flip;
  transform-origin: 50% 0;
}
.dg-grid--enter-zip > .dg-item--entering > .dg-content {
  animation-name: dg-enter-zip;
}

@keyframes dg-enter-fade {
  from {
    opacity: 0;
  }
}
@keyframes dg-enter-scale {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}
@keyframes dg-enter-rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
@keyframes dg-enter-drop {
  from {
    opacity: 0;
    transform: translateY(-32px);
  }
}
@keyframes dg-enter-zoom {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}
/* Zip eases out of nowhere, accelerates hard into place, then settles with one small bounce */
@keyframes dg-enter-zip {
  0% {
    opacity: 0;
    transform: translateY(100vh) scale(0.97);
    animation-timing-function: cubic-bezier(0.75, 0, 0.95, 0.35);
  }
  35% {
    opacity: 1;
  }
  80% {
    transform: translateY(-10px) scale(1);
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  91% {
    transform: translateY(3px);
    animation-timing-function: ease-in-out;
  }
  100% {
    transform: none;
  }
}
@keyframes dg-enter-flip {
  from {
    opacity: 0;
    transform: perspective(900px) rotateX(-75deg);
  }
}

/* Lines where the moving widget lines up with others */
.dg-snap-guide {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 15;
  pointer-events: none;
  background: var(--dg-snap-color, #ec4899);
}
.dg-snap-guide--vertical {
  width: 1px;
  margin-left: -0.5px;
}
.dg-snap-guide--horizontal {
  height: 1px;
  margin-top: -0.5px;
}

/* Selection box drawn on empty space */
.dg-marquee {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 20;
  pointer-events: none;
  border: 1px solid var(--dg-selection-color, #3b82f6);
  background: var(--dg-marquee-bg, rgba(59, 130, 246, 0.08));
}

.dg-grid--selecting {
  user-select: none;
}

/* Live region for keyboard announcements, read aloud but never seen */
.dg-live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.dg-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--dg-radius, 8px);
  background: var(--dg-placeholder-bg, rgba(100, 116, 139, 0.15));
  border: 2px dashed var(--dg-placeholder-border, rgba(100, 116, 139, 0.5));
  box-sizing: border-box;
  transition:
    transform var(--dg-duration, 150ms) var(--dg-easing, ease),
    width var(--dg-duration, 150ms) var(--dg-easing, ease),
    height var(--dg-duration, 150ms) var(--dg-easing, ease);
}

.dg-missing {
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: var(--dg-radius, 8px);
  border: 2px dashed rgba(220, 38, 38, 0.5);
  color: rgb(220, 38, 38);
  font-size: 0.85rem;
}

.dg-ghost {
  opacity: 0.85;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  cursor: grabbing;
  transition:
    opacity 0.15s,
    scale 0.15s;
}

/* Shrinks and fades over a trash zone, so whatever the zone says stays readable */
.dg-ghost--removing {
  opacity: 0.3;
  scale: 0.85;
  filter: grayscale(1);
}

.dg-source {
  cursor: grab;
  user-select: none;
}

.dg-item--leaving {
  z-index: 5;
}

html.dg-external-dragging,
html.dg-external-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}
</style>
