import { LAND_MASK_B64, LAND_MASK_HEIGHT, LAND_MASK_WIDTH } from './landMask'
import { normalizeLon } from '../sim/geo'

let bits: Uint8Array | null = null

function getBits(): Uint8Array {
  if (!bits) {
    const bin = atob(LAND_MASK_B64)
    bits = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  }
  return bits
}

/** True if the given coordinate is land, per the 0.5-degree Natural Earth mask. */
export function isLand(lat: number, lon: number): boolean {
  const x = Math.floor(((normalizeLon(lon) + 180) / 360) * LAND_MASK_WIDTH) % LAND_MASK_WIDTH
  const y = Math.min(LAND_MASK_HEIGHT - 1, Math.max(0, Math.floor(((90 - lat) / 180) * LAND_MASK_HEIGHT)))
  const idx = y * LAND_MASK_WIDTH + x
  return ((getBits()[idx >> 3] >> (idx & 7)) & 1) === 1
}
