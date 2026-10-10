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
  /** Melt: amplitude of the faces' gentle unevenness. */
  ripple: number
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
  const u = s.seed
  const ripple = s.ripple * Math.sin((x / s.half.x) * 2.3 + u) * Math.sin((y / s.half.x) * 2.1 + u * 1.7) * Math.sin((z / s.half.x) * 2.5 + u * 2.3)
  return (outside + Math.min(Math.max(dx, dy, dz), 0) - r) * Math.min(k, 1) - ripple
}
const sdfGlsl = /* glsl */ `
uniform vec4 iceBox;   // half extents; corner radius at the bottom
uniform vec4 iceShape; // taper, ripple, seed, corner radius at the top
float solidSdf(vec3 p) {
  float k = 1.0 - iceShape.x * (0.5 - 0.5 * clamp(p.y / iceBox.y, -1.0, 1.0));
  float r = mix(iceBox.w, iceShape.w, smoothstep(-iceBox.y, iceBox.y, p.y));
  vec3 d = vec3(abs(p.x / k), abs(p.y), abs(p.z / k)) - (iceBox.xyz - r);
  vec3 q = p / iceBox.x;
  float u = iceShape.z;
  float ripple = iceShape.y * sin(q.x * 2.3 + u) * sin(q.y * 2.1 + u * 1.7) * sin(q.z * 2.5 + u * 2.3);
  return (length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r) * min(k, 1.0) - ripple;
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
// Melting faces: fine waves too small for the mesh (a few sines: noise
// would cost far more, evaluated at every bounce).
const bumpGlsl = /* glsl */ `
vec3 solidBump(vec3 p, vec3 n) {
  vec3 q = p / iceBox.x * 6.0 + iceShape.z;
  vec3 g = vec3(sin(q.y * 1.3 + q.z * 0.7), sin(q.z * 1.1 - q.x * 0.9 + 1.7), sin(q.x * 1.2 + q.y * 0.8 + 3.1)) * 0.045
    + vec3(sin(q.z * 3.7 + q.y * 2.1), sin(q.x * 3.3 - q.z * 2.9 + 0.6), sin(q.y * 3.9 + q.x * 2.3 + 2.2)) * 0.016;
  return normalize(n + g - n * dot(g, n));
}
`
const BUBBLES = 8
const insideGlsl = (bubbles: number) => /* glsl */ `
uniform vec4 iceCore; // center of the cloudy heart; its density (per half size)
uniform vec4 iceBubbles[${BUBBLES}]; // center, radius
uniform float iceHaze; // faint scattering everywhere (per half size)
uniform vec3 iceMist;
// The cloudy heart: air pushed to the middle as the water froze from the
// outside in — uneven and wispy (sines, not noise: it is sampled a lot).
float iceCloud(vec3 q) {
  vec3 u = (q - iceCore.xyz) / (iceBox.xyz * vec3(0.55, 0.72, 0.55));
  float r2 = dot(u, u);
  if (r2 > 1.0) return 0.0;
  vec3 w = q / iceBox.x * 3.0 + iceShape.z;
  float wisp = 0.6 + 0.4 * sin(w.x * 2.1 + sin(w.y * 3.3) * 1.6) * sin(w.z * 2.7 + sin(w.x * 2.9 + w.y) * 1.6);
  return (1.0 - r2) * (1.0 - r2) * wisp;
}
void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through) {
  float depth = iceHaze * len / iceBox.x;
  // The heart and the bubbles along the way in; the faint haze on every run.
  if (bounce == 0) {
    float h = len / 4.0;
    float cloud = 0.0;
    for (int i = 0; i < 4; i++) cloud += iceCloud(p + d * (h * (float(i) + 0.5)));
    depth += iceCore.w * cloud * h / iceBox.x;
  }
  float a = 1.0 - exp(-depth);
  light += through * a * iceMist;
  through *= 1.0 - a;
  if (bounce > 0) return;
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

/** A rounded box projected onto the solid, its vertices crowded toward the edges where it curves. */
function cubeGeometry(s: Shape, segments: number): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry = new THREE.BoxGeometry(2, 2, 2, segments, segments, segments)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const normals = new Float32Array(pos.count * 3)
  const r = (s.radiusTop + s.radiusBottom) / 2
  const inner = new THREE.Vector3(s.half.x - r, s.half.y - r, s.half.z - r)
  const p = new THREE.Vector3()
  const c = new THREE.Vector3()
  const g = new THREE.Vector3()
  const warp = (t: number) => Math.sin((t * Math.PI) / 2)
  const e = s.half.x * 1e-3
  const grad = (q: THREE.Vector3) =>
    g.set(
      sdf(s, q.x + e, q.y, q.z) - sdf(s, q.x - e, q.y, q.z),
      sdf(s, q.x, q.y + e, q.z) - sdf(s, q.x, q.y - e, q.z),
      sdf(s, q.x, q.y, q.z + e) - sdf(s, q.x, q.y, q.z - e),
    ).normalize()
  for (let i = 0; i < pos.count; i++) {
    p.set(warp(pos.getX(i)) * s.half.x, warp(pos.getY(i)) * s.half.y, warp(pos.getZ(i)) * s.half.z)
    c.copy(p).clamp(inner.clone().negate(), inner)
    p.sub(c).normalize().multiplyScalar(r).add(c)
    // Onto the solid itself (taper and melt): a few Newton steps.
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
    ripple: size * 0.012,
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
  // Opaque, but drawn with the transparent objects so three.js' transmission
  // pre-pass (for other glass) doesn't trace the ice a second time.
  const material = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, ior: IOR, specularIntensity: 0, envMapIntensity: 1, transparent: true })
  const margin = shape.ripple * 2
  // A box inside the solid: within the rounded corners, the taper and the melt.
  const corner = 0.423 * Math.max(shape.radiusTop, shape.radiusBottom)
  const narrow = 1 - shape.taper
  const half = shape.half.x
  refractiveSolid(material, {
    sdf: sdfGlsl,
    normal: normalGlsl,
    bump: low ? undefined : bumpGlsl,
    inside: insideGlsl(low ? 0 : BUBBLES),
    outside: options.outside,
    bounds: new THREE.Vector3(shape.half.x + margin, shape.half.y + margin, shape.half.z + margin),
    inner: new THREE.Vector3((shape.half.x - corner) * narrow - shape.ripple, shape.half.y - corner - shape.ripple, (shape.half.z - corner) * narrow - shape.ripple),
    ior: IOR,
    // Thick ice turns faintly blue.
    absorption: [0.11 / half, 0.05 / half, 0.025 / half],
    bounces: low ? 1 : quality === 'high' ? 3 : 2,
    steps: quality === 'high' ? 6 : 5,
    uniforms: {
      ...options.uniforms,
      iceBox: { value: new THREE.Vector4(shape.half.x, shape.half.y, shape.half.z, shape.radiusBottom) },
      iceShape: { value: new THREE.Vector4(shape.taper, shape.ripple, shape.seed, shape.radiusTop) },
      iceCore: { value: core },
      iceBubbles: { value: bubbles },
      iceHaze: { value: 0.085 },
      iceMist: { value: options.mist },
    },
  })
  const mesh = new THREE.Mesh(cubeGeometry(shape, low ? 14 : 22), material)
  return {
    mesh,
    half: shape.half,
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}

