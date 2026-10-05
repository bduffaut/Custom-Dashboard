import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives, type VNode } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardGrid, defineWidgets, useWidget, vWidgetTrash, type DashboardGridApi, type GridWidget } from '../index'
import { resolveAnimation } from './animation'

// Features matching or beyond gridstack: trash zones, size to content, locked widgets,
// auto placement, square cells, automatic columns, animation, events and helper methods

let gridWidth = 1200

beforeEach(() => {
  gridWidth = 1200
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: gridWidth } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.className = ''
})

enableAutoUnmount(afterEach)

const frame = () => new Promise((resolve) => setTimeout(resolve, 40))
const pointer = (type: string, x: number, y: number) => new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })

function mountGrid(widgets: GridWidget[], extra: Record<string, unknown> = {}, before?: () => VNode) {
  const model = ref(widgets)
  const grid = ref<DashboardGridApi>()
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h('div', [
          before ? before() : null,
          h(DashboardGrid, {
            ref: grid,
            modelValue: model.value,
            'onUpdate:modelValue': (value: GridWidget[]) => (model.value = value),
            autoScroll: false,
            ...extra,
          }),
        ]),
    }),
    { attachTo: document.body },
  )
  return { wrapper, model, grid, inner: () => wrapper.findComponent(DashboardGrid) }
}

function rectOf(el: Element, left: number, top: number, width: number, height: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect)
}

describe('trash zones and dropping outside', () => {
  it('removes a widget dropped on a trash zone, and the removal is undoable', async () => {
    const { wrapper, model, grid, inner } = mountGrid(
      [
        { id: 'a', x: 0, y: 0, w: 2, h: 2 },
        { id: 'b', x: 2, y: 0, w: 2, h: 2 },
      ],
      {},
      () => withDirectives(h('div', { class: 'bin' }, 'Trash'), [[vWidgetTrash]]),
    )
    await nextTick()
    rectOf(wrapper.find('.dg-grid').element, 0, 0, 1200, 400)
    const bin = wrapper.find('.bin').element
    rectOf(bin, 0, 600, 200, 100)
    expect(bin.classList.contains('dg-trash')).toBe(true)

    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    expect(document.documentElement.classList.contains('dg-dragging')).toBe(true)
    window.dispatchEvent(pointer('pointermove', 50, 650))
    await nextTick()
    expect(bin.classList.contains('dg-trash--active')).toBe(true)
    expect(wrapper.find('[data-widget-id="a"]').classes()).toContain('dg-item--removing')
    window.dispatchEvent(pointer('pointerup', 50, 650))
    await nextTick()

    expect(model.value.map((w) => w.id)).toEqual(['b'])
    expect(inner().emitted('remove')?.[0]?.[0]).toMatchObject({ id: 'a' })
    expect(bin.classList.contains('dg-trash--active')).toBe(false)
    expect(document.documentElement.classList.contains('dg-dragging')).toBe(false)

    grid.value!.undo()
    await nextTick()
    expect(model.value.map((w) => w.id).sort()).toEqual(['a', 'b'])
  })

  it('removes a widget dropped outside every grid when removeOnDropOutside is on', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { removeOnDropOutside: true })
    await nextTick()
    rectOf(wrapper.find('.dg-grid').element, 0, 0, 1200, 400)
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10, 900))
    window.dispatchEvent(pointer('pointerup', 10, 900))
    await nextTick()
    expect(model.value).toHaveLength(0)
  })

  it('keeps the widget when dropped outside by default', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }])
    await nextTick()
    rectOf(wrapper.find('.dg-grid').element, 0, 0, 1200, 400)
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10, 900))
    window.dispatchEvent(pointer('pointerup', 10, 900))
    await nextTick()
    expect(model.value).toHaveLength(1)
  })
})

