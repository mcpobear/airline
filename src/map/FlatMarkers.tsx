import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { AIRPORTS } from '../data/airports'
import { useGameStore } from '../state/gameStore'
import { incomingCounts, parkedCounts, selectedAirportIata } from '../state/selectors'
import { useUiStore } from '../state/uiStore'
import {
  LABEL_BASE,
  LABEL_STYLE,
  labelRank,
  labelText,
  MARKER_COLORS,
  markerScale,
  markerState,
  overlaps,
  type MarkerState,
  type Rect,
} from './markerStyle'
import { MAP_W, nearestX, project } from './projection'

/** Marker diameter in CSS pixels, kept constant as the map zooms. */
const MARKER_PX = 7
/** Zoom at which each class of airport earns a label, as a multiple of the whole-world zoom. */
const LABEL_ZOOM = { international: 1.0, major: 2.1, regional: 3.4 } as const

const POSITIONS = AIRPORTS.map((a) => project(a.lat, a.lon))

/**
 * All airports as one instanced mesh of flat discs. Positions are recomputed
 * each frame against the camera so every marker sits on the copy of the world
 * nearest the viewer, which is what makes the seam invisible.
 */
export const FlatMarkers = memo(function FlatMarkers({ fitZoom }: { fitZoom: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.CircleGeometry(0.5, 18), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colour = useMemo(() => new THREE.Color(), [])
  const { camera } = useThree()

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const { airline, unlockedAirports, aircraft } = useGameStore.getState()
    const ui = useUiStore.getState()
    const unlocked = new Set(unlockedAirports)
    const selectedIata = selectedAirportIata(ui.selection, aircraft) ?? ui.draftHq ?? undefined
    const zoom = (camera as THREE.OrthographicCamera).zoom
    const unit = MARKER_PX / zoom
    for (let i = 0; i < AIRPORTS.length; i++) {
      const a = AIRPORTS[i]
      const state = markerState(a.iata, airline?.hq, unlocked)
      const selected = a.iata === selectedIata
      dummy.position.set(nearestX(POSITIONS[i].x, camera.position.x), POSITIONS[i].y, 0.02)
      dummy.scale.setScalar(unit * markerScale(state, selected))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, colour.copy(selected ? MARKER_COLORS.selected : MARKER_COLORS[state]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.boundingSphere = null
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || e.instanceId === undefined) return
    e.stopPropagation()
    const airport = AIRPORTS[e.instanceId]
    if (!useGameStore.getState().airline) useUiStore.getState().setDraftHq(airport.iata)
    else useUiStore.getState().setSelection({ kind: 'airport', iata: airport.iata })
    useUiStore.getState().focusOn(airport.lat, airport.lon)
  }

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[geometry, undefined, AIRPORTS.length]}
        frustumCulled={false}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <FlatLabels fitZoom={fitZoom} />
    </>
  )
})

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

/**
 * IATA labels as a DOM overlay, positioned imperatively each frame so React
 * never re-renders them. Labels are offered in priority order and any that
 * would collide with one already placed is dropped, which keeps dense regions
 * readable instead of a wall of overlapping codes.
 */
const FlatLabels = memo(function FlatLabels({ fitZoom }: { fitZoom: number }) {
  const { camera, size, gl } = useThree()
  const elements = useRef<HTMLDivElement[]>([])
  const appliedText = useRef<string[]>([])
  const appliedClass = useRef<string[]>([])

  // The labels live in a plain DOM layer over the canvas: inside the R3F tree
  // React would try to build them as three.js objects.
  useEffect(() => {
    const parent = gl.domElement.parentElement!
    const layer = document.createElement('div')
    layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1'
    elements.current = AIRPORTS.map(() => {
      const el = document.createElement('div')
      el.style.display = 'none'
      layer.appendChild(el)
      return el
    })
    appliedClass.current = AIRPORTS.map(() => '')
    appliedText.current = AIRPORTS.map(() => '')
    parent.appendChild(layer)
    return () => {
      parent.removeChild(layer)
      elements.current = []
    }
  }, [gl])

  useFrame(() => {
    const { airline, unlockedAirports, aircraft } = useGameStore.getState()
    const ui = useUiStore.getState()
    const unlocked = new Set(unlockedAirports)
    const selectedIata = selectedAirportIata(ui.selection, aircraft) ?? ui.draftHq ?? undefined
    const parked = parkedCounts(aircraft)
    const inbound = incomingCounts(aircraft)
    const zoom = (camera as THREE.OrthographicCamera).zoom
    const zoomRatio = zoom / fitZoom
    const halfW = size.width / (2 * zoom)
    const halfH = size.height / (2 * zoom)

    const candidates: Candidate[] = []
    for (let i = 0; i < AIRPORTS.length; i++) {
      const el = elements.current[i]
      if (!el) continue
      const a = AIRPORTS[i]
      const state = markerState(a.iata, airline?.hq, unlocked)
      const selected = a.iata === selectedIata
      const important = selected || state !== 'locked'
      if (!important && zoomRatio < LABEL_ZOOM[a.classification]) {
        if (el.style.display !== 'none') el.style.display = 'none'
        continue
      }
      const wx = nearestX(POSITIONS[i].x, camera.position.x)
      const wy = POSITIONS[i].y
      if (Math.abs(wx - camera.position.x) > halfW + 0.2 || Math.abs(wy - camera.position.y) > halfH + 0.1) {
        if (el.style.display !== 'none') el.style.display = 'none'
        continue
      }
      candidates.push({
        i,
        el,
        text: labelText(a.iata, parked.get(a.iata) ?? 0, inbound.get(a.iata) ?? 0),
        state,
        selected,
        x: (wx - camera.position.x) * zoom + size.width / 2,
        y: -(wy - camera.position.y) * zoom + size.height / 2,
        rank: labelRank(state, selected, a.classification),
      })
    }

    candidates.sort((p, q) => p.rank - q.rank)
    const placed: Rect[] = []
    for (const c of candidates) {
      const w = c.text.length * 7.2 + 14
      const rect: Rect = [c.x - w / 2, c.y - 30, c.x + w / 2, c.y - 10]
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
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) translate(-50%, -160%)`
      c.el.style.zIndex = c.selected ? '3' : c.state === 'locked' ? '1' : '2'
    }
  })

  return null
})

export { MAP_W }
