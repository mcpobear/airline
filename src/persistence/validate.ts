import { getAircraftModel } from '../data/aircraft'
import { getAirport } from '../data/airports'

const STATUSES = ['parked', 'loading', 'departing', 'cruising', 'arriving']
const JOB_STATUSES = ['waiting', 'loaded', 'in_transit', 'at_layover', 'delivered']

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const str = (x: unknown): x is string => typeof x === 'string' && x.length > 0
const known = (x: unknown): x is string => str(x) && !!getAirport(x)

/**
 * Structural validation of a game loaded from storage or an import. Returns
 * the first problem found, or null when the data is safe to load. A save that
 * fails here is never loaded and never overwritten.
 */
export function validateGame(g: unknown): string | null {
  if (!isObj(g)) return 'game data is missing'
  const { airline, unlockedAirports, aircraft, jobs, settings } = g
  if (!isObj(airline)) return 'airline is missing'
  if (!str(airline.name)) return 'airline name is invalid'
  if (!known(airline.hq)) return 'headquarters is not a known airport'
  for (const k of ['cash', 'lifetimeRevenue', 'lifetimeOperatingCost', 'jobsDelivered'] as const) {
    if (!num(airline[k])) return `airline.${k} is not a number`
  }
  if (!Array.isArray(unlockedAirports) || !unlockedAirports.every(known)) return 'unlocked airports are invalid'
  if (new Set(unlockedAirports).size !== unlockedAirports.length) return 'duplicate unlocked airports'
  if (!unlockedAirports.includes(airline.hq)) return 'headquarters is not unlocked'
  if (!isObj(settings) || typeof settings.futureAircraft !== 'boolean') return 'settings are invalid'
  if (!num(g.seed)) return 'seed is invalid'
  for (const k of ['nextAircraftNumber', 'nextJobNumber'] as const) {
    if (!num(g[k]) || !Number.isInteger(g[k]) || (g[k] as number) < 1) return `${k} is invalid`
  }
  if (!num(g.jobEpoch) || g.jobEpoch < 0) return 'job clock is invalid'
  if (!num(g.jobBatch) || !Number.isInteger(g.jobBatch) || (g.jobBatch as number) < 0) return 'job cycle is invalid'
  if (!Array.isArray(aircraft) || !Array.isArray(jobs)) return 'aircraft or jobs list is missing'

  const aircraftById = new Map<string, Record<string, unknown>>()
  for (const a of aircraft) {
    if (!isObj(a) || !str(a.id)) return 'an aircraft has no id'
    if (aircraftById.has(a.id)) return `duplicate aircraft ${a.id}`
    aircraftById.set(a.id, a)
    if (!str(a.name) || !str(a.registration)) return `aircraft ${a.id} has no name or registration`
    if (!str(a.modelId) || !getAircraftModel(a.modelId)) return `aircraft ${a.id} has an unknown model`
    if (!STATUSES.includes(a.status as string)) return `aircraft ${a.id} has an invalid status`
    if (a.airport !== null && !known(a.airport)) return `aircraft ${a.id} is at an unknown airport`
    if (!num(a.lifetimeRevenue) || !num(a.lifetimeOperatingCost) || !num(a.purchasePrice)) return `aircraft ${a.id} has invalid finances`
    if (!Array.isArray(a.loadedJobIds) || !a.loadedJobIds.every(str)) return `aircraft ${a.id} has an invalid load list`
    const f = a.flight
    if (f !== null) {
      if (!isObj(f) || !known(f.from) || !known(f.to) || !num(f.departedAt) || !num(f.arrivesAt) || !num(f.distanceKm)) {
        return `aircraft ${a.id} has an invalid flight`
      }
      if (f.arrivesAt <= f.departedAt) return `aircraft ${a.id} has a flight that ends before it starts`
    }
    if ((f === null) === (a.airport === null)) return `aircraft ${a.id} must be either parked or flying`
  }

  const jobIds = new Set<string>()
  for (const j of jobs) {
    if (!isObj(j) || !str(j.id)) return 'a job has no id'
    if (jobIds.has(j.id)) return `duplicate job ${j.id}`
    jobIds.add(j.id)
    if (j.kind !== 'passenger' && j.kind !== 'cargo') return `job ${j.id} has an invalid kind`
    if (!known(j.origin) || !known(j.destination) || j.origin === j.destination) return `job ${j.id} has an invalid route`
    if (!num(j.quantity) || j.quantity <= 0 || !num(j.reward) || j.reward <= 0) return `job ${j.id} has an invalid size or reward`
    if (!JOB_STATUSES.includes(j.status as string)) return `job ${j.id} has an invalid status`
    if (j.currentAirport !== null && !known(j.currentAirport)) return `job ${j.id} is at an unknown airport`
    if (j.aircraftId !== null) {
      const a = aircraftById.get(j.aircraftId as string)
      if (!a) return `job ${j.id} is on a missing aircraft`
      if (!(a.loadedJobIds as string[]).includes(j.id)) return `job ${j.id} and its aircraft disagree`
    }
  }
  for (const a of aircraftById.values()) {
    for (const id of a.loadedJobIds as string[]) if (!jobIds.has(id)) return `aircraft ${a.id} carries a missing job`
  }
  return null
}
