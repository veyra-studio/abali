/**
 * The world: one fullscreen shader that paints every environment of the
 * film — the label, the label becoming Alborz, snowfall, the night of
 * bubbles and the milk flood. Rendered first, opaque, so the glass bottle
 * refracts it; a second instance draws on top for cross-fades.
 *
 * Mountain ridgelines are 1D functions of x, so they are computed once on
 * the CPU into a lookup texture: per pixel the shader does a handful of
 * texture fetches instead of hundreds of noise evaluations.
 */
import * as THREE from 'three'
import { palette } from '../palette'

// ---------------------------------------------------------------------
// Ridge lookup texture
// ---------------------------------------------------------------------
const RIDGE_N = 4096
const RIDGE_X0 = -4
const RIDGE_X1 = 4

function hash(n: number): number {
  const s = Math.sin(n) * 43758.5453123
  return s - Math.floor(s)
}
function noise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return hash(i) + (hash(i + 1) - hash(i)) * u
}
function fbm(x: number, octaves: number): number {
  let v = 0
  let a = 0.5
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x)
    x = x * 2.03 + 17.1
    a *= 0.5
  }
  return v
}
const ridgeBase = (x: number, seed: number, freq: number, amp: number) => (fbm(x * freq + seed, 3) - 0.5) * amp
const ridge = (x: number, seed: number, freq: number, amp: number) => ridgeBase(x, seed, freq, amp) + (fbm(x * freq * 3.1 + seed * 2, 5) - 0.5) * amp * 0.22
const facet = (x: number, seed: number, freq: number, amp: number) => {
  const s = ridgeBase(x + 0.025, seed, freq, amp) - ridgeBase(x - 0.025, seed, freq, amp)
  const t = Math.min(1, Math.max(0, (s + 0.004) / 0.008))
  return t * t * (3 - 2 * t)
}

