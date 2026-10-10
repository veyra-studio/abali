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
  // Faces nearly flat, edges and corners melted round.
  const n = 5.5 + rand() * 2
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
    const d = v.clone().normalize()
    // Melt: faces gently uneven, so reflections bend without breaking up.
    v.addScaledVector(d, noise3(v.x * 2.2 / size, v.y * 2.2 / size, v.z * 2.2 / size) * size * 0.018 + noise3(v.x * 7 / size + 4, v.y * 7 / size, v.z * 7 / size) * size * 0.0025)
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
    // A little frosty from the freezer: reflections soften slightly.
    roughness: 0.07,
    transmission: 1,
    // About the cube's own size: refraction bends what's behind, not a magnifier.
    thickness: 0.09,
    ior: 1.31,
    attenuationColor: new THREE.Color('#dbe9f5'),
    attenuationDistance: 120,
    specularIntensity: 1,
    envMapIntensity: 1.15,
    // The misty heart inside is drawn after the ice: let it show through.
    depthWrite: false,
    // A faint rainbow at the edges, as thick clear ice splits the light.
    dispersion: 0.25,
    // Fresh from the freezer: a thin frost that whitens the faces at a glance.
    sheen: 0.35,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#dfe9f2'),
  })
  // Trapped air: a white, feathery cloud in the middle.
  // The cloudy heart of freezer ice: air and impurities pushed to the
  // middle as it froze from the outside in — a soft white mist, densest at
  // the center, with a few streaks.
  const mist = document.createElement('canvas')
  mist.width = mist.height = 128
  {
    const ctx = mist.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
    g.addColorStop(0.35, 'rgba(244, 249, 255, 0.5)')
    g.addColorStop(0.7, 'rgba(232, 242, 252, 0.14)')
    g.addColorStop(1, 'rgba(232, 242, 252, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2
      const r0 = 6 + rand() * 10
      const r1 = 26 + rand() * 24
      ctx.beginPath()
      ctx.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0)
      ctx.lineTo(64 + Math.cos(a + 0.2) * r1, 64 + Math.sin(a + 0.2) * r1)
      ctx.stroke()
    }
  }
  const mistTexture = new THREE.CanvasTexture(mist)
  const coreMaterial = new THREE.SpriteMaterial({ map: mistTexture, transparent: true, depthWrite: false, opacity: 0.9 })
  // A fracture plane: a pale sheet that catches the light.
  const crackMaterial = new THREE.MeshStandardMaterial({
    color: '#f2f7fb',
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
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
      const core = new THREE.Sprite(coreMaterial)
      core.scale.set(size * (0.62 + rand() * 0.18), size * (0.48 + rand() * 0.12), 1)
      core.position.set((rand() - 0.5) * size * 0.1, -size * 0.02, (rand() - 0.5) * size * 0.1)
      core.renderOrder = 4
      cube.add(core)
      if (rand() < 0.4) {
        const crack = new THREE.Mesh(new THREE.CircleGeometry(size * (0.14 + rand() * 0.08), 7), crackMaterial)
        crack.renderOrder = 4
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
      mistTexture.dispose()
      crackMaterial.dispose()
    },
  }
}
