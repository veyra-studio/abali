/**
 * Full-screen transitions drawn over whichever world is on screen:
 * - foam: a milky front with a bubbly crest that rises and covers the screen
 *   (the bottle "boils over");
 * - mist: white that thins in patches, the way cloud clears off a slope.
 */
import * as THREE from 'three'
import { glslHash, glslNoise } from '@veyra/core/glsl'
import { colors } from '../palette'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  ${glslHash}
  ${glslNoise}
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uFoam;
  uniform float uMist;
  uniform float uDark;
  uniform vec3 uInk;
  uniform vec3 uMilk;
  uniform vec3 uMistColor;
  varying vec2 vUv;

  // Coverage of a foam front at screen height 'level' (0 bottom … 1 top).
  vec4 foamFront(vec2 uv, vec2 p, float level, float t) {
    float edge = level + gnoise(vec2(p.x * 2.6 + t * 0.35, t * 0.25)) * 0.045 + gnoise(vec2(p.x * 9.0 - t * 0.8, 2.0)) * 0.014;
    float below = edge - uv.y;
    float body = smoothstep(-0.003, 0.003, below);
    // The crest: bubbles of many sizes straddling the edge.
    float crest = 0.0;
    float shade = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float scale = 18.0 + fi * 16.0;
      vec2 q = vec2(p.x, uv.y - edge) * scale + vec2(fi * 7.3, 0.0);
      vec2 id = floor(q);
      vec2 f = fract(q) - 0.5;
      float h = hash12(id + fi * 13.0);
      float r = 0.22 + 0.24 * hash12(id + 4.1);
      float d = length(f - (hash22(id) - 0.5) * 0.3);
      float near = 1.0 - smoothstep(0.0, 0.04 + fi * 0.01, abs(uv.y - edge));
      float b = (1.0 - smoothstep(r - 0.05, r, d)) * step(h, 0.75) * near;
      crest = max(crest, b);
      // A highlight on each bubble, a rim of shade around it.
      shade += (smoothstep(r - 0.12, r, d) - smoothstep(r, r + 0.03, d)) * b * 0.25;
    }
    float cover = clamp(body + crest, 0.0, 1.0);
    // Inside the foam: a fine bubbly texture and a soft shadow under the crest.
    float grain = gnoise(p * 60.0 + vec2(0.0, t * 0.3)) * 0.035;
    float underCrest = smoothstep(0.0, 0.06, below) * 0.08;
    vec3 col = uMilk * (1.0 - shade - underCrest * (1.0 - smoothstep(0.06, 0.2, below)) + grain);
    return vec4(col * cover, cover);
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec4 outc = vec4(0.0);
    if (uFoam > -0.2) outc = foamFront(uv, p, uFoam, uTime);
    if (uMist > 0.0) {
      float n = fbm(vec3(p * 1.8, uTime * 0.04), 5) * 0.5 + 0.5;
      float n2 = fbm(vec3(p * 5.0 + 3.0, uTime * 0.07), 3) * 0.5 + 0.5;
      float a = smoothstep(0.0, 0.35, uMist * 1.35 - (1.0 - n) * 0.9 - n2 * 0.12);
      vec4 mist = vec4(uMistColor * a, a);
      outc = outc + mist * (1.0 - outc.a);
    }
    if (uDark > 0.0) outc = vec4(uInk * uDark, uDark) + outc * (1.0 - uDark);
    // Convert unpremultiplied color to the output space, then premultiply.
    vec3 rgb = outc.a > 0.0 ? outc.rgb / outc.a : vec3(0.0);
    gl_FragColor = vec4(rgb, 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * outc.a, outc.a);
  }
`

export interface Veil {
  mesh: THREE.Mesh
  scene: THREE.Scene
  camera: THREE.Camera
  uniforms: { uRes: { value: THREE.Vector2 }; uTime: { value: number }; uFoam: { value: number }; uMist: { value: number }; uDark: { value: number } }
  /** Whether anything is drawn. */
  readonly active: boolean
  dispose(): void
}

export function createVeil(): Veil {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uFoam: { value: -1 },
    uMist: { value: 0 },
    uDark: { value: 0 },
    uInk: { value: new THREE.Color(colors.ink) },
    uMilk: { value: new THREE.Color(colors.milk) },
    uMistColor: { value: new THREE.Color('#eef3f7') },
  }
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  return {
    mesh,
    scene,
    camera,
    uniforms,
    get active() {
      return uniforms.uFoam.value > -0.2 || uniforms.uMist.value > 0.001 || uniforms.uDark.value > 0.001
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
