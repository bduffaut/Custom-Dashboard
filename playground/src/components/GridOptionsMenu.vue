<script setup lang="ts">
import { ref } from 'vue'
import { ENTER_EFFECTS, type AnimationPreset, type BreakpointLayout, type CompactMode, type EnterEffect, type ResizeHandles } from 'custom-dashboard-grid'
import { Play, SlidersHorizontal } from 'lucide-vue-next'
import { usePopover } from '../composables/usePopover'
import SegmentedControl from './SegmentedControl.vue'
import ToggleSwitch from './ToggleSwitch.vue'

// Grid options, each one a plain DashboardGrid prop, grouped by what they change

const compactMode = defineModel<CompactMode>('compact', { required: true })
const handles = defineModel<Extract<ResizeHandles, string>>('handles', { required: true })
const showHandles = defineModel<'auto' | 'always' | 'hover'>('showHandles', { required: true })
const animation = defineModel<AnimationPreset>('animation', { required: true })
const arrival = defineModel<EnterEffect>('arrival', { required: true })
const cascade = defineModel<boolean>('cascade', { required: true })
const breakpointLayout = defineModel<BreakpointLayout>('breakpointLayout', { required: true })
const removeOutside = defineModel<boolean>('removeOutside', { required: true })
const keyboard = defineModel<boolean>('keyboard', { required: true })
const selectable = defineModel<boolean>('selectable', { required: true })
const snapGuides = defineModel<boolean>('snapGuides', { required: true })

withDefaults(defineProps<{ placement?: 'up' | 'down' }>(), { placement: 'up' })
const emit = defineEmits<{ replay: [] }>()

const root = ref<HTMLElement>()
const open = usePopover(root)

const GRAVITY: { value: CompactMode; label: string }[] = [
  { value: 'vertical', label: 'Float up' },
  { value: 'horizontal', label: 'Float left' },
  { value: 'none', label: 'Off' },
]
const HANDLES: { value: Extract<ResizeHandles, string>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'corners', label: 'Corners' },
  { value: 'edges', label: 'Edges' },
  { value: 'se', label: 'One' },
]
const MARKS: { value: 'auto' | 'hover' | 'always'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hover', label: 'Hover' },
  { value: 'always', label: 'Always' },
]
const SCREENS: { value: BreakpointLayout; label: string }[] = [
  { value: 'scale', label: 'Scale' },
  { value: 'list', label: 'Stack' },
]
const SPEEDS: { value: AnimationPreset; label: string }[] = [
  { value: 'snappy', label: 'Snappy' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'bouncy', label: 'Bouncy' },
  { value: 'none', label: 'Off' },
]
const ARRIVAL_LABELS: Record<EnterEffect, string> = {
  zip: 'Zip up from below',
  rise: 'Rise',
  drop: 'Drop',
  scale: 'Scale',
  zoom: 'Zoom',
  flip: 'Flip',
  fade: 'Fade',
}
</script>

<template>
  <div ref="root" class="options">
    <button class="options__trigger" :class="{ 'is-on': open }" :aria-expanded="open" title="Grid options" @click="open = !open">
      <SlidersHorizontal :size="15" /><span class="dock-label">Options</span>
    </button>
    <div
      v-if="open"
      class="popover options__panel"
      :class="placement === 'up' ? 'popover--up popover--center' : 'popover--down popover--right'"
      role="dialog"
      aria-label="Grid options"
    >
      <section>
        <h3>Layout</h3>
        <div class="field">
          <span class="field__label">Gravity</span>
          <SegmentedControl v-model="compactMode" :options="GRAVITY" label="Gravity" />
        </div>
        <div class="field">
          <span class="field__label">Resize from</span>
          <SegmentedControl v-model="handles" :options="HANDLES" label="Resize from" />
        </div>
        <div class="pair">
          <div class="field">
            <span class="field__label">Handle marks</span>
            <SegmentedControl v-model="showHandles" :options="MARKS" label="Handle marks" />
          </div>
          <div class="field">
            <span class="field__label">Small screens</span>
            <SegmentedControl v-model="breakpointLayout" :options="SCREENS" label="Small screens" />
          </div>
        </div>
        <ToggleSwitch v-model="removeOutside" label="Drop outside to remove" hint="Let go of a widget off the grid to delete it" />
      </section>

      <section>
        <h3>Motion</h3>
        <div class="field">
          <span class="field__label">Speed</span>
          <SegmentedControl v-model="animation" :options="SPEEDS" label="Speed" />
        </div>
        <div class="field field--row">
          <span class="field__label">Arrival</span>
          <select v-model="arrival" :disabled="animation === 'none'">
            <option v-for="effect in ENTER_EFFECTS" :key="effect" :value="effect">{{ ARRIVAL_LABELS[effect] }}</option>
          </select>
        </div>
        <ToggleSwitch v-model="cascade" label="Cascade on load" hint="Widgets arrive one after another" :disabled="animation === 'none'" />
        <button class="replay" :disabled="animation === 'none'" @click="emit('replay')">
          <Play :size="12" /> Replay arrival
        </button>
      </section>

      <section>
        <h3>Editing</h3>
        <ToggleSwitch v-model="keyboard" label="Keyboard editing" hint="Arrows move, Shift+arrows resize, Delete removes" />
        <ToggleSwitch v-model="selectable" label="Multi select" hint="Shift+click, or drag a box on empty space" />
        <ToggleSwitch v-model="snapGuides" label="Snap guides" hint="Lines where edges line up while dragging" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.options {
  position: relative;
}

.options__trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.options__panel {
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 110px);
  overflow-y: auto;
  padding: 2px 16px 12px;
  animation: panel-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
}

section + section {
  border-top: 1px solid var(--border);
}

h3 {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.field__label {
  font-size: 12px;
  color: var(--text-faint);
}

.pair {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 10px;
}

.field select {
  width: 190px;
}

.replay {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-color: transparent;
}

.replay:hover:not(:disabled) {
  background: rgb(45 212 191 / 0.2);
  border-color: transparent;
}

.replay svg {
  transition: transform 0.2s;
}

.replay:hover:not(:disabled) svg {
  transform: translateX(2px) scale(1.15);
}
</style>
