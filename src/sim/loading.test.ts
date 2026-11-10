import { describe, expect, it } from 'vitest'
import { getAircraftModel } from '../data/aircraft'
import { purchaseAircraft } from './aircraft'
import type { GameCore } from './core'
import { aircraftLoad, dismissJob, jobFitBlocker, loadAllTowards, loadJob, unloadJob } from './loading'
import { refillThreshold, waitingJobsAt } from './jobs'
import { getAirport } from '../data/airports'
import { checkInvariants, makeGame } from './testUtils'
import type { Job } from '../types/game'

const setup = () => makeGame({ unlock: ['KUL'] })
const sinJobs = (g: GameCore, kind: Job['kind']) => waitingJobsAt(g.jobs, 'SIN').filter((j) => j.kind === kind)

/** Replace a game's jobs with hand-made ones at SIN so capacity cases are exact. */
function withJobs(g: GameCore, defs: Array<Pick<Job, 'kind' | 'quantity'>>): GameCore {
  const jobs: Job[] = defs.map((d, i) => ({
    id: `t-${i}`,
    kind: d.kind,
    origin: 'SIN',
    destination: 'KUL',
    quantity: d.quantity,
    reward: 1000,
    currentAirport: 'SIN',
    aircraftId: null,
    status: 'waiting',
  }))
  return { ...g, jobs: [...jobs, ...g.jobs.filter((j) => j.currentAirport !== 'SIN')], nextJobNumber: 9999 }
}

