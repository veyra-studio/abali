/**
 * The WebGL side of the film: renderer setup, the product, the world, and
 * per-frame placement. Chapters only write to `state`; this module turns
 * that state into transforms and uniforms.
 */
import * as THREE from 'three'
import { clamp, damp, lerp, Spring, type Stage } from '@veyra/core'
import { threeLayer, type ThreeLayer } from '@veyra/core/three'
import { createStudioEnvironment } from './env'
import { BOTTLE, createProduct, type Product } from './product'
import { createWorld, type World } from './world'

export interface ProductState {
  /** Which DOM slot the bottle rests in. */
  slot: 'hero' | 'finale'
  /** 0 → at slot, 1 → pushed into the label (label fills the screen). */
  push: number
  /** Vertical offset as a fraction of the viewport height (positive = up). */
  lift: number
  /** Extra scale multiplier. */
  zoom: number
  /** Rotation around the bottle axis (radians), added to the idle turn. */
  turn: number
  /** 0…1 how much the idle turntable motion applies. */
  idle: number
  /** 0…1 pointer-driven tilt. */
  tilt: number
  /** Shake energy 0…1 (fizz chapter). */
  shake: number
  /** 0 = capped, 1 = cap gone. */
  capOff: number
  /** Whether the bottle is rendered at all. */
  visible: boolean
}

export interface Experience {
  layer: ThreeLayer
  product: Product
  world: World
  state: ProductState
  /** Set by chapters: is the WebGL canvas needed this frame? */
  active: boolean
  /** Fires the cap off (finale). */
  popCap(): void
  resetCap(): void
  dispose(): void
}

const tmp = new THREE.Vector3()