describe('size to content', () => {
  function contentHeight(px: number) {
    const original = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('dg-content')) return { height: px, width: 100, top: 0, left: 0, right: 100, bottom: px, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
      return original.call(this)
    })
  }

  it('sets a widget height from its content, without an undo step', async () => {
    contentHeight(200)
    const Tall = defineComponent({ setup: () => () => h('div', 'tall content') })
    const { model, grid } = mountGrid([{ id: 'a', type: 't', x: 0, y: 0, w: 2, h: 1, sizeToContent: true }], { components: { t: Tall } })
    await frame()
    // 200px of content at 60px rows with 12px gaps needs 3 rows
    expect(model.value[0]!.h).toBe(3)
    expect(grid.value!.canUndo).toBe(false)
  })

  it('caps the height when sizeToContent is a number, and can be set for the whole grid', async () => {
    contentHeight(1000)
    const Tall = defineComponent({ setup: () => () => h('div', 'very tall') })
    const { model } = mountGrid([{ id: 'a', type: 't', x: 0, y: 0, w: 2, h: 1 }], { components: { t: Tall }, sizeToContent: 4 })
    await frame()
    expect(model.value[0]!.h).toBe(4)
  })

  it('fits any widget on demand with resizeToContent', async () => {
    contentHeight(130)
    const Box = defineComponent({ setup: () => () => h('div', 'box') })
    const { model, grid } = mountGrid([{ id: 'a', type: 'b', x: 0, y: 0, w: 2, h: 5 }], { components: { b: Box } })
    await frame()
    expect(model.value[0]!.h).toBe(5)
    grid.value!.resizeToContent('a')
    await nextTick()
    expect(model.value[0]!.h).toBe(2)
  })
})

describe('placement', () => {
  it('auto-places widgets given without x or y', async () => {
    const { model } = mountGrid(
      defineWidgets([
        { id: 'a', x: 0, y: 0, w: 6, h: 2 },
        { id: 'b', w: 6, h: 2 },
        { id: 'c', w: 12, h: 1 },
      ]),
    )
    await nextTick()
    expect(model.value.find((w) => w.id === 'b')).toMatchObject({ x: 6, y: 0 })
    expect(model.value.find((w) => w.id === 'c')).toMatchObject({ x: 0, y: 2 })
  })

  it('swaps neighbours when dragging sideways', async () => {
    const { wrapper, model } = mountGrid([
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
    ])
    await nextTick()
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 4, 10))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 4, 10))
    await nextTick()
    expect(model.value.find((w) => w.id === 'a')).toMatchObject({ x: 4, y: 0 })
    expect(model.value.find((w) => w.id === 'b')).toMatchObject({ x: 0, y: 0 })
  })

  it('lets a locked widget float up, and a sloppy drag slides into the gap instead of shoving a neighbour', async () => {
    const { wrapper, model } = mountGrid([
      { id: 'incident', x: 0, y: 0, w: 8, h: 9 },
      { id: 'risk', x: 8, y: 1, w: 4, h: 3, locked: true },
      { id: 'firewall', x: 8, y: 4, w: 4, h: 5 },
    ])
    await nextTick()
    // Gravity floats the locked widget into the empty row above it
    expect(model.value.find((w) => w.id === 'risk')).toMatchObject({ x: 8, y: 0 })

    // Drag it down a row and back up with the pointer drifting 60px left, about 0.6 of a column
    const risk = wrapper.find('[data-widget-id="risk"]').element
    risk.dispatchEvent(pointer('pointerdown', 820, 10))
    window.dispatchEvent(pointer('pointermove', 820 - 60, 10 + 72))
    window.dispatchEvent(pointer('pointermove', 820 - 60, 15))
    window.dispatchEvent(pointer('pointerup', 820 - 60, 15))
    await nextTick()
    expect(model.value.find((w) => w.id === 'incident')).toMatchObject({ x: 0, y: 0 })
    expect(model.value.find((w) => w.id === 'risk')).toMatchObject({ x: 8, y: 0 })
  })

  it('never pushes locked widgets', async () => {
    const { wrapper, model } = mountGrid(
      [
        { id: 'a', x: 0, y: 0, w: 2, h: 2 },
        { id: 'l', x: 2, y: 0, w: 4, h: 2, locked: true },
      ],
      { compact: 'none' },
    )
    await nextTick()
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 2, 10))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 2, 10))
    await nextTick()
    expect(model.value.find((w) => w.id === 'l')).toMatchObject({ x: 2, y: 0 })
  })
})

