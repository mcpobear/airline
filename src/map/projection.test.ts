import { describe, expect, it } from 'vitest'
import { getAirport } from '../data/airports'
import { interpolateGreatCircle } from '../sim/geo'
import { MAP_W, nearestX, project, shortestLonDelta, unproject, unwrapLongitudes, wrapX } from './projection'

describe('flat map projection', () => {
  it('maps corners and the origin where you would expect', () => {
    expect(project(0, 0)).toEqual({ x: 0, y: 0 })
    expect(project(90, 180)).toEqual({ x: 2, y: 1 })
    expect(project(-90, -180)).toEqual({ x: -2, y: -1 })
  })

  it('round-trips through unproject', () => {
    for (const [lat, lon] of [[1.36, 103.99], [51.5, -0.45], [-33.9, 151.2], [64, 179.9]]) {
      const p = project(lat, lon)
      const back = unproject(p.x, p.y)
      expect(back.lat).toBeCloseTo(lat, 9)
      expect(back.lon).toBeCloseTo(lon, 9)
    }
  })

  it('wraps x into one world width', () => {
    expect(wrapX(0)).toBe(0)
    expect(wrapX(2.5)).toBeCloseTo(-1.5, 9)
    expect(wrapX(-2.5)).toBeCloseTo(1.5, 9)
    expect(wrapX(MAP_W * 3 + 0.25)).toBeCloseTo(0.25, 9)
  })

  it('picks the copy nearest the camera, so markers never jump the seam', () => {
    // Fiji at lon 178 seen from a camera just east of the date line (lon -175)
    const fiji = project(-18, 178).x
    expect(nearestX(fiji, project(0, -175).x)).toBeCloseTo(project(0, -182).x, 9)
    expect(Math.abs(nearestX(fiji, project(0, -175).x) - project(0, -175).x)).toBeLessThan(MAP_W / 2)
  })

  it('unwraps a Pacific crossing into one continuous line', () => {
    const sin = getAirport('SIN')!
    const lax = getAirport('LAX')!
    const lons = Array.from({ length: 60 }, (_, i) => interpolateGreatCircle(sin, lax, i / 59).lon)
    expect(Math.max(...lons)).toBeGreaterThan(170)
    expect(Math.min(...lons)).toBeLessThan(-170) // raw path jumps the date line
    const unwrapped = unwrapLongitudes(lons)
    for (let i = 1; i < unwrapped.length; i++) {
      expect(Math.abs(unwrapped[i] - unwrapped[i - 1])).toBeLessThan(20)
    }
    // Going east from Singapore, the unwrapped path runs past 180 instead of back across the map.
    expect(unwrapped[unwrapped.length - 1]).toBeGreaterThan(180)
  })

  it('knows which way round is shorter', () => {
    expect(shortestLonDelta(170, -170)).toBeCloseTo(20, 9) // east over the date line
    expect(shortestLonDelta(-170, 170)).toBeCloseTo(-20, 9) // west over the date line
    expect(shortestLonDelta(0, 90)).toBeCloseTo(90, 9)
  })
})
