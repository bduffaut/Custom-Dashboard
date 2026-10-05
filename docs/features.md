# Features

## Responsive layouts

```vue
<DashboardGrid v-model="widgets" breakpoints />
```

- Your array always holds the widest layout
- Narrower breakpoints are worked out from it automatically, scaled by default or stacked in reading order with `breakpoint-layout="list"`
- If someone rearranges widgets on a narrower screen, those positions are saved on each widget under `breakpoints[name]` and used whenever that breakpoint is active
- `resetBreakpoint()` drops them again

Custom breakpoints: `:breakpoints="{ lg: { width: 1200, columns: 12 }, sm: { width: 0, columns: 2 } }"`

## Drag and drop between grids

Any two grids on a page can exchange widgets by dragging, including a grid nested inside a widget.

- `group` controls which grids can talk to each other
- `accept-drops` controls what a grid will take

## Dragging in from outside

Use the directive on anything, like sidebar items or menu entries:

```vue
<script setup lang="ts">
import { vDraggableWidget } from 'custom-dashboard-grid'
</script>

<template>
  <aside>
    <div v-draggable-widget="{ type: 'chart', w: 4, h: 3, props: { range: '7d' } }">Sales chart</div>
    <!-- A function is called fresh for every drop -->
    <div v-draggable-widget="() => ({ type: 'notes', w: 3, h: 3, props: { text: '' } })">Notes</div>
  </aside>
</template>
```

Each drop gets its own copy of the data and a fresh id. A drag only starts after the pointer moves a few px, so plain clicks still work.

## Grids inside widgets

A widget can contain its own `DashboardGrid`. Store the inner widgets in the outer widget's props and save them back with `update`:

```vue
<!-- GroupWidget.vue, registered as components: { group: GroupWidget } -->
<script setup lang="ts">
import { DashboardGrid, useWidget, type GridWidget } from 'custom-dashboard-grid'

defineProps<{ widgets: GridWidget[] }>()
const { update } = useWidget()
</script>

<template>
  <DashboardGrid :model-value="widgets" :components="components" @update:model-value="(widgets) => update({ props: { widgets } })" />
</template>
```

Widgets can be dragged into and out of the group, and a group is never dropped into itself. Each grid keeps its own undo history, and shortcuts go to the grid used last.

## Pin modes

One setting for how a widget may move:

| Mode | Behavior | Field it sets |
|---|---|---|
| `free` | No restrictions | none |
| `pinned` | Other widgets cannot push it, but you can still drag and resize it | `locked: true` |
| `locked` | Never moves or resizes, others flow around it | `static: true` |
| `no-resize` | Can be moved but keeps its size | `noResize: true` |

A pin menu in a widget header takes a few lines:

```vue
<script setup lang="ts">
import { useWidget, type PinMode } from 'custom-dashboard-grid'

const { pinMode, setPinMode, editable } = useWidget()
</script>

<template>
  <select v-if="editable" :value="pinMode" @change="setPinMode(($event.target as HTMLSelectElement).value as PinMode)">
    <option value="free">Unpinned</option>
    <option value="pinned">Pinned</option>
    <option value="locked">Locked</option>
    <option value="no-resize">Resize locked</option>
  </select>
</template>
```

Pin changes are undoable. `pinModeOf(widget)` reads a widget's mode anywhere, for example to show a badge.

## Auto-arrange

`grid.autoArrange()` packs every widget into the shortest layout it can find, as one undo step. Static and `noMove` widgets stay put. `autoArrange({ keepOrder: true })` keeps the current reading order instead of searching for the tightest fit.

## Trash zones

Make any element a trash zone. A widget dropped on it is removed as a normal undoable change:

```vue
<div v-widget-trash class="trash">Drop here to remove</div>
```

- The zone gets `dg-trash--active` while a widget is held over it
- `<html>` has `dg-dragging` while any widget is dragged, so you can show the zone only then: `html:not(.dg-dragging) .trash { display: none }`
- `v-widget-trash:reports` limits a zone to one grid group

With `remove-on-drop-outside`, dropping a widget anywhere outside every grid removes it too.

## Size to content

```ts
{ id: 'checklist', type: 'checklist', w: 4, h: 2, sizeToContent: true } // grows and shrinks with its content
{ id: 'log', type: 'log', w: 6, h: 2, sizeToContent: 8 }                // but never past 8 rows
```

