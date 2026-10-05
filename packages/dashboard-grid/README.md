# custom-dashboard-grid

A draggable, resizable dashboard grid for Vue 3. You describe the widgets, it handles dragging, resizing, collisions, responsive layouts, undo, drag and drop between grids, and saving.

- Vue is the only dependency, about 24 kB gzipped
- One `v-model` array of plain JSON, so saving a dashboard is saving an array
- Bad input is cleaned, a crashing widget cannot take down the page, and Escape cancels any drag

## Install

```sh
npm install custom-dashboard-grid
```

## Quick start

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

- Widgets are plain objects with a position and size in grid units, a `type` and optional `props`
- `components` maps each `type` to the component that renders it
- `v-model` keeps your array up to date

## Docs

- [Getting started](../../docs/getting-started.md)
- [API reference](../../docs/api.md)
- [Features](../../docs/features.md)
- [Reliability and limits](../../docs/reliability.md)
