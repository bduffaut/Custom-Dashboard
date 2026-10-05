import { clampItem, findFreeSpot, resolveCollisions } from './layout'
import type { LayoutItem, Rect } from './types'

// Responsive layouts
// The widget array stores the widest (base) layout and narrower breakpoints are scaled from it
// Positions the user arranges at a breakpoint are saved on each widget under breakpoints[name]

export interface Breakpoint {
  name: string
  /* Applies when the grid is at least this many px wide */
  width: number
  columns: number
}

export type BreakpointConfig = Record<string, { width: number; columns: number }>

/* Defaults, 12 columns on wide screens, 6 on tablets, 1 on phones */
export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  lg: { width: 1024, columns: 12 },
  md: { width: 640, columns: 6 },
  sm: { width: 0, columns: 1 },
}

/* Validate and sort breakpoints widest first, null if none are usable */
export function normalizeBreakpoints(config: BreakpointConfig | null | undefined): Breakpoint[] | null {
  if (!config || typeof config !== 'object') return null
  const list: Breakpoint[] = []
  for (const [name, value] of Object.entries(config)) {
    if (!value || typeof value !== 'object') continue
    const width = Number.isFinite(value.width) ? Math.max(0, value.width) : NaN
    const columns = Number.isFinite(value.columns) ? Math.max(1, Math.floor(value.columns)) : NaN
    if (Number.isNaN(width) || Number.isNaN(columns)) continue
    list.push({ name, width, columns })
  }
  if (!list.length) return null
  return list.sort((a, b) => b.width - a.width)
}

/* Widest breakpoint that fits the width, or the narrowest if none do */
export function pickBreakpoint(list: readonly Breakpoint[], width: number): Breakpoint {
  return list.find((bp) => width >= bp.width) ?? list[list.length - 1]!
}

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return ['x', 'y', 'w', 'h'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]))
}

/*
 * How narrower breakpoints are derived from the base layout
 * - scale keeps each widget's relative position and width (default)
 * - list flows widgets in reading order like text
 */
export type BreakpointLayout = 'scale' | 'list'

/*
 * Layout to show at a breakpoint
 * Saved positions win, the rest are derived from the base layout, then overlaps are resolved
 */
export function deriveLayout<T extends LayoutItem>(
  base: readonly T[],
  bp: Breakpoint,
  baseBreakpoint: Breakpoint,
  maxRows?: number,
  strategy: BreakpointLayout = 'scale',
): T[] {
  if (bp.name === baseBreakpoint.name) return [...base]
  const scale = bp.columns / baseBreakpoint.columns
  const opts = { columns: bp.columns, maxRows }
  const saved = new Set<string>()
  const scaledWidth = (item: T) => (bp.columns === 1 ? 1 : Math.max(1, Math.round(item.w * scale)))
  // Narrow items keep a sensible minimum width for the new column count
  const relaxed = (item: T) => ({ ...item, minW: Math.min(item.minW ?? 1, bp.columns), maxW: undefined })

  let derived: T[]
  if (strategy === 'list') {
    // Fill each row left to right, then start below the tallest widget so far
    const order = [...base].sort((a, b) => a.y - b.y || a.x - b.x)
    const position = new Map<string, { x: number; y: number }>()
    let x = 0
    let rowTop = 0
    let rowBottom = 0
    for (const item of order) {
      const w = Math.min(scaledWidth(item), bp.columns)
      if (x + w > bp.columns) {
        x = 0
        rowTop = rowBottom
      }
      position.set(item.id, { x, y: rowTop })
      x += w
      rowBottom = Math.max(rowBottom, rowTop + item.h)
    }
    derived = base.map((item) => clampItem({ ...relaxed(item), ...position.get(item.id), w: scaledWidth(item) }, opts))
  } else {
    derived = base.map((item) =>
      clampItem({ ...relaxed(item), x: bp.columns === 1 ? 0 : Math.round(item.x * scale), w: scaledWidth(item) }, opts),
    )
  }

  const withSaved = derived.map((item, i) => {
    const override = base[i]!.breakpoints?.[bp.name]
    if (!isRect(override)) return item
    saved.add(item.id)
    return clampItem({ ...base[i]!, x: override.x, y: override.y, w: override.w, h: override.h }, opts)
  })
  return resolveCollisions(withSaved, (item) => saved.has(item.id))
}

/*
 * Write positions arranged at a breakpoint back into the widget array
 * Base positions are written directly, others go into breakpoints[name]
 * Widgets missing from view are removed and new ones get a base position
 */
export function writeLayout<T extends LayoutItem>(
  base: readonly T[],
  view: readonly T[],
  bp: Breakpoint,
  baseBreakpoint: Breakpoint,
): T[] {
  const isBase = bp.name === baseBreakpoint.name
  const byId = new Map(view.map((item) => [item.id, item]))
  const out: T[] = []

  for (const item of base) {
    const v = byId.get(item.id)
    if (!v) continue
    byId.delete(item.id)
    const next: T = isBase
      ? { ...item, x: v.x, y: v.y, w: v.w, h: v.h }
      : { ...item, breakpoints: { ...item.breakpoints, [bp.name]: { x: v.x, y: v.y, w: v.w, h: v.h } } }
    if (v.collapsed) next.collapsed = true
    else delete next.collapsed
    out.push(next)
  }

  // Newly added widgets
  for (const v of byId.values()) {
    if (isBase) {
      out.push({ ...v })
      continue
    }
    const scale = baseBreakpoint.columns / bp.columns
    const w = Math.min(baseBreakpoint.columns, Math.max(1, Math.round(v.w * scale)))
    const spot = findFreeSpot(out, w, v.h, { columns: baseBreakpoint.columns }) ?? { x: 0, y: 0 }
    out.push({ ...v, ...spot, w, breakpoints: { [bp.name]: { x: v.x, y: v.y, w: v.w, h: v.h } } })
  }
  return out
}

/* Forget saved positions for one breakpoint so it is derived again */
export function clearBreakpoint<T extends LayoutItem>(layout: readonly T[], name: string): T[] {
  return layout.map((item) => {
    if (!item.breakpoints || !(name in item.breakpoints)) return item
    const { [name]: _removed, ...rest } = item.breakpoints
    const next = { ...item }
    if (Object.keys(rest).length) next.breakpoints = rest
    else delete next.breakpoints
    return next
  })
}
