/**
 * A spoon and a fork in polished stainless steel — Persian tables eat chelow
 * kabab with both. Steel reads by what it reflects, so the shapes are
 * curved everywhere the light can run along them: handles with a rounded
 * crown that rise from the neck and come back down to rest on their ends, a
 * spoon bowl that is a real shell with a thin rolled rim, a fork whose head
 * cups slightly and whose tines lift at the tips. They reflect a room of
 * their own (`steelEnvironment`): a bright window on the left, a soft
 * ceiling, darker walls — contrast, not a flat grey.
 * Units: centimetres; each lies on y = 0 along x, the working end toward −x.
 */
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js'
import { studioEnvironment } from '@veyra/core/three'

/** The room the steel reflects (dispose with the table). */
export function steelEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  return studioEnvironment(renderer, {
    lights: [
      // The window, high on the left: the long highlights.
      { size: [4.5, 5], position: [-6.5, 5.5, -3.5], intensity: 4.6, color: '#fff3e2' },
      // A soft ceiling and the bright cloth below the room's middle.
      { size: [7, 7], position: [1, 8, 1], intensity: 0.55, color: '#fff7ee' },
      { size: [14, 14], position: [0, -6, 0], intensity: 0.75, color: '#efe2c8' },
      // A narrow strip across the room: a second, thinner glint.
      { size: [9, 0.5], position: [2, 4, 6], intensity: 2.4, color: '#fffaf2' },
    ],
    // A bright room (cream cloth, light walls): steel on a sunny table reads light, not grey.
    walls: ['#ab9f8c', '#665d50'],
    blur: 0.01,
  })
}

function steel(env: THREE.Texture | null): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#eef0f2',
    metalness: 1,
    roughness: 0.11,
    envMap: env,
    envMapIntensity: 1,
  })
}

interface Station {
  /** Along the length. */
  x: number
  /** Half width. */
  w: number
  /** Half thickness. */
  t: number
  /** Height of the middle above the cloth. */
  y: number
}

/**
 * Lofts a handle through `stations` (from the neck to the end, x ascending):
 * soft-rectangle cross-sections whose top is crowned, so highlights run
 * along it. The far end closes round; the near end stays open (it meets the
 * bowl or the fork's head).
 */
function loft(stations: Station[], around = 20): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const ring = (s: Station) => {
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      // A soft rectangle (exponent < 1 squares it a little); the top bulges more than the underside.
      const z = s.w * Math.sign(c) * Math.abs(c) ** 0.7
      const crown = sn > 0 ? 1 + 0.35 * (1 - (z / s.w) ** 2) : 1
      const y = s.y + s.t * Math.sign(sn) * Math.abs(sn) ** 0.8 * crown
      positions.push(s.x, y, z)
    }
  }
  stations.forEach(ring)
  for (let i = 0; i < stations.length - 1; i++) {
    for (let k = 0; k < around; k++) {
      const a = i * around + k
      const b = i * around + ((k + 1) % around)
      const c = a + around
      const d = b + around
      indices.push(a, c, b, b, c, d)
    }
  }
  // Close the far end on its last station's middle.
  const last = stations[stations.length - 1]!
  const tip = positions.length / 3
  positions.push(last.x + 0.001, last.y, 0)
  const base = (stations.length - 1) * around
  for (let k = 0; k < around; k++) indices.push(base + k, tip, base + ((k + 1) % around))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Stations for a handle from the neck (x0) to the end (x0 + length): narrow and arched near the neck, broad and resting at the end. */
function handleStations(x0: number, length: number, neckY: number, w0: number, w1: number): Station[] {
  const out: Station[] = []
  const n = 28
  const endRound = w1 * 1.1
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const x = x0 + u * length
    // Width: the neck, then a long gentle swell to the rounded end.
    let w = w0 + (w1 - w0) * THREE.MathUtils.smoothstep(u, 0.08, 0.85)
    const fromEnd = x0 + length - x
    if (fromEnd < endRound) w *= Math.sqrt(Math.max(0, 1 - ((endRound - fromEnd) / endRound) ** 2))
    w = Math.max(w, 0.03)
    // Height: up from the neck in an arch, then down to rest on the end.
    const arch = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.55
    const y = THREE.MathUtils.lerp(neckY, 0.17, THREE.MathUtils.smoothstep(u, 0, 1)) + arch
    const t = THREE.MathUtils.lerp(0.13, 0.085, u)
    out.push({ x, w, t, y: Math.max(y, t + 0.02) })
  }
  return out
}

