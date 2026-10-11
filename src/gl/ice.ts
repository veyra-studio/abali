/**
 * Ice, as in a drinks shot: clear cubes melted round at the edges,
 * ray-traced from the inside (`refractiveSolid`). Light bends through each
 * cube and bounces off its walls past the critical angle, so what lies
 * behind shows through, bent, and the edges turn bright and dark as real
 * ice does. Inside: the cloudy heart of freezer ice and a few tiny bubbles.
 *
 * `createIceCube` makes one cube for any scene, given what its rays see
 * once they leave it; `createIce` scatters cubes around the bottle in the
 * studio. Sizes are free: everything inside scales with the cube.
 */
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { seededRandom } from '@veyra/core'
import { refractiveSolid } from '@veyra/core/three'

type Quality = 'low' | 'medium' | 'high'

const IOR = 1.31

interface Shape {
  half: THREE.Vector3
  /** Corner radius at the top and the bottom (melting rounds the top more). */
  radiusTop: number
  radiusBottom: number
  /** Narrower toward the bottom (freezer trays taper). */
  taper: number
  /** Melt: how much the faces' gentle waves tilt the surface (relief). */
  melt: number
  seed: number
}

// The same solid in JS (for the mesh) and GLSL (for the rays).
const smoothstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
function sdf(s: Shape, x: number, y: number, z: number): number {
  const k = 1 - s.taper * (0.5 - 0.5 * THREE.MathUtils.clamp(y / s.half.y, -1, 1))
  const r = s.radiusBottom + (s.radiusTop - s.radiusBottom) * smoothstep(-s.half.y, s.half.y, y)
  const dx = Math.abs(x / k) - (s.half.x - r)
  const dy = Math.abs(y) - (s.half.y - r)
  const dz = Math.abs(z / k) - (s.half.z - r)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0))
  return (outside + Math.min(Math.max(dx, dy, dz), 0) - r) * Math.min(k, 1)
}
const sdfGlsl = /* glsl */ `
uniform vec4 iceBox;   // half extents; corner radius at the bottom
uniform vec4 iceShape; // taper, melt (relief), seed, corner radius at the top
float solidSdf(vec3 p) {
  float k = 1.0 - iceShape.x * (0.5 - 0.5 * clamp(p.y / iceBox.y, -1.0, 1.0));
  float r = mix(iceBox.w, iceShape.w, smoothstep(-iceBox.y, iceBox.y, p.y));
  vec3 d = vec3(abs(p.x / k), abs(p.y), abs(p.z / k)) - (iceBox.xyz - r);
  return (length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r) * min(k, 1.0);
}
`
// The rounded box's own normal (from the closest point of its core):
// cheaper than the SDF's gradient, and the melt comes from the bump anyway.
const normalGlsl = /* glsl */ `
vec3 solidNormal(vec3 p) {
  float k = 1.0 - iceShape.x * (0.5 - 0.5 * clamp(p.y / iceBox.y, -1.0, 1.0));
  float r = mix(iceBox.w, iceShape.w, smoothstep(-iceBox.y, iceBox.y, p.y));
  vec3 q = vec3(p.x / k, p.y, p.z / k);
  vec3 b = iceBox.xyz - r;
  vec3 n = q - clamp(q, -b, b);
  n = vec3(n.x / k, n.y, n.z / k);
  float l = length(n);
  return l > 1e-6 ? n / l : vec3(0.0, 1.0, 0.0);
}
`
// Melting faces: gentle waves, as relief rather than geometry (three sines:
// noise would cost far more, evaluated at every bounce).
const bumpGlsl = /* glsl */ `
vec3 solidBump(vec3 p, vec3 n) {
  vec3 q = p / iceBox.x * 6.0 + iceShape.z;
  vec3 g = vec3(sin(q.y * 1.3 + q.z * 0.7), sin(q.z * 1.1 - q.x * 0.9 + 1.7), sin(q.x * 1.2 + q.y * 0.8 + 3.1)) * iceShape.y;
  return normalize(n + g - n * dot(g, n));
}
`
const BUBBLES = 8
const insideGlsl = (bubbles: number) => /* glsl */ `
uniform vec4 iceCore; // center of the cloudy heart; its density (per half size)
uniform vec4 iceBubbles[${BUBBLES}]; // center, radius
uniform vec4 iceCracks[2]; // fracture planes through the heart: normal, how far it has run (0 none)
uniform float iceHaze; // faint scattering everywhere (per half size)
uniform vec3 iceMist;
// The cloudy heart: air pushed to the middle as the water froze from the
// outside in — uneven and wispy (sines, not noise: it is sampled a lot).
float iceCloud(vec3 q) {
  vec3 u = (q - iceCore.xyz) / (iceBox.xyz * vec3(0.55, 0.72, 0.55));
  float r2 = dot(u, u);
  if (r2 > 1.0) return 0.0;
  vec3 w = q / iceBox.x * 3.0 + iceShape.z;
  float wisp = 0.6 + 0.4 * sin(w.x * 2.1 + w.y * 1.4) * sin(w.z * 2.7 - w.x * 1.1);
  return (1.0 - r2) * (1.0 - r2) * wisp;
}
void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through) {
  float depth = iceHaze * len / iceBox.x;
  // The heart and the bubbles along the way in; the faint haze on every run.
  if (bounce == 0) {
    float h = len / 3.0;
    float cloud = 0.0;
    for (int i = 0; i < 3; i++) cloud += iceCloud(p + d * (h * (float(i) + 0.5)));
    depth += iceCore.w * cloud * h / iceBox.x;
  }
  float a = 1.0 - exp(-depth);
  light += through * a * iceMist;
  through *= 1.0 - a;
  if (bounce > 0) return;
  // Fractures (tapped too often): thin sheets of air through the heart,
  // silver where you look along them, with splintered edges.
  for (int c = 0; c < 2; c++) {
    vec4 k = iceCracks[c];
    if (k.w <= 0.0) continue;
    float dn = dot(d, k.xyz);
    if (abs(dn) < 1e-4) continue;
    float t = dot(iceCore.xyz - p, k.xyz) / dn;
    if (t <= 0.0 || t >= len) continue;
    vec3 h = p + d * t - iceCore.xyz;
    vec3 side = normalize(cross(k.xyz, vec3(0.31, 0.79, 0.53)));
    vec2 uv = vec2(dot(h, side), dot(h, cross(k.xyz, side))) / iceBox.x;
    float ang = atan(uv.x, uv.y);
    float r = length(uv);
    float reach = k.w * (0.82 + 0.12 * sin(ang * 3.0 + k.x * 9.0) + 0.06 * sin(ang * 7.0 + 1.3));
    float sheet = 1.0 - smoothstep(reach - 0.18, reach, r);
    if (sheet <= 0.0) continue;
    // A fracture: an air gap that turns to silver at a glancing angle, a
    // milky veil with uneven, wavy feathering — light added, nothing dimmed.
    float glint = 0.35 + 0.65 * pow(1.0 - abs(dn), 2.0);
    float veil = 0.55 + 0.45 * sin(uv.x * 6.0 + sin(uv.y * 5.0) * 1.8) * sin(uv.y * 8.0 + sin(uv.x * 4.0) * 1.8);
    float front = smoothstep(reach - 0.3, reach - 0.05, r) * sheet;
    light += through * iceMist * (glint * veil * 0.45 + front * 0.35) * sheet;
  }
  // Tiny bubbles: past the critical angle their walls turn to silver.
  for (int i = 0; i < ${bubbles}; i++) {
    vec4 b = iceBubbles[i];
    vec3 oc = p - b.xyz;
    float k = dot(oc, d);
    float disc = k * k - dot(oc, oc) + b.w * b.w;
    if (disc > 0.0) {
      float t = -k - sqrt(disc);
      if (t > 0.0 && t < len) {
        float rim = smoothstep(0.8, 0.3, abs(dot(d, normalize(oc + d * t))));
        light += through * (0.25 + rim) * iceMist;
        through *= 1.0 - 0.6 * rim;
      }
    }
  }
}
`

