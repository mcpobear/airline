// Generates src/data/landMask.ts: a land/ocean bitmap sampled from Natural
// Earth land polygons (public domain, via the `world-atlas` package).
// Run with: npm run generate:landmask   (the output is committed; this is only
// needed if the resolution or source data changes).
//
// The grid matches the world texture 1:1, so every painted pixel gets a real
// sample rather than a blurred upsample of a coarser grid. Filling it with
// point-in-polygon tests would take hours at this size, so instead each row is
// rasterised by scanline: intersect the row's line of latitude with every ring
// edge, sort the crossings, and fill between alternate pairs.
//
// A row is a circle, not a line, so the crossings cut it into arcs that
// alternate land and sea but say nothing about which arc is which. One probe
// settles all of them. It is taken in the middle of the widest arc, and
// against the 50m land rather than the 10m: d3's spherical containment test
// answers "land" everywhere on the 10m data, while on 50m it is reliable, and
// the widest arc on a row is a stretch of open ocean or continental interior
// where the two sources cannot disagree.
//
// The 10m land stops at 85.2 S, so Antarctica below that comes from the 50m
// land instead. Nothing else is down there, and it is solid ice to the pole,
// so the join does not show.
//
// The result is stored run-length encoded rather than as a raw bitmap. The
// world is mostly long runs of the same value, so the runs come to about a
// fifth of the equivalent bitmap - which is what makes a 4096x2048 grid
// cheaper to ship than the 2048x1024 bitmap it replaces.
import { readFileSync, writeFileSync } from 'node:fs'
import { feature } from 'topojson-client'
import { geoContains } from 'd3-geo'

const W = 4096
const H = 2048

/** Every ring in a world-atlas land object, flattened to arrays of [lon, lat]. */
function ringsOf(name) {
  const topo = JSON.parse(readFileSync(`node_modules/world-atlas/${name}.json`, 'utf8'))
  const land = feature(topo, topo.objects.land)
  const rings = []
  for (const f of land.type === 'FeatureCollection' ? land.features : [land]) {
    const g = f.geometry ?? f
    if (g.type === 'Polygon') rings.push(...g.coordinates)
    else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) rings.push(...poly)
  }
  // Close any ring that does not already repeat its first point. A ring left
  // open loses its final edge, which makes rows that cross it count an odd
  // number of crossings - and an odd count pairs the fill up wrongly, painting
  // a stripe of phantom land right across the ocean.
  let closed = 0
  for (const ring of rings) {
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]])
      closed++
    }
  }
  return { rings, closed, land }
}

const rowY = (lat) => ((90 - lat) / 180) * H - 0.5

/**
 * Buckets every edge by the rows it spans, so each row only looks at edges
 * that can possibly cross it. Without this the fill is O(rows x edges) and
 * crawls.
 */
function bucketEdges(rings) {
  const buckets = Array.from({ length: H }, () => [])
  let edgeCount = 0
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i]
      let [lon2, lat2] = ring[i + 1]
      if (lat1 === lat2) continue // horizontal edges never produce a crossing
      // An edge from 179.9 to -180 is the clip seam, not a trip the long way
      // round the globe. Taken literally its crossing lands in the middle of
      // the Pacific; carrying lon2 past the seam puts it back where it belongs.
      if (lon2 - lon1 > 180) lon2 -= 360
      else if (lon1 - lon2 > 180) lon2 += 360
      const yA = rowY(lat1)
      const yB = rowY(lat2)
      const from = Math.max(0, Math.ceil(Math.min(yA, yB)))
      const to = Math.min(H - 1, Math.floor(Math.max(yA, yB)))
      if (to < from) continue
      const edge = { lon1, lat1, lon2, lat2 }
      for (let y = from; y <= to; y++) buckets[y].push(edge)
      edgeCount++
    }
  }
  return { buckets, edgeCount }
}

const detail = ringsOf('land-10m')
const polar = ringsOf('land-50m')
const detailed = bucketEdges(detail.rings)
const polarEdges = bucketEdges(polar.rings)

