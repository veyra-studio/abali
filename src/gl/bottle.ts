/**
 * The Abali glass bottle, rebuilt from photographs of the real one.
 *
 * Measured from straight-on product photos (silhouettes traced per row and
 * normalized to the bottle's height, cap included): a long, nearly
 * straight conical neck from the crown finish down to a full upper body;
 * a gentle waist; a slightly narrower lower bulge; a rounded heel and a
 * thick, green-tinted base. The paper label sits on the lower part of the
 * cone, so its sides converge toward the neck. The crown cap has the
 * standard 21 flutes.
 *
 * Units: bottle height (cap included) = 1, base at y = 0.
 */
import * as THREE from 'three'
import { seededRandom } from '@veyra/core'
import { condensationMaps, Profile } from '@veyra/core/three'
import { colors } from '../palette'
import { drawLabel } from './label'

export const BOTTLE = {
  height: 1,
  /** Widest radius (upper body). */
  radius: 0.1512,
  labelBottom: 0.538,
  labelTop: 0.72,
  /** Label coverage around the axis (radians). */
  labelArc: THREE.MathUtils.degToRad(146),
  /** Doogh level (meniscus foot). */
  fill: 0.886,
  /** Top of the glass rim. */
  rim: 0.993,
  capBottom: 0.966,
  capTop: 1.0,
  capRadius: 0.0722,
} as const

/** Outer glass, bottom center → rim. [radius, height] */
const OUTER: Array<[number, number]> = [
  [0.0, 0.011],
  [0.05, 0.0085],
  [0.08, 0.0035],
  [0.092, 0.0], // resting ring
  [0.108, 0.001],
  [0.124, 0.0065],
  [0.135, 0.0155],
  [0.1418, 0.028],
  [0.1455, 0.045],
  [0.147, 0.07],
  [0.1472, 0.1], // lower bulge
  [0.1452, 0.13],
  [0.1405, 0.165],
  [0.135, 0.2],
  [0.1318, 0.228],
  [0.1311, 0.245], // waist
  [0.1328, 0.272],
  [0.1378, 0.322],
  [0.1438, 0.378],
  [0.1488, 0.424],
  [0.1512, 0.455], // upper body
  [0.1507, 0.476],
  [0.1484, 0.497],
  [0.1441, 0.519],
  [0.1388, 0.54], // the cone begins (label bottom)
  [0.1333, 0.568],
  [0.121, 0.628],
  [0.1093, 0.688],
  [0.0979, 0.748],
  [0.0871, 0.808],
  [0.0769, 0.868],
  [0.0702, 0.905],
  [0.0673, 0.922],
  [0.0668, 0.929], // neck top
  [0.0702, 0.9335],
  [0.0725, 0.9395], // transfer bead
  [0.0725, 0.9455],
  [0.07, 0.9505],
  [0.0663, 0.9545],
  [0.066, 0.96],
  [0.069, 0.9645],
  [0.0707, 0.9705], // crown lip
  [0.0707, 0.982],
  [0.0692, 0.988],
  [0.0655, 0.9918],
  [0.06, BOTTLE.rim],
]

/** Wall thickness as a function of height: thin body, heavier neck and finish. */
const wall = (h: number) => 0.0105 + 0.0075 * THREE.MathUtils.smoothstep(h, 0.55, 0.93)
const BASE_INSIDE = 0.038
/** Thickest glass a view ray crosses (the base), in bottle units. */
const GLASS_THICKEST = 0.07

/**
 * Glass thickness along the outline, as a thickness map (green channel)
 * for the lathe's v coordinate: two walls on the body, more at the finish,
 * the full base at the bottom.
 */
function glassThickness(outline: readonly THREE.Vector2[]): THREE.DataTexture {
  const n = outline.length
  const data = new Uint8Array(n * 4)
  for (let j = 0; j < n; j++) {
    const p = outline[j]!
    const t = p.y < 0.05 ? GLASS_THICKEST * (1 - (p.y / 0.05) * 0.4) : Math.min(GLASS_THICKEST, wall(p.y) * 2)
    data[j * 4 + 1] = Math.round((255 * t) / GLASS_THICKEST)
    data[j * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, 1, n)
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export interface BottleParts {
  outer: Profile
  inner: Profile
  /** The whole glass solid: outside, over the rim, down the inside. */
  glass: THREE.Vector2[]
}

/** Builds the outer outline, the inside of the glass, and the closed glass solid. */
export function bottleProfiles(): BottleParts {
  const outer = new Profile(OUTER, { samples: 6, corners: [3] })
  // The inside, rim → down the bore → body → floor.
  const inside: THREE.Vector2[] = [
    new THREE.Vector2(0.0525, 0.9915),
    new THREE.Vector2(0.0442, 0.986),
    new THREE.Vector2(0.0405, 0.976),
    new THREE.Vector2(0.0398, 0.955),
    new THREE.Vector2(0.0418, 0.94),
  ]
  for (let h = 0.928; h > 0.07; h -= 0.006) {
    inside.push(new THREE.Vector2(Math.max(0.02, outer.radiusAt(h) - wall(h)), h))
  }
  // A rounded inner floor on top of the thick base.
  const rFloor = outer.radiusAt(0.07) - wall(0.07)
  const corner = 0.07 - BASE_INSIDE
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2)
    inside.push(new THREE.Vector2(rFloor - corner + Math.cos(a) * corner, BASE_INSIDE + corner - Math.sin(a) * corner))
  }
  inside.push(new THREE.Vector2(rFloor * 0.6, BASE_INSIDE - 0.002))
  inside.push(new THREE.Vector2(0, BASE_INSIDE - 0.0025))
  const inner = new Profile([...inside].reverse(), { samples: 1 })
  const glass = [...outer.points, ...inside]
  return { outer, inner, glass }
}

