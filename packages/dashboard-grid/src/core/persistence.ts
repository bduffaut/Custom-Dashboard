import { LAYOUT_KEYS } from './layout'
import { sanitizeLayout } from './sanitize'
import type { LayoutItem } from './types'
import { warn } from './warn'

// Save and load layouts as versioned JSON so old data can be upgraded
// Loading never throws, unreadable data falls back to the default

export interface SavedLayout<T extends LayoutItem = LayoutItem> {
  /* Your format version, bump it when widget shapes change */
  version: number
  savedAt: string
  widgets: T[]
}

export interface ParseOptions<T extends LayoutItem> {
  /* Version your code expects now, defaults to 1 */
  version?: number
  /*
   * Upgrade widgets saved by an older version
   * Gets the raw widgets and their version, a bare array counts as version 0
   */
  migrate?: (widgets: unknown[], fromVersion: number) => unknown[]
  /* Used when nothing usable could be loaded */
  fallback?: T[] | (() => T[])
}

/* Wrap widgets with a version and timestamp, ready for JSON.stringify */
export function toSavedLayout<T extends LayoutItem>(widgets: readonly T[], version = 1): SavedLayout<T> {
  return { version, savedAt: new Date().toISOString(), widgets: JSON.parse(JSON.stringify(widgets)) as T[] }
}

/*
 * Merge a saved layout with the widgets that should exist now, like one per project from your data
 * Widgets in both keep their saved position, size, collapsed and pin state with everything else from current,
 * widgets no longer in current are dropped, and new ones lose x and y so the grid places them in free spots
 */
export function reconcileLayout<T extends LayoutItem>(saved: readonly T[], current: readonly T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  const kept = new Set<string>()
  const out: T[] = []
  for (const old of saved) {
    const now = byId.get(old.id)
    if (!now || kept.has(old.id)) continue
    kept.add(old.id)
    const merged = { ...now } as Record<string, unknown>
    for (const key of LAYOUT_KEYS) {
      if (old[key] === undefined) delete merged[key]
      else merged[key] = old[key]
    }
    out.push(merged as T)
  }
  for (const item of current) {
    if (kept.has(item.id)) continue
    const { x: _x, y: _y, ...rest } = item
    out.push(rest as unknown as T)
  }
  return out
}

/* Layout as a JSON string, ready to store or send */
export function serializeLayout<T extends LayoutItem>(widgets: readonly T[], version = 1): string {
  return JSON.stringify(toSavedLayout(widgets, version))
}

/*
 * Read a saved layout from a JSON string, object or bare widget array
 * Migrates old versions and cleans every widget
 * Never throws, returns fallback or an empty array when nothing is usable
 */
export function parseLayout<T extends LayoutItem>(input: unknown, options: ParseOptions<T> = {}): T[] {
  const version = options.version ?? 1
  const fallback = () => (typeof options.fallback === 'function' ? options.fallback() : (options.fallback ?? []))

  try {
    let data: unknown = input
    if (typeof data === 'string') {
      if (data.trim() === '') return fallback()
      data = JSON.parse(data)
      // serializeLayout already returns a string, so wrapping it in JSON.stringify encodes it twice
      if (typeof data === 'string') {
        warn('The saved layout was JSON encoded twice; serializeLayout already returns a string, so store it as is.')
        data = JSON.parse(data)
      }
    }

    let widgets: unknown
    let savedVersion: number
    if (Array.isArray(data)) {
      widgets = data
      savedVersion = 0
    } else if (data && typeof data === 'object' && Array.isArray((data as SavedLayout).widgets)) {
      widgets = (data as SavedLayout).widgets
      const v = (data as SavedLayout).version
      savedVersion = typeof v === 'number' && Number.isFinite(v) ? v : 0
    } else {
      warn('Saved layout is not in a recognised format; using the fallback.')
      return fallback()
    }

    if (savedVersion > version) {
      warn(`Saved layout is version ${savedVersion} but this code expects ${version}; loading it anyway.`)
    } else if (savedVersion < version && options.migrate) {
      widgets = options.migrate(widgets as unknown[], savedVersion)
      if (!Array.isArray(widgets)) {
        warn('The migrate function did not return an array; using the fallback.')
        return fallback()
      }
    }

    return sanitizeLayout<T>(widgets, warn)
  } catch (error) {
    warn(`Could not read the saved layout (${error instanceof Error ? error.message : String(error)}); using the fallback.`)
    return fallback()
  }
}
