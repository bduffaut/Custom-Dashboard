import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardGrid, useWidget, type DashboardGridApi, type GridWidget } from '../index'

// jsdom has no ResizeObserver or layout, so every grid pretends to be 1200px wide
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

// Mounts the grid in a parent that owns the widgets through v-model, like a consumer would
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
  )
  return { wrapper, model, grid }
}

describe('DashboardGrid', () => {
  it('renders each widget with the component registered for its type', () => {
    const Hello = defineComponent({ props: { name: String }, setup: (p) => () => h('p', `hi ${p.name}`) })
    const { wrapper } = mountGrid([{ id: 'a', type: 'hello', x: 0, y: 0, w: 2, h: 2, props: { name: 'Ben' } }], {
      components: { hello: Hello },
    })
    expect(wrapper.text()).toContain('hi Ben')
  })

  it('shows a clear message for a type with no registered component', () => {
    const { wrapper } = mountGrid([{ id: 'a', type: 'nope', x: 0, y: 0, w: 2, h: 2 }])
    expect(wrapper.text()).toContain('No component registered for type nope')
  })

  it('tidies the widgets it is given: clamps to the columns and closes gaps', async () => {
    const { model } = mountGrid([
      { id: 'a', x: 10, y: 5, w: 4, h: 2 },
      { id: 'b', x: 0, y: 9, w: 2, h: 1 },
    ])
    await nextTick()
    expect(model.value).toMatchObject([
      { id: 'a', x: 8, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ])
  })

  it('addWidget auto-places a widget and keeps its extra fields', async () => {
    const { model, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 6, h: 2 }])
    grid.value!.addWidget({ id: 'b', type: 'stat', w: 6, h: 2, props: { value: 1 } })
    await nextTick()
    expect(model.value[1]).toEqual({ id: 'b', type: 'stat', x: 6, y: 0, w: 6, h: 2, props: { value: 1 } })
  })

  it('lets widget content read its widget and remove itself through useWidget', async () => {
    const Removable = defineComponent({
      setup() {
        const { widget, remove } = useWidget()
        return () => h('button', { onClick: remove }, `remove ${widget.value.id}`)
      },
    })
    const { wrapper, model } = mountGrid(
      [
        { id: 'a', type: 'r', x: 0, y: 0, w: 2, h: 2 },
        { id: 'b', type: 'r', x: 2, y: 0, w: 2, h: 2 },
      ],
      { components: { r: Removable } },
    )
    await wrapper.get('button').trigger('click')
    expect(model.value.map((w) => w.id)).toEqual(['b'])
    expect(wrapper.findComponent(DashboardGrid).emitted('remove')?.[0]?.[0]).toMatchObject({ id: 'a' })
  })

  describe('undo and redo', () => {
    const two = (): GridWidget[] => [
      { id: 'a', x: 0, y: 0, w: 2, h: 2 },
      { id: 'b', x: 4, y: 0, w: 2, h: 2 },
    ]

    it('undoes and redoes adding a widget', async () => {
      const { model, grid } = mountGrid(two())
      await nextTick()
      expect(grid.value!.canUndo).toBe(false)

      grid.value!.addWidget({ id: 'c', w: 2, h: 2 })
      await nextTick()
      expect(grid.value!.canUndo).toBe(true)

      grid.value!.undo()
      await nextTick()
      expect(model.value.map((w) => w.id)).toEqual(['a', 'b'])
      expect(grid.value!.canRedo).toBe(true)

      grid.value!.redo()
      await nextTick()
      expect(model.value.map((w) => w.id)).toEqual(['a', 'b', 'c'])
    })

    it('brings back a removed widget with its content', async () => {
      const { model, grid } = mountGrid([{ id: 'a', type: 'stat', x: 0, y: 0, w: 2, h: 2, props: { value: 7 } }])
      await nextTick()
      grid.value!.removeWidget('a')
      await nextTick()
      grid.value!.undo()
      await nextTick()
      expect(model.value).toEqual([{ id: 'a', type: 'stat', x: 0, y: 0, w: 2, h: 2, props: { value: 7 } }])
    })

    it('records changes made from outside, like a reset button', async () => {
      const { model, grid } = mountGrid(two())
      await nextTick()
      model.value = [{ id: 'z', x: 0, y: 0, w: 1, h: 1 }]
      await nextTick()
      grid.value!.undo()
      await nextTick()
      expect(model.value.map((w) => w.id)).toEqual(['a', 'b'])
    })

    it('does not record content-only changes like new props', async () => {
      const { model, grid } = mountGrid([{ id: 'a', x: 0, y: 0, w: 2, h: 2, props: { value: 1 } }])
      await nextTick()
      model.value = [{ ...model.value[0]!, props: { value: 2 } }]
      await nextTick()
      expect(grid.value!.canUndo).toBe(false)
    })

    it('treats a whole drag as one undo step', async () => {
      const { wrapper, model, grid } = mountGrid(two(), { compact: 'none' })
      await nextTick()

      const item = wrapper.findAll('.dg-item')[0]!.element
      item.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
      for (const steps of [1, 2, 3]) {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10 + 101 * steps, clientY: 10 + 72 * steps }))
        await nextTick()
      }
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      await nextTick()
      expect(model.value[0]).toMatchObject({ x: 3, y: 3 })

      grid.value!.undo()
      await nextTick()
      expect(model.value[0]).toMatchObject({ x: 0, y: 0 })
      expect(grid.value!.canUndo).toBe(false)
    })

    it('answers Ctrl+Z and Ctrl+Y, but not while typing in a text field', async () => {
      const { model, grid } = mountGrid(two())
      await nextTick()
      grid.value!.removeWidget('b')
      await nextTick()

      const textarea = document.body.appendChild(document.createElement('textarea'))
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
      await nextTick()
      expect(model.value.map((w) => w.id)).toEqual(['a'])
      textarea.remove()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
      await nextTick()
      expect(model.value.map((w) => w.id)).toEqual(['a', 'b'])

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
      await nextTick()
      expect(model.value.map((w) => w.id)).toEqual(['a'])
    })

    it('can be turned off', async () => {
      const { grid } = mountGrid(two(), { history: false })
      await nextTick()
      grid.value!.removeWidget('a')
      await nextTick()
      expect(grid.value!.canUndo).toBe(false)
      expect(grid.value!.undo()).toBe(false)
    })
  })
})
