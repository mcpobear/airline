import { describe, expect, it } from 'vitest'
import { BALANCE } from '../config/balance'
import { isStuck, resaleValue, sellAircraft, sellBlocker, summarizeFinances, takeRescueFunding } from './economy'
import { dispatchFlight } from './flight'
import { loadJob } from './loading'
import { waitingJobsAt } from './jobs'
import { makeGame } from './testUtils'

describe('economy', () => {
  it('sells a parked empty aircraft at the configured resale fraction', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const a = g.aircraft[0]
    expect(resaleValue(a)).toBe(Math.round(a.purchasePrice * BALANCE.economy.aircraftResaleFraction))
    const r = sellAircraft(g, a.id)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.aircraft).toHaveLength(g.aircraft.length - 1)
    expect(r.value.airline.cash).toBe(g.airline.cash + resaleValue(a))
  })

  it('refuses to sell a loaded, flying or last aircraft', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const id = g.aircraft[0].id
    const job = waitingJobsAt(g.jobs, 'SIN')[0]
    const loaded = loadJob(g, id, job.id)
    if (!loaded.ok) throw new Error(loaded.error)
    expect(sellBlocker(loaded.value, id)).toMatch(/Unload/)
    const flying = dispatchFlight(g, id, 'KUL', 1)
    if (!flying.ok) throw new Error(flying.error)
    expect(sellBlocker(flying.value, id)).toMatch(/in flight/)
    const one = { ...g, aircraft: [g.aircraft[0]] }
    expect(sellBlocker(one, id)).toMatch(/at least one/)
  })

  it('summarises finances consistently', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const s = summarizeFinances(g)
    expect(s.net).toBe(s.revenue - s.operatingCost)
    expect(s.perAircraft).toHaveLength(g.aircraft.length)
    expect(s.fleetValue).toBeGreaterThan(0)
  })
})

describe('rescue funding', () => {
  it('is only available when no aircraft can fly for lack of cash', () => {
    const g = makeGame({ unlock: ['KUL'] })
    expect(isStuck(g)).toBe(false)
    expect(takeRescueFunding(g)).toMatchObject({ ok: false })
    const broke = { ...g, airline: { ...g.airline, cash: 100 } }
    expect(isStuck(broke)).toBe(true)
    const r = takeRescueFunding(broke)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.airline.cash).toBe(100 + BALANCE.economy.rescueGrant)
    expect(r.value.airline.lifetimeRevenue).toBe(broke.airline.lifetimeRevenue)
    expect(isStuck(r.value)).toBe(false)
  })

  it('is not offered while something is flying, or when cash would not help', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const flying = dispatchFlight(g, g.aircraft[0].id, 'KUL', 1)
    if (!flying.ok) throw new Error(flying.error)
    expect(isStuck({ ...flying.value, airline: { ...flying.value.airline, cash: 0 } })).toBe(false)
    const lonely = makeGame() // only HQ unlocked: nowhere to fly, and money won't fix it
    expect(isStuck({ ...lonely, airline: { ...lonely.airline, cash: 0 } })).toBe(false)
  })
})
