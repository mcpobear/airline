import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { BALANCE } from '../config/balance'
import { useUiStore } from '../state/uiStore'
import { useGameStore } from '../state/gameStore'
import { getAirport } from '../data/airports'
import { AirportMarkers } from './AirportMarkers'
import { FlightLayer } from './FlightLayer'
import { aircraftPosition } from '../sim/aircraft'
import { buildGlobeGeometry } from './buildGlobeGeometry'
import { latLonToVector3, subSolarPoint, vectorToLatLon } from './coords'

const G = BALANCE.globe

function defaultCameraPosition() {
  return latLonToVector3(G.defaultView.lat, G.defaultView.lon, G.defaultDistance)
}

/** Stylised low-poly Earth. Geometry is built once and shared. */
const Earth = memo(function Earth() {
  const geometry = useMemo(() => buildGlobeGeometry(G.detail), [])
  const setSelection = useUiStore((s) => s.setSelection)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return // the pointer moved: it was a drag, not a click
    e.stopPropagation()
    const { lat, lon } = vectorToLatLon(e.point)
    setSelection({ kind: 'point', lat, lon })
  }

  return (
    <mesh geometry={geometry} onClick={onClick}>
      <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0} />
    </mesh>
  )
})

/** Soft rim glow around the planet. */
const Atmosphere = memo(function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          void main() {
            float i = pow(max(0.0, 0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
            gl_FragColor = vec4(0.42, 0.56, 0.58, i * 0.5);
          }`,
      }),
    [],
  )
  return (
    <mesh scale={1.14}>
      <sphereGeometry args={[1, 48, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
})

/** Real-time sun: the day/night terminator follows the actual UTC time. */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null)
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!light.current) return
    const p = subSolarPoint(new Date())
    latLonToVector3(p.lat, p.lon, 6, dir)
    light.current.position.copy(dir)
  })
  return (
    <>
      <directionalLight ref={light} intensity={G.sunIntensity} color="#fff3dc" />
      <hemisphereLight args={['#fff6e6', '#9db6a8', G.ambient]} />
    </>
  )
}

/** Marker for the point the player last clicked. */
function SelectionMarker() {
  const selection = useUiStore((s) => s.selection)
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + 0.25 * Math.sin(clock.elapsedTime * 4))
  })
  if (!selection || selection.kind !== 'point') return null
  const p = latLonToVector3(selection.lat, selection.lon, 1.035)
  return (
    <mesh ref={ref} position={p}>
      <sphereGeometry args={[0.011, 16, 16]} />
      <meshBasicMaterial color="#c2491c" />
    </mesh>
  )
}

/**
 * Smooth camera animation (reset / zoom buttons) layered on OrbitControls.
 * Any manual interaction cancels the animation, so the player always keeps control.
 */
function CameraRig() {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const { camera } = useThree()
  const command = useUiStore((s) => s.cameraCommand)
  const autoRotate = useUiStore((s) => s.autoRotate)
  const setAutoRotate = useUiStore((s) => s.setAutoRotate)
  const target = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (command.id === 0) return
    const hq = getAirport(useGameStore.getState().airline?.hq ?? '')
    if (command.kind === 'reset') {
      target.current = defaultCameraPosition()
    } else if (command.kind === 'hq') {
      target.current = hq
        ? latLonToVector3(hq.lat, hq.lon, Math.min(camera.position.length(), G.focusDistance + 0.4))
        : defaultCameraPosition()
    } else if (command.kind === 'focus' && command.lat !== undefined && command.lon !== undefined) {
      const len = Math.min(camera.position.length(), G.focusDistance)
      target.current = latLonToVector3(command.lat, command.lon, len)
    } else {
      const factor = command.kind === 'zoomIn' ? 0.78 : 1.28
      const len = THREE.MathUtils.clamp(camera.position.length() * factor, G.minDistance, G.maxDistance)
      target.current = camera.position.clone().setLength(len)
    }
  }, [command, camera])

  const dir = useMemo(() => new THREE.Vector3(), [])
  const tdir = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const part = useMemo(() => new THREE.Quaternion(), [])
  const identity = useMemo(() => new THREE.Quaternion(), [])

  useFrame((_, delta) => {
    const c = controls.current
    if (c) c.rotateSpeed = THREE.MathUtils.clamp((camera.position.length() - 1) * 0.35, 0.08, 0.9)

    // Follow mode: keep the followed aircraft centred, ending when it lands or the player takes over.
    const ui = useUiStore.getState()
    if (ui.followAircraftId) {
      const a = useGameStore.getState().aircraft.find((x) => x.id === ui.followAircraftId)
      const pos = a?.flight ? aircraftPosition(a, Date.now()) : null
      if (!pos) ui.setFollowAircraft(null)
      else {
        tdir.copy(latLonToVector3(pos.lat, pos.lon, 1))
        dir.copy(camera.position).normalize()
        q.setFromUnitVectors(dir, tdir)
        part.copy(identity).slerp(q, 1 - Math.pow(0.02, Math.min(delta, 0.1)))
        camera.position.applyQuaternion(part)
        target.current = null
        return
      }
    }

    const t = target.current
    if (!t) return
    const k = 1 - Math.pow(0.0015, Math.min(delta, 0.1))
    dir.copy(camera.position).normalize()
    tdir.copy(t).normalize()
    const angle = dir.angleTo(tdir)
    const len = camera.position.length()
    const tlen = t.length()
    if (angle < 0.002 && Math.abs(len - tlen) < 0.002) {
      camera.position.copy(t)
      target.current = null
      return
    }
    // Rotate along the sphere (never cutting through the planet), ease the distance.
    q.setFromUnitVectors(dir, tdir)
    part.copy(identity).slerp(q, k)
    dir.applyQuaternion(part)
    camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(len, tlen, k)))
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={G.minDistance}
      maxDistance={G.maxDistance}
      zoomSpeed={0.8}
      autoRotate={autoRotate}
      autoRotateSpeed={G.autoRotateSpeed}
      onStart={() => {
        target.current = null
        useUiStore.getState().setFollowAircraft(null)
        if (autoRotate) setAutoRotate(false)
      }}
    />
  )
}

export function GlobeCanvas() {
  const start = useMemo(() => defaultCameraPosition().toArray() as [number, number, number], [])
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: start, fov: 40, near: 0.05, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#e9dfd0']} />
      <Sun />
      <Earth />
      <Atmosphere />
      <SelectionMarker />
      <AirportMarkers />
      <FlightLayer />
      <CameraRig />
    </Canvas>
  )
}