- The grid measures the content and sets `h` to the rows it needs, pushing neighbours as usual
- It is automatic, so it is not an undo step, and it never happens mid-drag
- Give the widget's root element a natural height, not `height: 100%`
- `resizeToContent(id?)` fits any widget once, on demand

## Animation

```vue
<DashboardGrid animation="bouncy" />
<DashboardGrid :animation="{ duration: 300, easing: 'ease-out' }" />
<DashboardGrid :animation="{ preset: 'smooth', leave: false }" />
<DashboardGrid :animation="false" />
```

- Moves and resizes are CSS transitions on transform, width and height, so the GPU handles them
- New widgets fade and scale in, removed ones fade out where they were
- Animation turns off for users who prefer reduced motion, unless you set `respectReducedMotion: false`
- Presets: `snappy` 120 ms, `smooth` 200 ms (default), `gentle` 350 ms, `bouncy` 420 ms with a slight overshoot

## Saving and loading

One line keeps the layout in localStorage:

```ts
import { useLayoutStorage } from 'custom-dashboard-grid'

const { widgets, reset, clear } = useLayoutStorage('my-dashboard', defaultWidgets, { version: 1 })
```

Saving is debounced and pending changes are written before the page closes. Missing, blocked or full storage is handled, and corrupt data falls back to your defaults.

Named presets:

```ts
const presets = useSavedLayouts(widgets, { key: 'my-dashboard:presets' })
presets.save('Incident view')
presets.load('Incident view') // one undo step in the grid
presets.layouts.value         // [{ id, name, savedAt, widgets }]
presets.rename(id, 'New name')
presets.remove(id)
```

Your own backend:

```ts
import { parseLayout, serializeLayout } from 'custom-dashboard-grid'

await api.save(serializeLayout(widgets.value, 2)) // { version: 2, savedAt, widgets }

widgets.value = parseLayout(await api.load(), {
  version: 2,
  migrate: (old, fromVersion) => old.map(upgradeWidget), // upgrade older saves
  fallback: defaultWidgets,                             // used if the data is unreadable
})
```

`parseLayout` never throws. It accepts a JSON string, a saved object or a bare array, and cleans every widget.

## Custom rendering

Use the default slot instead of `components`:

```vue
<DashboardGrid v-model="widgets" v-slot="{ widget, remove, collapse, editable }">
  <MyCard :title="widget.id" :closable="editable" @close="remove" @toggle="collapse()" />
</DashboardGrid>
```

Replace the crash fallback with the `#error="{ widget, error, retry }"` slot.

## Global registration

```ts
import DashboardGridPlugin from 'custom-dashboard-grid'

app.use(DashboardGridPlugin) // DashboardGrid, v-draggable-widget and v-widget-trash work everywhere
```

## Styling

Widget content is entirely yours. Theme the grid's own parts with CSS variables:

```css
:root {
  --dg-radius: 8px;
  --dg-placeholder-bg: rgba(100, 116, 139, 0.15);
  --dg-placeholder-border: rgba(100, 116, 139, 0.5);
  --dg-guide-color: rgba(100, 116, 139, 0.07);  /* column guides while dragging */
  --dg-handle-hover: rgba(100, 116, 139, 0.35); /* edge resize handles on hover */
  --dg-pending-bg: rgba(100, 116, 139, 0.08);   /* lazy widgets not rendered yet */
}
```

The grid also sets `--dg-duration`, `--dg-easing`, `--dg-col-width`, `--dg-gap`, `--dg-row-gap` and `--dg-row-height` on itself for your own styles. The demo uses them to draw the grid cells behind the widgets in edit mode.

Classes:

- Grid: `.dg-grid` plus `--editable`, `--readonly`, `--interacting`, `--receiving`
- Widgets: `.dg-item` plus `--dragging`, `--resizing`, `--collapsed`, `--static`, `--pending`, `--removing`, `--entering`, `--fit`
- Parts: `.dg-placeholder`, `.dg-resize-handle--{n,s,e,w,ne,nw,se,sw}`, `.dg-ghost`, `.dg-error`, `.dg-trash`, `.dg-trash--active`
- Page: `html.dg-dragging` while any widget is dragged

Each widget wrapper has `data-widget-id` and the grid has `data-breakpoint`.
