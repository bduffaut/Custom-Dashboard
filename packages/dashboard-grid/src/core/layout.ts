import type { CompactMode, ItemId, LayoutItem, LayoutOptions, Rect, ResizeHandle } from './types'

// The layout engine
// Every exported function is pure and returns a new layout, or the same one when nothing changed
// Anything that can hit a limit like maxRows returns null or the untouched input instead of a broken layout
//
// Items jump straight to their final row or column, collision checks allocate nothing,
// and free spot searches only test resting positions, so the worst case is O(n^2)

/* Fields that describe placement and movement, everything else is content */
export const LAYOUT_KEYS = ['x', 'y', 'w', 'h', 'collapsed', 'breakpoints', 'static', 'locked', 'noMove', 'noResize'] as const

/* Same movement rules (static, locked, noMove, noResize) on both items */
function sameRules(a: LayoutItem, b: LayoutItem): boolean {
  return !!a.static === !!b.static && !!a.locked === !!b.locked && !!a.noMove === !!b.noMove && !!a.noResize === !!b.noResize
}

const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/*
 * Row ceiling when maxRows is not set
 * Far beyond any real dashboard, it only stops corrupt data like y 1e9 from making a huge grid
 */
const ROW_LIMIT = 10_000

function limits(opts: LayoutOptions) {
  const columns = Math.max(1, Math.floor(num(opts.columns, 12)))
  const maxRows = opts.maxRows !== undefined && num(opts.maxRows, 0) >= 1 ? Math.min(Math.floor(opts.maxRows), ROW_LIMIT) : ROW_LIMIT
  return { columns, maxRows }
}

/*
 * Items that cannot be pushed: static always, locked unless it is the one moving
 * Locked items still float with gravity and join auto-arrange
 */
function isFixed(item: LayoutItem, movingId?: ItemId): boolean {
  return !!item.static || (!!item.locked && item.id !== movingId)
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/* Lowest bottom edge among items in list that overlap item, or -1 */
function lowestOverlap(list: readonly LayoutItem[], item: Rect & { id: string }): number {
  let bottomEdge = -1
  for (const other of list) {
    if (other.id !== item.id && overlaps(item, other)) bottomEdge = Math.max(bottomEdge, other.y + other.h)
  }
  return bottomEdge
}

/* Move item down past each obstacle until it overlaps nothing, mutates item */
function dropBelow(list: readonly LayoutItem[], item: LayoutItem): void {
  for (let edge = lowestOverlap(list, item); edge >= 0; edge = lowestOverlap(list, item)) item.y = edge
}

export function cloneLayout<T extends LayoutItem>(layout: readonly T[]): T[] {
  return layout.map((item) => ({ ...item }))
}

function sameBreakpoints(a: LayoutItem['breakpoints'], b: LayoutItem['breakpoints']): boolean {
  if (a === b) return true
  if (!a || !b) return !a && !b ? true : JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})
  return JSON.stringify(a) === JSON.stringify(b)
}

/* Same widgets in the same order, places and movement rules, content ignored */
export function layoutsEqual(a: readonly LayoutItem[], b: readonly LayoutItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const item = a[i]!
    const other = b[i]!
    if (
      item.id !== other.id ||
      item.x !== other.x ||
      item.y !== other.y ||
      item.w !== other.w ||
      item.h !== other.h ||
      !!item.collapsed !== !!other.collapsed ||
      !sameBreakpoints(item.breakpoints, other.breakpoints) ||
      !sameRules(item, other)
    ) {
      return false
    }
  }
  return true
}

/* Ids of added widgets and of widgets whose position, size or collapsed state changed */
export function changedIds(before: readonly LayoutItem[], after: readonly LayoutItem[]): Set<ItemId> {
  const previous = new Map(before.map((item) => [item.id, item]))
  const changed = new Set<ItemId>()
  for (const item of after) {
    const old = previous.get(item.id)
    if (
      !old ||
      old.x !== item.x ||
      old.y !== item.y ||
      old.w !== item.w ||
      old.h !== item.h ||
      !!old.collapsed !== !!item.collapsed ||
      !sameBreakpoints(old.breakpoints, item.breakpoints) ||
      !sameRules(old, item)
    ) {
      changed.add(item.id)
    }
  }
  return changed
}

