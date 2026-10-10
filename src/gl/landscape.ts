/**
 * «آخیش»: a winter morning in the Central Alborz. A snowy valley between
 * rocky ridges with a lone volcanic cone far off, sunlight and shadows baked
 * once from the height field, aerial haze, a cold sky and falling snow.
 * Units: metres. The camera flies up the valley as the chapter scrolls.
 */
import * as THREE from 'three'
import { heightfield, seededRandom, type HeightfieldMesh } from '@veyra/core'
import { glslHash, glslNoiseTexture } from '@veyra/core/glsl'
import { meshGeometry, noiseTexture } from '@veyra/core/three'
import { CONE, SIZE, SUN_DIR, valleyX } from './alborz'
import type { Quality } from './studio'

export interface Landscape {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Scroll progress through the chapter 0…1. */
  progress: number
  /** Follow the quality tier: the low tier draws a lean terrain without fine relief. */
  setQuality(quality: Quality): void
  update(dt: number, time: number, width: number, height: number, reduced: boolean, pointer?: { snx: number; sny: number; vx: number; vy: number } | null): void
  dispose(): void
}

const SUN = new THREE.Vector3(...SUN_DIR).normalize()

const terrainVertex = /* glsl */ `
  attribute float aSun;
  attribute float aOcclusion;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vSun;
  varying float vOcclusion;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vSun = aSun;
    vOcclusion = aOcclusion;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const atmosphere = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uHorizonSun;
  vec3 skyColor(vec3 dir) {
    float h = dir.y;
    // The horizon warms toward the low sun and stays cool away from it.
    vec2 across = normalize(dir.xz + 1e-5);
    float toward = pow(max(dot(across, normalize(uSunDir.xz)), 0.0), 3.0);
    vec3 horizon = mix(uHorizon, uHorizonSun, toward);
    vec3 col = mix(horizon, uZenith, pow(smoothstep(-0.03, 0.75, h), 0.5));
    float s = max(dot(dir, uSunDir), 0.0);
    col += uSunColor * (pow(s, 6.0) * 0.3 + pow(s, 40.0) * 0.45);
    // Below the horizon: the haze of the far valley.
    col = mix(col, horizon * 0.96, smoothstep(0.0, -0.12, h));
    return col;
  }
`

/** Noise cells per side of the noise texture every shader here reads. */
const CELLS = 8

