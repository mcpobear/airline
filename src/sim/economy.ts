import { BALANCE } from '../config/balance'
import type { OwnedAircraft } from '../types/game'
import type { GameCore, Result } from './core'
import { AIRCRAFT } from '../data/aircraft'
import { dispatchBlocker } from './flight'

/** What the airline gets back when selling an aircraft (a fixed fraction of the purchase price). */
export const resaleValue = (a: OwnedAircraft) => Math.round(a.purchasePrice * BALANCE.economy.aircraftResaleFraction)

export function sellBlocker(game: GameCore, aircraftId: string): string | null {
  const a = game.aircraft.find((x) => x.id === aircraftId)
  if (!a) return 'Unknown aircraft.'
  if (a.flight || a.airport === null) return `${a.name} is in flight. Sell it after it lands.`
  if (a.loadedJobIds.length > 0) return 'Unload all jobs before selling this aircraft.'
  if (game.aircraft.length <= 1) return 'You need at least one aircraft to keep flying.'
  return null
}

/** Pure: sells a parked, empty aircraft for its resale value. */
export function sellAircraft(game: GameCore, aircraftId: string): Result<GameCore & { sold: number }> {
  const blocker = sellBlocker(game, aircraftId)
  if (blocker) return { ok: false, error: blocker }
  const a = game.aircraft.find((x) => x.id === aircraftId)!
  const sold = resaleValue(a)
  return {
    ok: true,
    value: {
      ...game,
      airline: { ...game.airline, cash: game.airline.cash + sold },
      aircraft: game.aircraft.filter((x) => x.id !== aircraftId),
      sold,
    },
  }
}

export interface FinanceSummary {
  cash: number
  revenue: number
  operatingCost: number
  net: number
  jobsDelivered: number
  fleetValue: number
  perAircraft: Array<{ id: string; name: string; revenue: number; cost: number; profit: number }>
}

export function summarizeFinances(game: GameCore): FinanceSummary {
  const { airline, aircraft } = game
  return {
    cash: airline.cash,
    revenue: airline.lifetimeRevenue,
    operatingCost: airline.lifetimeOperatingCost,
    net: airline.lifetimeRevenue - airline.lifetimeOperatingCost,
    jobsDelivered: airline.jobsDelivered,
    fleetValue: aircraft.reduce((s, a) => s + resaleValue(a), 0),
    perAircraft: aircraft
      .map((a) => ({ id: a.id, name: a.name, revenue: a.lifetimeRevenue, cost: a.lifetimeOperatingCost, profit: a.lifetimeRevenue - a.lifetimeOperatingCost }))
      .sort((x, y) => y.profit - x.profit),
  }
}

/**
 * True when the airline can't make progress: nothing is flying, no aircraft can
 * be dispatched anywhere right now, but it could be with enough cash. (If it is
 * stuck for another reason, such as range, money wouldn't help, so it is not "stuck" here.)
 */
export function isStuck(game: GameCore): boolean {
  if (game.aircraft.some((a) => a.flight)) return false
  if (game.aircraft.length === 0) return game.airline.cash < Math.min(...AIRCRAFT.filter((m) => m.inService).map((m) => m.price))
  const rich: GameCore = { ...game, airline: { ...game.airline, cash: Number.MAX_SAFE_INTEGER } }
  let couldFlyIfRich = false
  for (const a of game.aircraft) {
    for (const dest of game.unlockedAirports) {
      if (dispatchBlocker(rich, a.id, dest) === null) {
        couldFlyIfRich = true
        if (dispatchBlocker(game, a.id, dest) === null) return false
      }
    }
  }
  return couldFlyIfRich || game.aircraft.length === 0
}

/** Pure: one-off emergency funding for a stuck airline. It is not counted as revenue. */
export function takeRescueFunding(game: GameCore): Result<GameCore> {
  if (!isStuck(game)) return { ok: false, error: "You're not stuck: an aircraft can still fly." }
  return { ok: true, value: { ...game, airline: { ...game.airline, cash: game.airline.cash + BALANCE.economy.rescueGrant } } }
}