/**
 * A rounded box projected onto the solid. Each flat face is one large quad;
 * only the rounded band along the edges is subdivided (`band` segments on
 * each side). Large triangles matter here: the GPU shades in 2×2 blocks, so
 * small ones would run the costly ray trace several times per pixel.
 */
function cubeGeometry(s: Shape, band: number): THREE.BufferGeometry {
  const n = 2 * band + 1
  let geo: THREE.BufferGeometry = new THREE.BoxGeometry(2, 2, 2, n, n, n)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const normals = new Float32Array(pos.count * 3)
  const r = (s.radiusTop + s.radiusBottom) / 2
  const reach = Math.max(s.radiusTop, s.radiusBottom) * 1.15
  const inner = new THREE.Vector3(s.half.x - r, s.half.y - r, s.half.z - r)
  const p = new THREE.Vector3()
  const c = new THREE.Vector3()
  const g = new THREE.Vector3()
  // Grid line i of n along an axis of half size h: the band's lines spread
  // over the curve, then one span across the flat middle.
  const place = (t: number, h: number) => {
    const i = Math.round(((t + 1) / 2) * n)
    const w = Math.min(0.45, reach / h)
    const u = i <= band ? -1 + (w * i) / band : 1 - (w * (n - i)) / band
    return u * h
  }
  const e = s.half.x * 1e-3
  const grad = (q: THREE.Vector3) =>
    g.set(
      sdf(s, q.x + e, q.y, q.z) - sdf(s, q.x - e, q.y, q.z),
      sdf(s, q.x, q.y + e, q.z) - sdf(s, q.x, q.y - e, q.z),
      sdf(s, q.x, q.y, q.z + e) - sdf(s, q.x, q.y, q.z - e),
    ).normalize()
  for (let i = 0; i < pos.count; i++) {
    p.set(place(pos.getX(i), s.half.x), place(pos.getY(i), s.half.y), place(pos.getZ(i), s.half.z))
    c.copy(p).clamp(inner.clone().negate(), inner)
    p.sub(c).normalize().multiplyScalar(r).add(c)
    // Onto the solid itself (taper, top and bottom radii): a few Newton steps.
    for (let k = 0; k < 4; k++) p.addScaledVector(grad(p), -sdf(s, p.x, p.y, p.z))
    pos.setXYZ(i, p.x, p.y, p.z)
    grad(p)
    normals.set([g.x, g.y, g.z], i * 3)
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geo
}

export interface IceCubeOptions {
  /** Edge length, in scene units. */
  size: number
  quality: Quality
  seed: number
  /** 0 clear … 1 a dense cloudy heart. */
  cloud: number
  /** Light scattered by the cloud and the bubbles. */
  mist: THREE.Color
  /**
   * GLSL defining `vec3 solidOutside(vec3 position, vec3 direction)`: what
   * the rays see once they leave the cube (world space). See `refractiveSolid`.
   */
  outside: string
  /** Uniforms `outside` declares. */
  uniforms?: Record<string, THREE.IUniform>
}

export interface IceCube {
  mesh: THREE.Mesh
  /** Half extents of the cube's box. */
  half: THREE.Vector3
  /** Two fracture planes (normal, how far each has run: 0 none … 1 through). */
  cracks: [THREE.Vector4, THREE.Vector4]
  dispose(): void
}

export function createIceCube(options: IceCubeOptions): IceCube {
  const { size, quality } = options
  const rand = seededRandom(Math.round(options.seed * 1000) + 7)
  const low = quality === 'low'
  const radiusBottom = size * (0.09 + rand() * 0.03)
  const shape: Shape = {
    half: new THREE.Vector3(size / 2, (size / 2) * (0.84 + rand() * 0.12), (size / 2) * (0.92 + rand() * 0.1)),
    radiusBottom,
    radiusTop: radiusBottom * (1.25 + rand() * 0.35),
    taper: 0.05 + rand() * 0.05,
    melt: 0.05,
    seed: options.seed,
  }
  const core = new THREE.Vector4((rand() - 0.5) * size * 0.08, -size * 0.03, (rand() - 0.5) * size * 0.08, options.cloud * 5.6)
  const bubbles = Array.from({ length: BUBBLES }, () => {
    const r = rand()
    return new THREE.Vector4(
      core.x + (rand() * 2 - 1) * shape.half.x * 0.5,
      core.y + (rand() * 2 - 1) * shape.half.y * 0.65,
      core.z + (rand() * 2 - 1) * shape.half.z * 0.5,
      shape.half.x * (0.012 + 0.03 * r * r),
    )
  })
  const cracks: [THREE.Vector4, THREE.Vector4] = [new THREE.Vector4(0, 1, 0, 0), new THREE.Vector4(1, 0, 0, 0)]
  // Opaque, but drawn with the transparent objects so three.js' transmission
  // pre-pass (for other glass) doesn't trace the ice a second time.
  const material = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, ior: IOR, specularIntensity: 0, envMapIntensity: 1, transparent: true })
  // A box inside the solid: within the rounded corners and the taper.
  const corner = 0.423 * Math.max(shape.radiusTop, shape.radiusBottom)
  const narrow = 1 - shape.taper
  const half = shape.half.x
  refractiveSolid(material, {
    sdf: sdfGlsl,
    normal: normalGlsl,
    bump: bumpGlsl,
    inside: insideGlsl(low ? 0 : BUBBLES),
    outside: options.outside,
    bounds: shape.half,
    inner: new THREE.Vector3((shape.half.x - corner) * narrow, shape.half.y - corner, (shape.half.z - corner) * narrow),
    ior: IOR,
    // Thick ice turns faintly blue.
    absorption: [0.11 / half, 0.05 / half, 0.025 / half],
    // Two runs at least: one internal reflection is what draws ice's edges.
    bounces: quality === 'high' ? 3 : 2,
    steps: quality === 'high' ? 5 : 4,
    uniforms: {
      ...options.uniforms,
      iceBox: { value: new THREE.Vector4(shape.half.x, shape.half.y, shape.half.z, shape.radiusBottom) },
      iceShape: { value: new THREE.Vector4(shape.taper, shape.melt, shape.seed, shape.radiusTop) },
      iceCore: { value: core },
      iceCracks: { value: cracks },
      iceBubbles: { value: bubbles },
      iceHaze: { value: 0.085 },
      iceMist: { value: options.mist },
    },
  })
  const mesh = new THREE.Mesh(cubeGeometry(shape, low ? 3 : 5), material)
  return {
    mesh,
    half: shape.half,
    cracks,
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}