const terrainFragment = /* glsl */ `
  ${glslHash}
  ${glslNoiseTexture}
  ${atmosphere}
  uniform sampler2D uNoise;
  uniform vec3 uCamPos;
  uniform float uHaze;
  uniform float uValleyMist;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vSun;
  varying float vOcclusion;
  const float CELLS = ${CELLS}.0;
  // Noise on the surface without stretching on steep faces (triplanar),
  // read from the noise texture.
  float surface(vec3 p, vec3 n, int octaves) { return tfbm(uNoise, CELLS, p, n, octaves); }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = vWorld - uCamPos;
    float dist = length(view);
    vec3 dir = view / dist;
    float near = 1.0 - smoothstep(1500.0, 9000.0, dist);
    float mid = 1.0 - smoothstep(6000.0, 22000.0, dist);
    float slope = 1.0 - n.y;
  #ifdef LITE
    // The low tier (and software rendering): broad snow fields, no fine relief.
    vec3 nd = n;
    float big = tfbm(uNoise, CELLS, vWorld.xz * 0.0011, 2) * 0.5 + 0.5;
    float fine = 0.5;
    float crag = 0.7;
    float strata = 0.5;
  #else
    // Relief at two scales — rock and drift close by, ribs and gullies
    // further off — bumped with the noise's own gradient (metres of height).
    vec4 rocky = tfbmd(uNoise, CELLS, vWorld * 0.014, n, 3);
    vec4 ribs = tfbmd(uNoise, CELLS, vWorld * 0.0028, n, 3);
    vec3 g = rocky.yzw * (0.014 * 34.0) * (1.0 - n.y * 0.6) * near + ribs.yzw * (0.0028 * 100.0) * mid;
    vec3 nd = normalize(n - (g - n * dot(g, n)));
    float big = tfbm(uNoise, CELLS, vWorld.xz * 0.0011, 3) * 0.5 + 0.5;
    float fine = rocky.x * 0.5 + 0.5;
    // Crags, and the strata of folded sedimentary rock on the faces.
    float crag = 1.0 - abs(surface(vWorld * 0.05, n, 2));
    float warp = tfbm(uNoise, CELLS, vWorld.xz * 0.003, 2);
    float strata = tfbm(uNoise, CELLS, vec2(vWorld.y * 0.045 + warp * 1.5, (vWorld.x + vWorld.z) * 0.0005 + 3.7), 2) * 0.5 + 0.5;
  #endif
    // Snow holds where it's flat enough; rock shows on steep faces and
    // ridges. The edge is crisp close by, softer far off.
    float hold = mix(0.26, 0.42, smoothstep(600.0, 3600.0, vWorld.y));
    float edge = mix(0.11, 0.05, near);
    float cover = slope + (big - 0.5) * 0.28 + (fine - 0.5) * 0.14;
    float snow = smoothstep(hold + edge, hold - edge, cover);
    vec3 rock = mix(vec3(0.1, 0.095, 0.1), vec3(0.28, 0.26, 0.25), fine);
    rock = mix(rock, vec3(0.42, 0.38, 0.34), smoothstep(0.6, 0.9, big) * 0.4);
    // Banded, broken rock: lighter and darker layers, crags catching the light.
    rock *= (0.88 + 0.24 * strata * mid) * (0.78 + 0.4 * crag * near + 0.2 * (1.0 - near));
    vec3 albedo = mix(rock, vec3(0.86, 0.89, 0.94), snow);
    float ndl = max(dot(nd, uSunDir), 0.0);
    float sun = ndl * vSun;
    vec3 skyLight = mix(uZenith, uHorizon, 0.3) * (0.55 + 0.45 * nd.y) * mix(0.35, 1.0, vOcclusion);
    vec3 col = albedo * (uSunColor * sun * 2.3 + skyLight * 0.82);
    // Snow in shade glows blue from the sky; lit snow sparkles a little.
    col += snow * (1.0 - sun) * vec3(0.02, 0.05, 0.12) * vOcclusion;
    col += snow * sun * pow(max(dot(reflect(dir, nd), uSunDir), 0.0), 40.0) * 0.25;
  #ifndef LITE
    // Fresh snow in low sun: now and then a crystal catches it and flashes
    // as the camera moves.
    vec3 crystal = floor(vWorld * 0.7);
    float glint = step(0.9972, hash13(crystal)) * pow(max(dot(reflect(dir, nd), uSunDir), 0.0), 3.0);
    col += vec3(1.0, 0.95, 0.86) * glint * snow * sun * smoothstep(9000.0, 1500.0, dist) * 3.0;
  #endif
    // Aerial perspective, plus mist pooled in the valley.
    float haze = 1.0 - exp(-dist * uHaze);
    float mist = exp(-max(0.0, vWorld.y - 80.0) * 0.004) * smoothstep(2500.0, 8000.0, dist) * uValleyMist;
  #ifndef LITE
    // Wind-packed ripples and the odd stone in the near snow.
    float ripple = tfbm(uNoise, CELLS, vWorld.xz * vec2(0.09, 0.035), 2);
    col *= 1.0 + ripple * 0.06 * snow * near;
    float stones = smoothstep(0.76, 0.8, tfbm(uNoise, CELLS, vWorld.xz * 0.018 + 9.0, 3) * 0.5 + 0.5) * snow * near * (1.0 - slope);
    col = mix(col, rock * (skyLight * 0.6 + uSunColor * sun), stones * 0.85);
  #endif
    vec3 air = skyColor(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3, dir.z)));
    col = mix(col, air, clamp(haze + mist, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`
