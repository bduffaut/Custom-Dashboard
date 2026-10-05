export type ItemId = string

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/* A side or corner to resize from, n is the top edge, se the bottom right corner */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/* Which resize handles to show, one, a list, a preset or none */
export type ResizeHandles = ResizeHandle | ResizeHandle[] | 'all' | 'corners' | 'edges' | 'none'

/* Position and size in grid units, not pixels */
export interface LayoutItem extends Rect {
  id: ItemId
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
  /* Never moves or resizes, others flow around it */
  static?: boolean
  /*
   * Other items never push it
   * Can still be dragged and resized, floats with gravity and joins auto-arrange
   */
  locked?: boolean
  noMove?: boolean
  noResize?: boolean
  /* Height follows the content, a number caps it at that many rows */
  sizeToContent?: boolean | number
  /*
   * Collapsed to its header
   * Takes collapsedRows on screen while h keeps the full height for expanding
   */
  collapsed?: boolean
  /* Resize handles for this widget, overriding the grid setting */
  resizeHandles?: ResizeHandles
  /* Positions saved for smaller breakpoints, keyed by name and written by the grid */
  breakpoints?: Record<string, Rect>
}

export type Layout = LayoutItem[]

/*
 * - vertical: widgets float up to fill gaps (gridstack default)
 * - horizontal: widgets float left to fill gaps
 * - none: widgets stay where they are dropped
 */
export type CompactMode = 'vertical' | 'horizontal' | 'none'

/* Smallest and largest size in grid cells */
export interface SizeLimits {
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
}

/* Limits every layout operation respects */
export interface LayoutOptions {
  columns: number
  /* Nothing may extend below this many rows */
  maxRows?: number
  /* Fallback size limits for an item, used for any limit the item does not set itself */
  limits?: (item: LayoutItem) => SizeLimits | undefined
}
