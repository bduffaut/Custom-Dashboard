import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, effectScope, h, nextTick, ref, withDirectives, type VNode } from 'vue'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import {
  DashboardGrid,
  PIN_MODE_OPTIONS,
  PIN_MODES,
  useDragState,
  useWidget,
  useWidgetCatalog,
  vDraggableWidget,
  vWidgetTrash,
  type CatalogEntry,
  type DashboardGridApi,
  type GridWidget,
} from '../index'

// Library pieces that replace hand written playground code: drag state, armed trash zones,
// the cell lattice, addWidget sources, updateProps, pin labels and the widget catalog

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
  return { wrapper, model, grid }
}

const bin = () => withDirectives(h('div', { class: 'bin' }), [[vWidgetTrash]])
const one = (): GridWidget[] => [{ id: 'a', x: 0, y: 0, w: 2, h: 2 }]

describe('drag state', () => {
  it('reports a drag, arms trash zones and clears everything on release', async () => {
    const drag = useDragState()
    const { wrapper } = mountGrid(one(), {}, bin)
    await nextTick()
    const trash = wrapper.find('.bin').element
    expect(drag.kind).toBeNull()
    expect(trash.classList.contains('dg-trash--armed')).toBe(false)

    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    expect(drag.kind).toBe('drag')
    expect(drag.widget).toMatchObject({ id: 'a' })
    expect(drag.group).toBe('default')
    expect(document.documentElement.dataset.dgInteraction).toBe('drag')
    expect(trash.classList.contains('dg-trash--armed')).toBe(true)

    window.dispatchEvent(pointer('pointerup', 10, 10))
    await nextTick()
    expect(drag.kind).toBeNull()
    expect(document.documentElement.dataset.dgInteraction).toBeUndefined()
    expect(trash.classList.contains('dg-trash--armed')).toBe(false)
  })

  it('does not arm trash zones while resizing', async () => {
    const drag = useDragState()
    const { wrapper } = mountGrid(one(), {}, bin)
    await nextTick()
    wrapper.find('.dg-resize-handle--se').element.dispatchEvent(pointer('pointerdown', 190, 130))
    expect(drag.kind).toBe('resize')
    expect(wrapper.find('.bin').classes()).not.toContain('dg-trash--armed')
    window.dispatchEvent(pointer('pointerup', 190, 130))
  })

  it('only arms trash zones in the dragged widget group', async () => {
    const other = () => withDirectives(h('div', { class: 'bin' }), [[vWidgetTrash, undefined, 'reports']])
    const { wrapper } = mountGrid(one(), {}, other)
    await nextTick()
    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    expect(wrapper.find('.bin').classes()).not.toContain('dg-trash--armed')
    window.dispatchEvent(pointer('pointerup', 10, 10))
  })

  it('reports external drags without arming trash zones', async () => {
    const drag = useDragState()
    const source = () => withDirectives(h('div', { class: 'source' }), [[vDraggableWidget, { type: 'x', w: 2, h: 2 }]])
    const { wrapper } = mountGrid([], {}, () => h('div', [source(), bin()]))
    await nextTick()
    wrapper.find('.source').element.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 5, clientY: 5, bubbles: true }))
    expect(drag.kind).toBeNull()
    window.dispatchEvent(pointer('pointermove', 40, 40))
    expect(drag.kind).toBe('external')
    expect(document.documentElement.classList.contains('dg-external-dragging')).toBe(true)
    expect(wrapper.find('.bin').classes()).not.toContain('dg-trash--armed')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(drag.kind).toBeNull()
    expect(document.documentElement.classList.contains('dg-dragging')).toBe(false)
  })
})

describe('cell lattice', () => {
  it('shows cells always, only in edit mode, or never', async () => {
    const always = mountGrid(one(), { showCells: true, editable: false })
    const editing = mountGrid(one(), { showCells: 'editing', editable: false })
    const off = mountGrid(one())
    await nextTick()
    expect(always.wrapper.find('.dg-grid').classes()).toContain('dg-grid--cells')
    expect(editing.wrapper.find('.dg-grid').classes()).not.toContain('dg-grid--cells')
    expect(off.wrapper.find('.dg-grid').classes()).not.toContain('dg-grid--cells')

    const edit = mountGrid(one(), { showCells: 'editing' })
    await nextTick()
    expect(edit.wrapper.find('.dg-grid').classes()).toContain('dg-grid--cells')
  })
})