export type IceTap = 'clink' | 'crack' | 'shatter'

export interface Ice {
  group: THREE.Group
  /**
   * Where the bottle stands (world) and its scale (px per bottle unit):
   * the ice shows the bottle through itself.
   */
  place(foot: THREE.Vector3, scale: number): void
  /** Rebuilds the cubes for another quality tier (how they are traced). */
  setQuality(quality: Quality): void
  /** The nearest whole cube along a world-space ray, if any. */
  pick(ray: THREE.Ray): { index: number; distance: number } | null
  /**
   * A tap on cube `index`: it clinks and jiggles; tapped again and again a
   * crack runs through it, then a second; the fifth tap breaks it into
   * chips that scatter on the floor in a puff of ice dust.
   */
  tap(index: number): IceTap | null
  /** Moves the chips and the dust; `onHit` when a chip lands (strength 0…1). */
  update(dt: number, time: number, onHit?: (strength: number) => void): void
  dispose(): void
}

// What the rays see in the studio once they leave a cube (world space): the
// bottle — a column of doogh — the black acrylic floor, the studio's light
// strips (its environment map), the key light, and a soft backlight hidden
// behind the set, as drinks photographers light ice to make it glow.
const studioOutside = /* glsl */ `
uniform vec4 iceBottle; // the foot of its axis, its radius
uniform float iceBottleTop;
uniform vec3 iceKey;
uniform vec3 iceSun;
uniform vec3 iceBack;
uniform vec3 iceMilk;
uniform vec3 iceBackdrop;
vec3 iceLights(vec3 d) {
  // Brightest low down, where it skims the floor.
  float back = pow(max(dot(d, normalize(vec3(0.0, 0.12, -1.0))), 0.0), 4.0) * (0.55 + 0.45 * smoothstep(0.4, -0.05, d.y));
  float sun = smoothstep(0.9965, 0.9995, dot(d, iceKey));
  return iceBack * back + iceSun * sun;
}
vec3 solidOutside(vec3 p, vec3 d) {
  vec2 rel = p.xz - iceBottle.xz;
  float A = dot(d.xz, d.xz);
  float B = dot(rel, d.xz);
  float C = dot(rel, rel) - iceBottle.w * iceBottle.w;
  float disc = B * B - A * C;
  if (disc > 0.0 && A > 1e-6) {
    float t = (-B - sqrt(disc)) / A;
    float y = p.y + d.y * t - iceBottle.y;
    if (t > 0.0 && y > 0.0 && y < iceBottleTop) {
      vec2 h = (rel + d.xz * t) / iceBottle.w;
      vec3 n = vec3(h.x, 0.0, h.y);
      float lit = 0.6 + 0.4 * max(dot(n, iceKey), 0.0);
      float edge = 1.0 - 0.5 * pow(1.0 - abs(dot(n, d)), 3.0);
      // Light strips down the glass toward its sides; the thick glass foot, grey-blue.
      float strips = smoothstep(0.72, 0.86, abs(h.x)) * smoothstep(0.99, 0.9, abs(h.x));
      vec3 glass = mix(vec3(0.16, 0.2, 0.25), iceMilk, smoothstep(0.035, 0.06, y / iceBottleTop * 0.6));
      return glass * lit * edge + strips * vec3(1.4);
    }
  }
  if (d.y < 0.0) {
    // The floor: black acrylic, a dim mirror — but at a glancing angle it
    // mirrors the light behind as brightly as the light itself (Fresnel),
    // so it fades in below the glow without a seam — and the light focused
    // through the ice pools beneath it.
    vec3 r = reflect(d, vec3(0.0, 1.0, 0.0));
    float f = 0.04 + 0.96 * pow(1.0 + d.y, 5.0);
    vec2 at = p.xz + d.xz * ((iceBottle.y - p.y) / d.y) - vSolidOrigin.xz;
    float size = length(vSolidBasis[0]) * iceBox.x;
    float pool = exp(-dot(at, at) / (size * size));
    return iceBackdrop + mix(0.38 * f, f, f) * (solidEnvironment(r, 0.03) + iceLights(r)) + iceBack * 0.3 * pool;
  }
  return max(solidEnvironment(d, solidBlur), iceBackdrop) + iceLights(d);
}
`

