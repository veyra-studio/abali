/**
 * The studio: the bottle on black acrylic with ice, lit like a product
 * shot. Chapters write `state`; `update` turns it into transforms. All
 * placement is in CSS pixels through the layer's pixel camera, so the
 * bottle can stand in a DOM slot.
 */
import * as THREE from 'three'
import { lerp, Spring } from '@veyra/core'
import { ContactShadow, ReflectiveFloor, studioEnvironment } from '@veyra/core/three'
import { BOTTLE, createBottle, type Bottle } from './bottle'
import { createFoam, type Foam } from './foam'
import { createIce, type Ice } from './ice'
import { createOpener, type Opener } from './opener'
import { createPlume, type Plume } from './plume'

export type Quality = 'low' | 'medium' | 'high'

export interface StudioState {
  /** Bottle axis, CSS px from the viewport center (x right). */
  x: number
  /** Floor level, CSS px from the viewport center (y up). */
  baseY: number
  /** CSS px per bottle unit (bottle height incl. cap = 1). */
  scale: number
  /** Turn around the bottle's axis (radians), added to the idle turn. */
  turn: number
  /** Tilt toward the camera (radians). */
  tiltX: number
  /** 0…1 idle turntable motion. */
  idle: number
  /** 0…1 pointer-driven tilt. */
  pointer: number
  /** 0…1 shake energy. */
  shake: number
  /** 0…1 floor (reflection and contact shadow). */
  floor: number
  /** 0…1 ice. */
  ice: number
  /** Opener choreography: 0 away · 0.5 hooked under the cap · 1 levered. */
  opener: number
  /** Scroll-scrubbed cap: 0 on · 0.25 pried open · 1 gone. */
  capScrub: number
  /** Cold wisp over the mouth: amount and how high it has climbed. */
  plume: number
  plumeRise: number
  /** Foam level 0…1. */
  foam: number
  visible: boolean
}

