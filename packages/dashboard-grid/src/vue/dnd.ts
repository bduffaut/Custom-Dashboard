import { warn } from '../core'
import { createGhost, overflowOf, startAutoScroll, type Ghost } from './dom'
import { cloneData, createWidgetId } from './id'
import type { DropSource, GridWidget, NewGridWidget } from './types'

// Drag and drop between grids and from outside
// Each grid registers as a drop target, the dragger asks which one is under the pointer,
// asks it to preview, then asks it to accept the drop

export interface Point {
  x: number
  y: number
}

export interface DropTarget {
  element(): HTMLElement | null | undefined
  group(): string
  accepts(widget: GridWidget): boolean
  /* Show where widget would land, pointer in viewport px and grab as the offset inside the widget */
  preview(widget: GridWidget, pointer: Point, grab: Point): void
  /* The pointer left, remove the preview */
  leave(): void
  /* Place the widget at the previewed spot, null if it could not be placed */
  drop(widget: GridWidget, pointer: Point, grab: Point, from: DropSource): GridWidget | null
}

const targets = new Set<DropTarget>()

export function registerDropTarget(target: DropTarget): () => void {
  targets.add(target)
  return () => targets.delete(target)
}

function accepts(target: DropTarget, widget: GridWidget): boolean {
  try {
    return target.accepts(widget)
  } catch (error) {
    warn(`An acceptDrops function threw (${error instanceof Error ? error.message : String(error)}); treating it as false.`)
    return false
  }
}

/*
 * Where each grid and its scrolling or clipping parents were when the drag started
 *
 * Hit testing uses this snapshot instead of the live page, because previews move widgets
 * and a group pushed down by a preview would otherwise slide away from the pointer forever
 *
 * Scrolling really does move grids, so each frame keeps its scroll position and hit testing
 * follows it, including parts of a grid hidden outside a scrolled panel
 */
interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

interface ScrollFrame {
  el: Element
  /* Frame box when recorded, in viewport coordinates */
  box: Box
  scrollLeft: number
  scrollTop: number
}

export interface TargetSnapshot {
  target: DropTarget
  el: Element
  /* Grid box when recorded, in viewport coordinates, before clipping */
  box: Box
  /* Scrolling or clipping ancestors, innermost first */
  frames: ScrollFrame[]
  windowX: number
  windowY: number
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

/* Record every grid in group, skipping grids inside exclude so a group never drops into itself */
export function snapshotDropTargets(group: string, exclude?: Element | null): TargetSnapshot[] {
  const out: TargetSnapshot[] = []
  for (const target of targets) {
    try {
      const el = target.element()
      if (!el || !el.isConnected || target.group() !== group) continue
      if (exclude && exclude !== el && exclude.contains(el)) continue
      const frames: ScrollFrame[] = []
      for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        const overflow = overflowOf(getComputedStyle(node))
        if (overflow.x === 'visible' && overflow.y === 'visible') continue
        frames.push({ el: node, box: boxOf(node), scrollLeft: node.scrollLeft, scrollTop: node.scrollTop })
      }
      out.push({ target, el, box: boxOf(el), frames, windowX: window.scrollX || 0, windowY: window.scrollY || 0 })
    } catch {
      // A grid that cannot be measured is not a target for this drag
    }
  }
  return out
}

/*
 * Where a recorded grid is now and how much of it shows after scrolling
 * A grid moves by the scroll of every frame around it, a frame's clip window only by the frames outside it
 * Null when nothing is visible
 */
function currentBox(snap: TargetSnapshot): Box | null {
  const winDx = (window.scrollX || 0) - snap.windowX
  const winDy = (window.scrollY || 0) - snap.windowY
  const deltas = snap.frames.map((f) => ({ x: f.el.scrollLeft - f.scrollLeft, y: f.el.scrollTop - f.scrollTop }))
  // outside[i] is the total scroll of frames outside frame i, plus the window
  const outside: { x: number; y: number }[] = new Array(snap.frames.length)
  let accX = winDx
  let accY = winDy
  for (let i = snap.frames.length - 1; i >= 0; i--) {
    outside[i] = { x: accX, y: accY }
    accX += deltas[i]!.x
    accY += deltas[i]!.y
  }
  let { left, top, right, bottom } = snap.box
  left -= accX
  right -= accX
  top -= accY
  bottom -= accY
  snap.frames.forEach((frame, i) => {
    const shift = outside[i]!
    left = Math.max(left, frame.box.left - shift.x)
    right = Math.min(right, frame.box.right - shift.x)
    top = Math.max(top, frame.box.top - shift.y)
    bottom = Math.min(bottom, frame.box.bottom - shift.y)
  })
  return right > left && bottom > top ? { left, top, right, bottom } : null
}

