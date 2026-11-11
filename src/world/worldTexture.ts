import { LAND_MASK_HEIGHT, LAND_MASK_WIDTH } from '../data/landMask'
import { landBit } from '../data/landLookup'
import { fbm3 } from '../globe/noise'
import { GLOBE_STYLES, type WorldPalette } from './palettes'

/**
 * Paints the whole world once into an RGBA buffer, in whichever palette it is
 * given: land, sea, a drawn coastline and a lightened continental shelf, so
 * land and water never read as the same surface.
 *
 * The result is equirectangular, which is what a sphere's default UVs expect,
 * so one painted buffer wraps straight onto the globe.
 *
 * Built from the land mask in three passes, all array maths:
 *   1. landness     bilinear sample of the mask (0 water, 1 land)
 *   2. soft         small blur -> antialiased coastline
 *      shelf        wide blur  -> shallow water fading out from the coast
 *   3. colour       biome by latitude and noise, then coastline on top
 * Both blur radii are given as fractions of the width rather than in pixels,
 * so a coastline keeps its drawn weight whatever size the texture is painted.
 * Terrain noise is sampled on the sphere, so the left and right edges meet
 * exactly and the map can repeat forever east to west.
 */

/**
 * Full size matches the land mask 1:1, so a coastline is drawn from real
 * samples rather than from a blurred upsample of a coarser grid. Painting
 * eight million pixels takes a few seconds, which is why it happens in a
 * worker; phones get the half size instead, where it is about a second.
 */
export const TEXTURE_WIDTH = 4096
export const TEXTURE_HEIGHT = 2048

/**
 * How big to paint on this device. The full texture is 32 MB of video memory
 * and several seconds of work, which is worth it on a desktop and not on a
 * phone - where the globe is a third of the size on screen anyway.
 */
export function preferredTextureSize(): { width: number; height: number } {
  const small =
    typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700
  return small
    ? { width: TEXTURE_WIDTH / 2, height: TEXTURE_HEIGHT / 2 }
    : { width: TEXTURE_WIDTH, height: TEXTURE_HEIGHT }
}


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

/**
 * Terrain variation sampled on the unit sphere (so it is seamless across the
 * date line), stretched to fill 0..1.
 *
 * The stretch matters: fbm averages its octaves, so the more detail you ask
 * for the more tightly the raw values cluster around the middle. Left alone,
 * a five-octave field spans perhaps 0.35..0.65 and the relief setting has
 * almost nothing to shade with. Rescaling by the field's own range means
 * `relief` behaves the same at any octave count.
 */
function terrainNoise(w: number, h: number, scale: number, seed: number, octaves = 3): Float32Array {
  const out = new Float32Array(w * h)
  let lo_ = Infinity
  let hi = -Infinity
  for (let y = 0; y < h; y++) {
    const lat = 90 - ((y + 0.5) / h) * 180
    const la = (lat * Math.PI) / 180
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * 360 - 180
      const lo = (lon * Math.PI) / 180
      const cx = Math.cos(la) * Math.sin(lo)
      const cy = Math.sin(la)
      const cz = Math.cos(la) * Math.cos(lo)
      const v = fbm3(cx * scale + seed, cy * scale + seed, cz * scale + seed, octaves)
      out[y * w + x] = v
      if (v < lo_) lo_ = v
      if (v > hi) hi = v
    }
  }
  const span = hi - lo_
  if (span > 1e-6) for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo_) / span
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

const warmScratch: number[] = [0, 0, 0]
const coldScratch: number[] = [0, 0, 0]
const spare: number[] = [0, 0, 0]

/**
 * The ground cover at one point, from latitude, height and moisture.
 *
 * Every transition is a ramp rather than a threshold. Thresholds are the
 * cheaper way to write this, but a threshold on latitude draws a dead
 * straight line across a continent wherever it falls, which on a map of the
 * real world reads immediately as a bug.
 */
