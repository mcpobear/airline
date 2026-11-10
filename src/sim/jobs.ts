import { BALANCE } from '../config/balance'
import { getAirport, type AirportRecord } from '../data/airports'
import type { Job, JobKind } from '../types/game'
import type { GameCore } from './core'
import { distanceKm } from './geo'
import { mixSeed, mulberry32 } from './random'

const J = BALANCE.jobs
const E = BALANCE.economy

/** Jobs available for pickup at an airport (new jobs and layover jobs left there), not onboard anything. */
export function waitingJobsAt(jobs: readonly Job[], iata: string): Job[] {
  return jobs.filter(
    (j) => (j.status === 'waiting' || j.status === 'at_layover') && j.currentAirport === iata && j.aircraftId === null,
  )
}

export const targetJobCount = (a: AirportRecord) => J.targetJobs[a.classification]
export const refillThreshold = (a: AirportRecord) => Math.ceil(targetJobCount(a) * J.refillThresholdFraction)

/** Busier city pairs pay slightly more. Range ~0.9 to 1.4. */
function demandFactor(origin: AirportRecord, dest: AirportRecord): number {
  const d = Math.log10(1 + origin.metroMillions) + Math.log10(1 + dest.metroMillions)
  return Math.min(1.4, Math.max(0.9, 0.85 + 0.15 * d))
}

/**
 * Revenue for delivering a job: rate x quantity x distance x demand x (1 + variation).
 * `variation` is the job's random +/- adjustment (0 for the plain formula).
 */
export function jobReward(
  kind: JobKind,
  quantity: number,
  km: number,
  origin: AirportRecord,
  dest: AirportRecord,
  variation = 0,
): number {
  const rate = kind === 'passenger' ? E.passengerRevenuePerPaxKm : E.cargoRevenuePerKgKm
  const raw = rate * quantity * km * demandFactor(origin, dest) * (1 + variation)
  return Math.max(10, Math.round(raw / 10) * 10)
}

function pickDestination(rand: () => number, origin: AirportRecord, candidates: AirportRecord[]): AirportRecord {
  const weights = candidates.map(
    (d) =>
      (Math.sqrt(d.metroMillions) * J.destinationClassWeight[d.classification]) /
      (1 + distanceKm(origin, d) / J.distanceDecayKm) ** J.distanceDecayPower,
  )
  let r = rand() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

interface Spec {
  kind?: JobKind
  /** Force a destination (must be an unlocked airport); otherwise chosen by weight. */
  destination?: string
}

/**
 * Adds jobs at `iata`, respecting the per-airport cap (never deleting anything).
 * Deterministic: depends only on the game seed, the job counter and the airport.
 */
function addJobs(game: GameCore, iata: string, specs: Spec[]): GameCore {
  const origin = getAirport(iata)
  if (!origin || !game.unlockedAirports.includes(iata)) return game
  const candidates = game.unlockedAirports.filter((c) => c !== iata).map((c) => getAirport(c)!)
  if (candidates.length === 0) return game
  const room = J.maxWaitingJobsPerAirport - waitingJobsAt(game.jobs, iata).length
  const take = specs.slice(0, Math.max(0, room))
  if (take.length === 0) return game

  let n = game.nextJobNumber
  const rand = mulberry32(mixSeed(game.seed, n, ...[...iata].map((c) => c.charCodeAt(0))))
  const created: Job[] = take.map((spec) => {
    const dest = spec.destination ? getAirport(spec.destination)! : pickDestination(rand, origin, candidates)
    const kind: JobKind = spec.kind ?? (rand() < J.cargoShare[origin.classification] ? 'cargo' : 'passenger')
    const skew = rand() ** 2 // many small jobs, a few big ones
    const quantity =
      kind === 'passenger'
        ? J.minPassengers + Math.floor(skew * (J.maxPassengers[origin.classification] - J.minPassengers))
        : Math.round((J.minCargoKg + skew * (J.maxCargoKg[origin.classification] - J.minCargoKg)) / 10) * 10
    const variation = (rand() * 2 - 1) * J.rewardVariation
    return {
      id: `job-${n++}`,
      kind,
      origin: iata,
      destination: dest.iata,
      quantity,
      reward: jobReward(kind, quantity, distanceKm(origin, dest), origin, dest, variation),
      currentAirport: iata,
      aircraftId: null,
      status: 'waiting',
    }
  })
  return { ...game, jobs: [...game.jobs, ...created], nextJobNumber: n }
}

/** Makes sure at least `min` jobs wait at `from` for `to` (so a flight there always has something to carry). */
export function ensureJobsTowards(game: GameCore, from: string, to: string, min: number): GameCore {
  if (from === to || !game.unlockedAirports.includes(to)) return game
  const have = waitingJobsAt(game.jobs, from).filter((j) => j.destination === to).length
  const need = min - have
  if (need <= 0) return game
  const specs: Spec[] = Array.from({ length: need }, (_, i) => ({
    destination: to,
    kind: i % 2 === 0 ? 'passenger' : 'cargo',
  }))
  return addJobs(game, from, specs)
}

/** Guarantees return jobs: some towards the HQ and the nearest other unlocked airports. */
export function ensureReturnJobs(game: GameCore, iata: string): GameCore {
  const here = getAirport(iata)
  if (!here) return game
  const hq = game.airline.hq
  let g = game
  if (iata !== hq) g = ensureJobsTowards(g, iata, hq, J.returnGuarantee.toHq)
  const nearest = game.unlockedAirports
    .filter((c) => c !== iata && c !== hq)
    .map((c) => ({ c, km: distanceKm(here, getAirport(c)!) }))
    .sort((a, b) => a.km - b.km || a.c.localeCompare(b.c))
    .slice(0, J.returnGuarantee.nearestCount)
  for (const { c } of nearest) g = ensureJobsTowards(g, iata, c, J.returnGuarantee.toNearest)
  return g
}

/** Tops an airport up to its target when it has dropped below the refill threshold. */
export function refillAirport(game: GameCore, iata: string): GameCore {
  const a = getAirport(iata)
  if (!a || !game.unlockedAirports.includes(iata)) return game
  const waiting = waitingJobsAt(game.jobs, iata).length
  if (waiting >= refillThreshold(a)) return game
  const missing = targetJobCount(a) - waiting
  const g = addJobs(game, iata, Array.from({ length: missing }, () => ({})))
  return ensureReturnJobs(g, iata)
}

/** A new airport gets its own jobs, and the HQ and nearest airports get jobs towards it. */
export function onAirportUnlocked(game: GameCore, iata: string): GameCore {
  const a = getAirport(iata)
  if (!a) return game
  let g = addJobs(game, iata, Array.from({ length: targetJobCount(a) }, () => ({})))
  g = ensureReturnJobs(g, iata)
  const hq = g.airline.hq
  const feeders = g.unlockedAirports
    .filter((c) => c !== iata && c !== hq)
    .map((c) => ({ c, km: distanceKm(a, getAirport(c)!) }))
    .sort((x, y) => x.km - y.km || x.c.localeCompare(y.c))
    .slice(0, J.newAirportFeeders)
    .map((x) => x.c)
  if (hq !== iata) g = ensureJobsTowards(g, hq, iata, J.jobsToNewAirportFromHq)
  for (const f of feeders) g = ensureJobsTowards(g, f, iata, J.jobsToNewAirport)
  return g
}
