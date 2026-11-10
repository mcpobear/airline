import { BALANCE } from '../config/balance'
import { getAircraftModel } from '../data/aircraft'
import { getAirport } from '../data/airports'
import type { AircraftModel, Flight, OwnedAircraft } from '../types/game'
import { canOperateAt } from './aircraft'
import type { GameCore, Result } from './core'
import { distanceKm } from './geo'
import { flightProgress, flightWindows, phaseAt } from './flightProfile'
import { ensureJobsTowards, ensureReturnJobs, refillAirport } from './jobs'

const T = BALANCE.time
const E = BALANCE.economy

/**
 * Game-time duration of a flight in milliseconds. One real flight-hour lasts
 * one game minute (acceleration 60x); a fixed allowance covers climb, descent
 * and ground operations. Derived from distance and speed, never per city pair.
 */
export function flightDurationMs(km: number, model: AircraftModel): number {
  const realHours = km / model.cruiseSpeedKmh + T.flightOverheadMinutes / 60
  return Math.round((realHours * 3_600_000) / T.flightTimeAcceleration)
}

/** Operating cost of one flight: distance x the aircraft's cost per km, plus a fixed departure cost. */
export function flightCost(model: AircraftModel, km: number): number {
  return Math.round(km * model.operatingCostPerKm + E.departureFixedCost)
}

const money = (n: number) => `$${Math.floor(n).toLocaleString('en-US')}`

/** Why this aircraft can't fly to `destIata` right now, or null if it can. */
export function dispatchBlocker(game: GameCore, aircraftId: string, destIata: string): string | null {
  const a = game.aircraft.find((x) => x.id === aircraftId)
  if (!a) return 'Unknown aircraft.'
  if (a.flight || a.airport === null || (a.status !== 'parked' && a.status !== 'loading')) {
    return `${a.name} is already in flight.`
  }
  const model = getAircraftModel(a.modelId)!
  const from = getAirport(a.airport)!
  const dest = getAirport(destIata)
  if (!dest) return `Unknown destination "${destIata}".`
  if (dest.iata === from.iata) return 'Choose a destination other than where the aircraft is parked.'
  if (!game.unlockedAirports.includes(destIata)) return `Unlock ${dest.city} (${destIata}) before flying there.`

  const km = distanceKm(from, dest)
  if (km > model.rangeKm) {
    return `Out of range: ${Math.round(km).toLocaleString('en-US')} km, but the ${model.model} reaches ${model.rangeKm.toLocaleString('en-US')} km. Try a stopover.`
  }
  for (const airport of [from, dest]) {
    if (!canOperateAt(model, airport)) {
      return `${airport.city} (${airport.iata}) is a ${airport.classification} airport and can't handle ${model.airportCategory}-category aircraft.`
    }
  }
  const cost = flightCost(model, km)
  if (game.airline.cash < cost) {
    return `Not enough cash for operating costs: need ${money(cost)}, have ${money(game.airline.cash)}.`
  }
  // Every job onboard must either be delivered at the destination or get closer to its own.
  for (const job of game.jobs) {
    if (job.aircraftId !== a.id || job.destination === destIata) continue
    const jobDest = getAirport(job.destination)!
    if (distanceKm(dest, jobDest) >= distanceKm(from, jobDest)) {
      return `Job ${job.origin} → ${job.destination} wouldn't get closer to ${job.destination} on this flight. Unload it or pick another destination.`
    }
  }
  return null
}

/** Pure: sends a parked aircraft to an unlocked airport. Operating cost is charged now; revenue is paid on delivery. */
export function dispatchFlight(
  game: GameCore,
  aircraftId: string,
  destIata: string,
  now: number,
): Result<GameCore> {
  const blocker = dispatchBlocker(game, aircraftId, destIata)
  if (blocker) return { ok: false, error: blocker }
  const a = game.aircraft.find((x) => x.id === aircraftId)!
  const model = getAircraftModel(a.modelId)!
  const km = distanceKm(getAirport(a.airport!)!, getAirport(destIata)!)
  const cost = flightCost(model, km)
  const flight: Flight = {
    from: a.airport!,
    to: destIata,
    departedAt: now,
    arrivesAt: now + flightDurationMs(km, model),
    distanceKm: Math.round(km),
  }
  const flying: OwnedAircraft = {
    ...a,
    airport: null,
    status: 'departing',
    flight,
    lifetimeOperatingCost: a.lifetimeOperatingCost + cost,
  }
  return {
    ok: true,
    value: {
      ...game,
      airline: {
        ...game.airline,
        cash: game.airline.cash - cost,
        lifetimeOperatingCost: game.airline.lifetimeOperatingCost + cost,
      },
      aircraft: game.aircraft.map((x) => (x.id === aircraftId ? flying : x)),
      jobs: game.jobs.map((j) =>
        j.aircraftId === aircraftId ? { ...j, status: 'in_transit', currentAirport: null } : j,
      ),
    },
  }
}

