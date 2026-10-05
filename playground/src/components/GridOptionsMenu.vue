<script setup lang="ts">
import { ref } from 'vue'
import type { AnimationPreset, BreakpointLayout, CompactMode, ResizeHandles } from 'custom-dashboard-grid'
import { SlidersHorizontal } from 'lucide-vue-next'
import { usePopover } from '../composables/usePopover'

// Grid options, each one a plain DashboardGrid prop

const compactMode = defineModel<CompactMode>('compact', { required: true })
const handles = defineModel<ResizeHandles>('handles', { required: true })
const showHandles = defineModel<'auto' | 'always' | 'hover'>('showHandles', { required: true })
const animation = defineModel<AnimationPreset>('animation', { required: true })
const breakpointLayout = defineModel<BreakpointLayout>('breakpointLayout', { required: true })
const removeOutside = defineModel<boolean>('removeOutside', { required: true })

withDefaults(defineProps<{ placement?: 'up' | 'down' }>(), { placement: 'up' })

const root = ref<HTMLElement>()
const open = usePopover(root)

const GRAVITY: { value: CompactMode; label: string }[] = [
  { value: 'vertical', label: 'Up' },
  { value: 'horizontal', label: 'Left' },
  { value: 'none', label: 'Off' },
]
const HANDLES: { value: Extract<ResizeHandles, string>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'corners', label: 'Corners' },
  { value: 'edges', label: 'Edges' },
  { value: 'se', label: 'One' },
]
const ANIMATIONS: AnimationPreset[] = ['smooth', 'snappy', 'gentle', 'bouncy', 'none']
</script>

<template>
  <div ref="root" class="options">
    <button class="options__trigger" :class="{ 'is-on': open }" :aria-expanded="open" title="Grid options" @click="open = !open">
      <SlidersHorizontal :size="15" /><span class="dock-label">Options</span>
    </button>
    <div v-if="open" class="popover options__panel" :class="placement === 'up' ? 'popover--up popover--center' : 'popover--down popover--right'" role="dialog" aria-label="Grid options">
      <div class="field">
        <span class="field__label">Gravity</span>
        <div class="seg" role="radiogroup" aria-label="Gravity">
          <button v-for="o in GRAVITY" :key="o.value" role="radio" :aria-checked="compactMode === o.value" :class="{ 'is-on': compactMode === o.value }" @click="compactMode = o.value">
            {{ o.label }}
          </button>
        </div>
      </div>
      <div class="field">
        <span class="field__label">Resize from</span>
        <div class="seg" role="radiogroup" aria-label="Resize from">
          <button v-for="o in HANDLES" :key="o.value" role="radio" :aria-checked="handles === o.value" :class="{ 'is-on': handles === o.value }" @click="handles = o.value">
            {{ o.label }}
          </button>
        </div>
      </div>
      <label class="field">
        <span class="field__label">Handle marks</span>
        <select v-model="showHandles">
          <option value="auto">Auto</option>
          <option value="hover">On hover</option>
          <option value="always">Always</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Motion</span>
        <select v-model="animation">
          <option v-for="a in ANIMATIONS" :key="a" :value="a">{{ a[0]!.toUpperCase() + a.slice(1) }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Small screens</span>
        <select v-model="breakpointLayout">
          <option value="scale">Scale the layout</option>
          <option value="list">Stack in reading order</option>
        </select>
      </label>
      <label class="check">
        <input v-model="removeOutside" type="checkbox" />
        <span>Remove widgets dropped outside the grid</span>
      </label>
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
  width: 320px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.field__label {
  font-size: 13px;
  color: var(--text-muted);
}

.field select {
  width: 180px;
}

.seg {
  display: flex;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
}

.seg button {
  padding: 3px 10px;
  border: none;
  background: none;
  font-size: 12.5px;
  color: var(--text-muted);
}

.seg button:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text);
}

.seg button.is-on {
  background: var(--accent-soft);
  color: var(--accent);
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-muted);
}

.check input {
  accent-color: var(--accent);
}
</style>
