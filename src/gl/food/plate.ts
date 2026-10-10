/**
 * A glazed porcelain plate with a cobalt line on the rim — the plate
 * chelow kabab comes on. Units: centimetres; the foot stands on y = 0.
 */
import * as THREE from 'three'

/** Outline from the center of the foot, around the edge, back to the center of the well. */
const PROFILE: Array<[number, number]> = [
  [0, 0.42],
  [8.4, 0.42],
  [8.9, 0.02],
  [9.5, 0.0],
  [9.9, 0.38],
  [14.5, 1.2],
  [15.05, 1.55],
  [15.05, 1.78],
  [14.6, 1.92],
  [12.6, 1.74],
  [11.0, 1.08],
  [9.7, 0.82],
  [6, 0.74],
  [0, 0.72],
]
/** Index range of the rim's top face (for the cobalt line). */
const RIM = [7, 9] as const

export interface Plate {
  mesh: THREE.Mesh
  /** Height of the well's surface. */
  well: number
  radius: number
  /** Height of the top surface at distance `r` from the center (the well, then up the rim). */
  surfaceAt(r: number): number
  dispose(): void
}

export function createPlate(scale = 1): Plate {
  const points = PROFILE.map(([r, h]) => new THREE.Vector2(r * scale, h * scale))
  const geometry = new THREE.LatheGeometry(points, 128)
  // A thin cobalt line where the rim turns down, painted under the glaze.
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 4, 512)
  const v = (i: number) => (i / (PROFILE.length - 1)) * 512
  ctx.fillStyle = '#21408e'
  // v = 0 at the first point; canvas y runs top-down, texture v bottom-up (flipY).
  const y0 = 512 - v(RIM[0] + 0.55)
  const y1 = 512 - v(RIM[0] + 0.8)
  ctx.fillRect(0, Math.min(y0, y1), 4, Math.abs(y1 - y0))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshPhysicalMaterial({
    color: '#f8f7f3',
    map: tex,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.9,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  // The top surface, from the center outward.
  const top = PROFILE.slice(RIM[0] + 1).reverse()
  const surfaceAt = (r: number) => {
    const x = r / scale
    for (let i = 1; i < top.length; i++) {
      const [r1, h1] = top[i]!
      if (x <= r1) {
        const [r0, h0] = top[i - 1]!
        return (h0 + ((x - r0) / (r1 - r0)) * (h1 - h0)) * scale
      }
    }
    return top[top.length - 1]![1] * scale
  }
  return {
    mesh,
    well: 0.74 * scale,
    radius: 15.05 * scale,
    surfaceAt,
    dispose() {
      geometry.dispose()
      material.dispose()
      tex.dispose()
    },
  }
}
