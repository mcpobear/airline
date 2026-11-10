import { normalizeLon } from '../sim/geo'

/**
 * Equirectangular projection for the flat map.
 *
 * World units: the whole Earth is MAP_W x MAP_H centred on (0,0), so
 * x = lon / 90 and y = lat / 90. The map repeats horizontally: a point at
 * lon 170 and the same point at lon -190 are the same place, one world apart.
 * Everything drawn on the map therefore works in "unwrapped" longitude and is
 * shifted to whichever copy is nearest the camera at draw time.
 */
export const MAP_W = 4
export const MAP_H = 2

export interface MapPoint {
  x: number
  y: number
}

export function project(lat: number, lon: number, target: MapPoint = { x: 0, y: 0 }): MapPoint {
  target.x = lon / 90
  target.y = lat / 90
  return target
}

export function unproject(x: number, y: number) {
  return { lat: Math.max(-90, Math.min(90, y * 90)), lon: normalizeLon(x * 90) }
}

/** Wraps `x` into [-MAP_W/2, MAP_W/2). */
export function wrapX(x: number): number {
  return ((((x + MAP_W / 2) % MAP_W) + MAP_W) % MAP_W) - MAP_W / 2
}

/** The copy of `x` nearest to `reference`, so markers never jump across the seam. */
export function nearestX(x: number, reference: number): number {
  return x + Math.round((reference - x) / MAP_W) * MAP_W
}

/**
 * Makes a sequence of longitudes continuous by removing +-360 jumps, so a
 * route over the Pacific reads as one unbroken line instead of snapping back
 * across the map. The result can run outside [-180,180] on purpose.
 */
export function unwrapLongitudes(lons: readonly number[]): number[] {
  const out: number[] = []
  let offset = 0
  for (let i = 0; i < lons.length; i++) {
    if (i > 0) {
      const step = lons[i] + offset - out[i - 1]
      if (step > 180) offset -= 360
      else if (step < -180) offset += 360
    }
    out.push(lons[i] + offset)
  }
  return out
}

/** Signed east-west distance in degrees from `fromLon` to `toLon` along the shorter way (east is positive). */
export function shortestLonDelta(fromLon: number, toLon: number): number {
  return normalizeLon(toLon - fromLon)
}
