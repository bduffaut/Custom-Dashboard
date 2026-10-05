import type { ObjectDirective } from 'vue'
import type { Point } from './dnd'
import { setOverTrash } from './dragState'

// Trash zones, dropping a dragged widget on one removes it
// The element gets dg-trash, dg-trash--armed while a widget it could take is dragged,
// and dg-trash--active while that widget is held over it

const zones = new Map<HTMLElement, { group: string }>()
let active: HTMLElement | null = null
let armedGroup: string | null = null

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
  setOverTrash(el !== null)
}

/* Mark every zone of a group as ready while one of its widgets is dragged, null clears them */
export function armTrash(group: string | null): void {
  armedGroup = group
  for (const [el, zone] of zones) el.classList.toggle('dg-trash--armed', zone.group === group)
}

/*
 * Makes an element a trash zone for widgets dragged out of any grid
 * An argument limits it to one grid group, removal is a normal undoable change
 */
export const vWidgetTrash: ObjectDirective<HTMLElement, unknown, string> = {
  mounted(el, binding) {
    const group = binding.arg || 'default'
    zones.set(el, { group })
    el.classList.add('dg-trash')
    el.classList.toggle('dg-trash--armed', group === armedGroup)
  },
  updated(el, binding) {
    const zone = zones.get(el)
    if (!zone) return
    zone.group = binding.arg || 'default'
    el.classList.toggle('dg-trash--armed', zone.group === armedGroup)
  },
  beforeUnmount(el) {
    zones.delete(el)
    if (active === el) setActiveTrash(null)
    el.classList.remove('dg-trash', 'dg-trash--active', 'dg-trash--armed')
  },
}
