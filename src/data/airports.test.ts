import { describe, expect, it } from 'vitest'
import { AIRPORTS, getAirport, groupByCity, searchAirports } from './airports'
import { distanceKm } from '../sim/geo'

const km = (a: string, b: string) => distanceKm(getAirport(a)!, getAirport(b)!)

describe('airport database', () => {
  it('has unique 3-letter IATA and 4-letter ICAO codes', () => {
    expect(new Set(AIRPORTS.map((a) => a.iata)).size).toBe(AIRPORTS.length)
    expect(new Set(AIRPORTS.map((a) => a.icao)).size).toBe(AIRPORTS.length)
    for (const a of AIRPORTS) {
      expect(a.iata).toMatch(/^[A-Z]{3}$/)
      expect(a.icao).toMatch(/^[A-Z]{4}$/)
    }
  })

  it('has valid coordinates, classes and populations', () => {
    for (const a of AIRPORTS) {
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(a.lon)).toBeLessThanOrEqual(180)
      expect(['international', 'major', 'regional']).toContain(a.classification)
      expect(a.metroMillions).toBeGreaterThan(0)
    }
  })

  it('covers every inhabited continent', () => {
    for (const code of ['SIN', 'LHR', 'JFK', 'GRU', 'JNB', 'SYD', 'DXB']) {
      expect(getAirport(code)).toBeDefined()
    }
    expect(AIRPORTS.length).toBeGreaterThanOrEqual(140)
  })

  it('places airports where they really are (known great-circle distances)', () => {
    expect(km('SIN', 'KUL')).toBeGreaterThan(280)
    expect(km('SIN', 'KUL')).toBeLessThan(320)
    expect(km('SIN', 'LHR')).toBeGreaterThan(10_800)
    expect(km('SIN', 'LHR')).toBeLessThan(10_950)
    expect(km('JFK', 'LHR')).toBeGreaterThan(5_500)
    expect(km('JFK', 'LHR')).toBeLessThan(5_600)
    expect(km('SYD', 'LAX')).toBeGreaterThan(12_000)
    expect(km('SYD', 'LAX')).toBeLessThan(12_100)
  })

  it('groups multi-airport cities', () => {
    const london = groupByCity().find((g) => g.city === 'London')!
    expect(london.airports.map((a) => a.iata).sort()).toEqual(['LGW', 'LHR'])
  })

  it('searches by code, city and accent-insensitively', () => {
    expect(searchAirports('sin')[0].iata).toBe('SIN')
    expect(searchAirports('montreal').map((a) => a.iata)).toContain('YUL')
    expect(searchAirports('zzzz')).toEqual([])
  })
})
