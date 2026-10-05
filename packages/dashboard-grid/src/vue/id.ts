import { toRaw } from 'vue'

let counter = 0

/* A unique widget id, like chart-lq3k9x-4 */
export function createWidgetId(prefix = 'widget'): string {
  const safe = String(prefix).replace(/[^\w-]/g, '') || 'widget'
  return `${safe}-${Date.now().toString(36)}-${(counter++).toString(36)}`
}

/*
 * Plain data deep copy so every added or dropped widget gets its own props
 * Works on reactive data, values that cannot be copied fall back to a shallow copy
 */
export function cloneData<T>(value: T): T {
  const raw = toRaw(value)
  try {
    if (typeof structuredClone === 'function') return structuredClone(raw)
  } catch {
    // Fall through to JSON
  }
  try {
    return JSON.parse(JSON.stringify(raw)) as T
  } catch {
    if (Array.isArray(raw)) return [...raw] as T
    return raw && typeof raw === 'object' ? ({ ...raw } as T) : raw
  }
}
