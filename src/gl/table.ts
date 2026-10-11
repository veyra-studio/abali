/**
 * «سفره»: the table, seen from above in soft window light. Dishes land one
 * by one as the chapter scrolls — chelow with saffron and butter, two
 * koobideh, grilled tomatoes, onion, sumac, bread and herbs — and last, the
 * one thing that was missing: the bottle and a glass of doogh.
 * Units: centimetres; the cloth lies on y = 0, the camera looks straight down.
 */
import * as THREE from 'three'
import { ContactShadow, studioEnvironment, studioLights } from '@veyra/core/three'
import { BOTTLE, createBottle } from './bottle'
import { createCloth } from './food/cloth'
import { createFork, createSpoon, steelEnvironment } from './food/cutlery'
import { createDooghGlass } from './food/glass'
import { createKebab } from './food/kebab'
import { createPlate } from './food/plate'
import { createRice } from './food/rice'
import { createTomato } from './food/tomato'
import { createSides } from './food/sides'
import type { Quality } from './studio'

export interface Table {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Scroll progress through the chapter 0…1. */
  progress: number
  /** Number of dishes (the bottle included). */
  count: number
  /** How many dishes have landed at progress `p`. */
  landed(p: number): number
  /** How many menu items are lit at progress `p`. */
  litMenu(p: number): number
  /** Called the moment a dish touches the cloth (its weight, 0.6…1.3). */
  onLand: ((weight: number) => void) | null
  /** Fraction of the viewport's height that the copy covers from the top (portrait screens frame the spread below it). */
  cover: number
  update(dt: number, time: number, width: number, height: number, reduced: boolean): void
  /** Follows the quality tier: the window light's shadow map shrinks on lower tiers. */
  setQuality(quality: Quality): void
  dispose(): void
}

interface Dish {
  object: THREE.Object3D
  /** Progress at which it is set down. */
  at: number
  /** 0 = in the air, out of frame · 1 = resting on the cloth; plays in real time. */
  clock: number
  weight: number
  /** Menu item it completes (index into the menu list), or -1. */
  menu: number
  rest: THREE.Vector3
  restRot: THREE.Euler
  /** Where it is judged from when choosing the side it comes in from (food on the plate comes with the plate). */
  anchor: THREE.Vector2
}

