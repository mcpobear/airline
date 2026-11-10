import * as THREE from 'three'
import { toDeg, toRad, type LatLon } from '../sim/geo'

/**
 * Globe coordinate convention (unit sphere, Y up):
 *   x = cos(lat) * sin(lon),  y = sin(lat),  z = cos(lat) * cos(lon)
 * so lon 0 faces +Z and east is to the right when looking at the globe from outside.
 */
export function latLonToVector3(lat: number, lon: number, radius = 1, target = new THREE.Vector3()) {
  const la = toRad(lat)
  const lo = toRad(lon)
  return target.set(
    radius * Math.cos(la) * Math.sin(lo),
    radius * Math.sin(la),
    radius * Math.cos(la) * Math.cos(lo),
  )
}

export function vectorToLatLon(v: THREE.Vector3): LatLon {
  const n = v.clone().normalize()
  return { lat: toDeg(Math.asin(n.y)), lon: toDeg(Math.atan2(n.x, n.z)) }
}

/** Sub-solar point for a given moment (approximate, plenty for visual day/night). */
export function subSolarPoint(date: Date): LatLon {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = (date.getTime() - startOfYear) / 86_400_000
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81))
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  return { lat: declination, lon: -(utcHours - 12) * 15 }
}