/*
 * Innermost accepting grid under the pointer, using the drag start snapshot
 * self, the grid the drag started in, always counts so a widget stays home while over it
 */
export function findDropTarget(pointer: Point, widget: GridWidget, snapshots: readonly TargetSnapshot[], self?: DropTarget): DropTarget | null {
  let best: TargetSnapshot | null = null
  for (const snap of snapshots) {
    if (!snap.el.isConnected) continue
    const box = currentBox(snap)
    if (!box || pointer.x < box.left || pointer.x > box.right || pointer.y < box.top || pointer.y > box.bottom) continue
    if (snap.target !== self && !accepts(snap.target, widget)) continue
    if (!best || best.el.contains(snap.el)) best = snap
  }
  return best?.target ?? null
}

/* Fresh widget from a template with its own data copy and a unique id */
function materializeWidget(template: unknown): GridWidget | null {
  try {
    const raw = typeof template === 'function' ? (template as () => unknown)() : template
    if (!raw || typeof raw !== 'object') return null
    const copy = cloneData(raw) as NewGridWidget
    const size = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.round(v)) : 1)
    const id = typeof copy.id === 'string' && copy.id ? copy.id : createWidgetId(copy.type)
    return { ...copy, id, x: 0, y: 0, w: size(copy.w), h: size(copy.h) } as GridWidget
  } catch (error) {
    warn(`Could not create the dragged widget (${error instanceof Error ? error.message : String(error)}).`)
    return null
  }
}

let cancelActive: (() => void) | null = null

/*
 * Drag a new widget in from outside any grid, like a sidebar palette
 * Starts after the pointer moves a few px so clicks still work
 */
export function beginExternalDrag(event: PointerEvent, source: HTMLElement, group: string, template: () => unknown): void {
  if (event.button !== 0 || cancelActive) return
  const start = { x: event.clientX, y: event.clientY }
  const sourceRect = source.getBoundingClientRect()
  const ghostGrab = { x: start.x - sourceRect.left, y: start.y - sourceRect.top }
  // Grab the widget near its top left corner once it is over a grid
  const grab = { x: 16, y: 16 }
  let pointer = start
  let widget: GridWidget | null = null
  let ghost: Ghost | null = null
  let target: DropTarget | null = null
  let snapshots: TargetSnapshot[] = []
  let stopScroll: (() => void) | null = null

  const retarget = () => {
    if (!widget) return
    const next = findDropTarget(pointer, widget, snapshots)
    if (next !== target) {
      target?.leave()
      target = next
    }
    target?.preview(widget, pointer, grab)
  }

  const onMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY }
    // Released somewhere we never heard about, outside the window
    if (e.pointerType === 'mouse' && e.buttons === 0) return widget ? onUp() : cleanup()
    if (!widget) {
      if (Math.hypot(pointer.x - start.x, pointer.y - start.y) < 4) return
      widget = materializeWidget(template)
      if (!widget) return cleanup()
      snapshots = snapshotDropTargets(group)
      ghost = createGhost(source)
      stopScroll = startAutoScroll(() => pointer, () => target?.element())
      document.documentElement.classList.add('dg-external-dragging', 'dg-dragging')
    }
    ghost?.moveTo(pointer.x - ghostGrab.x, pointer.y - ghostGrab.y)
    retarget()
  }

  const onUp = () => {
    if (widget && target) {
      try {
        target.drop(widget, pointer, grab, 'external')
      } catch (error) {
        warn(`Dropping the widget failed (${error instanceof Error ? error.message : String(error)}).`)
      }
      target = null
    }
    cleanup()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup()
  }

  function cleanup() {
    target?.leave()
    target = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', cleanup)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('blur', cleanup)
    window.removeEventListener('scroll', retarget, true)
    stopScroll?.()
    ghost?.destroy()
    document.documentElement.classList.remove('dg-external-dragging', 'dg-dragging')
    cancelActive = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', cleanup)
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', cleanup)
  window.addEventListener('scroll', retarget, true)
  cancelActive = cleanup
}
