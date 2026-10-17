import { describe, expect, it, vi } from 'vitest'
import { autoArrange } from './arrange'
import { hasCollision } from './collision'
import { columnsForWidth, gridHeight, resizeBox, resolveHandles, rowsForHeight, toGridRect, toPixels } from './geometry'
import { restoreLayout } from './history'
import { bottom } from './layout'
import { parseLayout, reconcileLayout, serializeLayout } from './persistence'
import { pinModeOf, withPinMode } from './pin'
import { clearBreakpoint, deriveLayout, normalizeBreakpoints, pickBreakpoint, writeLayout } from './responsive'
import { sanitizeLayout } from './sanitize'
import type { LayoutItem } from './types'

const noOverlaps = (layout: readonly LayoutItem[]) => layout.every((item) => !hasCollision(layout, item))

describe('resize geometry', () => {
  it('moves the left edge for w handles and keeps the right edge', () => {
    expect(resizeBox({ x: 100, y: 0, w: 200, h: 100 }, 'w', -50, 0)).toEqual({ x: 50, y: 0, w: 250, h: 100 })
  })

  it('never shrinks below the minimum', () => {
    expect(resizeBox({ x: 0, y: 0, w: 100, h: 100 }, 'se', -500, -500, 10)).toMatchObject({ w: 10, h: 10 })
  })

  it('rounds each edge to the grid separately', () => {
    // 1200px wide, 12 columns, gap 12, so one column step is 101px
    const m = { columns: 12, width: 1200, rowHeight: 60, gap: 12 }
    expect(toGridRect({ x: 101, y: 0, w: 190, h: 60 }, m)).toEqual({ x: 1, y: 0, w: 2, h: 1 })
  })

  it('understands presets, single handles and lists, and ignores junk', () => {
    expect(resolveHandles('corners')).toEqual(['ne', 'nw', 'se', 'sw'])
    expect(resolveHandles('e')).toEqual(['e'])
    expect(resolveHandles(['s', 'bogus' as never, 's'])).toEqual(['s'])
    expect(resolveHandles(undefined)).toEqual(['se'])
    expect(resolveHandles('none')).toEqual([])
  })
})

describe('size helpers', () => {
  const m = { columns: 12, width: 1200, rowHeight: 60, gap: 12, rowGap: 20 }

  it('uses separate row and column gaps', () => {
    expect(toPixels({ x: 1, y: 1, w: 2, h: 2 }, m)).toMatchObject({ y: 80, h: 140 })
    expect(gridHeight(3, m)).toBe(220)
  })

  it('works out rows needed for content and columns that fit a width', () => {
    expect(rowsForHeight(60, m)).toBe(1)
    expect(rowsForHeight(61, m)).toBe(2)
    expect(rowsForHeight(0, m)).toBe(1)
    expect(columnsForWidth(1000, 200, 10, 12)).toBe(4)
    expect(columnsForWidth(5000, 200, 10, 12)).toBe(12)
    expect(columnsForWidth(100, 200, 10, 12)).toBe(1)
  })
})

describe('restoreLayout', () => {
  it('restores collapsed state and breakpoint positions, but keeps current content', () => {
    const past = [{ id: 'a', x: 0, y: 0, w: 2, h: 2, collapsed: true, props: { v: 1 } }]
    const now = [{ id: 'a', x: 5, y: 5, w: 2, h: 2, props: { v: 2 } }]
    expect(restoreLayout(past, now)).toEqual([{ id: 'a', x: 0, y: 0, w: 2, h: 2, collapsed: true, props: { v: 2 } }])
  })
})

