import { getAirport } from '../data/airports'
import type { Flight } from '../types/game'
import { interpolateGreatCircle, type LatLon } from './geo'

/**
 * The shape of a flight over time. Everything here is a pure function of
 * progress `p` (0 = pushback, 1 = on the ground), so the simulation, the
 * globe animation and the UI can never disagree about where an aircraft is.
 *
 * Phases: climb (departing), cruise, descent (arriving). Speed ramps from
 * V0 x cruise at the ends up to cruise speed; altitude eases up and down.
 */
export interface PhaseWindows {
  /** Fraction of flight time spent departing (climbing out). */
  climb: number
  /** Fraction of flight time spent arriving (descending in). */
  descent: number
}

const MIN_PHASE_MS = 4_000
const MAX_PHASE_MS = 20_000
const PHASE_FRACTION = 0.12
const MAX_PHASE_SHARE = 0.3
/** Ground speed at takeoff and touchdown relative to cruise. */
const V0 = 0.35

export type FlightPhase = 'departing' | 'cruising' | 'arriving'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const smoothstep = (s: number) => s * s * (3 - 2 * s)

/** Climb/descent share of a flight: ~12% of its time, between 4 and 20 seconds, never more than 30%. */
export function phaseWindows(durationMs: number): PhaseWindows {
  const share = Math.min(MAX_PHASE_SHARE, clamp(durationMs * PHASE_FRACTION, MIN_PHASE_MS, MAX_PHASE_MS) / durationMs)
  return { climb: share, descent: share }
}

export function phaseAt(p: number, w: PhaseWindows): FlightPhase {
  if (p < w.climb) return 'departing'
  if (p > 1 - w.descent) return 'arriving'
  return 'cruising'
}

/** Fraction of the great-circle route covered at progress p (0..1, monotonic, 0 -> 0 and 1 -> 1). */
export function routeFraction(p: number, w: PhaseWindows): number {
  const x = clamp(p, 0, 1)
  const c = w.climb
  const d = w.descent
  const climbArea = (c * (V0 + 1)) / 2
  const descentArea = (d * (V0 + 1)) / 2
  const total = climbArea + (1 - c - d) + descentArea
  let area: number
  if (x <= c) area = V0 * x + ((1 - V0) * x * x) / (2 * c)
  else if (x <= 1 - d) area = climbArea + (x - c)
  else {
    const q = x - (1 - d)
    area = climbArea + (1 - c - d) + q - ((1 - V0) * q * q) / (2 * d)
  }
  return area / total
}

/** Altitude as a fraction of cruise altitude: 0 on the ground, eased up in climb, 1 in cruise, eased down in descent. */
export function altitudeFraction(p: number, w: PhaseWindows): number {
  const x = clamp(p, 0, 1)
  if (x < w.climb) return smoothstep(x / w.climb)
  if (x > 1 - w.descent) return smoothstep((1 - x) / w.descent)
  return 1
}

export function flightProgress(f: Flight, now: number): number {
  return clamp((now - f.departedAt) / (f.arrivesAt - f.departedAt), 0, 1)
}

export const flightWindows = (f: Flight) => phaseWindows(f.arrivesAt - f.departedAt)

export interface FlightPosition extends LatLon {
  progress: number
  /** 0..1 of cruise altitude. */
  altitude: number
  phase: FlightPhase
}

/** Where a flying aircraft is at `now`. */
export function flightPosition(f: Flight, now: number): FlightPosition {
  const from = getAirport(f.from)!
  const to = getAirport(f.to)!
  const w = flightWindows(f)
  const progress = flightProgress(f, now)
  const { lat, lon } = interpolateGreatCircle(from, to, routeFraction(progress, w))
  return { lat, lon, progress, altitude: altitudeFraction(progress, w), phase: phaseAt(progress, w) }
}
