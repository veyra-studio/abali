/**
 * The WebGL side of the film. One renderer, three worlds, one veil:
 * - studio: the bottle on black acrylic (hero, تق, پیس, finale), placed in
 *   CSS pixels through the layer's pixel camera;
 * - landscape: Abali's mountains in snow (آخیش), built when first needed;
 * - table: the sofreh, seen from above (سفره), built when first needed;
 * - veil: foam, mist and dark fades drawn over whichever world is showing.
 * Chapters choose the world and write state; this module renders.
 */
import * as THREE from 'three'
import { Phase, type Stage } from '@veyra/core'
import { threeLayer, type ThreeLayer } from '@veyra/core/three'
import type { Landscape } from './landscape'
import { createStudio, type Quality, type Studio } from './studio'
import type { Table } from './table'
import { createVeil, type Veil } from './veil'

export type World = 'studio' | 'landscape' | 'table' | 'none'

export interface Experience {
  layer: ThreeLayer
  studio: Studio
  veil: Veil
  /** The world drawn this frame. */
  world: World
  landscape: Landscape | null
  table: Table | null
  /** Builds the landscape and the table (lazy chunks). Safe to call repeatedly. */
  prepare(which: 'landscape' | 'table'): Promise<void>
  dispose(): void
}

export function createExperience(stage: Stage): Experience {
  const layer = stage.use(threeLayer({ fov: 15, zIndex: 1, maxDpr: 2, near: 2, autoRender: false, renderer: { antialias: stage.quality?.tier.value !== 'low' } }))
  // Read the tier after the layer: on a software renderer it starts low.
  const tier: Quality = stage.quality?.tier.value ?? 'medium'
  const { renderer, scene, camera } = layer
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  const transmission = (t: Quality) => (t === 'high' ? 1 : t === 'medium' ? 0.75 : 0.5)
  renderer.transmissionResolutionScale = transmission(tier)
  stage.quality?.tier.subscribe((t) => {
    renderer.transmissionResolutionScale = transmission(t)
    exp.landscape?.setQuality(t)
  })

  const studio = createStudio(renderer, scene, tier)
  const veil = createVeil()

  const pending = new Map<string, Promise<void>>()
  const exp: Experience = {
    layer,
    studio,
    veil,
    world: 'studio',
    landscape: null,
    table: null,
    prepare(which) {
      let p = pending.get(which)
      if (!p) {
        p =
          which === 'landscape'
            ? import('./landscape').then(async ({ createLandscape }) => {
                exp.landscape = await createLandscape(renderer, stage.quality?.tier.value ?? tier)
              })
            : import('./table').then(async ({ createTable }) => {
                exp.table = await createTable(renderer, tier)
              })
        pending.set(which, p)
      }
      return p
    },
    dispose() {
      studio.dispose()
      veil.dispose()
      exp.landscape?.dispose()
      exp.table?.dispose()
      layer.destroy()
    },
  }

  stage.onFrame((frame) => {
    const dt = frame.delta
    const time = frame.time
    const reduced = stage.reducedMotion.value
    veil.uniforms.uTime.value = time
    veil.uniforms.uRes.value.set(layer.width, layer.height)

    let world = exp.world
    if (world === 'landscape' && !exp.landscape) world = 'none'
    if (world === 'table' && !exp.table) world = 'none'
    const drawing = world !== 'none' || veil.active
    layer.canvas.style.visibility = drawing ? 'visible' : 'hidden'
    if (!drawing) return

    renderer.autoClear = true
    if (world === 'studio') {
      studio.update(dt, time, stage.pointer, reduced)
      studio.prepare(renderer, camera)
      renderer.render(scene, camera)
    } else if (world === 'landscape') {
      exp.landscape!.update(dt, time, layer.width, layer.height, reduced)
      renderer.render(exp.landscape!.scene, exp.landscape!.camera)
    } else if (world === 'table') {
      exp.table!.update(dt, time, layer.width, layer.height, reduced)
      renderer.render(exp.table!.scene, exp.table!.camera)
    } else {
      renderer.clear()
    }
    if (veil.active) {
      renderer.autoClear = false
      renderer.render(veil.scene, veil.camera)
      renderer.autoClear = true
    }
  }, Phase.render + 1)

  return exp
}
