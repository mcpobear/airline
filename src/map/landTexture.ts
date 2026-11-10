import { LAND_MASK_HEIGHT, LAND_MASK_WIDTH } from '../data/landMask'
import { landBit } from '../data/landLookup'
import { fbm3 } from '../globe/noise'

/**
 * Paints the world map once into an RGBA buffer, in the flat "travel poster"
 * style: warm land, deep teal sea, a drawn coastline and a lightened shelf, so
 * land and water never read as the same surface.
 *
 * Built from the 0.5-degree land mask in three passes, all array maths:
 *   1. landness     bilinear sample of the mask (0 water, 1 land)
 *   2. soft         small blur -> antialiased coastline
 *      shelf        wide blur  -> shallow water fading out from the coast
 *   3. colour       biome by latitude and noise, then coastline on top
 * Terrain noise is sampled on the sphere, so the left and right edges meet
 * exactly and the map can repeat forever east to west.
 */
export const TEXTURE_WIDTH = 2048
export const TEXTURE_HEIGHT = 1024

const COAST = [0x1d, 0x3a, 0x3e] as const
const SEA_DEEP = [0x16, 0x4d, 0x63] as const
const SEA_MID = [0x1f, 0x6a, 0x80] as const
const SEA_SHELF = [0x3c, 0x95, 0xa6] as const

const BIOMES = {
  ice: [0xf0, 0xea, 0xdf],
  tundra: [0xb7, 0xb9, 0x9c],
  forest: [0x6f, 0x8f, 0x5a],
  jungle: [0x55, 0x7c, 0x47],
  grass: [0x9d, 0xa9, 0x65],
  steppe: [0xc2, 0xb0, 0x7c],
  desert: [0xdc, 0xc0, 0x84],
  rock: [0xa8, 0x90, 0x6c],
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
const mix3 = (a: readonly number[], b: readonly number[], t: number, out: number[]) => {
  out[0] = lerp(a[0], b[0], t)
  out[1] = lerp(a[1], b[1], t)
  out[2] = lerp(a[2], b[2], t)
  return out
}

/** Bilinear sample of the binary land mask, wrapping east-west and clamping at the poles. */
function sampleLandness(lat: number, lon: number): number {
  const fx = ((lon + 180) / 360) * LAND_MASK_WIDTH - 0.5
  const fy = ((90 - lat) / 180) * LAND_MASK_HEIGHT - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const wrap = (x: number) => ((x % LAND_MASK_WIDTH) + LAND_MASK_WIDTH) % LAND_MASK_WIDTH
  const clampY = (y: number) => (y < 0 ? 0 : y > LAND_MASK_HEIGHT - 1 ? LAND_MASK_HEIGHT - 1 : y)
  const a = landBit(wrap(x0), clampY(y0))
  const b = landBit(wrap(x0 + 1), clampY(y0))
  const c = landBit(wrap(x0), clampY(y0 + 1))
  const d = landBit(wrap(x0 + 1), clampY(y0 + 1))
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty)
}

/** Separable box blur with horizontal wrap-around, run `passes` times for a near-Gaussian falloff. */
function blurWrapped(src: Float32Array, w: number, h: number, radius: number, passes = 2): Float32Array {
  let a = Float32Array.from(src)
  let b = new Float32Array(src.length)
  const n = radius * 2 + 1
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      let sum = 0
      for (let i = -radius; i <= radius; i++) sum += a[row + ((i % w) + w) % w]
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / n
        sum -= a[row + ((x - radius) % w + w) % w]
        sum += a[row + ((x + radius + 1) % w + w) % w]
      }
    }
    ;[a, b] = [b, a]
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let i = -radius; i <= radius; i++) sum += a[Math.min(h - 1, Math.max(0, i)) * w + x]
      for (let y = 0; y < h; y++) {
        b[y * w + x] = sum / n
        sum -= a[Math.min(h - 1, Math.max(0, y - radius)) * w + x]
        sum += a[Math.min(h - 1, Math.max(0, y + radius + 1)) * w + x]
      }
    }
    ;[a, b] = [b, a]
  }
  return a
}