/* First empty row below all items */
export function bottom(layout: readonly LayoutItem[]): number {
  let max = 0
  for (const item of layout) max = Math.max(max, item.y + item.h)
  return max
}

function sortByRowCol<T extends LayoutItem>(layout: readonly T[]): T[] {
  return [...layout].sort((a, b) => a.y - b.y || a.x - b.x)
}

function exceedsRows(layout: readonly LayoutItem[], opts: LayoutOptions): boolean {
  return bottom(layout) > limits(opts).maxRows
}

/*
 * Last line of defence for already broken input
 * Moves any overlapping items down, keeping the moved item in place, mutates layout
 */
function settleOverlaps(layout: LayoutItem[], keepId: ItemId): void {
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      if (overlaps(layout[i]!, layout[j]!)) {
        const fixed = resolveCollisions(layout, (item) => item.id === keepId)
        fixed.forEach((item, k) => Object.assign(layout[k]!, { y: item.y }))
        return
      }
    }
  }
}

/* Size limits of an item, its own fields first, then the fallback from opts.limits */
function sizeLimitsOf(item: LayoutItem, opts: LayoutOptions, columns: number) {
  const fallback = opts.limits?.(item)
  const minW = clamp(Math.round(num(item.minW ?? fallback?.minW, 1)), 1, columns)
  const maxW = Math.max(minW, Math.round(num(item.maxW ?? fallback?.maxW, columns)))
  const minH = Math.max(1, Math.round(num(item.minH ?? fallback?.minH, 1)))
  const maxH = Math.max(minH, Math.round(num(item.maxH ?? fallback?.maxH, Infinity)))
  return { minW, maxW, minH, maxH }
}

/*
 * Apply min and max sizes and keep the item inside the grid
 * A collapsed item keeps the height it is given, its limits apply to the expanded size
 */
export function clampItem<T extends LayoutItem>(item: T, opts: LayoutOptions): T {
  const { columns, maxRows } = limits(opts)
  const { minW, maxH, minH, ...rest } = sizeLimitsOf(item, opts, columns)
  const maxW = Math.min(rest.maxW, columns)

  const w = clamp(Math.round(num(item.w, 1)), minW, maxW)
  const h = item.collapsed
    ? Math.max(1, Math.round(num(item.h, 1)))
    : clamp(Math.round(num(item.h, 1)), minH, Math.min(maxH, maxRows))
  const x = clamp(Math.round(num(item.x, 0)), 0, columns - w)
  const y = clamp(Math.round(num(item.y, 0)), 0, Math.max(0, maxRows - h))

  if (x === item.x && y === item.y && w === item.w && h === item.h) return item
  return { ...item, x, y, w, h }
}

/*
 * Remove overlaps by moving items down
 * Items are placed by rank: static, locked, priority, then the rest
 * Each keeps its spot unless it hits something placed earlier, so even impossible input
 * comes out without overlaps, and no item is ever dropped, even past maxRows
 */
export function resolveCollisions<T extends LayoutItem>(layout: readonly T[], priority?: (item: T) => boolean): T[] {
  const out = cloneLayout(layout)
  const rank = (item: T) => (item.static ? 0 : item.locked ? 1 : priority?.(item) ? 2 : 3)
  const order = [...out].sort((a, b) => rank(a) - rank(b) || a.y - b.y || a.x - b.x)
  const placed: LayoutItem[] = []
  for (const item of order) {
    dropBelow(placed, item)
    placed.push(item)
  }
  return out
}

/*
 * Close gaps by pulling items up (vertical) or left (horizontal)
 * Static items stay put, everything else floats, locked included
 */
