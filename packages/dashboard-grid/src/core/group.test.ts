import { describe, expect, it } from 'vitest'
import { hasCollision } from './collision'
import { alignmentGuides } from './guides'
import { clampItem, compact, compactGroup, moveItem, moveItems, resizeItem } from './layout'
import type { LayoutItem } from './types'

// Moving several widgets at once, and the snap guides drawn while moving

const opts = { columns: 12 }
const noOverlaps = (layout: readonly LayoutItem[]) => layout.every((item) => !hasCollision(layout, item))
const at = (layout: readonly LayoutItem[], id: string) => layout.find((item) => item.id === id)!

describe('moveItems', () => {
  const layout: LayoutItem[] = [
    { id: 'a', x: 0, y: 0, w: 2, h: 2 },
    { id: 'b', x: 2, y: 0, w: 2, h: 2 },
    { id: 'c', x: 6, y: 0, w: 2, h: 2 },
  ]

  it('moves the group together and keeps its formation', () => {
    const next = moveItems(layout, ['a', 'b'], 3, 1, opts)
    expect(at(next, 'a')).toMatchObject({ x: 3, y: 1 })
    expect(at(next, 'b')).toMatchObject({ x: 5, y: 1 })
    expect(noOverlaps(next)).toBe(true)
  })

  it('pushes other widgets down out of the way', () => {
    const next = moveItems(layout, ['a', 'b'], 5, 0, opts)
    expect(at(next, 'b')).toMatchObject({ x: 7, y: 0 })
    expect(at(next, 'c').y).toBe(2)
    expect(noOverlaps(next)).toBe(true)
  })

  it('clamps the shift so the whole group stays inside the grid', () => {
    const next = moveItems(layout, ['a', 'b'], 20, -5, opts)
    expect(at(next, 'a')).toMatchObject({ x: 8, y: 0 })
    expect(at(next, 'b')).toMatchObject({ x: 10, y: 0 })
  })

  it('returns the same layout when nothing can move', () => {
    expect(moveItems(layout, ['a'], -3, 0, opts)).toBe(layout)
    expect(moveItems(layout, ['missing'], 2, 2, opts)).toBe(layout)
  })

  it('refuses to land on a static or locked widget', () => {
    const blocked: LayoutItem[] = [...layout, { id: 's', x: 0, y: 4, w: 4, h: 2, static: true }]
    expect(moveItems(blocked, ['a', 'b'], 0, 4, opts)).toBe(blocked)
  })

  it('leaves static and noMove members behind', () => {
    const mixed: LayoutItem[] = [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'n', x: 2, y: 0, w: 2, h: 2, noMove: true },
    ]
    const next = moveItems(mixed, ['a', 'n'], 0, 3, opts)
    expect(at(next, 'a').y).toBe(3)
    expect(at(next, 'n').y).toBe(0)
  })

  it('respects maxRows', () => {
    expect(moveItems(layout, ['a'], 0, 5, { columns: 12, maxRows: 4 })).toBe(layout)
  })
})

describe('alignmentGuides', () => {
  it('finds matching left edges and spans both boxes', () => {
    const lines = alignmentGuides({ x: 100, y: 0, w: 50, h: 40 }, [{ x: 100, y: 100, w: 80, h: 40 }])
    expect(lines).toContainEqual({ orientation: 'vertical', position: 100, start: 0, end: 140 })
  })

  it('finds matching tops, centers and bottoms', () => {
    const lines = alignmentGuides({ x: 0, y: 20, w: 40, h: 40 }, [{ x: 100, y: 20, w: 40, h: 40 }])
    expect(lines.filter((l) => l.orientation === 'horizontal').map((l) => l.position)).toEqual([20, 40, 60])
  })

  it('draws nothing for boxes that only touch side by side', () => {
    expect(alignmentGuides({ x: 0, y: 0, w: 50, h: 40 }, [{ x: 50, y: 100, w: 50, h: 30 }])).toEqual([])
  })

  it('merges lines at the same spot into one', () => {
    const lines = alignmentGuides({ x: 0, y: 100, w: 50, h: 40 }, [
      { x: 0, y: 0, w: 30, h: 20 },
      { x: 0, y: 300, w: 30, h: 20 },
    ])
    const left = lines.filter((l) => l.orientation === 'vertical' && l.position === 0)
    expect(left).toEqual([{ orientation: 'vertical', position: 0, start: 0, end: 320 }])
  })
})

describe('compactGroup', () => {
  const layout: LayoutItem[] = [
    { id: 'a', x: 0, y: 4, w: 2, h: 2 },
    { id: 'b', x: 2, y: 6, w: 2, h: 2 },
    { id: 'c', x: 6, y: 3, w: 2, h: 2 },
  ]

  it('floats the group as one block so it keeps its shape', () => {
    const next = compactGroup(layout, ['a', 'b'], 'vertical', opts)
    expect(at(next, 'a')).toMatchObject({ x: 0, y: 0 })
    expect(at(next, 'b')).toMatchObject({ x: 2, y: 2 })
    expect(at(next, 'c').y).toBe(0)
  })

  it('differs from plain gravity, which pulls each member up on its own', () => {
    const plain = compact(layout, 'vertical', opts)
    expect(at(plain, 'b').y).toBe(0)
  })

  it('stops the block under an obstacle and floats left in horizontal mode', () => {
    const blocked: LayoutItem[] = [{ id: 'top', x: 0, y: 0, w: 4, h: 1, static: true }, ...layout]
    expect(at(compactGroup(blocked, ['a', 'b'], 'vertical', opts), 'a').y).toBe(1)
    const sideways = compactGroup([{ id: 'a', x: 5, y: 0, w: 2, h: 2 }, { id: 'b', x: 7, y: 2, w: 2, h: 2 }], ['a', 'b'], 'horizontal', opts)
    expect(at(sideways, 'a').x).toBe(0)
    expect(at(sideways, 'b').x).toBe(2)
  })

  it('keeps every member rule and leaves none overlapping', () => {
    const next = compactGroup(layout, ['a', 'b'], 'vertical', opts)
    expect(next.every((item) => !item.static)).toBe(true)
    expect(noOverlaps(next)).toBe(true)
  })
})

