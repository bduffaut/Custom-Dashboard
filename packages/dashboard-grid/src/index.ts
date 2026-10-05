// Public API, the only things a consumer can import
// Keep it small, every export is something we promise to support
import type { App, Plugin } from 'vue'
import DashboardGrid from './vue/DashboardGrid.vue'
import { vDraggableWidget } from './vue/directive'
import { vWidgetTrash } from './vue/trash'
import type { PinMode } from './core'
import type { AddWidgetOptions, GridWidget, WidgetSource } from './vue/types'

// Components and composables
export { DashboardGrid }
export { useWidget, type WidgetContext } from './vue/context'
export { vDraggableWidget, type DraggableWidgetValue } from './vue/directive'
export { vWidgetTrash } from './vue/trash'
export { ANIMATION_PRESETS, ENTER_EFFECTS, type AnimationOptions, type AnimationPreset, type AnimationSetting, type EnterEffect } from './vue/animation'
export { useLayoutStorage, useSavedLayouts, type NamedLayout, type StorageOptions } from './vue/storage'
export { createWidgetId } from './vue/id'
export { useDragState, type DragKind, type DragState } from './vue/dragState'
export { useWidgetCatalog, type CatalogEntry, type CatalogGroup, type CatalogOptions, type WidgetCatalog } from './vue/catalog'

// Plain functions, usable without Vue
export { parseLayout, serializeLayout, toSavedLayout, type ParseOptions, type SavedLayout } from './core'
export { DEFAULT_BREAKPOINTS, type BreakpointConfig, type BreakpointLayout, type ArrangeOptions } from './core'
export { PIN_MODE_OPTIONS, PIN_MODES, pinModeOf, type PinMode, type PinModeOption } from './core'

// Types
export { defineWidgets } from './vue/types'
export type { AddWidgetOptions, DropEvent, DropSource, GridWidget, InteractionKind, NewGridWidget, WidgetInput, WidgetSource } from './vue/types'
export type { CompactMode, ItemId, LayoutItem, Rect, ResizeHandle, ResizeHandles, SizeLimits } from './core'

/* Methods on a DashboardGrid template ref */
export interface DashboardGridApi<T extends GridWidget = GridWidget> {
  /*
   * Add a widget, or a function that builds one, placed in the first free spot without x and y
   * Returns the placed widget, or null if there is no room
   */
  addWidget(widget: WidgetSource<T>, options?: AddWidgetOptions): T | null
  removeWidget(id: string): boolean
  /* Remove several widgets as one undo step */
  removeWidgets(ids: readonly string[]): boolean
  /* Play the arrival animation again for some widgets or all, uses the enter effect and stagger */
  playEnter(ids?: readonly string[]): void
  /* Replace the selection, add to it, or toggle each id */
  select(ids: string | readonly string[], mode?: 'replace' | 'add' | 'toggle'): void
  selectAll(): void
  clearSelection(): void
  /* Selected ids, reactive */
  readonly selection: string[]
  /* Change fields of one widget, such as its props */
  updateWidget(id: string, patch: Partial<Omit<T, 'id'>>): boolean
  /* Collapse (true), expand (false) or toggle (no argument) */
  collapseWidget(id: string, collapsed?: boolean): boolean
  /* free, pinned, locked or no-resize, undoable */
  setPinMode(id: string, mode: PinMode): boolean
  /* Pack every widget into the tightest layout, false if it does not fit within maxRows */
  autoArrange(options?: { keepOrder?: boolean }): boolean
  /* Fit one widget or all to their content now, even without sizeToContent */
  resizeToContent(id?: string): void
  /* Whether a w by h widget fits anywhere right now */
  willItFit(w: number, h: number): boolean
  /* Whether a rect in grid units is inside the grid and empty */
  isAreaEmpty(rect: { x: number; y: number; w: number; h: number }): boolean
  /* Grid cell under a screen point, like a mouse event clientX and clientY */
  cellFromPoint(clientX: number, clientY: number): { x: number; y: number }
  /* Remove every widget as one undo step */
  removeAll(): boolean
  /* Undo the last layout change, false if there was nothing to undo */
  undo(): boolean
  /* Redo the last undone change, false if there was nothing to redo */
  redo(): boolean
  clearHistory(): void
  /* Forget positions arranged at a breakpoint (default the current one) so it is derived again */
  resetBreakpoint(name?: string): void
  /* True when there is something to undo, reactive */
  readonly canUndo: boolean
  /* True when there is something to redo, reactive */
  readonly canRedo: boolean
  /* Active breakpoint name, or base when breakpoints are off */
  readonly breakpoint: string
  /* Current number of columns */
  readonly columns: number
  /* Rows currently in use */
  readonly rows: number
}

/* Optional plugin that registers DashboardGrid, v-draggable-widget and v-widget-trash globally */
export const DashboardGridPlugin: Plugin = {
  install(app: App) {
    app.component('DashboardGrid', DashboardGrid)
    app.directive('draggable-widget', vDraggableWidget)
    app.directive('widget-trash', vWidgetTrash)
  },
}

export default DashboardGridPlugin
