# Custom Dashboard

A drag and drop dashboard grid for Vue 3, built from scratch as an npm library (`custom-dashboard-grid`), plus a demo app that shows it off.

You give it a list of widgets and a component for each type. It handles dragging, resizing, collisions, responsive layouts, undo and saving.

## Run the demo

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173 and click **Edit layout** to start moving things around.

`npm run dev` builds the library, watches it for changes and starts the demo, so edits to either show up in the browser right away.

## Features

- Drag and resize widgets, from any side or corner
- Widgets float up to fill gaps, float left, or stay where dropped
- Undo and redo, with Ctrl+Z and Ctrl+Y
- Keyboard editing with screen reader announcements
- Multi select with Shift+click or a selection box, then move or remove widgets together
- Snap guides that show where edges line up
- Edit mode and view mode
- Responsive layouts for desktop, tablet and phone
- Drag widgets between grids, into grids nested inside widgets, and in from a sidebar
- Trash zones and drop outside to remove
- Pin modes: pinned, locked and resize locked
- Auto-arrange into the tightest layout
- Headless helpers for add menus, pin menus and drag aware toolbars, plus a grid cell overlay
- Widgets that size to their content, collapse to their header or render lazily
- Save to localStorage, named layout presets and versioned JSON with migrations
- Animation presets and arrival effects (fade, scale, rise, drop, zoom, flip, zip up from below) with a cascade on load, all respecting reduced motion
- Auto-scroll while dragging near an edge
- Crash-safe widgets and self-repairing layout data
- Vue is the only dependency, about 24 kB gzipped

## Using it

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DashboardGrid } from 'custom-dashboard-grid'
import 'custom-dashboard-grid/style.css'
import SalesChart from './SalesChart.vue'

const widgets = ref([{ id: 'sales', type: 'chart', x: 0, y: 0, w: 6, h: 4 }])
</script>

<template>
  <DashboardGrid v-model="widgets" :components="{ chart: SalesChart }" />
</template>
```

## Docs

- [Getting started](docs/getting-started.md)
- [API reference](docs/api.md): props, events, methods and `useWidget`
- [Features](docs/features.md): responsive layouts, drag and drop, nested grids, saving and more
- [Reliability and limits](docs/reliability.md)
- [Development](docs/development.md): repo layout, commands and publishing

## Project layout

```
packages/dashboard-grid/   the library
playground/                the demo app, uses the library like any outside project
docs/                      documentation
```