export function compact<T extends LayoutItem>(layout: readonly T[], mode: CompactMode, opts: LayoutOptions): T[] {
  const out = cloneLayout(layout)
  if (mode === 'none') return out
  const { columns } = limits(opts)
  const placed: LayoutItem[] = out.filter((item) => item.static)

  if (mode === 'horizontal') {
    for (const item of [...out].sort((a, b) => a.x - b.x || a.y - b.y)) {
      if (item.static) continue
      if (lowestOverlap(placed, item) < 0) {
        // Slide left to the right edge of the nearest item on the same rows
        let left = 0
        for (const p of placed) {
          const sameRows = p.y < item.y + item.h && item.y < p.y + p.h
          if (sameRows && p.x + p.w <= item.x) left = Math.max(left, p.x + p.w)
        }
        item.x = left
      }
      // Still overlapping, so move right past the obstacle or wrap to the next row
      // An item at x 0 drops below the obstacle, so this always ends
      for (;;) {
        let right = -1
        for (const p of placed) if (p.id !== item.id && overlaps(item, p)) right = Math.max(right, p.x + p.w)
        if (right < 0) break
        if (right + item.w <= columns) item.x = right
        else if (item.x !== 0) {
          item.x = 0
          item.y++
        } else {
          item.y = lowestOverlap(placed, item)
        }
      }
      placed.push(item)
    }
    return out
  }

  for (const item of sortByRowCol(out)) {
    if (item.static) continue
    if (lowestOverlap(placed, item) < 0) {
      // Float up to the bottom edge of the nearest item above
      let top = 0
      for (const p of placed) {
        const sameColumns = p.x < item.x + item.w && item.x < p.x + p.w
        if (sameColumns && p.y + p.h <= item.y) top = Math.max(top, p.y + p.h)
      }
      item.y = top
    }
    dropBelow(placed, item)
    placed.push(item)
  }
  return out
}

/*
 * Gravity that keeps a group in formation, the group floats as one rigid block
 * Everything else settles around the group first, then the block floats as far as it fits,
 * then the rest fills the gaps it left
 */
export function compactGroup<T extends LayoutItem>(layout: readonly T[], ids: Iterable<ItemId>, mode: CompactMode, opts: LayoutOptions): T[] {
  if (mode === 'none') return cloneLayout(layout)
  const wanted = new Set(ids)
  const block = new Set(layout.filter((item) => wanted.has(item.id) && !item.static).map((item) => item.id))
  if (!block.size) return compact(layout, mode, opts)

  // Members are pinned while the rest settles, then get their own rules back
  const pin = (list: readonly T[]) => list.map((item) => (block.has(item.id) ? { ...item, static: true } : item))
  const unpin = (list: readonly T[]) =>
    list.map((item) => {
      if (!block.has(item.id)) return item
      const copy = { ...item }
      delete copy.static
      return copy
    })

  let out = unpin(compact(pin(layout), mode, opts))
  const vertical = mode === 'vertical'
  for (;;) {
    const shifted = out.map((item) => (block.has(item.id) ? { ...item, x: vertical ? item.x : item.x - 1, y: vertical ? item.y - 1 : item.y } : item))
    const members = shifted.filter((item) => block.has(item.id))
    if (members.some((item) => item.x < 0 || item.y < 0)) break
    if (members.some((item) => shifted.some((other) => !block.has(other.id) && overlaps(item, other)))) break
    out = shifted
  }
  return unpin(compact(pin(out), mode, opts))
}

/*
 * Push every movable item that overlaps moved down until nothing overlaps
 * Pushed items also skip past fixed ones, mutates layout and ends because items only move down
 */
function pushDown(layout: LayoutItem[], moved: LayoutItem): void {
  const fixed = layout.filter((i) => isFixed(i, moved.id))
  const queue = [moved]
  while (queue.length) {
    const current = queue.shift()!
    for (const other of layout) {
      if (other === current || other === moved || isFixed(other, moved.id) || !overlaps(current, other)) continue
      other.y = current.y + current.h
      dropBelow(fixed, other)
      queue.push(other)
    }
  }
}

function blockedByFixed(layout: readonly LayoutItem[], item: LayoutItem): boolean {
  for (const other of layout) if (other.id !== item.id && isFixed(other, item.id) && overlaps(item, other)) return true
  return false
}

/* Where the dragged item really is in unrounded grid units, like x 7.4, y 0.3 */
export interface ExactPosition {
  x: number
  y: number
}

