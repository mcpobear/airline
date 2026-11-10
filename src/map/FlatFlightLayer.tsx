import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getAircraftModel } from '../data/aircraft'
import { airlinerGeometry, VISUAL_CATEGORIES } from '../globe/aircraftGeometry'
import { flightProgress, flightWindows, altitudeFraction } from '../sim/flightProfile'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import type { AircraftModel } from '../types/game'
import { PLANE_COLOR, PLANE_SELECTED } from './markerStyle'
import { nearestX } from './projection'
import { pointAt, routePath, type PathPoint } from './routePath'

const CAPACITY = 64
/** Aircraft length in CSS pixels, kept roughly constant as the map zooms. */
const PLANE_PX = 26
const MIN_WORLD = 0.012
const MAX_WORLD = 0.07

const scratch: PathPoint = { x: 0, y: 0, hx: 1, hy: 0 }
const basisX = new THREE.Vector3()
const basisY = new THREE.Vector3(0, 0, 1)
const basisZ = new THREE.Vector3()
const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const scaleVec = new THREE.Vector3()
const colour = new THREE.Color()

/**
 * Airborne aircraft on the flat map: one instanced mesh per airliner shape, so
 * a jumbo reads as a jumbo. Each is placed on the copy of the world nearest the
 * camera and turned to face along its route, which is drawn from the same
 * unwrapped path so the aircraft always sits exactly on its line.
 */
export const FlatFlightLayer = memo(function FlatFlightLayer() {
  return (
    <>
      <FlightRoutes />
      {VISUAL_CATEGORIES.map((c) => (
        <PlaneGroup key={c} category={c} />
      ))}
    </>
  )
})

function PlaneGroup({ category }: { category: AircraftModel['visualCategory'] }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const hit = useRef<THREE.InstancedMesh>(null)
  const ids = useRef<string[]>([])
  const geometry = useMemo(() => airlinerGeometry(category), [category])
  const hitGeometry = useMemo(() => new THREE.CircleGeometry(0.75, 10), [])
  const { camera } = useThree()

  useFrame(() => {
    const m = mesh.current
    const h = hit.current
    if (!m || !h) return
    const { aircraft } = useGameStore.getState()
    const selection = useUiStore.getState().selection
    const zoom = (camera as THREE.OrthographicCamera).zoom
    const size = Math.min(MAX_WORLD, Math.max(MIN_WORLD, PLANE_PX / zoom))
    let n = 0
    ids.current = []
    for (const a of aircraft) {
      if (!a.flight || n >= CAPACITY) continue
      if (getAircraftModel(a.modelId)?.visualCategory !== category) continue
      const path = routePath(a.flight.from, a.flight.to)
      const windows = flightWindows(a.flight)
      const progress = flightProgress(a.flight, Date.now())
      pointAt(path, progress, scratch)
      // Climbing and descending aircraft sit a little smaller, as if further below.
      const lift = 0.86 + 0.18 * altitudeFraction(progress, windows)
      basisZ.set(scratch.hx, scratch.hy, 0)
      basisX.set(-scratch.hy, scratch.hx, 0)
      position.set(nearestX(scratch.x, camera.position.x), scratch.y, 0.05)
      matrix.makeBasis(basisX, basisY, basisZ)
      quaternion.setFromRotationMatrix(matrix)
      m.setMatrixAt(n, matrix.compose(position, quaternion, scaleVec.setScalar(size * lift)))
      h.setMatrixAt(n, matrix.compose(position, quaternion, scaleVec.setScalar(size * 1.6)))
      const picked = selection?.kind === 'aircraft' && selection.id === a.id
      m.setColorAt(n, colour.copy(picked ? PLANE_SELECTED : PLANE_COLOR))
      ids.current.push(a.id)
      n++
    }
    m.count = h.count = n
    m.instanceMatrix.needsUpdate = true
    h.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.boundingSphere = null
    h.boundingSphere = null
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || e.instanceId === undefined) return
    const id = ids.current[e.instanceId]
    if (!id) return
    e.stopPropagation()
    useUiStore.getState().setSelection({ kind: 'aircraft', id })
  }

  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, undefined, CAPACITY]} frustumCulled={false} count={0}>
        <meshStandardMaterial flatShading roughness={0.55} metalness={0.05} />
      </instancedMesh>
      <instancedMesh
        ref={hit}
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

function lineGeometry(from: string, to: string): THREE.BufferGeometry {
  const path = routePath(from, to)
  const positions = new Float32Array(path.count * 3)
  for (let i = 0; i < path.count; i++) {
    positions[i * 3] = path.points[i * 2]
    positions[i * 3 + 1] = path.points[i * 2 + 1]
    positions[i * 3 + 2] = 0.01
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return g
}

const geometryCache = new Map<string, THREE.BufferGeometry>()
function cachedLine(from: string, to: string) {
  const key = `${from}>${to}`
  let g = geometryCache.get(key)
  if (!g) {
    g = lineGeometry(from, to)
    geometryCache.set(key, g)
  }
  return g
}

/** One line per route, shifted each frame onto the copy of the world in view. */
function RouteLine({ from, to, dashed = false }: { from: string; to: string; dashed?: boolean }) {
  const { camera } = useThree()
  const line = useMemo(() => {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color: '#c2491c', dashSize: 0.03, gapSize: 0.02, transparent: true, opacity: 0.95 })
      : new THREE.LineBasicMaterial({ color: '#fdf6ea', transparent: true, opacity: 0.8 })
    const l = new THREE.Line(cachedLine(from, to), material)
    l.frustumCulled = false
    if (dashed) l.computeLineDistances()
    return l
  }, [from, to, dashed])

  useEffect(() => () => (line.material as THREE.Material).dispose(), [line])
  useFrame(() => {
    const path = routePath(from, to)
    const midX = path.points[(path.count >> 1) * 2]
    line.position.x = nearestX(midX, camera.position.x) - midX
  })
  return <primitive object={line} />
}

function FlightRoutes() {
  const routes = useGameStore(
    useShallow((s) => [
      ...new Set(s.aircraft.filter((a) => a.flight).map((a) => `${a.flight!.from}>${a.flight!.to}`)),
    ].sort()),
  )
  const preview = useUiStore((s) => s.previewRoute)
  return (
    <>
      {routes.map((r) => {
        const [from, to] = r.split('>')
        return <RouteLine key={r} from={from} to={to} />
      })}
      {preview && <RouteLine from={preview.from} to={preview.to} dashed />}
    </>
  )
}
