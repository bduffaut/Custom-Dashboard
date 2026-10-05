import { cloneLayout, LAYOUT_KEYS, layoutsEqual } from './layout'
import type { LayoutItem } from './types'

/*
 * Rebuild a past layout but keep each widget's current content
 * Restores position, size, collapsed state and which widgets exist
 * Props and custom fields stay at their latest value, so undo never rolls back live data
 */
export function restoreLayout<T extends LayoutItem>(snapshot: readonly T[], current: readonly T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  return snapshot.map((past) => {
    const now = byId.get(past.id)
    if (!now) return { ...past }
    const merged = { ...now } as Record<string, unknown>
    for (const key of LAYOUT_KEYS) {
      if (past[key] === undefined) delete merged[key]
      else merged[key] = past[key]
    }
    return merged as T
  })
}

/*
 * Undo and redo stacks of layout snapshots
 * The caller decides when a change is finished and records the before and after layouts
 */
export class LayoutHistory<T extends LayoutItem> {
  private past: T[][] = []
  private future: T[][] = []

  constructor(private limit = 100) {}

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  /* Save previous as an undo step, skipped if nothing changed */
  record(previous: readonly T[], next: readonly T[]): void {
    if (layoutsEqual(previous, next)) return
    this.past.push(cloneLayout(previous))
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
  }

  /* Layout to show after undo, or null if there is nothing to undo */
  undo(current: readonly T[]): T[] | null {
    return this.step(this.past, this.future, current)
  }

  /* Layout to show after redo, or null if there is nothing to redo */
  redo(current: readonly T[]): T[] | null {
    return this.step(this.future, this.past, current)
  }

  clear(): void {
    this.past = []
    this.future = []
  }

  setLimit(limit: number): void {
    this.limit = Math.max(0, limit)
    while (this.past.length > this.limit) this.past.shift()
  }

  private step(from: T[][], to: T[][], current: readonly T[]): T[] | null {
    // Skip snapshots identical to the screen so every press visibly changes something
    while (from.length) {
      const restored = restoreLayout(from.pop()!, current)
      if (layoutsEqual(restored, current)) continue
      to.push(cloneLayout(current))
      return restored
    }
    return null
  }
}
