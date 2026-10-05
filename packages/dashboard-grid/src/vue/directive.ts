import type { ObjectDirective } from 'vue'
import { beginExternalDrag } from './dnd'
import type { NewGridWidget } from './types'

/* A widget to create on drop, or a function returning a fresh one per drop */
export type DraggableWidgetValue = NewGridWidget | (() => NewGridWidget | null | undefined) | null | undefined

interface Entry {
  value: DraggableWidgetValue
  group: string
  onPointerDown: (event: PointerEvent) => void
  onNativeDrag: (event: DragEvent) => void
}

const entries = new WeakMap<HTMLElement, Entry>()

/*
 * Makes any element a source you can drag a new widget out of
 * An argument picks the grid group, null or undefined disables it
 */
export const vDraggableWidget: ObjectDirective<HTMLElement, DraggableWidgetValue, string> = {
  mounted(el, binding) {
    const entry: Entry = {
      value: binding.value,
      group: binding.arg || 'default',
      onPointerDown: (event) => {
        const current = entries.get(el)
        if (!current || current.value == null) return
        if (event.pointerType === 'mouse') event.preventDefault()
        beginExternalDrag(event, el, current.group, () => {
          const value = entries.get(el)?.value
          return typeof value === 'function' ? value() : value
        })
      },
      onNativeDrag: (event) => event.preventDefault(),
    }
    entries.set(el, entry)
    el.addEventListener('pointerdown', entry.onPointerDown)
    el.addEventListener('dragstart', entry.onNativeDrag)
    el.classList.add('dg-source')
    el.style.touchAction = 'none'
  },
  updated(el, binding) {
    const entry = entries.get(el)
    if (!entry) return
    entry.value = binding.value
    entry.group = binding.arg || 'default'
  },
  beforeUnmount(el) {
    const entry = entries.get(el)
    if (!entry) return
    el.removeEventListener('pointerdown', entry.onPointerDown)
    el.removeEventListener('dragstart', entry.onNativeDrag)
    entries.delete(el)
  },
}
