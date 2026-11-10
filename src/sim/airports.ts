import { BALANCE } from '../config/balance'
import type { AirportRecord } from '../data/airports'

const A = BALANCE.airports

/**
 * Unlock price: class base x city size x network growth, rounded.
 * Small regional airports are cheap early; big hubs cost more but stay
 * affordable against the starting cash. All numbers live in BALANCE.airports.
 */
export function unlockPrice(airport: AirportRecord, unlockedCount: number): number {
  const city = A.cityBase + A.cityLogScale * Math.log10(1 + airport.metroMillions)
  const growth = Math.min(
    A.networkGrowthCap,
    1 + A.networkGrowthPerAirport * Math.max(0, unlockedCount - 1),
  )
  const raw = A.baseUnlockPrice[airport.classification] * city * growth
  return Math.max(A.priceRounding, Math.round(raw / A.priceRounding) * A.priceRounding)
}
