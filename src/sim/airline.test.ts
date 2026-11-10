import { describe, expect, it } from 'vitest'
import { BALANCE } from '../config/balance'
import { getAirport } from '../data/airports'
import { createGame, unlockAirport, unlockBlocker, validateAirlineName } from './airline'
import { unlockPrice } from './airports'

const fresh = () => {
  const r = createGame('  Merlion   Air ', 'SIN', 42)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('createGame', () => {
  it('creates an airline with starting cash and an unlocked HQ', () => {
    const g = fresh()
    expect(g.airline.name).toBe('Merlion Air')
    expect(g.airline.hq).toBe('SIN')
    expect(g.airline.cash).toBe(BALANCE.economy.startingCash)
    expect(g.unlockedAirports).toEqual(['SIN'])
  })
  it('rejects bad names and unknown airports', () => {
    expect(validateAirlineName(' a ').ok).toBe(false)
    expect(validateAirlineName('x'.repeat(40)).ok).toBe(false)
    expect(createGame('Fine Air', 'XXX', 1).ok).toBe(false)
  })
})

describe('unlockPrice', () => {
  it('scales with class, city size and network growth', () => {
    const sin = getAirport('SIN')!
    const hkt = getAirport('HKT')!
    const kul = getAirport('KUL')!
    expect(unlockPrice(hkt, 1)).toBeLessThan(unlockPrice(kul, 1))
    expect(unlockPrice(kul, 10)).toBeGreaterThan(unlockPrice(kul, 1))
    expect(unlockPrice(sin, 1) % BALANCE.airports.priceRounding).toBe(0)
  })
  it('caps network growth', () => {
    const kul = getAirport('KUL')!
    expect(unlockPrice(kul, 1000)).toBe(unlockPrice(kul, 500))
  })
  it('keeps early expansion affordable against starting cash', () => {
    for (const code of ['KUL', 'BKK', 'HKG', 'CGK']) {
      expect(unlockPrice(getAirport(code)!, 1)).toBeLessThan(BALANCE.economy.startingCash / 3)
    }
  })
})

describe('unlockAirport', () => {
  it('deducts the exact price and adds the airport', () => {
    const g = fresh()
    const price = unlockPrice(getAirport('KUL')!, 1)
    const r = unlockAirport(g, 'KUL')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.airline.cash).toBe(g.airline.cash - price)
    expect(r.value.unlockedAirports).toEqual(['SIN', 'KUL'])
    expect(g.unlockedAirports).toEqual(['SIN']) // input not mutated
  })
  it('refuses duplicates, unknown airports and insufficient funds', () => {
    const g = fresh()
    expect(unlockAirport(g, 'SIN').ok).toBe(false)
    expect(unlockAirport(g, 'XXX').ok).toBe(false)
    const poor = { ...g, airline: { ...g.airline, cash: 100 } }
    expect(unlockBlocker(poor, 'KUL')).toMatch(/Not enough cash/)
    expect(unlockAirport(poor, 'KUL').ok).toBe(false)
  })
  it('cannot charge twice for the same airport', () => {
    const once = unlockAirport(fresh(), 'KUL')
    if (!once.ok) throw new Error()
    const twice = unlockAirport(once.value, 'KUL')
    expect(twice.ok).toBe(false)
  })
})