/** Terrain variation sampled on the unit sphere (so it is seamless across the date line). */
function terrainNoise(w: number, h: number, scale: number, seed: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const lat = 90 - ((y + 0.5) / h) * 180
    const la = (lat * Math.PI) / 180
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * 360 - 180
      const lo = (lon * Math.PI) / 180
      const cx = Math.cos(la) * Math.sin(lo)
      const cy = Math.sin(la)
      const cz = Math.cos(la) * Math.cos(lo)
      out[y * w + x] = fbm3(cx * scale + seed, cy * scale + seed, cz * scale + seed, 3)
    }
  }
  return out
}

/** Bilinear read of a coarse field, wrapping in x. */
function sampleCoarse(field: Float32Array, w: number, h: number, u: number, v: number): number {
  const fx = u * w - 0.5
  const fy = v * h - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const wx = (x: number) => ((x % w) + w) % w
  const cy = (y: number) => (y < 0 ? 0 : y > h - 1 ? h - 1 : y)
  const a = field[cy(y0) * w + wx(x0)]
  const b = field[cy(y0) * w + wx(x0 + 1)]
  const c = field[cy(y0 + 1) * w + wx(x0)]
  const d = field[cy(y0 + 1) * w + wx(x0 + 1)]
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty)
}

function biome(lat: number, elevation: number, moisture: number, out: number[]): number[] {
  const absLat = Math.abs(lat)
  if (absLat > 72 + elevation * 8) return mix3(BIOMES.ice, BIOMES.tundra, smoothstep(78, 70, absLat), out)
  if (absLat > 58) return mix3(BIOMES.tundra, BIOMES.forest, smoothstep(68, 54, absLat), out)
  if (elevation > 0.68) return mix3(BIOMES.rock, BIOMES.ice, smoothstep(0.74, 0.88, elevation), out)
  const dryBand = Math.exp(-(((absLat - 24) / 11) ** 2)) // the desert belts either side of the tropics
  const dryness = clamp01(dryBand * 1.25 - moisture * 0.85)
  if (dryness > 0.45) return mix3(BIOMES.steppe, BIOMES.desert, smoothstep(0.45, 0.8, dryness), out)
  if (absLat < 14 && moisture > 0.45) return mix3(BIOMES.jungle, BIOMES.forest, smoothstep(0.6, 0.4, moisture), out)
  return mix3(BIOMES.grass, BIOMES.forest, smoothstep(0.35, 0.68, moisture), out)
}

/** The finished map as RGBA bytes, ready to upload as a texture. */
export function buildMapPixels(width = TEXTURE_WIDTH, height = TEXTURE_HEIGHT): Uint8ClampedArray<ArrayBuffer> {
  const landness = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const lat = 90 - ((y + 0.5) / height) * 180
    for (let x = 0; x < width; x++) {
      landness[y * width + x] = sampleLandness(lat, ((x + 0.5) / width) * 360 - 180)
    }
  }
  const soft = blurWrapped(landness, width, height, 2, 1)
  const shelf = blurWrapped(landness, width, height, Math.round(width / 200), 2)

  const nw = width >> 2
  const nh = height >> 2
  const elevation = terrainNoise(nw, nh, 5.5, 11.3)
  const moisture = terrainNoise(nw, nh, 3.1, 40.7)

  const out = new Uint8ClampedArray(new ArrayBuffer(width * height * 4))
  const colour: number[] = [0, 0, 0]
  const sea: number[] = [0, 0, 0]
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height
    const lat = 90 - v * 180
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const u = (x + 0.5) / width
      const land = soft[i]
      const near = shelf[i]

      if (land > 0.5) {
        const elev = sampleCoarse(elevation, nw, nh, u, v)
        const moist = sampleCoarse(moisture, nw, nh, u, v)
        biome(lat, elev, moist, colour)
        // Gentle relief shading: high ground lighter, valleys a touch darker.
        const shade = 0.93 + 0.14 * (elev - 0.5)
        colour[0] *= shade
        colour[1] *= shade
        colour[2] *= shade
      } else {
        const depth = smoothstep(0.02, 0.32, near)
        mix3(SEA_DEEP, SEA_MID, smoothstep(0.0, 0.14, near), sea)
        mix3(sea, SEA_SHELF, depth, colour)
      }

      // Coastline: a drawn ink edge wherever the land fraction crosses a half.
      const edge = 1 - smoothstep(0.0, 0.13, Math.abs(land - 0.5))
      if (edge > 0) mix3(colour, COAST, edge * 0.85, colour)

      const o = i * 4
      out[o] = colour[0]
      out[o + 1] = colour[1]
      out[o + 2] = colour[2]
      out[o + 3] = 255
    }
  }
  return out
}
