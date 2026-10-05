import type { Rect } from './types'

// Snap guides, lines where a moving box lines up with the boxes around it
// Works in any unit, the grid passes pixel boxes so lines land exactly on edges

export interface AlignmentGuide {
  /* vertical lines mark matching left, center or right edges, horizontal ones top, middle or bottom */
  orientation: 'vertical' | 'horizontal'
  /* Where the line sits across its axis */
  position: number
  /* Where it starts and ends along its axis, spanning both boxes */
  start: number
  end: number
}

const EDGES = [
  (r: Rect) => r.x,
  (r: Rect) => r.x + r.w / 2,
  (r: Rect) => r.x + r.w,
] as const

const ROWS = [
  (r: Rect) => r.y,
  (r: Rect) => r.y + r.h / 2,
  (r: Rect) => r.y + r.h,
] as const

/*
 * Lines where target shares a left, center, right, top, middle or bottom edge with another box
 * Edges only match their own kind, so boxes that merely touch side by side draw nothing
 * Lines at the same spot are merged into one long line
 */
export function alignmentGuides(target: Rect, others: readonly Rect[], tolerance = 0.5): AlignmentGuide[] {
  const lines = new Map<string, AlignmentGuide>()
  const add = (orientation: AlignmentGuide['orientation'], position: number, start: number, end: number) => {
    const key = `${orientation}:${Math.round(position)}`
    const line = lines.get(key)
    if (line) {
      line.start = Math.min(line.start, start)
      line.end = Math.max(line.end, end)
    } else {
      lines.set(key, { orientation, position, start, end })
    }
  }
  for (const other of others) {
    for (const edge of EDGES) {
      const at = edge(target)
      if (Math.abs(at - edge(other)) <= tolerance) add('vertical', at, Math.min(target.y, other.y), Math.max(target.y + target.h, other.y + other.h))
    }
    for (const row of ROWS) {
      const at = row(target)
      if (Math.abs(at - row(other)) <= tolerance) add('horizontal', at, Math.min(target.x, other.x), Math.max(target.x + target.w, other.x + other.w))
    }
  }
  return [...lines.values()]
}
