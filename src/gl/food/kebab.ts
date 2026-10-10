/**
 * Koobideh: minced lamb pressed onto a wide skewer by hand, grilled over
 * charcoal and slid off onto the plate — long and flattened, pinched into
 * ridges by the cook's fingers, charred on the crests, paler and juicy in the
 * grooves, the grain of the mince showing everywhere. Units: centimetres; it
 * lies on y = 0 along x.
 */
import * as THREE from 'three'
import { createNoise } from '@veyra/core'

export interface KebabOptions {
  length?: number
  seed?: number
  quality: 'low' | 'medium' | 'high'
  /** Height of the surface it lies on, in its own frame: soft meat drapes over it. */
  ground?: (x: number, z: number) => number
}

const HALF_WIDTH = 1.75
const HALF_HEIGHT = 0.85
/** Distance between the finger marks. */
const SPACING = 2.2
/** Radius of the rounded ends. */
const CAP = 1.6

export function createKebab(options: KebabOptions): { mesh: THREE.Mesh; dispose(): void } {
  const L = options.length ?? 20
  const seed = options.seed ?? 1
  const low = options.quality === 'low'
  const { noise2, noise3 } = createNoise(seed)
  const ground = options.ground ?? (() => 0)

  // The finger marks: a groove every couple of centimetres, unevenly spaced,
  // slanting one way or the other across the width, each pressed a little
  // deeper or shallower.
  const marks = (t: number, across: number) => {
    const slant = noise2((t * L) / (SPACING * 2.5), 5.3) * 0.7
    const u = (t * L) / SPACING + noise2(t * 2.7, 0.5) * 0.35 + across * slant
    const f = u - Math.floor(u)
    // Broad rounded crests, narrow grooves.
    const crest = Math.sin(Math.PI * f) ** 0.5
    const depth = 0.55 + 0.7 * (noise2(Math.round(u) * 1.37 + 0.5, 2.9) * 0.5 + 0.5)
    return { crest, depth }
  }
  // The cross-section: a flattened, squarish oval (superellipse).
  const section = (a: number) => {
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    return [Math.sign(ca) * Math.abs(ca) ** 0.78, Math.sign(sa) * Math.abs(sa) ** 0.78] as const
  }
  const ends = (t: number) => {
    const d = Math.min(t, 1 - t) * L
    const cap = Math.sqrt(Math.max(0, 1 - (1 - Math.min(1, d / CAP)) ** 2))
    // The meat thins toward the ends of the skewer and sags a little.
    const taper = 1 - 0.14 * Math.exp(-d / 2.4)
    return { cap, taper }
  }
  // A gentle, uneven bow along the length.
  const bow = (t: number) => noise2(t * 1.4, seed * 0.37 + 3) * 1.1

  // --- Geometry ------------------------------------------------------------
  const along = low ? 120 : 260
  const around = low ? 28 : 48
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= along; i++) {
    const t = i / along
    const x = (t - 0.5) * L
    const { cap, taper } = ends(t)
    const zOff = bow(t)
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      const [sx, sy] = section(a)
      const { crest, depth } = marks(t, sx)
      const top = Math.max(0, sy)
      // Pinched: narrower and lower in the grooves, mostly on top.
      const dent = (1 - crest) * depth * (0.18 * top + 0.08 * Math.abs(sx))
      // Mince pressed by hand: lumps of every size.
      const px = sx * HALF_WIDTH
      const py = sy * HALF_HEIGHT
      const lump = noise3(x / 1.1, px / 1.1, py / 1.1) * 0.07 + noise3(x / 0.45, px / 0.45, py / 0.45) * 0.03
      const w = HALF_WIDTH * cap * taper * (1 - 0.03 * (1 - crest) * depth)
      const h = HALF_HEIGHT * cap * taper
      const len = Math.hypot(sx, sy) || 1
      const shrink = (lump - dent) * cap
      const cx = sx * w + (sx / len) * shrink
      const cy = sy * h + (sy / len) * shrink
      const z = cx + zOff
      // The center sits at half height; the ends slump a little lower.
      const y = Math.max(0.02, HALF_HEIGHT * taper * (0.6 + 0.4 * cap) + cy)
      positions.push(x, y + ground(x, z), z)
      uvs.push(t, j / around)
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
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // Close the seam where the rings start and end.
  const normals = geometry.attributes.normal as THREE.BufferAttribute
  const n = new THREE.Vector3()
  for (let i = 0; i <= along; i++) {
    const a = i * stride
    const b = a + around
    n.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize()
    normals.setXYZ(a, n.x, n.y, n.z)
    normals.setXYZ(b, n.x, n.y, n.z)
  }

  // --- Surface: color, roughness and the grain of the mince ----------------
  const TW = low ? 256 : 512
  const TH = low ? 64 : 128
  let perimeter = 0
  for (let j = 0; j < 64; j++) {
    const [x0, y0] = section((j / 64) * Math.PI * 2)
    const [x1, y1] = section(((j + 1) / 64) * Math.PI * 2)
    perimeter += Math.hypot((x1 - x0) * HALF_WIDTH, (y1 - y0) * HALF_HEIGHT)
  }
  const grain = new Float32Array(TW * TH)
  const color = new Uint8Array(TW * TH * 4)
  const rough = new Uint8Array(TW * TH * 4)
  const brown = new THREE.Color('#6a2e12')
  const juicy = new THREE.Color('#7a3418')
  const dark = new THREE.Color('#3e1908')
  const char = new THREE.Color('#190b05')
  const fleck = new THREE.Color('#a8774a')
  const c = new THREE.Color()
  for (let v = 0; v < TH; v++) {
    const a = ((v + 0.5) / TH) * Math.PI * 2
    const [sx, sy] = section(a)
    const px = sx * HALF_WIDTH
    const py = sy * HALF_HEIGHT
    const top = Math.max(0, sy)
    // The long edges, nearest the coals, brown the most.
    const edge = THREE.MathUtils.smoothstep(Math.abs(sx), 0.55, 0.95) * THREE.MathUtils.smoothstep(sy, -0.3, 0.2)
    for (let u = 0; u < TW; u++) {
      const t = (u + 0.5) / TW
      const x = (t - 0.5) * L
      const { crest } = marks(t, sx)
      const k = v * TW + u
      // The grain: small rounded lumps and pits of minced meat.
      const g = noise3(x * 5.5, px * 5.5, py * 5.5) * 0.6 + noise3(x * 12, px * 12, py * 12) * 0.4
      grain[k] = g
      const wander = noise3(x * 0.8, px * 0.8 + 4, py * 0.8)
      // Heat reached the crests and the edges most; the grooves stay juicy.
      const heat = THREE.MathUtils.clamp((0.3 + 0.7 * top) * (0.55 + 0.45 * crest) + edge * 0.3 + wander * 0.3, 0, 1)
      c.copy(juicy).lerp(brown, Math.min(1, crest * 1.3))
      c.lerp(dark, heat * 0.6)
      // Char on the high spots, here and there.
      const burnt = THREE.MathUtils.smoothstep(noise3(x * 2.6 + 9, px * 2.6, py * 2.6) * 0.7 + crest ** 2 * 0.3 + top * 0.15 + edge * 0.15 + g * 0.1, 0.5, 0.8)
      c.lerp(char, burnt * 0.8)
      // The grooves sit in their own shadow.
      c.multiplyScalar(0.8 + 0.2 * crest)
      // Bits of onion and fat in the mince; darker pits between the lumps.
      const bits = THREE.MathUtils.smoothstep(noise3(x * 7.3 + 2, px * 7.3, py * 7.3), 0.45, 0.62) * (1 - burnt) * (1 - heat * 0.5)
      c.lerp(fleck, bits * 0.4)
      c.multiplyScalar(0.84 + 0.3 * (g * 0.5 + 0.5))
      color[k * 4] = Math.round(THREE.MathUtils.clamp(c.r, 0, 1) ** (1 / 2.2) * 255)
      color[k * 4 + 1] = Math.round(THREE.MathUtils.clamp(c.g, 0, 1) ** (1 / 2.2) * 255)
      color[k * 4 + 2] = Math.round(THREE.MathUtils.clamp(c.b, 0, 1) ** (1 / 2.2) * 255)
      color[k * 4 + 3] = 255
      // Juice and fat shine in the grooves; char and dry crests are matte.
      const r = THREE.MathUtils.clamp(0.46 + 0.2 * crest + 0.25 * burnt + g * 0.06, 0.3, 0.92)
      rough[k * 4 + 1] = Math.round(r * 255)
      rough[k * 4 + 3] = 255
    }
  }
  // The grain as a normal map (heights in cm, differences across texels).
  const relief = new Uint8Array(TW * TH * 4)
  const du = L / TW
  const dv = perimeter / TH
  const amp = 0.045
  for (let v = 0; v < TH; v++) {
    for (let u = 0; u < TW; u++) {
      const k = v * TW + u
      const gx = (grain[v * TW + Math.min(TW - 1, u + 1)]! - grain[v * TW + Math.max(0, u - 1)]!) / (2 * du)
      const gy = (grain[((v + 1) % TH) * TW + u]! - grain[((v + TH - 1) % TH) * TW + u]!) / (2 * dv)
      const nx = -gx * amp
      const ny = -gy * amp
      const len = Math.hypot(nx, ny, 1)
      relief[k * 4] = Math.round((nx / len * 0.5 + 0.5) * 255)
      relief[k * 4 + 1] = Math.round((ny / len * 0.5 + 0.5) * 255)
      relief[k * 4 + 2] = Math.round((1 / len * 0.5 + 0.5) * 255)
      relief[k * 4 + 3] = 255
    }
  }
  const texture = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat)
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = 4
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }
  const map = texture(color, true)
  const roughnessMap = texture(rough, false)
  const normalMap = texture(relief, false)

  const material = new THREE.MeshPhysicalMaterial({
    map,
    roughnessMap,
    normalMap,
    roughness: 1,
    metalness: 0,
    // Meat is no mirror: a weak base reflection keeps its color rich…
    specularIntensity: 0.55,
    // …and a film of fat catches the light on the ridges.
    clearcoat: 0.14,
    clearcoatRoughness: 0.35,
    sheen: 0.15,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#8a4a28'),
    envMapIntensity: 0.4,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return {
    mesh,
    dispose() {
      geometry.dispose()
      material.dispose()
      map.dispose()
      roughnessMap.dispose()
      normalMap.dispose()
    },
  }
}
