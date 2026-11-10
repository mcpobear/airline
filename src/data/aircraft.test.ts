import { describe, expect, it } from 'vitest'
import { AIRCRAFT, AIRCRAFT_BY_ID } from './aircraft'
import { AIRPORTS } from './airports'
import { hasRegistrationScheme } from '../sim/registration'

const REQUIRED = [
  'A220-100', 'A220-300', 'A319neo', 'A320neo', 'A321neo', 'A321LR', 'A321XLR', 'A330-800', 'A330-900',
  'A350-900', 'A350-1000', 'A380-800', '737-700', '737-800', '737 MAX 7', '737 MAX 8', '737 MAX 9',
  '737 MAX 10', '767-300ER', '777-200ER', '777-300ER', '777-8', '777-9', '787-8', '787-9', '787-10',
  '747-8I', 'C909', 'C919',
]

describe('aircraft database', () => {
  it('contains every aircraft from the spec exactly once', () => {
    expect(AIRCRAFT.map((m) => m.model).sort()).toEqual([...REQUIRED].sort())
    expect(AIRCRAFT_BY_ID.size).toBe(AIRCRAFT.length)
  })

  it('has plausible, positive performance and economy figures', () => {
    for (const m of AIRCRAFT) {
      expect(m.passengerCapacity).toBeGreaterThan(50)
      expect(m.passengerCapacity).toBeLessThan(600)
      expect(m.cargoCapacityKg).toBeGreaterThan(0)
      expect(m.rangeKm).toBeGreaterThan(1500)
      expect(m.rangeKm).toBeLessThan(17000)
      expect(m.cruiseSpeedKmh).toBeGreaterThan(750)
      expect(m.cruiseSpeedKmh).toBeLessThan(950)
      expect(m.price).toBeGreaterThan(0)
      expect(m.operatingCostPerKm).toBeGreaterThan(0)
    }
  })

  it('flags exactly the types not yet in airline service, each with a note', () => {
    const future = AIRCRAFT.filter((m) => !m.inService).map((m) => m.model).sort()
    expect(future).toEqual(['737 MAX 10', '737 MAX 7', '777-8', '777-9'])
    for (const m of AIRCRAFT.filter((x) => !x.inService)) expect(m.serviceNote).toBeTruthy()
  })

  it('scales price and operating cost with size within a family', () => {
    const g = (id: string) => AIRCRAFT_BY_ID.get(id)!
    expect(g('a220-100').price).toBeLessThan(g('a220-300').price)
    expect(g('a380-800').price).toBeGreaterThan(g('a350-1000').price)
    expect(g('a380-800').operatingCostPerKm).toBeGreaterThan(g('a350-900').operatingCostPerKm)
    expect(g('a321xlr').rangeKm).toBeGreaterThan(g('a321neo').rangeKm)
  })

  it('has a registration scheme for every airport country', () => {
    const missing = [...new Set(AIRPORTS.map((a) => a.country))].filter((c) => !hasRegistrationScheme(c))
    expect(missing).toEqual([])
  })
})
