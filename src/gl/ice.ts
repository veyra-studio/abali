/**
 * Ice from a freezer tray: tapered cubes with melted, uneven faces, a dimple
 * on top, a cloudy core of trapped air and a crack or two — clear, wet
 * glass-like surfaces that refract the bottle and the cloudy core behind.
 * Units: bottle units (bottle height = 1).
 */
import * as THREE from 'three'
import { createNoise, seededRandom } from '@veyra/core'

export interface Ice {
  group: THREE.Group
  material: THREE.MeshPhysicalMaterial
  setScale(px: number): void
  dispose(): void
}

function cubeGeometry(size: number, rand: () => number, seed: number): THREE.BufferGeometry {
  const { noise3 } = createNoise(seed)
  // A superellipsoid: a cube whose edges have melted round.
  const geo = new THREE.SphereGeometry(1, 64, 48)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const half = new THREE.Vector3(size / 2, (size / 2) * (0.82 + rand() * 0.14), (size / 2) * (0.9 + rand() * 0.12))
  const n = 3.2 + rand() * 1.2
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = (Math.abs(v.x) ** n + Math.abs(v.y) ** n + Math.abs(v.z) ** n) ** (-1 / n)
    v.multiplyScalar(r)
    // Tray taper, narrower at the bottom; a shallow dimple where it froze last.
    const taper = 1 - (0.5 - v.y * 0.5) * 0.1
    v.x *= half.x * taper
    v.z *= half.z * taper
    v.y *= half.y
    if (v.y > half.y * 0.8) v.y -= Math.exp(-((v.x * v.x + v.z * v.z) / (size * size * 0.05))) * size * 0.05
    // Melt: soft unevenness all over.
    const d = v.clone().normalize()
    v.addScaledVector(d, noise3(v.x * 3 / size, v.y * 3 / size, v.z * 3 / size) * size * 0.045 + noise3(v.x * 9 / size + 4, v.y * 9 / size, v.z * 9 / size) * size * 0.006)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

function coreGeometry(size: number, seed: number): THREE.BufferGeometry {
  const { noise3 } = createNoise(seed)
  const geo = new THREE.IcosahedronGeometry(size * 0.13, 3)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const d = v.clone().normalize()
    // Feathery: streaks of trapped air reach toward the faces.
    const n = noise3(d.x * 3, d.y * 3, d.z * 3)
    v.multiplyScalar(0.7 + Math.max(0, n) * 1.4)
    v.y *= 0.7
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

/** Scatters `count` cubes around the bottle's foot. */
export function createIce(options: { quality: 'low' | 'medium' | 'high'; count?: number }): Ice {
  const group = new THREE.Group()
  const rand = seededRandom(11)
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.02,
    transmission: 1,
    thickness: 0.2,
    ior: 1.31,
    attenuationColor: new THREE.Color('#e2eefa'),
    attenuationDistance: 120,
    specularIntensity: 0.85,
    envMapIntensity: 0.75,
  })
  // Trapped air: a white, feathery cloud in the middle.
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: '#eef3f8',
    roughness: 0.9,
    metalness: 0,
    emissive: new THREE.Color('#5b6772'),
    envMapIntensity: 0.6,
  })
  const crackMaterial = new THREE.MeshStandardMaterial({
    color: '#dfe8f0',
    roughness: 0.25,
    metalness: 0,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  })
  const count = options.count ?? (options.quality === 'low' ? 4 : 6)
  // Placement around the foot, mostly in front and to the sides (the camera's view).
  // Tray ice is about 3 cm across: roughly 0.14 of the bottle's height.
  const spots: Array<[angle: number, dist: number, size: number]> = [
    [-0.95, 0.27, 0.145],
    [0.85, 0.28, 0.135],
    [0.05, 0.33, 0.105],
    [-2.0, 0.3, 0.125],
    [1.95, 0.29, 0.12],
    [0.45, 0.46, 0.075],
    [-0.5, 0.48, 0.07],
  ]
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    const [angle, dist, size] = spots[i]!
    const cube = new THREE.Group()
    const outer = new THREE.Mesh(cubeGeometry(size, rand, 100 + i), material)
    outer.renderOrder = 3
    cube.add(outer)
    if (options.quality !== 'low') {
      const core = new THREE.Mesh(coreGeometry(size, 200 + i), coreMaterial)
      core.position.set((rand() - 0.5) * size * 0.1, -size * 0.02, (rand() - 0.5) * size * 0.1)
      cube.add(core)
      if (rand() < 0.7) {
        const crack = new THREE.Mesh(new THREE.CircleGeometry(size * (0.22 + rand() * 0.12), 7), crackMaterial)
        crack.rotation.set(rand() * Math.PI, rand() * Math.PI, 0)
        crack.position.set((rand() - 0.5) * size * 0.2, (rand() - 0.5) * size * 0.15, (rand() - 0.5) * size * 0.2)
        cube.add(crack)
      }
    }
    const h = size * 0.42
    cube.position.set(Math.sin(angle) * dist, h, Math.cos(angle) * dist)
    cube.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.3)
    group.add(cube)
  }
  return {
    group,
    material,
    setScale(px) {
      material.attenuationDistance = px * 0.6
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose()
      })
      material.dispose()
      coreMaterial.dispose()
      crackMaterial.dispose()
    },
  }
}
