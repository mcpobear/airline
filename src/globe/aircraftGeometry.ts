import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AircraftModel } from '../types/game'

/**
 * Low-poly airliners built to each class's real proportions, so a regional jet
 * doesn't read like a widebody: swept wings, under-wing engines (four on the
 * jumbo), a tapered fuselage and a swept fin.
 *
 * Convention: nose along +Z, up along +Y, wings along X. Every model is
 * normalised to length 1 and centred, so one size setting fits all of them.
 */
export interface AirlinerSpec {
  /** Fuselage length, before normalisation. */
  length: number
  radius: number
  /** Tip-to-tip wing span. */
  span: number
  rootChord: number
  tipChord: number
  /** How far back the tip sits relative to the root (wing sweep). */
  sweep: number
  /** Wing position along the fuselage, 0 = nose, 1 = tail. */
  wingAt: number
  dihedral: number
  engines: 2 | 4
  engineRadius: number
  tailSpan: number
  finHeight: number
}

export const AIRLINER_SPECS: Record<AircraftModel['visualCategory'], AirlinerSpec> = {
  regional: {
    length: 3.0, radius: 0.17, span: 2.9, rootChord: 0.62, tipChord: 0.26, sweep: 0.42,
    wingAt: 0.52, dihedral: 0.06, engines: 2, engineRadius: 0.11, tailSpan: 1.1, finHeight: 0.62,
  },
  narrowbody: {
    length: 3.9, radius: 0.2, span: 3.7, rootChord: 0.8, tipChord: 0.28, sweep: 0.62,
    wingAt: 0.52, dihedral: 0.07, engines: 2, engineRadius: 0.15, tailSpan: 1.35, finHeight: 0.74,
  },
  widebody: {
    length: 6.0, radius: 0.31, span: 5.9, rootChord: 1.35, tipChord: 0.4, sweep: 1.15,
    wingAt: 0.5, dihedral: 0.08, engines: 2, engineRadius: 0.24, tailSpan: 2.1, finHeight: 1.1,
  },
  jumbo: {
    length: 7.0, radius: 0.36, span: 6.6, rootChord: 1.5, tipChord: 0.42, sweep: 1.35,
    wingAt: 0.5, dihedral: 0.08, engines: 4, engineRadius: 0.23, tailSpan: 2.5, finHeight: 1.3,
  },
}

/**
 * A flat tapered, swept slab from a planform outline.
 * The shape is drawn with +x spanwise and +y towards the tail, then laid flat
 * so thickness runs along +y and the chord along -z (the tail direction).
 */
function slab(points: Array<[number, number]>, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, -thickness / 2)
  g.rotateX(-Math.PI / 2)
  return g
}

function wing(spec: AirlinerSpec): THREE.BufferGeometry {
  const half = spec.span / 2
  const { sweep, rootChord: root, tipChord: tip } = spec
  const right = slab(
    [[0, 0], [half, sweep], [half, sweep + tip], [0, root]],
    Math.max(0.035, spec.radius * 0.26),
  )
  const left = right.clone().scale(-1, 1, 1)
  right.rotateZ(-spec.dihedral)
  left.rotateZ(spec.dihedral)
  return mergeGeometries([right.toNonIndexed(), left.toNonIndexed()])!
}

function fin(spec: AirlinerSpec): THREE.BufferGeometry {
  const g = slab(
    [[0, 0], [spec.finHeight, spec.finHeight * 0.75], [spec.finHeight, spec.finHeight * 0.75 + spec.finHeight * 0.42], [0, spec.finHeight * 1.05]],
    Math.max(0.03, spec.radius * 0.22),
  )
  g.rotateZ(Math.PI / 2) // stand the half-wing up on the tail
  return g
}

function nacelle(spec: AirlinerSpec, x: number, z: number, y: number): THREE.BufferGeometry {
  const r = spec.engineRadius
  const body = new THREE.CylinderGeometry(r, r * 0.86, r * 3.1, 8).rotateX(Math.PI / 2)
  const pylon = new THREE.BoxGeometry(r * 0.3, r * 1.1, r * 1.5).translate(0, r * 0.75, -r * 0.3)
  const g = mergeGeometries([body.toNonIndexed(), pylon.toNonIndexed()])!
  return g.translate(x, y, z)
}

function buildAirliner(spec: AirlinerSpec): THREE.BufferGeometry {
  const { length: L, radius: r } = spec
  const parts: THREE.BufferGeometry[] = []

  // Fuselage: a straight tube with a rounded nose and a tapered, slightly raised tail.
  const barrelLength = L * 0.62
  parts.push(new THREE.CylinderGeometry(r, r, barrelLength, 10).rotateX(Math.PI / 2).translate(0, 0, L * 0.5 - L * 0.2 - barrelLength / 2))
  const nose = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  nose.rotateX(Math.PI / 2).scale(1, 1, 1.7).translate(0, 0, L * 0.5 - L * 0.2)
  parts.push(nose)
  const tail = new THREE.CylinderGeometry(r, r * 0.22, L * 0.3, 10).rotateX(Math.PI / 2).translate(0, r * 0.14, -L * 0.5 + L * 0.15)
  parts.push(tail)

  const wingZ = L * 0.5 - spec.wingAt * L - spec.rootChord * 0.35
  const w = wing(spec)
  w.translate(0, -r * 0.35, wingZ)
  parts.push(w)

  const stab = wing({ ...spec, span: spec.tailSpan, rootChord: spec.rootChord * 0.55, tipChord: spec.tipChord * 0.6, sweep: spec.sweep * 0.5, dihedral: 0.05 })
  stab.translate(0, r * 0.25, -L * 0.5 + L * 0.1)
  parts.push(stab)

  const f = fin(spec)
  f.translate(0, r * 0.5, -L * 0.5 + L * 0.16)
  parts.push(f)

  {
    const half = spec.span / 2
    const inner = half * 0.34
    const outer = half * 0.62
    const positions = spec.engines === 4 ? [-outer, -inner, inner, outer] : [-inner * 1.15, inner * 1.15]
    for (const x of positions) {
      const t = Math.abs(x) / half
      // Just ahead of and below the leading edge, following the wing's sweep and dihedral.
      const leadingEdgeZ = wingZ - spec.sweep * t
      const wingY = -r * 0.35 + Math.abs(x) * spec.dihedral
      parts.push(nacelle(spec, x, leadingEdgeZ + spec.engineRadius * 1.1, wingY - spec.engineRadius * 0.8))
    }
  }

  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!
  merged.computeBoundingBox()
  const box = merged.boundingBox!
  const scale = 1 / (box.max.z - box.min.z)
  merged.translate(0, 0, -(box.max.z + box.min.z) / 2)
  merged.scale(scale, scale, scale)
  merged.computeVertexNormals()
  return merged
}

const cache = new Map<string, THREE.BufferGeometry>()

/** The shared geometry for a visual class, built once. */
export function airlinerGeometry(category: AircraftModel['visualCategory']): THREE.BufferGeometry {
  let g = cache.get(category)
  if (!g) {
    g = buildAirliner(AIRLINER_SPECS[category])
    cache.set(category, g)
  }
  return g
}

export const VISUAL_CATEGORIES: Array<AircraftModel['visualCategory']> = ['regional', 'narrowbody', 'widebody', 'jumbo']