// Where the detailed source gives out, in degrees.
let southernLimit = 90
for (const ring of detail.rings) for (const [, lat] of ring) if (lat < southernLimit) southernLimit = lat
console.log(`10m land reaches ${southernLimit.toFixed(2)}; below that the 50m land fills in.`)

let oddRows = 0
const bits = new Uint8Array(Math.ceil((W * H) / 8))
const setLand = (x, y) => {
  const idx = y * W + x
  bits[idx >> 3] |= 1 << (idx & 7)
}
const getBit = (x, y) => {
  const idx = y * W + x
  return (bits[idx >> 3] >> (idx & 7)) & 1
}

/** Paints [lonA, lonB] on row y, wrapping past the date line if it has to. */
function fillArc(y, lonA, lonB) {
  const toX = (lon) => ((lon + 180) / 360) * W - 0.5
  const start = Math.ceil(toX(lonA))
  const end = Math.floor(toX(lonB < lonA ? lonB + 360 : lonB))
  for (let x = start; x <= end; x++) setLand(((x % W) + W) % W, y)
}

const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180

for (let y = 0; y < H; y++) {
  const lat = 90 - ((y + 0.5) * 180) / H
  const bucket = (lat < southernLimit ? polarEdges : detailed).buckets[y]
  const crossings = []
  for (const e of bucket) {
    // Half-open test on latitude keeps shared vertices from counting twice,
    // which is what guarantees each ring contributes an even number of
    // crossings and lets the alternation below be trusted.
    if (lat >= e.lat1 === lat >= e.lat2) continue
    const t = (lat - e.lat1) / (e.lat2 - e.lat1)
    crossings.push(wrapLon(e.lon1 + t * (e.lon2 - e.lon1)))
  }
  if (crossings.length === 0) {
    // No boundary on this row, so it is all land or all sea.
    if (geoContains(polar.land, [0, lat])) fillArc(y, -180, 180)
    continue
  }
  if (crossings.length % 2 === 1) oddRows++
  crossings.sort((a, b) => a - b)

  // Find the widest arc and probe its middle; everything else follows from it.
  let widest = 0
  let widestSpan = -1
  for (let i = 0; i < crossings.length; i++) {
    const a = crossings[i]
    const b = i + 1 < crossings.length ? crossings[i + 1] : crossings[0] + 360
    if (b - a > widestSpan) {
      widestSpan = b - a
      widest = i
    }
  }
  const probeA = crossings[widest]
  const probeB = widest + 1 < crossings.length ? crossings[widest + 1] : crossings[0] + 360
  let inside = geoContains(polar.land, [wrapLon(probeA + (probeB - probeA) / 2), lat])

  for (let n = 0; n < crossings.length; n++) {
    const i = (widest + n) % crossings.length
    const a = crossings[i]
    const b = i + 1 < crossings.length ? crossings[i + 1] : crossings[0] + 360
    if (inside) fillArc(y, a, wrapLon(b))
    inside = !inside
  }
}