export interface ArrivalEvent {
  kind: 'arrival'
  aircraftId: string
  aircraftName: string
  from: string
  airport: string
  /** Jobs delivered (and paid) by this arrival. */
  delivered: number
  revenue: number
  /** Jobs still onboard for a later leg. */
  remainingOnboard: number
}

function arrive(game: GameCore, aircraftId: string): { game: GameCore; event: ArrivalEvent } {
  const a = game.aircraft.find((x) => x.id === aircraftId)!
  const f = a.flight!
  const deliveredJobs = game.jobs.filter((j) => j.aircraftId === aircraftId && j.destination === f.to)
  const revenue = deliveredJobs.reduce((sum, j) => sum + j.reward, 0)
  const deliveredIds = new Set(deliveredJobs.map((j) => j.id))

  const jobs = game.jobs
    .filter((j) => !deliveredIds.has(j.id))
    .map((j) => (j.aircraftId === aircraftId ? { ...j, status: 'loaded' as const, currentAirport: f.to } : j))
  const remaining = a.loadedJobIds.filter((id) => !deliveredIds.has(id))
  const landed: OwnedAircraft = {
    ...a,
    airport: f.to,
    flight: null,
    status: remaining.length > 0 ? 'loading' : 'parked',
    loadedJobIds: remaining,
    lifetimeRevenue: a.lifetimeRevenue + revenue,
  }
  let g: GameCore = {
    ...game,
    airline: {
      ...game.airline,
      cash: game.airline.cash + revenue,
      lifetimeRevenue: game.airline.lifetimeRevenue + revenue,
      jobsDelivered: game.airline.jobsDelivered + deliveredJobs.length,
    },
    aircraft: game.aircraft.map((x) => (x.id === aircraftId ? landed : x)),
    jobs,
  }
  // Never arrive to an empty board: some jobs back towards where we came from, towards the HQ and nearby airports.
  g = ensureJobsTowards(g, f.to, f.from, 1)
  g = ensureReturnJobs(g, f.to)
  g = refillAirport(g, f.to)
  return {
    game: g,
    event: {
      kind: 'arrival',
      aircraftId,
      aircraftName: a.name,
      from: f.from,
      airport: f.to,
      delivered: deliveredJobs.length,
      revenue,
      remainingOnboard: remaining.length,
    },
  }
}

/**
 * Brings the game up to `now`: lands every aircraft whose arrival time has
 * passed (paying each delivered job exactly once, because landing removes the
 * flight) and keeps in-flight statuses (departing/cruising/arriving) current.
 *
 * It depends only on the persisted timestamps, so it is the same code for a
 * normal tick and for catching up after the browser was closed. Returns the
 * same game object, and no events, when nothing changed.
 */
export function advanceFlights(game: GameCore, now: number): { game: GameCore; events: ArrivalEvent[] } {
  const flying = game.aircraft
    .filter((a) => a.flight)
    .sort((x, y) => x.flight!.arrivesAt - y.flight!.arrivesAt || x.id.localeCompare(y.id))
  if (flying.length === 0) return { game, events: [] }

  let g = game
  const events: ArrivalEvent[] = []
  for (const { id } of flying) {
    const a = g.aircraft.find((x) => x.id === id)!
    const f = a.flight!
    if (now >= f.arrivesAt) {
      const r = arrive(g, id)
      g = r.game
      events.push(r.event)
    } else {
      const status = phaseAt(flightProgress(f, now), flightWindows(f))
      if (a.status !== status) {
        g = { ...g, aircraft: g.aircraft.map((x) => (x.id === id ? { ...x, status } : x)) }
      }
    }
  }
  return { game: g, events }
}
