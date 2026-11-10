import { describe, expect, it } from 'vitest'
import { buildGlobeGeometry } from './buildGlobeGeometry'
import { latLonToVector3, subSolarPoint, vectorToLatLon } from './coords'

describe('buildGlobeGeometry', () => {
  const geo = buildGlobeGeometry(8)
  it('produces a coloured, non-indexed mesh', () => {
    const pos = geo.attributes.position
    expect(pos.count).toBe(20 * 9 * 9 * 3)
    expect(geo.attributes.color.count).toBe(pos.count)
    expect(geo.index).toBeNull()
  })
  it('keeps every vertex near the unit sphere', () => {
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))
      expect(r).toBeGreaterThanOrEqual(0.999)
      expect(r).toBeLessThan(1.06)
    }
  })
})

describe('globe coordinates', () => {
  it('round-trips lat/lon through a vector', () => {
    for (const [lat, lon] of [[1.36, 103.99], [51.47, -0.45], [-33.9, 151.2], [0, 180]]) {
      const back = vectorToLatLon(latLonToVector3(lat, lon))
      expect(back.lat).toBeCloseTo(lat, 6)
      expect(Math.abs(Math.abs(back.lon) - Math.abs(lon))).toBeLessThan(1e-6)
    }
  })
  it('puts lon 0 on +Z and east to the +X side', () => {
    const origin = latLonToVector3(0, 0)
    const east = latLonToVector3(0, 90)
    expect(origin.z).toBeCloseTo(1, 6)
    expect(east.x).toBeCloseTo(1, 6)
  })
  it('sub-solar longitude is 0 at 12:00 UTC and latitude is within the tropics', () => {
    const p = subSolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)))
    expect(p.lon).toBeCloseTo(0, 6)
    expect(p.lat).toBeGreaterThan(23)
    expect(p.lat).toBeLessThanOrEqual(23.45)
  })
})
