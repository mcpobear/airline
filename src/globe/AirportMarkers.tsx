import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BALANCE } from '../config/balance'
import { AIRPORTS } from '../data/airports'
import { useGameStore } from '../state/gameStore'
import { incomingCounts, parkedCounts, selectedAirportIata } from '../state/selectors'
import { useUiStore } from '../state/uiStore'
import { latLonToVector3 } from './coords'

const G = BALANCE.globe
const MARKER_RADIUS = 1.032
/** Marker size in world units at distance 1; scaled with camera distance to keep a steady on-screen size. */
const BASE_SIZE = 0.0085

const COLORS = {
  hq: new THREE.Color('#e0581e'),
  unlocked: new THREE.Color('#0f8e86'),
  locked: new THREE.Color('#fdf8f0'),
  selected: new THREE.Color('#f2b705'),
}

type MarkerState = 'hq' | 'unlocked' | 'locked'

function markerState(iata: string, hq: string | undefined, unlocked: Set<string>): MarkerState {
  if (iata === hq) return 'hq'
  return unlocked.has(iata) ? 'unlocked' : 'locked'
}

const POSITIONS = AIRPORTS.map((a) => latLonToVector3(a.lat, a.lon, MARKER_RADIUS))
const UNIT_POSITIONS = AIRPORTS.map((a) => latLonToVector3(a.lat, a.lon, 1))

/**
 * All airports as one InstancedMesh (a single draw call, one raycast target).
 * Instance colour/size are refreshed only when game or selection state changes
 * or the camera distance changes noticeably, never every frame.
 */
