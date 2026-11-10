import { describe, expect, it } from 'vitest'
import { BALANCE } from '../config/balance'
import { getAircraftModel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { aircraftPosition, canOperateAt, purchaseAircraft, purchaseBlocker } from './aircraft'
import { createGame } from './airline'
import type { GameCore } from './core'
import { generateRegistration } from './registration'

const game = (hq = 'SIN', seed = 7): GameCore => {
  const r = createGame('Test Air', hq, seed)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const rich = (g: GameCore, cash = 50_000_000): GameCore => ({ ...g, airline: { ...g.airline, cash } })

describe('starter fleet', () => {
  it('gives two parked A220-100s at the HQ with unique registrations and free of charge', () => {
    const g = game()
    expect(g.aircraft).toHaveLength(BALANCE.aircraft.starterCount)
    expect(g.aircraft.every((a) => a.modelId === 'a220-100' && a.airport === 'SIN' && a.status === 'parked')).toBe(true)
    expect(new Set(g.aircraft.map((a) => a.registration)).size).toBe(2)
    expect(new Set(g.aircraft.map((a) => a.id)).size).toBe(2)
    expect(g.airline.cash).toBe(BALANCE.economy.startingCash)
  })
  it('uses the HQ country for registrations', () => {
    expect(game('SIN').aircraft[0].registration).toMatch(/^9V-[A-Z]{3}$/)
    expect(game('JFK').aircraft[0].registration).toMatch(/^N\d{3}[A-Z]{2}$/)
    expect(game('LHR').aircraft[0].registration).toMatch(/^G-[A-Z]{4}$/)
    expect(game('NRT').aircraft[0].registration).toMatch(/^JA\d{3}[A-Z]$/)
  })
  it('is deterministic for a given seed', () => {
    expect(game('SIN', 5).aircraft.map((a) => a.registration)).toEqual(game('SIN', 5).aircraft.map((a) => a.registration))
    expect(game('SIN', 5).aircraft[0].registration).not.toBe(game('SIN', 6).aircraft[0].registration)
  })
})

describe('registrations', () => {
  it('never duplicates, even when most of the space is taken', () => {
    const taken = new Set<string>()
    for (let n = 1; n <= 300; n++) taken.add(generateRegistration('Singapore', 1, n, taken))
    expect(taken.size).toBe(300)
  })
  it('avoids a taken value by retrying', () => {
    const first = generateRegistration('Singapore', 9, 1, new Set())
    expect(generateRegistration('Singapore', 9, 1, new Set([first]))).not.toBe(first)
  })
})

describe('purchaseAircraft', () => {
  it('deducts the price immediately and delivers to the HQ', () => {
    const g = rich(game(), 2_000_000)
    const model = getAircraftModel('a220-300')!
    const r = purchaseAircraft(g, 'a220-300')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.game.airline.cash).toBe(g.airline.cash - model.price)
    expect(r.value.aircraft.airport).toBe('SIN')
    expect(r.value.aircraft.status).toBe('parked')
    expect(r.value.aircraft.purchasePrice).toBe(model.price)
    expect(r.value.game.aircraft).toHaveLength(3)
    expect(g.aircraft).toHaveLength(2) // input untouched
  })
  it('gives each purchase a fresh id and registration', () => {
    let g = rich(game())
    for (let i = 0; i < 20; i++) {
      const r = purchaseAircraft(g, 'c909')
      if (!r.ok) throw new Error(r.error)
      g = r.value.game
    }
    expect(new Set(g.aircraft.map((a) => a.id)).size).toBe(22)
    expect(new Set(g.aircraft.map((a) => a.registration)).size).toBe(22)
  })
  it('refuses when cash is short', () => {
    expect(purchaseBlocker(game(), 'a380-800')).toMatch(/Not enough cash/)
    expect(purchaseAircraft(game(), 'a380-800').ok).toBe(false)
  })
  it('lets a rich player buy an A380 immediately at an international HQ', () => {
    expect(purchaseBlocker(rich(game()), 'a380-800')).toBeNull()
  })
  it('refuses aircraft the HQ airport cannot handle', () => {
    const regional = rich(game('HKT'))
    expect(purchaseBlocker(regional, 'a380-800')).toMatch(/can't handle heavy/)
    expect(purchaseBlocker(regional, 'a350-900')).toMatch(/can't handle large/)
    expect(purchaseBlocker(regional, 'a320neo')).toBeNull()
    const major = rich(game('BCN'))
    expect(purchaseBlocker(major, 'a350-900')).toBeNull()
    expect(purchaseBlocker(major, 'a380-800')).toMatch(/can't handle heavy/)
  })
  it('hides not-yet-in-service aircraft until the setting is enabled', () => {
    const g = rich(game())
    expect(purchaseBlocker(g, 'b777-9')).toMatch(/not in airline service/)
    expect(purchaseBlocker({ ...g, settings: { futureAircraft: true } }, 'b777-9')).toBeNull()
  })
  it('rejects unknown models', () => {
    expect(purchaseAircraft(game(), 'zzz').ok).toBe(false)
  })
})

describe('airport compatibility and position', () => {
  it('maps airport class to the largest category it can handle', () => {
    const a380 = getAircraftModel('a380-800')!
    expect(canOperateAt(a380, getAirport('SIN')!)).toBe(true)
    expect(canOperateAt(a380, getAirport('MUC')!)).toBe(false)
    expect(canOperateAt(getAircraftModel('c909')!, getAirport('HKT')!)).toBe(true)
  })
  it('parked aircraft sit at their airport', () => {
    const pos = aircraftPosition(game().aircraft[0])!
    expect(pos.lat).toBeCloseTo(getAirport('SIN')!.lat)
  })
})
