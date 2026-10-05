import type { LayoutItem } from './types'

// Input cleanup for widgets from storage, APIs or hand written code
// Never throws, fixes what it can, drops what it cannot and reports each problem

export type IssueReporter = (message: string) => void

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function idOf(raw: Record<string, unknown>): string | null {
  if (typeof raw.id === 'string' && raw.id.trim() !== '') return raw.id
  if (isFiniteNumber(raw.id)) return String(raw.id)
  return null
}

/*
 * Make one widget safe to lay out: string id, whole x and y of 0 or more, w and h of at least 1
 * Returns the same object if valid, a fixed copy if not, or null without a usable id
 */
function sanitizeItem<T extends LayoutItem>(input: unknown, report?: IssueReporter, unplaced?: Set<string>): T | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    report?.('Ignored a widget that is not an object.')
    return null
  }
  const raw = input as Record<string, unknown>
  const id = idOf(raw)
  if (id === null) {
    report?.('Ignored a widget without an id. Every widget needs a unique string id.')
    return null
  }

  // No x or y means the grid places it in the first free spot
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) unplaced?.add(id)
  const x = isFiniteNumber(raw.x) ? Math.max(0, Math.round(raw.x)) : 0
  const y = isFiniteNumber(raw.y) ? Math.max(0, Math.round(raw.y)) : 0
  const w = isFiniteNumber(raw.w) ? Math.max(1, Math.round(raw.w)) : 1
  const h = isFiniteNumber(raw.h) ? Math.max(1, Math.round(raw.h)) : 1

  if (id === raw.id && x === raw.x && y === raw.y && w === raw.w && h === raw.h) return input as T
  if (!isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) report?.(`Widget ${id} had an invalid w or h; using 1.`)
  return { ...raw, id, x, y, w, h } as T
}

/*
 * Clean a whole list: drop non-objects and widgets without ids, keep the first of each id, fix numbers
 * Returns the same array when nothing changed
 * Ids of widgets without x or y go into unplaced
 */
export function sanitizeLayout<T extends LayoutItem>(input: unknown, report?: IssueReporter, unplaced?: Set<string>): T[] {
  if (!Array.isArray(input)) {
    if (input !== undefined && input !== null) report?.('Expected an array of widgets; got something else, so the grid is empty.')
    return []
  }
  const seen = new Set<string>()
  const out: T[] = []
  let changed = false
  for (const entry of input) {
    const item = sanitizeItem<T>(entry, report, unplaced)
    if (!item) {
      changed = true
      continue
    }
    if (seen.has(item.id)) {
      report?.(`Two widgets share the id ${item.id}; kept the first. Ids must be unique.`)
      changed = true
      continue
    }
    seen.add(item.id)
    if (item !== entry) changed = true
    out.push(item)
  }
  return changed ? out : (input as T[])
}
