import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type PropType } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardGrid, useWidget, type DashboardGridApi, type GridWidget } from '../index'

// jsdom has no layout, so every grid pretends to be 1200px wide
// With 12 columns and a 12px gap one column step is 101px and one row step is 72px
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

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

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
  return { wrapper, model, grid }
}

const pointer = (type: string, x: number, y: number) =>
  new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })

describe('dragging while the page scrolls', () => {
  it('keeps the widget under the pointer when the page scrolls mid-drag', async () => {
    const { wrapper, model } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { compact: 'none', autoScroll: false })
    await nextTick()
    const gridEl = wrapper.find('.dg-grid').element
    let top = 0
    vi.spyOn(gridEl, 'getBoundingClientRect').mockImplementation(() => ({ top, left: 0 }) as DOMRect)

    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    // The page scrolls down two rows with the mouse still, so the grid moves up on screen
    top = -144
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    window.dispatchEvent(pointer('pointerup', 10, 10))
    await nextTick()

    expect(model.value[0]).toMatchObject({ x: 0, y: 2 })
  })
})

describe('auto-scroll', () => {
  it('scrolls the page while dragging near the bottom edge', async () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    // Give the page room to scroll, auto-scroll does nothing otherwise
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(5000)
    const { wrapper } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }])
    await nextTick()

    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10, window.innerHeight - 5))
    await new Promise((resolve) => setTimeout(resolve, 80))
    window.dispatchEvent(pointer('pointerup', 10, window.innerHeight - 5))

    expect(scrollBy).toHaveBeenCalled()
    expect(scrollBy.mock.calls[0]![1]).toBeGreaterThan(0)
  })

  it('can be turned off', async () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const { wrapper } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }], { autoScroll: false })
    await nextTick()

    wrapper.find('.dg-item').element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10, window.innerHeight - 5))
    await new Promise((resolve) => setTimeout(resolve, 80))
    window.dispatchEvent(pointer('pointerup', 10, window.innerHeight - 5))

    expect(scrollBy).not.toHaveBeenCalled()
  })
})

describe('grid inside a widget', () => {
  // A group widget keeps its children in props.widgets and saves them with update
  const Group = defineComponent({
    props: { widgets: { type: Array as PropType<GridWidget[]>, required: true } },
    setup(props) {
      const { update } = useWidget()
      return () =>
        h(DashboardGrid, {
          modelValue: props.widgets,
          compact: 'none',
          autoScroll: false,
          'onUpdate:modelValue': (widgets: GridWidget[]) => update({ props: { widgets } }),
        })
    },
  })

  const outer = (): GridWidget[] => [
    {
      id: 'group',
      type: 'group',
      x: 0,
      y: 0,
      w: 12,
      h: 6,
      props: { widgets: [{ id: 'child', x: 0, y: 0, w: 2, h: 2 }] },
    },
  ]

  it('drags the inner widget only, not the group around it', async () => {
    const onDragStart = vi.fn()
    const { wrapper, model } = mountGrid(outer(), {
      components: { group: Group },
      compact: 'none',
      autoScroll: false,
      onDragStart,
    })
    await nextTick()

    const items = wrapper.findAll('.dg-item')
    expect(items).toHaveLength(2)
    const child = items[1]!.element
    child.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 3, 10))
    await nextTick()
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 3, 10))
    await nextTick()

    expect(onDragStart).not.toHaveBeenCalled()
    expect(model.value[0]).toMatchObject({ x: 0, y: 0 })
    const children = (model.value[0]!.props as { widgets: GridWidget[] }).widgets
    expect(children[0]).toMatchObject({ id: 'child', x: 3, y: 0 })
  })

  it('still drags the group from its own empty space', async () => {
    const onDragStart = vi.fn()
    const { wrapper } = mountGrid(outer(), { components: { group: Group }, autoScroll: false, onDragStart })
    await nextTick()

    wrapper.findAll('.dg-item')[0]!.element.dispatchEvent(pointer('pointerdown', 10, 10))
    window.dispatchEvent(pointer('pointerup', 10, 10))
    expect(onDragStart).toHaveBeenCalledOnce()
  })
})

describe('useWidget().update', () => {
  it('saves new props into the dashboard without creating an undo step', async () => {
    const Counter = defineComponent({
      props: { count: { type: Number, required: true } },
      setup(props) {
        const { update } = useWidget()
        return () => h('button', { onClick: () => update({ props: { count: props.count + 1 } }) }, `count ${props.count}`)
      },
    })
    const { wrapper, model, grid } = mountGrid([{ id: 'a', type: 'counter', x: 0, y: 0, w: 2, h: 2, props: { count: 0 } }], {
      components: { counter: Counter },
    })
    await nextTick()

    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(model.value[0]!.props).toEqual({ count: 1 })
    expect(wrapper.text()).toContain('count 1')
    expect(grid.value!.canUndo).toBe(false)
  })
})