describe('loading', () => {
  it('loads a waiting job onto a parked aircraft at the same airport', () => {
    const g = setup()
    const job = sinJobs(g, 'passenger').find((j) => j.quantity <= 115)!
    const a = g.aircraft[0]
    const r = loadJob(g, a.id, job.id)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const loaded = r.value.jobs.find((j) => j.id === job.id)!
    expect(loaded.status).toBe('loaded')
    expect(loaded.aircraftId).toBe(a.id)
    expect(r.value.aircraft[0].loadedJobIds).toEqual([job.id])
    expect(r.value.aircraft[0].status).toBe('loading')
    expect(aircraftLoad(r.value.jobs, a.id).pax).toBe(job.quantity)
    expect(checkInvariants(r.value)).toEqual([])
    expect(g.jobs.find((j) => j.id === job.id)!.status).toBe('waiting') // input untouched
  })

  it('enforces passenger capacity and explains why', () => {
    const g = withJobs(setup(), [
      { kind: 'passenger', quantity: 100 },
      { kind: 'passenger', quantity: 20 },
      { kind: 'passenger', quantity: 15 },
    ])
    const a = g.aircraft[0] // 115 seats
    const one = loadJob(g, a.id, 't-0')
    if (!one.ok) throw new Error(one.error)
    const two = loadJob(one.value, a.id, 't-1')
    expect(two.ok).toBe(false)
    if (!two.ok) expect(two.error).toBe('Not enough seats: needs 20, 15 free.')
    const three = loadJob(one.value, a.id, 't-2') // exactly fills the cabin
    expect(three.ok).toBe(true)
  })

  it('enforces cargo capacity and explains why', () => {
    const g = withJobs(setup(), [
      { kind: 'cargo', quantity: 1000 },
      { kind: 'cargo', quantity: 300 },
      { kind: 'cargo', quantity: 200 },
    ])
    const a = g.aircraft[0] // 1,200 kg
    const one = loadJob(g, a.id, 't-0')
    if (!one.ok) throw new Error(one.error)
    const two = loadJob(one.value, a.id, 't-1')
    expect(two.ok).toBe(false)
    if (!two.ok) expect(two.error).toBe('Not enough cargo space: needs 300 kg, 200 kg free.')
    expect(loadJob(one.value, a.id, 't-2').ok).toBe(true)
  })

  it('keeps passenger and cargo capacities independent', () => {
    const g = withJobs(setup(), [
      { kind: 'passenger', quantity: 115 },
      { kind: 'cargo', quantity: 1200 },
    ])
    const a = g.aircraft[0]
    const p = loadJob(g, a.id, 't-0')
    if (!p.ok) throw new Error(p.error)
    const c = loadJob(p.value, a.id, 't-1')
    expect(c.ok).toBe(true)
    if (c.ok) expect(aircraftLoad(c.value.jobs, a.id)).toEqual({ pax: 115, cargoKg: 1200 })
  })

  it('refuses a job at another airport, one already loaded, and a moving aircraft', () => {
    const g = setup()
    const kulJob = waitingJobsAt(g.jobs, 'KUL')[0]
    const a = g.aircraft[0]
    const wrongPlace = loadJob(g, a.id, kulJob.id)
    expect(wrongPlace.ok).toBe(false)
    if (!wrongPlace.ok) expect(wrongPlace.error).toMatch(/is at KUL, but .* is at SIN/)

    const job = sinJobs(g, 'passenger').find((j) => j.quantity <= 115)!
    const once = loadJob(g, a.id, job.id)
    if (!once.ok) throw new Error(once.error)
    const twice = loadJob(once.value, g.aircraft[1].id, job.id)
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.error).toMatch(/already loaded/)

    const flying = { ...g.aircraft[0], airport: null, status: 'cruising' as const }
    expect(jobFitBlocker(flying, getAircraftModel(a.modelId)!, g.jobs, job)).toMatch(/must be parked/)
    expect(loadJob(g, 'nope', job.id).ok).toBe(false)
    expect(loadJob(g, a.id, 'nope').ok).toBe(false)
  })

  it('unloads a job back to the airport and restores the parked status', () => {
    const g = setup()
    const job = sinJobs(g, 'passenger').find((j) => j.quantity <= 115)!
    const a = g.aircraft[0]
    const loaded = loadJob(g, a.id, job.id)
    if (!loaded.ok) throw new Error(loaded.error)
    const back = unloadJob(loaded.value, a.id, job.id)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    const j = back.value.jobs.find((x) => x.id === job.id)!
    expect(j.status).toBe('waiting')
    expect(j.aircraftId).toBeNull()
    expect(j.currentAirport).toBe('SIN')
    expect(back.value.aircraft[0].loadedJobIds).toEqual([])
    expect(back.value.aircraft[0].status).toBe('parked')
    expect(checkInvariants(back.value)).toEqual([])
    expect(unloadJob(back.value, a.id, job.id).ok).toBe(false) // already off
  })

  it('never duplicates or loses a job across load/unload cycles', () => {
    let g = setup()
    const a = g.aircraft[0]
    const job = sinJobs(g, 'cargo').find((j) => j.quantity <= 1200)!
    for (let i = 0; i < 5; i++) {
      const l = loadJob(g, a.id, job.id)
      if (!l.ok) throw new Error(l.error)
      const u = unloadJob(l.value, a.id, job.id)
      if (!u.ok) throw new Error(u.error)
      g = u.value
    }
    expect(g.jobs.filter((j) => j.id === job.id)).toHaveLength(1)
    expect(checkInvariants(g)).toEqual([])
  })

  it('refills the board when loading drains it below the threshold', () => {
    let g = setup()
    const a = g.aircraft[0]
    const threshold = refillThreshold(getAirport('SIN')!)
    for (let guard = 0; guard < 80; guard++) {
      const fit = waitingJobsAt(g.jobs, 'SIN').find((j) => !jobFitBlocker(g.aircraft[0], getAircraftModel(a.modelId)!, g.jobs, j))
      if (!fit) break
      const r = loadJob(g, a.id, fit.id)
      if (!r.ok) break
      g = r.value
      expect(waitingJobsAt(g.jobs, 'SIN').length).toBeGreaterThanOrEqual(Math.min(threshold, 1))
    }
    expect(waitingJobsAt(g.jobs, 'SIN').length).toBeGreaterThanOrEqual(threshold)
    expect(checkInvariants(g)).toEqual([])
  })

  it('lets a bigger aircraft carry jobs a small one cannot', () => {
    const g0 = withJobs(setup(), [{ kind: 'cargo', quantity: 2500 }])
    const bought = purchaseAircraft(g0, 'a320neo')
    if (!bought.ok) throw new Error(bought.error)
    const g = bought.value.game
    expect(loadJob(g, g.aircraft[0].id, 't-0').ok).toBe(false) // A220-100: 1,200 kg
    expect(loadJob(g, bought.value.aircraft.id, 't-0').ok).toBe(true) // A320neo: 2,800 kg
  })
})