export interface Studio {
  scene: THREE.Scene
  product: THREE.Group
  bottle: Bottle
  state: StudioState
  /** Pops the cap in real time (the finale button). */
  popCap(): void
  /** Puts it back. */
  resetCap(): void
  /** True while a time-based pop is under way or the cap is off. */
  readonly capOff: boolean
  update(dt: number, time: number, pointer: { snx: number; sny: number } | null, reduced: boolean): void
  /** Renders the reflection and contact shadow (call before rendering the scene). */
  prepare(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void
  dispose(): void
}

const REFLECT = 3

export function createStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene, quality: Quality): Studio {
  scene.environment = studioEnvironment(renderer)
  const product = new THREE.Group()
  scene.add(product)

  const bottle = createBottle({ quality })
  product.add(bottle.group)
  const ice: Ice = createIce({ quality })
  product.add(ice.group)
  const opener: Opener = createOpener()
  product.add(opener.group)
  const plume: Plume = createPlume()
  bottle.group.add(plume.mesh)
  plume.mesh.position.y = BOTTLE.rim - 0.004
  const foam: Foam = createFoam({ quality, outerRadiusAt: (h) => bottle.radiusAt(h) })
  bottle.body.add(foam.mesh)

  const key = new THREE.DirectionalLight('#fff4e6', 1.3)
  key.position.set(-700, 900, 1200)
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.35)
  fill.position.set(900, 200, 600)
  scene.add(key, fill)

  // Glossy floor and contact shadow (skipped on the low tier).
  let floor: ReflectiveFloor | null = null
  let shadow: ContactShadow | null = null
  if (quality !== 'low') {
    bottle.group.traverse((o) => o.layers.enable(REFLECT))
    ice.group.traverse((o) => o.layers.enable(REFLECT))
    floor = new ReflectiveFloor({ width: 12000, depth: 12000, strength: 0.38, fade: [0, 0.28], blur: 4, layer: REFLECT, resolution: quality === 'high' ? 0.5 : 0.35 })
    scene.add(floor.mesh)
  }
  shadow = new ContactShadow({ width: 1, depth: 1, far: 1, opacity: 0.8, blur: 3, resolution: quality === 'low' ? 256 : 512 })
  shadow.cast(bottle.body)
  shadow.cast(ice.group)
  scene.add(shadow.object)

  const state: StudioState = {
    x: 0,
    baseY: 0,
    scale: 100,
    turn: 0,
    tiltX: 0,
    idle: 1,
    pointer: 1,
    shake: 0,
    floor: 1,
    ice: 1,
    opener: 0,
    capScrub: 0,
    plume: 0,
    plumeRise: 0,
    foam: 0,
    visible: true,
  }

  // Motion.
  const tiltX = new Spring(0, { stiffness: 60, damping: 14 })
  const tiltZ = new Spring(0, { stiffness: 60, damping: 14 })
  const wobble = new Spring(0, { stiffness: 220, damping: 7 })
  let idleAngle = 0
  let shakeTime = 0
  // Time-based cap: < 0 capped; ≥ 0 seconds since the pop.
  let popT = -1
  let recap = -1
  const popVel = new THREE.Vector3()
  const popSpin = new THREE.Vector3()

  let shadowKey = ''
  let shadowAge = 0
  const capPivot = new THREE.Vector3()
  const hinge = (angle: number) => {
    // Rotate the cap about its left rim (the opener pries the right side up).
    const R = BOTTLE.capRadius
    capPivot.set(-R, BOTTLE.capBottom + 0.01, 0)
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    // p' = pivot + Rz(angle) (p - pivot), applied to the origin.
    const dx = -capPivot.x
    const dy = -capPivot.y
    bottle.cap.position.set(capPivot.x + dx * c - dy * s, capPivot.y + dx * s + dy * c, 0)
    bottle.cap.rotation.set(0, 0, angle)
  }

  const studio: Studio = {
    scene,
    product,
    bottle,
    state,
    get capOff() {
      return popT >= 0 || state.capScrub > 0.25
    },
    popCap() {
      if (popT >= 0) return
      popT = 0
      recap = -1
      popVel.set(0.22 + Math.random() * 0.12, 1.25 + Math.random() * 0.2, 0.3)
      popSpin.set(8 + Math.random() * 4, (Math.random() - 0.5) * 5, -6 - Math.random() * 4)
      wobble.impulse(2.2)
    },
    resetCap() {
      popT = -1
      recap = 0
    },
    update(dt, time, pointer, reduced) {
      const S = state.scale
      product.visible = state.visible
      if (!state.visible) return
      product.position.set(state.x, state.baseY, 0)
      product.scale.setScalar(S)
      bottle.setScale(S)
      ice.setScale(S)

      // Pointer tilt, idle turn, shake.
      const tiltAmount = reduced ? 0 : state.pointer
      tiltX.target = (pointer ? -pointer.sny : 0) * 0.1 * tiltAmount
      tiltZ.target = (pointer ? -pointer.snx : 0) * 0.06 * tiltAmount
      tiltX.step(dt)
      tiltZ.step(dt)
      if (!reduced) idleAngle += dt * 0.32 * state.idle
      const idleTurn = Math.sin(idleAngle) * 0.38 * state.idle
      shakeTime += dt * (8 + state.shake * 18)
      wobble.step(dt)
      const shakeA = reduced ? 0 : state.shake
      const shakeZ = Math.sin(shakeTime * 1.7) * 0.1 * shakeA + wobble.value * 0.05
      const shakeX = Math.cos(shakeTime * 2.3) * 0.06 * shakeA
      bottle.group.rotation.set(state.tiltX + tiltX.value + shakeX, state.turn + idleTurn, tiltZ.value + shakeZ)

      // Ice and floor.
      ice.group.visible = state.ice > 0.01
      ice.group.scale.setScalar(lerp(0.6, 1, state.ice))
      if (floor) {
        floor.mesh.position.set(state.x, state.baseY, 0)
        floor.strength = 0.38 * state.floor
        floor.setFade(0, 0.3 * S)
        floor.mesh.visible = state.floor > 0.01
      }
      if (shadow) {
        // The shadow plane follows the bottle, sized to it.
        shadow.object.position.set(state.x, state.baseY + 0.4, 0)
        shadow.resize(S * 1.6, S * 1.6, S * 0.5)
        shadow.opacity = 0.8 * state.floor
      }

      // Opener: slides in from the reading side, hooks, levers.
      const o = state.opener
      opener.group.visible = o > 0.001 && o < 0.999
      if (opener.group.visible) {
        const approach = THREE.MathUtils.smoothstep(o, 0, 0.5)
        const lever = THREE.MathUtils.smoothstep(o, 0.5, 0.8)
        const leave = THREE.MathUtils.smoothstep(o, 0.8, 1)
        // Its face turned toward us so the steel catches the light.
        opener.group.position.set(lerp(0.9, BOTTLE.capRadius * 0.55, approach) + leave * 0.5, BOTTLE.capTop + 0.004 + lerp(0.18, 0, approach) + leave * 0.25, 0.03)
        opener.group.rotation.set(0.95, 0, lerp(-0.35, 0, approach) + lever * 0.42 - leave * 0.6)
      }

      // Cap.
      const cap = bottle.cap
      if (state.capScrub > 0) {
        // Scrubbed by scroll: pried open (hinged), then flying.
        const c = state.capScrub
        if (c < 0.25) {
          hinge((c / 0.25) * 0.5)
          cap.visible = true
        } else {
          const t = (c - 0.25) / 0.75
          // A short arc away from the opener, flipping, then down out of frame.
          cap.visible = t < 0.98
          cap.position.set(-BOTTLE.capRadius * 0.4 - 0.32 * t, 0.012 + 0.34 * t - 0.62 * t * t, 0.06 * t)
          cap.rotation.set(5.5 * t, -1.5 * t, 0.5 + 4 * t)
        }
      } else if (popT >= 0) {
        popT += dt
        const t = popT
        cap.visible = t < 2.2
        cap.position.set(popVel.x * t, popVel.y * t - 1.7 * t * t, popVel.z * t)
        cap.rotation.set(popSpin.x * t, popSpin.y * t, popSpin.z * t)
      } else if (recap >= 0) {
        recap = Math.min(1, recap + dt * 1.8)
        const e = 1 - (1 - recap) ** 3
        cap.visible = true
        cap.position.set(0, (1 - e) * 0.3, 0)
        cap.rotation.set(0, (1 - e) * 3, 0)
        if (recap >= 1) recap = -1
      } else {
        cap.visible = true
        cap.position.set(0, 0, 0)
        cap.rotation.set(0, 0, 0)
      }

      // Wisp and foam.
      plume.mesh.visible = state.plume > 0.002
      plume.uniforms.uTime.value = time
      plume.uniforms.uAmount.value = state.plume
      plume.uniforms.uRise.value = state.plumeRise
      // The quad faces the camera regardless of the bottle's turn.
      plume.mesh.rotation.set(0, -bottle.group.rotation.y, 0)
      foam.setLevel(state.foam, time)
    },
    prepare(renderer, camera) {
      if (!state.visible) return
      if (floor && floor.mesh.visible) floor.update(renderer, scene, camera)
      if (shadow && state.floor > 0.01) {
        // A turned bottle casts the same shadow as it spins: re-render only
        // when it moves, tilts or is scaled (and now and then for the ice).
        const r = bottle.group.rotation
        const key = `${Math.round(state.x)}|${Math.round(state.baseY)}|${Math.round(state.scale)}|${r.x.toFixed(3)}|${r.z.toFixed(3)}|${bottle.cap.visible}`
        if (key !== shadowKey || ++shadowAge > 30) {
          shadowKey = key
          shadowAge = 0
          shadow.update(renderer, scene)
        }
      }
    },
    dispose() {
      bottle.dispose()
      ice.dispose()
      opener.dispose()
      plume.dispose()
      foam.dispose()
      floor?.dispose()
      shadow?.dispose()
      scene.environment?.dispose()
    },
  }
  return studio
}
