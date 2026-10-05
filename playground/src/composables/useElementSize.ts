import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/* Live width and height of an element, for charts that fit their widget */
export function useElementSize(target: Ref<HTMLElement | undefined>) {
  const width = ref(0)
  const height = ref(0)
  let observer: ResizeObserver | undefined

  onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      width.value = entry.contentRect.width
      height.value = entry.contentRect.height
    })
    if (target.value) observer.observe(target.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { width, height }
}