export interface Ice {
  group: THREE.Group
  /**
   * Where the bottle stands (world) and its scale (px per bottle unit):
   * the ice shows the bottle through itself.
   */
  place(foot: THREE.Vector3, scale: number): void
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
  const low = options.quality === 'low'
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
  const rand = seededRandom(11)
  const cubes: IceCube[] = []
  for (const [i, [x, z, size, turn, cloud]] of spots.slice(0, low ? 4 : spots.length).entries()) {
    const cube = createIceCube({ size, quality: options.quality, seed: 1 + i * 7.31, cloud, mist, outside: studioOutside, uniforms: world })
    cubes.push(cube)
    const { mesh } = cube
    mesh.rotation.set((rand() - 0.5) * 0.08, turn, (rand() - 0.5) * 0.08)
    // Resting on the floor (sunk a hair, as melting ice sits in its own water).
    mesh.updateMatrix()
    let lowest = Infinity
    const v = new THREE.Vector3()
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
    for (let k = 0; k < pos.count; k++) lowest = Math.min(lowest, v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrix).y)
    mesh.position.set(x, -lowest - size * 0.004, z)
    group.add(mesh)
  }
  return {
    group,
    place(foot, scale) {
      world.iceBottle.value.set(foot.x, foot.y, foot.z, 0.145 * scale)
      world.iceBottleTop.value = 0.6 * scale
    },
    dispose() {
      for (const c of cubes) c.dispose()
    },
  }
}
