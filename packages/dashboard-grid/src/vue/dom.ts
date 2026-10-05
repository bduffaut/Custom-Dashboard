import { autoScrollVelocity } from '../core'

// DOM helpers for the Vue layer, kept out of core because core never touches the DOM

export type Scroller = HTMLElement | Window

interface Area {
  top: number
  right: number
  bottom: number
  left: number
}

/* Overflow on each axis, reading the shorthand too because jsdom does not expand it */
export function overflowOf(style: CSSStyleDeclaration): { x: string; y: string } {
  const [first = '', second = first] = (style.overflow || '').split(/\s+/)
  const pick = (longhand: string, short: string) => (longhand && longhand !== 'visible' ? longhand : short || longhand || 'visible')
  return { x: pick(style.overflowX, first), y: pick(style.overflowY, second) }
}

function scrolls(node: HTMLElement): boolean {
  const overflow = overflowOf(getComputedStyle(node))
  const y = /auto|scroll|overlay/.test(overflow.y) && node.scrollHeight > node.clientHeight
  const x = /auto|scroll|overlay/.test(overflow.x) && node.scrollWidth > node.clientWidth
  return y || x
}

/* Every scrollable ancestor, nearest first, ending with the window */
function scrollChain(element: Element | null | undefined): Scroller[] {
  const chain: Scroller[] = []
  for (let node = element?.parentElement ?? null; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    if (scrolls(node)) chain.push(node)
  }
  chain.push(window)
  return chain
}

/* Visible part of a scroller in viewport coordinates */
function visibleArea(scroller: Scroller): Area {
  const viewport = { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
  if (scroller === window) return viewport
  const rect = (scroller as HTMLElement).getBoundingClientRect()
  return {
    top: Math.max(rect.top, viewport.top),
    left: Math.max(rect.left, viewport.left),
    right: Math.min(rect.right, viewport.right),
    bottom: Math.min(rect.bottom, viewport.bottom),
  }
}

function canScroll(scroller: Scroller, dx: number, dy: number): boolean {
  if (scroller === window) {
    const doc = document.documentElement
    return (
      (dy > 0 && window.scrollY + window.innerHeight < doc.scrollHeight - 1) ||
      (dy < 0 && window.scrollY > 0) ||
      (dx > 0 && window.scrollX + window.innerWidth < doc.scrollWidth - 1) ||
      (dx < 0 && window.scrollX > 0)
    )
  }
  const el = scroller as HTMLElement
  return (
    (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) ||
    (dy < 0 && el.scrollTop > 0) ||
    (dx > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) ||
    (dx < 0 && el.scrollLeft > 0)
  )
}

const EDGE = 60
const SPEED = 18

/*
 * Auto-scroll while the pointer is near an edge
 * Tries the nearest scrollable box first and moves outward when it cannot scroll further
 * Runs every animation frame until stop
 */
export function startAutoScroll(getPointer: () => { x: number; y: number }, getAnchor: () => Element | null | undefined): () => void {
  let frame = 0
  let stopped = false
  const tick = () => {
    if (stopped) return
    try {
      const pointer = getPointer()
      for (const scroller of scrollChain(getAnchor())) {
        const v = autoScrollVelocity(pointer, visibleArea(scroller), EDGE, SPEED)
        if ((v.x || v.y) && canScroll(scroller, v.x, v.y)) {
          scroller.scrollBy(v.x, v.y)
          break
        }
      }
    } catch {
      // Auto-scroll is a convenience, never let it break a drag
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
  }
}

/* Copy of an element that follows the pointer between grids or in from outside */
export interface Ghost {
  readonly el: HTMLElement
  moveTo(x: number, y: number): void
  destroy(): void
  /* Fade out then remove, used for drops on a trash zone */
  fadeOut(duration: number): void
}

export function createGhost(source: HTMLElement, size?: { w: number; h: number }): Ghost {
  const rect = source.getBoundingClientRect()
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.removeAttribute('id')
  ghost.removeAttribute('data-widget-id')
  ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
  ghost.classList.add('dg-ghost')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${size?.w ?? rect.width}px`,
    height: `${size?.h ?? rect.height}px`,
    margin: '0',
    transform: 'translate(-9999px, -9999px)',
    pointerEvents: 'none',
    zIndex: '2147483000',
    visibility: 'visible',
    transition: 'none',
  })
  document.body.appendChild(ghost)
  return {
    el: ghost,
    moveTo(x, y) {
      ghost.style.transform = `translate(${x}px, ${y}px)`
    },
    destroy() {
      ghost.remove()
    },
    fadeOut(duration) {
      if (duration <= 0 || typeof ghost.animate !== 'function') {
        ghost.remove()
        return
      }
      try {
        const base = ghost.style.transform
        const motion = ghost.animate(
          [
            { opacity: 0.85, transform: `${base} scale(1)` },
            { opacity: 0, transform: `${base} scale(0.85)` },
          ],
          { duration, fill: 'forwards' },
        )
        motion.onfinish = () => ghost.remove()
      } catch {
        ghost.remove()
        return
      }
      // Never leave a ghost behind, even if animation events do not fire
      setTimeout(() => ghost.remove(), duration + 100)
    },
  }
}
