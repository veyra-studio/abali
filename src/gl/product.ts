/**
 * The Abali bottle, built procedurally — no model files, no photos.
 *
 * Proportions were measured from reference photography of the 260 ml glass
 * bottle (contoured soda-style glass, label on the upper body, pinched
 * waist, wide lower bulge, crown cap). All geometry is in "bottle units":
 * height ≈ 1, base at y = 0.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { seededRandom } from '@veyra/core'
import { palette } from '../palette'

/** Outer glass profile: [radius, height]. */
const OUTER: Array<[number, number]> = [
  [0.0, 0.0],
  [0.118, 0.0],
  [0.136, 0.004],
  [0.147, 0.014],
  [0.154, 0.034],
  [0.158, 0.07],
  [0.16, 0.13],
  [0.159, 0.175],
  [0.154, 0.24],
  [0.145, 0.3],
  [0.132, 0.365],
  [0.121, 0.42],
  [0.117, 0.455],
  [0.12, 0.49],
  [0.129, 0.53],
  [0.1355, 0.565],
  [0.1375, 0.62],
  [0.1375, 0.7],
  [0.1365, 0.735],
  [0.131, 0.762],
  [0.118, 0.786],
  [0.1, 0.812],
  [0.083, 0.838],
  [0.07, 0.866],
  [0.061, 0.896],
  [0.0545, 0.925],
  [0.051, 0.94],
  [0.0535, 0.946],
  [0.0555, 0.953],
  [0.0555, 0.962],
  [0.0515, 0.968],
  [0.0, 0.968],
]

export const BOTTLE = {
  height: 1.0,
  labelBottom: 0.565,
  labelTop: 0.735,
  fill: 0.9,
  capBottom: 0.936,
  capTop: 0.982,
  capRadius: 0.0585,
}

function profile(points: Array<[number, number]>, smoothing = 3): THREE.Vector2[] {
  const curve = new THREE.SplineCurve(points.map(([r, h]) => new THREE.Vector2(r, h)))
  return curve.getPoints(points.length * smoothing)
}

/** Radius of the outer glass at height `h` (linear interpolation of the profile). */
export function radiusAt(h: number): number {
  for (let i = 1; i < OUTER.length; i++) {
    const [r1, h1] = OUTER[i]!
    const [r0, h0] = OUTER[i - 1]!
    if (h >= h0 && h <= h1 && h1 !== h0) return r0 + ((r1 - r0) * (h - h0)) / (h1 - h0)
  }
  return 0
}

/** The label artwork, drawn the way the real label reads: blue field, white rule, yellow oval, navy Nastaliq. */
export function drawLabel(width = 2048): HTMLCanvasElement {
  const arc = (170 / 180) * Math.PI
  const r = 0.139
  const aspect = (r * arc) / (BOTTLE.labelTop - BOTTLE.labelBottom)
  const height = Math.round(width / aspect)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = palette.blue
  ctx.fillRect(0, 0, width, height)

  // Subtle print texture.
  const rand = seededRandom(7)
  ctx.globalAlpha = 0.035
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#0b3a6b'
    const s = 1 + rand() * 1.5
    ctx.fillRect(rand() * width, rand() * height, s, s)
  }
  ctx.globalAlpha = 1

  // White inset rule and a darker hairline at the edge.
  const inset = height * 0.06
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = height * 0.022
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
  ctx.strokeStyle = palette.blueDeep
  ctx.lineWidth = height * 0.012
  ctx.strokeRect(height * 0.006, height * 0.006, width - height * 0.012, height - height * 0.012)

  // The oval — sized for the front of the bottle (±45° reads as an ellipse).
  const cx = width / 2
  const cy = height / 2
  const rx = width * 0.235
  const ry = height * 0.37
  ctx.fillStyle = palette.yellow
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()

  // «دوغ آبعلی» in Nastaliq.
  ctx.fillStyle = palette.navy
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const size = height * 0.36
  ctx.font = `700 ${size}px "Noto Nastaliq Urdu Variable", "Noto Nastaliq Urdu", serif`
  const m = ctx.measureText('دوغ آبعلی')
  const glyphH = (m.actualBoundingBoxAscent ?? size * 0.8) + (m.actualBoundingBoxDescent ?? size * 0.3)
  const scaleX = Math.min(1, (rx * 1.55) / Math.max(1, m.width))
  ctx.save()
  ctx.translate(cx, cy + glyphH / 2 - (m.actualBoundingBoxDescent ?? 0))
  ctx.scale(scaleX, scaleX)
  ctx.fillText('دوغ آبعلی', 0, 0)
  ctx.restore()
  return c
}