const Markers = memo(function Markers() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const airline = useGameStore((s) => s.airline)
  const unlockedList = useGameStore((s) => s.unlockedAirports)
  const selection = useUiStore((s) => s.selection)
  const draftHq = useUiStore((s) => s.draftHq)
  const camera = useThree((s) => s.camera)
  const lastDistance = useRef(0)

  const unlocked = useMemo(() => new Set(unlockedList), [unlockedList])
  const aircraft = useGameStore((s) => s.aircraft)
  const selectedIata = selectedAirportIata(selection, aircraft) ?? draftHq ?? undefined
  const hq = airline?.hq

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  const update = (distance: number) => {
    const m = mesh.current
    if (!m) return
    const zoomScale = Math.max(0.35, (distance - 1) * 0.55)
    AIRPORTS.forEach((a, i) => {
      const state = markerState(a.iata, hq, unlocked)
      const selected = a.iata === selectedIata
      const size = BASE_SIZE * zoomScale * (state === 'hq' ? 1.7 : selected ? 1.5 : state === 'unlocked' ? 1.15 : 0.9)
      dummy.position.copy(POSITIONS[i])
      dummy.scale.setScalar(size / BASE_SIZE)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.copy(selected ? COLORS.selected : COLORS[state]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }

  useEffect(() => {
    lastDistance.current = camera.position.length()
    update(lastDistance.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, hq, selectedIata])

  useFrame(() => {
    const d = camera.position.length()
    if (Math.abs(d - lastDistance.current) / lastDistance.current > 0.01) {
      lastDistance.current = d
      update(d)
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || e.instanceId === undefined) return
    e.stopPropagation()
    const airport = AIRPORTS[e.instanceId]
    if (!useGameStore.getState().airline) {
      useUiStore.getState().setDraftHq(airport.iata)
    } else {
      useUiStore.getState().setSelection({ kind: 'airport', iata: airport.iata })
    }
    useUiStore.getState().focusOn(airport.lat, airport.lon)
  }

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, AIRPORTS.length]}
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <sphereGeometry args={[BASE_SIZE, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
})

type Rect = [number, number, number, number]
interface Candidate {
  i: number
  el: HTMLDivElement
  text: string
  state: MarkerState
  selected: boolean
  x: number
  y: number
  rank: number
}
const CLASS_RANK = { international: 0, major: 1, regional: 2 } as const
const overlaps = (a: Rect, b: Rect) => a[0] < b[2] + 2 && a[2] + 2 > b[0] && a[1] < b[3] + 2 && a[3] + 2 > b[1]

const LABEL_BASE =
  'absolute left-0 top-0 whitespace-nowrap rounded-full px-2 py-[1px] text-[11px] font-extrabold leading-tight shadow-md'
const LABEL_STYLE: Record<MarkerState | 'selected', string> = {
  hq: 'bg-orange text-white',
  unlocked: 'bg-panel/95 text-teal border border-teal/40',
  locked: 'bg-panel/80 text-muted',
  selected: 'bg-ink text-paper',
}

/**
 * IATA labels as one lightweight DOM overlay, positioned imperatively each
 * frame (no React renders). Back-facing airports are hidden, and level of
 * detail decides which labels show at the current zoom.
 */
const Labels = memo(function Labels() {
  const { camera, gl, size } = useThree()
  const elements = useRef<HTMLDivElement[]>([])
  const appliedClass = useRef<string[]>([])
  const appliedText = useRef<string[]>([])
  const countCache = useRef<{ ref: unknown; map: Map<string, number>; incoming: Map<string, number> }>({
    ref: null,
    map: new Map(),
    incoming: new Map(),
  })
  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const parent = gl.domElement.parentElement!
    const layer = document.createElement('div')
    layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1'
    elements.current = AIRPORTS.map((a) => {
      const el = document.createElement('div')
      el.textContent = a.iata
      el.style.display = 'none'
      layer.appendChild(el)
      return el
    })
    appliedClass.current = AIRPORTS.map(() => '')
    appliedText.current = AIRPORTS.map((a) => a.iata)
    parent.appendChild(layer)
    return () => {
      parent.removeChild(layer)
      elements.current = []
    }
  }, [gl])

  useFrame(() => {
    const { airline, unlockedAirports, aircraft } = useGameStore.getState()
    const { selection, draftHq } = useUiStore.getState()
    const selectedIata = selectedAirportIata(selection, aircraft) ?? draftHq
    if (countCache.current.ref !== aircraft)
      countCache.current = { ref: aircraft, map: parkedCounts(aircraft), incoming: incomingCounts(aircraft) }
    const counts = countCache.current.map
    const incoming = countCache.current.incoming
    const unlocked = new Set(unlockedAirports)
    const distance = camera.position.length()
    camDir.copy(camera.position).normalize()
    // A point on the unit sphere faces the camera when dot > 1/distance.
    const facing = 1 / distance + 0.04

    // Pass 1: which labels could show, and where. Pass 2: greedy declutter by priority.
    const candidates: Candidate[] = []
    AIRPORTS.forEach((a, i) => {
      const el = elements.current[i]
      if (!el) return
      const state = markerState(a.iata, airline?.hq, unlocked)
      const selected = a.iata === selectedIata
      const important = selected || state !== 'locked'
      const limit = important ? G.maxLabelDistance : G.labelDistance[a.classification]
      if (distance > limit || UNIT_POSITIONS[i].dot(camDir) < facing) {
        if (el.style.display !== 'none') el.style.display = 'none'
        return
      }
      const parked = counts.get(a.iata) ?? 0
      const inbound = incoming.get(a.iata) ?? 0
      const text = a.iata + (parked > 0 ? ` ✈${parked}` : '') + (inbound > 0 ? ` ↘${inbound}` : '')
      v.copy(POSITIONS[i]).project(camera)
      candidates.push({
        i,
        el,
        text,
        state,
        selected,
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
        rank: selected ? 0 : state === 'hq' ? 1 : state === 'unlocked' ? 2 : 3 + CLASS_RANK[a.classification],
      })
    })
    candidates.sort((p, q) => p.rank - q.rank)
    const placed: Rect[] = []
    for (const c of candidates) {
      const w = c.text.length * 7.2 + 20
      const rect: Rect = [c.x - w / 2, c.y - 34, c.x + w / 2, c.y - 12]
      if (!c.selected && placed.some((r) => overlaps(r, rect))) {
        if (c.el.style.display !== 'none') c.el.style.display = 'none'
        continue
      }
      placed.push(rect)
      const cls = `${LABEL_BASE} ${LABEL_STYLE[c.selected ? 'selected' : c.state]}`
      if (appliedClass.current[c.i] !== cls) {
        c.el.className = cls
        appliedClass.current[c.i] = cls
      }
      if (appliedText.current[c.i] !== c.text) {
        c.el.textContent = c.text
        appliedText.current[c.i] = c.text
      }
      c.el.style.display = ''
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) translate(-50%, -165%)`
      c.el.style.zIndex = c.selected ? '3' : c.state === 'locked' ? '1' : '2'
    }
  })
  return null
})

export function AirportMarkers() {
  return (
    <>
      <Markers />
      <Labels />
    </>
  )
}
