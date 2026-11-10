import { getAircraftModel } from '../data/aircraft'
import type { AircraftModel, Job, OwnedAircraft } from '../types/game'
import type { GameCore, Result } from './core'
import { refillAirport } from './jobs'

/** Passengers and cargo currently onboard (the two capacities are independent). */
export function aircraftLoad(jobs: readonly Job[], aircraftId: string): { pax: number; cargoKg: number } {
  let pax = 0
  let cargoKg = 0
  for (const j of jobs) {
    if (j.aircraftId !== aircraftId) continue
    if (j.kind === 'passenger') pax += j.quantity
    else cargoKg += j.quantity
  }
  return { pax, cargoKg }
}

/** Why `job` can't be loaded onto `aircraft` right now, or null if it can. */
export function jobFitBlocker(
  aircraft: OwnedAircraft,
  model: AircraftModel,
  jobs: readonly Job[],
  job: Job,
): string | null {
  if (aircraft.airport === null || aircraft.flight !== null || (aircraft.status !== 'parked' && aircraft.status !== 'loading')) {
    return `${aircraft.name} must be parked to load jobs.`
  }
  if (job.aircraftId !== null) return 'That job is already loaded on an aircraft.'
  if (job.status !== 'waiting' && job.status !== 'at_layover') return "That job isn't waiting for pickup."
  if (job.currentAirport !== aircraft.airport) {
    return `That job is at ${job.currentAirport}, but ${aircraft.name} is at ${aircraft.airport}.`
  }
  const load = aircraftLoad(jobs, aircraft.id)
  if (job.kind === 'passenger') {
    const free = model.passengerCapacity - load.pax
    if (job.quantity > free) return `Not enough seats: needs ${job.quantity}, ${free} free.`
  } else {
    const free = model.cargoCapacityKg - load.cargoKg
    if (job.quantity > free) {
      return `Not enough cargo space: needs ${job.quantity.toLocaleString('en-US')} kg, ${free.toLocaleString('en-US')} kg free.`
    }
  }
  return null
}

const replaceJob = (jobs: Job[], updated: Job) => jobs.map((j) => (j.id === updated.id ? updated : j))
const hasCargo = (jobs: readonly Job[], id: string) => jobs.some((j) => j.aircraftId === id)

function withStatus(a: OwnedAircraft, jobs: readonly Job[]): OwnedAircraft {
  if (a.status !== 'parked' && a.status !== 'loading') return a
  return { ...a, status: hasCargo(jobs, a.id) ? 'loading' : 'parked' }
}

/** Pure: loads a waiting job onto a parked aircraft at the same airport. Never duplicates a job. */
export function loadJob(game: GameCore, aircraftId: string, jobId: string): Result<GameCore> {
  const aircraft = game.aircraft.find((a) => a.id === aircraftId)
  if (!aircraft) return { ok: false, error: 'Unknown aircraft.' }
  const job = game.jobs.find((j) => j.id === jobId)
  if (!job) return { ok: false, error: 'That job no longer exists.' }
  const model = getAircraftModel(aircraft.modelId)!
  const blocker = jobFitBlocker(aircraft, model, game.jobs, job)
  if (blocker) return { ok: false, error: blocker }

  const jobs = replaceJob(game.jobs, { ...job, status: 'loaded', aircraftId })
  const updated: OwnedAircraft = withStatus(
    { ...aircraft, loadedJobIds: [...aircraft.loadedJobIds, jobId] },
    jobs,
  )
  const next: GameCore = {
    ...game,
    jobs,
    aircraft: game.aircraft.map((a) => (a.id === aircraftId ? updated : a)),
  }
  // The job left the board: top the airport back up if it has run low.
  return { ok: true, value: refillAirport(next, aircraft.airport!) }
}

/**
 * Pure: takes a job off a parked aircraft, leaving it at the airport. At its
 * origin it is "waiting"; anywhere else it is "at layover". Jobs returned to a
 * full board are kept (the cap only limits generation, never deletes jobs).
 */
export function unloadJob(game: GameCore, aircraftId: string, jobId: string): Result<GameCore> {
  const aircraft = game.aircraft.find((a) => a.id === aircraftId)
  if (!aircraft) return { ok: false, error: 'Unknown aircraft.' }
  if (aircraft.airport === null || aircraft.flight !== null) {
    return { ok: false, error: `${aircraft.name} must be parked to unload jobs.` }
  }
  const job = game.jobs.find((j) => j.id === jobId)
  if (!job || job.aircraftId !== aircraftId) return { ok: false, error: 'That job is not on this aircraft.' }

  const jobs = replaceJob(game.jobs, {
    ...job,
    status: aircraft.airport === job.origin ? 'waiting' : 'at_layover',
    aircraftId: null,
    currentAirport: aircraft.airport,
  })
  const updated = withStatus(
    { ...aircraft, loadedJobIds: aircraft.loadedJobIds.filter((id) => id !== jobId) },
    jobs,
  )
  return {
    ok: true,
    value: { ...game, jobs, aircraft: game.aircraft.map((a) => (a.id === aircraftId ? updated : a)) },
  }
}

/** Pure: the player manually removes a waiting job from an airport. Loaded jobs can't be dismissed. */
export function dismissJob(game: GameCore, jobId: string): Result<GameCore> {
  const job = game.jobs.find((j) => j.id === jobId)
  if (!job) return { ok: false, error: 'That job no longer exists.' }
  if (job.aircraftId !== null || (job.status !== 'waiting' && job.status !== 'at_layover')) {
    return { ok: false, error: 'Unload the job from its aircraft before dismissing it.' }
  }
  const next = { ...game, jobs: game.jobs.filter((j) => j.id !== jobId) }
  return { ok: true, value: refillAirport(next, job.currentAirport!) }
}
