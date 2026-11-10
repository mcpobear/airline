/** Compact money format matching the reference HUD: $628.6k, $1.2M, $950. */
export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}k`
  return `${sign}$${Math.round(a)}`
}

export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`
}

import type { AirportCategory } from '../types/game'

/** Plain-language answer to "where can this aircraft operate?" (see BALANCE.aircraft.airportMaxCategory). */
export function airportAccess(category: AirportCategory): string {
  switch (category) {
    case 'small':
    case 'medium':
      return 'Any airport'
    case 'large':
      return 'Major and hub airports'
    case 'heavy':
      return 'Hub airports only'
  }
}

/** Game-time duration, e.g. "1m 20s" or "45s". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const sec = total % 60
  return m > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${sec}s`
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`
}
