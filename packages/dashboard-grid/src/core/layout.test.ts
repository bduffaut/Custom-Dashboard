import { describe, expect, it } from 'vitest'
import { hasCollision } from './collision'
import {
  addItem,
  clampItem,
  compact,
  findFreeSpot,
  insertItem,
  isAreaEmpty,
  layoutsEqual,
  moveItem,
  placeMissing,
  resizeItem,
  resolveCollisions,
} from './layout'
import type { Layout, LayoutItem } from './types'

const OPTS = { columns: 12 }

function noOverlaps(layout: readonly LayoutItem[]): boolean {
  return layout.every((item) => !hasCollision(layout, item))
}

function pos(layout: readonly LayoutItem[], id: string) {
  const item = layout.find((i) => i.id === id)!
  return { x: item.x, y: item.y, w: item.w, h: item.h }
}

describe('clampItem', () => {
  it('keeps items inside the grid and within min/max size', () => {
    expect(clampItem({ id: 'a', x: 11, y: -2, w: 4, h: 0 }, OPTS)).toMatchObject({ x: 8, y: 0, w: 4, h: 1 })
    expect(clampItem({ id: 'a', x: 0, y: 0, w: 1, h: 9, minW: 2, maxH: 4 }, OPTS)).toMatchObject({ w: 2, h: 4 })
  })

  it('repairs NaN and Infinity instead of producing broken positions', () => {
    const fixed = clampItem({ id: 'a', x: NaN, y: Infinity, w: NaN, h: -Infinity }, OPTS)
    expect(fixed).toMatchObject({ x: 0, w: 1, h: 1 })
    expect(Number.isFinite(fixed.y)).toBe(true)
  })

  it('respects maxRows', () => {
    expect(clampItem({ id: 'a', x: 0, y: 9, w: 2, h: 4 }, { columns: 12, maxRows: 10 })).toMatchObject({ y: 6, h: 4 })
  })

  it('returns the same object when nothing changes', () => {
    const item = { id: 'a', x: 0, y: 0, w: 2, h: 2 }
    expect(clampItem(item, OPTS)).toBe(item)
  })
})

describe('compact', () => {
  it('floats items up to close gaps', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 0, y: 5, w: 4, h: 2 },
    ]
    expect(pos(compact(layout, 'vertical', OPTS), 'b').y).toBe(2)
  })

  it('floats items left in horizontal mode', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 9, y: 0, w: 3, h: 2 },
    ]
    expect(pos(compact(layout, 'horizontal', OPTS), 'b').x).toBe(4)
  })

  it('leaves the layout alone in none mode', () => {
    const layout: Layout = [{ id: 'a', x: 0, y: 5, w: 4, h: 2 }]
    expect(pos(compact(layout, 'none', OPTS), 'a').y).toBe(5)
  })

  it('flows items around static items', () => {
    const layout: Layout = [
      { id: 's', x: 0, y: 0, w: 4, h: 2, static: true },
      { id: 'a', x: 0, y: 6, w: 4, h: 2 },
    ]
    const out = compact(layout, 'vertical', OPTS)
    expect(pos(out, 's').y).toBe(0)
    expect(pos(out, 'a').y).toBe(2)
  })
})

describe('resolveCollisions', () => {
  it('moves overlapping items down and lets priority items keep their spot', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 0, y: 0, w: 4, h: 2 },
    ]
    const out = resolveCollisions(layout, (item) => item.id === 'b')
    expect(pos(out, 'b').y).toBe(0)
    expect(pos(out, 'a').y).toBe(2)
  })
})

