import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, effectScope, h, nextTick, ref, withDirectives, type Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DashboardGrid,
  useLayoutStorage,
  useSavedLayouts,
  useWidget,
  vDraggableWidget,
  type DashboardGridApi,
  type GridWidget,
} from '../index'

// jsdom has no layout, so every grid reports a configurable width
// At 1200px with 12 columns and a 12px gap one column step is 101px and one row step is 72px
let gridWidth = 1200
const observers: { callback: ResizeObserverCallback; self: ResizeObserver }[] = []

beforeEach(() => {
  gridWidth = 1200
  observers.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe() {
        observers.push({ callback: this.callback, self: this as unknown as ResizeObserver })
        this.callback([{ contentRect: { width: gridWidth } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

enableAutoUnmount(afterEach)

function resizeAllGrids(width: number) {
  gridWidth = width
  for (const o of observers) o.callback([{ contentRect: { width } } as ResizeObserverEntry], o.self)
}

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
          ...extra,
        }),
    }),
    { attachTo: document.body },
  )
  return { wrapper, model, grid, inner: () => wrapper.findComponent(DashboardGrid) }
}

const pointer = (type: string, x: number, y: number) => new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })

function rectOf(el: Element, rect: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect)
}

const two = (): GridWidget[] => [
  { id: 'a', x: 0, y: 0, w: 2, h: 2 },
  { id: 'b', x: 2, y: 0, w: 2, h: 2 },
]

describe('reliability', () => {
  it('keeps both widgets when addWidget is called twice in a row', async () => {
    const { model, grid } = mountGrid([])
    await nextTick()
    grid.value!.addWidget({ type: 'x', w: 2, h: 2 })
    grid.value!.addWidget({ type: 'x', w: 2, h: 2 })
    await nextTick()
    expect(model.value).toHaveLength(2)
    expect(new Set(model.value.map((w) => w.id)).size).toBe(2)
  })

  it('cleans bad input instead of crashing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bad = [null, { id: 'ok', x: 0, y: 0, w: 2, h: 2 }, { x: 1 }, { id: 'ok', x: 4, y: 0, w: 2, h: 2 }, { id: 'n', x: NaN, y: 0, w: 'big', h: 2 }]
    const { wrapper, model } = mountGrid(bad as unknown as GridWidget[])
    await nextTick()
    expect(model.value.map((w) => w.id)).toEqual(['ok', 'n'])
    expect(wrapper.findAll('.dg-item')).toHaveLength(2)
  })

  it('cancels a drag with Escape and keeps the layout', async () => {
    const { wrapper, model, inner } = mountGrid(two(), { compact: 'none' })
    await nextTick()
    wrapper.findAll('.dg-item')[0]!.element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 6, 10))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 6, 10))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 0, y: 0 })
    expect(inner().emitted('update:modelValue')).toBeUndefined()
  })
})

describe('resize handles', () => {
  it('shows the handles chosen on the grid, per widget overrides, and none when locked', async () => {
    const { wrapper } = mountGrid(
      [
        { id: 'a', x: 0, y: 0, w: 2, h: 2 },
        { id: 'b', x: 2, y: 0, w: 2, h: 2, resizeHandles: 'e' },
        { id: 'c', x: 4, y: 0, w: 2, h: 2, static: true },
      ],
      { resizeHandles: 'all' },
    )
    await nextTick()
    const items = wrapper.findAll('.dg-item')
    expect(items[0]!.findAll('.dg-resize-handle')).toHaveLength(8)
    expect(items[1]!.findAll('.dg-resize-handle')).toHaveLength(1)
    expect(items[2]!.findAll('.dg-resize-handle')).toHaveLength(0)
  })

  it('resizes from the left edge, keeping the right edge fixed', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 4, y: 0, w: 2, h: 2 }], { resizeHandles: ['w'], compact: 'none' })
    await nextTick()
    wrapper.find('.dg-resize-handle--w').element.dispatchEvent(pointer('pointerdown', 404, 30))
    window.dispatchEvent(pointer('pointermove', 404 - 101 * 2, 30))
    window.dispatchEvent(pointer('pointerup', 404 - 101 * 2, 30))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 2, w: 4 })
  })
})