describe('responsive layouts', () => {
  const bps = normalizeBreakpoints({ sm: { width: 0, columns: 1 }, lg: { width: 1000, columns: 12 }, md: { width: 600, columns: 6 } })!
  const [lg, md, sm] = bps as [(typeof bps)[0], (typeof bps)[0], (typeof bps)[0]]
  const base: LayoutItem[] = [
    { id: 'a', x: 0, y: 0, w: 6, h: 2 },
    { id: 'b', x: 6, y: 0, w: 6, h: 2 },
  ]

  it('sorts breakpoints widest first and picks by width', () => {
    expect(bps.map((b) => b.name)).toEqual(['lg', 'md', 'sm'])
    expect(pickBreakpoint(bps, 1400).name).toBe('lg')
    expect(pickBreakpoint(bps, 700).name).toBe('md')
    expect(pickBreakpoint(bps, 10).name).toBe('sm')
  })

  it('ignores invalid breakpoint entries', () => {
    expect(normalizeBreakpoints({ bad: { width: NaN, columns: 4 } } as never)).toBeNull()
  })

  it('scales the base layout to fewer columns', () => {
    const out = deriveLayout(base, md, lg)
    expect(out.map((i) => [i.x, i.w])).toEqual([
      [0, 3],
      [3, 3],
    ])
  })

  it('stacks everything in a single column', () => {
    const out = deriveLayout(base, sm, lg)
    expect(out.map((i) => [i.x, i.y, i.w])).toEqual([
      [0, 0, 1],
      [0, 2, 1],
    ])
  })

  it('can lay narrower breakpoints out in reading order instead of scaling', () => {
    const wide: LayoutItem[] = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
      { id: 'c', x: 8, y: 0, w: 4, h: 2 },
    ]
    const out = deriveLayout(wide, md, lg, undefined, 'list')
    expect(out.map((i) => [i.x, i.y, i.w])).toEqual([
      [0, 0, 2],
      [2, 0, 2],
      [4, 0, 2],
    ])
  })

  it('uses positions saved for a breakpoint and writes new ones back there', () => {
    const view = deriveLayout(base, md, lg)
    const moved = view.map((i) => (i.id === 'b' ? { ...i, x: 0, y: 0 } : { ...i, y: 2 }))
    const written = writeLayout(base, moved, md, lg)
    expect(written[0]!.x).toBe(0)
    expect(written[1]!.breakpoints?.md).toEqual({ x: 0, y: 0, w: 3, h: 2 })
    expect(deriveLayout(written, md, lg).find((i) => i.id === 'b')).toMatchObject({ x: 0, y: 0 })
    expect(clearBreakpoint(written, 'md').every((i) => !i.breakpoints)).toBe(true)
  })
})

describe('autoArrange', () => {
  it('packs widgets into the shortest layout without overlaps', () => {
    const messy: LayoutItem[] = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 0, y: 4, w: 6, h: 2 },
      { id: 'c', x: 6, y: 9, w: 6, h: 2 },
      { id: 'd', x: 3, y: 12, w: 6, h: 2 },
    ]
    const out = autoArrange(messy, { columns: 12 })!
    expect(bottom(out)).toBe(4)
    expect(noOverlaps(out)).toBe(true)
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('can keep the current reading order', () => {
    const out = autoArrange(
      [
        { id: 'small', x: 0, y: 0, w: 2, h: 1 },
        { id: 'big', x: 0, y: 5, w: 12, h: 4 },
      ],
      { columns: 12 },
      { keepOrder: true },
    )!
    expect(out[0]).toMatchObject({ x: 0, y: 0 })
    expect(out[1]).toMatchObject({ x: 0, y: 1 })
  })

  it('moves locked widgets into free space (locked only stops others pushing them)', () => {
    const out = autoArrange(
      [
        { id: 'big', x: 0, y: 0, w: 8, h: 9 },
        { id: 'risk', x: 8, y: 1, w: 4, h: 3, locked: true },
      ],
      { columns: 12 },
    )!
    expect(out[1]).toMatchObject({ x: 8, y: 0 })
  })

  it('never moves static widgets', () => {
    const out = autoArrange(
      [
        { id: 's', x: 6, y: 0, w: 6, h: 2, static: true },
        { id: 'a', x: 0, y: 8, w: 6, h: 2 },
      ],
      { columns: 12 },
    )!
    expect(out[0]).toMatchObject({ x: 6, y: 0 })
    expect(out[1]).toMatchObject({ x: 0, y: 0 })
  })

  it('returns null when the widgets cannot fit within maxRows', () => {
    const two = [
      { id: 'a', x: 0, y: 0, w: 12, h: 3 },
      { id: 'b', x: 0, y: 3, w: 12, h: 3 },
    ]
    expect(autoArrange(two, { columns: 12, maxRows: 3 })).toBeNull()
  })
})