export function createSpoon(env: THREE.Texture | null, length = 19.5): { group: THREE.Group; dispose(): void } {
  const half = 3.25 // the bowl's half length
  const wideTip = 2.15
  const wideNeck = 1.55
  const depth = 0.62
  const wall = 0.14
  const material = steel(env)
  // The bowl: a shell over an egg-shaped outline, broader at the tip;
  // inside it rises from the hollow to the rim, outside it rests on its
  // lowest point; a rolled rim joins the two.
  const rings = 22
  const around = 56
  const pos: number[] = []
  const idx: number[] = []
  const outline = (a: number) => {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const w = THREE.MathUtils.lerp(wideNeck, wideTip, (1 - c) / 2)
    return [half * c, w * s] as const
  }
  // Rows: inner surface (r 0→1), the rim (3 rows), outer surface (r 1→0).
  const rows: Array<(x: number, z: number) => [number, number, number]> = []
  const rimLift = (x: number) => 0.12 * Math.max(0, x / half) // the rim rises toward the neck
  for (let i = 0; i <= rings; i++) {
    const r = i / rings
    rows.push((x, z) => [x * r, wall + depth * r * r + rimLift(x * r), z * r])
  }
  for (let j = 1; j <= 3; j++) {
    const a = (j / 4) * Math.PI
    rows.push((x, z) => {
      const len = Math.hypot(x, z) || 1
      const out = (Math.sin(a) * wall) / 2
      return [x + (x / len) * out, wall + depth + rimLift(x) - (1 - Math.cos(a)) * (wall / 2), z + (z / len) * out]
    })
  }
  for (let i = rings; i >= 0; i--) {
    const r = i / rings
    rows.push((x, z) => [x * r, depth * r ** 2.15 * 1.02 + rimLift(x * r) * r, z * r])
  }
  for (const row of rows) {
    for (let k = 0; k < around; k++) {
      const [x, z] = outline((k / around) * Math.PI * 2)
      pos.push(...row(x, z))
    }
  }
  for (let i = 0; i < rows.length - 1; i++) {
    for (let k = 0; k < around; k++) {
      const a = i * around + k
      const b = i * around + ((k + 1) % around)
      idx.push(a, b, a + around, b, b + around, a + around)
    }
  }
  const bowlGeo = new THREE.BufferGeometry()
  bowlGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  bowlGeo.setIndex(idx)
  bowlGeo.computeVertexNormals()
  const bowl = new THREE.Mesh(bowlGeo, material)
  bowl.position.x = -half
  // The handle grows out of the bowl's back rim.
  const handleGeo = loft(handleStations(-0.35, length - 2 * half + 0.35, wall + depth + 0.1, 0.3, 0.64))
  const stem = new THREE.Mesh(handleGeo, material)
  const group = new THREE.Group()
  group.add(bowl, stem)
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return {
    group,
    dispose() {
      bowlGeo.dispose()
      handleGeo.dispose()
      material.dispose()
    },
  }
}

export function createFork(env: THREE.Texture | null, length = 19.5): { group: THREE.Group; dispose(): void } {
  const headL = 6.4
  const headW = 1.28
  const tine = 0.34
  const gap = (headW * 2 - tine * 4) / 3
  const root = -2.8 // where the slots between the tines end
  const shape = new THREE.Shape()
  // From the neck, out to the shoulder, then the four tines in turn.
  shape.moveTo(0.3, -0.32)
  shape.bezierCurveTo(-0.9, -0.36, -1.7, -headW, -2.45, -headW)
  shape.lineTo(-headL + 0.18, -headW + 0.05)
  let z = -headW
  for (let i = 0; i < 4; i++) {
    const z1 = z + tine
    // Round the tip, come back along the tine to the slot, round the slot.
    shape.quadraticCurveTo(-headL - 0.1, z + tine / 2, -headL + 0.18, z1 - 0.02)
    if (i < 3) {
      shape.lineTo(root, z1)
      shape.quadraticCurveTo(root + 0.24, z1 + gap / 2, root, z1 + gap)
      shape.lineTo(-headL + 0.18, z1 + gap + 0.02)
    }
    z = z1 + gap
  }
  shape.lineTo(-2.45, headW)
  shape.bezierCurveTo(-1.7, headW, -0.9, 0.36, 0.3, 0.32)
  shape.lineTo(0.3, -0.32)
  let headGeo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 })
  headGeo.rotateX(-Math.PI / 2)
  // The flat faces are long thin triangles: subdivide them, so bending the
  // head below stays smooth instead of creasing into facets.
  headGeo = new TessellateModifier(0.14, 8).modify(headGeo)
  headGeo.deleteAttribute('normal')
  headGeo.deleteAttribute('uv')
  headGeo = mergeVertices(headGeo, 1e-4)
  {
    // The head cups a little across and its tines lift toward the tips;
    // the neck climbs to meet the handle.
    const p = headGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const zz = p.getZ(i)
      const cup = 0.22 * (zz / headW) ** 2
      const tips = x < root ? (root - x) ** 2 * 0.018 : 0
      const neck = x > -1.6 ? ((x + 1.6) / 1.9) ** 2 * 0.5 : 0
      p.setY(i, p.getY(i) + 0.06 + cup + tips + neck)
    }
    headGeo.computeVertexNormals()
  }
  const material = steel(env)
  const head = new THREE.Mesh(headGeo, material)
  const handleGeo = loft(handleStations(0.15, length - headL - 0.15, 0.62, 0.3, 0.64))
  const stem = new THREE.Mesh(handleGeo, material)
  const group = new THREE.Group()
  group.add(head, stem)
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return {
    group,
    dispose() {
      headGeo.dispose()
      handleGeo.dispose()
      material.dispose()
    },
  }
}