describe('collapse', () => {
  it('shrinks a widget to one row on screen, keeps its height in the data, and is undoable', async () => {
    const { wrapper, model, grid } = mountGrid([
      { id: 'a', x: 0, y: 0, w: 4, h: 4 },
      { id: 'b', x: 0, y: 4, w: 4, h: 2 },
    ])
    await nextTick()
    grid.value!.collapseWidget('a')
    await nextTick()
    expect(model.value[0]).toMatchObject({ collapsed: true, h: 4 })
    expect(model.value[1]).toMatchObject({ y: 1 })
    const first = wrapper.findAll('.dg-item')[0]!
    expect(first.classes()).toContain('dg-item--collapsed')
    expect(first.attributes('style')).toContain('height: 60px')

    grid.value!.undo()
    await nextTick()
    expect(model.value[0]!.collapsed).toBeUndefined()
  })

  it('exposes collapse through useWidget', async () => {
    const Toggle = defineComponent({
      setup() {
        const { collapse, collapsed } = useWidget()
        return () => h('button', { onClick: () => collapse() }, collapsed.value ? 'expand' : 'collapse')
      },
    })
    const { wrapper, model } = mountGrid([{ id: 'a', type: 't', x: 0, y: 0, w: 2, h: 3 }], { components: { t: Toggle } })
    await nextTick()
    await wrapper.get('button').trigger('click')
    expect(model.value[0]!.collapsed).toBe(true)
    expect(wrapper.text()).toContain('expand')
  })
})

describe('edit mode', () => {
  it('is read-only when editable is false: no drag, no handles, no shortcuts', async () => {
    const Probe = defineComponent({
      setup() {
        const { editable } = useWidget()
        return () => h('span', editable.value ? 'editing' : 'viewing')
      },
    })
    const { wrapper, model, grid } = mountGrid([{ id: 'a', type: 'p', x: 0, y: 0, w: 2, h: 2 }], {
      editable: false,
      components: { p: Probe },
    })
    await nextTick()
    expect(wrapper.text()).toContain('viewing')
    expect(wrapper.findAll('.dg-resize-handle')).toHaveLength(0)
    expect(wrapper.find('.dg-grid').classes()).toContain('dg-grid--readonly')

    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 600, 10))
    window.dispatchEvent(pointer('pointerup', 600, 10))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 0 })

    // Programmatic changes still work in read only mode
    grid.value!.removeWidget('a')
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    await nextTick()
    expect(model.value).toHaveLength(0)
  })
})

describe('layout options', () => {
  it('floats widgets left with horizontal compaction', async () => {
    const { model } = mountGrid([{ id: 'a', x: 8, y: 0, w: 2, h: 2 }], { compact: 'horizontal' })
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 0 })
  })

  it('refuses to add a widget when maxRows leaves no room', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { model, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 12, h: 2 }], { maxRows: 2 })
    await nextTick()
    expect(grid.value!.addWidget({ w: 2, h: 2 })).toBeNull()
    expect(model.value).toHaveLength(1)
  })

  it('auto-arranges into the most compact layout as one undo step', async () => {
    const { model, grid } = mountGrid(
      [
        { id: 'a', x: 0, y: 0, w: 6, h: 2 },
        { id: 'b', x: 0, y: 2, w: 6, h: 2 },
        { id: 'c', x: 0, y: 4, w: 6, h: 2 },
        { id: 'd', x: 0, y: 6, w: 6, h: 2 },
      ],
      { compact: 'none' },
    )
    await nextTick()
    expect(grid.value!.autoArrange()).toBe(true)
    await nextTick()
    expect(Math.max(...model.value.map((w) => w.y + w.h))).toBe(4)
    grid.value!.undo()
    await nextTick()
    expect(model.value[3]).toMatchObject({ x: 0, y: 6 })
  })
})

