import { describe, expect, it } from 'vitest'
import { autoScrollVelocity } from './geometry'

const screen = { top: 0, left: 0, right: 1000, bottom: 800 }

describe('autoScrollVelocity', () => {
  it('does nothing away from the edges', () => {
    expect(autoScrollVelocity({ x: 500, y: 400 }, screen, 60, 20)).toEqual({ x: 0, y: 0 })
  })

  it('scrolls down faster the closer the pointer gets to the bottom', () => {
    const near = autoScrollVelocity({ x: 500, y: 760 }, screen, 60, 20).y
    const nearer = autoScrollVelocity({ x: 500, y: 790 }, screen, 60, 20).y
    expect(near).toBeGreaterThan(0)
    expect(nearer).toBeGreaterThan(near)
  })

  it('scrolls up near the top and caps the speed past the edge', () => {
    expect(autoScrollVelocity({ x: 500, y: 10 }, screen, 60, 20).y).toBeLessThan(0)
    expect(autoScrollVelocity({ x: 500, y: -300 }, screen, 60, 20).y).toBe(-20)
  })

  it('works on the horizontal axis too', () => {
    expect(autoScrollVelocity({ x: 995, y: 400 }, screen, 60, 20).x).toBeGreaterThan(0)
  })
})
