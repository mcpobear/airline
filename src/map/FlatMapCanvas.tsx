import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BALANCE } from '../config/balance'
import { getAirport } from '../data/airports'
import { aircraftPosition } from '../sim/aircraft'
import { useGameStore } from '../state/gameStore'
import { useUiStore } from '../state/uiStore'
import { FlatFlightLayer } from './FlatFlightLayer'
import { FlatMarkers } from './FlatMarkers'
import { buildMapPixels, TEXTURE_HEIGHT, TEXTURE_WIDTH } from './landTexture'
import { MAP_H, MAP_W, nearestX, project, unproject, wrapX } from './projection'

/** How far in you can zoom, as a multiple of the zoom that fits the whole world. */
const MAX_ZOOM_RATIO = 42
const GRATICULE_SPACING = 30

/** The world map as a single repeating texture: three copies wide, so panning never runs out of map. */
const MapSurface = memo(function MapSurface() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_WIDTH
    canvas.height = TEXTURE_HEIGHT
    canvas.getContext('2d')!.putImageData(new ImageData(buildMapPixels(), TEXTURE_WIDTH, TEXTURE_HEIGHT), 0, 0)
    const t = new THREE.CanvasTexture(canvas)
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(3, 1)
    // The plane spans three worlds centred on the middle one, so its left edge
    // (x = -MAP_W * 1.5) must land on the left edge of the texture.
    t.offset.set(0, 0)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  const setSelection = useUiStore((s) => s.setSelection)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return
    e.stopPropagation()
    const { lat, lon } = unproject(wrapX(e.point.x), e.point.y)
    setSelection({ kind: 'point', lat, lon })
  }

  return (
    <mesh onClick={onClick}>
      <planeGeometry args={[MAP_W * 3, MAP_H]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
})

/** Meridians and parallels every 30 degrees, drawn across all three copies. */
const Graticule = memo(function Graticule() {
  const geometry = useMemo(() => {
    const pts: number[] = []
    for (let lon = -180; lon <= 180; lon += GRATICULE_SPACING) {
      for (const copy of [-1, 0, 1]) {
        const x = project(0, lon).x + copy * MAP_W
        pts.push(x, -MAP_H / 2, 0.005, x, MAP_H / 2, 0.005)
      }
    }
    for (let lat = -60; lat <= 60; lat += GRATICULE_SPACING) {
      const y = project(lat, 0).y
      pts.push(-MAP_W * 1.5, y, 0.005, MAP_W * 1.5, y, 0.005)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#f2eadf" transparent opacity={0.13} />
    </lineSegments>
  )
})

interface ViewLimits {
  fitZoom: number
  minZoom: number
  maxZoom: number
}

function useViewLimits(): ViewLimits {
  const size = useThree((s) => s.size)
  return useMemo(() => {
    const fitZoom = Math.min(size.width / MAP_W, size.height / MAP_H)
    return { fitZoom, minZoom: fitZoom, maxZoom: fitZoom * MAX_ZOOM_RATIO }
  }, [size.width, size.height])
}

/** Keeps the camera inside the map vertically; horizontally it wraps instead. */
function constrain(camera: THREE.OrthographicCamera, width: number, height: number) {
  camera.position.x = wrapX(camera.position.x)
  const halfH = height / (2 * camera.zoom)
  const slack = MAP_H / 2 - halfH
  camera.position.y = slack <= 0 ? 0 : THREE.MathUtils.clamp(camera.position.y, -slack, slack)
  void width
  camera.updateProjectionMatrix()
}

/**
 * Pan and zoom for the flat map.
 *
 * Dragging moves the camera and wheeling zooms towards the pointer. The camera
 * is wrapped back into a single world width after every change, so you can
 * keep dragging west or east forever and the Pacific is crossable both ways.
 */
function MapControls({ limits }: { limits: ViewLimits }) {
  const { camera, gl, size } = useThree()
  const ortho = camera as THREE.OrthographicCamera

  useEffect(() => {
    ortho.zoom = THREE.MathUtils.clamp(ortho.zoom, limits.minZoom, limits.maxZoom)
    constrain(ortho, size.width, size.height)
  }, [limits, ortho, size.width, size.height])

  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0
    let pointerId: number | null = null

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (dx || dy) useUiStore.getState().setFollowAircraft(null)
      lastX = e.clientX
      lastY = e.clientY
      ortho.position.x -= dx / ortho.zoom
      ortho.position.y += dy / ortho.zoom
      constrain(ortho, size.width, size.height)
      el.style.cursor = 'grabbing'
    }
    const endDrag = () => {
      dragging = false
      pointerId = null
      el.style.cursor = ''
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      useUiStore.getState().setFollowAircraft(null)
      const rect = el.getBoundingClientRect()
      // World point under the pointer, kept fixed while the zoom changes.
      const px = e.clientX - rect.left - rect.width / 2
      const py = e.clientY - rect.top - rect.height / 2
      const before = { x: ortho.position.x + px / ortho.zoom, y: ortho.position.y - py / ortho.zoom }
      const factor = Math.exp(-e.deltaY * 0.0015)
      ortho.zoom = THREE.MathUtils.clamp(ortho.zoom * factor, limits.minZoom, limits.maxZoom)
      ortho.position.x = before.x - px / ortho.zoom
      ortho.position.y = before.y + py / ortho.zoom
      constrain(ortho, size.width, size.height)
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, ortho, limits, size.width, size.height])

  return null
}

