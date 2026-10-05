<script setup lang="ts">
import { onErrorCaptured, ref, shallowRef } from 'vue'

// Internal error boundary around each widget's content
// Errors in render, hooks or handlers show a retry fallback instead of breaking the page

const emit = defineEmits<{ error: [error: unknown] }>()

const failed = ref(false)
const error = shallowRef<unknown>(null)
const attempt = ref(0)

onErrorCaptured((err) => {
  error.value = err
  failed.value = true
  emit('error', err)
  return false
})

function retry() {
  failed.value = false
  error.value = null
  attempt.value++
}
</script>

<template>
  <div v-if="!failed" :key="attempt" class="dg-content"><slot /></div>
  <div v-else class="dg-content">
    <slot name="fallback" :error="error" :retry="retry" />
  </div>
</template>
