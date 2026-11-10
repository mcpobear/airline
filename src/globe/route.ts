import * as THREE from 'three'
import { getAirport } from '../data/airports'
import { interpolateGreatCircle } from '../sim/geo'
import { latLonToVector3 } from './coords'

/** Radius of the surface the aircraft climb from (just above the airport markers). */
export const GROUND_RADIUS = 1.034
/** Extra radius at cruise altitude (exaggerated so flights read clearly). */
export const CRUISE_LIFT = 0.045

const cache = new Map<string, Float32Array>()

/** Great-circle polyline between two airports as xyz triples at a fixed radius, cached per pair. */
export function routePoints(from: string, to: string, segments = 72): Float32Array {
  const key = `${from}>${to}`
  const hit = cache.get(key)
  if (hit) return hit
  const a = getAirport(from)!
  const b = getAirport(to)!
  const out = new Float32Array((segments + 1) * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const { lat, lon } = interpolateGreatCircle(a, b, i / segments)
    // A shallow arc so the line looks like a flight path rather than lying on the ground.
    latLonToVector3(lat, lon, GROUND_RADIUS + CRUISE_LIFT * 0.6 * Math.sin((Math.PI * i) / segments), v)
    out.set([v.x, v.y, v.z], i * 3)
  }
  cache.set(key, out)
  return out
}
