import { describe, expect, it } from 'vitest'
import { formatCoord, formatMoney } from './format'

describe('formatMoney', () => {
  it('formats compactly', () => {
    expect(formatMoney(628_600)).toBe('$628.6k')
    expect(formatMoney(1_250_000)).toBe('$1.3M')
    expect(formatMoney(950)).toBe('$950')
    expect(formatMoney(-12_000)).toBe('-$12.0k')
  })
})

describe('formatCoord', () => {
  it('uses hemispheres', () => {
    expect(formatCoord(1.36, 103.99)).toBe('1.36° N, 103.99° E')
    expect(formatCoord(-33.9, -70.6)).toBe('33.90° S, 70.60° W')
  })
})
