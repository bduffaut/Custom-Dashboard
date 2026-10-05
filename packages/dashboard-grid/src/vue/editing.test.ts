import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardGrid, useDragState, useWidget, type DashboardGridApi, type GridWidget } from '../index'

// Arrival animations, keyboard editing, multi select and snap guides
// jsdom has no layout, so every grid is 1200px wide: one column step is 101px and one row step is 72px

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width: 1200 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

enableAutoUnmount(afterEach)

const STEP = 101
const pointer = (type: string, x: number, y: number, init: MouseEventInit = {}) =>
  new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true, ...init })
const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })

function mountGrid(widgets: GridWidget[], extra: Record<string, unknown> = {}) {
  const model = ref(widgets)
  const grid = ref<DashboardGridApi>()
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(DashboardGrid, {
          ref: grid,
          modelValue: model.value,
          'onUpdate:modelValue': (value: GridWidget[]) => (model.value = value),
          autoScroll: false,
          ...extra,
        }),
    }),
    { attachTo: document.body },
  )
  const item = (id: string) => wrapper.find(`[data-widget-id="${id}"]`).element as HTMLElement
  const at = (id: string) => model.value.find((w) => w.id === id)!
  const live = () => wrapper.find('.dg-live').text()
  return { wrapper, model, grid, item, at, live, inner: () => wrapper.findComponent(DashboardGrid) }
}

function click(el: Element, x = 10, y = 10, init: MouseEventInit = {}) {
  el.dispatchEvent(pointer('pointerdown', x, y, init))
  window.dispatchEvent(pointer('pointerup', x, y))
}

function drag(el: Element, from: [number, number], to: [number, number]) {
  el.dispatchEvent(pointer('pointerdown', ...from))
  window.dispatchEvent(pointer('pointermove', ...to))
  window.dispatchEvent(pointer('pointerup', ...to))
}

describe('arrival animations', () => {
  it('plays the chosen effect on first load, cascading in reading order', async () => {
    const { wrapper, item } = mountGrid(
      [
        { id: 'late', x: 0, y: 2, w: 2, h: 2 },
        { id: 'first', x: 0, y: 0, w: 2, h: 2 },
        { id: 'second', x: 2, y: 0, w: 2, h: 2 },
      ],
      { animation: { enter: 'rise', appear: true, stagger: 50 } },
    )
    await nextTick()
    expect(wrapper.find('.dg-grid').classes()).toContain('dg-grid--enter-rise')
    expect(item('first').classList.contains('dg-item--entering')).toBe(true)
    expect(item('first').style.getPropertyValue('--dg-enter-delay')).toBe('')
    expect(item('second').style.getPropertyValue('--dg-enter-delay')).toBe('50ms')
    expect(item('late').style.getPropertyValue('--dg-enter-delay')).toBe('100ms')
  })

  it('animates only added widgets when appear is off', async () => {
    const { item, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { animation: { enter: 'drop' } })
    await nextTick()
    expect(item('a').classList.contains('dg-item--entering')).toBe(false)
    const added = grid.value!.addWidget({ id: 'b', w: 2, h: 2 })
    await nextTick()
    expect(item(added!.id).classList.contains('dg-item--entering')).toBe(true)
  })
})

describe('keyboard editing', () => {
  const two = (): GridWidget[] => [
    { id: 'a', x: 0, y: 0, w: 2, h: 2, props: { title: 'Alpha' } },
    { id: 'b', x: 4, y: 0, w: 2, h: 2 },
  ]

  it('makes widgets focusable only in edit mode', async () => {
    const editing = mountGrid(two())
    const viewing = mountGrid(two(), { editable: false })
    await nextTick()
    expect(editing.item('a').getAttribute('tabindex')).toBe('0')
    expect(editing.item('a').getAttribute('aria-label')).toBe('Alpha')
    expect(viewing.item('a').hasAttribute('tabindex')).toBe(false)
  })

  it('moves with arrows, resizes with Shift and announces each change', async () => {
    const { item, at, live, grid } = mountGrid(two(), { compact: 'none' })
    await nextTick()
    item('a').dispatchEvent(key('ArrowRight'))
    await nextTick()
    expect(at('a')).toMatchObject({ x: 1, y: 0 })
    expect(live()).toBe('Alpha moved to column 2, row 1')

    item('a').dispatchEvent(key('ArrowDown', { shiftKey: true }))
    await nextTick()
    expect(at('a')).toMatchObject({ w: 2, h: 3 })
    expect(live()).toContain('Alpha resized to 2 by 3')

    grid.value!.undo()
    await nextTick()
    expect(at('a').h).toBe(2)
  })

  it('jumps past a neighbour instead of snapping back under gravity', async () => {
    const { item, at } = mountGrid([
      { id: 'top', x: 0, y: 0, w: 2, h: 2 },
      { id: 'below', x: 0, y: 2, w: 2, h: 2 },
    ])
    await nextTick()
    item('top').dispatchEvent(key('ArrowDown'))
    await nextTick()
    expect(at('top').y).toBeGreaterThan(at('below').y)
  })

  it('says when a widget cannot move', async () => {
    const { item, at, live } = mountGrid(two())
    await nextTick()
    item('a').dispatchEvent(key('ArrowLeft'))
    await nextTick()
    expect(at('a').x).toBe(0)
    expect(live()).toBe('Alpha cannot move left')
  })

  it('removes with Delete and ignores keys typed inside the content', async () => {
    const Input = defineComponent({ setup: () => () => h('input', { class: 'field' }) })
    const { wrapper, model, item } = mountGrid([{ id: 'a', type: 'input', x: 0, y: 0, w: 2, h: 2 }, two()[1]!], {
      components: { input: Input },
    })
    await nextTick()
    wrapper.find('.field').element.dispatchEvent(key('Delete'))
    await nextTick()
    expect(model.value).toHaveLength(2)
    item('a').dispatchEvent(key('Delete'))
    await nextTick()
    expect(model.value.map((w) => w.id)).toEqual(['b'])
  })
})

