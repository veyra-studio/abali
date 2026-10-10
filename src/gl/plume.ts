/**
 * The cold wisp that rises from a freshly opened cold bottle: the gas
 * expands, cools, and the moisture above the neck condenses into a thin
 * fog for a moment. A soft, domain-warped noise column on a quad that
 * stands over the mouth. Units: bottle units (the quad is 0.5 × 1).
 */
import * as THREE from 'three'
import { glslNoise } from '@veyra/core/glsl'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  ${glslNoise}
  uniform float uTime;
  uniform float uAmount;
  uniform float uRise;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float y = vUv.y;
    float x = vUv.x - 0.5;
    // Narrow at the mouth, opening as it rises; drifting sideways a little.
    float sway = (fbm(vec2(y * 1.4 - uTime * 0.12, uSeed), 3)) * 0.18 * y;
    float width = mix(0.11, 0.46, pow(y, 0.75));
    float across = abs(x - sway) / width;
    vec2 q = vec2((x - sway) * 3.0, y * 2.2 - uTime * 0.55);
    vec2 warp = vec2(fbm(q + vec2(uSeed, uTime * 0.1), 4), fbm(q + vec2(5.2, 1.3 + uSeed), 4));
    float n = fbm(q * 1.6 + warp * 1.8, 5) * 0.5 + 0.5;
    float body = smoothstep(1.0, 0.25, across) * smoothstep(0.0, 0.05, y);
    // The front of the wisp climbs with uRise; the top thins out.
    float front = smoothstep(uRise, uRise - 0.35, y);
    float density = body * front * pow(1.0 - y, 1.3) * smoothstep(0.35, 0.85, n);
    float a = clamp(density * uAmount * 1.25, 0.0, 0.9);
    gl_FragColor = vec4(vec3(0.94, 0.97, 1.0) * a, a);
  }
`

export interface Plume {
  mesh: THREE.Mesh
  uniforms: { uTime: { value: number }; uAmount: { value: number }; uRise: { value: number }; uSeed: { value: number } }
  dispose(): void
}

export function createPlume(): Plume {
  const geometry = new THREE.PlaneGeometry(0.5, 1).translate(0, 0.5, 0)
  const uniforms = { uTime: { value: 0 }, uAmount: { value: 0 }, uRise: { value: 0 }, uSeed: { value: 3.7 } }
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = 10
  mesh.frustumCulled = false
  return {
    mesh,
    uniforms,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