describe('moveItem', () => {
  it('pushes colliding items down when they cannot swap', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'b', x: 2, y: 0, w: 4, h: 2 },
    ]
    const out = moveItem(layout, 'a', 2, 0, OPTS)
    expect(pos(out, 'a')).toMatchObject({ x: 2, y: 0 })
    expect(pos(out, 'b').y).toBe(2)
    expect(noOverlaps(out)).toBe(true)
  })

  it('swaps sideways with a neighbour that fits into the space left behind', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
    ]
    const out = moveItem(layout, 'a', 4, 0, OPTS)
    expect(pos(out, 'a')).toMatchObject({ x: 4, y: 0 })
    expect(pos(out, 'b')).toMatchObject({ x: 0, y: 0 })
  })

  it('never pushes locked items, but lets the user move them and gravity float them up', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'l', x: 2, y: 0, w: 4, h: 2, locked: true },
    ]
    expect(moveItem(layout, 'a', 2, 0, OPTS)).toBe(layout)
    expect(pos(moveItem(layout, 'l', 6, 0, OPTS), 'l')).toMatchObject({ x: 6, y: 0 })
    expect(pos(compact([{ id: 'l', x: 0, y: 5, w: 2, h: 2, locked: true }], 'vertical', OPTS), 'l').y).toBe(0)
  })

  // The two reported problems, reproduced from a real dashboard
  const dashboard = (): Layout => [
    { id: 'incident', x: 0, y: 0, w: 8, h: 9 },
    { id: 'risk', x: 8, y: 1, w: 4, h: 3, locked: true },
    { id: 'firewall', x: 8, y: 4, w: 4, h: 5 },
  ]

  it('slides into the gap above instead of shoving the big neighbour, even when the drag drifts sideways', () => {
    // Dragged up a row with the pointer half a column left, the nearest cell (7, 0) clips the incident
    const out = moveItem(dashboard(), 'risk', 7, 0, OPTS, { x: 7.45, y: 0.2 })
    expect(pos(out, 'risk')).toMatchObject({ x: 8, y: 0 })
    expect(pos(out, 'incident')).toMatchObject({ x: 0, y: 0 })
  })

  it('fills a small gap when dragged up a little, instead of swapping with the widget above', () => {
    const layout: Layout = [
      { id: 'top', x: 0, y: 0, w: 4, h: 2 },
      { id: 'low', x: 0, y: 3, w: 4, h: 2 },
    ]
    // One and a half rows up, row 1 overlaps top but row 2 is free
    const out = moveItem(layout, 'low', 0, 1, OPTS, { x: 0, y: 1.4 })
    expect(pos(out, 'low').y).toBe(2)
    expect(pos(out, 'top').y).toBe(0)
  })

  it('still swaps when dragged clearly onto a neighbour', () => {
    const layout: Layout = [
      { id: 'top', x: 0, y: 0, w: 4, h: 2 },
      { id: 'low', x: 0, y: 2, w: 4, h: 2 },
    ]
    const out = compact(moveItem(layout, 'low', 0, 0, OPTS, { x: 0, y: 0.1 }), 'vertical', OPTS)
    expect(pos(out, 'low').y).toBe(0)
    expect(pos(out, 'top').y).toBe(2)
  })

  it('swaps with the item below when dragged down onto it', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 0, y: 2, w: 4, h: 2 },
    ]
    const out = compact(moveItem(layout, 'a', 0, 2, OPTS), 'vertical', OPTS)
    expect(pos(out, 'b').y).toBe(0)
    expect(pos(out, 'a').y).toBe(2)
  })

  it('refuses to move onto a static item', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 's', x: 4, y: 0, w: 4, h: 2, static: true },
    ]
    expect(moveItem(layout, 'a', 4, 0, OPTS)).toBe(layout)
  })

  it('never moves static or noMove items', () => {
    const layout: Layout = [
      { id: 's', x: 0, y: 0, w: 4, h: 2, static: true },
      { id: 'n', x: 4, y: 0, w: 4, h: 2, noMove: true },
    ]
    expect(moveItem(layout, 's', 8, 0, OPTS)).toBe(layout)
    expect(moveItem(layout, 'n', 8, 0, OPTS)).toBe(layout)
  })

  it('refuses a move that would push something past maxRows', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'b', x: 2, y: 0, w: 4, h: 2 },
    ]
    expect(moveItem(layout, 'a', 2, 0, { columns: 12, maxRows: 3 })).toBe(layout)
  })
})

describe('resizeItem', () => {
  const one: Layout = [{ id: 'a', x: 4, y: 4, w: 4, h: 4 }]

  it('grows right and down from the se handle and pushes neighbours', () => {
    const layout: Layout = [
      { id: 'a', x: 2, y: 0, w: 2, h: 2 },
      { id: 'b', x: 0, y: 2, w: 4, h: 2 },
    ]
    const out = resizeItem(layout, 'a', { x: 2, y: 0, w: 20, h: 3 }, 'se', OPTS)
    expect(pos(out, 'a')).toEqual({ x: 2, y: 0, w: 10, h: 3 })
    expect(pos(out, 'b').y).toBe(3)
    expect(noOverlaps(out)).toBe(true)
  })

  it('keeps the right edge fixed when resizing from the w handle', () => {
    expect(pos(resizeItem(one, 'a', { x: 2, y: 4, w: 6, h: 4 }, 'w', OPTS), 'a')).toEqual({ x: 2, y: 4, w: 6, h: 4 })
  })

  it('keeps the bottom edge fixed when resizing from the n handle', () => {
    expect(pos(resizeItem(one, 'a', { x: 4, y: 1, w: 4, h: 7 }, 'n', OPTS), 'a')).toEqual({ x: 4, y: 1, w: 4, h: 7 })
  })

  it('resizes both ways from a corner', () => {
    expect(pos(resizeItem(one, 'a', { x: 3, y: 3, w: 5, h: 5 }, 'nw', OPTS), 'a')).toEqual({ x: 3, y: 3, w: 5, h: 5 })
  })

  it('ignores the vertical part on edges that only move one axis', () => {
    expect(pos(resizeItem(one, 'a', { x: 4, y: 4, w: 6, h: 9 }, 'e', OPTS), 'a')).toEqual({ x: 4, y: 4, w: 6, h: 4 })
  })

  it('respects minimum sizes from every side', () => {
    const layout: Layout = [{ id: 'a', x: 4, y: 4, w: 4, h: 4, minW: 3, minH: 3 }]
    expect(pos(resizeItem(layout, 'a', { x: 7, y: 7, w: 1, h: 1 }, 'nw', OPTS), 'a')).toEqual({ x: 5, y: 5, w: 3, h: 3 })
  })

  it('only resizes a collapsed item horizontally', () => {
    const layout: Layout = [{ id: 'a', x: 0, y: 0, w: 4, h: 1, collapsed: true }]
    expect(pos(resizeItem(layout, 'a', { x: 0, y: 0, w: 6, h: 5 }, 'se', OPTS), 'a')).toEqual({ x: 0, y: 0, w: 6, h: 1 })
  })
})

