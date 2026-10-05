import type { Rect, ResizeHandle, ResizeHandles } from './types'

/* Everything needed to convert between grid units and pixels */
export interface GridMetrics {
  columns: number
  /* Inner width of the container in px */
  width: number
  rowHeight: number
  /* Space between columns in px */
  gap: number
  /* Space between rows in px, defaults to gap */
  rowGap?: number
}

const rowGapOf = (m: GridMetrics) => m.rowGap ?? m.gap

export function columnWidth({ columns, width, gap }: GridMetrics): number {
  return Math.max(0, (width - gap * (columns - 1)) / columns)
}

/* Grid units to a pixel box relative to the container */
export function toPixels(rect: Rect, m: GridMetrics): Rect {
  const colW = columnWidth(m)
  const rowGap = rowGapOf(m)
  return {
    x: rect.x * (colW + m.gap),
    y: rect.y * (m.rowHeight + rowGap),
    w: rect.w * colW + (rect.w - 1) * m.gap,
    h: rect.h * m.rowHeight + (rect.h - 1) * rowGap,
  }
}

/* Pixel position to the nearest cell, unclamped */
export function toGridPosition(px: { x: number; y: number }, m: GridMetrics): { x: number; y: number } {
  return {
    x: Math.round(px.x / Math.max(1, columnWidth(m) + m.gap)),
    y: Math.round(px.y / Math.max(1, m.rowHeight + rowGapOf(m))),
  }
}

/* Pixel position to an unrounded cell position, x 7.4 is 40% into column 8 */
export function toExactPosition(px: { x: number; y: number }, m: GridMetrics): { x: number; y: number } {
  return {
    x: px.x / Math.max(1, columnWidth(m) + m.gap),
    y: px.y / Math.max(1, m.rowHeight + rowGapOf(m)),
  }
}

/* Pixel height of a grid with this many rows */
export function gridHeight(rows: number, m: GridMetrics): number {
  return rows > 0 ? rows * m.rowHeight + (rows - 1) * rowGapOf(m) : 0
}

/* Rows needed to fit content of this pixel height */
export function rowsForHeight(px: number, m: GridMetrics): number {
  const rowGap = rowGapOf(m)
  if (!Number.isFinite(px) || px <= 0) return 1
  return Math.max(1, Math.ceil((px + rowGap - 0.5) / Math.max(1, m.rowHeight + rowGap)))
}

/* Columns that fit in width at minWidth px each, between 1 and max */
export function columnsForWidth(width: number, minWidth: number, gap: number, max: number): number {
  if (!(minWidth > 0) || !(width > 0)) return Math.max(1, Math.floor(max))
  return Math.max(1, Math.min(Math.floor(max), Math.floor((width + gap) / (minWidth + gap))))
}

/*
 * Auto-scroll speed in px per frame on each axis
 * Zero until the pointer is within edge px of a side, then ramps up to maxSpeed
 */
export function autoScrollVelocity(
  pointer: { x: number; y: number },
  area: { top: number; right: number; bottom: number; left: number },
  edge: number,
  maxSpeed: number,
): { x: number; y: number } {
  const axis = (position: number, start: number, end: number) => {
    if (position < start + edge) return -maxSpeed * Math.min(1, (start + edge - position) / edge)
    if (position > end - edge) return maxSpeed * Math.min(1, (position - (end - edge)) / edge)
    return 0
  }
  return {
    x: Math.round(axis(pointer.x, area.left, area.right)),
    y: Math.round(axis(pointer.y, area.top, area.bottom)),
  }
}

/*
 * Pixel box after dragging a resize handle by dx and dy
 * The opposite edge stays put and neither side drops below min px
 */
export function resizeBox(start: Rect, handle: ResizeHandle, dx: number, dy: number, min = 1): Rect {
  let { x, y, w, h } = start
  if (handle.includes('e')) w = Math.max(min, start.w + dx)
  if (handle.includes('w')) {
    w = Math.max(min, start.w - dx)
    x = start.x + start.w - w
  }
  if (handle.includes('s')) h = Math.max(min, start.h + dy)
  if (handle.includes('n')) {
    h = Math.max(min, start.h - dy)
    y = start.y + start.h - h
  }
  return { x, y, w, h }
}

/* Pixel box to the nearest grid rect, rounding each edge on its own so a fixed edge stays fixed */
export function toGridRect(px: Rect, m: GridMetrics): Rect {
  const rowGap = rowGapOf(m)
  const stepX = Math.max(1, columnWidth(m) + m.gap)
  const stepY = Math.max(1, m.rowHeight + rowGap)
  const left = Math.round(px.x / stepX)
  const top = Math.round(px.y / stepY)
  const right = Math.round((px.x + px.w + m.gap) / stepX)
  const lower = Math.round((px.y + px.h + rowGap) / stepY)
  return { x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, lower - top) }
}

const ALL_HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const PRESETS: Record<string, ResizeHandle[]> = {
  all: ALL_HANDLES,
  corners: ['ne', 'nw', 'se', 'sw'],
  edges: ['n', 's', 'e', 'w'],
  none: [],
}

/* Normalize a handle setting (one handle, a list or a preset) into a list, ignoring unknown values */
export function resolveHandles(value: ResizeHandles | undefined | null, fallback: ResizeHandle[] = ['se']): ResizeHandle[] {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string' && value in PRESETS) return PRESETS[value]!
  const list = Array.isArray(value) ? value : [value]
  return ALL_HANDLES.filter((handle) => list.includes(handle))
}
