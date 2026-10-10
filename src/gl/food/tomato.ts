/**
 * A tomato grilled on the skewer beside the kebab: soft and slumped, its
 * skin wrinkled where it shrank, split where the flesh swelled, blistered and
 * black on the side that faced the coals. Units: cm; it rests on y = 0.
 */
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { createNoise } from '@veyra/core'

export function createTomato(options: { size?: number; seed?: number; quality: 'low' | 'medium' | 'high' }): { mesh: THREE.Mesh; dispose(): void } {
  const R = (options.size ?? 6) / 2
  const seed = options.seed ?? 2
  const { noise3 } = createNoise(seed)
  const smooth = THREE.MathUtils.smoothstep
  // One welded sphere, so the normals stay smooth after the displacement.
  const sphere = new THREE.IcosahedronGeometry(1, options.quality === 'low' ? 16 : 40)
  sphere.deleteAttribute('normal')
  sphere.deleteAttribute('uv')
  const geometry = mergeVertices(sphere)
  sphere.dispose()
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  // It came off the skewer lying a little on its side: the stem axis tilts.
  const untilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5 + (seed % 3) * 0.12, seed, 0.25)).invert()
  // The side that faced the coals.
  const coals = new THREE.Vector3(Math.cos(seed * 2.1), -0.15, Math.sin(seed * 2.1)).normalize()

  const skin = new THREE.Color('#b0200d')
  const ripe = new THREE.Color('#c93a16')
  const deep = new THREE.Color('#7a1207')
  const fold = new THREE.Color('#5a0f06')
  const flesh = new THREE.Color('#e35a2c')
  const lifted = new THREE.Color('#cf7d63')
  const char = new THREE.Color('#1a0c07')
  const ash = new THREE.Color('#57483f')
  const scar = new THREE.Color('#4d3a19')
  const c = new THREE.Color()
  const d = new THREE.Vector3()
  const b = new THREE.Vector3()
  const n = (s: number, ox = 0) => noise3(d.x * s + ox, d.y * s, d.z * s)
  let floor = Infinity
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize()
    // Its own frame: the stem on +y.
    b.copy(d).applyQuaternion(untilt)
    const lon = Math.atan2(b.z, b.x)
    // Five locules: shallow lobes around the stem.
    const lobes = Math.cos(lon * 5 + seed) * 0.035 * (1 - b.y * b.y)
    // Soft and uneven where the flesh gave way.
    const soft = n(1.6) * 0.06
    // Toward the coals the skin blistered and loosened.
    const heat = d.dot(coals) * 0.75 + n(2.8, 40) * 0.55 + n(7.5) * 0.18
    // Wrinkles: a few creases where the loose skin shrank over the flesh.
    const loose = 0.25 + 0.75 * smooth(heat, -0.1, 0.45)
    const w1 = (1 - Math.abs(n(2.2, 7))) ** 12
    const w2 = (1 - Math.abs(n(5, 3))) ** 14
    const wrinkle = (w1 * 0.024 + w2 * 0.007) * loose
    // A split where the flesh swelled, its skin edges curling back.
    const s = 1 - Math.abs(n(1.1, 31))
    const reach = smooth(n(1.4, 50), 0, 0.22)
    const split = smooth(s, 0.935, 0.98) * reach
    const lip = smooth(s, 0.87, 0.935) * (1 - split) * reach
    // The stem scar: small and sunken, a star of fine cracks around it.
    const stem = smooth(b.y, 0.972, 0.993)
    const star = smooth(b.y, 0.9, 0.968) * (1 - stem) * Math.max(0, Math.cos(lon * 5 + 1.1)) ** 6
    const k = 1 + lobes + soft - wrinkle - split * 0.08 + lip * 0.015 - stem * 0.07 - star * 0.02
    let x = d.x * k * R
    let y = d.y * k * R * 0.74
    let z = d.z * k * R
    // Slumped on the plate: the base pressed flat, the sides bulging.
    const base = -0.48 * R
    if (y < base) y = base + (y - base) * 0.15
    const bulge = 1 + 0.08 * Math.exp(-(((y - base * 0.55) / (0.45 * R)) ** 2))
    x *= bulge
    z *= bulge
    pos.setXYZ(i, x, y, z)
    floor = Math.min(floor, y)

    // Deep red, a little orange on the shoulders, darker in the folds.
    c.copy(skin).lerp(ripe, THREE.MathUtils.clamp(n(2.2, 20) * 0.9 + 0.35 * b.y, 0, 1) * 0.6)
    c.lerp(deep, Math.max(0, n(4, 11)) * 0.7)
    c.lerp(fold, Math.min(1, wrinkle * 8))
    // Toward the coals: skin lifted into pale blisters, then charred black.
    const burnt = smooth(heat, 0.42, 0.68)
    c.lerp(lifted, smooth(heat, 0.22, 0.42) * (1 - burnt) * 0.5)
    c.lerp(char, burnt * 0.92)
    c.lerp(ash, burnt * smooth(n(13, 9), 0.3, 0.6) * 0.45)
    // Wet flesh in the split.
    c.lerp(flesh, split)
    c.lerp(scar, Math.max(stem, star * 0.75))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.translate(0, -floor, 0)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    // Tight, wet skin: glossy, with a clear coat of juice.
    roughness: 0.26,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.85,
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
