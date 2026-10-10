/**
 * Koobideh: minced lamb pressed onto a wide skewer by hand and grilled over
 * charcoal — long, slightly flattened, ridged by the cook's fingers, darker
 * where the ridges met the heat. Units: centimetres; it lies on y = 0 along x.
 */
import * as THREE from 'three'
import { createNoise } from '@veyra/core'

export function createKebab(options: { length?: number; seed?: number; quality: 'low' | 'medium' | 'high' }): { mesh: THREE.Mesh; dispose(): void } {
  const L = options.length ?? 22
  const { noise2 } = createNoise(options.seed ?? 1)
  const along = options.quality === 'low' ? 90 : 180
  const around = options.quality === 'low' ? 14 : 22
  const radius = 1.75
  const ridges = Math.round(L / 1.9)
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const base = new THREE.Color('#6b3a1d')
  const char = new THREE.Color('#2b160b')
  const light = new THREE.Color('#91562b')
  const c = new THREE.Color()
  for (let i = 0; i <= along; i++) {
    const t = i / along
    // Ends round off; the body gently bows.
    const end = Math.sin(Math.min(1, Math.min(t, 1 - t) * 12) * (Math.PI / 2)) ** 0.6
    // Hand-pinched ridges: uneven spacing and depth.
    const phase = t * ridges * Math.PI * 2 + noise2(t * 5, 1.7) * 1.6
    const ridge = Math.cos(phase) * (0.55 + 0.45 * (noise2(t * 9, 3.1) * 0.5 + 0.5))
    const x = (t - 0.5) * L
    const bow = Math.sin(t * Math.PI) * 0.6 + noise2(t * 3, 4) * 0.25
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      // Pressed flat underneath, ridges strongest on top.
      const top = Math.max(0, sa)
      // Minced meat: a lumpy surface under the char.
      const lumps = noise2(t * 55, a * 3) * 0.05 + noise2(t * 140, a * 7) * 0.025
      const r = radius * end * (1 + ridge * 0.06 * (0.3 + top) + lumps)
      // Where the flat skewer ran: a shallow channel along the top.
      const channel = Math.exp(-((ca / 0.28) ** 2)) * top * 0.12 * radius
      const y = Math.max(-0.55, sa) * r * 0.52 + radius * 0.32 - channel
      const z = ca * r + bow
      positions.push(x, Math.max(0.02, y), z)
      // Charcoal marks the crests unevenly; the troughs stay paler and juicy.
      const heat = Math.max(0, ridge) * top * (0.5 + Math.max(0, noise2(t * 12, a * 1.5)))
      c.copy(base).lerp(light, Math.max(0, -ridge) * 0.3 * top + Math.max(0, -sa) * 0.25 + noise2(t * 30, a * 4) * 0.15)
      c.lerp(char, Math.min(0.85, heat * 0.5 + Math.max(0, noise2(t * 70, a * 5) - 0.15) * 1.1 * top + Math.max(0, noise2(t * 11, a + 9)) * 0.25))
      colors.push(c.r, c.g, c.b)
    }
  }
  const stride = around + 1
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * stride + j
      const b = a + stride
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    sheen: 0.25,
    sheenColor: new THREE.Color('#b8693a'),
    envMapIntensity: 0.55,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return {
    mesh,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
