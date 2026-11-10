import { describe, expect, it } from 'vitest'
import { getAircraftModel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import { BALANCE } from '../config/balance'
import type { GameCore } from './core'
import { advanceFlights, dispatchBlocker, dispatchFlight, flightCost, flightDurationMs } from './flight'
import { distanceKm } from './geo'
import { loadJob, unloadJob } from './loading'
import { waitingJobsAt } from './jobs'
import { checkInvariants, makeGame } from './testUtils'

const T0 = 1_700_000_000_000
const model = getAircraftModel('a220-100')!
const km = (a: string, b: string) => distanceKm(getAirport(a)!, getAirport(b)!)

function fly(g: GameCore, dest: string, now = T0): GameCore {
  const r = dispatchFlight(g, g.aircraft[0].id, dest, now)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('flight maths', () => {
  it('one real flight-hour is one game minute plus the overhead allowance', () => {
    const hours = 1000 / model.cruiseSpeedKmh
    const expected = ((hours + BALANCE.time.flightOverheadMinutes / 60) * 3_600_000) / BALANCE.time.flightTimeAcceleration
    expect(flightDurationMs(1000, model)).toBe(Math.round(expected))
    // zero distance leaves only the overhead
    expect(flightDurationMs(0, model)).toBe(Math.round((BALANCE.time.flightOverheadMinutes * 60_000) / 60))
  })

  it('costs distance x rate plus the fixed departure cost', () => {
    expect(flightCost(model, 1000)).toBe(Math.round(1000 * model.operatingCostPerKm + BALANCE.economy.departureFixedCost))
  })
})

describe('dispatch', () => {
  const base = () => makeGame({ unlock: ['KUL', 'LHR'] })

  it('sends the aircraft, charges operating cost and leaves it airborne', () => {
    const g = base()
    const g2 = fly(g, 'KUL')
    const a = g2.aircraft[0]
    expect(a.airport).toBeNull()
    expect(a.flight).toMatchObject({ from: 'SIN', to: 'KUL', departedAt: T0 })
    expect(a.flight!.arrivesAt).toBeGreaterThan(T0)
    const cost = flightCost(model, km('SIN', 'KUL'))
    expect(g2.airline.cash).toBe(g.airline.cash - cost)
    expect(g2.airline.lifetimeOperatingCost).toBe(cost)
    expect(g.aircraft[0].flight).toBeNull() // input untouched
  })

  it('blocks invalid dispatches with a reason', () => {
    const g = base()
    const id = g.aircraft[0].id
    expect(dispatchBlocker(g, id, 'SIN')).toMatch(/other than/)
    expect(dispatchBlocker(g, id, 'NRT')).toMatch(/Unlock/)
    expect(dispatchBlocker(g, id, 'LHR')).toMatch(/Out of range/)
    expect(dispatchBlocker({ ...g, airline: { ...g.airline, cash: 10 } }, id, 'KUL')).toMatch(/Not enough cash/)
    expect(dispatchBlocker(g, 'nope', 'KUL')).toMatch(/Unknown aircraft/)
    expect(dispatchBlocker(g, id, 'KUL')).toBeNull()
    expect(dispatchBlocker(fly(g, 'KUL'), id, 'KUL')).toMatch(/already in flight/)
  })

  it('refuses a flight that moves an onboard job further from its destination', () => {
    // Onboard SIN->KUL job; flying to a point farther from KUL than SIN is.
    const g0 = makeGame({ unlock: ['KUL', 'CGK', 'BKK'] })
    const job = { ...waitingJobsAt(g0.jobs, 'SIN')[0], destination: 'KUL' }
    const g1: GameCore = { ...g0, jobs: g0.jobs.map((j) => (j.id === job.id ? job : j)) }
    const loaded = loadJob(g1, g1.aircraft[0].id, job.id)
    if (!loaded.ok) throw new Error(loaded.error)
    expect(km('CGK', 'KUL')).toBeGreaterThan(km('SIN', 'KUL'))
    expect(dispatchBlocker(loaded.value, g1.aircraft[0].id, 'CGK')).toMatch(/wouldn't get closer/)
    expect(dispatchBlocker(loaded.value, g1.aircraft[0].id, 'KUL')).toBeNull()
  })
})

describe('arrival', () => {
  it('does nothing before arrival and returns the same object when idle', () => {
    const g = makeGame({ unlock: ['KUL'] })
    expect(advanceFlights(g, T0).game).toBe(g)
    const f = fly(g, 'KUL')
    const mid = advanceFlights(f, T0 + 1000)
    expect(mid.events).toEqual([])
    expect(mid.game.aircraft[0].flight).not.toBeNull()
  })

  it('pays a delivered job exactly once and lands the aircraft', () => {
    const g0 = makeGame({ unlock: ['KUL'] })
    const job = { ...waitingJobsAt(g0.jobs, 'SIN')[0], destination: 'KUL' }
    const g1: GameCore = { ...g0, jobs: g0.jobs.map((j) => (j.id === job.id ? job : j)) }
    const loaded = loadJob(g1, g1.aircraft[0].id, job.id)
    if (!loaded.ok) throw new Error(loaded.error)
    const flying = fly(loaded.value, 'KUL')
    const cashBefore = flying.airline.cash
    const end = flying.aircraft[0].flight!.arrivesAt

    const r1 = advanceFlights(flying, end)
    const a = r1.game.aircraft[0]
    expect(r1.events).toHaveLength(1)
    expect(r1.events[0]).toMatchObject({ delivered: 1, revenue: job.reward, airport: 'KUL' })
    expect(a.flight).toBeNull()
    expect(a.airport).toBe('KUL')
    expect(a.status).toBe('parked')
    expect(r1.game.airline.cash).toBe(cashBefore + job.reward)
    expect(r1.game.airline.jobsDelivered).toBe(1)
    expect(r1.game.jobs.find((j) => j.id === job.id)).toBeUndefined()
    expect(checkInvariants(r1.game)).toEqual([])
    // a second reconcile (e.g. duplicate tick) pays nothing more
    const r2 = advanceFlights(r1.game, end + 60_000)
    expect(r2.events).toEqual([])
    expect(r2.game.airline.cash).toBe(r1.game.airline.cash)
  })

  it('catches up after a long absence, landing every flight in order', () => {
    const g0 = makeGame({ unlock: ['KUL'] })
    const r1 = dispatchFlight(g0, g0.aircraft[0].id, 'KUL', T0)
    const r2 = dispatchFlight(r1.ok ? r1.value : g0, g0.aircraft[1].id, 'KUL', T0 + 5000)
    if (!r1.ok || !r2.ok) throw new Error('dispatch failed')
    const { game, events } = advanceFlights(r2.value, T0 + 30 * 24 * 3_600_000)
    expect(events.map((e) => e.aircraftId)).toEqual([g0.aircraft[0].id, g0.aircraft[1].id])
    expect(game.aircraft.every((a) => a.airport === 'KUL' && a.flight === null)).toBe(true)
    expect(checkInvariants(game)).toEqual([])
  })

  it('keeps undelivered jobs onboard and tracks flight phases', () => {
    const g0 = makeGame({ unlock: ['KUL', 'BKK'] })
    const job = { ...waitingJobsAt(g0.jobs, 'SIN')[0], destination: 'BKK' }
    const g1: GameCore = { ...g0, jobs: g0.jobs.map((j) => (j.id === job.id ? job : j)) }
    const loaded = loadJob(g1, g1.aircraft[0].id, job.id)
    if (!loaded.ok) throw new Error(loaded.error)
    const flying = fly(loaded.value, 'KUL')
    const f = flying.aircraft[0].flight!
    expect(advanceFlights(flying, f.departedAt + 1).game.aircraft[0].status).toBe('departing')
    expect(advanceFlights(flying, (f.departedAt + f.arrivesAt) / 2).game.aircraft[0].status).toBe('cruising')
    expect(advanceFlights(flying, f.arrivesAt - 1).game.aircraft[0].status).toBe('arriving')
    const landed = advanceFlights(flying, f.arrivesAt)
    expect(landed.events[0]).toMatchObject({ delivered: 0, remainingOnboard: 1 })
    expect(landed.game.aircraft[0].status).toBe('loading')
    expect(landed.game.jobs.find((j) => j.id === job.id)).toMatchObject({ status: 'loaded', currentAirport: 'KUL' })
    expect(landed.game.airline.cash).toBe(flying.airline.cash)
    expect(waitingJobsAt(landed.game.jobs, 'KUL').length).toBeGreaterThan(0)
  })
})

describe('layovers', () => {
  it('delivers a two-leg job only at its final destination, paying once', () => {
    const g0 = makeGame({ unlock: ['BKK', 'HKG'] })
    const base = waitingJobsAt(g0.jobs, 'SIN')[0]
    const job = { ...base, destination: 'HKG', reward: 5000 }
    const g1: GameCore = { ...g0, jobs: g0.jobs.map((j) => (j.id === base.id ? job : j)) }
    const a1 = g1.aircraft[0].id
    const a2 = g1.aircraft[1].id
    let g = loadJob(g1, a1, job.id)
    if (!g.ok) throw new Error(g.error)
    // leg 1: SIN -> BKK, aircraft 1 flies; job is not at its destination
    let r = dispatchFlight(g.value, a1, 'BKK', T0)
    if (!r.ok) throw new Error(r.error)
    const cash1 = r.value.airline.cash
    let adv = advanceFlights(r.value, T0 + 10 * 3_600_000)
    expect(adv.events[0]).toMatchObject({ delivered: 0, remainingOnboard: 1 })
    expect(adv.game.airline.cash).toBe(cash1) // nothing paid at the layover
    // leave it at the layover
    const un = unloadJob(adv.game, a1, job.id)
    if (!un.ok) throw new Error(un.error)
    expect(un.value.jobs.find((j) => j.id === job.id)).toMatchObject({ status: 'at_layover', currentAirport: 'BKK' })
    expect(waitingJobsAt(un.value.jobs, 'BKK').some((j) => j.id === job.id)).toBe(true)
    // aircraft 2 has to be moved to BKK first (dispatch it empty), then picks the job up
    r = dispatchFlight(un.value, a2, 'BKK', T0 + 11 * 3_600_000)
    if (!r.ok) throw new Error(r.error)
    adv = advanceFlights(r.value, T0 + 20 * 3_600_000)
    g = loadJob(adv.game, a2, job.id)
    if (!g.ok) throw new Error(g.error)
    const before = g.value.airline.cash
    r = dispatchFlight(g.value, a2, 'HKG', T0 + 21 * 3_600_000)
    if (!r.ok) throw new Error(r.error)
    const afterCost = r.value.airline.cash
    adv = advanceFlights(r.value, T0 + 40 * 3_600_000)
    expect(adv.events[0]).toMatchObject({ delivered: 1, revenue: 5000 })
    expect(adv.game.airline.cash).toBe(afterCost + 5000)
    expect(afterCost).toBeLessThan(before)
    expect(adv.game.jobs.find((j) => j.id === job.id)).toBeUndefined()
    expect(checkInvariants(adv.game)).toEqual([])
  })
})
