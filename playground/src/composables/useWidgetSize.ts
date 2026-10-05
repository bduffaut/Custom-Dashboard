import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useWidget } from 'custom-dashboard-grid'
import { useElementSize } from './useElementSize'

/*
 * Pixel size of a widget body, for showing more as it grows
 * Measured rather than counted in cells, so the same widget fits any row height or nested grid
 * Until the first measurement it estimates from the cell count so the first paint already fits
 */
export function useWidgetBox(target: Ref<HTMLElement | undefined>) {
  const { widget } = useWidget()
  const { width, height } = useElementSize(target)
  return {
    width: computed(() => width.value || widget.value.w * 110),
    height: computed(() => height.value || Math.max(0, widget.value.h * 64 - 62)),
  }
}

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* A number that glides to each new value instead of jumping, so live counters feel continuous */
export function useTween(source: () => number, duration = 450) {
  const value = ref(source())
  let frame = 0
  watch(source, (to) => {
    cancelAnimationFrame(frame)
    if (reduced) {
      value.value = to
      return
    }
    const from = value.value
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      value.value = from + (to - from) * (1 - (1 - t) ** 3)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  })
  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return value
}
