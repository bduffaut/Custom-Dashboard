<script setup lang="ts">
import { computed } from 'vue'

// How much of the 12 columns a widget takes, drawn as a tiny grid

const props = withDefaults(defineProps<{ w: number; h: number; columns?: number }>(), { columns: 12 })

const CELL = 4
const GAP = 1
// Cap tall widgets so every glyph has the same height
const rows = computed(() => Math.min(props.h, 6))
const width = computed(() => props.columns * (CELL + GAP) - GAP)
const height = computed(() => rows.value * (CELL + GAP) - GAP)
</script>

<template>
  <svg class="footprint" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`${w} by ${h} cells`">
    <template v-for="r in rows" :key="r">
      <rect
        v-for="c in columns"
        :key="c"
        :x="(c - 1) * (CELL + GAP)"
        :y="(r - 1) * (CELL + GAP)"
        :width="CELL"
        :height="CELL"
        :class="c <= w ? 'on' : 'off'"
        :style="{ '--i': c + r }"
      />
    </template>
  </svg>
</template>

<style scoped>
.footprint {
  display: block;
  flex-shrink: 0;
}

.on {
  fill: var(--accent);
  opacity: 0.6;
}

.off {
  fill: var(--surface-3);
}

/* Cells change one diagonal at a time, so a parent hover sweeps across the glyph */
rect {
  transition:
    fill 0.25s,
    opacity 0.25s;
  transition-delay: calc(var(--i) * 14ms);
}

</style>