describe('grid sizing options', () => {
  it('makes square cells with rowHeight auto and supports separate gaps', async () => {
    const { wrapper } = mountGrid([{ id: 'a', x: 1, y: 1, w: 1, h: 1 }], { rowHeight: 'auto', gap: [12, 30], compact: 'none' })
    await nextTick()
    // 1200px wide, 12 columns, 12px gap, so columns and rows are 89px
    const style = wrapper.find('.dg-item').attributes('style')
    expect(style).toContain('width: 89px')
    expect(style).toContain('height: 89px')
    expect(style).toContain('translate(101px, 119px)')
  })

  it('picks the number of columns from minColumnWidth', async () => {
    gridWidth = 600
    const { grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 6, h: 1 }], { minColumnWidth: 140 })
    await nextTick()
    expect(grid.value!.columns).toBe(4)
  })

  it('can pick breakpoints by window width', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(500)
    const { grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 6, h: 1 }], {
      breakpoints: { lg: { width: 1000, columns: 12 }, sm: { width: 0, columns: 2 } },
      breakpointsFrom: 'window',
    })
    await nextTick()
    expect(grid.value!.breakpoint).toBe('sm')
  })
})

describe('animation', () => {
  it('resolves presets, custom options and reduced motion', () => {
    expect(resolveAnimation('bouncy', false)).toMatchObject({ duration: 420, enter: true, leave: true })
    expect(resolveAnimation({ duration: 80, easing: 'linear', leave: false }, false)).toEqual({ duration: 80, easing: 'linear', enter: true, leave: false })
    expect(resolveAnimation('smooth', true).duration).toBe(0)
    expect(resolveAnimation({ preset: 'gentle', respectReducedMotion: false }, true).duration).toBe(350)
    expect(resolveAnimation(false, false).duration).toBe(0)
    expect(resolveAnimation('nonsense' as never, false).duration).toBe(200)
  })

  it('sets the animation variables and animates widgets in and out', async () => {
    const { wrapper, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { animation: 'snappy' })
    await nextTick()
    const style = wrapper.find('.dg-grid').attributes('style')
    expect(style).toContain('--dg-duration: 120ms')

    grid.value!.addWidget({ id: 'n', w: 2, h: 2 })
    await nextTick()
    expect(wrapper.find('[data-widget-id="n"]').classes()).toContain('dg-item--entering')

    // jsdom has no Web Animations API, so give the leaving copy something to call
    HTMLElement.prototype.animate = vi.fn(() => ({ onfinish: null, oncancel: null }) as unknown as Animation)
    grid.value!.removeWidget('a')
    await nextTick()
    expect(wrapper.find('.dg-item--leaving').exists()).toBe(true)
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  })
})