const skyFragment = /* glsl */ `
  ${glslNoiseTexture}
  ${atmosphere}
  uniform sampler2D uNoise;
  uniform float uTime;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = skyColor(dir);
    // A few high, thin clouds, lit warm on the side of the sun.
    if (dir.y > 0.0) {
      vec2 p = dir.xz / (dir.y + 0.15) * 1.6 + vec2(uTime * 0.004, 0.0);
    #ifdef LITE
      const int octaves = 2;
    #else
      const int octaves = 5;
    #endif
      float c = smoothstep(0.42, 0.88, tfbm(uNoise, ${CELLS}.0, p, octaves) * 0.5 + 0.5) * smoothstep(0.0, 0.25, dir.y);
      float lit = pow(max(dot(normalize(dir.xz + 1e-5), normalize(uSunDir.xz)), 0.0), 2.0);
      col = mix(col, mix(vec3(0.93, 0.95, 0.98), vec3(1.0, 0.86, 0.72), lit * 0.8), c * 0.36);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const snowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform vec3 uBox;
  uniform vec3 uCenter;
  uniform vec2 uWind;
  uniform vec2 uHand;
  uniform vec2 uGust;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float fall = 1.1 + aSeed * 0.9;
    p.y = mod(p.y - uTime * fall * 9.0, uBox.y);
    p.x = mod(p.x + uTime * uWind.x * (0.6 + aSeed) + sin(uTime * 0.7 + aSeed * 30.0) * 2.0, uBox.x);
    p.z = mod(p.z + uTime * uWind.y, uBox.z);
    // Keep the box around the camera.
    vec3 world = uCenter + p - uBox * 0.5;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    // The hand's movement blows the nearest flakes aside, nearer ones more.
    vec2 ndc = gl_Position.xy / gl_Position.w;
    float reach = exp(-dot(ndc - uHand, ndc - uHand) * 9.0) * (0.5 + aSeed);
    gl_Position.xy += uGust * reach * gl_Position.w;
    float depth = -mv.z;
    gl_PointSize = uSize * (0.6 + aSeed) / max(depth, 1.0);
    vAlpha = smoothstep(2.0, 12.0, depth) * (1.0 - smoothstep(uBox.z * 0.35, uBox.z * 0.5, depth));
  }
`
const snowFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(c)) * vAlpha * 0.85;
    gl_FragColor = vec4(vec3(1.0) * a, a);
  }
