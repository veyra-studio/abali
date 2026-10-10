/**
 * Foam that climbs out of a shaken bottle: fine white bubbles fill the
 * neck, crown the mouth, then spill over the lip and run down the glass.
 * `level` 0…1 drives it (0 = still, 1 = overflowing). Units: bottle units.
 */
import * as THREE from 'three'
import { seededRandom } from '@veyra/core'
import { BOTTLE } from './bottle'

export interface Foam {
  mesh: THREE.InstancedMesh
  /** Sets the foam level `0…1` and updates the bubbles. */
  setLevel(level: number, time: number): void
  dispose(): void
}

interface Bubble {
  /** Level at which the bubble appears. */
  at: number
  pos: THREE.Vector3
  r: number
  wobble: number
}

export function createFoam(options: { quality: 'low' | 'medium' | 'high'; outerRadiusAt: (h: number) => number }): Foam {
  const count = options.quality === 'low' ? 160 : options.quality === 'medium' ? 280 : 440
  const rand = seededRandom(17)
  const bubbles: Bubble[] = []
  const bore = 0.038
  for (let i = 0; i < count; i++) {
    const k = rand() ** 2
    const r = 0.0045 + k * 0.011
    const a = rand() * Math.PI * 2
    let pos: THREE.Vector3
    let at: number
    const phase = rand()
    if (phase < 0.38) {
      // Rising inside the neck, from the doogh's surface to the mouth.
      const h = BOTTLE.fill + rand() * (BOTTLE.rim - BOTTLE.fill)
      const d = Math.sqrt(rand()) * (bore - r)
      pos = new THREE.Vector3(Math.sin(a) * d, h, Math.cos(a) * d)
      at = ((h - BOTTLE.fill) / (BOTTLE.rim - BOTTLE.fill)) * 0.45
    } else if (phase < 0.7) {
      // The crown over the mouth.
      const u = rand()
      const d = Math.sqrt(rand()) * 0.072 * (1 - u * 0.6)
      pos = new THREE.Vector3(Math.sin(a) * d, BOTTLE.rim + u * 0.07 * (1 - (d / 0.072) ** 2) + r * 0.5, Math.cos(a) * d)
      at = 0.42 + u * 0.25
    } else {
      // Spilling down the outside, mostly toward the camera.
      const face = (rand() - 0.5) * Math.PI * 1.4
      const h = BOTTLE.rim - 0.01 - rand() ** 1.6 * 0.24
      const R = options.outerRadiusAt(Math.min(h, 0.985)) + r * 0.6
      pos = new THREE.Vector3(Math.sin(face) * R, h, Math.cos(face) * R)
      at = 0.65 + ((BOTTLE.rim - h) / 0.24) * 0.33
    }
    bubbles.push({ at, pos, r, wobble: rand() * Math.PI * 2 })
  }

  const geometry = new THREE.IcosahedronGeometry(1, options.quality === 'low' ? 1 : 2)
  const material = new THREE.MeshPhysicalMaterial({
    color: '#f7f8f4',
    roughness: 0.18,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    emissive: new THREE.Color('#3a3c3a'),
    envMapIntensity: 1.1,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  let last = -1

  const setLevel = (level: number, time: number) => {
    mesh.visible = level > 0.001
    if (!mesh.visible || (level === last && level >= 1)) return
    last = level
    for (let i = 0; i < count; i++) {
      const b = bubbles[i]!
      const grow = THREE.MathUtils.smoothstep(level, b.at, b.at + 0.06)
      const size = b.r * grow * (1 + Math.sin(time * 3 + b.wobble) * 0.06)
      p.copy(b.pos)
      // Spilled bubbles keep creeping down a little.
      if (b.at > 0.65) p.y -= Math.max(0, level - b.at) * 0.08
      s.setScalar(Math.max(1e-5, size))
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  setLevel(0, 0)

  return {
    mesh,
    setLevel,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
