import { describe, expect, it } from 'vitest'
import { distanceKm, interpolateGreatCircle, normalizeLon } from './geo'

const SIN = { lat: 1.3644, lon: 103.9915 }
const LHR = { lat: 51.47, lon: -0.4543 }
const JFK = { lat: 40.6413, lon: -73.7781 }

describe('distanceKm', () => {
  it('is zero for identical points', () => {
    expect(distanceKm(SIN, SIN)).toBeCloseTo(0, 6)
  })
  it('matches known airport distances', () => {
    expect(distanceKm(SIN, LHR)).toBeGreaterThan(10_800)
    expect(distanceKm(SIN, LHR)).toBeLessThan(10_900)
    expect(distanceKm(LHR, JFK)).toBeGreaterThan(5_500)
    expect(distanceKm(LHR, JFK)).toBeLessThan(5_600)
  })
  it('is symmetric', () => {
    expect(distanceKm(SIN, LHR)).toBeCloseTo(distanceKm(LHR, SIN), 6)
  })
})

describe('interpolateGreatCircle', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    const start = interpolateGreatCircle(SIN, LHR, 0)
    const end = interpolateGreatCircle(SIN, LHR, 1)
    expect(start.lat).toBeCloseTo(SIN.lat, 4)
    expect(start.lon).toBeCloseTo(SIN.lon, 4)
    expect(end.lat).toBeCloseTo(LHR.lat, 4)
    expect(end.lon).toBeCloseTo(LHR.lon, 4)
  })
  it('midpoint is equidistant from both ends', () => {
    const mid = interpolateGreatCircle(SIN, LHR, 0.5)
    expect(distanceKm(SIN, mid)).toBeCloseTo(distanceKm(mid, LHR), 3)
  })
})

describe('normalizeLon', () => {
  it('wraps into [-180, 180)', () => {
    expect(normalizeLon(190)).toBe(-170)
    expect(normalizeLon(-190)).toBe(170)
    expect(normalizeLon(180)).toBe(-180)
    expect(normalizeLon(45)).toBe(45)
  })
})