/**
 * Eased camera moves for the zoom and focus buttons, and follow mode for a
 * flying aircraft. Any drag or wheel cancels follow, so the player keeps control.
 */
function FlatCameraRig({ limits }: { limits: ViewLimits }) {
  const { camera, size } = useThree()
  const ortho = camera as THREE.OrthographicCamera
  const command = useUiStore((s) => s.cameraCommand)
  const target = useRef<{ x: number; y: number; zoom: number } | null>(null)

  useEffect(() => {
    if (command.id === 0) return
    const focusZoom = Math.max(ortho.zoom, limits.fitZoom * 6)
    if (command.kind === 'reset') {
      target.current = { x: 0, y: 0, zoom: limits.minZoom }
    } else if (command.kind === 'hq') {
      const hq = getAirport(useGameStore.getState().airline?.hq ?? '')
      const p = hq ? project(hq.lat, hq.lon) : { x: 0, y: 0 }
      target.current = { x: p.x, y: p.y, zoom: focusZoom }
    } else if (command.kind === 'focus' && command.lat !== undefined && command.lon !== undefined) {
      const p = project(command.lat, command.lon)
      target.current = { x: p.x, y: p.y, zoom: focusZoom }
    } else {
      const factor = command.kind === 'zoomIn' ? 1.45 : 1 / 1.45
      target.current = {
        x: ortho.position.x,
        y: ortho.position.y,
        zoom: THREE.MathUtils.clamp(ortho.zoom * factor, limits.minZoom, limits.maxZoom),
      }
    }
    // Approach the nearest copy of the target, never the long way round the map.
    if (target.current) target.current.x = nearestX(target.current.x, ortho.position.x)
  }, [command, ortho, limits])

  useFrame((_, delta) => {
    const followId = useUiStore.getState().followAircraftId
    if (followId) {
      const a = useGameStore.getState().aircraft.find((x) => x.id === followId)
      const pos = a?.flight ? aircraftPosition(a, Date.now()) : null
      if (!pos) useUiStore.getState().setFollowAircraft(null)
      else {
        const p = project(pos.lat, pos.lon)
        target.current = {
          x: nearestX(p.x, ortho.position.x),
          y: p.y,
          zoom: Math.max(ortho.zoom, limits.fitZoom * 3),
        }
      }
    }

    const t = target.current
    if (!t) return
    const k = 1 - Math.pow(0.0025, Math.min(delta, 0.1))
    ortho.position.x += (t.x - ortho.position.x) * k
    ortho.position.y += (t.y - ortho.position.y) * k
    ortho.zoom += (t.zoom - ortho.zoom) * k
    if (!followId && Math.abs(t.x - ortho.position.x) < 0.001 && Math.abs(t.zoom - ortho.zoom) < 0.5) {
      ortho.position.x = t.x
      ortho.position.y = t.y
      ortho.zoom = t.zoom
      target.current = null
    }
    constrain(ortho, size.width, size.height)
  })

  return null
}

function Scene() {
  const limits = useViewLimits()
  const { camera, size } = useThree()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const ortho = camera as THREE.OrthographicCamera
    const hq = getAirport(useGameStore.getState().airline?.hq ?? '')
    const p = hq ? project(hq.lat, hq.lon) : project(BALANCE.globe.defaultView.lat, BALANCE.globe.defaultView.lon)
    ortho.zoom = hq ? limits.fitZoom * 3 : limits.fitZoom
    ortho.position.set(p.x, p.y, 10)
    constrain(ortho, size.width, size.height)
  }, [camera, limits, size.width, size.height])

  return (
    <>
      <ambientLight intensity={1.9} />
      <directionalLight position={[-2, 3, 6]} intensity={1.5} color="#fff4e2" />
      <MapSurface />
      <Graticule />
      <FlatMarkers fitZoom={limits.fitZoom} />
      <FlatFlightLayer />
      <MapControls limits={limits} />
      <FlatCameraRig limits={limits} />
    </>
  )
}

/** The flat world map: an equirectangular projection that repeats east to west. */
export function FlatMapCanvas() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <Canvas
      className="!absolute inset-0"
      orthographic
      camera={{ position: [0, 0, 10], zoom: 300, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      style={{ cursor: 'grab' }}
    >
      <color attach="background" args={['#e9dfd0']} />
      {ready && <Scene />}
    </Canvas>
  )
}
