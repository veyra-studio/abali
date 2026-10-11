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
import { createIce, type Ice, type IceTap } from './ice'
import { createOpener, OPENER_REST, type Opener } from './opener'
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
  /** Tilt toward the camera (radians), about the base. */
  tiltX: number
  /** Extra tilt toward the camera about the cap, which stays put: looking down onto it in close-up. */
  capTilt: number
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
  /**
   * The opener pries the cap off (the «تق» beat). If it isn't already hooked
   * on the cap (the scrolled approach), it comes in on its own first.
   */
  openWithOpener(): void
  /** Puts the cap back on: it flies back up from wherever it lies (a rewind). */
  resetCap(): void
  /** Sets the cap on, or off and lying on the floor, at once (when the studio comes back into view). */
  setCap(on: boolean): void
  /** Seconds since the cap snapped off, or -1 while it is on. */
  readonly openFor: number
  /** Called the moment the cap snaps off. */
  onPop: (() => void) | null
  /** Called when the cap hits the floor or rattles as it settles (strength 0…1). */
  onCapHit: ((strength: number) => void) | null
  /** The ice around the bottle (taps, chips). */
  ice: Ice
  /**
   * What a world-space ray meets first: the bottle (a column the size of its
   * body) or a whole ice cube — or nothing.
   */
  pick(ray: THREE.Ray): { kind: 'bottle' } | { kind: 'ice'; index: number } | null
  /** A tap on the glass: the bottle rocks a little away from the hand (`side` −1 left … 1 right). */
  tapBottle(side: number): void
  /** A tap on an ice cube: see `Ice.tap`. */
  tapIce(index: number): IceTap | null
  /** Called when a chip of broken ice lands (strength 0…1). */
  onChipHit: ((strength: number) => void) | null
  update(dt: number, time: number, pointer: { snx: number; sny: number; vx: number; vy: number } | null, reduced: boolean): void
  /** Renders the reflection and contact shadow (call before rendering the scene). */
  prepare(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void
  /**
   * Follows the quality tier: the low tier reflects the floor at a lower
   * resolution, frosts the glass without transmission and traces the ice
   * more simply.
   */
  setQuality(quality: Quality): void
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
  bottle.group.add(opener.group)
  const plume: Plume = createPlume()
  bottle.group.add(plume.mesh)
  plume.mesh.position.y = BOTTLE.rim - 0.004
  // A breath of fog a few centimetres high, not a column of steam.
  plume.mesh.scale.set(0.7, 0.3, 1)
  const foam: Foam = createFoam({ quality, outerRadiusAt: (h) => bottle.radiusAt(h) })
  bottle.body.add(foam.mesh)

  const key = new THREE.DirectionalLight('#fff4e6', 1.3)
  key.position.set(-700, 900, 1200)
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.35)
  fill.position.set(900, 200, 600)
  scene.add(key, fill)

  // Glossy floor and contact shadow, on every tier (the low one reflects at
  // a lower resolution: the black acrylic is half of the picture). The floor
  // reflects the doogh, the label and the ice, but not the glass shell: its
  // transmission would draw the bottle's inside once more in the mirror,
  // for a rim the fading reflection barely shows.
  let floor: ReflectiveFloor | null = null
  let floorResolution = 0
  const reflect = () => {
    bottle.group.traverse((o) => o.layers.enable(REFLECT))
    bottle.glassMesh.layers.disable(REFLECT)
    ice.group.traverse((o) => o.layers.enable(REFLECT))
  }
  reflect()
  const setFloor = (q: Quality) => {
    const resolution = q === 'high' ? 0.5 : q === 'medium' ? 0.35 : 0.22
    if (resolution === floorResolution) return
    floorResolution = resolution
    if (floor) {
      scene.remove(floor.mesh)
      floor.dispose()
    }
    floor = new ReflectiveFloor({ width: 12000, depth: 12000, strength: 0.38, fade: [0, 0.28], blur: 4, layer: REFLECT, resolution })
    scene.add(floor.mesh)
  }
  setFloor(quality)
  const shadow = new ContactShadow({ width: 1, depth: 1, far: 1, opacity: 0.8, blur: 3, resolution: quality === 'low' ? 256 : 512 })
  const cast = () => {
    shadow.cast(bottle.body)
    shadow.cast(bottle.cap)
    shadow.cast(ice.group)
  }
  cast()
  scene.add(shadow.object)

  const state: StudioState = {
    x: 0,
    baseY: 0,
    scale: 100,
    turn: 0,
    tiltX: 0,
    capTilt: 0,
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
  // The opener's approach (when it comes in on its own), prying and retreat.
  let auto = 0
  let autoOn = false
  const lever = new Spring(0, { stiffness: 260, damping: 24 })
  const retract = new Spring(0, { stiffness: 70, damping: 15 })
  let idleClock = 0
  let shiver = 0

  let shadowKey = ''

  // --- The cap -----------------------------------------------------------
  // On the bottle it is a child of the bottle. Once it snaps off it is a
  // free body in the product's space (bottle units, the floor at y = 0):
  // real gravity, bounces that lose most of their energy, sliding friction,
  // and the wobble of a disc settling flat. Scrolling back rewinds it.
  const R = BOTTLE.capRadius
  const HALF = (BOTTLE.capTop - BOTTLE.capBottom) / 2
  const CENTER = (BOTTLE.capTop + BOTTLE.capBottom) / 2
  const G = 42 // ≈ 9 m/s² at 21.6 cm per unit
  type CapPhase = 'on' | 'prying' | 'free' | 'settling' | 'resting' | 'rewind'
  let phase: CapPhase = 'on'
  // (Read through a function where a step may have changed it.)
  const current = (): CapPhase => phase
  let byOpener = false
  let openedAt = -1
  let clock = 0
  const capRig = new THREE.Group()
  product.add(capRig)
  const vel = new THREE.Vector3()
  const spin = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const down = new THREE.Vector3(0, -1, 0)
  const nrm = new THREE.Vector3()
  const axis = new THREE.Vector3()
  const dq = new THREE.Quaternion()
  const flat = new THREE.Quaternion()
  const tiltQ = new THREE.Quaternion()
  let tilt = 0
  let wobble = 0
  let rattle = 0
  const fromPos = new THREE.Vector3()
  const fromQ = new THREE.Quaternion()
  let rewindT = 0
  // Where a cap pried off the left rim comes to rest: beside the bottle on
  // the left, in the gap between the ice cubes.
  const REST_SPOT = new THREE.Vector3(-0.4, HALF, 0.13)

  const toBottle = () => {
    bottle.group.add(bottle.cap)
    bottle.cap.position.set(0, 0, 0)
    bottle.cap.rotation.set(0, 0, 0)
  }
  const toRig = () => {
    capRig.add(bottle.cap)
    bottle.cap.position.set(0, -CENTER, 0)
    bottle.cap.rotation.set(0, 0, 0)
  }
  // Rotate the cap about its left rim (the opener pries the right side up).
  const hinge = (angle: number) => {
    const px = -R
    const py = BOTTLE.capBottom + 0.01
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    bottle.cap.position.set(px - px * c + py * s, py - px * s - py * c, 0)
    bottle.cap.rotation.set(0, 0, angle)
  }
  // The cap leaves the bottle: hand its world pose over to the rig.
  const launch = (hingeAngle: number, reduced: boolean) => {
    product.updateMatrixWorld(true)
    const centerWorld = new THREE.Vector3(0, CENTER, 0).applyMatrix4(bottle.cap.matrixWorld)
    const q = new THREE.Quaternion()
    bottle.cap.getWorldQuaternion(q)
    const pq = new THREE.Quaternion()
    product.getWorldQuaternion(pq)
    toRig()
    capRig.position.copy(product.worldToLocal(centerWorld))
    capRig.quaternion.copy(pq.invert().multiply(q))
    openedAt = clock
    studio.onPop?.()
    if (reduced) {
      // No flight: it simply lies where it would have landed.
      placeAtRest()
      return
    }
    phase = 'free'
    const j = () => 0.9 + Math.random() * 0.2
    // A short hop up and over the left rim; it clears the shoulder and lands
    // beside the bottle, between the ice cubes.
    vel.set(-1.17 * j(), 1.55 * j(), 0.39 * j())
    spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, 11 + hingeAngle * 10)
  }
  const placeAtRest = () => {
    if (bottle.cap.parent !== capRig) toRig()
    phase = 'resting'
    capRig.position.copy(REST_SPOT)
    capRig.quaternion.identity()
  }
  const stepFree = (h: number) => {
    vel.y -= G * h
    capRig.position.addScaledVector(vel, h)
    const w = spin.length()
    if (w > 1e-6) {
      dq.setFromAxisAngle(axis.copy(spin).divideScalar(w), w * h)
      capRig.quaternion.premultiply(dq).normalize()
    }
    nrm.copy(up).applyQuaternion(capRig.quaternion)
    const ny = nrm.y
    const lowest = capRig.position.y - (R * Math.sqrt(Math.max(0, 1 - ny * ny)) + HALF * Math.abs(ny))
    if (lowest >= 0) return
    capRig.position.y -= lowest
    if (vel.y < 0) {
      const impact = -vel.y
      vel.y = impact > 0.4 ? impact * 0.3 : 0
      vel.x *= 0.6
      vel.z *= 0.6
      spin.multiplyScalar(0.45)
      // The rim that hit tips it toward lying flat on its nearer face.
      axis.crossVectors(nrm, ny >= 0 ? up : down)
      spin.addScaledVector(axis, 10)
      if (impact > 0.25) studio.onCapHit?.(Math.min(1, impact / 3))
    }
    // Sliding on the acrylic.
    const f = Math.exp(-6 * h)
    vel.x *= f
    vel.z *= f
    spin.multiplyScalar(Math.exp(-3 * h))
    if (vel.y === 0 && Math.hypot(vel.x, vel.z) < 0.1 && spin.length() < 4) {
      // Settle: the remaining tilt winds down while the contact point runs
      // around the rim faster and faster, like a coin coming to rest.
      const face = ny >= 0 ? 1 : -1
      dq.setFromUnitVectors(nrm, axis.set(0, face, 0))
      flat.copy(dq).multiply(capRig.quaternion)
      tilt = Math.acos(Math.min(1, Math.abs(ny)))
      axis.set(0, face, 0).cross(nrm)
      wobble = Math.atan2(axis.z, axis.x)
      rattle = 0
      phase = 'settling'
    }
  }
  const stepSettle = (dt: number) => {
    tilt *= Math.exp(-5.5 * dt)
    const before = Math.floor(wobble / Math.PI)
    wobble += dt * Math.min(60, 6 + 1.4 / Math.sqrt(Math.max(tilt, 0.002)))
    if (Math.floor(wobble / Math.PI) !== before && tilt > 0.03) studio.onCapHit?.(Math.min(0.5, tilt * 2.5))
    axis.set(Math.cos(wobble), 0, Math.sin(wobble))
    tiltQ.setFromAxisAngle(axis, tilt)
    capRig.quaternion.copy(tiltQ).multiply(flat)
    capRig.position.x += vel.x * dt
    capRig.position.z += vel.z * dt
    vel.multiplyScalar(Math.exp(-8 * dt))
    capRig.position.y = HALF * Math.cos(tilt) + R * Math.sin(tilt)
    rattle += dt
    if (tilt < 0.003) {
      capRig.quaternion.copy(flat)
      capRig.position.y = HALF
      phase = 'resting'
    }
  }

  // --- The opener --------------------------------------------------------
  // Hooked, its far end rests on the cap's top and its lip sits just under
  // the skirt on the other side; lifting the handle turns it about the far
  // end, and the lip pries that side of the cap up.
  const LIP_X = R * 0.94
  const LIP_Y = BOTTLE.capBottom - 0.002
  const TILT = Math.asin((BOTTLE.capTop - LIP_Y) / OPENER_REST)
  const REST_X = LIP_X - OPENER_REST * Math.cos(TILT)
  const REST_Y = BOTTLE.capTop
  // Lying flat on the cap before it hooks: the lip just past the rim.
  const LIE_X = REST_X + OPENER_REST
  const LIE_Y = BOTTLE.capTop + 0.0004
  const SWING = TILT + 0.34
  const lip = new THREE.Vector2()
  const about = (x: number, y: number, angle: number) => {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const dx = x - REST_X
    const dy = y - REST_Y
    lip.set(REST_X + dx * c - dy * s, REST_Y + dx * s + dy * c)
  }

  const studio: Studio = {
    scene,
    product,
    bottle,
    state,
    onPop: null,
    onCapHit: null,
    onChipHit: null,
    ice,
    pick(ray) {
      if (!state.visible) return null
      const onIce = state.ice > 0.01 ? ice.pick(ray) : null
      // The bottle as a column of its body's radius, in the product's frame.
      const S = state.scale
      const ox = (ray.origin.x - product.position.x) / S
      const oy = (ray.origin.y - product.position.y) / S
      const oz = (ray.origin.z - product.position.z) / S
      const { x: dx, y: dy, z: dz } = ray.direction
      const a = dx * dx + dz * dz
      const b = ox * dx + oz * dz
      const c = ox * ox + oz * oz - BOTTLE.radius * BOTTLE.radius
      const disc = b * b - a * c
      let onBottle = Infinity
      if (a > 1e-9 && disc > 0) {
        const t = (-b - Math.sqrt(disc)) / a
        const y = oy + dy * t
        if (t > 0 && y > 0 && y < BOTTLE.capTop) onBottle = t * S
      }
      if (onIce && onIce.distance < onBottle) return { kind: 'ice', index: onIce.index }
      return onBottle < Infinity ? { kind: 'bottle' } : null
    },
    tapBottle(side) {
      rockZ.velocity -= side * 0.9
      kick.impulse(0.6)
    },
    tapIce: (index) => ice.tap(index),
    get openFor() {
      return openedAt < 0 ? -1 : clock - openedAt
    },
    openWithOpener() {
      if (phase !== 'on') return
      phase = 'prying'
      byOpener = true
      // Not hooked yet (the finale): the opener comes in on its own first.
      autoOn = state.opener < 0.99
      if (autoOn) auto = 0
    },
    resetCap() {
      if (phase === 'on' || phase === 'rewind') return
      openedAt = -1
      byOpener = false
      autoOn = false
      if (phase === 'prying') {
        phase = 'on'
        toBottle()
        return
      }
      fromPos.copy(capRig.position)
      fromQ.copy(capRig.quaternion)
      rewindT = 0
      phase = 'rewind'
    },
    setCap(on) {
      autoOn = false
      auto = 0
      if (on) {
        phase = 'on'
        openedAt = -1
        byOpener = false
        lever.snap(0)
        retract.snap(0)
        toBottle()
      } else if (phase === 'on' || phase === 'prying') {
        // Off long ago: lying on the floor, the opener gone.
        placeAtRest()
        openedAt = clock - 10
        byOpener = true
        lever.snap(1)
        retract.snap(1)
      }
    },
    update(dt, time, pointer, reduced) {
      clock += dt
      const S = state.scale
      product.visible = state.visible
      if (!state.visible) return
      product.position.set(state.x, state.baseY, 0)
      product.scale.setScalar(S)
      bottle.setScale(S)
      ice.place(product.position, S)
      ice.update(dt, clock, (strength) => studio.onChipHit?.(strength))

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
      const ct = state.capTilt
      bottle.group.rotation.set(state.tiltX + ct + tiltX.value + rx, state.turn + idleTurn, tiltZ.value + rz)
      // Turn about the cap rather than the base: shift the bottle so the cap stays where the camera framed it.
      bottle.group.position.set(0, CENTER * (1 - Math.cos(ct)), -CENTER * Math.sin(ct))

      // Ice and floor.
      ice.group.visible = state.ice > 0.01
      ice.group.scale.setScalar(lerp(0.6, 1, state.ice))
      if (floor) {
        floor.mesh.position.set(state.x, state.baseY, 0)
        floor.strength = 0.38 * state.floor
        floor.setFade(0, 0.3 * S)
        floor.mesh.visible = state.floor > 0.01
      }
      // The shadow plane follows the bottle, sized to it.
      shadow.object.position.set(state.x, state.baseY + 0.4, 0)
      shadow.resize(S * 1.6, S * 1.6, S * 0.5)
      shadow.opacity = 0.8 * state.floor

      // Opener: comes in (scrolled, or on its own), hooks, levers, withdraws.
      if (autoOn) auto = reduced ? 1 : Math.min(1, auto + dt / 0.55)
      const a = THREE.MathUtils.clamp(Math.max(state.opener, autoOn ? auto : 0), 0, 1)
      const hooked = a >= 0.999
      lever.target = byOpener && hooked && phase !== 'on' && phase !== 'rewind' ? 1 : 0
      retract.target = byOpener && openedAt >= 0 && clock - openedAt > 0.18 ? 1 : 0
      if (reduced) {
        lever.snap(lever.target)
        retract.snap(retract.target)
      } else {
        lever.step(dt)
        retract.step(dt)
      }
      const l = THREE.MathUtils.clamp(lever.value, 0, 1.15)
      const w = THREE.MathUtils.clamp(retract.value, 0, 1.2)
      opener.group.visible = a > 0.001 && w < 0.98
      let lift = 0
      if (opener.group.visible || phase === 'prying') {
        // Slide in level and land on the cap; tip the handle down so the
        // lip hooks under the skirt; then lift the handle.
        const slide = THREE.MathUtils.smoothstep(a, 0, 0.72)
        const hook = THREE.MathUtils.smoothstep(a, 0.72, 1)
        const angle = -TILT * hook + SWING * l
        about(LIE_X + (1 - slide) * 0.85, LIE_Y + (1 - slide) * 0.14, angle)
        // Only the lever pries: how far the hooked lip has risen.
        if (hooked) lift = Math.max(0, lip.y - LIP_Y)
        opener.group.position.set(lip.x + w * 0.75, lip.y + w * 0.32, 0)
        opener.group.rotation.set(0, 0, angle + (1 - slide) * 0.06 + w * 0.3)
      }

      // Cap.
      const cap = bottle.cap
      cap.visible = true
      if (phase === 'prying') {
        // The lip lifts the right rim; the cap turns on its left rim until it snaps.
        const angle = Math.min(0.5, lift / (2 * R))
        hinge(angle)
        if (angle >= 0.26 || (reduced && l >= 0.99)) {
          kick.impulse(1.4)
          launch(angle, reduced)
        }
      } else if (phase === 'free') {
        // Small steps keep the bounces honest at any frame rate.
        const n = Math.max(1, Math.ceil(dt / (1 / 240)))
        for (let i = 0; i < n && current() === 'free'; i++) stepFree(dt / n)
        if (current() === 'settling') stepSettle(0)
      } else if (phase === 'settling') {
        stepSettle(reduced ? 1 : dt)
      } else if (phase === 'rewind') {
        // Back up onto the bottle along an arc, as if the film ran backward.
        rewindT = Math.min(1, rewindT + dt / (reduced ? 0.0001 : 0.5))
        const e = rewindT * rewindT * (3 - 2 * rewindT)
        product.updateMatrixWorld(true)
        const target = axis.set(0, CENTER, 0).applyMatrix4(bottle.group.matrix)
        const mid = (fromPos.y + target.y) / 2 + 0.18
        capRig.position.set(lerp(fromPos.x, target.x, e), (1 - e) * (1 - e) * fromPos.y + 2 * (1 - e) * e * mid + e * e * target.y, lerp(fromPos.z, target.z, e))
        capRig.quaternion.slerpQuaternions(fromQ, bottle.group.quaternion, e)
        if (rewindT >= 1) {
          phase = 'on'
          toBottle()
        }
      } else if (phase === 'on') {
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
    setQuality(q) {
      setFloor(q)
      bottle.setQuality(q)
      ice.setQuality(q)
      reflect()
      cast()
    },
    prepare(renderer, camera) {
      if (!state.visible) return
      if (floor && floor.mesh.visible) floor.update(renderer, scene, camera)
      if (state.floor > 0.01) {
        // A turned bottle casts the same shadow as it spins: re-render only
        // when something that casts moves, tilts or is scaled.
        const r = bottle.group.rotation
        const c = capRig.position
        const key = `${Math.round(state.x)}|${Math.round(state.baseY)}|${Math.round(state.scale)}|${r.x.toFixed(3)}|${r.z.toFixed(3)}|${phase}|${c.x.toFixed(3)}|${c.y.toFixed(3)}|${c.z.toFixed(3)}|${capRig.quaternion.w.toFixed(3)}|${ice.group.scale.x.toFixed(3)}|${ice.group.children.length}`
        if (key !== shadowKey) {
          shadowKey = key
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
      shadow.dispose()
      scene.environment?.dispose()
    },
  }
  return studio
}
