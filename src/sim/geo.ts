/**
 * Pure geographic maths for the simulation. No React or three.js imports so it
 * stays deterministic, trivially testable and reusable by a future backend.
 */
export const EARTH_RADIUS_KM = 6371

export interface LatLon {
  lat: number
  lon: number
}

export const toRad = (deg: number) => (deg * Math.PI) / 180
export const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Point a fraction `t` (0..1) along the great circle from a to b. */
export function interpolateGreatCircle(a: LatLon, b: LatLon, t: number): LatLon {
  const lat1 = toRad(a.lat)
  const lon1 = toRad(a.lon)
  const lat2 = toRad(b.lat)
  const lon2 = toRad(b.lon)
  const d = distanceKm(a, b) / EARTH_RADIUS_KM
  if (d < 1e-9) return { ...a }
  const A = Math.sin((1 - t) * d) / Math.sin(d)
  const B = Math.sin(t * d) / Math.sin(d)
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
  const z = A * Math.sin(lat1) + B * Math.sin(lat2)
  return { lat: toDeg(Math.atan2(z, Math.hypot(x, y))), lon: toDeg(Math.atan2(y, x)) }
}

/** Wrap a longitude into [-180, 180). */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}