describe('multi select', () => {
  const three = (): GridWidget[] => [
    { id: 'a', x: 0, y: 0, w: 2, h: 2 },
    { id: 'b', x: 2, y: 0, w: 2, h: 2 },
    { id: 'c', x: 8, y: 0, w: 2, h: 2 },
  ]

  it('selects on click, toggles with a modifier and reports changes', async () => {
    const { item, grid, inner } = mountGrid(three(), { selectable: true })
    await nextTick()
    click(item('a'))
    click(item('b'), 210, 10, { ctrlKey: true })
    await nextTick()
    expect(grid.value!.selection).toEqual(['a', 'b'])
    expect(item('a').classList.contains('dg-item--selected')).toBe(true)
    click(item('a'), 10, 10, { shiftKey: true })
    expect(grid.value!.selection).toEqual(['b'])
    expect(inner().emitted('selectionChange')!.at(-1)).toEqual([['b']])
  })

  it('does nothing when selectable is off', async () => {
    const { item, grid } = mountGrid(three())
    await nextTick()
    click(item('a'))
    expect(grid.value!.selection).toEqual([])
  })

  it('drags the whole selection together', async () => {
    const { item, at, grid } = mountGrid(three(), { selectable: true, compact: 'none' })
    await nextTick()
    grid.value!.select(['a', 'b'])
    await nextTick()
    const drag = useDragState()
    item('a').dispatchEvent(pointer('pointerdown', 10, 10))
    expect(drag.count).toBe(2)
    window.dispatchEvent(pointer('pointermove', 10 + STEP * 3, 10 + 72))
    await nextTick()
    expect(item('b').classList.contains('dg-item--dragging')).toBe(true)
    window.dispatchEvent(pointer('pointerup', 10 + STEP * 3, 10 + 72))
    await nextTick()
    expect(at('a')).toMatchObject({ x: 3, y: 1 })
    expect(at('b')).toMatchObject({ x: 5, y: 1 })
    expect(at('c')).toMatchObject({ x: 8, y: 0 })
  })

  it('narrows to one widget when a selected widget is clicked without dragging', async () => {
    const { item, grid } = mountGrid(three(), { selectable: true })
    await nextTick()
    grid.value!.select(['a', 'b'])
    click(item('b'), 210, 10)
    expect(grid.value!.selection).toEqual(['b'])
  })

  it('selects with a box on empty space and clears with a click there', async () => {
    const { wrapper, grid } = mountGrid(three(), { selectable: true })
    await nextTick()
    const surface = wrapper.find('.dg-grid').element
    surface.dispatchEvent(pointer('pointerdown', 150, 200))
    window.dispatchEvent(pointer('pointermove', 300, 20))
    await nextTick()
    expect(wrapper.find('.dg-marquee').exists()).toBe(true)
    window.dispatchEvent(pointer('pointerup', 300, 20))
    await nextTick()
    expect(grid.value!.selection.sort()).toEqual(['a', 'b'])
    expect(wrapper.find('.dg-marquee').exists()).toBe(false)

    click(surface, 600, 300)
    expect(grid.value!.selection).toEqual([])
  })

  it('selects everything with Ctrl+A, moves the selection with arrows and deletes it', async () => {
    const { item, model, grid } = mountGrid(three(), { selectable: true, compact: 'none' })
    await nextTick()
    item('a').dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointerup', 10, 10))
    window.dispatchEvent(key('a', { ctrlKey: true }))
    expect(grid.value!.selection).toHaveLength(3)

    grid.value!.select(['a', 'b'])
    item('a').dispatchEvent(key('ArrowDown'))
    await nextTick()
    expect(model.value.find((w) => w.id === 'a')!.y).toBe(1)
    expect(model.value.find((w) => w.id === 'b')!.y).toBe(1)

    item('a').dispatchEvent(key('Delete'))
    await nextTick()
    expect(model.value.map((w) => w.id)).toEqual(['c'])
    expect(grid.value!.selection).toEqual([])
    grid.value!.undo()
    await nextTick()
    expect(model.value).toHaveLength(3)
  })

  it('tells widgets whether they are selected', async () => {
    let selected: ReturnType<typeof useWidget>['selected'] | undefined
    const Probe = defineComponent({
      setup() {
        selected = useWidget().selected
        return () => h('div')
      },
    })
    const { grid } = mountGrid([{ id: 'a', type: 'probe', x: 0, y: 0, w: 2, h: 2 }], { selectable: true, components: { probe: Probe } })
    await nextTick()
    expect(selected!.value).toBe(false)
    grid.value!.select('a')
    await nextTick()
    expect(selected!.value).toBe(true)
  })

  it('clears the selection when edit mode turns off', async () => {
    const editing = ref(true)
    const model = ref<GridWidget[]>(three())
    const grid = ref<DashboardGridApi>()
    mount(
      defineComponent({
        setup: () => () =>
          h(DashboardGrid, {
            ref: grid,
            modelValue: model.value,
            selectable: true,
            editable: editing.value,
          }),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    grid.value!.select(['a', 'b'])
    editing.value = false
    await nextTick()
    expect(grid.value!.selection).toEqual([])
  })
})

describe('snap guides', () => {
  it('draws a line where the dragged widget lines up with another', async () => {
    const { wrapper, item } = mountGrid(
      [
        { id: 'a', x: 0, y: 0, w: 2, h: 2 },
        { id: 'b', x: 4, y: 3, w: 2, h: 2 },
      ],
      { snapGuides: true, compact: 'none' },
    )
    await nextTick()
    item('a').dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + STEP * 4, 10))
    await nextTick()
    const lines = wrapper.findAll('.dg-snap-guide--vertical')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]!.attributes('style')).toContain(`translate(${STEP * 4}px`)
    window.dispatchEvent(pointer('pointerup', 10 + STEP * 4, 10))
    await nextTick()
    expect(wrapper.findAll('.dg-snap-guide')).toHaveLength(0)
  })

  it('stays off unless enabled', async () => {
    const { wrapper, item } = mountGrid(
      [
        { id: 'a', x: 0, y: 0, w: 2, h: 2 },
        { id: 'b', x: 4, y: 3, w: 2, h: 2 },
      ],
      { compact: 'none' },
    )
    await nextTick()
    drag(item('a'), [10, 10], [10 + STEP * 4, 10])
    expect(wrapper.findAll('.dg-snap-guide')).toHaveLength(0)
  })
})

