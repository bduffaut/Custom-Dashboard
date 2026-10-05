import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import type { GridWidget, WidgetSource } from './types'

// Headless widget palette: search and grouping for an add menu or sidebar
// Bring your own markup, then pass entry.widget to addWidget or v-draggable-widget

export interface CatalogEntry<T extends GridWidget = GridWidget> {
  /* Unique key for v-for */
  key: string
  name: string
  description?: string
  /* Entries are grouped by this, ungrouped ones go last */
  category?: string
  /* The widget to add, a function gives every add or drop fresh props */
  widget: WidgetSource<T>
}

export interface CatalogGroup<E> {
  category: string
  entries: E[]
}

export interface CatalogOptions {
  /* Category order, any not listed follow in the order they first appear */
  categories?: string[]
}

export interface WidgetCatalog<E> {
  /* Search text, bind it to an input */
  query: Ref<string>
  /* Entries matching the query by name, description or category */
  results: ComputedRef<E[]>
  /* Matching entries grouped by category, empty groups left out */
  groups: ComputedRef<CatalogGroup<E>[]>
}

/*
 * Search and group widget entries for a palette
 * Entries can carry any extra fields, like an icon, and keep their type
 */
export function useWidgetCatalog<E extends CatalogEntry>(entries: MaybeRefOrGetter<readonly E[]>, options: CatalogOptions = {}): WidgetCatalog<E> {
  const query = ref('')

  const results = computed(() => {
    const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const list = toValue(entries)
    if (!words.length) return [...list]
    return list.filter((entry) => {
      const text = `${entry.name} ${entry.description ?? ''} ${entry.category ?? ''}`.toLowerCase()
      return words.every((word) => text.includes(word))
    })
  })

  const groups = computed(() => {
    const order = [...(options.categories ?? [])]
    const byCategory = new Map<string, E[]>()
    for (const entry of results.value) {
      const category = entry.category ?? ''
      if (!byCategory.has(category)) byCategory.set(category, [])
      byCategory.get(category)!.push(entry)
      if (category && !order.includes(category)) order.push(category)
    }
    if (byCategory.has('')) order.push('')
    return order.filter((category) => byCategory.has(category)).map((category) => ({ category, entries: byCategory.get(category)! }))
  })

  return { query, results, groups }
}
