import { BALANCE } from '../config/balance'
import { getAirport } from '../data/airports'
import { addStarterFleet } from './aircraft'
import { unlockPrice } from './airports'
import { onAirportUnlocked, refillAirport } from './jobs'
import type { GameCore, Result } from './core'

export type { GameCore, GameSettings, Result } from './core'

export const NAME_MIN = 2
export const NAME_MAX = 28

export function validateAirlineName(raw: string): Result<string> {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < NAME_MIN) return { ok: false, error: `Name must be at least ${NAME_MIN} characters.` }
  if (name.length > NAME_MAX) return { ok: false, error: `Name must be at most ${NAME_MAX} characters.` }
  return { ok: true, value: name }
}

/** Creates a new airline. The HQ airport is unlocked automatically and free. */
export function createGame(rawName: string, hqIata: string, seed: number): Result<GameCore> {
  const name = validateAirlineName(rawName)
  if (!name.ok) return name
  if (!getAirport(hqIata)) return { ok: false, error: `Unknown airport "${hqIata}".` }
  const base: GameCore = {
    airline: {
      name: name.value,
      hq: hqIata,
      cash: BALANCE.economy.startingCash,
      lifetimeRevenue: 0,
      lifetimeOperatingCost: 0,
      jobsDelivered: 0,
    },
    unlockedAirports: [hqIata],
    aircraft: [],
    jobs: [],
    settings: { futureAircraft: false },
    seed,
    nextAircraftNumber: 1,
    nextJobNumber: 1,
  }
  // With only the HQ unlocked there is nowhere to send jobs yet; the first unlock creates them.
  return { ok: true, value: refillAirport(addStarterFleet(base), hqIata) }
}

type NetworkView = Pick<GameCore, 'airline' | 'unlockedAirports'>

export function currentUnlockPrice(game: NetworkView, iata: string): number | null {
  const a = getAirport(iata)
  return a ? unlockPrice(a, game.unlockedAirports.length) : null
}

/** Why an airport can't be unlocked right now, or null if it can. */
export function unlockBlocker(game: NetworkView, iata: string): string | null {
  const a = getAirport(iata)
  if (!a) return `Unknown airport "${iata}".`
  if (game.unlockedAirports.includes(iata)) return `${a.city} (${iata}) is already unlocked.`
  const price = unlockPrice(a, game.unlockedAirports.length)
  if (game.airline.cash < price) {
    return `Not enough cash: need $${price.toLocaleString('en-US')}, have $${Math.floor(game.airline.cash).toLocaleString('en-US')}.`
  }
  return null
}

/** Pure: returns a new game state with the airport unlocked and cash deducted. */
export function unlockAirport(game: GameCore, iata: string): Result<GameCore> {
  const blocker = unlockBlocker(game, iata)
  if (blocker) return { ok: false, error: blocker }
  const price = currentUnlockPrice(game, iata)!
  return {
    ok: true,
    value: onAirportUnlocked(
      {
        ...game,
        airline: { ...game.airline, cash: game.airline.cash - price },
        unlockedAirports: [...game.unlockedAirports, iata],
      },
      iata,
    ),
  }
}
