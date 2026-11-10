import { describe, expect, it } from 'vitest'
import { pointAt, routePath } from './routePath'
import { MAP_W, project } from './projection'

describe('flat map route paths', () => {
  it('runs continuously across the date line instead of jumping the map', () => {
    const path = routePath('SIN', 'LAX')
    let maxStep = 0
    for (let i = 1; i < path.count; i++) {
      maxStep = Math.max(maxStep, Math.abs(path.points[i * 2] - path.points[i * 2 - 2]))
    }
    expect(maxStep).toBeLessThan(MAP_W / 8)
    // Leaving Singapore eastbound, the path keeps going east past the edge of the world.
    expect(path.points[(path.count - 1) * 2]).toBeGreaterThan(MAP_W / 2)
  })

  it('starts at the origin, ends at the destination and heads the right way', () => {
    const path = routePath('SIN', 'LAX')
    const start = pointAt(path, 0)
    const end = pointAt(path, 1)
    expect(start.x).toBeCloseTo(project(0, 103.9915).x, 2)
    expect(start.hx).toBeGreaterThan(0) // eastbound out of Singapore
    expect(end.x).toBeCloseTo(project(0, 360 - 118.4081).x, 2)
    expect(Math.hypot(end.hx, end.hy)).toBeCloseTo(1, 6)
  })

  it('goes the other way round for the return leg', () => {
    const west = pointAt(routePath('LAX', 'SIN'), 0)
    expect(west.hx).toBeLessThan(0) // westbound out of Los Angeles
  })

  it('caches by route', () => {
    expect(routePath('SIN', 'HND')).toBe(routePath('SIN', 'HND'))
  })
})
