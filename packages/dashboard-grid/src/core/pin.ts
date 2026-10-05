import type { LayoutItem } from './types'

// Pin modes, one setting mapped onto the engine's movement fields
//
//   free        no restrictions
//   pinned      others cannot push it, can still be dragged and resized   (locked)
//   locked      never moves or resizes                                  (static)
//   no-resize   can be moved, not resized                               (noResize)

export type PinMode = 'free' | 'pinned' | 'locked' | 'no-resize'

export const PIN_MODES: readonly PinMode[] = ['free', 'pinned', 'locked', 'no-resize']

/* Pin mode read from static, locked and noResize */
export function pinModeOf(item: LayoutItem): PinMode {
  if (item.static) return 'locked'
  if (item.locked) return 'pinned'
  if (item.noResize) return 'no-resize'
  return 'free'
}

/* Copy of item with movement fields set for a pin mode */
export function withPinMode<T extends LayoutItem>(item: T, mode: PinMode): T {
  const next = { ...item }
  delete next.static
  delete next.locked
  delete next.noMove
  delete next.noResize
  if (mode === 'locked') next.static = true
  else if (mode === 'pinned') next.locked = true
  else if (mode === 'no-resize') next.noResize = true
  return next
}
