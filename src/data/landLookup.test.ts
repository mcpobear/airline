import { describe, expect, it } from 'vitest'
import { isLand } from './landLookup'

describe('isLand', () => {
  it('identifies well-known land points', () => {
    expect(isLand(23, 12)).toBe(true) // Sahara
    expect(isLand(52, 0)).toBe(true) // England
    expect(isLand(39, -98)).toBe(true) // Central USA
    expect(isLand(-25, 134)).toBe(true) // Australian outback
    expect(isLand(-80, 0)).toBe(true) // Antarctica
    expect(isLand(60, 100)).toBe(true) // Siberia
  })
  it('identifies well-known ocean points', () => {
    expect(isLand(0, -150)).toBe(false) // mid-Pacific
    expect(isLand(-30, -20)).toBe(false) // South Atlantic
    expect(isLand(-20, 80)).toBe(false) // Indian Ocean
    expect(isLand(30, -40)).toBe(false) // North Atlantic
  })
  it('handles longitudes outside [-180, 180)', () => {
    expect(isLand(23, 12 + 360)).toBe(true)
    expect(isLand(0, -150 - 360)).toBe(false)
  })
})
