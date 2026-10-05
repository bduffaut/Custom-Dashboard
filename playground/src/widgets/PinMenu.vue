<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { PIN_MODE_OPTIONS, useWidget, type PinMode } from 'custom-dashboard-grid'
import { Check, Lock, Move, Pin, PinOff } from 'lucide-vue-next'

// Pin button for edit mode, teleported to body so the card does not clip the dropdown
// Modes come from useWidget pinMode and setPinMode, which are undoable

const { pinMode, setPinMode } = useWidget()

// Labels come from the library, the playground only adds an icon per mode
const ICONS: Record<PinMode, Component> = { free: PinOff, pinned: Pin, locked: Lock, 'no-resize': Move }

const current = computed(() => PIN_MODE_OPTIONS.find((o) => o.mode === pinMode.value) ?? PIN_MODE_OPTIONS[0]!)

const open = ref(false)
const button = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const position = ref({ top: 0, left: 0 })

const WIDTH = 270

function place() {
  const rect = button.value?.getBoundingClientRect()
  if (!rect) return
  const left = Math.min(Math.max(8, rect.right - WIDTH), window.innerWidth - WIDTH - 8)
  const below = rect.bottom + 6
  // Open upward when there is no room below
  const top = below + 230 > window.innerHeight ? Math.max(8, rect.top - 236) : below
  position.value = { top, left }
}

function toggle() {
  if (!open.value) place()
  open.value = !open.value
}

function choose(mode: PinMode) {
  setPinMode(mode)
  open.value = false
}

function onOutside(event: PointerEvent) {
  const target = event.target as Node
  if (!panel.value?.contains(target) && !button.value?.contains(target)) open.value = false
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}
const close = () => (open.value = false)

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
  } else {
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('scroll', close, true)
    window.removeEventListener('resize', close)
  }
})
onBeforeUnmount(() => (open.value = false))
</script>

<template>
  <button
    ref="button"
    class="pin-btn"
    :class="[`is-${pinMode}`, { 'is-open': open }]"
    :title="`${current.label}. Click to change.`"
    :aria-expanded="open"
    aria-haspopup="menu"
    @click="toggle"
  >
    <component :is="ICONS[current.mode]" :size="13" />
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      class="pin-menu"
      role="menu"
      :style="{ top: `${position.top}px`, left: `${position.left}px`, width: `${WIDTH}px` }"
    >
      <button
        v-for="option in PIN_MODE_OPTIONS"
        :key="option.mode"
        class="pin-menu__item"
        :class="{ 'is-current': option.mode === pinMode }"
        role="menuitemradio"
        :aria-checked="option.mode === pinMode"
        @click="choose(option.mode)"
      >
        <component :is="ICONS[option.mode]" :size="15" class="pin-menu__icon" />
        <span class="pin-menu__text">
          <span class="pin-menu__label">{{ option.label }}</span>
          <span class="pin-menu__hint">{{ option.description }}</span>
        </span>
        <Check v-if="option.mode === pinMode" :size="14" class="pin-menu__check" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.pin-btn {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-faint);
}

.pin-btn:hover,
.pin-btn.is-open {
  color: var(--text);
  background: var(--surface-3);
}

/* Highlight any mode other than free so pinned widgets stand out */
.pin-btn.is-pinned,
.pin-btn.is-locked,
.pin-btn.is-no-resize {
  color: var(--accent);
}

.pin-menu {
  position: fixed;
  z-index: 1000;
  padding: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  clip-path: polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, 0 100%);
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.55);
}

.pin-menu__item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  text-align: left;
}

.pin-menu__item:hover,
.pin-menu__item:focus-visible {
  background: var(--surface-3);
}

.pin-menu__icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--text-muted);
}

.pin-menu__item.is-current .pin-menu__icon {
  color: var(--accent);
}

.pin-menu__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pin-menu__label {
  font-size: 13px;
  font-weight: 600;
}

.pin-menu__hint {
  font-size: 12px;
  color: var(--text-muted);
}

.pin-menu__check {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--accent);
}
</style>