describe('responsive breakpoints', () => {
  const bps = { lg: { width: 1000, columns: 12 }, sm: { width: 0, columns: 1 } }

  it('switches layout with the container width and saves edits per breakpoint', async () => {
    const { wrapper, model, grid, inner } = mountGrid(two(), { breakpoints: bps, resizeHandles: 'se' })
    await nextTick()
    expect(grid.value!.breakpoint).toBe('lg')

    resizeAllGrids(500)
    await nextTick()
    expect(grid.value!.breakpoint).toBe('sm')
    expect(inner().emitted('breakpointChange')?.[0]).toEqual(['sm'])
    const items = wrapper.findAll('.dg-item')
    expect(items[0]!.attributes('style')).toContain('width: 500px')
    expect(items[1]!.attributes('style')).toContain('translate(0px, 144px)')

    // Taller at the small breakpoint only
    wrapper.findAll('.dg-resize-handle--se')[0]!.element.dispatchEvent(pointer('pointerdown', 490, 130))
    window.dispatchEvent(pointer('pointermove', 490, 130 + 72))
    window.dispatchEvent(pointer('pointerup', 490, 130 + 72))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 0, y: 0, w: 2, h: 2 })
    expect(model.value[0]!.breakpoints?.sm).toMatchObject({ h: 3 })

    grid.value!.resetBreakpoint('sm')
    await nextTick()
    expect(model.value[0]!.breakpoints).toBeUndefined()
  })
})

describe('error boundaries', () => {
  it('replaces a crashing widget with a fallback and keeps the rest working', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const shouldFail = ref(true)
    const Boom = defineComponent({
      setup: () => () => {
        if (shouldFail.value) throw new Error('kaboom')
        return h('p', 'recovered')
      },
    })
    const Fine = defineComponent({ setup: () => () => h('p', 'fine') })
    const { wrapper, inner } = mountGrid(
      [
        { id: 'bad', type: 'boom', x: 0, y: 0, w: 2, h: 2 },
        { id: 'good', type: 'fine', x: 2, y: 0, w: 2, h: 2 },
      ],
      { components: { boom: Boom, fine: Fine } as Record<string, Component> },
    )
    await nextTick()
    expect(wrapper.text()).toContain('This widget crashed')
    expect(wrapper.text()).toContain('kaboom')
    expect(wrapper.text()).toContain('fine')
    expect(inner().emitted('widgetError')?.[0]?.[0]).toMatchObject({ id: 'bad' })

    shouldFail.value = false
    await wrapper.get('.dg-error button').trigger('click')
    expect(wrapper.text()).toContain('recovered')
  })
})

describe('lazy rendering', () => {
  it('waits until a widget is near view before rendering its content', async () => {
    let notify: ((entries: IntersectionObserverEntry[]) => void) | null = null
    const watched: Element[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
          notify = callback
        }
        observe(el: Element) {
          watched.push(el)
        }
        unobserve() {}
        disconnect() {}
      },
    )
    const Content = defineComponent({ setup: () => () => h('p', 'content') })
    const { wrapper } = mountGrid([{ id: 'a', type: 'c', x: 0, y: 0, w: 2, h: 2 }], { lazy: true, components: { c: Content } })
    await nextTick()
    expect(wrapper.text()).not.toContain('content')
    expect(wrapper.find('.dg-item').classes()).toContain('dg-item--pending')

    notify!([{ isIntersecting: true, target: watched[0]! } as IntersectionObserverEntry])
    await nextTick()
    expect(wrapper.text()).toContain('content')
  })
})

describe('drag and drop between grids', () => {
  it('moves a widget from one grid into another', async () => {
    const left = ref<GridWidget[]>([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }])
    const right = ref<GridWidget[]>([])
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            h(DashboardGrid, { modelValue: left.value, 'onUpdate:modelValue': (v: GridWidget[]) => (left.value = v), autoScroll: false }),
            h(DashboardGrid, { modelValue: right.value, 'onUpdate:modelValue': (v: GridWidget[]) => (right.value = v), autoScroll: false }),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    const [gridA, gridB] = wrapper.findAll('.dg-grid')
    rectOf(gridA!.element, { left: 0, top: 0, width: 1200, height: 400 })
    rectOf(gridB!.element, { left: 0, top: 500, width: 1200, height: 400 })

    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 3, 510))
    await nextTick()
    expect(wrapper.findAll('.dg-placeholder')).toHaveLength(1)
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 3, 510))
    await nextTick()

    expect(left.value).toHaveLength(0)
    expect(right.value).toEqual([{ id: 'a', x: 3, y: 0, w: 2, h: 2 }])
    const [a, b] = wrapper.findAllComponents(DashboardGrid)
    expect(a!.emitted('dragOut')).toHaveLength(1)
    expect(b!.emitted('drop')?.[0]?.[0]).toMatchObject({ from: 'grid' })
  })

  it('does not drop into a grid that refuses it', async () => {
    const left = ref<GridWidget[]>([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }])
    const right = ref<GridWidget[]>([])
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            h(DashboardGrid, { modelValue: left.value, 'onUpdate:modelValue': (v: GridWidget[]) => (left.value = v), autoScroll: false }),
            h(DashboardGrid, {
              modelValue: right.value,
              'onUpdate:modelValue': (v: GridWidget[]) => (right.value = v),
              acceptDrops: () => false,
              autoScroll: false,
            }),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    const [gridA, gridB] = wrapper.findAll('.dg-grid')
    rectOf(gridA!.element, { left: 0, top: 0, width: 1200, height: 400 })
    rectOf(gridB!.element, { left: 0, top: 500, width: 1200, height: 400 })

    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 300, 510))
    window.dispatchEvent(pointer('pointerup', 300, 510))
    await nextTick()
    expect(left.value).toHaveLength(1)
    expect(right.value).toHaveLength(0)
  })
})

