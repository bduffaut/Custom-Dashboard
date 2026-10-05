import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import { parseLayout, serializeLayout, warn } from '../core'
import { cloneData, createWidgetId } from './id'
import type { GridWidget } from './types'

// Persistence helpers
// Storage can be missing, blocked or full, so every access is guarded and failures are reported once

export interface StorageOptions {
  /* Your layout format version, bump it when widget shapes change and handle old data in migrate */
  version?: number
  /* Upgrade widgets saved by an older version, a bare array counts as version 0 */
  migrate?: (widgets: unknown[], fromVersion: number) => unknown[]
  /* Where to save, defaults to localStorage, any Storage-like object works */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

function defaultStorage(): StorageOptions['storage'] {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/* The current layout, loaded from storage and saved back automatically */
export function useLayoutStorage<T extends GridWidget>(
  key: string,
  defaults: T[] | (() => T[]),
  options: StorageOptions & { debounce?: number } = {},
) {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const version = options.version ?? 1
  const makeDefault = () => cloneData(typeof defaults === 'function' ? defaults() : defaults)

  function read(): T[] {
    try {
      const raw = storage?.getItem(key)
      if (raw === null || raw === undefined) return makeDefault()
      return parseLayout<T>(raw, { version, migrate: options.migrate, fallback: makeDefault })
    } catch (error) {
      warn(`Could not read the layout from storage (${message(error)}); using the default.`)
      return makeDefault()
    }
  }

  const widgets = ref(read()) as Ref<T[]>
  let timer: ReturnType<typeof setTimeout> | undefined
  // Set by clear so resetting does not immediately save the defaults again
  let skipNextSave = false

  function save() {
    clearTimeout(timer)
    timer = undefined
    try {
      storage?.setItem(key, serializeLayout(widgets.value, version))
    } catch (error) {
      warn(`Could not save the layout to storage (${message(error)}).`)
    }
  }

  watch(
    widgets,
    () => {
      if (skipNextSave) {
        skipNextSave = false
        return
      }
      clearTimeout(timer)
      timer = setTimeout(save, options.debounce ?? 250)
    },
    { deep: true },
  )

  // Write pending changes before the page goes away
  const flush = () => {
    if (timer !== undefined) save()
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)
  if (getCurrentScope()) {
    onScopeDispose(() => {
      flush()
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush)
    })
  }

  return {
    widgets,
    /* Back to the default layout, undoable in the grid */
    reset: () => {
      widgets.value = makeDefault()
    },
    /* Delete the saved copy and go back to the default layout */
    clear: () => {
      try {
        storage?.removeItem(key)
      } catch (error) {
        warn(`Could not clear the saved layout (${message(error)}).`)
      }
      clearTimeout(timer)
      timer = undefined
      skipNextSave = true
      widgets.value = makeDefault()
    },
    /* Save now instead of waiting for the debounce */
    save,
  }
}

export interface NamedLayout<T extends GridWidget = GridWidget> {
  id: string
  name: string
  savedAt: string
  widgets: T[]
}

/*
 * Named layouts the user can save and switch between
 * Loading replaces widgets, which the grid records as one undo step
 */
export function useSavedLayouts<T extends GridWidget>(widgets: Ref<T[]>, options: StorageOptions & { key: string }) {
  const storage = options.storage === undefined ? defaultStorage() : options.storage
  const version = options.version ?? 1

  function read(): NamedLayout<T>[] {
    try {
      const raw = storage?.getItem(options.key)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      const out: NamedLayout<T>[] = []
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        const e = entry as Record<string, unknown>
        if (typeof e.id !== 'string' || typeof e.name !== 'string') continue
        const list = parseLayout<T>(
          { version: typeof e.version === 'number' ? e.version : 0, widgets: e.widgets },
          { version, migrate: options.migrate },
        )
        out.push({ id: e.id, name: e.name, savedAt: typeof e.savedAt === 'string' ? e.savedAt : '', widgets: list })
      }
      return out
    } catch (error) {
      warn(`Could not read saved layouts (${message(error)}).`)
      return []
    }
  }

  const layouts = ref(read()) as Ref<NamedLayout<T>[]>

  function persist() {
    try {
      storage?.setItem(options.key, JSON.stringify(layouts.value.map((l) => ({ ...l, version }))))
    } catch (error) {
      warn(`Could not store saved layouts (${message(error)}).`)
    }
  }

  const find = (idOrName: string) => layouts.value.find((l) => l.id === idOrName) ?? layouts.value.find((l) => l.name === idOrName)

  return {
    layouts,
    /* Save the current layout under a name, an existing name is overwritten */
    save(name: string): NamedLayout<T> {
      const clean = name.trim() || `Layout ${layouts.value.length + 1}`
      const entry: NamedLayout<T> = {
        id: find(clean)?.id ?? createWidgetId('layout'),
        name: clean,
        savedAt: new Date().toISOString(),
        widgets: cloneData(widgets.value),
      }
      const existing = layouts.value.findIndex((l) => l.id === entry.id)
      layouts.value = existing >= 0 ? layouts.value.map((l, i) => (i === existing ? entry : l)) : [...layouts.value, entry]
      persist()
      return entry
    },
    /* Switch to a saved layout by id or name, false if it does not exist */
    load(idOrName: string): boolean {
      const entry = find(idOrName)
      if (!entry) return false
      widgets.value = cloneData(entry.widgets)
      return true
    },
    remove(idOrName: string): boolean {
      const entry = find(idOrName)
      if (!entry) return false
      layouts.value = layouts.value.filter((l) => l.id !== entry.id)
      persist()
      return true
    },
    /* Rename a saved layout, false if it does not exist or the name is taken */
    rename(idOrName: string, name: string): boolean {
      const entry = find(idOrName)
      const clean = name.trim()
      if (!entry || !clean) return false
      if (layouts.value.some((l) => l.id !== entry.id && l.name === clean)) return false
      layouts.value = layouts.value.map((l) => (l.id === entry.id ? { ...l, name: clean } : l))
      persist()
      return true
    },
  }
}
