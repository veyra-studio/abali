/**
 * A tomato grilled on the skewer beside the kebab: slumped, its skin
 * blistered and split, black where it touched the coals. Units: cm.
 */
import * as THREE from 'three'
import { createNoise } from '@veyra/core'

export function createTomato(options: { size?: number; seed?: number; quality: 'low' | 'medium' | 'high' }): { mesh: THREE.Mesh; dispose(): void } {
  const R = (options.size ?? 6) / 2
  const { noise3 } = createNoise(options.seed ?? 2)
  const geometry = new THREE.IcosahedronGeometry(R, options.quality === 'low' ? 12 : 24)
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const red = new THREE.Color('#b9230d')
  const deep = new THREE.Color('#7e1408')
  const black = new THREE.Color('#1f0d08')
  const c = new THREE.Color()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const d = v.clone().normalize()
    // Lobes, slump, blisters.
    const lobes = Math.cos(Math.atan2(d.z, d.x) * 5) * 0.05 * (1 - Math.abs(d.y))
    const blister = Math.max(0, noise3(d.x * 7, d.y * 7, d.z * 7)) * 0.05
    // The skin wrinkles as the flesh softens.
    const wrinkle = Math.abs(noise3(d.x * 16, d.y * 16, d.z * 16)) * -0.025
    const k = 1 + lobes + blister + wrinkle + noise3(d.x * 2, d.y * 2, d.z * 2) * 0.05
    v.multiplyScalar(k)
    v.y = v.y * 0.78 + (v.y < 0 ? v.y * -0.12 : 0)
    pos.setXYZ(i, v.x, v.y + R * 0.78, v.z)
    const burnt = Math.min(1, Math.max(0, noise3(d.x * 3.5 + 5, d.y * 3.5, d.z * 3.5) * 2.4 - 0.25)) * (0.4 + Math.max(0, -d.x) * 0.8)
    c.copy(red).lerp(deep, Math.max(0, noise3(d.x * 5, d.y * 5 + 2, d.z * 5)) * 0.8)
    c.lerp(black, Math.min(1, burnt))
    // The stem scar on top.
    if (d.y > 0.94) c.set('#3f4a22')
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    sheen: 0.2,
    envMapIntensity: 0.9,
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
