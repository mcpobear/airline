import { create } from 'zustand'
import { purchaseAircraft as simPurchase } from '../sim/aircraft'
import { createGame, unlockAirport as simUnlock } from '../sim/airline'
import { advanceFlights, type ArrivalEvent, dispatchFlight as simDispatch } from '../sim/flight'
import { sellAircraft as simSell, takeRescueFunding as simRescue } from '../sim/economy'
import { useNotifyStore } from './notifyStore'
import { dismissJob as simDismiss, loadJob as simLoad, unloadJob as simUnload } from '../sim/loading'
import type { GameCore, GameSettings, Result } from '../sim/core'
import type { AirlineProfile, Job, OwnedAircraft } from '../types/game'

/**
 * Game state store. A thin adapter: all rules live in the UI-independent
 * simulation (src/sim); the store only holds state and applies results.
 * Persistence (Phase 8) will snapshot/restore this state behind an abstraction.
 */
interface GameState {
  airline: AirlineProfile | null
  unlockedAirports: string[]
  aircraft: OwnedAircraft[]
  jobs: Job[]
  settings: GameSettings
  seed: number
  nextAircraftNumber: number
  nextJobNumber: number
  /** Return an error message, or null on success. */
  createAirline: (name: string, hqIata: string) => string | null
  unlockAirport: (iata: string) => string | null
  purchaseAircraft: (modelId: string) => Result<OwnedAircraft>
  loadJob: (aircraftId: string, jobId: string) => string | null
  unloadJob: (aircraftId: string, jobId: string) => string | null
  dismissJob: (jobId: string) => string | null
  dispatchFlight: (aircraftId: string, destIata: string) => string | null
  /** Brings flights up to `now` (landing, paying, refilling). Safe to call any number of times. */
  /** Lands finished flights. `silent` skips per-flight toasts (used when catching up on load). Returns the arrivals. */
  tick: (now: number, silent?: boolean) => ArrivalEvent[]
  /** Replaces the whole game (loading a save or an import). */
  loadGame: (game: GameCore) => void
  /** Returns an error message, or null on success. */
  sellAircraft: (aircraftId: string) => string | null
  takeRescueFunding: () => string | null
  setFutureAircraft: (enabled: boolean) => void
  resetGame: () => void
}

const EMPTY = {
  airline: null,
  unlockedAirports: [] as string[],
  aircraft: [] as OwnedAircraft[],
  jobs: [] as Job[],
  settings: { futureAircraft: false },
  seed: 0,
  nextAircraftNumber: 1,
  nextJobNumber: 1,
}

export const toCore = (s: GameState): GameCore | null =>
  s.airline
    ? {
        airline: s.airline,
        unlockedAirports: s.unlockedAirports,
        aircraft: s.aircraft,
        jobs: s.jobs,
        settings: s.settings,
        seed: s.seed,
        nextAircraftNumber: s.nextAircraftNumber,
        nextJobNumber: s.nextJobNumber,
      }
    : null

function applyJobAction(
  set: (s: GameCore) => void,
  get: () => GameState,
  action: (c: GameCore) => Result<GameCore>,
): string | null {
  const c = toCore(get())
  if (!c) return 'Create an airline first.'
  const r = action(c)
  if (!r.ok) return r.error
  set(r.value)
  return null
}

export const useGameStore = create<GameState>()((set, get) => ({
  ...EMPTY,
  createAirline: (name, hqIata) => {
    if (get().airline) return 'An airline already exists. Reset the game to start over.'
    const r = createGame(name, hqIata, Math.floor(Math.random() * 2 ** 31))
    if (!r.ok) return r.error
    set(r.value)
    return null
  },
  unlockAirport: (iata) => {
    const c = toCore(get())
    if (!c) return 'Create an airline first.'
    const r = simUnlock(c, iata)
    if (!r.ok) return r.error
    set(r.value)
    return null
  },
  purchaseAircraft: (modelId) => {
    const c = toCore(get())
    if (!c) return { ok: false, error: 'Create an airline first.' }
    const r = simPurchase(c, modelId)
    if (!r.ok) return r
    set(r.value.game)
    return { ok: true, value: r.value.aircraft }
  },
  loadJob: (aircraftId, jobId) => applyJobAction(set, get, (c) => simLoad(c, aircraftId, jobId)),
  unloadJob: (aircraftId, jobId) => applyJobAction(set, get, (c) => simUnload(c, aircraftId, jobId)),
  dismissJob: (jobId) => applyJobAction(set, get, (c) => simDismiss(c, jobId)),
  dispatchFlight: (aircraftId, destIata) =>
    applyJobAction(set, get, (c) => simDispatch(c, aircraftId, destIata, Date.now())),
  tick: (now, silent = false) => {
    const c = toCore(get())
    if (!c) return []
    const { game, events } = advanceFlights(c, now)
    if (game === c) return []
    set(game)
    if (!silent) {
      const notify = useNotifyStore.getState().push
      for (const e of events) {
        const jobs = e.delivered === 1 ? '1 job' : `${e.delivered} jobs`
        notify(
          e.delivered > 0
            ? `${e.aircraftName} landed at ${e.airport}: ${jobs} delivered, +$${e.revenue.toLocaleString('en-US')}`
            : `${e.aircraftName} landed at ${e.airport}`,
          e.delivered > 0 ? 'good' : 'info',
        )
      }
    }
    return events
  },
  loadGame: (game) => set({ ...game }),
  sellAircraft: (aircraftId) => applyJobAction(set, get, (c) => simSell(c, aircraftId)),
  takeRescueFunding: () => applyJobAction(set, get, simRescue),
  setFutureAircraft: (futureAircraft) => set((s) => ({ settings: { ...s.settings, futureAircraft } })),
  resetGame: () => set({ ...EMPTY }),
}))
