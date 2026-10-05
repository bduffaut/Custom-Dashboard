<script setup lang="ts">
// On and off switch with a label and an optional hint underneath

const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; hint?: string; disabled?: boolean }>()
</script>

<template>
  <label class="toggle" :class="{ 'toggle--disabled': disabled }">
    <span class="toggle__text">
      <span class="toggle__label">{{ label }}</span>
      <span v-if="hint" class="toggle__hint">{{ hint }}</span>
    </span>
    <input v-model="model" type="checkbox" role="switch" class="toggle__input" :disabled="disabled" />
    <span class="toggle__track" aria-hidden="true">
      <span class="toggle__knob">
        <svg viewBox="0 0 12 12"><path d="M3 6.2 5 8.2 9 4" /></svg>
      </span>
    </span>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 6px 8px;
  margin: 0 -8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.toggle:hover {
  background: rgb(255 255 255 / 0.025);
}

.toggle--disabled {
  opacity: 0.4;
  cursor: default;
}

.toggle__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.toggle__label {
  font-size: 13px;
  color: var(--text);
}

.toggle__hint {
  font-size: 11.5px;
  color: var(--text-faint);
}

/* The real checkbox stays in place for keyboard and screen readers, drawn invisible */
.toggle__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.toggle__track {
  flex-shrink: 0;
  position: relative;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--bg-deep);
  border: 1px solid var(--border-strong);
  transition:
    background 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-faint);
  transition:
    translate 0.25s cubic-bezier(0.3, 1.4, 0.5, 1),
    background 0.2s,
    width 0.15s;
}

.toggle__knob svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: var(--bg);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 10;
  stroke-dashoffset: 10;
  transition: stroke-dashoffset 0.25s 0.05s;
}

/* A pressed knob stretches a little, like a physical switch */
.toggle:active:not(.toggle--disabled) .toggle__knob {
  width: 17px;
}

.toggle__input:checked + .toggle__track {
  background: rgb(45 212 191 / 0.18);
  border-color: var(--accent);
  box-shadow: 0 0 12px rgb(45 212 191 / 0.2);
}

.toggle__input:checked + .toggle__track .toggle__knob {
  translate: 14px 0;
  background: var(--accent);
}

.toggle:active:not(.toggle--disabled) .toggle__input:checked + .toggle__track .toggle__knob {
  translate: 11px 0;
}

.toggle__input:checked + .toggle__track .toggle__knob svg {
  stroke-dashoffset: 0;
}

.toggle__input:focus-visible + .toggle__track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