describe('pin modes', () => {
  it('switches modes through useWidget, enforces them, and undoes them', async () => {
    const Pins = defineComponent({
      setup() {
        const { pinMode, setPinMode } = useWidget()
        return () => h('div', [h('span', { class: 'mode' }, pinMode.value), h('button', { onClick: () => setPinMode('locked') }, 'lock')])
      },
    })
    const { wrapper, model, grid } = mountGrid([{ id: 'a', type: 'p', x: 0, y: 0, w: 2, h: 2 }], { components: { p: Pins }, compact: 'none' })
    await nextTick()
    expect(wrapper.find('.mode').text()).toBe('free')

    await wrapper.get('button').trigger('click')
    expect(model.value[0]).toMatchObject({ static: true })
    expect(wrapper.find('.mode').text()).toBe('locked')
    expect(wrapper.findAll('.dg-resize-handle')).toHaveLength(0)

    // Locked widgets ignore drags
    wrapper.find('.mode').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 400, 10))
    window.dispatchEvent(pointer('pointerup', 400, 10))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 0 })

    grid.value!.undo()
    await nextTick()
    expect(model.value[0]!.static).toBeUndefined()
    expect(grid.value!.setPinMode('a', 'no-resize')).toBe(true)
    await nextTick()
    expect(model.value[0]).toMatchObject({ noResize: true })
  })
})

describe('events and helpers', () => {
  it('emits change, add, and live drag events', async () => {
    const { wrapper, grid, inner } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { compact: 'none' })
    await nextTick()
    grid.value!.addWidget({ id: 'b', w: 2, h: 2 })
    expect(inner().emitted('add')?.[0]?.[0]).toMatchObject({ id: 'b' })
    expect(inner().emitted('change')?.[0]?.[0]).toEqual([expect.objectContaining({ id: 'b' })])

    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10, 10 + 72 * 3))
    window.dispatchEvent(pointer('pointermove', 12, 10 + 72 * 3))
    window.dispatchEvent(pointer('pointerup', 12, 10 + 72 * 3))
    expect(inner().emitted('drag')).toHaveLength(1)
    expect(inner().emitted('drag')?.[0]?.[1]).toEqual({ x: 0, y: 3 })
  })

  it('answers willItFit, isAreaEmpty, cellFromPoint, columns, rows and removeAll', async () => {
    const { model, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 12, h: 2 }], { maxRows: 3 })
    await nextTick()
    expect(grid.value!.willItFit(12, 1)).toBe(true)
    expect(grid.value!.willItFit(12, 2)).toBe(false)
    expect(grid.value!.isAreaEmpty({ x: 0, y: 2, w: 12, h: 1 })).toBe(true)
    expect(grid.value!.isAreaEmpty({ x: 0, y: 1, w: 1, h: 1 })).toBe(false)
    expect(grid.value!.cellFromPoint(150, 80)).toEqual({ x: 1, y: 1 })
    expect(grid.value!.columns).toBe(12)
    expect(grid.value!.rows).toBe(2)
    expect(grid.value!.removeAll()).toBe(true)
    await nextTick()
    expect(model.value).toHaveLength(0)
  })

  it('never starts a drag from elements matching dragCancel', async () => {
    const Card = defineComponent({ setup: () => () => h('div', [h('span', { class: 'chart' }, 'chart'), h('span', { class: 'title' }, 'title')]) })
    const { wrapper, model } = mountGrid([{ id: 'a', type: 'c', x: 0, y: 0, w: 2, h: 2 }], { components: { c: Card }, dragCancel: '.chart', compact: 'none' })
    await nextTick()
    wrapper.find('.chart').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 400, 10))
    window.dispatchEvent(pointer('pointerup', 400, 10))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 0 })
  })

  it('lets read-only widgets scroll on touch screens', async () => {
    const { wrapper } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { editable: false, showHandles: 'hover' })
    await nextTick()
    expect(wrapper.find('.dg-item').classes()).not.toContain('dg-item--draggable')
    expect(wrapper.find('.dg-grid').classes()).toContain('dg-grid--handles-hover')
  })
})