/** Crown cap geometry: a lathe whose skirt is pressed into 21 flutes that flare at the crimp. */
function crownGeometry(segments: number, inset = 0): THREE.BufferGeometry {
  const R = BOTTLE.capRadius
  const b = BOTTLE.capBottom
  const ch = BOTTLE.capTop - BOTTLE.capBottom
  const pts: Array<[number, number]> = (
    [
      [1.0, 0],
      [0.995, 0.09],
      [0.975, 0.28],
      [0.962, 0.51],
      [0.955, 0.74],
      [0.935, 0.86],
      [0.89, 0.935],
      [0.8, 0.975],
      [0.4, 0.995],
      [0, 1],
    ] as const
  ).map(([r, h]) => [Math.max(0, R * r - inset), b + h * ch - (h > 0.77 ? inset : 0)])
  const geo = new THREE.LatheGeometry(
    pts.map(([r, h]) => new THREE.Vector2(r, h)),
    segments,
  )
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const r = Math.hypot(v.x, v.z)
    if (r < R * 0.85) continue
    const theta = Math.atan2(v.x, v.z)
    // Flutes: rounded crests, deeper toward the crimped edge.
    const depth = THREE.MathUtils.smoothstep(b + 0.79 * ch - v.y, 0, 0.67 * ch)
    const c = Math.cos(theta * 21)
    const wave = Math.sign(c) * Math.abs(c) ** 0.7
    const k = 1 + wave * (0.012 + 0.05 * depth)
    pos.setXYZ(i, v.x * k, v.y, v.z * k)
  }
  geo.computeVertexNormals()
  return geo
}

