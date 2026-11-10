import { describe, expect, it } from 'vitest'
import { BALANCE } from '../config/balance'
import { getAirport } from '../data/airports'
import { distanceKm } from './geo'
import { ensureJobsTowards, jobReward, refillAirport, targetJobCount, waitingJobsAt } from './jobs'
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