describe('hardening (audit regressions)', () => {
  const translateX = (el: Element) => Number(/translate\(([-\d.]+)px/.exec((el as HTMLElement).style.transform)?.[1])

  it('keeps a dragged widget inside the grid horizontally, so the page never scrolls sideways', async () => {
    const { wrapper } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { compact: 'none' })
    await nextTick()
    const item = wrapper.find('[data-widget-id="a"]').element
    item.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 5000, 10))
    await nextTick()
    // 1200px grid and a 190px widget, so it stops at 1010px
    expect(translateX(item)).toBe(1010)
    window.dispatchEvent(pointer('pointermove', -5000, 10))
    await nextTick()
    expect(translateX(item)).toBe(0)
    window.dispatchEvent(pointer('pointerup', -5000, 10))
  })

  it('keeps a widget being resized inside the grid', async () => {
    const { wrapper } = mountGrid([{ id: 'a', x: 8, y: 0, w: 2, h: 2 }], { resizeHandles: 'all', compact: 'none' })
    await nextTick()
    const item = wrapper.find('[data-widget-id="a"]').element as HTMLElement
    item.querySelector('.dg-resize-handle--e')!.dispatchEvent(pointer('pointerdown', 1000, 50))
    window.dispatchEvent(pointer('pointermove', 9000, 50))
    await nextTick()
    expect(translateX(item) + parseFloat(item.style.width)).toBeLessThanOrEqual(1200)
    window.dispatchEvent(pointer('pointerup', 9000, 50))
    await nextTick()

    item.querySelector('.dg-resize-handle--w')!.dispatchEvent(pointer('pointerdown', 808, 50))
    window.dispatchEvent(pointer('pointermove', -9000, 50))
    await nextTick()
    expect(translateX(item)).toBe(0)
    window.dispatchEvent(pointer('pointerup', -9000, 50))
  })

  it('shows a floating copy over the trash instead of moving the real widget outside the grid', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], {}, () => withDirectives(h('div', { class: 'bin' }), [[vWidgetTrash]]))
    await nextTick()
    rectOf(wrapper.find('.dg-grid').element, 0, 0, 1200, 400)
    rectOf(wrapper.find('.bin').element, 0, 600, 200, 100)
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 50, 650))
    await nextTick()
    expect(document.querySelector('.dg-ghost.dg-ghost--removing')).not.toBeNull()
    expect(wrapper.find('[data-widget-id="a"]').classes()).toContain('dg-item--transferring')
    window.dispatchEvent(pointer('pointerup', 50, 650))
    await nextTick()
    expect(model.value).toHaveLength(0)
    expect(document.querySelector('.dg-ghost')).toBeNull()
  })

  it('ignores built-in object properties as widget types', async () => {
    const Real = defineComponent({ setup: () => () => h('p', 'real') })
    const { wrapper } = mountGrid(
      [
        { id: 'a', type: 'toString', x: 0, y: 0, w: 2, h: 2 },
        { id: 'b', type: '__proto__', x: 2, y: 0, w: 2, h: 2 },
        { id: 'c', type: 'real', x: 4, y: 0, w: 2, h: 2 },
      ],
      { components: { real: Real } },
    )
    await nextTick()
    expect(wrapper.findAll('.dg-missing')).toHaveLength(2)
    expect(wrapper.text()).toContain('real')
  })

  it('ends a drag when the widget is collapsed or re-pinned mid-drag, so the drop cannot undo it', async () => {
    const { wrapper, model, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 3 }], { compact: 'none' })
    await nextTick()
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 400, 10))
    grid.value!.collapseWidget('a', true)
    window.dispatchEvent(pointer('pointerup', 400, 10))
    await nextTick()
    expect(model.value[0]).toMatchObject({ collapsed: true, x: 0 })
  })

  it('adds a widget with a minimum width only where it really fits', async () => {
    const { model, grid } = mountGrid([
      { id: 'a', x: 0, y: 0, w: 5, h: 2 },
      { id: 'b', x: 6, y: 0, w: 6, h: 2 },
    ], { compact: 'none' })
    await nextTick()
    const added = grid.value!.addWidget({ id: 'n', w: 1, h: 2, minW: 3 })
    expect(added).toMatchObject({ w: 3, y: 2 })
    expect(model.value).toHaveLength(3)
  })
})