function biome(palette: WorldPalette, lat: number, elevation: number, moisture: number, out: number[]): number[] {
  const B = palette.biomes
  const absLat = Math.abs(lat)

  // What grows at a mild latitude: grass through forest by moisture, turning
  // to jungle near the equator and to steppe and desert in the dry belts
  // either side of the tropics.
  mix3(B.grass, B.forest, smoothstep(0.35, 0.68, moisture), warmScratch)
  const jungle = smoothstep(24, 8, absLat) * smoothstep(0.38, 0.62, moisture)
  if (jungle > 0) mix3(warmScratch, B.jungle, jungle, warmScratch)
  const dryBand = Math.exp(-(((absLat - 24) / 11) ** 2))
  const dryness = clamp01(dryBand * 1.25 - moisture * 0.85)
  if (dryness > 0) {
    mix3(B.steppe, B.desert, smoothstep(0.45, 0.85, dryness), spare)
    mix3(warmScratch, spare, smoothstep(0.1, 0.5, dryness), warmScratch)
  }

  // Which gives way to tundra and then to ice towards the poles. High ground
  // brings the treeline down, so mountains go bare before the plains do.
  mix3(B.tundra, B.ice, smoothstep(68, 78, absLat + elevation * 7), coldScratch)
  mix3(warmScratch, coldScratch, smoothstep(52, 66, absLat + elevation * 5), out)

  // Bare rock on the highest ground anywhere, but snow only above a snow line
  // that climbs towards the equator - otherwise every tropical peak ends up
  // with a white cap.
  const rock = smoothstep(0.68, 0.8, elevation)
  if (rock > 0) {
    const snowLine = 0.78 + smoothstep(55, 8, absLat) * 0.17
    mix3(B.rock, B.ice, smoothstep(snowLine, snowLine + 0.09, elevation), spare)
    mix3(out, spare, rock, out)
  }
  return out
}

/** The finished map as RGBA bytes, ready to upload as a texture. */
export function paintWorld(
  palette: WorldPalette,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): Uint8ClampedArray<ArrayBuffer> {
  const { seaDeep: SEA_DEEP, seaMid: SEA_MID, seaShelf: SEA_SHELF, coast: COAST } = palette
  const landness = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const lat = 90 - ((y + 0.5) / height) * 180
    for (let x = 0; x < width; x++) {
      landness[y * width + x] = sampleLandness(lat, ((x + 0.5) / width) * 360 - 180)
    }
  }
  // Just enough blur to antialias the coastline. Any wider and an estuary or
  // a strait washes out into the same soft gradient as open ocean, which is
  // what made the old map hard to read when you zoomed in.
  const soft = blurWrapped(landness, width, height, Math.max(1, Math.round(width / 1400)), 1)
  const shelf = blurWrapped(landness, width, height, Math.max(2, Math.round(width * palette.shelf)), 2)

  // Elevation is sampled finely enough to read as terrain rather than as a
  // smooth gradient; moisture only decides which biome, so it stays coarse.
  const nw = width >> 1
  const nh = height >> 1
  const elevation = terrainNoise(nw, nh, 9, 11.3, 6)
  const moisture = terrainNoise(width >> 2, height >> 2, 3.1, 40.7, 3)

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
        const moist = sampleCoarse(moisture, width >> 2, height >> 2, u, v)
        biome(palette, lat, elev, moist, colour)
        // Relief shading: high ground lighter, valleys a touch darker.
        const shade = 1 - palette.relief / 2 + palette.relief * elev
        colour[0] *= shade
        colour[1] *= shade
        colour[2] *= shade
      } else {
        const depth = smoothstep(0.02, 0.32, near)
        mix3(SEA_DEEP, SEA_MID, smoothstep(0.0, 0.14, near), sea)
        mix3(sea, SEA_SHELF, depth, colour)
      }

      // Coastline: a drawn edge wherever the land fraction crosses a half.
      const edge = 1 - smoothstep(0, palette.coastWidth, Math.abs(land - 0.5))
      if (edge > 0) mix3(colour, COAST, edge * palette.coastStrength, colour)

      // Optional graticule, baked in so it follows the surface exactly.
      const grid = palette.graticule
      if (grid) {
        const lonLine = gridness(((x + 0.5) / width) * 360 - 180, grid.spacing, width / 360)
        const latLine = gridness(lat, grid.spacing, height / 180)
        const g = Math.max(lonLine, latLine * Math.min(1, Math.cos((lat * Math.PI) / 180) * 3))
        if (g > 0) mix3(colour, grid.colour, g * grid.strength, colour)
      }

      const o = i * 4
      out[o] = colour[0]
      out[o + 1] = colour[1]
      out[o + 2] = colour[2]
      out[o + 3] = 255
    }
  }
  return out
}