describe('dragging in from outside', () => {
  it('creates a fresh widget where it is dropped', async () => {
    const widgets = ref<GridWidget[]>([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }])
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            withDirectives(h('div', { class: 'palette-item' }, 'Chart'), [[vDraggableWidget, { type: 'chart', w: 4, h: 2, props: { range: '7d' } }]]),
            h(DashboardGrid, { modelValue: widgets.value, 'onUpdate:modelValue': (v: GridWidget[]) => (widgets.value = v), autoScroll: false }),
          ]),
      }),
      { attachTo: document.body },
    )
    await nextTick()
    rectOf(wrapper.find('.dg-grid').element, { left: 0, top: 100, width: 1200, height: 400 })

    const source = wrapper.find('.palette-item').element
    source.dispatchEvent(pointer('pointerdown', 5, 5))
    // A tiny move does not start a drag, so clicks still work
    window.dispatchEvent(pointer('pointermove', 7, 6))
    expect(document.querySelector('.dg-ghost')).toBeNull()
    window.dispatchEvent(pointer('pointermove', 16 + 101 * 4, 116))
    expect(document.querySelector('.dg-ghost')).not.toBeNull()
    window.dispatchEvent(pointer('pointerup', 16 + 101 * 4, 116))
    await nextTick()

    expect(document.querySelector('.dg-ghost')).toBeNull()
    expect(widgets.value).toHaveLength(2)
    expect(widgets.value[1]).toMatchObject({ type: 'chart', x: 4, y: 0, w: 4, h: 2, props: { range: '7d' } })
    expect(widgets.value[1]!.id).toMatch(/^chart-/)
  })
})

describe('storage helpers', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial))
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
  }
  const defaults = (): GridWidget[] => [{ id: 'd', x: 0, y: 0, w: 1, h: 1 }]

  it('loads defaults, saves changes after a short delay, and reloads them', async () => {
    vi.useFakeTimers()
    const storage = memoryStorage()
    const scope = effectScope()
    const { widgets } = scope.run(() => useLayoutStorage('k', defaults, { storage, version: 2 }))!
    expect(widgets.value).toEqual(defaults())

    widgets.value = [...widgets.value, { id: 'e', x: 1, y: 0, w: 1, h: 1 }]
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(JSON.parse(storage.data.get('k')!)).toMatchObject({ version: 2, widgets: [{ id: 'd' }, { id: 'e' }] })
    scope.stop()

    const again = effectScope().run(() => useLayoutStorage('k', defaults, { storage, version: 2 }))!
    expect(again.widgets.value.map((w) => w.id)).toEqual(['d', 'e'])
  })

  it('falls back to defaults when storage is corrupted or throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const corrupted = memoryStorage({ k: '{oops' })
    expect(effectScope().run(() => useLayoutStorage('k', defaults, { storage: corrupted }))!.widgets.value).toEqual(defaults())

    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('full') }, removeItem: () => {} }
    const { widgets, save } = effectScope().run(() => useLayoutStorage('k', defaults, { storage: broken }))!
    expect(widgets.value).toEqual(defaults())
    expect(() => save()).not.toThrow()
  })

  it('saves, lists, loads, renames and removes named layouts', () => {
    const storage = memoryStorage()
    const widgets = ref<GridWidget[]>(defaults())
    const presets = useSavedLayouts(widgets, { key: 'p', storage })

    presets.save('First')
    widgets.value = [{ id: 'z', x: 0, y: 0, w: 2, h: 2 }]
    presets.save('Second')
    expect(presets.layouts.value.map((l) => l.name)).toEqual(['First', 'Second'])

    expect(presets.load('First')).toBe(true)
    expect(widgets.value.map((w) => w.id)).toEqual(['d'])
    expect(presets.rename('First', 'Main')).toBe(true)
    expect(presets.remove('Second')).toBe(true)
    expect(presets.load('nope')).toBe(false)

    const reloaded = useSavedLayouts(ref<GridWidget[]>([]), { key: 'p', storage })
    expect(reloaded.layouts.value.map((l) => l.name)).toEqual(['Main'])
  })
})

