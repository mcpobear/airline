import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { BALANCE } from '../config/balance'
import { useUiStore } from '../state/uiStore'
import { useGameStore } from '../state/gameStore'
import { getAirport } from '../data/airports'
import { AirportMarkers } from './AirportMarkers'
import { FlightLayer } from './FlightLayer'
import { aircraftPosition } from '../sim/aircraft'
import { buildGlobeGeometry } from './buildGlobeGeometry'
import { globeStyle, type GlobeStyle } from '../world/palettes'
import { cachedWorldPixels, preferredTextureSize, worldPixelsAsync } from '../world/worldTexture'
import { latLonToVector3, subSolarPoint, vectorToLatLon } from './coords'

const G = BALANCE.globe

function defaultCameraPosition() {
  return latLonToVector3(G.defaultView.lat, G.defaultView.lon, G.defaultDistance)
}

interface PaintedWorld {
  pixels: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}

/** The first, rough pass: small enough to paint in well under a second. */
const QUICK = { width: 1024, height: 512 }

/** The sharpest version of a style already painted this session, if any. */
function bestCached(styleId: string): PaintedWorld | null {
  const full = preferredTextureSize()
  for (const size of [full, QUICK]) {
    const pixels = cachedWorldPixels(styleId, size.width, size.height)
    if (pixels) return { pixels, width: size.width, height: size.height }
  }
  return null
}

const WHITE = new THREE.Color(1, 1, 1)

/** A style's deep-ocean colour, as a Three.js colour. */
function seaColour(style: GlobeStyle): THREE.Color {
  const [r, g, b] = style.palette.seaDeep
  return new THREE.Color(r / 255, g / 255, b / 255).convertSRGBToLinear()
}

/** The planet itself: either faceted low-poly geometry or a smooth painted sphere. */
const Earth = memo(function Earth({ style }: { style: GlobeStyle }) {
  const setSelection = useUiStore((s) => s.setSelection)
  const geometry = useMemo(
    () => (style.faceted ? buildGlobeGeometry(G.detail) : new THREE.SphereGeometry(1, 96, 64)),
    [style.faceted],
  )
  // Painting the world happens in a worker: at full size it is eight million
  // pixels and several seconds, which would hold up the first frame. A small
  // pass goes first so there is a globe to look at straight away, then the
  // full one replaces it a few seconds later. Anything painted earlier in the
  // session is already in hand and goes up on the first render.
  const [map, setMap] = useState<PaintedWorld | null>(() =>
    style.faceted ? null : bestCached(style.id),
  )
  useEffect(() => {
    if (style.faceted) return
    let live = true
    const full = preferredTextureSize()
    setMap(bestCached(style.id))

    const show = (width: number, height: number) => (pixels: Uint8ClampedArray<ArrayBuffer>) => {
      // The quick pass may land after the full one; never go backwards.
      if (live) setMap((current) => (current && current.width >= width ? current : { pixels, width, height }))
    }
    if (!cachedWorldPixels(style.id, full.width, full.height)) {
      void worldPixelsAsync(style.id, QUICK.width, QUICK.height).then(show(QUICK.width, QUICK.height))
    }
    void worldPixelsAsync(style.id, full.width, full.height).then(show(full.width, full.height))
    return () => {
      live = false
    }
  }, [style.faceted, style.id])

  const texture = useMemo(() => {
    if (style.faceted || !map) return null
    const canvas = document.createElement('canvas')
    canvas.width = map.width
    canvas.height = map.height
    canvas.getContext('2d')!.putImageData(new ImageData(map.pixels, map.width, map.height), 0, 0)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    // SphereGeometry starts its UVs on the -X axis, a quarter turn from the
    // texture's left edge at longitude -180, so the map is shifted to match.
    t.wrapS = THREE.RepeatWrapping
    t.offset.x = 0.25
    return t
  }, [style.faceted, map])

  useEffect(() => () => texture?.dispose(), [texture])
  useEffect(() => () => geometry.dispose(), [geometry])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return // the pointer moved: it was a drag, not a click
    e.stopPropagation()
    const { lat, lon } = vectorToLatLon(e.point)
    setSelection({ kind: 'point', lat, lon })
  }

  return (
    <mesh geometry={geometry} onClick={onClick}>
      {style.faceted ? (
        <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0} />
      ) : (
        // Until the map has been painted this is an ocean-coloured ball, so
        // the globe turns up with the rest of the scene rather than after it.
        // The key matters: without it the renderer keeps one material across
        // the swap, which leaves the placeholder's tint multiplying the
        // finished map and never recompiles the shader to sample it at all.
        <meshStandardMaterial
          key={texture ? 'painted' : 'plain'}
          map={texture}
          color={texture ? WHITE : seaColour(style)}
          roughness={0.95}
          metalness={0}
        />
      )}
    </mesh>
  )
})

/** Soft rim glow around the planet. */
const Atmosphere = memo(function Atmosphere({ colour, strength }: { colour: readonly [number, number, number]; strength: number }) {
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
        uniforms: {
          uColour: { value: new THREE.Vector3(colour[0], colour[1], colour[2]) },
          uStrength: { value: strength },
        },
        fragmentShader: /* glsl */ `
          uniform vec3 uColour;
          uniform float uStrength;
          varying vec3 vNormal;
          void main() {
            float i = pow(max(0.0, 0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
            gl_FragColor = vec4(uColour, i * uStrength);
          }`,
      }),
    [colour, strength],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh scale={1.14}>
      <sphereGeometry args={[1, 48, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
})

/** Real-time sun: the day/night terminator follows the actual UTC time. */
function Sun({ style }: { style: GlobeStyle }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const { camera } = useThree()
  useFrame(() => {
    if (!light.current) return
    if (style.lighting.follow) {
      // Slightly off the camera axis, so there is still some shading to see.
      dir.copy(camera.position).normalize().multiplyScalar(6)
      dir.x += 1.4
      dir.y += 2.2
      light.current.position.copy(dir)
      return
    }
    const p = subSolarPoint(new Date())
    latLonToVector3(p.lat, p.lon, 6, dir)
    light.current.position.copy(dir)
  })
  return (
    <>
      <directionalLight ref={light} intensity={style.lighting.sun} color={style.lighting.sunColour} />
      <hemisphereLight args={[style.lighting.skyColour, style.lighting.groundColour, style.lighting.ambient]} />
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
      <meshBasicMaterial color="#e0581e" />
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
  const style = globeStyle(useUiStore((s) => s.globeStyle))
  return (
    <Canvas
      className="!absolute inset-0"
      camera={{ position: start, fov: 40, near: 0.05, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[style.lighting.background]} />
      {style.lighting.stars && (
        <Stars radius={60} depth={40} count={3000} factor={3.2} saturation={0} fade speed={0.3} />
      )}
      <Sun style={style} />
      <Earth style={style} />
      {style.lighting.atmosphere && (
        <Atmosphere colour={style.lighting.atmosphere.colour} strength={style.lighting.atmosphere.strength} />
      )}
      <SelectionMarker />
      <AirportMarkers />
      <FlightLayer />
      <CameraRig />
    </Canvas>
  )
}
