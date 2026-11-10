import { describe, expect, it } from 'vitest'
import { BALANCE } from '../config/balance'
import { getAirport } from '../data/airports'
import { distanceKm } from './geo'
import {
  ensureJobsTowards,
  jobReward,
  nextJobRefreshAt,
  refillAirport,
  refreshJobsIfDue,
  targetJobCount,
  waitingJobsAt,
} from './jobs'
import { loadJob } from './loading'
import type { GameCore } from './core'
import { checkInvariants, makeGame } from './testUtils'

const J = BALANCE.jobs

describe('job generation', () => {
  it('creates nothing while only the HQ is unlocked', () => {
    expect(makeGame().jobs).toHaveLength(0)
  })

  it('unlocking an airport creates jobs there and from the HQ towards it', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const atKul = waitingJobsAt(g.jobs, 'KUL')
    const atSin = waitingJobsAt(g.jobs, 'SIN')
    expect(atKul.length).toBeGreaterThanOrEqual(targetJobCount(getAirport('KUL')!))
    expect(atSin.filter((j) => j.destination === 'KUL').length).toBeGreaterThanOrEqual(J.jobsToNewAirportFromHq)
    expect(atKul.every((j) => j.destination === 'SIN')).toBe(true) // only one possible destination
    expect(checkInvariants(g)).toEqual([])
  })

  it('only sends jobs between unlocked airports, never to the same airport', () => {
    const g = makeGame({ unlock: ['KUL', 'BKK', 'HKG', 'CGK'] })
    expect(checkInvariants(g)).toEqual([])
    for (const j of g.jobs) {
      expect(['SIN', 'KUL', 'BKK', 'HKG', 'CGK']).toContain(j.destination)
      expect(j.destination).not.toBe(j.origin)
    }
  })

  it('is deterministic for a given seed and differs between seeds', () => {
    const a = makeGame({ seed: 11, unlock: ['KUL', 'BKK'] })
    const b = makeGame({ seed: 11, unlock: ['KUL', 'BKK'] })
    const c = makeGame({ seed: 12, unlock: ['KUL', 'BKK'] })
    expect(a.jobs).toEqual(b.jobs)
    expect(a.jobs).not.toEqual(c.jobs)
  })

  it('keeps job sizes within configured limits and includes both kinds', () => {
    const g = makeGame({ unlock: ['KUL', 'BKK', 'HKG', 'CGK', 'MNL', 'SYD', 'DXB', 'LHR'] })
    for (const j of g.jobs) {
      const cls = getAirport(j.origin)!.classification
      if (j.kind === 'passenger') {
        expect(j.quantity).toBeGreaterThanOrEqual(J.minPassengers)
        expect(j.quantity).toBeLessThanOrEqual(J.maxPassengers[cls])
      } else {
        expect(j.quantity).toBeGreaterThanOrEqual(J.minCargoKg)
        expect(j.quantity).toBeLessThanOrEqual(J.maxCargoKg[cls])
      }
    }
    expect(g.jobs.some((j) => j.kind === 'passenger')).toBe(true)
    expect(g.jobs.some((j) => j.kind === 'cargo')).toBe(true)
  })

  it('offers more jobs at big airports than at small ones', () => {
    const g = makeGame({ unlock: ['HKT', 'KUL'] })
    expect(waitingJobsAt(g.jobs, 'KUL').length).toBeGreaterThan(waitingJobsAt(g.jobs, 'HKT').length)
  })

  it('gives every unlocked airport jobs back towards the HQ', () => {
    const g = makeGame({ unlock: ['KUL', 'BKK', 'HKG', 'CGK', 'MNL'] })
    for (const iata of ['KUL', 'BKK', 'HKG', 'CGK', 'MNL']) {
      const home = waitingJobsAt(g.jobs, iata).filter((j) => j.destination === 'SIN')
      expect(home.length).toBeGreaterThanOrEqual(J.returnGuarantee.toHq)
    }
  })

  it('ensureJobsTowards tops up only what is missing', () => {
    const g = makeGame({ unlock: ['KUL'] })
    const have = waitingJobsAt(g.jobs, 'KUL').filter((j) => j.destination === 'SIN').length
    expect(ensureJobsTowards(g, 'KUL', 'SIN', have).jobs).toHaveLength(g.jobs.length)
    expect(ensureJobsTowards(g, 'KUL', 'SIN', have + 2).jobs).toHaveLength(g.jobs.length + 2)
  })
})

describe('waiting-job cap and refills', () => {
  it('never exceeds the cap and never deletes existing jobs', () => {
    let g = makeGame({ unlock: ['KUL'] })
    const before = g.jobs.map((j) => j.id)
    for (let i = 0; i < 10; i++) g = ensureJobsTowards(g, 'KUL', 'SIN', J.maxWaitingJobsPerAirport * 2)
    expect(waitingJobsAt(g.jobs, 'KUL').length).toBe(J.maxWaitingJobsPerAirport)
    expect(g.jobs.map((j) => j.id).slice(0, before.length)).toEqual(before)
  })

  it('refills only when below the threshold', () => {
    const g = makeGame({ unlock: ['KUL'] })
    expect(refillAirport(g, 'KUL')).toBe(g) // already full
    const drained = { ...g, jobs: g.jobs.filter((j) => j.currentAirport !== 'KUL') }
    const refilled = refillAirport(drained, 'KUL')
    expect(waitingJobsAt(refilled.jobs, 'KUL').length).toBeGreaterThanOrEqual(targetJobCount(getAirport('KUL')!))
  })

  it('has no expiry fields: jobs just wait', () => {
    const g = makeGame({ unlock: ['KUL'] })
    expect(Object.keys(g.jobs[0]).sort()).toEqual(
      ['aircraftId', 'currentAirport', 'destination', 'id', 'kind', 'origin', 'quantity', 'reward', 'status'],
    )
  })
})