/** How close a coordinate is to a grid line, as a 0..1 ramp a pixel or two wide. */
function gridness(value: number, spacing: number, pixelsPerDegree: number): number {
  const distance = Math.abs(value - Math.round(value / spacing) * spacing) * pixelsPerDegree
  return 1 - smoothstep(0.4, 1.4, distance)
}

const cache = new Map<string, Uint8ClampedArray<ArrayBuffer>>()
const key = (styleId: string, width: number, height: number) => `${styleId}@${width}x${height}`

/**
 * Paints a named style on this thread. Fine at small sizes and in tests; at
 * full size prefer `worldPixelsAsync`, which does the same work in a worker.
 */
export function worldPixels(styleId: string, width = TEXTURE_WIDTH, height = TEXTURE_HEIGHT) {
  const k = key(styleId, width, height)
  let pixels = cache.get(k)
  if (!pixels) {
    const style = GLOBE_STYLES.find((s) => s.id === styleId) ?? GLOBE_STYLES[0]
    pixels = paintWorld(style.palette, width, height)
    cache.set(k, pixels)
  }
  return pixels
}

/** Already painted and in hand, or undefined if it still has to be made. */
export function cachedWorldPixels(styleId: string, width: number, height: number) {
  return cache.get(key(styleId, width, height))
}

let worker: Worker | null = null
const pending = new Map<string, Promise<Uint8ClampedArray<ArrayBuffer>>>()

/**
 * Paints a style in a worker and keeps the result, so switching back and
 * forth is instant. Falls back to painting here if workers are unavailable,
 * which is the case under the unit tests.
 */
export function worldPixelsAsync(
  styleId: string,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): Promise<Uint8ClampedArray<ArrayBuffer>> {
  const k = key(styleId, width, height)
  const ready = cache.get(k)
  if (ready) return Promise.resolve(ready)
  const already = pending.get(k)
  if (already) return already

  if (typeof Worker === 'undefined') return Promise.resolve(worldPixels(styleId, width, height))

  const job = new Promise<Uint8ClampedArray<ArrayBuffer>>((resolve, reject) => {
    worker ??= new Worker(new URL('./paintWorker.ts', import.meta.url), { type: 'module' })
    const onMessage = (event: MessageEvent<{ styleId: string; width: number; height: number; pixels: ArrayBuffer }>) => {
      const d = event.data
      if (key(d.styleId, d.width, d.height) !== k) return
      worker?.removeEventListener('message', onMessage)
      worker?.removeEventListener('error', onError)
      const pixels = new Uint8ClampedArray(d.pixels)
      cache.set(k, pixels)
      pending.delete(k)
      resolve(pixels)
    }
    const onError = (event: ErrorEvent) => {
      worker?.removeEventListener('message', onMessage)
      worker?.removeEventListener('error', onError)
      pending.delete(k)
      reject(event.error ?? new Error(event.message))
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ styleId, width, height })
  }).catch(() => {
    // A worker that will not start is no reason to go without a globe.
    return worldPixels(styleId, width, height)
  })

  pending.set(k, job)
  return job
}
