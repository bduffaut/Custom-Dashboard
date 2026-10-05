import type { LayoutItem } from '../core'

/*
 * One widget: where it sits in grid units and what to render in it
 * Keep it plain JSON so it can be saved anywhere
 */
export interface GridWidget extends LayoutItem {
  /* Which entry of the components prop renders this widget */
  type?: string
  /* Props passed to that component */
  props?: Record<string, unknown>
}

/* A widget to add, id, x and y are optional */
export type NewGridWidget<T extends GridWidget = GridWidget> = Omit<T, 'id' | 'x' | 'y'> & Partial<Pick<T, 'id' | 'x' | 'y'>>

/* A widget in a starting layout, without x and y it goes in the first free spot */
export type WidgetInput<T extends GridWidget = GridWidget> = Omit<T, 'x' | 'y'> & Partial<Pick<T, 'x' | 'y'>>

/*
 * Type helper for starting layouts where some widgets have no x and y
 * Those are placed in the first free spots, the array is returned as is
 */
export function defineWidgets<T extends GridWidget = GridWidget>(widgets: WidgetInput<T>[]): T[] {
  return widgets as T[]
}

export type InteractionKind = 'drag' | 'resize'

/* Where a dropped widget came from */
export type DropSource = 'grid' | 'external'

export interface DropEvent<T extends GridWidget = GridWidget> {
  widget: T
  from: DropSource
}
