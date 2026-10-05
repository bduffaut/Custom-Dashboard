import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/*
 * Dropdown open state, closes on an outside click or Escape
 * onOpen runs after the panel renders, for focusing a field
 */
export function usePopover(root: Ref<HTMLElement | undefined>, onOpen?: () => void) {
  const open = ref(false)

  function onOutside(event: PointerEvent) {
    if (!root.value?.contains(event.target as Node)) open.value = false
  }
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') open.value = false
  }

  watch(open, async (isOpen) => {
    if (isOpen) {
      await nextTick()
      document.addEventListener('pointerdown', onOutside)
      document.addEventListener('keydown', onKey)
      onOpen?.()
    } else {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  })
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onOutside)
    document.removeEventListener('keydown', onKey)
  })

  return open
}
