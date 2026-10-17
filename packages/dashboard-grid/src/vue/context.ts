import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { GridMetrics, ItemId, PinMode, Rect, ResizeHandle } from '../core'
import type { GridWidget, InteractionKind } from './types'

export interface ActiveInteraction {
  kind: InteractionKind
  id: ItemId
}

/* Internal, what DashboardGrid shares with each GridItem */
export interface GridContext {
  metrics: ComputedRef<GridMetrics>
  active: Ref<ActiveInteraction | null>
  /* Pixel box of the active item while it follows the pointer */
  livePixels: Ref<Rect | null>
  /* Id of a widget being dragged into another grid, hidden here meanwhile */
  transferring: Ref<ItemId | null>
  /* Id of a widget held over a trash zone, or outside the grid with removal on */
  removing: Ref<ItemId | null>
  /* Just added widgets and the delay in ms before each one's enter animation */
  entering: Ref<ReadonlyMap<ItemId, number>>
  /* Pixel boxes of the other members while a selected group is dragged */
  groupPixels: Ref<ReadonlyMap<ItemId, Rect> | null>
  selected: Ref<ReadonlySet<ItemId>>
  selectable: ComputedRef<boolean>
  keyboard: ComputedRef<boolean>
  editable: ComputedRef<boolean>
  draggable: ComputedRef<boolean>
  resizable: ComputedRef<boolean>
  dragHandle: ComputedRef<string | undefined>
  /* Extra selector for elements that never start a drag */
  dragCancel: ComputedRef<string | undefined>
  /* Grid wide size to content, widgets can override it */
  sizeToContent: ComputedRef<boolean | number>
  resizeHandles: ComputedRef<ResizeHandle[]>
  lazy: ComputedRef<boolean>
  observeVisibility(el: Element, onVisible: () => void): () => void
  begin(kind: InteractionKind, id: ItemId, event: PointerEvent, el: HTMLElement, handle?: ResizeHandle): boolean
  remove(id: ItemId): void
  update(id: ItemId, patch: Partial<Omit<GridWidget, 'id'>>): void
  updateProps(id: ItemId, patch: Record<string, unknown>): void
  setCollapsed(id: ItemId, collapsed?: boolean): void
  setPinMode(id: ItemId, mode: PinMode): void
  reportError(widget: GridWidget, error: unknown): void
  /* A size to content widget reports its content height in px */
  reportContentHeight(id: ItemId, px: number): void
  /* Pixel box as drawn, a widget sized to its content is exactly as tall as the content */
  drawnBox(widget: GridWidget, box: Rect): Rect
  /* Pointer pressed on a widget, a modifier toggles it, otherwise it is selected unless already part of the selection */
  pressSelect(id: ItemId, toggle: boolean): void
  /* A key pressed while the widget itself has focus */
  onKey(id: ItemId, event: KeyboardEvent): void
  /* Name for a widget in labels and announcements */
  labelFor(widget: GridWidget): string
}

export const GRID_CONTEXT: InjectionKey<GridContext> = Symbol('dashboard-grid')

export function useGridContext(): GridContext {
  const ctx = inject(GRID_CONTEXT)
  if (!ctx) throw new Error('GridItem must be used inside DashboardGrid')
  return ctx
}

/*
 * Internal, pointerdown events a grid already started a drag from
 * With nested grids the event bubbles to the outer grid, which checks this and ignores it
 */
export const handledEvents = new WeakSet<Event>()

/* Internal, widget arrays the grid takes without an undo step, like a layout loaded after mount */
export const untrackedLoads = new WeakSet<object>()

/* Internal, the grid that answers undo and redo shortcuts, shared by every instance */
export const shortcutOwner: { current: symbol | null } = { current: null }

/* Public, what useWidget gives any component inside a widget */
export interface WidgetContext<T extends GridWidget = GridWidget> {
  /* The widget as shown on screen, updates as it moves and resizes */
  widget: ComputedRef<T>
  /* drag or resize while the user does that to this widget, otherwise null */
  interaction: ComputedRef<InteractionKind | null>
  /* True in edit mode, use it to show editing controls */
  editable: ComputedRef<boolean>
  /* True while collapsed to its header */
  collapsed: ComputedRef<boolean>
  /* True while part of the selection */
  selected: ComputedRef<boolean>
  /* Remove this widget from the dashboard */
  remove(): void
  /*
   * Change fields of this widget, like update({ props })
   * Use it to save widget state such as settings or a nested grid
   */
  update(patch: Partial<Omit<T, 'id'>>): void
  /* Merge new values into this widget's props, keeping the rest, like updateProps({ text }) */
  updateProps(patch: Record<string, unknown>): void
  /* Collapse (true), expand (false) or toggle (no argument), undoable */
  collapse(collapsed?: boolean): void
  /* How this widget may move: free, pinned, locked or no-resize */
  pinMode: ComputedRef<PinMode>
  /* Change the pin mode, undoable */
  setPinMode(mode: PinMode): void
}

export const WIDGET_CONTEXT: InjectionKey<WidgetContext> = Symbol('dashboard-grid-widget')

/* Read and control the widget from any component inside it, no props needed */
export function useWidget<T extends GridWidget = GridWidget>(): WidgetContext<T> {
  const ctx = inject(WIDGET_CONTEXT)
  if (!ctx) throw new Error('useWidget must be called inside a DashboardGrid widget')
  return ctx as unknown as WidgetContext<T>
}
