<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import {
  DashboardGrid,
  useLayoutStorage,
  useSavedLayouts,
  type AnimationPreset,
  type AnimationSetting,
  type BreakpointLayout,
  type CompactMode,
  type DashboardGridApi,
  type EnterEffect,
  type GridWidget,
  type ResizeHandles,
} from 'custom-dashboard-grid'
import { Braces, Check, Copy, Pencil, Radar, X } from 'lucide-vue-next'
import CommandDock from './components/CommandDock.vue'
import GridOptionsMenu from './components/GridOptionsMenu.vue'
import PresetsMenu from './components/PresetsMenu.vue'
import SignalStrip from './components/SignalStrip.vue'
import WidgetLibrary from './components/WidgetLibrary.vue'
import { defaultLayout } from './data/defaultLayout'
import { catalog, SIZE_LIMITS, widgetComponents, type PaletteEntry } from './widgets/catalog'

// Playground for custom-dashboard-grid, it only uses what the package exports
//
// The whole integration:
//   - widgetComponents maps each widget type to a component (widgets/catalog.ts)
//   - widgets is a plain JSON array, loaded and saved by useLayoutStorage
//   - <DashboardGrid v-model=widgets :components=widgetComponents />
// Everything else here is optional features switched on with props

// Saved to localStorage automatically, versioned for future upgrades
const { widgets, reset } = useLayoutStorage('custom-dashboard:layout:v2', defaultLayout, { version: 1 })

// Named layouts the user can save and switch between
const presets = useSavedLayouts(widgets, { key: 'custom-dashboard:presets', version: 1 })

const grid = useTemplateRef<DashboardGridApi>('grid')
const editing = ref(false)
const compactMode = ref<CompactMode>('vertical')
const handles = ref<Extract<ResizeHandles, string>>('all')
const showHandles = ref<'auto' | 'always' | 'hover'>('auto')
const animation = ref<AnimationPreset>('smooth')
const arrival = ref<EnterEffect>('zip')
const cascade = ref(true)
const breakpointLayout = ref<BreakpointLayout>('scale')
const removeOutside = ref(false)
const keyboard = ref(true)
const selectable = ref(true)
const snapGuides = ref(true)

// Speed preset plus the arrival effect, cascading in reading order on load when turned on
const motion = computed<AnimationSetting>(() =>
  animation.value === 'none' ? 'none' : { preset: animation.value, enter: arrival.value, appear: cascade.value, stagger: cascade.value ? 55 : 0 },
)

// Names read out by keyboard announcements, taken from the catalog
function widgetLabel(widget: GridWidget): string {
  const metric = widget.props?.metric
  const entry = catalog.find((e) => e.widget.type === widget.type && (!metric || e.widget.props?.metric === metric))
  return entry?.name ?? widget.type ?? widget.id
}
const showJson = ref(false)
const copied = ref(false)

const DEVICE: Record<string, string> = { lg: 'Desktop', md: 'Tablet', sm: 'Phone' }
const device = computed(() => DEVICE[grid.value?.breakpoint ?? 'lg'] ?? 'Custom')
const columns = computed(() => grid.value?.columns ?? 12)

const json = computed(() => JSON.stringify(widgets.value, null, 2))

function add(entry: PaletteEntry) {
  grid.value?.addWidget(entry.widget, { scrollIntoView: true })
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(json.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // Clipboard blocked, the text is still selectable
  }
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <span class="brand__mark"><Radar :size="18" /></span>
      <span class="brand__text">
        <span class="brand__name">Sentinel</span>
        <span class="brand__sub">Security operations, demo data</span>
      </span>
    </div>

    <PresetsMenu :layouts="presets.layouts.value" @save="presets.save" @load="presets.load" @remove="presets.remove" />

    <SignalStrip class="topbar__signal" />

    <div class="topbar__end">
      <span class="readout" title="Active breakpoint. Resize the window to change it.">
        <span class="readout__device">{{ device }}</span>
        <span class="readout__cols">{{ columns }} {{ columns === 1 ? 'column' : 'columns' }}</span>
      </span>
      <button class="ghost" :class="{ 'is-on': showJson }" :aria-pressed="showJson" title="Show the layout as JSON" @click="showJson = !showJson">
        <Braces :size="15" /><span class="hide-sm">Layout data</span>
      </button>
      <button class="edit-toggle" :class="{ 'is-on': editing }" :aria-pressed="editing" @click="editing = !editing">
        <Check v-if="editing" :size="15" />
        <Pencil v-else :size="15" />
        {{ editing ? 'Done' : 'Edit layout' }}
      </button>
    </div>
  </header>

  <main class="page" :class="{ 'page--editing': editing, 'page--with-json': showJson }">
    <WidgetLibrary v-if="editing" class="page__library" :entries="catalog" @add="add" />

    <div class="page__board">
      <div class="board">
        <DashboardGrid
          ref="grid"
          v-model="widgets"
          :components="widgetComponents"
          :editable="editing"
          breakpoints
          lazy
          :guides="false"
          show-cells="editing"
          :row-height="52"
          :gap="12"
          :compact="compactMode"
          :resize-handles="handles"
          :show-handles="showHandles"
          :animation="motion"
          :breakpoint-layout="breakpointLayout"
          :remove-on-drop-outside="removeOutside"
          :keyboard="keyboard"
          :selectable="selectable"
          :snap-guides="snapGuides"
          :widget-label="widgetLabel"
          :size-limits="SIZE_LIMITS"
        />
      </div>
      <p class="hint">
        <template v-if="editing">
          Drag a card to move it and any edge or corner to resize. Shift+click or drag a box on empty space to select several. Tab to a
          card, then use the arrows to move it, Shift+arrows to resize and Delete to remove. Ctrl+Z undoes, Ctrl+Y redoes.
        </template>
        <template v-else>Resize the window to see the tablet and phone layouts. Collapse any card with its arrow.</template>
      </p>
    </div>

    <aside v-if="showJson" class="json" aria-label="Layout data">
      <header class="json__head">
        <h2>Layout data</h2>
        <span class="json__count">{{ widgets.length }} widgets</span>
        <button class="json__btn" :title="copied ? 'Copied' : 'Copy JSON'" :aria-label="copied ? 'Copied' : 'Copy JSON'" @click="copyJson">
          <Check v-if="copied" :size="14" />
          <Copy v-else :size="14" />
        </button>
        <button class="json__btn" title="Close" aria-label="Close layout data" @click="showJson = false"><X :size="14" /></button>
      </header>
      <pre class="mono">{{ json }}</pre>
    </aside>
  </main>

  <CommandDock v-if="editing" :grid="grid" :entries="catalog" @add="add" @reset="reset" @done="editing = false">
    <template #options>
      <GridOptionsMenu
        v-model:compact="compactMode"
        v-model:handles="handles"
        v-model:show-handles="showHandles"
        v-model:animation="animation"
        v-model:arrival="arrival"
        v-model:cascade="cascade"
        v-model:breakpoint-layout="breakpointLayout"
        v-model:remove-outside="removeOutside"
        v-model:keyboard="keyboard"
        v-model:selectable="selectable"
        v-model:snap-guides="snapGuides"
        placement="up"
        @replay="grid?.playEnter()"
      />
    </template>
  </CommandDock>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px 16px;
  min-height: 60px;
  padding: 8px 20px;
  background: rgb(10 14 20 / 0.86);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

/* Teal hairline fading out along the bottom edge */
.topbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(to right, var(--accent), transparent 40%);
  opacity: 0.5;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: 4px;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid rgb(45 212 191 / 0.35);
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%);
}