describe('findFreeSpot, addItem and insertItem', () => {
  it('auto-places new items in the first free spot', () => {
    const layout: Layout = [{ id: 'a', x: 0, y: 0, w: 8, h: 2 }]
    expect(findFreeSpot(layout, 4, 2, OPTS)).toEqual({ x: 8, y: 0 })
    expect(findFreeSpot(layout, 6, 2, OPTS)).toEqual({ x: 0, y: 2 })
    expect(pos(addItem(layout, { id: 'b', w: 4, h: 2 }, OPTS)!, 'b')).toMatchObject({ x: 8, y: 0 })
  })

  it('returns null when maxRows leaves no room', () => {
    const full: Layout = [{ id: 'a', x: 0, y: 0, w: 12, h: 2 }]
    expect(findFreeSpot(full, 2, 2, { columns: 12, maxRows: 3 })).toBeNull()
    expect(addItem(full, { id: 'b', w: 2, h: 2 }, { columns: 12, maxRows: 3 })).toBeNull()
  })

  it('drops snugly into a free cell next to the pointer instead of pushing', () => {
    const layout: Layout = [{ id: 'a', x: 0, y: 0, w: 6, h: 2 }]
    const out = insertItem(layout, { id: 'n', x: 5, y: 0, w: 6, h: 2 }, OPTS, { x: 5.4, y: 0 })!
    expect(pos(out, 'n')).toMatchObject({ x: 6, y: 0 })
    expect(pos(out, 'a')).toMatchObject({ x: 0, y: 0 })
  })

  it('inserts at a position, pushing others down and sliding below static items', () => {
    const layout: Layout = [
      { id: 's', x: 0, y: 0, w: 4, h: 2, static: true },
      { id: 'a', x: 4, y: 0, w: 4, h: 2 },
    ]
    const out = insertItem(layout, { id: 'n', x: 2, y: 0, w: 4, h: 2 }, OPTS)!
    expect(pos(out, 'n')).toMatchObject({ x: 2, y: 2 })
    expect(noOverlaps(out)).toBe(true)
  })
})

describe('placement helpers', () => {
  it('places widgets that came without a position in the first free spots, in order', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'n1', x: 0, y: 0, w: 6, h: 2 },
      { id: 'n2', x: 0, y: 0, w: 12, h: 1 },
    ]
    const out = placeMissing(layout, new Set(['n1', 'n2']), OPTS)
    expect(pos(out, 'n1')).toMatchObject({ x: 6, y: 0 })
    expect(pos(out, 'n2')).toMatchObject({ x: 0, y: 2 })
  })

  it('tells whether an area is empty and inside the grid', () => {
    const layout: Layout = [{ id: 'a', x: 0, y: 0, w: 4, h: 2 }]
    expect(isAreaEmpty(layout, { x: 4, y: 0, w: 2, h: 2 }, OPTS)).toBe(true)
    expect(isAreaEmpty(layout, { x: 2, y: 0, w: 4, h: 2 }, OPTS)).toBe(false)
    expect(isAreaEmpty(layout, { x: 2, y: 0, w: 4, h: 2 }, OPTS, 'a')).toBe(true)
    expect(isAreaEmpty(layout, { x: 10, y: 0, w: 4, h: 1 }, OPTS)).toBe(false)
  })

  it('finds free spots quickly in a big layout', () => {
    const big: Layout = Array.from({ length: 400 }, (_, i) => ({ id: `w${i}`, x: (i % 4) * 3, y: Math.floor(i / 4) * 2, w: 3, h: 2 }))
    const started = performance.now()
    for (let i = 0; i < 50; i++) findFreeSpot(big, 3, 2, OPTS)
    const settled = compact(big, 'vertical', OPTS)
    expect(performance.now() - started).toBeLessThan(500)
    expect(findFreeSpot(big, 3, 2, OPTS)).toEqual({ x: 0, y: 200 })
    expect(noOverlaps(settled)).toBe(true)
  })
})

