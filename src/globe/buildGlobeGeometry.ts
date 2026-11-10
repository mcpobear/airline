import * as THREE from 'three'
import { isLand } from '../data/landLookup'
import { toDeg } from '../sim/geo'
import { fbm3, jitter3 } from './noise'

const col = (hex: string) => new THREE.Color(hex)
const PALETTE = {
  oceanDeep: col('#1d5ca8'),
  oceanMid: col('#2a73bd'),
  oceanShallow: col('#47a6dc'),
  grass: col('#7ba542'),
  forest: col('#4c7c34'),
  jungle: col('#3d7a3a'),
  tundra: col('#8c9a68'),
  desert: col('#d2b274'),
  dry: col('#b8944f'),
  rock: col('#8b7a5c'),
  snow: col('#f1f6ff'),
}

const RELIEF_BASE = 0.004
const RELIEF_RANGE = 0.022

function landHeight(x: number, y: number, z: number): number {
  const f = fbm3(x * 5 + 11.3, y * 5 + 3.7, z * 5 + 7.1, 3)
  return RELIEF_BASE + RELIEF_RANGE * f * f * 2
}

function nearCoast(lat: number, lon: number): boolean {
  const d = 2.5
  const dl = d / Math.max(0.35, Math.cos((lat * Math.PI) / 180))
  return (
    isLand(lat + d, lon) || isLand(lat - d, lon) || isLand(lat, lon + dl) || isLand(lat, lon - dl)
  )
}

function landColor(lat: number, x: number, y: number, z: number, out: THREE.Color) {
  const absLat = Math.abs(lat)
  const elev = fbm3(x * 5 + 11.3, y * 5 + 3.7, z * 5 + 7.1, 3)
  const moist = fbm3(x * 3 + 40, y * 3 + 40, z * 3 + 40, 3)

  if (absLat > 68 || (elev > 0.7 && absLat > 38)) return out.copy(PALETTE.snow)
  if (elev > 0.64) return out.copy(PALETTE.rock).lerp(PALETTE.snow, Math.max(0, (elev - 0.64) * 6))
  if (absLat > 9 && absLat < 38 && moist < 0.5) {
    return out.copy(PALETTE.desert).lerp(PALETTE.dry, Math.min(1, (0.5 - moist) * 4))
  }
  if (absLat > 56) return out.copy(PALETTE.tundra).lerp(PALETTE.forest, moist * 0.6)
  if (absLat < 14 && moist > 0.5) return out.copy(PALETTE.jungle).lerp(PALETTE.forest, 0.3)
  return out.copy(PALETTE.grass).lerp(PALETTE.forest, moist)
}

/**
 * Builds a flat-shaded, vertex-coloured icosphere in the stylised low-poly
 * look of the reference. Land is raised with deterministic noise relief; faces
 * are coloured by biome (latitude + noise), oceans by distance-to-coast.
 *
 * Built once (the caller memoises) and shared - never rebuilt per frame.
 */
export function buildGlobeGeometry(detail: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail) // non-indexed: 3 verts per face
  const pos = geo.attributes.position as THREE.BufferAttribute
  const vertexCount = pos.count

  const landFlag = new Uint8Array(vertexCount)
  const v = new THREE.Vector3()
  for (let i = 0; i < vertexCount; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const lat = toDeg(Math.asin(v.y))
    const lon = toDeg(Math.atan2(v.x, v.z))
    const land = isLand(lat, lon)
    landFlag[i] = land ? 1 : 0
    const r = land ? 1 + landHeight(v.x, v.y, v.z) : 1
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r)
  }

  const colors = new Float32Array(vertexCount * 3)
  const c = new THREE.Color()
  const centroid = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  for (let f = 0; f < vertexCount; f += 3) {
    centroid.set(0, 0, 0)
    for (let k = 0; k < 3; k++) centroid.add(tmp.fromBufferAttribute(pos, f + k))
    centroid.normalize()
    const lat = toDeg(Math.asin(centroid.y))
    const lon = toDeg(Math.atan2(centroid.x, centroid.z))
    const isLandFace = landFlag[f] + landFlag[f + 1] + landFlag[f + 2] >= 2
    const shade = 0.9 + 0.18 * jitter3(centroid.x, centroid.y, centroid.z)

    if (isLandFace) {
      landColor(lat, centroid.x, centroid.y, centroid.z, c)
    } else if (nearCoast(lat, lon)) {
      c.copy(PALETTE.oceanShallow)
    } else {
      const depth = fbm3(centroid.x * 4 + 90, centroid.y * 4 + 90, centroid.z * 4 + 90, 2)
      c.copy(PALETTE.oceanDeep).lerp(PALETTE.oceanMid, depth)
    }
    c.multiplyScalar(isLandFace ? shade : 0.96 + (shade - 0.9) * 0.4)

    for (let k = 0; k < 3; k++) {
      const o = (f + k) * 3
      colors[o] = c.r
      colors[o + 1] = c.g
      colors[o + 2] = c.b
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals() // non-indexed => flat per-face normals
  geo.computeBoundingSphere()
  return geo
}
