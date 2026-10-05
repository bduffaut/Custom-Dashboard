import { bottom, clampItem, findFreeSpot } from './layout'
import type { LayoutItem, LayoutOptions } from './types'

// Auto-arrange packs every widget into the shortest layout
// Tries several packing orders and keeps the shortest, ties go to the order closest to the current one
// Static and noMove widgets stay put, locked widgets are rearranged like any other

type Order = (a: LayoutItem, b: LayoutItem) => number

const ORDERS: Order[] = [
  (a, b) => a.y - b.y || a.x - b.x,
  (a, b) => b.h - a.h || b.w - a.w || a.y - b.y || a.x - b.x,
  (a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x,
  (a, b) => b.w - a.w || b.h - a.h || a.y - b.y || a.x - b.x,
]

export interface ArrangeOptions {
  /* Keep the current reading order instead of searching for the tightest fit */
  keepOrder?: boolean
}

/* Packed layout in the original array order, or null if it does not fit within maxRows */
export function autoArrange<T extends LayoutItem>(layout: readonly T[], opts: LayoutOptions, options: ArrangeOptions = {}): T[] | null {
  const fixed = layout.filter((item) => item.static || item.noMove).map((item) => ({ ...item }))
  const movable = layout.filter((item) => !item.static && !item.noMove)

  let best: { placed: LayoutItem[]; height: number } | null = null
  for (const order of options.keepOrder ? ORDERS.slice(0, 1) : ORDERS) {
    const placed: LayoutItem[] = [...fixed]
    let fits = true
    for (const item of [...movable].sort(order)) {
      const sized = clampItem({ ...item, x: 0, y: 0 }, opts)
      const spot = findFreeSpot(placed, sized.w, sized.h, opts)
      if (!spot) {
        fits = false
        break
      }
      placed.push({ ...sized, ...spot })
    }
    if (!fits) continue
    const height = bottom(placed)
    if (!best || height < best.height) best = { placed, height }
  }
  if (!best) return null

  const byId = new Map(best.placed.map((item) => [item.id, item]))
  return layout.map((item) => {
    const p = byId.get(item.id)!
    return { ...item, x: p.x, y: p.y, w: p.w, h: p.h }
  })
}
