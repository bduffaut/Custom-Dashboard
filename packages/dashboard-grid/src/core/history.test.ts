import { describe, expect, it } from 'vitest'
import { LayoutHistory, restoreLayout } from './history'
import type { LayoutItem } from './types'

type Item = LayoutItem & { props?: { value: number } }

const a = (x: number, value = 1): Item => ({ id: 'a', x, y: 0, w: 2, h: 2, props: { value } })
const b: Item = { id: 'b', x: 6, y: 0, w: 2, h: 2 }

describe('restoreLayout', () => {
  it('restores positions but keeps the latest props', () => {
    expect(restoreLayout([a(0, 1)], [a(4, 99)])).toEqual([a(0, 99)])
  })

  it('brings back removed items and drops added ones', () => {
    expect(restoreLayout([a(0), b], [a(0)])).toEqual([a(0), b])
    expect(restoreLayout([a(0)], [a(0), b])).toEqual([a(0)])
  })
})

describe('LayoutHistory', () => {
  it('undoes and redoes a change', () => {
    const history = new LayoutHistory<Item>()
    history.record([a(0)], [a(4)])
    expect(history.canUndo).toBe(true)

    expect(history.undo([a(4)])).toEqual([a(0)])
    expect(history.canRedo).toBe(true)
    expect(history.redo([a(0)])).toEqual([a(4)])
  })

  it('ignores changes that do not move, resize, add or remove anything', () => {
    const history = new LayoutHistory<Item>()
    history.record([a(0, 1)], [a(0, 2)])
    expect(history.canUndo).toBe(false)
  })

  it('clears redo when a new change is recorded', () => {
    const history = new LayoutHistory<Item>()
    history.record([a(0)], [a(4)])
    history.undo([a(4)])
    history.record([a(0)], [a(8)])
    expect(history.canRedo).toBe(false)
  })

  it('returns null when there is nothing to undo or redo', () => {
    const history = new LayoutHistory<Item>()
    expect(history.undo([a(0)])).toBeNull()
    expect(history.redo([a(0)])).toBeNull()
  })

  it('skips steps that would not change anything on screen', () => {
    const history = new LayoutHistory<Item>()
    history.record([a(0)], [a(4)])
    history.record([a(4)], [a(8)])
    // Current layout already matches the newest snapshot, so undo jumps to the older one
    expect(history.undo([a(4)])).toEqual([a(0)])
  })

  it('keeps at most limit steps', () => {
    const history = new LayoutHistory<Item>(2)
    history.record([a(0)], [a(1)])
    history.record([a(1)], [a(2)])
    history.record([a(2)], [a(3)])
    expect(history.undo([a(3)])).toEqual([a(2)])
    expect(history.undo([a(2)])).toEqual([a(1)])
    expect(history.undo([a(1)])).toBeNull()
  })
})