describe('hardening (audit regressions)', () => {
  it('keeps dragging when the parent refreshes widget content mid-drag', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2, props: { value: 1 } }], { compact: 'none' })
    await nextTick()
    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 3, 10))
    // Live data, a new array with the same positions and new props
    model.value = model.value.map((w) => ({ ...w, props: { value: 2 } }))
    await nextTick()
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 4, 10))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 4, 10))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 4, props: { value: 2 } })
  })

  it('finishes a drag whose mouse button was released outside the window', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { compact: 'none' })
    await nextTick()
    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 3, 10))
    // Back in the window with no button held, the release was missed
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10 + 101 * 3, clientY: 10, pointerType: 'mouse', buttons: 0 }))
    await nextTick()
    expect(model.value[0]).toMatchObject({ x: 3 })
    expect(document.documentElement.classList.contains('dg-dragging')).toBe(false)
  })

  it('clear() leaves storage empty instead of saving the defaults straight back', async () => {
    vi.useFakeTimers()
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
    const { widgets, clear } = effectScope().run(() => useLayoutStorage('k', () => [{ id: 'd', x: 0, y: 0, w: 1, h: 1 }], { storage }))!
    widgets.value = []
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(data.has('k')).toBe(true)
    clear()
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(data.has('k')).toBe(false)
  })

  it('refuses to rename a saved layout to a name already in use', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) }
    const presets = useSavedLayouts(ref<GridWidget[]>([]), { key: 'p', storage })
    presets.save('One')
    presets.save('Two')
    expect(presets.rename('Two', 'One')).toBe(false)
    expect(presets.rename('Two', 'Three')).toBe(true)
  })
})

describe('edge cases: grid width changing mid-drag', () => {
  const box = (el: Element) => {
    const s = (el as HTMLElement).style
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(s.transform)!
    return { x: Number(m[1]), y: Number(m[2]), w: parseFloat(s.width), h: parseFloat(s.height) }
  }

  it('keeps a dragged widget under the pointer when the grid narrows mid-drag', async () => {
    const { wrapper } = mountGrid([{ id: 'a', x: 4, y: 0, w: 2, h: 2 }], { compact: 'none' })
    await nextTick()
    const item = wrapper.find('.dg-item').element
    // Grab 30px into the widget, 404px from the left at 1200px wide
    item.dispatchEvent(pointer('pointerdown', 434, 10))
    window.dispatchEvent(pointer('pointermove', 434, 10))
    // A sidebar opens and the grid shrinks to 600px while the pointer stays put
    resizeAllGrids(600)
    await nextTick()
    window.dispatchEvent(pointer('pointermove', 434, 10))
    await nextTick()
    const b = box(item)
    expect(434).toBeGreaterThanOrEqual(b.x)
    expect(434).toBeLessThanOrEqual(b.x + b.w)
    window.dispatchEvent(pointer('pointerup', 434, 10))
  })

  it('keeps a resize edge under the pointer when the grid narrows mid-resize', async () => {
    const { wrapper } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { compact: 'none', resizeHandles: 'e' })
    await nextTick()
    const item = wrapper.find('.dg-item').element
    item.querySelector('.dg-resize-handle--e')!.dispatchEvent(pointer('pointerdown', 190, 50))
    resizeAllGrids(600)
    await nextTick()
    window.dispatchEvent(pointer('pointermove', 400, 50))
    await nextTick()
    const b = box(item)
    expect(Math.abs(b.x + b.w - 400)).toBeLessThan(2)
    window.dispatchEvent(pointer('pointerup', 400, 50))
  })
})