/** RGBA: far, middle, near, foreground ridge heights. Second texture: middle & near facets. */
function createRidgeTextures(): [THREE.DataTexture, THREE.DataTexture] {
  const heights = new Float32Array(RIDGE_N * 4)
  const facets = new Float32Array(RIDGE_N * 4)
  for (let i = 0; i < RIDGE_N; i++) {
    const x = RIDGE_X0 + ((RIDGE_X1 - RIDGE_X0) * i) / (RIDGE_N - 1)
    heights[i * 4] = -0.06 + ridge(x, 3, 2.2, 0.18)
    heights[i * 4 + 1] = -0.2 + ridge(x, 11, 3.4, 0.22)
    heights[i * 4 + 2] = -0.36 + ridge(x, 23, 2.6, 0.2)
    heights[i * 4 + 3] = -0.5 + ridge(x, 41, 1.1, 0.12)
    facets[i * 4] = facet(x, 11, 3.4, 0.22)
    facets[i * 4 + 1] = facet(x, 23, 2.6, 0.2)
    facets[i * 4 + 2] = noise(x * 40)
    facets[i * 4 + 3] = 1
  }
  const make = (data: Float32Array) => {
    const t = new THREE.DataTexture(data, RIDGE_N, 1, THREE.RGBAFormat, THREE.FloatType)
    t.minFilter = t.magFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }
  return [make(heights), make(facets)]
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uRes;
  uniform vec3 uBlue, uBlueDeep, uSky, uYellow, uNavy, uMilk, uNight, uSnowShade;

  uniform float uLabel;
  uniform sampler2D uLabelTex;
  uniform vec4 uLabelCyl;    // label axis x, label center y (world px from viewport center), radius (px), axis distance from camera (px)
  uniform vec2 uLabelPersp;  // half label height (px), camera distance to the z = 0 plane (px)
  uniform vec4 uSun0;        // the oval on screen at hand-off: center.xy, radii.xy (p-space)
  uniform float uAlpha;
  uniform float uMorph;
  uniform float uTravel;
  uniform float uSnow;
  uniform sampler2D uRidges;
  uniform sampler2D uFacets;

  uniform float uNightMix;
  uniform float uBubbles;
  uniform float uPressure;
  uniform float uBurst;
  uniform vec2 uPointer;     // p-space
  uniform float uMilkMix;

  const float RIDGE_N = ${RIDGE_N.toFixed(1)};
  const float RIDGE_X0 = ${RIDGE_X0.toFixed(1)};
  const float RIDGE_X1 = ${RIDGE_X1.toFixed(1)};

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(float x) {
    float i = floor(x); float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u);
  }
  float aaStep(float edge, float x) {
    float w = fwidth(x) * 1.2;
    return smoothstep(edge - w, edge + w, x);
  }
  float ellipseMask(vec2 p, vec2 c, vec2 r) {
    vec2 q = (p - c) / r;
    float d = length(q) - 1.0;
    float w = fwidth(d) * 1.2;
    return 1.0 - smoothstep(-w, w, d);
  }

  // Linear lookup into a ridge texture (manual, so float textures need no filtering extension).
  vec4 lookup(sampler2D tex, float x) {
    float f = clamp((x - RIDGE_X0) / (RIDGE_X1 - RIDGE_X0), 0.0, 1.0) * (RIDGE_N - 1.0);
    float i = floor(f);
    vec4 a = texelFetch(tex, ivec2(int(i), 0), 0);
    vec4 b = texelFetch(tex, ivec2(int(min(i + 1.0, RIDGE_N - 1.0)), 0), 0);
    return mix(a, b, f - i);
  }

  // A cone with a softened summit — Damavand's silhouette.
  float cone(float x, float cx, float h, float slope) {
    float d = abs(x - cx);
    return h - sqrt(d * d + 0.035 * 0.035) * slope;
  }

  // The label image, found by inverting the camera's perspective projection
  // of the cylindrical label — so the 2D hand-off lines up with the 3D bottle.
  vec3 labelImage(vec2 p, out float inside, out vec3 clean) {
    vec2 X = p * uRes.y;
    float gx = uLabelCyl.x;
    float gy = uLabelCyl.y;
    float rS = uLabelCyl.z;
    float Dz = uLabelCyl.w;
    float hS = uLabelPersp.x;
    float D = uLabelPersp.y;
    float phi = asin(clamp((X.x * (Dz - rS) / D - gx) / rS, -1.0, 1.0));
    for (int i = 0; i < 5; i++) {
      float sp = sin(phi);
      float cp = cos(phi);
      float f = (gx + rS * sp) * D - X.x * (Dz - rS * cp);
      float df = rS * D * cp - X.x * rS * sp;
      phi -= f / (abs(df) > 1e-3 ? df : 1e-3);
    }
    float depth = Dz - rS * cos(phi);
    float v = 0.5 + (X.y * depth / D - gy) / (2.0 * hS);
    float u = 0.5 + phi / radians(170.0);
    inside = step(abs(phi), radians(85.0)) * step(0.0, v) * step(v, 1.0);
    // The same label without its calligraphy, in the same space: the text
    // can dissolve without any seam around the oval or the rule.
    vec2 e = vec2((u - 0.5) / 0.235, (v - 0.5) / 0.37);
    float d = length(e) - 1.0;
    float w = fwidth(d) * 1.2;
    clean = mix(uBlue, uYellow, 1.0 - smoothstep(-w, w, d));
    return texture2D(uLabelTex, vec2(u, v)).rgb;
  }

  vec3 landscape(vec2 p, float aspect, float morph, float travel) {
    float horizonLight = smoothstep(0.55, -0.35, p.y);
    vec3 col = mix(uBlue, mix(uBlue, uSky, 0.75), horizonLight * smoothstep(0.35, 0.9, morph));

    // The oval becomes the sun: it shrinks and climbs.
    float sm = smoothstep(0.08, 0.7, morph);
    vec2 sunC = mix(uSun0.xy, vec2(-0.28 * aspect, 0.27 + travel * 0.05), sm);
    vec2 sunR = mix(uSun0.zw, vec2(0.085, 0.07), sm);
    col = mix(col, uYellow, ellipseMask(p, sunC, sunR));

    // The label's white rule fades away.
    float frameA = 1.0 - smoothstep(0.05, 0.35, morph);
    if (frameA > 0.0) {
      vec2 q = abs(p - uSun0.xy) - vec2(uSun0.z * 1.62, uSun0.w * 1.2);
      float frame = 1.0 - smoothstep(0.0, 0.006, abs(max(q.x, q.y)));
      col = mix(col, vec3(1.0), frame * frameA);
    }

    float rise = smoothstep(0.25, 0.95, morph);
    if (rise <= 0.0) return col;

    // Far range with Damavand.
    {
      float lift = mix(-1.2, 0.0, smoothstep(0.0, 0.75, rise));
      float x = p.x + travel * 0.05;
      float damX = -0.05 * aspect - travel * 0.04;
      float top = max(lookup(uRidges, x).r + lift, cone(x, damX, 0.33 + lift, 1.05));
      float m = 1.0 - aaStep(top, p.y);
      float snowLine = top - 0.11;
      vec3 far = mix(uSky, vec3(1.0), 0.45);
      float n = lookup(uFacets, x).b;
      vec3 snow = mix(far, vec3(1.0), smoothstep(snowLine - 0.02, snowLine + 0.03, p.y + (n - 0.5) * 0.03));
      float lit = step(x, damX);
      snow = mix(mix(snow, uSnowShade, 0.35), snow, mix(0.65, 1.0, lit));
      col = mix(col, snow, m);
    }
    // Middle range: snow catching light at the crest, cooler below.
    {
      float lift = mix(-1.2, 0.0, smoothstep(0.15, 0.85, rise));
      float x = p.x + travel * 0.14;
      float top = lookup(uRidges, x).g + lift;
      float m = 1.0 - aaStep(top, p.y);
      float depthBelow = top - p.y;
      vec3 c = mix(vec3(0.97, 0.985, 1.0), uSnowShade, smoothstep(0.0, 0.22, depthBelow) * 0.85);
      col = mix(col, c, m);
      col = mix(col, uNavy, m * aaStep(top - 0.005, p.y) * 0.4);
    }
    // Near ridge: milk-white crest, blue shadow toward the valley, engraved lines.
    {
      float lift = mix(-1.3, 0.0, smoothstep(0.3, 1.0, rise));
      float x = p.x + travel * 0.3;
      float top = lookup(uRidges, x).b + lift;
      float m = 1.0 - aaStep(top, p.y);
      float depthBelow = top - p.y;
      float shade = smoothstep(0.02, 0.2, depthBelow);
      vec3 c = mix(uMilk, mix(uSnowShade, uBlue, 0.2), shade * 0.9);
      float lines = smoothstep(0.42, 0.5, abs(fract((p.x * 0.55 + p.y) * 48.0) - 0.5));
      c = mix(c, mix(uSnowShade, uNavy, 0.4), lines * shade * 0.45);
      col = mix(col, c, m);
      col = mix(col, uNavy, m * aaStep(top - 0.0045, p.y) * 0.9);
    }
    // Foreground snowfield.
    {
      float lift = mix(-1.4, 0.0, smoothstep(0.45, 1.0, rise));
      float x = p.x + travel * 0.55;
      float top = lookup(uRidges, x).a + lift - travel * 0.04;
      float m = 1.0 - aaStep(top, p.y);
      col = mix(col, uMilk, m);
      col = mix(col, uNavy, m * aaStep(top - 0.004, p.y));
    }
    return col;
  }

  float snowfall(vec2 p, float t) {
    float s = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float scale = 9.0 + fi * 7.0;
      vec2 q = p * scale;
      q.y += t * (0.35 + fi * 0.2) * scale * 0.12;
      q.x += sin(q.y * 0.35 + fi * 3.0 + t * 0.4) * 0.35;
      vec2 id = floor(q);
      vec2 f = fract(q) - 0.5;
      float h = hash2(id + fi * 13.1);
      if (h < 0.55) continue;
      vec2 o = (vec2(hash2(id + 3.1), hash2(id + 7.7)) - 0.5) * 0.6;
      float r = 0.05 + 0.07 * hash2(id + 1.7);
      s += smoothstep(r, r * 0.25, length(f - o)) * (0.55 + fi * 0.2);
    }
    return clamp(s, 0.0, 1.0);
  }

  // Rising carbonation, drawn like printed bubbles: rim, faint body, highlight.
  float bubbleLayer(vec2 p, float scale, float speed, float t, float density, float wobble, out float body) {
    vec2 q = p * scale;
    q.y -= t * speed;
    vec2 id = floor(q);
    vec2 f = fract(q) - 0.5;
    float h = hash2(id);
    body = 0.0;
    if (h > density) return 0.0;
    vec2 o = (vec2(hash2(id + 1.3), hash2(id + 2.7)) - 0.5) * 0.5;
    o.x += sin(t * 2.4 + h * 6.28) * 0.1 * wobble;
    float r = mix(0.12, 0.34, hash2(id + 4.1));
    float d = length(f - o);
    float w = fwidth(d) * 1.3;
    float disc = 1.0 - smoothstep(r - w, r + w, d);
    float inner = 1.0 - smoothstep(r * 0.8 - w, r * 0.8 + w, d);
    float hl = 1.0 - smoothstep(0.0, r * 0.28, length(f - o - vec2(-r * 0.38, r * 0.38)));
    body = disc;
    return clamp(disc - inner + hl, 0.0, 1.0);
  }

  vec3 night(vec2 uv, vec2 p, float aspect) {
    vec3 col = mix(uNight, mix(uNavy, uBlueDeep, 0.25), smoothstep(0.9, -0.6, p.y) * 0.85);
    float glow = exp(-pow(length((uv - vec2(0.5, -0.1)) * vec2(aspect, 1.0)), 2.0) * 1.6);
    col += uBlue * glow * 0.25;
    if (uBubbles <= 0.0) return col;

    // The pointer pushes bubbles aside.
    vec2 toP = p - uPointer;
    float pd = length(toP);
    vec2 pp = p + (pd > 0.0 ? toP / pd : vec2(0.0)) * exp(-pd * pd * 18.0) * 0.06 * (0.4 + uPressure);

    float intensity = uBubbles * (0.55 + uPressure * 0.9);
    float speed = 0.22 + uPressure * 0.9;
    float b1, b2, b3;
    float a = bubbleLayer(pp, 5.0, speed * 3.0, uTime, 0.35 * intensity, 1.0 + uPressure * 2.0, b1);
    float b = bubbleLayer(pp + 3.3, 9.0, speed * 4.5, uTime, 0.45 * intensity, 1.0 + uPressure * 3.0, b2);
    float c = bubbleLayer(pp + 7.1, 16.0, speed * 7.0, uTime, 0.55 * intensity, 1.0 + uPressure * 4.0, b3);
    col = mix(col, mix(col, uMilk, 0.12), max(b1, max(b2, b3)));
    return mix(col, uMilk, clamp(a * 0.95 + b * 0.75 + c * 0.55, 0.0, 1.0));
  }

  // A foam front: milk rising with a bubbly crest.
  float foam(vec2 uv, vec2 p, float level, float t) {
    float edge = level + (noise(p.x * 6.0 + t * 0.7) - 0.5) * 0.06 + (noise(p.x * 23.0 - t * 1.3) - 0.5) * 0.02;
    float m = 1.0 - aaStep(edge, uv.y);
    vec2 q = vec2(p.x * 18.0, (uv.y - edge) * 18.0);
    vec2 id = floor(q);
    float r = 0.25 + 0.25 * hash2(id);
    float crest = (1.0 - smoothstep(r - 0.05, r + 0.05, length(fract(q) - 0.5))) * step(abs(uv.y - edge), 0.05);
    return clamp(m + crest * step(hash2(id + 9.0), 0.6), 0.0, 1.0);
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec3 col = uBlue;

    if (uNightMix < 1.0) {
      // Label → landscape.
      float grain = (hash2(floor(p * 260.0)) - 0.5) * 0.1;
      float dissolve = smoothstep(0.0, 0.12, uMorph + grain);
      float handover = smoothstep(0.1, 0.24, uMorph);
      vec3 img = uBlue;
      if (handover < 1.0) {
        float inside;
        vec3 clean;
        vec3 tex = labelImage(p, inside, clean);
        img = mix(uBlue, mix(tex, clean, dissolve), inside);
      }
      vec3 land = landscape(p, aspect, uMorph, uTravel);
      col = mix(img, land, handover);
      if (uSnow > 0.0) col = mix(col, vec3(1.0), snowfall(p, uTime) * uSnow);
    }
    if (uNightMix > 0.0) col = mix(col, night(uv, p, aspect), uNightMix);
    if (uBurst > -0.15) col = mix(col, uMilk, foam(uv, p, uBurst, uTime));
    if (uMilkMix > -0.15) col = mix(col, uMilk, foam(uv, p, uMilkMix, uTime));

    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
  }