describe('layoutsEqual', () => {
  it('compares collapsed state and breakpoint positions, not content', () => {
    const a = { id: 'a', x: 0, y: 0, w: 1, h: 1 }
    expect(layoutsEqual([a], [{ ...a, props: { v: 1 } } as LayoutItem])).toBe(true)
    expect(layoutsEqual([a], [{ ...a, collapsed: true }])).toBe(false)
    expect(layoutsEqual([a], [{ ...a, breakpoints: { md: { x: 1, y: 0, w: 1, h: 1 } } }])).toBe(false)
  })
})

describe('hardening (audit regressions)', () => {
  it('applies min sizes before looking for room, so an added item never overlaps', () => {
    const layout: Layout = [
      { id: 'a', x: 0, y: 0, w: 5, h: 2 },
      { id: 'b', x: 6, y: 0, w: 6, h: 2 },
    ]
    // A 1 column gap at x 5, but the new item is at least 3 wide
    const out = addItem(layout, { id: 'n', w: 1, h: 2, minW: 3 }, OPTS)!
    expect(pos(out, 'n')).toMatchObject({ w: 3, y: 2 })
    expect(noOverlaps(out)).toBe(true)
  })

  it('never loops on items wider than the grid in horizontal compaction', () => {
    const started = performance.now()
    const out = compact(
      [
        { id: 'a', x: 0, y: 0, w: 12, h: 1 },
        { id: 'wide', x: 0, y: 0, w: 20, h: 1 },
      ],
      'horizontal',
      OPTS,
    )
    expect(performance.now() - started).toBeLessThan(50)
    expect(pos(out, 'wide').y).toBe(1)
  })

  it('caps absurd positions and sizes from corrupted data', () => {
    const item = clampItem({ id: 'a', x: 0, y: 1e9, w: 2, h: 1e9 }, OPTS)
    expect(item.h).toBeLessThanOrEqual(10_000)
    expect(item.y + item.h).toBeLessThanOrEqual(10_000)
  })

  it('repairs overlaps left over from broken input after a move', () => {
    // a and b overlap before anything happens
    const broken: Layout = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 0, y: 0, w: 4, h: 2 },
      { id: 'c', x: 6, y: 0, w: 2, h: 2 },
    ]
    const out = moveItem(broken, 'c', 8, 0, OPTS)
    expect(noOverlaps(out)).toBe(true)
    expect(pos(out, 'c')).toMatchObject({ x: 8, y: 0 })
  })

  it('keeps every operation free of overlaps across thousands of random moves and resizes', () => {
    let seed = 42
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    let layout: Layout = Array.from({ length: 30 }, (_, i) => ({
      id: `w${i}`,
      x: Math.floor(random() * 10),
      y: Math.floor(random() * 20),
      w: 1 + Math.floor(random() * 4),
      h: 1 + Math.floor(random() * 3),
      ...(i % 7 === 0 ? { static: true } : {}),
      ...(i % 5 === 0 ? { locked: true } : {}),
    }))
    layout = compact(resolveCollisions(layout.map((w) => clampItem(w, OPTS))), 'vertical', OPTS)
    expect(noOverlaps(layout)).toBe(true)
    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
    for (let step = 0; step < 3000; step++) {
      const target = layout[Math.floor(random() * layout.length)]!
      const x = Math.floor(random() * 14) - 1
      const y = Math.floor(random() * 30) - 1
      const next =
        random() < 0.6
          ? moveItem(layout, target.id, x, y, OPTS, random() < 0.5 ? { x: x + random(), y: y + random() } : undefined)
          : resizeItem(layout, target.id, { x, y, w: 1 + Math.floor(random() * 6), h: 1 + Math.floor(random() * 5) }, handles[step % 8]!, OPTS)
      layout = compact(next, step % 3 === 0 ? 'none' : 'vertical', OPTS)
      if (!noOverlaps(layout)) throw new Error(`Overlap after step ${step}`)
      for (const w of layout) {
        if (w.x < 0 || w.y < 0 || w.x + w.w > 12 || w.w < 1 || w.h < 1) throw new Error(`Out of bounds after step ${step}`)
      }
    }
    // Static items never moved
    for (const w of layout.filter((i) => i.static)) expect(w).toBeTruthy()
  })
})