describe('jobReward', () => {
  const sin = getAirport('SIN')!
  const kul = getAirport('KUL')!
  const lhr = getAirport('LHR')!
  it('grows with quantity and distance', () => {
    const km1 = distanceKm(sin, kul)
    const km2 = distanceKm(sin, lhr)
    expect(jobReward('passenger', 40, km1, sin, kul)).toBeGreaterThan(jobReward('passenger', 20, km1, sin, kul))
    expect(jobReward('passenger', 20, km2, sin, lhr)).toBeGreaterThan(jobReward('passenger', 20, km1, sin, kul))
    expect(jobReward('cargo', 2000, km2, sin, lhr)).toBeGreaterThan(jobReward('cargo', 1000, km2, sin, lhr))
  })
  it('matches the documented formula within rounding', () => {
    const km = distanceKm(sin, lhr)
    const base = jobReward('passenger', 10, km, sin, lhr)
    const expected = BALANCE.economy.passengerRevenuePerPaxKm * 10 * km
    expect(base / expected).toBeGreaterThan(0.9)
    expect(base / expected).toBeLessThan(1.45)
  })
  it('applies random variation', () => {
    const km = distanceKm(sin, kul)
    expect(jobReward('passenger', 30, km, sin, kul, 0.1)).toBeGreaterThan(jobReward('passenger', 30, km, sin, kul, -0.1))
  })
})

describe('job board refresh', () => {
  const INTERVAL = BALANCE.jobs.refreshIntervalMs
  const base = () => {
    const g = makeGame({ unlock: ['KUL', 'BKK'] })
    return { ...g, jobEpoch: 1_000_000, jobBatch: 0 }
  }

  it('leaves the boards alone until the cycle is up', () => {
    const g = base()
    const before = g.jobs.map((j) => j.id)
    const r = refreshJobsIfDue(g, g.jobEpoch + INTERVAL - 1)
    expect(r.refreshed).toBe(false)
    expect(r.game).toBe(g)
    expect(r.game.jobs.map((j) => j.id)).toEqual(before)
  })

  it('replaces waiting jobs with a fresh board', () => {
    const g = base()
    const before = new Set(waitingJobsAt(g.jobs, 'SIN').map((j) => j.id))
    expect(before.size).toBeGreaterThan(0)
    const r = refreshJobsIfDue(g, g.jobEpoch + INTERVAL)
    expect(r.refreshed).toBe(true)
    const after = waitingJobsAt(r.game.jobs, 'SIN')
    expect(after.length).toBeGreaterThan(0)
    expect(after.some((j) => before.has(j.id))).toBe(false)
    expect(r.game.jobBatch).toBe(1)
    expect(checkInvariants(r.game)).toEqual([])
  })

  it('keeps loaded jobs and jobs waiting at a layover', () => {
    const g0 = base()
    const loadedJob = waitingJobsAt(g0.jobs, 'SIN')[0]
    const loaded = loadJob(g0, g0.aircraft[0].id, loadedJob.id)
    if (!loaded.ok) throw new Error(loaded.error)
    // A job parked at a layover: onboard, flown elsewhere, then set down.
    const layover = { ...waitingJobsAt(loaded.value.jobs, 'SIN')[0], status: 'at_layover' as const, currentAirport: 'KUL', aircraftId: null }
    const g: GameCore = { ...loaded.value, jobs: loaded.value.jobs.map((j) => (j.id === layover.id ? layover : j)) }

    const r = refreshJobsIfDue(g, g.jobEpoch + INTERVAL)
    expect(r.game.jobs.find((j) => j.id === loadedJob.id)).toMatchObject({ status: 'loaded' })
    expect(r.game.jobs.find((j) => j.id === layover.id)).toMatchObject({ status: 'at_layover', currentAirport: 'KUL' })
    expect(r.game.aircraft[0].loadedJobIds).toContain(loadedJob.id)
    expect(checkInvariants(r.game)).toEqual([])
  })

  it('catches up with one fresh board after a long absence, not one per cycle', () => {
    const g = base()
    const r = refreshJobsIfDue(g, g.jobEpoch + INTERVAL * 7.5)
    expect(r.game.jobBatch).toBe(7)
    // Seven cycles would have burned seven boards' worth of job numbers.
    const oneCycle = refreshJobsIfDue(g, g.jobEpoch + INTERVAL)
    expect(r.game.nextJobNumber).toBe(oneCycle.game.nextJobNumber)
    expect(refreshJobsIfDue(r.game, g.jobEpoch + INTERVAL * 7.9).refreshed).toBe(false)
  })

  it('is deterministic for the same state and time', () => {
    const g = base()
    const a = refreshJobsIfDue(g, g.jobEpoch + INTERVAL).game
    const b = refreshJobsIfDue(g, g.jobEpoch + INTERVAL).game
    expect(a.jobs).toEqual(b.jobs)
  })

  it('reports when the next refresh is due', () => {
    const g = base()
    expect(nextJobRefreshAt(g, g.jobEpoch)).toBe(g.jobEpoch + INTERVAL)
    expect(nextJobRefreshAt(g, g.jobEpoch + INTERVAL * 2.5)).toBe(g.jobEpoch + INTERVAL * 3)
  })
})