describe('size limits from opts', () => {
  const limited = { columns: 12, limits: (item: LayoutItem) => (item.id.startsWith('chart') ? { minW: 4, minH: 3, maxW: 8 } : undefined) }

  it('grows an item to the fallback minimum and caps it at the maximum', () => {
    expect(clampItem({ id: 'chart-1', x: 0, y: 0, w: 1, h: 1 }, limited)).toMatchObject({ w: 4, h: 3 })
    expect(clampItem({ id: 'chart-1', x: 0, y: 0, w: 11, h: 3 }, limited).w).toBe(8)
    expect(clampItem({ id: 'note', x: 0, y: 0, w: 1, h: 1 }, limited)).toMatchObject({ w: 1, h: 1 })
  })

  it('lets the item own limits win over the fallback', () => {
    expect(clampItem({ id: 'chart-1', x: 0, y: 0, w: 1, h: 1, minW: 2 }, limited).w).toBe(2)
  })

  it('stops resizing at the fallback minimum', () => {
    const layout: LayoutItem[] = [{ id: 'chart-1', x: 0, y: 0, w: 5, h: 4 }]
    const next = resizeItem(layout, 'chart-1', { x: 0, y: 0, w: 1, h: 1 }, 'se', limited)
    expect(next[0]).toMatchObject({ w: 4, h: 3 })
  })
})

describe('a big widget moving onto several smaller ones', () => {
  const settle = (layout: readonly LayoutItem[]) => compact(layout, 'vertical', opts)

  it('moves two side by side neighbours into the space it left, in order', () => {
    const layout: LayoutItem[] = [
      { id: 'big', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 2, h: 2 },
      { id: 'c', x: 6, y: 0, w: 2, h: 2 },
    ]
    const next = settle(moveItem(layout, 'big', 4, 0, opts))
    expect(at(next, 'big')).toMatchObject({ x: 4, y: 0 })
    expect(at(next, 'b')).toMatchObject({ x: 0, y: 0 })
    expect(at(next, 'c')).toMatchObject({ x: 2, y: 0 })
    expect(noOverlaps(next)).toBe(true)
  })

  it('moves two stacked neighbours across together', () => {
    const layout: LayoutItem[] = [
      { id: 'big', x: 0, y: 0, w: 4, h: 4 },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
      { id: 'c', x: 4, y: 2, w: 4, h: 2 },
    ]
    const next = settle(moveItem(layout, 'big', 4, 0, opts))
    expect(at(next, 'b')).toMatchObject({ x: 0, y: 0 })
    expect(at(next, 'c')).toMatchObject({ x: 0, y: 2 })
  })

  it('works moving left, packing from the far side', () => {
    const layout: LayoutItem[] = [
      { id: 'b', x: 0, y: 0, w: 2, h: 2 },
      { id: 'c', x: 2, y: 0, w: 2, h: 2 },
      { id: 'big', x: 4, y: 0, w: 4, h: 2 },
    ]
    const next = settle(moveItem(layout, 'big', 0, 0, opts))
    expect(at(next, 'big')).toMatchObject({ x: 0, y: 0 })
    expect(at(next, 'c')).toMatchObject({ x: 6, y: 0 })
    expect(at(next, 'b')).toMatchObject({ x: 4, y: 0 })
  })

  it('moves two stacked neighbours up when it is dragged down past them', () => {
    const layout: LayoutItem[] = [
      { id: 'big', x: 0, y: 0, w: 4, h: 4 },
      { id: 'b', x: 0, y: 4, w: 4, h: 2 },
      { id: 'c', x: 0, y: 6, w: 4, h: 2 },
    ]
    const next = settle(moveItem(layout, 'big', 0, 4, opts))
    expect(at(next, 'big')).toMatchObject({ x: 0, y: 4 })
    expect(at(next, 'b')).toMatchObject({ x: 0, y: 0 })
    expect(at(next, 'c')).toMatchObject({ x: 0, y: 2 })
  })

  it('still swaps when the pointer drifts a row while dragging sideways', () => {
    const layout: LayoutItem[] = [
      { id: 'big', x: 0, y: 0, w: 4, h: 3 },
      { id: 'b', x: 4, y: 0, w: 2, h: 3 },
      { id: 'c', x: 6, y: 0, w: 2, h: 3 },
    ]
    const next = settle(moveItem(layout, 'big', 4, 1, opts))
    expect(at(next, 'b').x).toBe(0)
    expect(at(next, 'c').x).toBe(2)
    expect(noOverlaps(next)).toBe(true)
  })
})
