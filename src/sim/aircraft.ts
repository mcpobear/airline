import { BALANCE } from '../config/balance'
import { getAircraftModel } from '../data/aircraft'
import { getAirport, type AirportRecord } from '../data/airports'
import type { AircraftModel, AirportCategory, OwnedAircraft } from '../types/game'
import type { GameCore, GameSettings, Result } from './core'
import type { LatLon } from './geo'
import { flightPosition } from './flightProfile'
import { generateRegistration } from './registration'

const ORDER: AirportCategory[] = ['small', 'medium', 'large', 'heavy']
export const categoryRank = (c: AirportCategory) => ORDER.indexOf(c)

export function maxCategoryAt(airport: AirportRecord): AirportCategory {
  return BALANCE.aircraft.airportMaxCategory[airport.classification]
}

/** Can this aircraft land at / depart from this airport? */
export function canOperateAt(model: AircraftModel, airport: AirportRecord): boolean {
  return categoryRank(model.airportCategory) <= categoryRank(maxCategoryAt(airport))
}

/** In-service aircraft are always for sale; future types only when the setting is on. */
export function isAvailable(model: AircraftModel, settings: GameSettings): boolean {
  return model.inService || settings.futureAircraft
}

/** Where an aircraft is at `now`: its airport when parked, or its point along the route when flying. */
export function aircraftPosition(a: OwnedAircraft, now: number = Date.now()): LatLon | null {
  if (a.flight) {
    const { lat, lon } = flightPosition(a.flight, now)
    return { lat, lon }
  }
  const airport = a.airport ? getAirport(a.airport) : undefined
  return airport ? { lat: airport.lat, lon: airport.lon } : null
}

/** Adds an aircraft at the HQ, paying `cashCost` (0 for the free starter jets). */
function deliver(game: GameCore, modelId: string, cashCost: number): { game: GameCore; aircraft: OwnedAircraft } {
  const model = getAircraftModel(modelId)!
  const n = game.nextAircraftNumber
  const hq = getAirport(game.airline.hq)!
  const taken = new Set(game.aircraft.map((a) => a.registration))
  const aircraft: OwnedAircraft = {
    id: `ac-${n}`,
    name: `${model.model} #${n}`,
    registration: generateRegistration(hq.country, game.seed, n, taken),
    modelId,
    airport: hq.iata,
    status: 'parked',
    flight: null,
    loadedJobIds: [],
    lifetimeRevenue: 0,
    lifetimeOperatingCost: 0,
    purchasePrice: model.price,
  }
  return {
    aircraft,
    game: {
      ...game,
      airline: { ...game.airline, cash: game.airline.cash - cashCost },
      aircraft: [...game.aircraft, aircraft],
      nextAircraftNumber: n + 1,
    },
  }
}

/** The free starter fleet given to a new airline. */
export function addStarterFleet(game: GameCore): GameCore {
  let g = game
  for (let i = 0; i < BALANCE.aircraft.starterCount; i++) {
    g = deliver(g, BALANCE.aircraft.starterModelId, 0).game
  }
  return g
}

/** Why this aircraft can't be bought right now, or null if it can. */
export function purchaseBlocker(game: GameCore, modelId: string): string | null {
  const model = getAircraftModel(modelId)
  if (!model) return `Unknown aircraft "${modelId}".`
  if (!isAvailable(model, game.settings)) return `${model.model} is not in airline service yet.`
  const hq = getAirport(game.airline.hq)!
  if (!canOperateAt(model, hq)) {
    return `Your HQ ${hq.city} (${hq.iata}) is a ${hq.classification} airport and can't handle ${model.airportCategory}-category aircraft.`
  }
  if (game.airline.cash < model.price) {
    return `Not enough cash: need $${model.price.toLocaleString('en-US')}, have $${Math.floor(game.airline.cash).toLocaleString('en-US')}.`
  }
  return null
}

/** Pure: deducts the price and delivers a new aircraft to the headquarters. */
export function purchaseAircraft(
  game: GameCore,
  modelId: string,
): Result<{ game: GameCore; aircraft: OwnedAircraft }> {
  const blocker = purchaseBlocker(game, modelId)
  if (blocker) return { ok: false, error: blocker }
  return { ok: true, value: deliver(game, modelId, getAircraftModel(modelId)!.price) }
}
