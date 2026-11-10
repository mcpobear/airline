import type { OwnedAircraft } from '../types/game'
import type { Selection } from './uiStore'

/** The airport that should be highlighted for the current selection (an aircraft highlights where it is parked). */
export function selectedAirportIata(selection: Selection, aircraft: readonly OwnedAircraft[]): string | null {
  if (selection?.kind === 'airport') return selection.iata
  if (selection?.kind === 'aircraft') return aircraft.find((a) => a.id === selection.id)?.airport ?? null
  return null
}

/** Number of parked aircraft per airport. */
export function parkedCounts(aircraft: readonly OwnedAircraft[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const a of aircraft) if (a.airport) counts.set(a.airport, (counts.get(a.airport) ?? 0) + 1)
  return counts
}

/** Number of aircraft currently flying towards each airport. */
export function incomingCounts(aircraft: readonly OwnedAircraft[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const a of aircraft) if (a.flight) counts.set(a.flight.to, (counts.get(a.flight.to) ?? 0) + 1)
  return counts
}
