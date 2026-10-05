import type { LayoutItem, Rect } from './types'

type Probe = Rect & { id: string }

function collides(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function hasCollision(layout: readonly LayoutItem[], probe: Probe): boolean {
  return layout.some((other) => other.id !== probe.id && collides(probe, other))
}