describe('playEnter', () => {
  it('replays the arrival for every widget in reading order', async () => {
    const { item, grid } = mountGrid(
      [
        { id: 'b', x: 2, y: 0, w: 2, h: 2 },
        { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      ],
      { animation: { enter: 'zoom', stagger: 30 } },
    )
    await nextTick()
    expect(item('a').classList.contains('dg-item--entering')).toBe(false)
    grid.value!.playEnter()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(item('a').classList.contains('dg-item--entering')).toBe(true)
    expect(item('b').style.getPropertyValue('--dg-enter-delay')).toBe('30ms')
  })
})

describe('zip arrival', () => {
  it('arrives in reading order, top first, and takes longer than other effects', async () => {
    const { wrapper, item } = mountGrid(
      [
        { id: 'top', x: 0, y: 0, w: 2, h: 2 },
        { id: 'bottom', x: 0, y: 2, w: 2, h: 2 },
      ],
      { animation: { enter: 'zip', appear: true, stagger: 60 } },
    )
    await nextTick()
    expect(wrapper.find('.dg-grid').classes()).toContain('dg-grid--enter-zip')
    expect(item('top').style.getPropertyValue('--dg-enter-delay')).toBe('')
    expect(item('bottom').style.getPropertyValue('--dg-enter-delay')).toBe('60ms')
    expect((wrapper.find('.dg-grid').element as HTMLElement).style.getPropertyValue('--dg-enter-duration')).toBe('900ms')
  })
})

describe('size limits by type', () => {
  it('applies type minimums at layout time without writing them into the data', async () => {
    const { at, item } = mountGrid([{ id: 'g', type: 'gauge', x: 0, y: 0, w: 1, h: 1 }], { sizeLimits: { gauge: { minW: 3, minH: 3 } } })
    await nextTick()
    expect(at('g')).toMatchObject({ w: 3, h: 3 })
    expect(at('g').minW).toBeUndefined()
    item('g').dispatchEvent(key('ArrowLeft', { shiftKey: true }))
    await nextTick()
    expect(at('g').w).toBe(3)
  })
})
