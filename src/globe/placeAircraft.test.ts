import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { placeAircraft } from './FlightLayer'
import { flightPosition } from '../sim/flightProfile'
import { latLonToVector3 } from './coords'
import { GROUND_RADIUS } from './route'
import type { Flight } from '../types/game'

const flight: Flight = { from: 'SIN', to: 'NRT', departedAt: 0, arrivesAt: 600_000, distanceKm: 5300 }

function pose(now: number) {
  const m = new THREE.Matrix4()
  placeAircraft(flight, now, m, 1)
  const pos = new THREE.Vector3()
  const q = new THREE.Quaternion()
  m.decompose(pos, q, new THREE.Vector3())
  const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
  const upv = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
  return { pos, nose, upv }
}

describe('aircraft pose on the globe', () => {
  it('sits on the ground at both ends and above it at cruise', () => {
    expect(pose(0).pos.length()).toBeCloseTo(GROUND_RADIUS, 3)
    expect(pose(600_000).pos.length()).toBeCloseTo(GROUND_RADIUS, 3)
    expect(pose(300_000).pos.length()).toBeGreaterThan(GROUND_RADIUS + 0.03)
  })

  it('points its nose along the direction of travel with its roof away from the planet', () => {
    for (const t of [20_000, 150_000, 300_000, 450_000, 580_000]) {
      const { pos, nose, upv } = pose(t)
      const a = flightPosition(flight, t)
      const b = flightPosition(flight, t + 1000)
      const motion = latLonToVector3(b.lat, b.lon, 1).sub(latLonToVector3(a.lat, a.lon, 1))
      expect(nose.dot(motion)).toBeGreaterThan(0)
      expect(upv.dot(pos.clone().normalize())).toBeGreaterThan(0.9)
      expect(nose.length()).toBeCloseTo(1, 5)
    }
  })
})
