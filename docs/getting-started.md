# Getting started

## Install

```sh
npm install custom-dashboard-grid
# or
pnpm add custom-dashboard-grid
```

## Your first dashboard

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DashboardGrid, type GridWidget } from 'custom-dashboard-grid'
import 'custom-dashboard-grid/style.css'
import SalesChart from './SalesChart.vue'
import Notes from './Notes.vue'

const widgets = ref<GridWidget[]>([
  { id: 'sales', type: 'chart', x: 0, y: 0, w: 6, h: 4, props: { range: '30d' } },
  { id: 'notes', type: 'notes', x: 6, y: 0, w: 3, h: 4 },
])
</script>

<template>
  <DashboardGrid v-model="widgets" :components="{ chart: SalesChart, notes: Notes }" />
</template>
```

That is the whole integration:

1. Widgets are plain objects with a position and size in grid units, a `type`, and optional `props`
2. `components` maps each `type` to the component that renders it, and the widget's `props` are passed to it
3. `v-model` keeps your array up to date as people drag and resize

Saving a dashboard is just saving that array.

## Widget fields

| Field | Description |
|---|---|
| `id` | Unique string. Required |
| `x`, `y` | Column and row of the top left corner, from 0. Leave both out to place the widget in the first free spot |
| `w`, `h` | Width in columns and height in rows |
| `type` | Which entry in `components` renders it |
| `props` | Props passed to that component. Only props the component declares are bound, so saved data can never set attributes like `style` or `href` on the page. Everything stays readable through `useWidget` |
| `minW`, `maxW`, `minH`, `maxH` | Size limits |
| `static` | Never moves or resizes, others flow around it |
| `locked` | Other widgets never push it, but the user can still move and resize it |
| `noMove`, `noResize` | Lock just one of the two |
| `sizeToContent` | `true` makes the height follow the content, a number caps it at that many rows |
| `resizeHandles` | Resize handles for this widget only, overriding the grid setting |
| `collapsed` | Collapsed to its header, `h` keeps the full height for expanding |
| `breakpoints` | Positions arranged at smaller breakpoints, written by the grid |

Any other fields are kept as they are. Positions you pass in are tidied automatically: kept inside the grid, overlaps resolved and gaps closed.

When some widgets have no `x` and `y`, wrap the array in `defineWidgets([...])` so TypeScript accepts it.

## Edit mode

`editable` switches the whole dashboard between viewing and editing:

```vue
<button @click="editing = !editing">{{ editing ? 'Done' : 'Edit' }}</button>
<DashboardGrid v-model="widgets" :components="components" :editable="editing" />
```

When `editable` is false, widgets cannot be dragged, resized or dropped in, resize handles are hidden and undo shortcuts are off. Methods like `addWidget` still work, so your code stays in control.

## Inside a widget

Any component rendered in a widget can call `useWidget()` to read and control the widget it lives in, without passing props down:

```ts
import { useWidget } from 'custom-dashboard-grid'

const { widget, editable, remove, updateProps, collapse } = useWidget()
```

Save widget state, like settings or notes, back into the dashboard with `updateProps({ text })`. It merges into the existing props. See the [API reference](api.md#usewidget) for everything it returns.

Buttons, inputs, links and anything with `data-no-drag` never start a drag, so widget content stays usable.

## Common recipes

| I want | Do this |
|---|---|
| A view only dashboard with an edit button | `:editable="editing"` |
| Resizing from every side and corner | `resize-handles="all"` |
| Different layouts on phones and tablets | `breakpoints` |
| A tidy up button | `grid.autoArrange()` |
| Saving to localStorage | `const { widgets } = useLayoutStorage('my-dashboard', defaults)` |
| Named layout presets | `useSavedLayouts(widgets, { key: 'my-dashboard:presets' })` |
| A sidebar to drag new widgets from | `<div v-draggable-widget="{ type: 'chart', w: 4, h: 3 }">Chart</div>` |
| A trash can to drag widgets into | `<div v-widget-trash>Remove</div>` |
| A searchable add menu | `useWidgetCatalog(entries)` |
| A pin menu | `v-for` over `PIN_MODE_OPTIONS` calling `setPinMode` |
| Show the grid cells while editing | `show-cells="editing"` |
| UI that reacts to dragging | `useDragState()` |
| Select and move several widgets at once | `selectable` |
| Alignment lines while dragging | `snap-guides` |
| Widgets that cascade in on load | `:animation="{ enter: 'rise', appear: true, stagger: 40 }"` |
| A dashboard that never grows past a size | `:max-rows="10"` |
| Widgets that float left instead of up | `compact="horizontal"` |
| Heavy widgets rendered only when visible | `lazy` |
| Widgets as tall as their content | `sizeToContent: true` on the widget |
| Square cells | `row-height="auto"` |
| As many columns as fit | `:min-column-width="160"` |
| Calmer or bouncier motion | `animation="gentle"` or `animation="bouncy"` |
| Keyboard only editing | On by default in edit mode: Tab to a widget, then arrows, Shift+arrows and Delete |

Next: [Features](features.md) for the details on each of these.