/** Paint wear for the cap: crests of the flutes rub through to the tin near the crimp. */
function capWearTexture(): THREE.CanvasTexture {
  const w = 1024
  const h = 64
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const rand = seededRandom(21)
  for (let k = 0; k < 21; k++) {
    const x = ((k + 0.5) / 21) * w
    // v runs along the profile: 0 at the crimp edge.
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.5)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    const width = 3 + rand() * 3
    ctx.fillRect(x - width / 2, 0, width, h * 0.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

export interface Bottle {
  group: THREE.Group
  /** Glass, doogh and label: everything but the cap. */
  body: THREE.Group
  cap: THREE.Group
  glass: THREE.MeshPhysicalMaterial
  doogh: THREE.MeshPhysicalMaterial
  label: THREE.MeshPhysicalMaterial
  labelTexture: THREE.CanvasTexture
  /** Outer radius of the glass at height `h`. */
  radiusAt(h: number): number
  /** Updates scale-dependent material parameters (thickness and tint are in world units). */
  setScale(px: number): void
  dispose(): void
}

export function createBottle(options: { quality: 'low' | 'medium' | 'high' }): Bottle {
  const q = options.quality
  const segments = q === 'low' ? 72 : q === 'medium' ? 112 : 160
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const { outer, inner, glass: glassOutline } = bottleProfiles()

  // Condensation: droplets and mist on the cold glass.
  const maps = condensationMaps({ size: q === 'high' ? 1024 : 512, seed: 5, mist: 0.7, runs: 0.03, roughness: [0.07, 0.4] })
  const dropNormal = new THREE.CanvasTexture(maps.normal)
  const dropRough = new THREE.CanvasTexture(maps.roughness)
  for (const t of [dropNormal, dropRough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2, 2.4)
    t.anisotropy = 8
  }

  // Glass: clear flint with a faint green body that shows where it is thick.
  const thicknessMap = glassThickness(glassOutline)
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0,
    roughness: 1,
    roughnessMap: dropRough,
    transmission: 1,
    ior: 1.52,
    // Local units (three.js scales thickness by the model matrix); the map
    // thins it to two walls on the body and keeps the base and finish heavy.
    thickness: GLASS_THICKEST,
    thicknessMap,
    attenuationColor: new THREE.Color(colors.glassTint),
    attenuationDistance: 200,
    specularIntensity: 1,
    envMapIntensity: 1.25,
    normalMap: dropNormal,
    normalScale: new THREE.Vector2(0.3, 0.3),
  })
  const frost = { value: BOTTLE.fill + 0.004 }
  glass.onBeforeCompile = (shader) => {
    // Condensation only where the cold doogh touches the glass.
    shader.uniforms.uFrostTop = frost
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;\nuniform float uFrostTop;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float frost = 1.0 - smoothstep(uFrostTop - 0.012, uFrostTop + 0.012, vLocalY);
        normal = normalize(mix(nonPerturbedNormal, normal, frost));`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.03, roughnessFactor, 1.0 - smoothstep(uFrostTop - 0.012, uFrostTop + 0.012, vLocalY));')
  }
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(glassOutline, segments), glass)
  glassMesh.renderOrder = 2
  body.add(glassMesh)

  // Doogh: opaque, satin white, up into the neck with a meniscus.
  const gap = 0.0012
  const fill = BOTTLE.fill
  const liquidPts: THREE.Vector2[] = [new THREE.Vector2(0, BASE_INSIDE + gap)]
  for (const p of inner.points) {
    if (p.y <= BASE_INSIDE + gap || p.y >= fill) continue
    liquidPts.push(new THREE.Vector2(Math.max(0, p.x - gap), p.y))
  }
  const rTop = inner.radiusAt(fill) - gap
  // Meniscus: the surface climbs the wall a little.
  liquidPts.push(new THREE.Vector2(rTop, fill + 0.0035), new THREE.Vector2(rTop * 0.82, fill + 0.0006), new THREE.Vector2(0, fill))
  const doogh = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colors.doogh),
    roughness: 0.62,
    metalness: 0,
    sheen: 0.4,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#f2f6f7'),
    // Doogh scatters light inside: a little self-light keeps its shadows milky.
    emissive: new THREE.Color('#2a2c2b'),
    envMapIntensity: 1.25,
  })
  const liquidMesh = new THREE.Mesh(new THREE.LatheGeometry(liquidPts, segments), doogh)
  body.add(liquidMesh)

  // Label: paper on the cone, its artwork drawn to the band's real shape.
  const band = outer.band({
    from: BOTTLE.labelBottom,
    to: BOTTLE.labelTop,
    arc: BOTTLE.labelArc,
    lift: 0.0011,
    segments: [q === 'low' ? 48 : 96, 16],
  })
  const labelCanvas = drawLabel({ aspect: band.width / band.height, halfWidthAt: band.halfWidthAt }, q === 'low' ? 1024 : 2048)
  const labelTexture = new THREE.CanvasTexture(labelCanvas)
  labelTexture.colorSpace = THREE.SRGBColorSpace
  labelTexture.anisotropy = 8
  const labelDrops = dropNormal.clone()
  labelDrops.repeat.set(2.2, 1.4)
  const label = new THREE.MeshPhysicalMaterial({
    map: labelTexture,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.6,
    normalMap: labelDrops,
    normalScale: new THREE.Vector2(0.22, 0.22),
  })
  const labelMesh = new THREE.Mesh(band.geometry, label)
  body.add(labelMesh)

  // Crown cap — navy enamel over tin plate, with a pale liner inside.
  const capSegments = 21 * (q === 'low' ? 8 : 14)
  const wear = capWearTexture()
  const capMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colors.cap),
    metalness: 0.62,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.3,
  })
  capMat.onBeforeCompile = (shader) => {
    // Rub the paint off the flute crests near the crimp: brighter, more metallic.
    shader.uniforms.uWear = { value: wear }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uWear;')
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        float wearAmt = texture2D(uWear, vCapUv).r;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.8, 0.84), wearAmt * 0.75);
        metalnessFactor = mix(metalnessFactor, 1.0, wearAmt);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.22, texture2D(uWear, vCapUv).r);')
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCapUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCapUv = uv;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCapUv;')
  }
  const cap = new THREE.Group()
  const capOuter = new THREE.Mesh(crownGeometry(capSegments), capMat)
  const liner = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.4, roughness: 0.5, side: THREE.BackSide })
  const capInner = new THREE.Mesh(crownGeometry(capSegments, 0.0016), liner)
  cap.add(capOuter, capInner)
  group.add(cap)

  const setScale = (px: number) => {
    // Attenuation distance is in world units (CSS px); thickness is local.
    glass.attenuationDistance = px * 0.12
  }

  return {
    group,
    body,
    cap,
    glass,
    doogh,
    label,
    labelTexture,
    radiusAt: (h) => outer.radiusAt(h),
    setScale,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => m.dispose())
        }
      })
      for (const t of [labelTexture, dropNormal, dropRough, labelDrops, wear, thicknessMap]) t.dispose()
    },
  }
}
