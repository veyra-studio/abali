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
  /** Opener approach (scrolled): 0 away · 1 hooked under the cap. The lever and the pop play in real time (`openWithOpener`). */
  opener: number
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
  /** Pops the cap by hand (the finale button): it flies up and away. */
  popCap(): void
  /** The opener levers and the cap snaps off sideways (the «تق» beat). */
  openWithOpener(): void
  /** Puts the cap back on (and the opener back on the cap, if it was used). */
  resetCap(): void
  /** Sets the cap on or off at once, without animation (when the studio comes back into view). */
  setCap(on: boolean): void
  /** Seconds since the cap came off, or -1 while it is on. */
  readonly openFor: number
  update(dt: number, time: number, pointer: { snx: number; sny: number; vx: number; vy: number } | null, reduced: boolean): void
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
    plume: 0,
    plumeRise: 0,
    foam: 0,
    visible: true,
  }

  // Motion.
  const tiltX = new Spring(0, { stiffness: 60, damping: 14 })
  const tiltZ = new Spring(0, { stiffness: 60, damping: 14 })
  // The bottle rocks on its base when shaken: springs pushed by the hand's velocity.
  const rockZ = new Spring(0, { stiffness: 140, damping: 7 })
  const rockX = new Spring(0, { stiffness: 140, damping: 8 })
  const kick = new Spring(0, { stiffness: 220, damping: 9 })
  // The opener's prying and retreat, both reversible.
  const lever = new Spring(0, { stiffness: 340, damping: 26 })
  const retract = new Spring(0, { stiffness: 70, damping: 15 })
  let idleClock = 0
  let shiver = 0
  // The cap: < 0 on; ≥ 0 seconds since it came off.
  let popT = -1
  let byOpener = false
  let recap = -1
  const popVel = new THREE.Vector3()
  const popSpin = new THREE.Vector3()
  let gravity = 1.7

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
  // Where the opener's hook bites the cap, and the pose it levers around.
  const HOOK = new THREE.Vector3(BOTTLE.capRadius * 0.55, BOTTLE.capTop + 0.004, 0.03)
  const PIVOT = new THREE.Vector3(-BOTTLE.capRadius * 0.85, BOTTLE.capTop + 0.004, 0.03)
  const tmp = new THREE.Vector3()

  const studio: Studio = {
    scene,
    product,
    bottle,
    state,
    get openFor() {
      return popT
    },
    popCap() {
      if (popT >= 0) return
      popT = 0
      byOpener = false
      recap = -1
      gravity = 1.7
      popVel.set(0.22 + Math.random() * 0.12, 1.25 + Math.random() * 0.2, 0.3)
      popSpin.set(8 + Math.random() * 4, (Math.random() - 0.5) * 5, -6 - Math.random() * 4)
      kick.impulse(2.2)
    },
    openWithOpener() {
      if (popT >= 0) return
      popT = 0
      byOpener = true
      recap = -1
      // Pried off the far rim: a short hop sideways, toward us, flipping.
      gravity = 3.2
      popVel.set(-0.28 - Math.random() * 0.06, 0.62 + Math.random() * 0.08, 0.22)
      popSpin.set(7 + Math.random() * 3, (Math.random() - 0.5) * 3, 5 + Math.random() * 3)
      kick.impulse(1.4)
    },
    resetCap() {
      if (popT < 0 && recap < 0) return
      popT = -1
      recap = 0
    },
    setCap(on) {
      recap = -1
      if (on) {
        popT = -1
        byOpener = false
        lever.snap(0)
        retract.snap(0)
      } else if (popT < 0) {
        // Off, long gone: past the flight and the opener's retreat.
        popT = 10
        byOpener = true
        lever.snap(1)
        retract.snap(1)
      }
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
      // A slow, uneven sway, like a bottle on a turntable someone nudged.
      if (!reduced) idleClock += dt * state.idle
      const idleTurn = (Math.sin(idleClock * 0.21) * 0.2 + Math.sin(idleClock * 0.077 + 1.3) * 0.09) * state.idle
      // Shaking: the hand's velocity pushes the bottle, which rocks back on its springs.
      const shakeA = reduced ? 0 : Math.min(1, state.shake * 1.5 + (state.shake > 0 ? 0.25 : 0))
      if (pointer && shakeA > 0) {
        rockZ.velocity += (-pointer.vx / 900) * shakeA * dt * 60 * 0.06
        rockX.velocity += (pointer.vy / 900) * shakeA * dt * 60 * 0.04
      }
      rockZ.step(dt)
      rockX.step(dt)
      kick.step(dt)
      // Under pressure the glass shivers a little: the gas is fighting the cap.
      shiver += dt * 70
      const buzz = reduced ? 0 : Math.max(0, state.shake - 0.5) * 0.012
      const rz = THREE.MathUtils.clamp(rockZ.value, -0.22, 0.22) + kick.value * 0.04 + Math.sin(shiver) * buzz
      const rx = THREE.MathUtils.clamp(rockX.value, -0.15, 0.15) + Math.cos(shiver * 1.3) * buzz
      bottle.group.rotation.set(state.tiltX + tiltX.value + rx, state.turn + idleTurn, tiltZ.value + rz)

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

      // Opener: slides in (scrolled), then levers and withdraws (in real time).
      lever.target = byOpener && popT >= 0 ? 1 : 0
      retract.target = byOpener && popT >= 0.16 ? 1 : 0
      if (reduced) {
        lever.snap(lever.target)
        retract.snap(retract.target)
      } else {
        lever.step(dt)
        retract.step(dt)
      }
      const a = THREE.MathUtils.clamp(state.opener, 0, 1)
      const l = THREE.MathUtils.clamp(lever.value, 0, 1.2)
      const w = THREE.MathUtils.clamp(retract.value, 0, 1.2)
      opener.group.visible = a > 0.001 && w < 0.98
      if (opener.group.visible) {
        // Approach on a straight, slightly descending line; the face keeps its
        // angle to the light, so the steel never flips from bright to dark.
        const e = a * a * (3 - 2 * a)
        tmp.set(lerp(0.95, HOOK.x, e), lerp(HOOK.y + 0.16, HOOK.y, e), HOOK.z)
        // Lever: rotate about the pivot on the far rim, lifting the handle.
        const angle = l * 0.38
        const dx = tmp.x - PIVOT.x
        const dy = tmp.y - PIVOT.y
        const c = Math.cos(angle)
        const sn = Math.sin(angle)
        opener.group.position.set(PIVOT.x + dx * c - dy * sn + w * 0.55, PIVOT.y + dx * sn + dy * c + w * 0.32, HOOK.z)
        opener.group.rotation.set(0.95, 0, angle - w * 0.35)
      }

      // Cap.
      const cap = bottle.cap
      if (popT >= 0 && reduced) {
        // No flight under reduced motion: the cap is simply off.
        popT += dt
        cap.visible = false
      } else if (popT >= 0) {
        popT += dt
        const t = popT
        if (byOpener && t < 0.06) {
          // The first instant: the hook pries the rim up.
          hinge((t / 0.06) * 0.42)
          cap.visible = true
        } else {
          const ft = byOpener ? t - 0.06 : t
          const x0 = byOpener ? -BOTTLE.capRadius * 0.3 : 0
          const y0 = byOpener ? 0.012 : 0
          cap.visible = ft < 2.2
          cap.position.set(x0 + popVel.x * ft, y0 + popVel.y * ft - gravity * ft * ft, popVel.z * ft)
          cap.rotation.set(popSpin.x * ft, popSpin.y * ft, (byOpener ? 0.42 : 0) + popSpin.z * ft)
        }
      } else if (recap >= 0) {
        // Back on: it drops onto the lip and settles with a quarter turn.
        recap = Math.min(1, recap + dt * 1.8)
        const e = 1 - (1 - recap) ** 3
        cap.visible = true
        cap.position.set(0, (1 - e) * 0.3, 0)
        cap.rotation.set(0, (1 - e) * 3, 0)
        if (recap >= 1) {
          recap = -1
          byOpener = false
        }
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
        const key = `${Math.round(state.x)}|${Math.round(state.baseY)}|${Math.round(state.scale)}|${r.x.toFixed(3)}|${r.z.toFixed(3)}|${bottle.cap.visible}|${popT >= 0}`
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
