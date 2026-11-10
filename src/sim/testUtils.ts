import type { GameCore } from './core'
import { createGame, unlockAirport } from './airline'

/** A game with `cash` and the given airports unlocked, for tests. */
export function makeGame(opts: { hq?: string; seed?: number; unlock?: string[]; cash?: number } = {}): GameCore {
  const r = createGame('Test Air', opts.hq ?? 'SIN', opts.seed ?? 7)
  if (!r.ok) throw new Error(r.error)
  let g: GameCore = { ...r.value, airline: { ...r.value.airline, cash: opts.cash ?? 500_000_000 } }
  for (const iata of opts.unlock ?? []) {
    const u = unlockAirport(g, iata)
    if (!u.ok) throw new Error(u.error)
    g = u.value
  }
  return g
}

/** Structural invariants that must hold after every operation. */
export function checkInvariants(g: GameCore): string[] {
  const problems: string[] = []
  const ids = g.jobs.map((j) => j.id)
  if (new Set(ids).size !== ids.length) problems.push('duplicate job ids')
  for (const a of g.aircraft) {
    for (const id of a.loadedJobIds) {
      const j = g.jobs.find((x) => x.id === id)
      if (!j) problems.push(`${a.id} lists missing job ${id}`)
      else if (j.aircraftId !== a.id || j.status !== 'loaded') problems.push(`job ${id} disagrees with ${a.id}`)
    }
  }
  for (const j of g.jobs) {
    if (j.aircraftId !== null) {
      const a = g.aircraft.find((x) => x.id === j.aircraftId)
      if (!a || !a.loadedJobIds.includes(j.id)) problems.push(`job ${j.id} onboard but not listed by aircraft`)
    }
    if (j.origin === j.destination) problems.push(`job ${j.id} goes nowhere`)
    if (!g.unlockedAirports.includes(j.destination)) problems.push(`job ${j.id} heads to a locked airport`)
    if (j.reward <= 0 || j.quantity <= 0) problems.push(`job ${j.id} has no size or reward`)
  }
  return problems
}
