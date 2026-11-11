import { LAND_MASK_HEIGHT, LAND_MASK_RLE, LAND_MASK_WIDTH } from './landMask'
import { normalizeLon } from '../sim/geo'

/**
 * The land mask ships run-length encoded, which is about a fifth the size of
 * the raw bitmap at this resolution. It is expanded back into a bitmap on
 * first use - a few milliseconds, once - because everything that reads it
 * wants random access to single cells.
 */
let bits: Uint8Array | null = null

function getBits(): Uint8Array {
  if (bits) return bits
  const bin = atob(LAND_MASK_RLE)
  const out = new Uint8Array(Math.ceil((LAND_MASK_WIDTH * LAND_MASK_HEIGHT) / 8))
  let at = 0 // cell index
  let value = 0 // runs alternate, starting with ocean
  let i = 0
  while (i < bin.length) {
    // Varint: seven bits a byte, high bit set while more bytes follow.
    let run = 0
    let shift = 0
    for (;;) {
      const byte = bin.charCodeAt(i++)
      run |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) break
      shift += 7
    }
    if (value === 1) {
      // Set the run a byte at a time where it is byte-aligned; whole bytes of
      // land are the common case inland and the loop is hot enough to notice.
      const end = at + run
      let p = at
      while (p < end && p % 8 !== 0) out[p >> 3] |= 1 << (p & 7), p++
      while (p + 8 <= end) out[p >> 3] = 0xff, p += 8
      while (p < end) out[p >> 3] |= 1 << (p & 7), p++
    }
    at += run
    value ^= 1
  }
  bits = out
  return bits
}

/** True if the given coordinate is land, per the Natural Earth mask. */
export function isLand(lat: number, lon: number): boolean {
  const x = Math.floor(((normalizeLon(lon) + 180) / 360) * LAND_MASK_WIDTH) % LAND_MASK_WIDTH
  const y = Math.min(LAND_MASK_HEIGHT - 1, Math.max(0, Math.floor(((90 - lat) / 180) * LAND_MASK_HEIGHT)))
  const idx = y * LAND_MASK_WIDTH + x
  return ((getBits()[idx >> 3] >> (idx & 7)) & 1) === 1
}

/** Raw mask bit at grid coordinates (x east from -180, y south from +90). 1 for land. */
export function landBit(x: number, y: number): number {
  const idx = y * LAND_MASK_WIDTH + x
  return (getBits()[idx >> 3] >> (idx & 7)) & 1
}