describe('addWidget sources', () => {
  it('accepts a function and builds fresh props for every call', async () => {
    const { model, grid } = mountGrid([])
    await nextTick()
    const template = () => ({ type: 'list', w: 2, h: 2, props: { items: [] as string[] } })
    grid.value!.addWidget(template)
    grid.value!.addWidget(template)
    await nextTick()
    expect(model.value).toHaveLength(2)
    expect(model.value[0]!.props!.items).not.toBe(model.value[1]!.props!.items)
  })

  it('scrolls the new widget into view when asked', async () => {
    const scroll = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    onTestFinished(() => {
      Element.prototype.scrollIntoView = original
    })
    const { grid } = mountGrid([])
    await nextTick()
    const added = grid.value!.addWidget({ type: 'x', w: 2, h: 2 }, { scrollIntoView: true })
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(added).not.toBeNull()
    expect(scroll).toHaveBeenCalledOnce()
  })
})

describe('updateProps', () => {
  it('merges into the existing props, even when called twice in a row', async () => {
    let api: ReturnType<typeof useWidget> | undefined
    const Probe = defineComponent({
      setup() {
        api = useWidget()
        return () => h('div')
      },
    })
    const { model } = mountGrid([{ id: 'a', type: 'probe', x: 0, y: 0, w: 2, h: 2, props: { title: 'Keep', text: '' } }], {
      components: { probe: Probe },
    })
    await nextTick()
    api!.updateProps({ text: 'hello' })
    api!.updateProps({ count: 2 })
    await nextTick()
    expect(model.value[0]!.props).toEqual({ title: 'Keep', text: 'hello', count: 2 })
  })
})

describe('pin mode options', () => {
  it('has a label and description for every mode, in menu order', () => {
    expect(PIN_MODE_OPTIONS.map((o) => o.mode)).toEqual([...PIN_MODES])
    for (const option of PIN_MODE_OPTIONS) {
      expect(option.label).toBeTruthy()
      expect(option.description).toBeTruthy()
    }
  })
})

describe('useWidgetCatalog', () => {
  type Entry = CatalogEntry & { icon: string }
  const entries: Entry[] = [
    { key: 'cpu', name: 'CPU load', description: 'Processor usage', category: 'Hosts', icon: 'chip', widget: { type: 'cpu', w: 2, h: 2 } },
    { key: 'net', name: 'Network', description: 'Traffic in and out', category: 'Network', icon: 'wave', widget: { type: 'net', w: 4, h: 2 } },
    { key: 'disk', name: 'Disk space', category: 'Hosts', icon: 'disk', widget: { type: 'disk', w: 2, h: 2 } },
    { key: 'note', name: 'Notes', icon: 'pen', widget: { type: 'note', w: 2, h: 2 } },
  ]

  it('groups in the given category order with ungrouped entries last', () => {
    const scope = effectScope()
    scope.run(() => {
      const catalog = useWidgetCatalog(entries, { categories: ['Network'] })
      expect(catalog.groups.value.map((g) => g.category)).toEqual(['Network', 'Hosts', ''])
      expect(catalog.groups.value[1]!.entries.map((e) => e.key)).toEqual(['cpu', 'disk'])
    })
    scope.stop()
  })

  it('searches name, description and category with every word', () => {
    const scope = effectScope()
    scope.run(() => {
      const catalog = useWidgetCatalog(entries)
      catalog.query.value = 'hosts usage'
      expect(catalog.results.value.map((e) => e.key)).toEqual(['cpu'])
      catalog.query.value = 'NET'
      expect(catalog.results.value.map((e) => e.key)).toEqual(['net'])
      expect(catalog.results.value[0]!.icon).toBe('wave')
      catalog.query.value = 'nothing like this'
      expect(catalog.groups.value).toEqual([])
    })
    scope.stop()
  })
})