describe('dismissJob', () => {
  it('removes a waiting job but not a loaded one', () => {
    const g = setup()
    const job = sinJobs(g, 'passenger').find((j) => j.quantity <= 115)!
    const d = dismissJob(g, job.id)
    expect(d.ok).toBe(true)
    if (d.ok) expect(d.value.jobs.some((j) => j.id === job.id)).toBe(false)
    const l = loadJob(g, g.aircraft[0].id, job.id)
    if (!l.ok) throw new Error(l.error)
    expect(dismissJob(l.value, job.id).ok).toBe(false)
    expect(dismissJob(g, 'nope').ok).toBe(false)
  })
})

describe('loading everything for one destination', () => {
  const setup = () => {
    const g = makeGame({ unlock: ['KUL', 'BKK'] })
    // Six small passenger jobs to KUL, one to BKK, so only the KUL ones should load.
    const waiting = waitingJobsAt(g.jobs, 'SIN')
    const jobs = g.jobs.map((j, i) =>
      waiting.includes(j)
        ? { ...j, kind: 'passenger' as const, quantity: 20, reward: 1000 + i, destination: i % 7 === 0 ? 'BKK' : 'KUL' }
        : j,
    )
    return { ...g, jobs }
  }

  it('fills the aircraft with jobs for that destination, best paying first', () => {
    const g = setup()
    const id = g.aircraft[0].id
    const model = getAircraftModel(g.aircraft[0].modelId)!
    const r = loadAllTowards(g, id, 'KUL')
    if (!r.ok) throw new Error(r.error)
    expect(r.value.loaded).toBeGreaterThan(1)
    const onboard = r.value.game.jobs.filter((j) => j.aircraftId === id)
    expect(onboard.every((j) => j.destination === 'KUL')).toBe(true)
    expect(aircraftLoad(r.value.game.jobs, id).pax).toBeLessThanOrEqual(model.passengerCapacity)
    // Of the jobs that were on the board when loading started, the best-paying went on.
    // (Loading tops the board back up, so later arrivals are not part of this comparison.)
    const offered = new Map(
      g.jobs.filter((j) => j.destination === 'KUL' && j.currentAirport === 'SIN').map((j) => [j.id, j.reward]),
    )
    const takenMin = Math.min(...onboard.map((j) => j.reward))
    const leftMax = Math.max(
      ...r.value.game.jobs
        .filter((j) => offered.has(j.id) && j.aircraftId === null)
        .map((j) => j.reward),
      -Infinity,
    )
    if (Number.isFinite(leftMax)) expect(takenMin).toBeGreaterThanOrEqual(leftMax)
    expect(checkInvariants(r.value.game)).toEqual([])
  })

  it('reports what would not fit instead of failing', () => {
    const g = setup()
    const r = loadAllTowards(g, g.aircraft[0].id, 'KUL')
    if (!r.ok) throw new Error(r.error)
    expect(r.value.leftBehind).toBeGreaterThanOrEqual(0)
    expect(r.value.loaded + r.value.leftBehind).toBe(
      g.jobs.filter((j) => j.destination === 'KUL' && j.currentAirport === 'SIN' && j.aircraftId === null).length,
    )
  })

  it('refuses when nothing is waiting for that destination', () => {
    const g = setup()
    expect(loadAllTowards(g, g.aircraft[0].id, 'HND')).toMatchObject({ ok: false })
    expect(loadAllTowards(g, 'nope', 'KUL')).toMatchObject({ ok: false })
  })
})