/** Scatters the cubes around the bottle's foot. */
export function createIce(options: { quality: Quality }): Ice {
  const group = new THREE.Group()
  const world = {
    iceBottle: { value: new THREE.Vector4(0, 0, 0, 1) },
    iceBottleTop: { value: 1 },
    iceKey: { value: new THREE.Vector3(-700, 900, 1200).normalize() },
    iceSun: { value: new THREE.Color('#fff4e6').multiplyScalar(22) },
    iceBack: { value: new THREE.Color('#bcd8f2').multiplyScalar(0.9) },
    iceMilk: { value: new THREE.Color('#ece8dc') },
    iceBackdrop: { value: new THREE.Color('#070b13') },
  }
  const mist = new THREE.Color('#eef4fb').multiplyScalar(1.5)
  // Around the foot, mostly in front and to the sides (the camera's view),
  // clear of where the cap lands (left, at about x −0.4, z 0.13). Tray ice
  // is about 3 cm across: roughly 0.14 of the bottle's height.
  // [x, z, size, turn, cloud]
  const spots: Array<[number, number, number, number, number]> = [
    [-0.23, 0.16, 0.145, 0.5, 1],
    [0.22, 0.19, 0.135, -0.3, 0.7],
    [0.02, 0.33, 0.105, 0.15, 0.15],
    [-0.27, -0.12, 0.125, 1.1, 0.8],
    [0.27, -0.1, 0.12, 0.7, 0.5],
    [0.2, 0.41, 0.075, -0.6, 0.3],
  ]
  // What taps have done, kept across rebuilds for another tier.
  const hits = spots.map(() => 0)
  const broken = spots.map(() => false)
  const crackRun = spots.map(() => [0, 0])
  const crackTo = spots.map(() => [0, 0])
  const jiggle = spots.map(() => 0)
  const rest: THREE.Euler[] = []
  let cubes: IceCube[] = []
  let built: Quality = options.quality
  const build = (quality: Quality, force = false) => {
    if (quality === built && !force) return
    built = quality
    for (const c of cubes) {
      group.remove(c.mesh)
      c.dispose()
    }
    cubes = []
    const rand = seededRandom(11)
    // The same six cubes on every tier: only how they are traced changes.
    for (const [i, [x, z, size, turn, cloud]] of spots.entries()) {
      const cube = createIceCube({ size, quality, seed: 1 + i * 7.31, cloud, mist, outside: studioOutside, uniforms: world })
      cubes.push(cube)
      const { mesh } = cube
      mesh.rotation.set((rand() - 0.5) * 0.08, turn, (rand() - 0.5) * 0.08)
      rest[i] = mesh.rotation.clone()
      // Resting on the floor (sunk a hair, as melting ice sits in its own water).
      mesh.updateMatrix()
      let lowest = Infinity
      const v = new THREE.Vector3()
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < pos.count; k++) lowest = Math.min(lowest, v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrix).y)
      mesh.position.set(x, -lowest - size * 0.004, z)
      mesh.visible = !broken[i]
      // Each cube cracks along its own two planes.
      const a = rand() * Math.PI
      cube.cracks[0].set(Math.cos(a) * 0.8, 0.45, Math.sin(a) * 0.8, crackRun[i]![0]!).setW(crackRun[i]![0]!)
      cube.cracks[1].set(Math.sin(a) * 0.5, -0.7, -Math.cos(a) * 0.5, crackRun[i]![1]!).setW(crackRun[i]![1]!)
      for (const k of cube.cracks) {
        const w = k.w
        k.setW(0).normalize().setW(w)
      }
      group.add(mesh)
    }
  }
  build(options.quality, true)

  // Broken cubes: chips with real gravity that bounce and come to rest, and
  // a puff of dust that settles and fades.
  const G = 42 // ≈ 9 m/s² at 21.6 cm per bottle unit
  interface Chip {
    cube: IceCube
    vel: THREE.Vector3
    spin: THREE.Vector3
    resting: boolean
    /** Times it has struck the floor (each one sounds). */
    hits: number
    /** Seconds since it broke off. */
    age: number
    /** How high it has risen above the floor since it last touched it. */
    peak: number
  }
  const chips: Chip[] = []
  interface Dust {
    points: THREE.Points
    vel: Float32Array
    age: number
  }
  const dusts: Dust[] = []
  const disc = document.createElement('canvas')
  disc.width = disc.height = 32
  {
    const g = disc.getContext('2d')!
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.45, 'rgba(255,255,255,0.7)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 32, 32)
  }
  const discTexture = new THREE.CanvasTexture(disc)
  const dustMaterial = new THREE.PointsMaterial({ color: '#f4f8ff', map: discTexture, size: 3.2, sizeAttenuation: false, transparent: true, depthWrite: false })
  const rand = seededRandom(23)
  const shatter = (i: number) => {
    const c = cubes[i]!
    broken[i] = true
    c.mesh.visible = false
    const center = c.mesh.position.clone()
    const size = spots[i]![2]
    for (let k = 0; k < 6; k++) {
      const chip = createIceCube({ size: size * (0.3 + rand() * 0.24), quality: built, seed: 50 + i * 13 + k * 1.7, cloud: rand() * 0.3, mist, outside: studioOutside, uniforms: world })
      chip.mesh.layers.mask = c.mesh.layers.mask
      const out = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize()
      chip.mesh.position.copy(center).addScaledVector(out, size * 0.25 * rand()).setY(center.y + (rand() - 0.3) * size * 0.3)
      chip.mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
      group.add(chip.mesh)
      chips.push({
        cube: chip,
        vel: out.multiplyScalar(0.45 + rand() * 0.6).setY(0.35 + rand() * 0.55),
        spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(26),
        resting: false,
        hits: 0,
        age: 0,
        peak: 1,
      })
    }
    const n = 90
    const positions = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2
      const r = rand() * size * 0.35
      positions.set([Math.cos(a) * r, (rand() - 0.2) * size * 0.4, Math.sin(a) * r], k * 3)
      const sp = 0.15 + rand() * 0.55
      vel.set([Math.cos(a) * sp, 0.15 + rand() * 0.6, Math.sin(a) * sp], k * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const points = new THREE.Points(geometry, dustMaterial.clone())
    points.position.copy(center)
    points.frustumCulled = false
    group.add(points)
    dusts.push({ points, vel, age: 0 })
  }

  const local = new THREE.Ray()
  const inverse = new THREE.Matrix4()
  const box = new THREE.Box3()
  const hit = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const axis = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const dq = new THREE.Quaternion()
  return {
    group,
    place(foot, scale) {
      world.iceBottle.value.set(foot.x, foot.y, foot.z, 0.145 * scale)
      world.iceBottleTop.value = 0.6 * scale
    },
    setQuality: (quality) => build(quality),
    pick(ray) {
      let best: { index: number; distance: number } | null = null
      if (!group.visible) return null
      cubes.forEach((c, i) => {
        if (broken[i]) return
        inverse.copy(c.mesh.matrixWorld).invert()
        local.copy(ray).applyMatrix4(inverse)
        box.min.copy(c.half).negate()
        box.max.copy(c.half)
        if (!local.intersectBox(box, hit)) return
        const distance = hit.applyMatrix4(c.mesh.matrixWorld).distanceTo(ray.origin)
        if (!best || distance < best.distance) best = { index: i, distance }
      })
      return best
    },
    tap(index) {
      if (broken[index] || !cubes[index]) return null
      const n = ++hits[index]!
      jiggle[index] = 1
      if (n >= 5) {
        shatter(index)
        return 'shatter'
      }
      if (n === 3 || n === 4) {
        crackTo[index]![n - 3] = 1
        return 'crack'
      }
      return 'clink'
    },
    update(dt, time, onHit) {
      cubes.forEach((c, i) => {
        // A tapped cube rocks on its base for a moment.
        if (jiggle[i]! > 0.001) {
          jiggle[i]! *= Math.exp(-dt * 9)
          const r = rest[i]!
          c.mesh.rotation.set(r.x + Math.sin(time * 47) * 0.05 * jiggle[i]!, r.y, r.z + Math.cos(time * 41) * 0.05 * jiggle[i]!)
        }
        // A crack runs through in a fraction of a second.
        for (let k = 0; k < 2; k++) {
          const run = crackRun[i]!
          if (run[k]! < crackTo[i]![k]!) {
            run[k] = Math.min(crackTo[i]![k]!, run[k]! + dt / 0.16)
            c.cracks[k]!.w = run[k]!
          }
        }
      })
      for (const chip of chips) {
        if (chip.resting) continue
        const m = chip.cube.mesh
        chip.vel.y -= G * dt
        m.position.addScaledVector(chip.vel, dt)
        const w = chip.spin.length()
        if (w > 1e-4) {
          dq.setFromAxisAngle(axis.copy(chip.spin).divideScalar(w), w * dt)
          m.quaternion.premultiply(dq).normalize()
        }
        // Chips don't pass through the bottle or the cubes still whole: in
        // plan, push them out and turn their slide away.
        const r = chip.cube.half.x
        const push = (cx: number, cz: number, radius: number) => {
          const dx = m.position.x - cx
          const dz = m.position.z - cz
          const d = Math.hypot(dx, dz)
          const min = radius + r
          if (d >= min || d < 1e-6) return
          m.position.x = cx + (dx / d) * min
          m.position.z = cz + (dz / d) * min
          const along = (chip.vel.x * dx + chip.vel.z * dz) / d
          if (along < 0) {
            chip.vel.x -= 1.6 * along * (dx / d)
            chip.vel.z -= 1.6 * along * (dz / d)
          }
        }
        push(0, 0, 0.15)
        cubes.forEach((c, j) => {
          if (!broken[j]) push(c.mesh.position.x, c.mesh.position.z, Math.max(c.half.x, c.half.z) * 1.05)
        })
        // Lowest point of the turned chip: its box's extent along the vertical.
        m.updateMatrix()
        const e = m.matrix.elements
        const h = chip.cube.half
        const reach = Math.abs(e[1]!) * h.x + Math.abs(e[5]!) * h.y + Math.abs(e[9]!) * h.z
        chip.peak = Math.max(chip.peak, m.position.y - reach)
        chip.age += dt
        if (m.position.y < reach) {
          m.position.y = reach
          const impact = -chip.vel.y
          // A real bounce only — the chip came down from a height. Lying on
          // the floor, one frame of gravity pulls it into the floor again and
          // again; counting that as a bounce made it clink every frame, a
          // continuous sound. Two or three strikes, then it lies still.
          const bounce = chip.peak > 0.0015 && impact > 0.4 && chip.hits < 3 && chip.age < 1.5
          chip.peak = 0
          if (bounce) {
            chip.hits++
            onHit?.(Math.min(1, impact / 2.5))
            chip.vel.y = impact * 0.3
            chip.vel.x *= 0.55
            chip.vel.z *= 0.55
            chip.spin.multiplyScalar(0.5)
          } else {
            // Down: settle on its nearest face.
            chip.vel.set(0, 0, 0)
            chip.spin.set(0, 0, 0)
            let best = 0
            let dir = 1
            for (let a = 0; a < 3; a++) {
              const y = e[a * 4 + 1]!
              if (Math.abs(y) > Math.abs(e[best * 4 + 1]!)) best = a
            }
            dir = Math.sign(e[best * 4 + 1]!) || 1
            axis.set(e[best * 4]!, e[best * 4 + 1]!, e[best * 4 + 2]!).normalize().multiplyScalar(dir)
            q.setFromUnitVectors(axis, up)
            m.quaternion.premultiply(q)
            m.updateMatrix()
            const f = m.matrix.elements
            m.position.y = (Math.abs(f[1]!) * h.x + Math.abs(f[5]!) * h.y + Math.abs(f[9]!) * h.z) * 0.98
            chip.resting = true
          }
        }
      }
      for (let i = dusts.length - 1; i >= 0; i--) {
        const d = dusts[i]!
        d.age += dt
        const pos = d.points.geometry.attributes.position as THREE.BufferAttribute
        const a = pos.array as Float32Array
        const drag = Math.exp(-dt * 2.6)
        for (let k = 0; k < a.length; k += 3) {
          d.vel[k + 1]! -= 2.4 * dt
          for (let j = 0; j < 3; j++) d.vel[k + j]! *= drag
          a[k]! += d.vel[k]! * dt
          a[k + 1]! += d.vel[k + 1]! * dt
          a[k + 2]! += d.vel[k + 2]! * dt
          if (a[k + 1]! + d.points.position.y < 0.002) {
            a[k + 1] = 0.002 - d.points.position.y
            d.vel[k] = d.vel[k + 1] = d.vel[k + 2] = 0
          }
        }
        pos.needsUpdate = true
        ;(d.points.material as THREE.PointsMaterial).opacity = 0.9 * (1 - THREE.MathUtils.smoothstep(d.age, 0.5, 1.8))
        if (d.age > 1.8) {
          group.remove(d.points)
          d.points.geometry.dispose()
          ;(d.points.material as THREE.Material).dispose()
          dusts.splice(i, 1)
        }
      }
    },
    dispose() {
      for (const c of cubes) c.dispose()
      for (const c of chips) c.cube.dispose()
      for (const d of dusts) {
        d.points.geometry.dispose()
        ;(d.points.material as THREE.Material).dispose()
      }
      dustMaterial.dispose()
      discTexture.dispose()
    },
  }
}