describe('sanitizeLayout', () => {
  it('drops junk, fixes bad numbers and removes duplicate ids', () => {
    const report = vi.fn()
    const out = sanitizeLayout(
      [null, 'nope', { x: 1 }, { id: 7, x: -3, y: 1.6, w: NaN, h: 2 }, { id: 'a', x: 0, y: 0, w: 1, h: 1 }, { id: 'a', x: 5, y: 5, w: 1, h: 1 }],
      report,
    )
    expect(out).toEqual([
      { id: '7', x: 0, y: 2, w: 1, h: 2 },
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
    ])
    expect(report).toHaveBeenCalled()
  })

  it('returns the same array when nothing is wrong', () => {
    const fine = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }]
    expect(sanitizeLayout(fine)).toBe(fine)
  })

  it('treats a non-array as empty', () => {
    expect(sanitizeLayout({ not: 'an array' }, () => {})).toEqual([])
  })
})

describe('saving and loading', () => {
  const widgets = [{ id: 'a', x: 0, y: 0, w: 2, h: 2, props: { label: 'Hi' } }]

  it('round-trips through JSON', () => {
    expect(parseLayout(serializeLayout(widgets, 3), { version: 3 })).toEqual(widgets)
  })

  it('migrates older versions, including bare arrays', () => {
    const migrate = vi.fn((list: unknown[]) => list.map((w) => ({ ...(w as object), migrated: true })))
    const out = parseLayout(JSON.stringify(widgets), { version: 2, migrate })
    expect(migrate).toHaveBeenCalledWith(widgets, 0)
    expect(out[0]).toMatchObject({ migrated: true })
  })

  it('reads a layout that was JSON encoded twice', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseLayout(JSON.stringify(serializeLayout(widgets)))).toEqual(widgets)
  })

  it('reconciles a saved layout with the widgets that exist now', () => {
    type Widget = LayoutItem & { props?: { title: string } }
    const saved: Widget[] = [
      { id: 'keep', x: 6, y: 2, w: 3, h: 4, locked: true, props: { title: 'old' } },
      { id: 'gone', x: 0, y: 0, w: 2, h: 2 },
    ]
    const current: Widget[] = [
      { id: 'new', x: 0, y: 0, w: 2, h: 2, props: { title: 'added' } },
      { id: 'keep', x: 0, y: 0, w: 1, h: 1, props: { title: 'fresh' } },
    ]
    expect(reconcileLayout(saved, current)).toEqual([
      { id: 'keep', x: 6, y: 2, w: 3, h: 4, locked: true, props: { title: 'fresh' } },
      { id: 'new', w: 2, h: 2, props: { title: 'added' } },
    ])
  })

  it('falls back on garbage instead of throwing', () => {
    const fallback = [{ id: 'f', x: 0, y: 0, w: 1, h: 1 }]
    expect(parseLayout('{not json', { fallback })).toEqual(fallback)
    expect(parseLayout({ nope: true }, { fallback: () => fallback })).toEqual(fallback)
    expect(parseLayout('', { fallback })).toEqual(fallback)
    expect(parseLayout(serializeLayout(widgets), { migrate: () => { throw new Error('boom') }, version: 5, fallback })).toEqual(fallback)
  })
})

describe('pin modes', () => {
  const item = { id: 'a', x: 0, y: 0, w: 2, h: 2 }

  it('maps each mode onto the movement fields and back', () => {
    expect(withPinMode(item, 'locked')).toEqual({ ...item, static: true })
    expect(withPinMode(item, 'pinned')).toEqual({ ...item, locked: true })
    expect(withPinMode(item, 'no-resize')).toEqual({ ...item, noResize: true })
    expect(withPinMode({ ...item, static: true, noMove: true }, 'free')).toEqual(item)
    for (const mode of ['free', 'pinned', 'locked', 'no-resize'] as const) expect(pinModeOf(withPinMode(item, mode))).toBe(mode)
  })

  it('counts pin changes as layout changes, so undo restores them', () => {
    const past = [{ ...item, static: true }]
    expect(restoreLayout(past, [item])).toEqual(past)
    expect(restoreLayout([item], past)).toEqual([item])
  })
})

describe('persistence hardening', () => {
  it('falls back when migrate returns something that is not an array', () => {
    const fallback = [{ id: 'f', x: 0, y: 0, w: 1, h: 1 }]
    const out = parseLayout(serializeLayout([{ id: 'a', x: 0, y: 0, w: 1, h: 1 }], 1), {
      version: 2,
      migrate: () => 'oops' as unknown as unknown[],
      fallback,
    })
    expect(out).toEqual(fallback)
  })
})
