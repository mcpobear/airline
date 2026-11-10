import type { AirlineProfile, Job, OwnedAircraft } from '../types/game'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface GameSettings {
  /** Allow buying aircraft that are not yet in airline service. Off by default. */
  futureAircraft: boolean
}

/**
 * The simulation's whole state so far. Pure data: every rule is a function
 * from one GameCore to the next, so the engine is deterministic and testable.
 */
export interface GameCore {
  airline: AirlineProfile
  unlockedAirports: string[]
  aircraft: OwnedAircraft[]
  /** Every job that is not yet delivered: waiting at airports, at layovers, or onboard aircraft. Jobs never expire. */
  jobs: Job[]
  settings: GameSettings
  /** Seeds deterministic generation (registrations now, jobs in Phase 4). */
  seed: number
  /** Monotonic counter used for aircraft ids and names; never reused. */
  nextAircraftNumber: number
  /** Monotonic counter for job ids; never reused. */
  nextJobNumber: number
}
