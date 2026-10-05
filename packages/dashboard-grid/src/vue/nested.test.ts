import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type PropType } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardGrid, useWidget, type GridWidget } from '../index'

// Moving widgets between a dashboard and a grid nested in one of its widgets
// Both grids change the same outer array in the same tick and neither may overwrite the other

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

// A group widget keeps its children in props.widgets and saves them with update
const Group = defineComponent({
  props: { widgets: { type: Array as PropType<GridWidget[]>, required: true } },
  setup(props) {
    const { update } = useWidget()
    return () =>
      h(DashboardGrid, {
        modelValue: props.widgets,
        autoScroll: false,
        'onUpdate:modelValue': (widgets: GridWidget[]) => update({ props: { widgets } }),
      })
  },
})

function mountNested() {
  const widgets = ref<GridWidget[]>([
    { id: 'group', type: 'group', x: 0, y: 0, w: 12, h: 4, props: { widgets: [{ id: 'child', x: 0, y: 0, w: 2, h: 2 }] } },
    { id: 'loose', x: 0, y: 4, w: 2, h: 2 },
  ])
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(DashboardGrid, {
          modelValue: widgets.value,
          components: { group: Group },
          autoScroll: false,
          'onUpdate:modelValue': (v: GridWidget[]) => (widgets.value = v),
        }),
    }),
    { attachTo: document.body },
  )
  return { wrapper, widgets }
}

const childrenOf = (widgets: GridWidget[]) => (widgets.find((w) => w.id === 'group')!.props as { widgets: GridWidget[] }).widgets

describe('nested grids', () => {
  it('drags a widget out of a group into the main dashboard', async () => {
    const { wrapper, widgets } = mountNested()
    await nextTick()
    const [outer, inner] = wrapper.findAll('.dg-grid')
    rectOf(outer!.element, 0, 0, 1200, 800)
    rectOf(inner!.element, 0, 40, 1200, 200)

    const child = wrapper.find('[data-widget-id="child"]').element
    child.dispatchEvent(pointer('pointerdown', 10, 50))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 6, 10 + 72 * 6))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 6, 10 + 72 * 6))
    await nextTick()

    expect(childrenOf(widgets.value)).toHaveLength(0)
    expect(widgets.value.find((w) => w.id === 'child')).toMatchObject({ x: 6 })
    expect(widgets.value.map((w) => w.id).sort()).toEqual(['child', 'group', 'loose'])
  })

  it('drags a widget from the main dashboard into a group', async () => {
    const { wrapper, widgets } = mountNested()
    await nextTick()
    const [outer, inner] = wrapper.findAll('.dg-grid')
    rectOf(outer!.element, 0, 0, 1200, 800)
    rectOf(inner!.element, 0, 40, 1200, 200)

    const loose = wrapper.find('[data-widget-id="loose"]').element
    loose.dispatchEvent(pointer('pointerdown', 10, 4 * 72 + 10))
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 5, 50))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 5, 50))
    await nextTick()

    expect(widgets.value.map((w) => w.id)).toEqual(['group'])
    expect(childrenOf(widgets.value).map((w) => w.id).sort()).toEqual(['child', 'loose'])
    expect(childrenOf(widgets.value).find((w) => w.id === 'loose')).toMatchObject({ x: 5 })
  })

  it('never drops a group into its own inner grid', async () => {
    const { wrapper, widgets } = mountNested()
    await nextTick()
    const [outer, inner] = wrapper.findAll('.dg-grid')
    rectOf(outer!.element, 0, 0, 1200, 800)
    rectOf(inner!.element, 0, 40, 1200, 200)

    // Grab the group by its empty space and nudge it, it stays in the main dashboard
    const group = wrapper.find('[data-widget-id="group"]').element
    group.dispatchEvent(pointer('pointerdown', 600, 20))
    window.dispatchEvent(pointer('pointermove', 700, 60))
    window.dispatchEvent(pointer('pointerup', 700, 60))
    await nextTick()

    expect(widgets.value.some((w) => w.id === 'group')).toBe(true)
    expect(childrenOf(widgets.value).map((w) => w.id)).toEqual(['child'])
  })

  it('still finds the group when a preview pushes it away from the pointer', async () => {
    const { wrapper, widgets } = mountNested()
    await nextTick()
    const [outer, inner] = wrapper.findAll('.dg-grid')
    rectOf(outer!.element, 0, 0, 1200, 800)
    rectOf(inner!.element, 0, 40, 1200, 200)

    const loose = wrapper.find('[data-widget-id="loose"]').element
    loose.dispatchEvent(pointer('pointerdown', 10, 4 * 72 + 10))
    // Mid-drag the group slides down the page, like a live preview would push it
    rectOf(inner!.element, 0, 600, 1200, 200)
    window.dispatchEvent(pointer('pointermove', 10 + 101 * 5, 50))
    window.dispatchEvent(pointer('pointerup', 10 + 101 * 5, 50))
    await nextTick()

    expect(childrenOf(widgets.value).map((w) => w.id).sort()).toEqual(['child', 'loose'])
  })
})

describe('drop targets inside a scrolling panel', () => {
  function mountPanel() {
    const left = ref<GridWidget[]>([{ id: 'a', x: 0, y: 0, w: 2, h: 2 }])
    const right = ref<GridWidget[]>([])
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            h(DashboardGrid, { modelValue: left.value, autoScroll: false, 'onUpdate:modelValue': (v: GridWidget[]) => (left.value = v) }),
            h('div', { class: 'panel', style: 'overflow: auto; height: 300px' }, [
              h(DashboardGrid, { modelValue: right.value, minRows: 6, autoScroll: false, 'onUpdate:modelValue': (v: GridWidget[]) => (right.value = v) }),
            ]),
          ]),
      }),
      { attachTo: document.body },
    )
    return { wrapper, left, right }
  }

  it('follows the panel scrolling: hidden parts are not targets, visible parts are', async () => {
    const { wrapper, left, right } = mountPanel()
    await nextTick()
    const [gridA, gridB] = wrapper.findAll('.dg-grid')
    const panel = wrapper.find('.panel').element as HTMLElement
    rectOf(gridA!.element, 0, 0, 1200, 400)
    rectOf(panel, 0, 500, 1200, 300)
    // The inner grid is 400px tall inside a 300px panel
    rectOf(gridB!.element, 0, 500, 1200, 400)

    wrapper.find('[data-widget-id="a"]').element.dispatchEvent(pointer('pointerdown', 10, 10))
    // The panel scrolls 200px mid-drag, so the grid spans 300 to 700 and shows between 500 and 700
    // jsdom ignores scrollTop, so fake the scrolled position
    Object.defineProperty(panel, 'scrollTop', { value: 200, configurable: true })
    rectOf(gridB!.element, 0, 300, 1200, 400)
    // 750 is inside the panel but below the scrolled grid, not a target
    window.dispatchEvent(pointer('pointermove', 10, 750))
    await nextTick()
    // Only the source grid shows a placeholder, the widget is still in its own grid
    const placeholders = wrapper.findAll('.dg-placeholder')
    expect(placeholders).toHaveLength(1)
    expect(gridA!.element.contains(placeholders[0]!.element)).toBe(true)
    expect(right.value).toHaveLength(0)
    // 650 is on the visible part of the scrolled grid, a target
    window.dispatchEvent(pointer('pointermove', 10, 650))
    window.dispatchEvent(pointer('pointerup', 10, 650))
    await nextTick()
    expect(left.value).toHaveLength(0)
    expect(right.value.map((w) => w.id)).toEqual(['a'])
  })
})
