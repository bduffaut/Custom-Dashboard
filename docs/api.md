# API reference

## Props

| Prop | Default | Description |
|---|---|---|
| `v-model` | required | The widgets array |
| `components` | `{}` | Widget type to component |
| `editable` | `true` | Edit mode. `false` turns off dragging, resizing, dropping and undo shortcuts |
| `draggable`, `resizable` | `true` | Turn off just dragging or just resizing |
| `columns` | `12` | Number of columns when not using breakpoints |
| `row-height` | `60` | Row height in px, or `auto` for square cells |
| `gap` | `12` | Space between widgets in px, or `[columns, rows]` |
| `min-column-width` | none | Fit as many columns as possible at this width, up to `columns` |
| `compact` | `vertical` | `vertical` floats widgets up, `horizontal` floats them left, `none` leaves them where dropped |
| `max-rows` | none | Nothing may extend below this many rows |
| `min-rows` | `1` | Minimum grid height, so an empty grid can still receive drops |
| `resize-handles` | `se` | `se`, `all`, `corners`, `edges`, `none`, or a list of `n s e w ne nw se sw` |
| `show-handles` | `auto` | When resize marks show: `always`, `hover`, or `auto` (hover with a mouse, always on touch) |
| `drag-handle` | none | CSS selector, widgets can only be dragged by a matching element |
| `drag-cancel` | none | CSS selector for elements that never start a drag |
| `remove-on-drop-outside` | `false` | Remove a widget dropped outside every grid, undoable |
| `size-to-content` | `false` | Size every widget to its content, a number caps the rows |
| `animation` | `smooth` | A preset, `true`, `false`, or `{ preset, duration, easing, enter, appear, stagger, leave, respectReducedMotion }`, see [Animation](features.md#animation) |
| `breakpoints` | off | `true` for 12, 6 and 1 columns at 1024, 640 and 0 px, or `{ name: { width, columns } }` |
| `breakpoint-layout` | `scale` | `scale` keeps proportions on narrow screens, `list` stacks widgets in reading order |
| `breakpoints-from` | `container` | Measure breakpoints against the grid width or the `window` |
| `collapsed-rows` | `1` | Height of a collapsed widget in rows |
| `history` | `true` | Keep an undo history |
| `history-limit` | `100` | Most undo steps kept |
| `shortcuts` | `true` | Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z (Cmd on Mac) |
| `auto-scroll` | `true` | Scroll the page or a scrolling parent while dragging near its edge |
| `group` | `default` | Grids in the same group can exchange widgets |
| `accept-drops` | `true` | Accept widgets from other grids or outside, or a function `(widget) => boolean` |
| `lazy` | `false` | Render content only once it scrolls near view, a number sets how many px early |
| `guides` | `true` | Show column guides while dragging or resizing |
| `show-cells` | `false` | Draw every grid cell behind the widgets, `true` always or `editing` only in edit mode |
| `keyboard` | `true` | Keyboard editing in edit mode, see [Keyboard editing](features.md#keyboard-editing) |
| `selectable` | `false` | Click, Shift+click and box selection, see [Multi select](features.md#multi-select) |
| `snap-guides` | `false` | Lines where a moving widget lines up with others |
| `widget-label` | none | `(widget) => string`, the name used in keyboard announcements, defaults to `props.title`, then `type`, then `id` |

## Events

| Event | Payload |
|---|---|
| `drag-start`, `drag-end`, `resize-start`, `resize-end` | The widget, at its final spot for the end events |
| `drag`, `resize` | `(widget, cell)` each time it reaches a new cell or size |
| `change` | `(widgets, { source })`, the widgets whose position, size or collapsed state changed. `source` is `user` for drags, resizes, keys, drops and method calls, and `auto` when the grid adjusted the layout itself, like sizing to content |
| `add` | A widget added by `addWidget` or a drop |
| `remove` | The removed widget |
| `drop` | `{ widget, from }`, where `from` is `grid` or `external` |
| `drag-out` | A widget that moved to another grid |
| `undo`, `redo` | None |
| `breakpoint-change` | The new breakpoint name |
| `widget-error` | `(widget, error)` when a widget crashes and shows its fallback |
| `selection-change` | The selected ids |

When a drag or resize ends, `update:modelValue` and `change` fire first, then `drag-end` or `resize-end`, all in the same tick. Your `v-model` array is already up to date inside an end handler, so there is no need for `nextTick`.

To save only what the user did, listen to `change` and skip `auto`:

```vue
<DashboardGrid v-model="widgets" @change="(_, { source }) => source === 'user' && save()" />
```

## Methods

Get them through a template ref:

```ts
import { useTemplateRef } from 'vue'
import type { DashboardGridApi } from 'custom-dashboard-grid'

const grid = useTemplateRef<DashboardGridApi>('grid')
```

| Method | Description |
|---|---|
| `addWidget(widget, { scrollIntoView? })` | Adds a widget, or a function that builds one, in the first free spot or at `x`, `y`. Generates an id if missing. Returns the widget, or `null` if there is no room |
| `removeWidget(id)` | Removes a widget |
| `removeWidgets(ids)` | Removes several widgets as one undo step |
| `select(ids, mode?)` | Select ids, `mode` is `replace` (default), `add` or `toggle` |
| `selectAll()`, `clearSelection()` | Select every widget or none |
| `selection` | Selected ids, reactive |
| `playEnter(ids?)` | Play the arrival animation again for some widgets or all of them |
| `updateWidget(id, patch)` | Change any fields, like `{ props }` or `{ w: 6 }` |
| `collapseWidget(id, collapsed?)` | Collapse, expand or toggle |
| `setPinMode(id, mode)` | `free`, `pinned`, `locked` or `no-resize`, undoable |
| `autoArrange({ keepOrder? })` | Pack everything into the tightest layout as one undo step |
| `resizeToContent(id?)` | Fit one widget or all of them to their content now |
| `willItFit(w, h)` | Whether a widget of that size fits anywhere |
| `isAreaEmpty({ x, y, w, h })` | Whether that area is inside the grid and empty |
| `cellFromPoint(clientX, clientY)` | The grid cell under a point on screen |
| `removeAll()` | Remove every widget as one undo step |
| `undo()`, `redo()`, `clearHistory()` | History control |
| `resetBreakpoint(name?)` | Forget positions arranged at a breakpoint so it is derived again |
| `canUndo`, `canRedo` | Reactive, so they can drive disabled buttons |
| `breakpoint`, `columns`, `rows` | Active breakpoint name, column count and rows in use |

## useWidget

Call it in any component rendered inside a widget.

| Returns | Description |
|---|---|
| `widget` | This widget, live while it moves and resizes |
| `interaction` | `drag`, `resize` or `null` |
| `editable` | Whether the dashboard is in edit mode |
| `collapsed` | Whether it is collapsed to its header |
| `selected` | Whether it is part of the selection |
| `remove()` | Remove it |
| `update(patch)` | Save fields into the dashboard, like `update({ minW: 2 })` |
| `updateProps(patch)` | Merge values into this widget's props, keeping the rest, like `updateProps({ text })` |
| `collapse(value?)` | Toggle, or pass `true` or `false` |
| `pinMode` | `free`, `pinned`, `locked` or `no-resize` |
| `setPinMode(mode)` | Change it, undoable |

## Slots

| Slot | Props | Use |
|---|---|---|
| default | `{ widget, interaction, editable, collapsed, selected, remove, update, updateProps, collapse, pinMode, setPinMode }` | Render widgets yourself instead of using `components` |
| `error` | `{ widget, error, retry }` | Replace the fallback shown when a widget crashes |

## Directives

| Directive | Use |
|---|---|
| `v-draggable-widget="widget"` | Drag a new widget out of any element. Pass a function to build a fresh one per drop. `v-draggable-widget:group` picks a group |
| `v-widget-trash` | Widgets dropped on the element are removed. `v-widget-trash:group` limits it to one group |

## Exports

| Export | What it is |
|---|---|
| `DashboardGrid` | The grid component |
| `useWidget` | Widget context, see above |
| `useDragState` | Reactive info about the current drag, see [Drag state](features.md#drag-state) |
| `useWidgetCatalog` | Search and grouping for a widget palette, see [Widget palettes](features.md#widget-palettes) |
| `vDraggableWidget`, `vWidgetTrash` | The directives |
| `useLayoutStorage`, `useSavedLayouts` | localStorage helpers, see [Saving and loading](features.md#saving-and-loading) |
| `serializeLayout` | Layout as a JSON string with a version, ready to store as is |
| `parseLayout`, `toSavedLayout` | Read a saved layout back, or get the `{ version, savedAt, widgets }` object, usable without Vue |
| `reconcileLayout(saved, current)` | Merge a saved layout with the widgets that exist now, see [Saving and loading](features.md#saving-and-loading) |
| `defineWidgets` | Type helper for widgets without `x` and `y` |
| `createWidgetId` | A unique id like `chart-lq3k9x-4` |
| `pinModeOf`, `PIN_MODES`, `PIN_MODE_OPTIONS` | Read a widget's pin mode, and ready made labels for a pin menu |
| `ANIMATION_PRESETS`, `ENTER_EFFECTS`, `DEFAULT_BREAKPOINTS` | Built in presets and arrival effects |
| `DashboardGridPlugin` | Optional plugin that registers the component and both directives globally, also the default export |

Types: `GridWidget`, `NewGridWidget`, `WidgetInput`, `WidgetSource`, `DashboardGridApi`, `WidgetContext`, `DragState`, `CatalogEntry`, `EnterEffect`, `DropEvent`, `PinMode`, `CompactMode`, `ResizeHandles` and the rest of the option types.
