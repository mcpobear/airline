import { describe, expect, it } from 'vitest'
import { altitudeFraction, flightPosition, phaseAt, phaseWindows, routeFraction } from './flightProfile'
import type { Flight } from '../types/game'

const flight: Flight = { from: 'SIN', to: 'KUL', departedAt: 1_000_000, arrivesAt: 1_000_000 + 120_000, distanceKm: 300 }

describe('flight profile', () => {
  it('keeps climb/descent windows sensible', () => {
    for (const ms of [5_000, 30_000, 120_000, 600_000]) {
      const w = phaseWindows(ms)
      expect(w.climb).toBeGreaterThan(0)
      expect(w.climb + w.descent).toBeLessThanOrEqual(0.6 + 1e-9)
    }
  })

  it('route fraction is monotonic with exact endpoints', () => {
    const w = phaseWindows(120_000)
    expect(routeFraction(0, w)).toBeCloseTo(0, 9)
    expect(routeFraction(1, w)).toBeCloseTo(1, 9)
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const f = routeFraction(i / 200, w)
      expect(f).toBeGreaterThanOrEqual(prev)
      prev = f
    }
  })

  it('altitude is 0 on the ground and 1 in cruise', () => {
    const w = phaseWindows(120_000)
    expect(altitudeFraction(0, w)).toBe(0)
    expect(altitudeFraction(1, w)).toBe(0)
    expect(altitudeFraction(0.5, w)).toBe(1)
  })

  it('derives phases from progress', () => {
    const w = phaseWindows(120_000)
    expect(phaseAt(0.01, w)).toBe('departing')
    expect(phaseAt(0.5, w)).toBe('cruising')
    expect(phaseAt(0.99, w)).toBe('arriving')
  })

  it('starts at the origin and ends at the destination', () => {
    const start = flightPosition(flight, flight.departedAt)
    const end = flightPosition(flight, flight.arrivesAt + 99_999)
    expect(start.lat).toBeCloseTo(1.3644, 2)
    expect(start.progress).toBe(0)
    expect(end.lat).toBeCloseTo(2.7456, 2)
    expect(end.progress).toBe(1)
  })
})