`

export async function createLandscape(renderer: THREE.WebGLRenderer, quality: Quality): Promise<Landscape> {
  // The terrain is baked in a worker: heights, sunlight, occlusion, mesh.
  const baked = await new Promise<{ heights: Float32Array; res: number; mesh: HeightfieldMesh }>((resolve, reject) => {
    const worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (e) => {
      reject(new Error(e.message))
      worker.terminate()
    }
    worker.postMessage({ quality })
  })
  const field = heightfield({ size: [SIZE, SIZE], resolution: baked.res, heights: baked.heights })
  const geometry = meshGeometry(baked.mesh)
  // Draw the near rows first, so ridges in front hide what is behind them
  // before it is shaded (the camera looks up the valley, toward −z).
  const index = geometry.index!.array
  const tris = index.length / 3
  for (let a = 0, b = tris - 1; a < b; a++, b--) {
    for (let k = 0; k < 3; k++) {
      const t = index[a * 3 + k]!
      index[a * 3 + k] = index[b * 3 + k]!
      index[b * 3 + k] = t
    }
  }

  // Rock, drift and cloud detail are read from a baked noise texture: a few
  // texture reads per pixel instead of dozens of noise hashes.
  const noise = noiseTexture({ size: 256, cells: CELLS, seed: 7 })
  noise.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy())
  const common = {
    uNoise: { value: noise },
    uSunDir: { value: SUN.clone() },
    // Early light: warm on the snow, the sky deep overhead, cold in the shade.
    uSunColor: { value: new THREE.Color('#ffd3a3') },
    uZenith: { value: new THREE.Color('#1c4a93') },
    uHorizon: { value: new THREE.Color('#b9cfe6') },
    uHorizonSun: { value: new THREE.Color('#f3d2b0') },
  }
  const camPos = { value: new THREE.Vector3() }
  const terrainMaterial = new THREE.ShaderMaterial({
    vertexShader: terrainVertex,
    fragmentShader: terrainFragment,
    uniforms: { ...common, uCamPos: camPos, uHaze: { value: 0.00002 }, uValleyMist: { value: 0.38 } },
  })
  const terrain = new THREE.Mesh(geometry, terrainMaterial)
  terrain.frustumCulled = false

  const skyTime = { value: 0 }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: skyVertex, fragmentShader: skyFragment, uniforms: { ...common, uTime: skyTime }, side: THREE.BackSide, depthWrite: false }),
  )
  sky.frustumCulled = false
  sky.renderOrder = -10

  // Falling snow in a box that travels with the camera.
  const flakes = quality === 'high' ? 2600 : quality === 'medium' ? 1600 : 800
  const box = new THREE.Vector3(140, 90, 220)
  const rand = seededRandom(31)
  const pos = new Float32Array(flakes * 3)
  const seeds = new Float32Array(flakes)
  for (let i = 0; i < flakes; i++) {
    pos[i * 3] = rand() * box.x
    pos[i * 3 + 1] = rand() * box.y
    pos[i * 3 + 2] = rand() * box.z
    seeds[i] = rand()
  }
  const snowGeo = new THREE.BufferGeometry()
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const snowUniforms = {
    uTime: { value: 0 },
    uSize: { value: 260 },
    uBox: { value: box },
    uCenter: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2(3.5, 1.2) },
    uHand: { value: new THREE.Vector2(0, 0) },
    uGust: { value: new THREE.Vector2(0, 0) },
  }
  const snow = new THREE.Points(
    snowGeo,
    new THREE.ShaderMaterial({
      vertexShader: snowVertex,
      fragmentShader: snowFragment,
      uniforms: snowUniforms,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    }),
  )
  snow.frustumCulled = false

  const scene = new THREE.Scene()
  scene.add(sky, terrain, snow)
  const camera = new THREE.PerspectiveCamera(42, 1, 5, 60000)
  const look = new THREE.Vector3()
  const from = new THREE.Vector3()
  const forward = new THREE.Vector3()
  let drift = 0
  let lookYaw = 0
  let lookPitch = 0
  const gust = new THREE.Vector2()

  // Switching variants recompiles both shaders once.
  const skyMaterial = sky.material as THREE.ShaderMaterial
  let lite: boolean | null = null
  const setQuality = (q: Quality) => {
    const next = q === 'low'
    if (next === lite) return
    lite = next
    for (const m of [terrainMaterial, skyMaterial]) {
      if (lite) m.defines.LITE = ''
      else delete m.defines.LITE
      m.needsUpdate = true
    }
  }
  setQuality(quality)

  const self: Landscape = {
    scene,
    camera,
    progress: 0,
    setQuality,
    update(dt, time, width, height, reduced, pointer) {
      const p = self.progress
      const t = p * p * (3 - 2 * p)
      if (!reduced) drift += dt
      // Up the valley, rising slowly; the cone stays in view.
      const z = THREE.MathUtils.lerp(10400, 7400, t)
      const x = valleyX(z) + THREE.MathUtils.lerp(-200, 200, t)
      const ground = field.sample(x, z)
      from.set(x + Math.sin(drift * 0.25) * 6, ground + THREE.MathUtils.lerp(420, 640, t) + Math.sin(drift * 0.4) * 3, z)
      look.set(THREE.MathUtils.lerp(CONE.x * 0.4, CONE.x * 0.6, t), THREE.MathUtils.lerp(700, 900, t), CONE.z)
      camera.position.copy(from)
      camera.lookAt(look)
      // Look around a little with the pointer.
      const k = 1 - Math.exp(-dt * 2.5)
      lookYaw += ((reduced || !pointer ? 0 : -pointer.snx * 0.045) - lookYaw) * k
      lookPitch += ((reduced || !pointer ? 0 : -pointer.sny * 0.022) - lookPitch) * k
      camera.rotateY(lookYaw)
      camera.rotateX(lookPitch)
      camera.aspect = width / height
      // Portrait screens: widen the view so the cone still fits.
      camera.fov = width / height < 0.8 ? 58 : 40
      camera.updateProjectionMatrix()
      camPos.value.copy(camera.position)
      sky.position.copy(camera.position)
      skyTime.value = time
      snowUniforms.uTime.value = reduced ? 0 : time
      // The gust follows the hand's speed and dies away.
      if (pointer && !reduced) {
        snowUniforms.uHand.value.set(pointer.snx, -pointer.sny)
        gust.x += (pointer.vx / width) * 0.9 * dt * 60 * 0.08
        gust.y += (-pointer.vy / height) * 0.9 * dt * 60 * 0.08
      }
      gust.multiplyScalar(Math.exp(-dt * 2.2))
      gust.clampLength(0, 0.35)
      snowUniforms.uGust.value.copy(gust)
      snowUniforms.uCenter.value.copy(camera.position).addScaledVector(camera.getWorldDirection(forward), 70)
      snow.visible = !reduced
    },
    dispose() {
      geometry.dispose()
      noise.dispose()
      terrainMaterial.dispose()
      sky.geometry.dispose()
      ;(sky.material as THREE.Material).dispose()
      snowGeo.dispose()
      ;(snow.material as THREE.Material).dispose()
    },
  }
  return self
}
