import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getAircraftModel } from '../data/aircraft'
import { airlinerGeometry, VISUAL_CATEGORIES } from './aircraftGeometry'
import type { AircraftModel } from '../types/game'
import { flightPosition, flightWindows, altitudeFraction } from '../sim/flightProfile'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { globeStyle } from '../world/palettes'
import { latLonToVector3 } from './coords'
import { CRUISE_LIFT, GROUND_RADIUS, routePoints } from './route'

const CAPACITY = 64
const MAX_PITCH = 0.45

const up = new THREE.Vector3()
const fwd = new THREE.Vector3()
const tangent = new THREE.Vector3()
const x = new THREE.Vector3()
const z = new THREE.Vector3()
const p1 = new THREE.Vector3()
const p2 = new THREE.Vector3()
const m = new THREE.Matrix4()
const scaleV = new THREE.Vector3()
const quat = new THREE.Quaternion()
const COLOR = new THREE.Color()

/** World position and heading of an aircraft at `now`, written into the module scratch vectors. */
export function placeAircraft(f: Parameters<typeof flightPosition>[0], now: number, out: THREE.Matrix4, scale: number) {
  const w = flightWindows(f)
  const dur = f.arrivesAt - f.departedAt
  const here = flightPosition(f, now)
  const eps = Math.min(0.02, 1 / 50) * dur
  // Look slightly ahead (or behind, right at the end) to get a heading.
  const aheadT = here.progress < 0.98 ? now + eps : now - eps
  const there = flightPosition(f, aheadT)
  const hereR = GROUND_RADIUS + CRUISE_LIFT * here.altitude
  latLonToVector3(here.lat, here.lon, hereR, p1)
  latLonToVector3(there.lat, there.lon, hereR, p2)
  up.copy(p1).normalize()
  tangent.copy(p2).sub(p1)
  if (aheadT < now) tangent.negate()
  tangent.addScaledVector(up, -tangent.dot(up))
  if (tangent.lengthSq() < 1e-12) tangent.set(0, 0, 1).addScaledVector(up, -up.z)
  tangent.normalize()
  // Pitch follows the altitude slope: nose up in climb, down in descent.
  const dAlt = altitudeFraction(Math.min(1, here.progress + 0.01), w) - altitudeFraction(Math.max(0, here.progress - 0.01), w)
  const pitch = THREE.MathUtils.clamp(dAlt * 12, -MAX_PITCH, MAX_PITCH)
  fwd.copy(tangent).multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch))
  x.crossVectors(up, fwd).normalize()
  z.crossVectors(x, up).normalize()
  m.makeBasis(x, up, z)
  quat.setFromRotationMatrix(m)
  out.compose(p1, quat, scaleV.setScalar(scale))
}

/**
 * Airborne aircraft, drawn as one instanced mesh per airliner shape so a
 * regional jet, a narrowbody, a widebody and a jumbo are all recognisable.
 * Each group carries an invisible, larger copy used as the click target.
 */
export const FlightLayer = memo(function FlightLayer() {
  return (
    <>
      {VISUAL_CATEGORIES.map((category) => (
        <PlaneGroup key={category} category={category} />
      ))}
      <FlightPaths />
      <PreviewRoute />
    </>
  )
})

function PlaneGroup({ category }: { category: AircraftModel['visualCategory'] }) {
  const planes = useRef<THREE.InstancedMesh>(null)
  const hits = useRef<THREE.InstancedMesh>(null)
  const ids = useRef<string[]>([])
  const geometry = useMemo(() => airlinerGeometry(category), [category])
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(1, 8, 6), [])
  const { camera } = useThree()
  const mat = useMemo(() => new THREE.Matrix4(), [])
  const setSelection = useUiStore((s) => s.setSelection)

  useFrame(() => {
    const pm = planes.current
    const hm = hits.current
    if (!pm || !hm) return
    const now = Date.now()
    const planeColour = globeStyle(useUiStore.getState().globeStyle).plane
    const { aircraft } = useGameStore.getState()
    const selection = useUiStore.getState().selection
    const size = THREE.MathUtils.clamp(0.013 * (camera.position.length() - 0.55), 0.018, 0.06)
    let n = 0
    ids.current = []
    for (const a of aircraft) {
      if (!a.flight || n >= CAPACITY) continue
      if (getAircraftModel(a.modelId)?.visualCategory !== category) continue
      placeAircraft(a.flight, now, mat, size)
      pm.setMatrixAt(n, mat)
      mat.decompose(p1, quat, scaleV)
      hm.setMatrixAt(n, mat.compose(p1, quat, scaleV.setScalar(size * 1.5)))
      const picked = selection?.kind === 'aircraft' && selection.id === a.id
      pm.setColorAt(n, COLOR.set(picked ? '#e0581e' : planeColour))
      ids.current.push(a.id)
      n++
    }
    pm.count = hm.count = n
    pm.instanceMatrix.needsUpdate = true
    hm.instanceMatrix.needsUpdate = true
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true
    // Cached bounds would go stale as the aircraft move.
    pm.boundingSphere = null
    hm.boundingSphere = null
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || e.instanceId === undefined) return
    const id = ids.current[e.instanceId]
    if (!id) return
    e.stopPropagation()
    setSelection({ kind: 'aircraft', id })
  }

  return (
    <>
      <instancedMesh ref={planes} args={[geometry, undefined, CAPACITY]} frustumCulled={false} count={0}>
        <meshStandardMaterial flatShading roughness={0.45} metalness={0.1} />
      </instancedMesh>
      <instancedMesh
        ref={hits}
        args={[hitGeometry, undefined, CAPACITY]}
        frustumCulled={false}
        count={0}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshBasicMaterial visible={false} />
      </instancedMesh>
    </>
  )
}

const lineCache = new Map<string, THREE.BufferGeometry>()
function lineGeometry(from: string, to: string) {
  const key = `${from}>${to}`
  let g = lineCache.get(key)
  if (!g) {
    g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(routePoints(from, to), 3))
    lineCache.set(key, g)
  }
  return g
}

/** A route polyline (solid, or dashed for previews). The geometry is shared and cached per route. */
function RouteLine({ from, to, dashed = false }: { from: string; to: string; dashed?: boolean }) {
  const routeColour = globeStyle(useUiStore((s) => s.globeStyle)).route
  const line = useMemo(() => {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color: '#ffd24a', dashSize: 0.02, gapSize: 0.014, transparent: true, opacity: 0.95, depthWrite: false })
      : new THREE.LineBasicMaterial({ color: routeColour, transparent: true, opacity: 0.75, depthWrite: false })
    const l = new THREE.Line(lineGeometry(from, to), material)
    if (dashed) l.computeLineDistances()
    return l
  }, [from, to, dashed, routeColour])
  useEffect(() => () => (line.material as THREE.Material).dispose(), [line])
  return <primitive object={line} />
}

/** One faint line per distinct route currently being flown. */
function FlightPaths() {
  const routes = useGameStore(
    useShallow((s) => [...new Set(s.aircraft.filter((a) => a.flight).map((a) => `${a.flight!.from}>${a.flight!.to}`))].sort()),
  )
  return (
    <>
      {routes.map((r) => {
        const [from, to] = r.split('>')
        return <RouteLine key={r} from={from} to={to} />
      })}
    </>
  )
}

/** Dashed line for the route being considered in the dispatch panel. */
function PreviewRoute() {
  const preview = useUiStore((s) => s.previewRoute)
  return preview ? <RouteLine from={preview.from} to={preview.to} dashed /> : null
}