// Check the raster before writing it. The ground truth is the 50m land, not
// the 10m this was built from: d3's containment test answers "land" everywhere
// on the 10m data, while on 50m it is reliable. The two sources draw the same
// continents, so they agree everywhere except within a pixel or two of a
// coastline - which is what the near-match allowance below is for. What this
// is really looking for is a scanline fill that failed, and those fail loudly,
// inverting whole rows rather than nudging a coastline.
{
  const SAMPLES = 3000
  // Seeded, so a build either passes every time or fails every time.
  let seed = 0x9e3779b9
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  /** True if any cell within `r` agrees, i.e. the point sits on a coastline. */
  const nearMatch = (x, y, want, r) => {
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy
      if (yy < 0 || yy >= H) continue
      for (let dx = -r; dx <= r; dx++) if (getBit((((x + dx) % W) + W) % W, yy) === want) return true
    }
    return false
  }

  let onCoast = 0
  let hard = 0
  const misses = []
  for (let i = 0; i < SAMPLES; i++) {
    // Equal-area sampling, so the poles do not soak up most of the budget.
    const lon = random() * 360 - 180
    const lat = (Math.asin(random() * 2 - 1) * 180) / Math.PI
    const x = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W))
    const y = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H))
    const truth = geoContains(polar.land, [lon, lat]) ? 1 : 0
    if (getBit(x, y) === truth) continue
    if (nearMatch(x, y, truth, 2)) onCoast++
    else {
      hard++
      if (misses.length < 10) misses.push(`lon=${lon.toFixed(2)} lat=${lat.toFixed(2)} 50m says ${truth}`)
    }
  }
  const rate = hard / SAMPLES
  console.log(
    `Spot-checked ${SAMPLES} points against the 50m land: ${onCoast} differ on a coastline, ${hard} differ outright (${(rate * 100).toFixed(2)}%).`,
  )
  if (rate > 0.005) {
    for (const m of misses) console.error(`  ${m}`)
    throw new Error('land mask raster does not match the source polygons')
  }

  // Land fraction per row should move smoothly; a row that inverted jumps.
  const fraction = new Float64Array(H)
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = 0; x < W; x++) n += getBit(x, y)
    fraction[y] = n / W
  }
  let worst = 0
  let worstY = 0
  for (let y = 1; y < H; y++) {
    const jump = Math.abs(fraction[y] - fraction[y - 1])
    if (jump > worst) {
      worst = jump
      worstY = y
    }
  }
  console.log(`Largest row-to-row change in land cover: ${(worst * 100).toFixed(1)}% at y=${worstY}.`)
  if (worst > 0.35) throw new Error(`row ${worstY} looks inverted - land cover jumps ${(worst * 100).toFixed(0)}%`)

  // On an equirectangular grid the poles are stretched, so land covers rather
  // more of the grid than it does of the globe. Well outside this band means
  // the fill inverted wholesale.
  let total = 0
  for (const f of fraction) total += f
  const cover = total / H
  console.log(`Land covers ${(cover * 100).toFixed(1)}% of the grid.`)
  if (cover < 0.2 || cover > 0.45) {
    throw new Error(`land cover of ${(cover * 100).toFixed(0)}% is not plausible - the fill is probably inverted`)
  }
}

// Run-length encode the whole grid, row-major, starting from a run of ocean
// (a leading zero-length run if the very first cell is land). Lengths go out
// as varints: seven bits a byte, high bit set while more bytes follow.
const runs = []
{
  let run = 0
  let value = 0
  for (let i = 0; i < W * H; i++) {
    const bit = (bits[i >> 3] >> (i & 7)) & 1
    if (bit === value) run++
    else {
      runs.push(run)
      value = bit
      run = 1
    }
  }
  runs.push(run)
}
const varints = []
for (const n of runs) {
  let v = n
  while (v >= 128) {
    varints.push((v & 127) | 128)
    v >>>= 7
  }
  varints.push(v)
}
const b64 = Buffer.from(Uint8Array.from(varints)).toString('base64')

writeFileSync(
  'src/data/landMask.ts',
  `// GENERATED by scripts/generate-landmask.mjs - do not edit by hand.
// Source: Natural Earth 10m land (public domain) via world-atlas, with the
// 50m land filling in Antarctica below ${southernLimit.toFixed(1)} degrees, where the 10m data stops.
//
// Run-length encoded, row-major from the top-left (lon -180, lat +90),
// alternating ocean and land and starting with ocean. Lengths are varints:
// seven bits a byte, high bit set while more bytes follow, then base64. At
// this size the runs come to about a fifth of the raw bitmap.
export const LAND_MASK_WIDTH = ${W}
export const LAND_MASK_HEIGHT = ${H}
export const LAND_MASK_RLE =
  '${b64}'
`,
)

console.log(`Wrote src/data/landMask.ts: ${W}x${H}, ${detailed.edgeCount + polarEdges.edgeCount} edges, ${detail.closed + polar.closed} rings closed`)
console.log(`${runs.length} runs, ${(b64.length / 1024).toFixed(0)} KB of base64`)
if (oddRows) throw new Error(`${oddRows} rows had an odd crossing count - the fill for those rows is wrong`)
