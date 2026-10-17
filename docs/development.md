# Development

## Commands

Run everything from the repo root.

```sh
npm install        # once, or after dependencies change
npm run dev        # library in watch mode plus the demo at http://localhost:5173
npm test           # library tests in watch mode
npm run test:run   # library tests once
npm run typecheck  # type check the library and the demo
npm run build      # production build of the library, then the demo
```

Avoid running `npm run build` while `npm run dev` is running. The build clears the library's `dist` folder, which breaks the running demo until the next rebuild.

## Repo layout

```
packages/dashboard-grid/       the library, published as custom-dashboard-grid
  src/
    index.ts                   public API, the only things consumers can import
    core/                      layout engine, pure TypeScript with no DOM or Vue
    vue/
      DashboardGrid.vue        the one public component
      GridItem.vue             internal, one per widget
      context.ts               provide and inject plumbing, plus useWidget
      dnd.ts, trash.ts         drag between grids, drag in from outside, trash zones
      dragState.ts             useDragState, shared drag info for the page
      catalog.ts               useWidgetCatalog, search and grouping for palettes
      storage.ts               useLayoutStorage and useSavedLayouts
  dist/                        build output, what gets published
  README.md                    shipped with the package on npm

playground/                    the demo, a stand in for someone else's app
  src/App.vue                  uses the library exactly like a consumer would
  src/components/              header, dock, drawer and menus
  src/widgets/                 example widgets
  src/data/                    simulated security data and the starting layout

docs/                          these docs
```

## How the demo uses the library

npm workspaces links `packages/dashboard-grid` into `node_modules/custom-dashboard-grid`. The demo imports it by package name and gets the built `dist` through the package's `exports`, exactly like an installed copy:

```ts
import { DashboardGrid } from 'custom-dashboard-grid'
import 'custom-dashboard-grid/style.css'
```

So if something works in the demo, it works for real consumers. A missing export, CSS file or type breaks the demo the same way it would break someone else's app.

## Rules for every change

- Consumer simplicity first. A consumer should only need widgets, options and `v-model`, anything else belongs inside the library
- The demo only imports from `custom-dashboard-grid`, never relative paths or aliases into `packages/`
- Keep the public API small. Every export, prop and CSS class is something users will depend on
- New behavior goes in `core/` first with a test, then gets wired into the Vue layer
- Update these docs when a prop, event, field or export changes
- Comments use `//` or `/* */`, stay short, and have no trailing periods, quotes or em dashes

## Tests

Tests live next to the code as `*.test.ts` and run with Vitest in jsdom. jsdom has no layout, so the Vue tests pretend every grid is 1200px wide.

- `core/*.test.ts` cover the pure engine: collisions, compaction, moves, resizes, history and responsive layouts
- `vue/*.test.ts` mount real grids and simulate pointer events for dragging, resizing, nesting and drops

## Before publishing

- The GitHub repo must be public, the package README links to the docs there
- Bump `version` in `packages/dashboard-grid/package.json`, or run `npm version patch -w custom-dashboard-grid`
- `npm pack --dry-run -w custom-dashboard-grid` to see exactly which files will ship
- `npm publish -w custom-dashboard-grid`, which runs the tests and a fresh build first through `prepublishOnly`

## Ideas

- Keyboard moving and resizing with screen reader announcements
- Multi-select to move several widgets together
- Maximize a widget to fill the screen temporarily
- Hooks that can veto or adjust a move
- Built in light and dark theme presets
- Ports to other frameworks, the core engine already has no Vue in it