/** A procedural condensation normal map: droplets of varying size. */
export function drawDroplets(size = 512, seed = 3): HTMLCanvasElement {
  const height = new Float32Array(size * size)
  const rand = seededRandom(seed)
  const drops = 900
  for (let d = 0; d < drops; d++) {
    const x = rand() * size
    const y = rand() * size
    const big = rand() < 0.08
    const rad = big ? 5 + rand() * 7 : 1 + rand() * 3
    const elong = big ? 1.3 + rand() * 0.6 : 1
    const x0 = Math.floor(x - rad - 1)
    const x1 = Math.ceil(x + rad + 1)
    const y0 = Math.floor(y - rad * elong - 1)
    const y1 = Math.ceil(y + rad + 1)
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = (px - x) / rad
        const dy = (py - y) / (py < y ? rad * elong : rad)
        const dd = dx * dx + dy * dy
        if (dd >= 1) continue
        const ix = ((px % size) + size) % size
        const iy = ((py % size) + size) % size
        const h = Math.sqrt(1 - dd)
        const idx = iy * size + ix
        height[idx] = Math.max(height[idx]!, h)
      }
    }
  }
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2
      const nz = 1
      const len = Math.hypot(dx, dy, nz)
      const i = (y * size + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Crown cap: a lathe whose skirt is displaced into 21 flutes. */
function crownGeometry(): THREE.BufferGeometry {
  const R = BOTTLE.capRadius
  const top = BOTTLE.capTop
  const bottom = BOTTLE.capBottom
  const pts = [
    new THREE.Vector2(0, top + 0.0035),
    new THREE.Vector2(R * 0.5, top + 0.0028),
    new THREE.Vector2(R * 0.84, top + 0.0012),
    new THREE.Vector2(R * 0.97, top - 0.0008),
    new THREE.Vector2(R, top - 0.004),
    new THREE.Vector2(R * 1.005, top - 0.012),
    new THREE.Vector2(R * 1.02, bottom + 0.012),
    new THREE.Vector2(R * 1.06, bottom + 0.003),
    new THREE.Vector2(R * 1.065, bottom),
    new THREE.Vector2(R * 0.93, bottom - 0.0005),
  ]
  const geo = new THREE.LatheGeometry(pts, 21 * 8)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = Math.hypot(v.x, v.z)
    if (r < R * 0.9) continue
    const theta = Math.atan2(v.x, v.z)
    // Flutes deepen toward the crimped edge.
    const w = THREE.MathUtils.smoothstep(v.y, top - 0.004, bottom + 0.004)
    const k = 1 + Math.cos(theta * 21) * 0.055 * (0.25 + w)
    pos.setXYZ(i, v.x * k, v.y, v.z * k)
  }
  geo.computeVertexNormals()
  return geo
}

export interface Product {
  group: THREE.Group
  /** Everything but the cap (for shaking separately). */
  body: THREE.Group
  cap: THREE.Mesh
  ice: THREE.Group
  glass: THREE.MeshPhysicalMaterial
  liquid: THREE.MeshPhysicalMaterial
  labelTexture: THREE.CanvasTexture
  /** Updates scale-dependent material parameters. */
  setScale(px: number): void
  dispose(): void
}

