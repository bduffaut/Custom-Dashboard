import type { ObjectDirective } from 'vue'
import type { Point } from './dnd'

// Trash zones, dropping a dragged widget on one removes it
// The element gets dg-trash, plus dg-trash--active while a widget is over it

const zones = new Map<HTMLElement, { group: string }>()
let active: HTMLElement | null = null

/* Trash zone under the pointer for a grid group, if any */
export function trashAt(pointer: Point, group: string): HTMLElement | null {
  for (const [el, zone] of zones) {
    if (zone.group !== group || !el.isConnected) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom) return el
  }
  return null
}

/* Highlight the trash zone under a dragged widget, or none */
export function setActiveTrash(el: HTMLElement | null): void {
  if (active === el) return
  active?.classList.remove('dg-trash--active')
  active = el
  active?.classList.add('dg-trash--active')
}

/*
 * Makes an element a trash zone for widgets dragged out of any grid
 * An argument limits it to one grid group, removal is a normal undoable change
 */
export const vWidgetTrash: ObjectDirective<HTMLElement, unknown, string> = {
  mounted(el, binding) {
    zones.set(el, { group: binding.arg || 'default' })
    el.classList.add('dg-trash')
  },
  updated(el, binding) {
    const zone = zones.get(el)
    if (zone) zone.group = binding.arg || 'default'
  },
  beforeUnmount(el) {
    zones.delete(el)
    if (active === el) setActiveTrash(null)
    el.classList.remove('dg-trash', 'dg-trash--active')
  },
}