export function createExperience(stage: Stage): Experience {
  const tier = stage.quality?.tier.value ?? 'medium'
  const layer = stage.use(threeLayer({ fov: 18, zIndex: 1, maxDpr: 2, near: 2, renderer: { antialias: tier !== 'low' } }))
  const { renderer, scene, camera } = layer
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.transmissionResolutionScale = tier === 'high' ? 1 : tier === 'medium' ? 0.75 : 0.5
  stage.quality?.tier.subscribe((t) => {
    renderer.transmissionResolutionScale = t === 'high' ? 1 : t === 'medium' ? 0.75 : 0.5
  })

  scene.environment = createStudioEnvironment(renderer)

  const product = createProduct({ quality: tier, ice: true })
  scene.add(product.group)

  const world = createWorld(product.labelTexture)
  scene.add(world.mesh, world.overlay)

  // A warm key and a cool rim for the liquid and label (glass lives on the env map).
  const key = new THREE.DirectionalLight('#fff3e3', 2.2)
  key.position.set(700, 900, 1200)
  const rim = new THREE.DirectionalLight('#cfe3ff', 1.4)
  rim.position.set(-900, 400, -600)
  scene.add(key, rim, new THREE.HemisphereLight('#e9f1ff', '#0b0d12', 0.35))

  const state: ProductState = {
    slot: 'hero',
    push: 0,
    lift: 0,
    zoom: 1,
    turn: 0,
    idle: 1,
    tilt: 1,
    shake: 0,
    capOff: 0,
    visible: true,
  }

  const slots = {
    hero: document.querySelector('.hero-slot')!,
    finale: document.querySelector('.finale-slot')!,
  }
  const releases = Object.values(slots).map((el) => stage.rects.track(el))

  // Motion: springs for pointer tilt, shake and the cap.
  const tiltX = new Spring(0, { stiffness: 60, damping: 14 })
  const tiltZ = new Spring(0, { stiffness: 60, damping: 14 })
  const wobble = new Spring(0, { stiffness: 220, damping: 6 })
  let capT = 0 // seconds since pop, < 0 when capped
  let capping = -1
  const capStart = new THREE.Vector3()
  const capVel = new THREE.Vector3()
  const capSpin = new THREE.Vector3()
  let idleAngle = 0
  let shakeTime = 0

  const exp: Experience = {
    layer,
    product,
    world,
    state,
    active: true,
    popCap() {
      if (capT > 0) return
      capT = 0.0001
      capping = -1
      capStart.set(0, 0, 0)
      capVel.set((Math.random() - 0.5) * 0.25, 1.15 + Math.random() * 0.2, 0.35)
      capSpin.set(9 + Math.random() * 4, (Math.random() - 0.5) * 6, 5 + Math.random() * 4)
      wobble.impulse(2.4)
    },
    resetCap() {
      capT = 0
      capping = 0
    },
    dispose() {
      releases.forEach((r) => r())
      product.dispose()
      world.dispose()
      layer.destroy()
    },
  }

  const uniforms = world.uniforms

  stage.onFrame((frame) => {
    const dt = frame.delta
    const vw = layer.width
    const vh = layer.height
    uniforms.uTime.value = frame.time
    uniforms.uRes.value.set(vw, vh)

    // Show/hide the canvas when a chapter doesn't need WebGL.
    layer.autoRender = exp.active
    layer.canvas.style.visibility = exp.active ? 'visible' : 'hidden'
    if (!exp.active) return

    const reduced = stage.reducedMotion.value
    const D = layer.distance

    // --- Base placement from the DOM slot -----------------------------
    // The hero slot is read as if the page were at the top: the bottle stays
    // where it first stood while the hero scrolls away beneath it.
    const r = state.slot === 'hero' ? stage.rects.get(slots.hero) : stage.rects.view(slots.finale)
    const S0 = r.height / BOTTLE.capTop
    const S = S0 * state.zoom
    let x = r.left + r.width / 2 - vw / 2
    let y = -(r.top + r.height - vh / 2) + state.lift * vh
    if (state.slot === 'hero') x = r.left + r.width / 2 - vw / 2
    let z = 0

    // --- Push into the label --------------------------------------------
    // Target: the label (height 0.17 S) fills ~1.15 viewport heights.
    const push = state.push
    if (push > 0) {
      const labelMid = (BOTTLE.labelBottom + BOTTLE.labelTop) / 2
      const labelH = BOTTLE.labelTop - BOTTLE.labelBottom
      const k = (1.18 * vh) / (labelH * S)
      const zTarget = D * (1 - 1 / k)
      const e = push * push * (3 - 2 * push)
      x = lerp(x, 0, e)
      y = lerp(y, -labelMid * S, e)
      z = lerp(0, zTarget, e * e)
    }

    // --- Pointer tilt, idle turn, shake ---------------------------------
    const p = stage.pointer
    const tiltAmount = reduced ? 0 : state.tilt * (1 - push)
    tiltX.target = (p ? -p.sny : 0) * 0.12 * tiltAmount
    tiltZ.target = (p ? -p.snx : 0) * 0.08 * tiltAmount
    tiltX.step(dt)
    tiltZ.step(dt)
    if (!reduced) idleAngle += dt * 0.35 * state.idle
    const idleTurn = Math.sin(idleAngle) * 0.42 * state.idle * (1 - push)

    shakeTime += dt * (8 + state.shake * 18)
    wobble.step(dt)
    const shakeA = reduced ? 0 : state.shake
    const shakeX = Math.sin(shakeTime * 1.7) * 0.11 * shakeA + wobble.value * 0.06
    const shakeZ = Math.cos(shakeTime * 2.3) * 0.07 * shakeA

    const g = product.group
    g.visible = state.visible
    g.position.set(x, y, z)
    g.scale.setScalar(S)
    g.rotation.set(tiltX.value + shakeZ, state.turn + idleTurn, tiltZ.value + shakeX)
    product.setScale(S)
    // Ice stays on the "floor" only in the slots, not when pushed or shaken.
    product.ice.visible = push < 0.02 && state.shake < 0.02 && state.lift === 0

    // --- Cap physics ---------------------------------------------------
    const cap = product.cap
    if (capT > 0) {
      capT += dt
      const t = capT
      cap.position.set(capStart.x + capVel.x * t, capStart.y + capVel.y * t - 1.6 * t * t, capStart.z + capVel.z * t)
      cap.rotation.set(capSpin.x * t, capSpin.y * t, capSpin.z * t)
      cap.visible = t < 2.4
      state.capOff = clamp(t / 0.6)
    } else if (capping >= 0) {
      capping = Math.min(1, capping + dt * 1.8)
      const e = 1 - (1 - capping) ** 3
      cap.visible = true
      cap.position.set(0, (1 - e) * 0.35, 0)
      cap.rotation.set(0, (1 - e) * 3, 0)
      state.capOff = 1 - e
      if (capping >= 1) capping = -1
    } else {
      cap.position.set(0, 0, 0)
      cap.rotation.set(0, 0, 0)
      cap.visible = true
      state.capOff = 0
    }

    // --- World uniforms derived from the product ------------------------
    // Label cylinder for the perspective-correct hand-off.
    const labelMid = (BOTTLE.labelBottom + BOTTLE.labelTop) / 2
    const rS = 0.1395 * S
    const Dz = D - z
    uniforms.uLabelCyl.value.set(x, y + labelMid * S, rS, Dz)
    uniforms.uLabelPersp.value.set(((BOTTLE.labelTop - BOTTLE.labelBottom) / 2) * S, D)
    // The oval on screen (p-space: units of viewport height, origin at the center).
    const kFront = D / Math.max(1, Dz - rS)
    const ovalPhi = THREE.MathUtils.degToRad(0.235 * 2 * 85)
    const kOval = D / Math.max(1, Dz - rS * Math.cos(ovalPhi))
    uniforms.uSun0.value.set(
      (x * kFront) / vh,
      ((y + labelMid * S) * kFront) / vh,
      (rS * Math.sin(ovalPhi) * kOval) / vh,
      (0.37 * 2 * ((BOTTLE.labelTop - BOTTLE.labelBottom) / 2) * S * kFront) / vh,
    )

    // Pointer in p-space for the bubbles.
    if (p) uniforms.uPointer.value.set(((p.sx - vw / 2) / vh), -((p.sy - vh / 2) / vh))
    tmp.set(0, 0, 0)
  }, 50)

  // Keep the overlay invisible unless fading.
  stage.onFrame(() => {
    world.overlay.visible = world.overlayAlpha.value > 0.001
  }, 60)

  return exp
}

export { damp }