`

export type WorldUniforms = {
  uTime: { value: number }
  uRes: { value: THREE.Vector2 }
  uLabel: { value: number }
  uLabelTex: { value: THREE.Texture | null }
  uLabelCyl: { value: THREE.Vector4 }
  uLabelPersp: { value: THREE.Vector2 }
  uSun0: { value: THREE.Vector4 }
  uAlpha: { value: number }
  uMorph: { value: number }
  uTravel: { value: number }
  uSnow: { value: number }
  uNightMix: { value: number }
  uBubbles: { value: number }
  uPressure: { value: number }
  /** Foam level in screen space (`< -0.15` = none, `> 1.1` = full). */
  uBurst: { value: number }
  uPointer: { value: THREE.Vector2 }
  /** Milk flood level in screen space (`< -0.15` = none, `> 1.1` = full). */
  uMilkMix: { value: number }
}

export interface World {
  /** Drawn first, behind everything (the glass refracts it). */
  mesh: THREE.Mesh
  /** The same world drawn over everything with `overlayAlpha` — used for cross-fades. */
  overlay: THREE.Mesh
  uniforms: WorldUniforms
  overlayAlpha: { value: number }
  dispose(): void
}

export function createWorld(labelTexture: THREE.Texture | null): World {
  const color = (hex: string) => ({ value: new THREE.Color(hex) })
  const [ridges, facets] = createRidgeTextures()
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBlue: color(palette.blue),
    uBlueDeep: color(palette.blueDeep),
    uSky: color(palette.sky),
    uYellow: color(palette.yellow),
    uNavy: color(palette.navy),
    uMilk: color(palette.milk),
    uNight: color(palette.night),
    uSnowShade: color(palette.snowShade),
    uLabel: { value: 0 },
    uLabelTex: { value: labelTexture },
    uLabelCyl: { value: new THREE.Vector4(0, 0, 100, 1000) },
    uLabelPersp: { value: new THREE.Vector2(50, 1000) },
    uSun0: { value: new THREE.Vector4(0, 0, 0.3, 0.2) },
    uAlpha: { value: 1 },
    uMorph: { value: 0 },
    uTravel: { value: 0 },
    uSnow: { value: 0 },
    uRidges: { value: ridges },
    uFacets: { value: facets },
    uNightMix: { value: 0 },
    uBubbles: { value: 0 },
    uPressure: { value: 0 },
    uBurst: { value: -1 },
    uPointer: { value: new THREE.Vector2(10, 10) },
    uMilkMix: { value: -1 },
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  const base = { vertexShader, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false }
  const material = new THREE.ShaderMaterial({ ...base, uniforms })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -100

  // Overlay: shares every uniform except alpha.
  const overlayAlpha = { value: 0 }
  const overlayMaterial = new THREE.ShaderMaterial({ ...base, uniforms: { ...uniforms, uAlpha: overlayAlpha }, transparent: true })
  const overlay = new THREE.Mesh(geometry, overlayMaterial)
  overlay.frustumCulled = false
  overlay.renderOrder = 100
  overlay.visible = false

  return {
    mesh,
    overlay,
    uniforms: uniforms as unknown as WorldUniforms,
    overlayAlpha,
    dispose() {
      geometry.dispose()
      material.dispose()
      overlayMaterial.dispose()
      ridges.dispose()
      facets.dispose()
    },
  }
}