export async function createTable(renderer: THREE.WebGLRenderer, quality: Quality): Promise<Table> {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e9e0cc')
  scene.environment = studioEnvironment(renderer, { lights: studioLights.soft, walls: ['#cfc7b8', '#8f877a'] })
  scene.environmentIntensity = 0.72
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  // Shadows are re-rendered only while something moves (see update).
  renderer.shadowMap.autoUpdate = false

  // Window light from the top left; its shadows fall toward the reader.
  const sun = new THREE.DirectionalLight('#fff1dc', 3.9)
  sun.position.set(-70, 150, -55)
  sun.castShadow = true
  const shadowSize = (q: Quality) => (q === 'high' ? 2048 : q === 'medium' ? 1536 : 1024)
  sun.shadow.mapSize.setScalar(shadowSize(quality))
  sun.shadow.camera.left = -85
  sun.shadow.camera.right = 85
  sun.shadow.camera.top = 60
  sun.shadow.camera.bottom = -60
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 320
  sun.shadow.radius = 4
  sun.shadow.blurSamples = 16
  sun.shadow.bias = -0.0004
  scene.add(sun, new THREE.HemisphereLight('#fff8ee', '#cbbd9f', 0.26))

  const disposers: Array<() => void> = []
  // The printed border frames the spread along the top and the left.
  // Where the dishes stand (x, z, radius), so the cloth lies flat under them.
  const footprints: Array<[number, number, number]> = [
    [-24, -3, 16.5],
    [2, 6, 4.2],
    [-47, -11, 4.6],
    [-48, 13, 5.5],
    [-22, 18.3, 4],
    [-14, 21, 4],
    [-6, 23.7, 4],
  ]
  const cloth = createCloth(220, 150, quality, [-66 + 110, -38 + 75], footprints)
  disposers.push(cloth.dispose)
  scene.add(cloth.mesh)

  const dishes: Dish[] = []
  const add = (object: THREE.Object3D, x: number, z: number, rotY: number, at: number, menu: number, y = 0, anchor = new THREE.Vector2(x, z)) => {
    object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    object.position.set(x, y, z)
    object.rotation.y = rotY
    scene.add(object)
    dishes.push({ object, at, menu, clock: 0, weight: menu === -1 ? 1.3 : menu === 0 ? 1 : 0.7, rest: object.position.clone(), restRot: object.rotation.clone(), anchor })
  }

  // Chelow kabab: the plate, rice, two skewers' worth of koobideh, tomatoes.
  // Positions on the plate are in its own frame (centimetres from its center).
  const PLATE = new THREE.Vector2(-24, -3)
  const plate = createPlate(1.1)
  const rice = createRice({ quality })
  const platter = new THREE.Group()
  platter.add(plate.mesh)
  rice.group.position.set(-5.4, plate.well, 0.2)
  platter.add(rice.group)
  disposers.push(plate.dispose, rice.dispose)
  add(platter, PLATE.x, PLATE.y, 0, 0.12, 0)

  // Side by side along the rice; where a kebab reaches the rim, it rides up it.
  const skewers = [
    { x: 5.3, z: 0.9, length: 19.5, turn: 0.06, seed: 3 },
    { x: 9, z: 0, length: 16.5, turn: 0.08, seed: 7 },
  ]
  skewers.forEach((k, i) => {
    const rotY = Math.PI / 2 + k.turn
    const cos = Math.cos(rotY)
    const sin = Math.sin(rotY)
    const ground = (x: number, z: number) => Math.max(0, plate.surfaceAt(Math.hypot(k.x + x * cos + z * sin, k.z - x * sin + z * cos)) - plate.well)
    const kebab = createKebab({ seed: k.seed, quality, length: k.length, ground })
    const g = new THREE.Group()
    g.add(kebab.mesh)
    disposers.push(kebab.dispose)
    add(g, PLATE.x + k.x, PLATE.y + k.z, rotY, 0.2 + i * 0.06, 1, plate.well, PLATE)
  })
  // One beyond the rice at the top, one tucked between the rice and a kebab.
  const grilled = [
    { x: 0.2, z: -9.8, size: 5.6, seed: 2 },
    { x: 1.4, z: 8.8, size: 5, seed: 5 },
  ]
  grilled.forEach((t, i) => {
    const tomato = createTomato({ seed: t.seed, quality, size: t.size })
    const g = new THREE.Group()
    g.add(tomato.mesh)
    disposers.push(tomato.dispose)
    add(g, PLATE.x + t.x, PLATE.y + t.z, i * 1.3, 0.33 + i * 0.05, 2, plate.well - 0.08, PLATE)
  })

  // A spoon and a fork, set down just after the plate: polished steel,
  // reflecting a room of its own.
  const steelEnv = steelEnvironment(renderer)
  const spoon = createSpoon(steelEnv)
  const fork = createFork(steelEnv)
  disposers.push(spoon.dispose, fork.dispose, () => steelEnv.dispose())
  const cutlery = new THREE.Group()
  spoon.group.position.set(0, 0, -1.6)
  fork.group.position.set(0.6, 0, 1.6)
  cutlery.add(spoon.group, fork.group)
  // As a table is set: upright beside the dinner, handles toward the diner.
  add(cutlery, 5.5, 18, -Math.PI / 2 + 0.06, 0.15, -2)

  // Onion, sumac, bread and herbs.
  const sides = createSides(quality)
  disposers.push(sides.dispose)
  add(sides.onion, -48, 13, 0.4, 0.45, 3)
  add(sides.sumac, -47, -11, 0, 0.53, 4)
  add(sides.bread, -26, -29, 0.12, 0.6, 5)
  add(sides.herbs, 0, -20, 0.5, 0.66, 5)

  // The last two: what was missing.
  const bottle = createBottle({ quality })
  bottle.setScale(BOTTLE_CM)
  // Seen from above, refraction barely shows: plain see-through glass spares
  // the table a transmission pass.
  cheapGlass(bottle.glass)
  const lying = new THREE.Group()
  // On its side, label up, cap toward the far corner.
  bottle.group.rotation.set(0, 0, Math.PI / 2)
  bottle.group.rotateY(Math.PI / 2)
  bottle.group.scale.setScalar(BOTTLE_CM)
  bottle.group.position.set(BOTTLE_CM * 0.5, BOTTLE.radius * BOTTLE_CM * 0.985, 0)
  lying.add(bottle.group)
  disposers.push(bottle.dispose)
  add(lying, -14, 21, -0.32, 0.87, -1)
  const glass = createDooghGlass(quality)
  // From above the walls show the lit cloth through themselves. Transmission
  // did that by drawing the whole table a second time every frame (more than
  // half its cost); a pale, glossy, nearly opaque wall reads the same.
  glass.group.traverse((o) => {
    if (o instanceof THREE.Mesh && (o.material as THREE.MeshPhysicalMaterial).transmission > 0) wallGlass(o.material as THREE.MeshPhysicalMaterial)
  })
  disposers.push(glass.dispose)
  add(glass.group, 2, 6, 0, 0.9, -1)

  // Ambient occlusion where things meet the cloth: a soft contact shadow.
  const contact = new ContactShadow({ width: 150, depth: 110, far: 9, resolution: quality === 'low' ? 512 : 1024, blur: 2.2, darkness: 1.3, opacity: 0.55, color: '#2b1d10' })
  contact.object.position.set(-14, 0.35, 0)
  for (const d of dishes) contact.cast(d.object)
  scene.add(contact.object)

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 800)
  camera.up.set(0, 0, -1)

  // Window light: the table brighter toward the window (top left), falling
  // off across it — multiplied over the whole frame here in the render, so
  // it reaches every edge however a phone's toolbar moves.
  const drawing = new THREE.Vector2(1, 1)
  const windowLight = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uRes: { value: drawing } },
      vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec2 uRes;
        void main() {
          vec2 p = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - vec2(0.14, 0.06) * uRes) / max(uRes.x, uRes.y);
          float a = smoothstep(0.35, 1.1, length(p)) * 0.26;
          gl_FragColor = vec4(mix(vec3(1.0), vec3(0.251, 0.165, 0.071), a), 1.0);
        }`,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  )
  windowLight.frustumCulled = false
  windowLight.renderOrder = 100
  scene.add(windowLight)
  disposers.push(() => {
    windowLight.geometry.dispose()
    ;(windowLight.material as THREE.Material).dispose()
  })

  // Each dish is brought in by hand from the nearest side of the frame and
  // set down, in under a second once the scroll reaches it, and taken away
  // the same way if the scroll goes back. (Lowered from above, as before,
  // a dish seen from straight overhead only grew and popped into view.)
  const DOWN = 0.75
  const UP = 0.5
  const frame = { left: -60, right: 20, bottom: 40 }
  let settleFrames = 3
  const setQuality = (q: Quality) => {
    const size = shadowSize(q)
    if (sun.shadow.mapSize.x === size) return
    // three.js resizes the map on the next shadow render.
    sun.shadow.mapSize.setScalar(size)
    renderer.shadowMap.needsUpdate = true
  }
  // Frame the spread: wide screens see it all; tall ones a narrower column
  // (x −51…9, z −41…31 cm: the glass, the spoon and fork and the bottle
  // included), set below whatever copy covers the top.
  const frameSpread = (width: number, height: number, reduced: boolean, time: number) => {
    const aspect = width / height
    camera.aspect = aspect
    const portrait = aspect < 0.8
    camera.fov = 28
    // When copy covers the top (narrow layouts), the spread fits below it,
    // centered; otherwise wide screens keep it left of the card.
    const covered = self.cover > 0
    const fit = covered ? 74 / (1 - self.cover) : 0
    const visible = Math.max(portrait ? 61 / aspect : 66 / Math.min(1, aspect), fit) // cm, top to bottom
    const dist = visible / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const drift = reduced ? 0 : Math.sin(time * 0.15) * 0.4
    const x = portrait ? -21 : (covered ? -20 : -8) + drift
    const z = covered ? -5 - (self.cover / 2) * visible : portrait ? -5 : -2
    camera.position.set(x, Math.min(dist, 420), z)
    camera.lookAt(camera.position.x, 0, camera.position.z)
    camera.updateProjectionMatrix()
    // The frame's sides on the cloth, for the dishes' way in.
    const across = (visible * aspect) / 2
    frame.left = x - across
    frame.right = x + across
    frame.bottom = z + visible / 2
  }
  const self: Table = {
    setQuality,
    scene,
    camera,
    progress: 0,
    count: dishes.length,
    onLand: null,
    cover: 0,
    landed: (p) => dishes.filter((d) => p >= d.at).length,
    litMenu(p) {
      let lit = 0
      for (const d of dishes) if (p >= d.at && d.menu >= 0) lit = Math.max(lit, d.menu + 1)
      return lit
    },
    update(dt, time, width, height, reduced) {
      frameSpread(width, height, reduced, time)
      renderer.getDrawingBufferSize(drawing)
      const p = self.progress
      let moving = false
      for (const d of dishes) {
        const down = p >= d.at
        const before = d.clock
        if (reduced) d.clock = down ? 1 : 0
        else d.clock = THREE.MathUtils.clamp(d.clock + (down ? dt / DOWN : -dt / UP), 0, 1)
        if (d.clock !== before) moving = true
        if (before < 0.92 && d.clock >= 0.92 && down) self.onLand?.(d.weight)
        const t = d.clock
        const o = d.object
        o.visible = t > 0
        if (!o.visible) continue
        // From just beyond the nearest side (left, right or the diner's),
        // carried a hand's breadth up, slowing as it arrives; a soft settle.
        const margin = 22
        const toLeft = d.anchor.x - frame.left
        const toRight = frame.right - d.anchor.x
        const toBottom = frame.bottom - d.anchor.y
        const nearest = Math.min(toLeft, toRight, toBottom)
        const fromX = nearest === toLeft ? frame.left - margin - (d.anchor.x - frame.left) + (d.rest.x - frame.left) : nearest === toRight ? frame.right + margin + (d.rest.x - d.anchor.x) : d.rest.x
        const fromZ = nearest === toBottom ? frame.bottom + margin + (d.rest.z - d.anchor.y) : d.rest.z
        const e = 1 - (1 - t) ** 3
        const settle = t > 0.9 ? Math.sin(((t - 0.9) / 0.1) * Math.PI) * 0.15 : 0
        o.position.set(THREE.MathUtils.lerp(fromX, d.rest.x, e), d.rest.y + (1 - e) * 7 + settle, THREE.MathUtils.lerp(fromZ, d.rest.z, e))
        o.rotation.set(d.restRot.x + (1 - e) * 0.1, d.restRot.y + (1 - e) * -0.25, d.restRot.z + (1 - e) * 0.04)
      }
      // Re-render shadows while dishes move, and for a few frames after.
      if (moving) settleFrames = 3
      const shadowsDirty = settleFrames > 0
      if (settleFrames > 0) settleFrames--
      if (shadowsDirty) {
        renderer.shadowMap.needsUpdate = true
        contact.update(renderer, scene)
      }
    },
    dispose() {
      for (const d of disposers) d()
      contact.dispose()
      scene.environment?.dispose()
    },
  }
  return self
}

/** The bottle's real height in centimetres (cap included). */
const BOTTLE_CM = 21.6

/** A glass wall seen from above, without transmission: the cloth's cream through clear glass, and its highlights. */
function wallGlass(m: THREE.MeshPhysicalMaterial) {
  m.transmission = 0
  m.color.set('#f6efe1')
  // Light comes through glass from every side: its far wall never sinks into shade.
  m.emissive.set('#2a261f')
  m.transparent = true
  m.opacity = 0.82
  m.roughness = 0.08
  m.clearcoat = 1
  m.clearcoatRoughness = 0.04
  m.envMapIntensity = 1.5
  m.needsUpdate = true
}

function cheapGlass(m: THREE.MeshPhysicalMaterial) {
  m.transmission = 0
  m.transparent = true
  m.opacity = 0.32
  m.depthWrite = false
  // Clear and glossy: the glass reads by its highlights.
  m.roughnessMap = null
  m.roughness = 0.06
  m.clearcoat = 1
  m.clearcoatRoughness = 0.04
  m.envMapIntensity = 1.6
  m.needsUpdate = true
}