function overlapsAny(layout: readonly LayoutItem[], probe: LayoutItem): boolean {
  for (const other of layout) if (other.id !== probe.id && overlaps(probe, other)) return true
  return false
}

/*
 * Free cell closest to an exact position, trying each axis rounded down and up
 * Lets a widget slide into a gap by the pointer instead of shoving a neighbour, null if all are taken
 */
function snugSpot(layout: readonly LayoutItem[], item: LayoutItem, exact: ExactPosition, opts: LayoutOptions): { x: number; y: number } | null {
  if (!Number.isFinite(exact.x) || !Number.isFinite(exact.y)) return null
  const seen = new Set<string>()
  const candidates: { x: number; y: number; distance: number }[] = []
  for (const cx of [Math.floor(exact.x), Math.ceil(exact.x)]) {
    for (const cy of [Math.floor(exact.y), Math.ceil(exact.y)]) {
      const clamped = clampItem({ ...item, x: cx, y: cy }, opts)
      const key = `${clamped.x},${clamped.y}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push({ x: clamped.x, y: clamped.y, distance: (clamped.x - exact.x) ** 2 + (clamped.y - exact.y) ** 2 })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance)
  for (const c of candidates) {
    if (!overlapsAny(layout, { ...item, x: c.x, y: c.y })) return { x: c.x, y: c.y }
  }
  return null
}

function fitsAt(layout: readonly LayoutItem[], probe: LayoutItem, columns: number): boolean {
  if (probe.x < 0 || probe.y < 0 || probe.x + probe.w > columns) return false
  for (const other of layout) if (other.id !== probe.id && overlaps(probe, other)) return false
  return true
}

/*
 * Move an item to x, y and push whatever it lands on down
 * A neighbour that fits in the space just left swaps in instead
 * Returns the original layout if the move is blocked by a static or locked item, noMove or maxRows
 *
 * exact is the unrounded position, when the rounded cell is taken but a free cell is right there
 * the item slides into it, so neighbours only move when the item is dragged clearly onto them
 */
export function moveItem<T extends LayoutItem>(
  layout: readonly T[],
  id: ItemId,
  x: number,
  y: number,
  opts: LayoutOptions,
  exact?: ExactPosition,
): readonly T[] {
  const out = cloneLayout(layout)
  const item = out.find((i) => i.id === id)
  if (!item || item.static || item.noMove) return layout

  const { columns } = limits(opts)
  const original = { ...item }
  Object.assign(item, clampItem({ ...item, x, y }, opts))
  if (exact && overlapsAny(out, item)) {
    const spot = snugSpot(out, item, exact, opts)
    if (spot) {
      if (spot.x === original.x && spot.y === original.y) return layout
      item.x = spot.x
      item.y = spot.y
      return exceedsRows(out, opts) ? layout : out
    }
  }
  if (item.x === original.x && item.y === original.y) return layout
  if (blockedByFixed(out, item)) return layout

  // Swap, neighbours we land on fill the space we left, packed one after another so several fit
  // Without this compaction would float the dragged item straight back
  const dx = item.x - original.x
  const dy = item.y - original.y
  if (dx !== 0 || dy > 0) {
    const right = dx > 0
    // Nearest neighbours first, so they keep their order in the space they move into
    const neighbours = out
      .filter((other) => other !== item && !isFixed(other, id) && overlaps(item, other))
      .sort((a, b) => (dx !== 0 ? (right ? a.x - b.x : b.x - a.x) : 0) || a.y - b.y || a.x - b.x)
    for (const other of neighbours) {
      const spots: { x: number; y: number }[] = []
      const sideways: { x: number; y: number }[] = []
      const downward: { x: number; y: number }[] = []
      // Columns we left, scanned from the side we came from, at the neighbour's own row
      if (dx !== 0) {
        for (let k = 0; k <= original.w - other.w; k++) sideways.push({ x: right ? original.x + k : original.x + original.w - other.w - k, y: other.y })
      }
      // Rows we left, scanned from the top, in the neighbour's own column
      if (dy > 0) {
        for (let k = 0; k <= original.h - other.h; k++) downward.push({ x: other.x, y: original.y + k })
      }
      spots.push(...(Math.abs(dx) >= Math.abs(dy) ? [...sideways, ...downward] : [...downward, ...sideways]))
      const spot = spots.find((s) => fitsAt(out, { ...other, ...s }, columns))
      if (spot) Object.assign(other, spot)
    }
  }

  pushDown(out, item)
  settleOverlaps(out, id)
  return exceedsRows(out, opts) ? layout : out
}

/*
 * Move several items by the same columns and rows, keeping their formation
 * The shift is clamped so the whole group stays inside the grid, static and noMove members stay put
 * Returns the original layout if nothing moves, a member lands on a static or locked item, or maxRows blocks it
 */
export function moveItems<T extends LayoutItem>(
  layout: readonly T[],
  ids: Iterable<ItemId>,
  dx: number,
  dy: number,
  opts: LayoutOptions,
): readonly T[] {
  const wanted = new Set(ids)
  const out = cloneLayout(layout)
  const group = out.filter((item) => wanted.has(item.id) && !item.static && !item.noMove)
  if (!group.length) return layout

  const { columns } = limits(opts)
  let left = Infinity
  let right = 0
  let top = Infinity
  for (const item of group) {
    left = Math.min(left, item.x)
    right = Math.max(right, item.x + item.w)
    top = Math.min(top, item.y)
  }
  const shiftX = clamp(Math.round(num(dx, 0)), -left, columns - right)
  const shiftY = Math.max(Math.round(num(dy, 0)), -top)
  if (!shiftX && !shiftY) return layout

  const members = new Set(group.map((item) => item.id))
  for (const item of group) {
    item.x += shiftX
    item.y += shiftY
  }
  for (const item of group) {
    for (const other of out) {
      if (!members.has(other.id) && (other.static || other.locked) && overlaps(item, other)) return layout
    }
  }
  // Members keep their new spots and everything else moves down out of the way
  const next = resolveCollisions(out, (item) => members.has(item.id))
  return exceedsRows(next, opts) ? layout : next
}

/*
 * Resize an item toward target from a handle, keeping the opposite edge fixed
 * A collapsed item only resizes horizontally
 * Returns the original layout if nothing changes or a fixed item or maxRows blocks it
 */
export function resizeItem<T extends LayoutItem>(
  layout: readonly T[],
  id: ItemId,
  target: Rect,
  handle: ResizeHandle,
  opts: LayoutOptions,
): readonly T[] {
  const out = cloneLayout(layout)
  const item = out.find((i) => i.id === id)
  if (!item || item.static || item.noResize) return layout

  const { columns, maxRows } = limits(opts)
  const { minW, maxW, minH, maxH } = sizeLimitsOf(item, opts, columns)
  let { x, y, w, h } = item

  if (handle.includes('e')) {
    w = clamp(Math.round(num(target.w, w)), minW, Math.min(maxW, columns - x))
  } else if (handle.includes('w')) {
    const right = item.x + item.w
    w = clamp(Math.round(num(target.w, w)), minW, Math.min(maxW, right))
    x = right - w
  }
  if (!item.collapsed) {
    if (handle.includes('s')) {
      h = clamp(Math.round(num(target.h, h)), minH, Math.min(maxH, maxRows - y))
    } else if (handle.includes('n')) {
      const lower = item.y + item.h
      h = clamp(Math.round(num(target.h, h)), minH, Math.min(maxH, lower))
      y = lower - h
    }
  }

  if (x === item.x && y === item.y && w === item.w && h === item.h) return layout
  const next = { ...item, x, y, w, h }
  if (blockedByFixed(out, next)) return layout

  Object.assign(item, next)
  pushDown(out, item)
  settleOverlaps(out, id)
  return exceedsRows(out, opts) ? layout : out
}

/*
 * Top left most spot where a w by h item fits, or null when maxRows leaves no room
 * Only tests resting positions, row 0 or another item's bottom edge, column 0 or another item's right edge
 */
export function findFreeSpot(
  layout: readonly LayoutItem[],
  w: number,
  h: number,
  opts: LayoutOptions,
): { x: number; y: number } | null {
  const { columns, maxRows } = limits(opts)
  const width = clamp(Math.round(num(w, 1)), 1, columns)
  const height = Math.max(1, Math.round(num(h, 1)))
  const rows = new Set<number>([0])
  const cols = new Set<number>([0])
  for (const item of layout) {
    rows.add(item.y + item.h)
    cols.add(item.x + item.w)
  }
  const ys = [...rows].filter((y) => y + height <= maxRows).sort((a, b) => a - b)
  const xs = [...cols].filter((x) => x + width <= columns).sort((a, b) => a - b)
  const probe = { id: '\u0000', x: 0, y: 0, w: width, h: height }
  for (const y of ys) {
    for (const x of xs) {
      probe.x = x
      probe.y = y
      let free = true
      for (const other of layout) {
        if (overlaps(probe, other)) {
          free = false
          break
        }
      }
      if (free) return { x, y }
    }
  }
  return null
}

/* True if the rect is inside the grid and no item other than ignoreId covers it */
export function isAreaEmpty(layout: readonly LayoutItem[], rect: Rect, opts: LayoutOptions, ignoreId?: ItemId): boolean {
  const { columns, maxRows } = limits(opts)
  if (rect.x < 0 || rect.y < 0 || rect.w < 1 || rect.h < 1 || rect.x + rect.w > columns || rect.y + rect.h > maxRows) return false
  for (const item of layout) if (item.id !== ignoreId && overlaps(rect, item)) return false
  return true
}

/* An item with optional x and y, placed automatically without them */
export type NewItem<T extends LayoutItem = LayoutItem> = Omit<T, 'x' | 'y'> & Partial<Pick<T, 'x' | 'y'>>

/*
 * Insert an item at its x and y and push what it lands on down
 * Slides below static or locked items, and with exact tries a free cell next to that spot first
 * Returns null when it does not fit within maxRows
 */
export function insertItem<T extends LayoutItem>(layout: readonly T[], item: T, opts: LayoutOptions, exact?: ExactPosition): T[] | null {
  const placed = { ...clampItem(item, opts) }
  const others = layout.filter((i) => i.id !== placed.id)
  if (exact && overlapsAny(others, placed)) {
    const spot = snugSpot(others, placed, exact, opts)
    if (spot) {
      const out = [...cloneLayout(others), { ...placed, ...spot }]
      return exceedsRows(out, opts) ? null : out
    }
  }
  dropBelow(
    layout.filter((i) => isFixed(i)),
    placed,
  )
  const out = [...cloneLayout(layout.filter((i) => i.id !== placed.id)), placed]
  pushDown(out, placed)
  settleOverlaps(out, placed.id)
  return exceedsRows(out, opts) ? null : out
}

/* Add an item, without x and y it goes in the first free spot, null when there is no room */
export function addItem<T extends LayoutItem>(layout: readonly T[], item: NewItem<T>, opts: LayoutOptions): T[] | null {
  if (typeof item.x === 'number' && typeof item.y === 'number') return insertItem(layout, item as T, opts)
  // Apply min and max first so the spot fits the real size
  const sized = clampItem({ ...item, x: 0, y: 0 } as T, opts)
  const spot = findFreeSpot(layout, sized.w, sized.h, opts)
  if (!spot) return null
  return [...cloneLayout(layout), { ...sized, ...spot }]
}

/* Place the ids in missing in the first free spots, in array order */
export function placeMissing<T extends LayoutItem>(layout: readonly T[], missing: ReadonlySet<ItemId>, opts: LayoutOptions): T[] {
  if (!missing.size) return [...layout]
  const out = cloneLayout(layout)
  const placed: LayoutItem[] = out.filter((item) => !missing.has(item.id))
  for (const item of out) {
    if (!missing.has(item.id)) continue
    const spot = findFreeSpot(placed, item.w, item.h, opts) ?? { x: 0, y: bottom(placed) }
    item.x = spot.x
    item.y = spot.y
    placed.push(item)
  }
  return out
}

export function removeItem<T extends LayoutItem>(layout: readonly T[], id: ItemId): T[] {
  return cloneLayout(layout.filter((item) => item.id !== id))
}
