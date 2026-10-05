import { reactive, readonly } from 'vue'
import { armTrash } from './trash'
import type { GridWidget } from './types'

// One shared record of what is being dragged on the page, for any UI that reacts to it
// The same info is mirrored onto html as classes and a data attribute for pure CSS styling

/* drag moves a widget, resize resizes one, external brings a new one in from outside */
export type DragKind = 'drag' | 'resize' | 'external'

export interface DragState {
  /* What is happening right now, or null when nothing is being dragged */
  kind: DragKind | null
  /* Grid group of the drag */
  group: string | null
  /* The widget being dragged or resized, the one under the pointer for a group */
  widget: GridWidget | null
  /* How many widgets are moving, more than 1 for a selected group */
  count: number
  /* True while a dragged widget is held over a trash zone */
  overTrash: boolean
}

const state = reactive<DragState>({ kind: null, group: null, widget: null, count: 0, overTrash: false })

/* Internal, called when a drag, resize or external drag starts */
export function startDragState(kind: DragKind, group: string, widget: GridWidget | null, count = 1): void {
  state.kind = kind
  state.group = group
  state.widget = widget
  state.count = count
  state.overTrash = false
  const html = document.documentElement
  html.classList.add('dg-dragging')
  if (kind === 'external') html.classList.add('dg-external-dragging')
  html.dataset.dgInteraction = kind
  // Only a single existing widget being moved can be dropped on a trash zone
  if (kind === 'drag' && count === 1) armTrash(group)
}

/* Internal, called when it ends for any reason */
export function endDragState(): void {
  state.kind = null
  state.group = null
  state.widget = null
  state.count = 0
  state.overTrash = false
  const html = document.documentElement
  html.classList.remove('dg-dragging', 'dg-external-dragging')
  delete html.dataset.dgInteraction
  armTrash(null)
}

/* Internal, kept in sync by the trash zones */
export function setOverTrash(value: boolean): void {
  state.overTrash = value
}

/*
 * Reactive, read only drag info for the whole page
 * Use it to show a trash zone or change a toolbar while something is dragged
 */
export function useDragState(): Readonly<DragState> {
  return readonly(state) as Readonly<DragState>
}