.brand__mark svg {
  transition: transform 0.2s;
}

/* The radar sweeps once when the brand is hovered */
.brand:hover .brand__mark svg {
  animation: sweep 1.1s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes sweep {
  to {
    transform: rotate(360deg);
  }
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand__name {
  font-family: var(--display);
  font-weight: 700;
  font-size: 19px;
  letter-spacing: 0.04em;
}

.brand__sub {
  font-size: 11.5px;
  color: var(--text-faint);
}

.topbar__signal {
  margin-left: 4px;
}

.topbar__end {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.readout {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: 6px;
  line-height: 1.2;
}

.readout__device {
  font-family: var(--display);
  font-weight: 600;
  font-size: 13px;
}

.readout__cols {
  font-size: 11.5px;
  color: var(--text-faint);
}

.topbar button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.ghost {
  border-color: transparent;
  background: none;
  color: var(--text-muted);
}

.ghost.is-on {
  color: var(--accent);
  background: var(--accent-soft);
}

.edit-toggle {
  position: relative;
  overflow: hidden;
  font-weight: 600;
  background: var(--accent);
  border-color: transparent;
  color: #04201c;
}

.edit-toggle:hover:not(:disabled) {
  background: var(--accent-strong);
  border-color: transparent;
}

/* A light sheen passes over the button on hover */
.edit-toggle::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.35) 50%, transparent 65%);
  transform: translateX(-120%);
  pointer-events: none;
}

.edit-toggle:hover::after {
  transform: translateX(120%);
  transition: transform 0.7s ease;
}

.edit-toggle.is-on {
  background: var(--accent-soft);
  color: var(--accent);
}

.edit-toggle.is-on:hover:not(:disabled) {
  background: rgb(45 212 191 / 0.2);
}

.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  padding: 20px;
}

/* Room for the dock so it never hides the last row */
.page--editing {
  grid-template-columns: 252px minmax(0, 1fr);
  padding-bottom: 100px;
}

.page--with-json {
  grid-template-columns: minmax(0, 1fr) 340px;
}

.page--editing.page--with-json {
  grid-template-columns: 252px minmax(0, 1fr) 340px;
}

/* Clip the scan sweep and anything that strays past the board */
.board {
  position: relative;
  overflow: clip;
  overflow-clip-margin: 16px;
}

.hint {
  margin: 24px 0 8px;
  font-size: 12.5px;
  color: var(--text-faint);
  text-align: center;
}

.json {
  position: sticky;
  top: 80px;
  align-self: start;
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  clip-path: polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, 0 100%);
  animation: json-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes json-in {
  from {
    opacity: 0;
    translate: 16px 0;
  }
}

.json__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 8px 14px;
  border-bottom: 1px solid var(--border);
}

.json__head h2 {
  margin: 0;
  font-size: 14px;
}

.json__count {
  margin-right: auto;
  font-size: 12px;
  color: var(--text-faint);
}

.json__btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-faint);
}

.json__btn:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-3);
}

.json pre {
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}

@media (max-width: 1100px) {
  .topbar__signal {
    display: none;
  }
}

@media (max-width: 900px) {
  .page,
  .page--editing,
  .page--with-json,
  .page--editing.page--with-json {
    grid-template-columns: minmax(0, 1fr);
  }
  /* On narrow screens the dock add button replaces the drawer */
  .page__library {
    display: none;
  }
  .json {
    position: static;
    max-height: 400px;
  }
}

@media (max-width: 640px) {
  .topbar {
    padding: 8px 16px;
    gap: 10px;
  }
  .page {
    padding: 16px;
  }
  .brand__sub,
  .readout,
  .hide-sm {
    display: none;
  }
}
</style>
