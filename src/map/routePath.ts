import { getAirport } from '../data/airports'
import { interpolateGreatCircle } from '../sim/geo'
import { project, unwrapLongitudes } from './projection'

/**
 * A flight path drawn on the flat map.
 *
 * The great circle is sampled at even fractions and its longitudes are then
 * unwrapped, so a Pacific crossing runs off the right-hand edge and continues
 * instead of snapping back across the map. The result is "unwrapped" map
 * space: x may fall outside the world, and the drawing code shifts the whole
 * path to whichever copy of the world the camera is looking at.
 */
export interface RoutePath {
  /** Flattened x,y pairs in unwrapped map space. */
  points: Float32Array
  /** Number of points (points.length / 2). */
  count: number
}

const SEGMENTS = 96
const cache = new Map<string, RoutePath>()

export function routePath(from: string, to: string): RoutePath {
  const key = `${from}>${to}`
  const hit = cache.get(key)
  if (hit) return hit
  const a = getAirport(from)!
  const b = getAirport(to)!
  const lats: number[] = []
  const lons: number[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const p = interpolateGreatCircle(a, b, i / SEGMENTS)
    lats.push(p.lat)
    lons.push(p.lon)
  }
  const unwrapped = unwrapLongitudes(lons)
  const points = new Float32Array((SEGMENTS + 1) * 2)
  for (let i = 0; i <= SEGMENTS; i++) {
    const p = project(lats[i], unwrapped[i])
    points[i * 2] = p.x
    points[i * 2 + 1] = p.y
  }
  const path: RoutePath = { points, count: SEGMENTS + 1 }
  cache.set(key, path)
  return path
}

export interface PathPoint {
  x: number
  y: number
  /** Unit heading along the path. */
  hx: number
  hy: number
}

/** The position and heading a fraction `t` (0..1) along a path. */
export function pointAt(path: RoutePath, t: number, out: PathPoint = { x: 0, y: 0, hx: 1, hy: 0 }): PathPoint {
  const last = path.count - 1
  const f = Math.min(last, Math.max(0, t * last))
  const i = Math.min(last - 1, Math.floor(f))
  const frac = f - i
  const ax = path.points[i * 2]
  const ay = path.points[i * 2 + 1]
  const bx = path.points[i * 2 + 2]
  const by = path.points[i * 2 + 3]
  out.x = ax + (bx - ax) * frac
  out.y = ay + (by - ay) * frac
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  out.hx = dx / len
  out.hy = dy / len
  return out
}