export function createProduct(options: { ice?: boolean; quality: 'low' | 'medium' | 'high' }): Product {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const segments = options.quality === 'low' ? 72 : 128

  // Glass.
  const dropletTex = new THREE.CanvasTexture(drawDroplets(options.quality === 'low' ? 256 : 512))
  dropletTex.wrapS = dropletTex.wrapT = THREE.RepeatWrapping
  dropletTex.repeat.set(3, 3)
  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f1f8f3'),
    metalness: 0,
    roughness: 0.035,
    transmission: 1,
    thickness: 0.05,
    ior: 1.5,
    attenuationColor: new THREE.Color('#a9d3b6'),
    attenuationDistance: 60,
    specularIntensity: 1,
    envMapIntensity: 1.35,
    normalMap: dropletTex,
    normalScale: new THREE.Vector2(0.22, 0.22),
    clearcoat: 0.6,
    clearcoatRoughness: 0.08,
  })
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(profile(OUTER), segments), glass)
  glassMesh.renderOrder = 2
  body.add(glassMesh)

  // Doogh: opaque, satin white, fills to the neck.
  const wall = 0.0065
  const inner: Array<[number, number]> = [[0, 0.03], [0.11, 0.03]]
  for (const [r, h] of OUTER) {
    if (h <= 0.04 || h >= BOTTLE.fill) continue
    inner.push([Math.max(0.0, r - wall), h])
  }
  const rFill = radiusAt(BOTTLE.fill) - wall
  inner.push([rFill, BOTTLE.fill], [rFill * 0.6, BOTTLE.fill + 0.0015], [0, BOTTLE.fill + 0.002])
  const liquid = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.doogh),
    roughness: 0.42,
    metalness: 0,
    sheen: 0.6,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#dfeaf2'),
    envMapIntensity: 0.9,
  })
  const liquidMesh = new THREE.Mesh(new THREE.LatheGeometry(profile(inner, 2), segments), liquid)
  body.add(liquidMesh)

  // Label, wrapping 170° of the front, printed on paper.
  const labelCanvas = drawLabel(options.quality === 'low' ? 1024 : 2048)
  const labelTexture = new THREE.CanvasTexture(labelCanvas)
  labelTexture.colorSpace = THREE.SRGBColorSpace
  labelTexture.anisotropy = 8
  const labelPts: THREE.Vector2[] = []
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const h = BOTTLE.labelBottom + ((BOTTLE.labelTop - BOTTLE.labelBottom) * i) / steps
    labelPts.push(new THREE.Vector2(radiusAt(h) + 0.0018, h))
  }
  const labelGeo = new THREE.LatheGeometry(labelPts, 96, THREE.MathUtils.degToRad(-85), THREE.MathUtils.degToRad(170))
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.62, metalness: 0, envMapIntensity: 0.55 })
  const labelMesh = new THREE.Mesh(labelGeo, labelMat)
  body.add(labelMesh)

  // Crown cap — enamelled navy metal.
  const capMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#283c86'), metalness: 0.75, roughness: 0.32, envMapIntensity: 1.2 })
  const cap = new THREE.Mesh(crownGeometry(), capMat)
  group.add(cap)

  // Ice, scattered at the base like the cold-shot photography it echoes.
  const ice = new THREE.Group()
  if (options.ice !== false) {
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dcecf6'),
      roughness: 0.16,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 2.4,
      side: THREE.DoubleSide,
    })
    const rand = seededRandom(11)
    const count = options.quality === 'low' ? 4 : 7
    for (let i = 0; i < count; i++) {
      const s = 0.07 + rand() * 0.05
      const geo = new RoundedBoxGeometry(s, s * (0.8 + rand() * 0.3), s * (0.85 + rand() * 0.3), 3, s * 0.18)
      const p = geo.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < p.count; k++) {
        p.setXYZ(k, p.getX(k) * (1 + (rand() - 0.5) * 0.12), p.getY(k) * (1 + (rand() - 0.5) * 0.12), p.getZ(k) * (1 + (rand() - 0.5) * 0.12))
      }
      geo.computeVertexNormals()
      const m = new THREE.Mesh(geo, iceMat)
      const angle = (i / count) * Math.PI * 2 + rand() * 0.6
      const dist = 0.21 + rand() * 0.12
      m.position.set(Math.sin(angle) * dist * 1.25, s * 0.42, Math.cos(angle) * dist * 0.8)
      m.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.4)
      ice.add(m)
    }
    group.add(ice)
  }

  const setScale = (px: number) => {
    // Attenuation distance is in world units (px): keep the tint proportional.
    glass.attenuationDistance = px * 0.28
  }

  return {
    group,
    body,
    cap,
    ice,
    glass,
    liquid,
    labelTexture,
    setScale,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
        }
      })
      labelTexture.dispose()
      dropletTex.dispose()
    },
  }
}
