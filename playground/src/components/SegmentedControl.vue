<script setup lang="ts" generic="V extends string">
import { nextTick, onMounted, ref, watch } from 'vue'

// Radio group drawn as one bar with a highlight that slides to the chosen option

const model = defineModel<V>({ required: true })
defineProps<{ options: { value: V; label: string }[]; label: string }>()

const root = ref<HTMLElement>()
const thumb = ref({ x: 0, w: 0, ready: false })

function place() {
  const active = root.value?.querySelector<HTMLElement>('[aria-checked="true"]')
  if (!active) return
  thumb.value = { x: active.offsetLeft, w: active.offsetWidth, ready: thumb.value.ready || thumb.value.w > 0 }
}

onMounted(() => nextTick(place))
watch(model, () => nextTick(place))

// Arrow keys move the choice like a native radio group
function onKey(event: KeyboardEvent, options: { value: V }[]) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const index = options.findIndex((o) => o.value === model.value)
  const next = options[(index + step + options.length) % options.length]!
  model.value = next.value
  nextTick(() => root.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
}
</script>

<template>
  <div ref="root" class="seg" role="radiogroup" :aria-label="label" @keydown="onKey($event, options)">
    <span
      class="seg__thumb"
      :class="{ 'seg__thumb--ready': thumb.ready }"
      :style="{ width: `${thumb.w}px`, transform: `translateX(${thumb.x}px)` }"
      aria-hidden="true"
    />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="seg__option"
      :aria-checked="model === option.value"
      :tabindex="model === option.value ? 0 : -1"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  position: relative;
  display: flex;
  padding: 3px;
  border-radius: 7px;
  background: var(--bg-deep);
  border: 1px solid var(--border);
}

.seg__thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  border-radius: 5px;
  background: var(--surface-3);
  border: 1px solid rgb(45 212 191 / 0.45);
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.3),
    0 0 14px rgb(45 212 191 / 0.15);
}

/* No slide on first paint, only when the choice changes */
.seg__thumb--ready {
  transition:
    transform 0.28s cubic-bezier(0.3, 1.3, 0.5, 1),
    width 0.28s cubic-bezier(0.3, 1.3, 0.5, 1);
}

.seg__option {
  position: relative;
  flex: 1;
  padding: 5px 8px;
  border: none;
  border-radius: 5px;
  background: none;
  font-size: 12.5px;
  white-space: nowrap;
  color: var(--text-faint);
  transition: color 0.2s;
}

.seg__option:hover:not(:disabled) {
  background: none;
  color: var(--text);
}

.seg__option[aria-checked='true'] {
  color: var(--accent-strong);
}

.seg__option:focus-visible {
  outline-offset: -2px;
}
</style>
